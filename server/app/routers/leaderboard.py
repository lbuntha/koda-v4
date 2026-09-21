"""The leaderboard's privacy boundary.

Phase 1 intentionally has no ranking endpoint. It exposes only the private
consent document to the learner's family. A missing document reads as off, and
publishing requires both an eligible adult/self-managed student and an explicit
confirmation in this request.
"""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pymongo.errors import DuplicateKeyError

from app.deps import AUTHENTICATED, Db, require
from app.errors import Conflict, Forbidden, NotFound, Unauthorized
from app.models.auth import Principal
from app.models.common import now
from app.models.leaderboard import (
    BuddiesOut,
    BuddyAcceptIn,
    BuddyInviteOut,
    BuddyOut,
    LeaderboardOut,
    LeaderboardPrivacyIn,
    LeaderboardPrivacyOut,
    LeaderboardRow,
)
from app.repos import buddies, leaderboard_privacy, learners
from app.security.policy import canonical_role
from app.security.rate_limit import INVITE_PER_IP, JOIN_CODE_PER_VALUE, limiter
from app.services import leaderboard as leaderboard_service
from app.services.codes import hash_buddy_code, new_buddy_code

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"], dependencies=[AUTHENTICATED])

CanReadLearner = Annotated[Principal, Depends(require("learner:read"))]
CanConsent = Annotated[Principal, Depends(require("leaderboard:consent"))]
CanManageBuddies = Annotated[Principal, Depends(require("buddy:manage"))]

BUDDY_INVITE_TTL = timedelta(minutes=15)
LEADERBOARD_SIZE = 20


def _may_target(p: Principal, learner_id: str) -> bool:
    """A learner session can name itself only; adults are family-scoped."""
    return not p.learner_id or p.learner_id == learner_id


def _out(learner_id: str, row: dict | None) -> LeaderboardPrivacyOut:
    if not row:
        return LeaderboardPrivacyOut(
            learnerId=learner_id,
            sharingEnabled=False,
            visibility="private",
            nickname=None,
            consentedAt=None,
            revokedAt=None,
        )
    consented = row.get("consentedAt")
    revoked = row.get("revokedAt")
    return LeaderboardPrivacyOut(
        learnerId=learner_id,
        sharingEnabled=row.get("sharingEnabled") is True,
        visibility=leaderboard_privacy.visibility_of(row),
        nickname=row.get("nickname"),
        consentedAt=consented.isoformat() if consented else None,
        revokedAt=revoked.isoformat() if revoked else None,
    )


async def _learner_or_404(db: Db, p: Principal, learner_id: str) -> dict:
    if p.family_id is None or not _may_target(p, learner_id):
        raise NotFound("No such learner.")
    row = await learners.by_id(db, learner_id, p.family_id)
    if not row:
        # A 404 for another family as well as a made-up id prevents this route
        # from becoming a learner-directory oracle.
        raise NotFound("No such learner.")
    return row


async def _managed_learner_or_404(db: Db, p: Principal, learner_id: str) -> dict:
    row = await _learner_or_404(db, p, learner_id)
    if canonical_role(p.role) not in {"owner", "parent", "student"}:
        raise Forbidden("A parent or self-managed student must manage buddy connections.")
    return row


def _caller_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _buddy_out(db: Db, relationship: dict, learner_id: str) -> BuddyOut:
    other = next(
        participant
        for participant in relationship["participants"]
        if participant["learnerId"] != learner_id
    )
    privacy = await leaderboard_privacy.get(
        db, other["familyId"], other["learnerId"]
    )
    shared = bool(privacy and privacy.get("sharingEnabled") is True)
    avatar_seed = None
    if shared:
        peer = await learners.by_id(db, other["learnerId"], other["familyId"])
        avatar_seed = peer.get("avatarSeed") if peer else None
    accepted = relationship["acceptedAt"]
    return BuddyOut(
        relationshipId=relationship["_id"],
        nickname=privacy.get("nickname") if shared else None,
        avatarSeed=avatar_seed,
        sharingEnabled=shared,
        connectedAt=accepted.isoformat(),
    )


