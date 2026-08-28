"""Taking a batch from a device, and telling it what it missed.

Two halves with different rules, which is the whole design:

* **Events** are append-only and cannot conflict, so they are inserted and the
  rollup follows whatever was genuinely new.
* **Documents** are edited by people, so each one carries the revision it was
  edited against. If the server has moved on, the server wins and its copy goes
  back as a conflict — except for `progress`, where monotonic counters merge by
  taking the larger value, because two devices playing the same child must never
  subtract XP from each other.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.errors import AppError, Forbidden
from app.models.auth import Principal
from app.models.events import PushIn, PushOut
from app.models.sync import (
    DOC_KINDS,
    KIND_PERMISSIONS,
    LEARNER_OWNED_KINDS,
    MAX_ART_BYTES,
    MONOTONIC_PROGRESS_FIELDS,
    ChangesOut,
    Conflict,
    Mutation,
    SyncDoc,
)
from app.repos import counters, rollups
from app.repos import docs as docs_repo
from app.repos import events as events_repo
from app.security.permissions import principal_can
from app.services.rollup import increments_for


def _as_sync_doc(row: dict[str, Any]) -> SyncDoc:
    return SyncDoc(
        kind=row["kind"],
        key=row["key"],
        learnerId=row.get("learnerId"),
        body=row.get("body") or {},
        rev=row.get("rev", 0),
        serverSeq=row.get("serverSeq", 0),
        deleted=row.get("deletedAt") is not None,
    )


def merge_progress(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Last write wins, except where a value can only go up.

    Three lines that prevent the regression people actually notice: a tablet
    syncing yesterday's XP after today's session should not roll a child back.
    """
    merged = {**existing, **incoming}
    for field in MONOTONIC_PROGRESS_FIELDS:
        if field in existing and field in incoming:
            try:
                merged[field] = max(existing[field], incoming[field])
            except TypeError:
                pass  # not a number after all — the later write stands
    return merged


async def push(db: AsyncIOMotorDatabase, principal: Principal, body: PushIn) -> PushOut:
    family_id = principal.family_id
    assert family_id is not None  # the router's dependency guarantees it

    accepted = 0
    duplicates = 0
    conflicts: list[Conflict] = []

    if body.events:
        # A learner device may only write its own record. Not a permission —
        # that is `learner_data:append`; this is *whose* data it may append to.
        if principal.learner_id:
            for event in body.events:
                event.learner_id = principal.learner_id

        last_seq = await counters.next_seq(db, family_id, len(body.events))
        first_seq = last_seq - len(body.events) + 1

        documents = [
            events_repo.to_document(
                event,
                family_id=family_id,
                device_id=body.device_id or principal.device_id,
                server_seq=first_seq + index,
            )
            for index, event in enumerate(body.events)
        ]
        inserted, duplicates = await events_repo.insert_many(db, documents)
        accepted += len(inserted)

        inserted_ids = {doc["eventId"] for doc in inserted}
        increments = [
            increments_for(event, family_id=family_id)
            for event in body.events
            if event.id in inserted_ids
        ]
        await rollups.apply(db, [i for i in increments if i])

    for mutation in body.mutations:
        outcome = await _apply_mutation(db, principal, mutation)
        if outcome is None:
            accepted += 1
        else:
            conflicts.append(outcome)

    return PushOut(
        accepted=accepted,
        duplicates=duplicates,
        conflicts=conflicts,
        cursor=await counters.current(db, family_id),
    )


async def _apply_mutation(
    db: AsyncIOMotorDatabase, principal: Principal, mutation: Mutation
) -> Conflict | None:
    """Apply one document edit, or return the server's copy as a conflict."""
    family_id = principal.family_id
    assert family_id is not None

    if mutation.kind not in DOC_KINDS:
        # A client bug, not a document. Refusing it here keeps a typo from
        # creating a row nothing will ever read back — and says which kind it
        # was, because the alternative is a silent no-op nobody notices.
        raise AppError(400, "unknown_kind", f"Cannot store a document of kind '{mutation.kind}'.")

    needed = KIND_PERMISSIONS.get(mutation.kind)
    if needed and not principal_can(principal, needed):
        # A 403 rather than a conflict: a conflict means "your edit lost, here
        # is the truth", and there may be no truth yet to send back.
        raise Forbidden(f"This account cannot {needed.replace(':', ' ')}.")

    if (
        principal.learner_id
        and mutation.kind in LEARNER_OWNED_KINDS
        and mutation.key != principal.learner_id
    ):
        # Holding the right is not the same as it being your record — see
        # `LEARNER_OWNED_KINDS`.
        raise Forbidden("A learner may only change their own record.")

    if mutation.kind == "art" and not mutation.deleted:
        size = len(str(mutation.body.get("markup", "")).encode())
        if size > MAX_ART_BYTES:
            raise AppError(
                413,
                "art_too_large",
                f"That artwork is {size // 1024} KB; the limit is {MAX_ART_BYTES // 1024} KB.",
            )

    existing = await docs_repo.get(db, family_id, mutation.kind, mutation.key)
    current_rev = existing.get("rev", 0) if existing else 0

    body = mutation.body
    if existing and current_rev != mutation.base_rev:
        if mutation.kind == "progress" and not mutation.deleted:
            # Merged rather than refused: both devices are right about the child.
            body = merge_progress(existing.get("body") or {}, mutation.body)
        else:
            return Conflict(opId=mutation.op_id, doc=_as_sync_doc(existing))

    server_seq = await counters.next_seq(db, family_id)
    saved = await docs_repo.put(
        db,
        family_id=family_id,
        kind=mutation.kind,
        key=mutation.key,
        learner_id=mutation.learner_id or principal.learner_id,
        body=body,
        rev=current_rev + 1,
        server_seq=server_seq,
        device_id=principal.device_id,
        deleted=mutation.deleted,
    )
    return None if saved else None


async def changes(
    db: AsyncIOMotorDatabase,
    principal: Principal,
    cursor: int,
    limit: int,
    kinds: list[str] | None = None,
) -> ChangesOut:
    """Documents only.

    Events are never sent back down: the device that wrote them has them, and a
    device that has none needs the rollup, not forty thousand taps.
    """
    family_id = principal.family_id
    assert family_id is not None

    rows = await docs_repo.since(db, family_id, cursor, limit + 1, kinds)
    has_more = len(rows) > limit
    rows = rows[:limit]

    # A learner device sees family settings and its own record — not a sibling's.
    if principal.learner_id:
        rows = [
            row
            for row in rows
            if row.get("learnerId") in (None, principal.learner_id)
        ]

    latest = rows[-1]["serverSeq"] if rows else await counters.current(db, family_id)
    return ChangesOut(
        cursor=latest,
        docs=[_as_sync_doc(row) for row in rows],
        hasMore=has_more,
    )