async def _ranked_rows(
    db: Db,
    visible: list[dict],
    own_learner_id: str,
    week_start,
    week_end,
) -> list[LeaderboardRow]:
    """Rank everyone, then return the top 20 plus the viewer when below it."""
    subjects = [(row["familyId"], row["learnerId"]) for row in visible]
    scores = await leaderboard_service.weekly_xp(db, subjects, week_start, week_end)
    visible.sort(
        key=lambda row: (
            -scores[(row["familyId"], row["learnerId"])],
            row["nickname"].casefold(),
            row["learnerId"],
        )
    )
    ranked = [
        LeaderboardRow(
            rank=index,
            isYou=row["learnerId"] == own_learner_id,
            nickname=row["nickname"],
            avatarSeed=row.get("avatarSeed"),
            weeklyXp=scores[(row["familyId"], row["learnerId"])],
        )
        for index, row in enumerate(visible, start=1)
    ]
    top = ranked[:LEADERBOARD_SIZE]
    mine = next((row for row in ranked[LEADERBOARD_SIZE:] if row.is_you), None)
    return [*top, mine] if mine else top


@router.get("/privacy/{learner_id}")
async def privacy(learner_id: str, db: Db, p: CanReadLearner) -> LeaderboardPrivacyOut:
    await _learner_or_404(db, p, learner_id)
    return _out(learner_id, await leaderboard_privacy.get(db, p.family_id, learner_id))


@router.patch("/privacy/{learner_id}")
async def change_privacy(
    learner_id: str,
    body: LeaderboardPrivacyIn,
    db: Db,
    p: CanConsent,
) -> LeaderboardPrivacyOut:
    await _learner_or_404(db, p, learner_id)

    # Permission exceptions can tune ordinary family work; consent is narrower.
    # A managed child cannot approve themselves and a caregiver cannot be made a
    # privacy decision-maker by an unrelated custom grant.
    if canonical_role(p.role) not in {"owner", "parent", "student"}:
        raise Forbidden("A parent or self-managed student must confirm leaderboard sharing.")

    row = await leaderboard_privacy.set_sharing(
        db,
        family_id=p.family_id,
        learner_id=learner_id,
        visibility=body.visibility,
        nickname=body.nickname,
        actor_id=p.subject_id,
        actor_role=canonical_role(p.role),
    )
    return _out(learner_id, row)


@router.get("/buddies/{learner_id}")
async def list_buddies(learner_id: str, db: Db, p: CanReadLearner) -> BuddiesOut:
    await _learner_or_404(db, p, learner_id)
    rows = await buddies.accepted_for(db, learner_id)
    return BuddiesOut(
        buddies=[await _buddy_out(db, row, learner_id) for row in rows]
    )


@router.get("/buddies/{learner_id}/invites")
async def list_buddy_invites(
    learner_id: str, db: Db, p: CanManageBuddies
) -> dict[str, list[BuddyInviteOut]]:
    await _managed_learner_or_404(db, p, learner_id)
    rows = await buddies.active_invites(db, p.family_id, learner_id, now())
    return {
        "invites": [
            BuddyInviteOut(id=row["_id"], expiresAt=row["expiresAt"].isoformat())
            for row in rows
        ]
    }


@router.post("/buddies/{learner_id}/invites", status_code=201)
async def create_buddy_invite(
    learner_id: str, db: Db, p: CanManageBuddies
) -> BuddyInviteOut:
    await _managed_learner_or_404(db, p, learner_id)
    expires_at = now() + BUDDY_INVITE_TTL
    # A collision is extraordinarily unlikely, but a privacy code must fail
    # closed rather than return a code whose hash belongs to somebody else.
    for _ in range(3):
        code = new_buddy_code()
        try:
            row = await buddies.create_invite(
                db,
                code_hash=hash_buddy_code(code),
                learner_id=learner_id,
                family_id=p.family_id,
                created_by=p.subject_id,
                expires_at=expires_at,
            )
            return BuddyInviteOut(
                id=row["_id"], code=code, expiresAt=expires_at.isoformat()
            )
        except DuplicateKeyError:
            continue
    raise Conflict("Could not create a buddy code. Try again.", "buddy_code_collision")


@router.delete("/buddies/{learner_id}/invites/{invite_id}", status_code=204)
async def revoke_buddy_invite(
    learner_id: str, invite_id: str, db: Db, p: CanManageBuddies
) -> None:
    await _managed_learner_or_404(db, p, learner_id)
    if not await buddies.revoke_invite(db, invite_id, p.family_id, learner_id):
        raise NotFound("No such buddy invite.")


@router.post("/buddies/accept", status_code=201)
async def accept_buddy_invite(
    body: BuddyAcceptIn,
    db: Db,
    p: CanManageBuddies,
    request: Request,
) -> BuddyOut:
    target = await _managed_learner_or_404(db, p, body.learner_id)
    normalized = body.code.strip().upper()
    code_hash = hash_buddy_code(normalized)
    await limiter.hit(db, "buddy:ip", _caller_ip(request), INVITE_PER_IP)
    await limiter.hit(db, "buddy:code", code_hash, JOIN_CODE_PER_VALUE)

    invite = await buddies.claim_invite(db, code_hash, body.learner_id, now())
    if not invite:
        raise Unauthorized(
            "That buddy code is invalid, used or expired.", "buddy_invite_invalid"
        )
    if invite["learnerId"] == body.learner_id:
        raise Conflict("A learner cannot add themselves as a buddy.", "buddy_self")

    existing = await buddies.relationship(db, invite["learnerId"], body.learner_id)
    if existing and existing.get("status") == "accepted":
        raise Conflict("These learners are already buddies.", "already_buddies")
    if existing and existing.get("blockedBy"):
        raise Conflict("This buddy connection cannot be added.", "buddy_unavailable")

    relationship = await buddies.accept(
        db,
        first={
            "learnerId": invite["learnerId"],
            "familyId": invite["familyId"],
        },
        second={"learnerId": target["_id"], "familyId": p.family_id},
        invite_id=invite["_id"],
    )
    if not relationship:
        raise Conflict("This buddy connection cannot be added.", "buddy_unavailable")
    await limiter.clear(db, "buddy:code", code_hash)
    return await _buddy_out(db, relationship, body.learner_id)


@router.delete("/buddies/{learner_id}/{relationship_id}", status_code=204)
async def remove_buddy(
    learner_id: str,
    relationship_id: str,
    db: Db,
    p: CanManageBuddies,
) -> None:
    await _managed_learner_or_404(db, p, learner_id)
    if not await buddies.remove_relationship(db, relationship_id, learner_id):
        raise NotFound("No such buddy relationship.")


@router.post("/buddies/{learner_id}/{relationship_id}/block", status_code=204)
async def block_buddy(
    learner_id: str,
    relationship_id: str,
    db: Db,
    p: CanManageBuddies,
) -> None:
    await _managed_learner_or_404(db, p, learner_id)
    if not await buddies.block(db, relationship_id, learner_id):
        raise NotFound("No such buddy relationship.")


@router.delete("/buddies/{learner_id}/{relationship_id}/block", status_code=204)
async def unblock_buddy(
    learner_id: str,
    relationship_id: str,
    db: Db,
    p: CanManageBuddies,
) -> None:
    await _managed_learner_or_404(db, p, learner_id)
    if not await buddies.unblock(db, relationship_id, learner_id):
        raise NotFound("No such buddy block.")


@router.get("/public/{learner_id}")
async def public_leaderboard(
    learner_id: str,
    db: Db,
    p: CanReadLearner,
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840, alias="tzOffsetMinutes"),
) -> LeaderboardOut:
    """Top 20 explicit public opt-ins, plus the viewer when ranked below 20."""
    await _learner_or_404(db, p, learner_id)
    generated_at = now()
    week_start, week_end = leaderboard_service.week_bounds(generated_at, tz_offset_minutes)
    public_privacy = await leaderboard_privacy.public_rows(db)
    peers: dict[tuple[str, str], dict] = {}
    for offset in range(0, len(public_privacy), 200):
        batch = public_privacy[offset : offset + 200]
        query = {
            "$or": [
                {"_id": row["learnerId"], "familyId": row["familyId"]}
                for row in batch
            ]
        }
        async for peer in db.learners.find(
            query, {"familyId": 1, "avatarSeed": 1}
        ):
            peers[(peer["familyId"], peer["_id"])] = peer
    visible: list[dict] = []
    for privacy_row in public_privacy:
        nickname = privacy_row.get("nickname")
        if not isinstance(nickname, str) or not nickname.strip():
            continue
        peer = peers.get((privacy_row["familyId"], privacy_row["learnerId"]))
        if not peer:
            continue
        visible.append(
            {
                "familyId": privacy_row["familyId"],
                "learnerId": privacy_row["learnerId"],
                "nickname": nickname,
                "avatarSeed": peer.get("avatarSeed"),
            }
        )
    own = next((row for row in visible if row["learnerId"] == learner_id), None)
    return LeaderboardOut(
        scope="public",
        sharingEnabled=own is not None,
        weekStart=week_start,
        weekEnd=week_end,
        generatedAt=generated_at,
        rows=await _ranked_rows(db, visible, learner_id, week_start, week_end),
    )


@router.get("/{learner_id}")
async def weekly_leaderboard(
    learner_id: str,
    db: Db,
    p: CanReadLearner,
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840, alias="tzOffsetMinutes"),
) -> LeaderboardOut:
    """This learner plus opted-in, accepted buddies for the current week."""
    learner = await _learner_or_404(db, p, learner_id)
    generated_at = now()
    week_start, week_end = leaderboard_service.week_bounds(
        generated_at, tz_offset_minutes
    )
    own_privacy = await leaderboard_privacy.get(db, p.family_id, learner_id)
    if (
        not own_privacy
        or own_privacy.get("sharingEnabled") is not True
        or not isinstance(own_privacy.get("nickname"), str)
        or not own_privacy["nickname"].strip()
    ):
        return LeaderboardOut(
            scope="buddies",
            sharingEnabled=False,
            weekStart=week_start,
            weekEnd=week_end,
            generatedAt=generated_at,
            rows=[],
        )

    visible = [
        {
            "familyId": p.family_id,
            "learnerId": learner_id,
            "nickname": own_privacy["nickname"],
            "avatarSeed": learner.get("avatarSeed"),
            "isYou": True,
        }
    ]
    for relationship in await buddies.accepted_for(db, learner_id):
        other = next(
            participant
            for participant in relationship["participants"]
            if participant["learnerId"] != learner_id
        )
        privacy_row = await leaderboard_privacy.get(
            db, other["familyId"], other["learnerId"]
        )
        if (
            not privacy_row
            or privacy_row.get("sharingEnabled") is not True
            or not isinstance(privacy_row.get("nickname"), str)
            or not privacy_row["nickname"].strip()
        ):
            continue
        peer = await learners.by_id(db, other["learnerId"], other["familyId"])
        if not peer:
            continue
        visible.append(
            {
                **other,
                "nickname": privacy_row["nickname"],
                "avatarSeed": peer.get("avatarSeed"),
                "isYou": False,
            }
        )

    return LeaderboardOut(
        scope="buddies",
        sharingEnabled=True,
        weekStart=week_start,
        weekEnd=week_end,
        generatedAt=generated_at,
        rows=await _ranked_rows(db, visible, learner_id, week_start, week_end),
    )
