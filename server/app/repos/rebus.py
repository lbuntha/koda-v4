"""Rebus Rush puzzles in MongoDB.

Three collections:

  rebus_puzzles   one row per puzzle, whatever its state: pre-built and
                  published, drafted by a person or a model, approved and
                  waiting, rejected, or retired.
  rebus_releases  each publish, so a batch that turns out badly can be taken
                  back as one act.
  rebus_state     one row: `version`, a number that goes up whenever what a child
                  can see changes, so a device asks "anything new since 7?" and
                  usually hears "no".

The first puzzles are seed data: written in a file in the app
(`src/rebus/content/`, generated to `rebus_seed.json`) and created here as
**drafts authored by the admin account**, create-if-absent so an edit is never
undone by a restart. From there they follow the same flow as any puzzle:
review, approve, publish in a release.
"""

from __future__ import annotations

import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

STATUSES = ("draft", "approved", "published", "retired", "rejected")

#: What a device is told about a puzzle, and nothing else: no status, notes or authors' ids.
PUBLIC_FIELDS = ("id", "category", "ages", "difficulty", "trick", "pieces", "answer", "accepts", "explanation", "source", "author")


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48] or "puzzle"


def public(row: dict[str, Any]) -> dict[str, Any]:
    return {key: row[key] for key in PUBLIC_FIELDS if key in row and row[key] is not None}


async def version(db: AsyncIOMotorDatabase) -> int:
    row = await db.rebus_state.find_one({"_id": "state"})
    return int(row["version"]) if row else 0


async def bump(db: AsyncIOMotorDatabase) -> int:
    row = await db.rebus_state.find_one_and_update(
        {"_id": "state"}, {"$inc": {"version": 1}}, upsert=True, return_document=True
    )
    return int(row["version"])


SYSTEM = "system"


async def first_admin_id(db: AsyncIOMotorDatabase) -> str | None:
    """The platform admin account seed puzzles are authored by: the oldest active one."""
    # An older account has no status at all; only an explicitly inactive one is skipped.
    user = await db.users.find_one({"platformRole": "admin", "status": {"$in": [None, "active"]}}, sort=[("createdAt", 1)])
    return user["_id"] if user else None


async def adopt_seed(db: AsyncIOMotorDatabase, admin_id: str) -> int:
    """Give seed puzzles still held by "system" to this admin.

    A deployment seeded before any admin existed has nobody to author them; the
    first admin to open the Studio becomes their author.
    """
    result = await db.rebus_puzzles.update_many(
        {"seeded": True, "$or": [{"createdBy": {"$exists": False}}, {"createdBy": SYSTEM}]}, {"$set": {"createdBy": admin_id}}
    )
    return result.modified_count


async def names(db: AsyncIOMotorDatabase, ids: set[str]) -> dict[str, str]:
    """Account ids as people read them: a display name, else the email."""
    out: dict[str, str] = {}
    for user_id in ids - {SYSTEM}:
        user = await db.users.find_one({"_id": user_id}, {"displayName": 1, "email": 1})
        if user:
            out[user_id] = user.get("displayName") or user.get("email") or user_id
    return out


async def ensure_seed(db: AsyncIOMotorDatabase, puzzles: list[dict[str, Any]]) -> int:
    """Create the seed puzzles that are not here yet, as drafts by the admin. Returns how many.

    Create-if-absent, so a puzzle an admin has since edited, approved, published
    or retired is never put back. `seeded` is kept for one reason only: a seed
    puzzle cannot be deleted (it would be created again on the next start), so
    an unwanted one is rejected or retired instead.
    """
    created = 0
    owner = await first_admin_id(db) or SYSTEM
    for puzzle in puzzles:
        if await db.rebus_puzzles.find_one({"id": puzzle["id"]}, {"_id": 1}):
            continue
        stamp = now()
        await db.rebus_puzzles.insert_one(
            {
                **puzzle,
                "status": "draft",
                "seeded": True,
                "createdBy": owner,
                "note": "",
                "checks": None,
                "createdAt": stamp,
                "updatedAt": stamp,
                "publishedAt": None,
                "release": None,
            }
        )
        created += 1
    adopted = await adopt_seed(db, owner) if owner != SYSTEM else 0
    if created or adopted:
        await bump(db)
    return created


async def next_release_number(db: AsyncIOMotorDatabase) -> int:
    seq = await db.rebus_state.find_one_and_update({"_id": "state"}, {"$inc": {"releaseSeq": 1}}, upsert=True, return_document=True)
    return int(seq["releaseSeq"])


async def published(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    rows = await db.rebus_puzzles.find({"status": "published"}).sort("id", 1).to_list(length=20000)
    return [public(r) for r in rows]


async def get(db: AsyncIOMotorDatabase, puzzle_id: str) -> dict[str, Any] | None:
    return await db.rebus_puzzles.find_one({"id": puzzle_id})


async def is_duplicate(db: AsyncIOMotorDatabase, row: dict[str, Any]) -> bool:
    """Whether another puzzle already has this answer.

    A puzzle in play (approved or published) always counts. Among drafts the
    older one wins, so a fresh copy of an answer cannot block the original from
    being approved, and two copies cannot each block the other.
    """
    from app.rebus_verify import answer_key

    key = answer_key(row)
    mine = (row.get("createdAt"), row.get("id", ""))
    async for other in db.rebus_puzzles.find({"status": {"$in": ["draft", "approved", "published"]}}, {"id": 1, "answer": 1, "status": 1, "createdAt": 1}):
        if other["id"] == row.get("id") or answer_key(other) != key:
            continue
        if other["status"] in ("approved", "published"):
            return True
        if (other.get("createdAt"), other["id"]) < mine:
            return True
    return False


async def known_icons(db: AsyncIOMotorDatabase) -> frozenset[str]:
    """Every drawing a puzzle may use: the built-in ones, and any `rebus-*` filed in the Art library."""
    from app.rebus_verify import icon_ids

    added = {row["id"] async for row in db.art_assets.find({"id": {"$regex": "^rebus-"}, "deletedAt": None}, {"id": 1})}
    return icon_ids() | added


async def unique_id(db: AsyncIOMotorDatabase, category: str, answer: str) -> str:
    base = f"{_slug(category)}-{_slug(answer)}"
    candidate, n = base, 1
    while await db.rebus_puzzles.find_one({"id": candidate}, {"_id": 1}):
        n += 1
        candidate = f"{base}-{n}"
    return candidate


async def insert(db: AsyncIOMotorDatabase, doc: dict[str, Any]) -> dict[str, Any]:
    stamp = now()
    row = {
        "status": "draft",
        "seeded": False,
        "note": "",
        "checks": None,
        "release": None,
        "publishedAt": None,
        **doc,
        "createdAt": stamp,
        "updatedAt": stamp,
    }
    await db.rebus_puzzles.insert_one(row)
    return row


async def update(db: AsyncIOMotorDatabase, puzzle_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    return await db.rebus_puzzles.find_one_and_update(
        {"id": puzzle_id}, {"$set": {**fields, "updatedAt": now()}}, return_document=True
    )


async def delete(db: AsyncIOMotorDatabase, puzzle_id: str) -> bool:
    return (await db.rebus_puzzles.delete_one({"id": puzzle_id})).deleted_count == 1


async def listing(
    db: AsyncIOMotorDatabase,
    *,
    status: str | None = None,
    category: str | None = None,
    source: str | None = None,
    seeded: bool | None = None,
    icon: str | None = None,
    query: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[dict[str, Any]], int]:
    flt: dict[str, Any] = {}
    if status:
        flt["status"] = status
    if category:
        flt["category"] = category
    if source:
        flt["source"] = source
    if seeded is not None:
        flt["seeded"] = seeded
    if icon:
        flt["pieces"] = {"$elemMatch": {"kind": "icon", "id": icon}}
    if query and query.strip():
        flt["answer"] = {"$regex": re.escape(query.strip()), "$options": "i"}
    total = await db.rebus_puzzles.count_documents(flt)
    rows = await db.rebus_puzzles.find(flt).sort([("updatedAt", -1), ("id", 1)]).skip(skip).limit(limit).to_list(length=limit)
    return rows, total


async def overview(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """Counts the Studio shows on its first screen."""
    by_status = {s: 0 for s in STATUSES}
    by_category: dict[str, dict[str, int]] = {}
    async for row in db.rebus_puzzles.aggregate(
        [{"$group": {"_id": {"status": "$status", "category": "$category"}, "n": {"$sum": 1}}}]
    ):
        status, category = row["_id"]["status"], row["_id"]["category"]
        by_status[status] = by_status.get(status, 0) + row["n"]
        cat = by_category.setdefault(category, {s: 0 for s in STATUSES})
        cat[status] = cat.get(status, 0) + row["n"]
    return {"byStatus": by_status, "byCategory": by_category, "version": await version(db)}


# ---- releases ----------------------------------------------------------------


async def publish_approved(db: AsyncIOMotorDatabase, *, by: str, note: str) -> dict[str, Any] | None:
    ids = [r["id"] async for r in db.rebus_puzzles.find({"status": "approved"}, {"id": 1})]
    if not ids:
        return None
    number = await next_release_number(db)
    stamp = now()
    await db.rebus_puzzles.update_many(
        {"id": {"$in": ids}}, {"$set": {"status": "published", "publishedAt": stamp, "release": number, "updatedAt": stamp}}
    )
    release = {"number": number, "note": note, "puzzleIds": ids, "by": by, "at": stamp, "rolledBack": False}
    await db.rebus_releases.insert_one(release)
    await bump(db)
    return release


async def rollback(db: AsyncIOMotorDatabase, number: int) -> dict[str, Any] | None:
    release = await db.rebus_releases.find_one({"number": number, "rolledBack": False})
    if not release:
        return None
    await db.rebus_puzzles.update_many(
        {"id": {"$in": release["puzzleIds"]}, "release": number},
        {"$set": {"status": "approved", "release": None, "publishedAt": None, "updatedAt": now()}},
    )
    await db.rebus_releases.update_one({"number": number}, {"$set": {"rolledBack": True}})
    await bump(db)
    return release


async def get_release(db: AsyncIOMotorDatabase, number: int) -> dict[str, Any] | None:
    return await db.rebus_releases.find_one({"number": number}, {"_id": 0})


async def releases(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    return await db.rebus_releases.find({}, {"_id": 0}).sort("number", -1).to_list(length=200)


# ---- the generation prompt, versioned ------------------------------------------


async def prompts(db: AsyncIOMotorDatabase, limit: int = 20) -> list[dict[str, Any]]:
    return await db.rebus_prompts.find({}, {"_id": 0}).sort("version", -1).to_list(length=limit)


async def save_prompt(db: AsyncIOMotorDatabase, *, text: str, by: str) -> dict[str, Any]:
    """A new version of the system prompt. Old ones are kept, so a good batch can be repeated."""
    seq = await db.rebus_state.find_one_and_update(
        {"_id": "state"}, {"$inc": {"promptSeq": 1}}, upsert=True, return_document=True
    )
    row = {"version": int(seq["promptSeq"]), "text": text, "by": by, "at": now()}
    await db.rebus_prompts.insert_one(dict(row))
    return row


async def answers(db: AsyncIOMotorDatabase) -> list[str]:
    """Every answer in play or in the pipeline, for the generator not to repeat."""
    return [r["answer"] async for r in db.rebus_puzzles.find({"status": {"$in": ["draft", "approved", "published"]}}, {"answer": 1})]


async def icon_usage(db: AsyncIOMotorDatabase, *, sample: int = 8) -> dict[str, dict[str, Any]]:
    """How many puzzles use each drawing, and a few of their answers, for the Drawings tab.

    Counts puzzles in play or in the pipeline (not rejected or retired), and counts a
    puzzle once however many times it uses a drawing.
    """
    out: dict[str, dict[str, Any]] = {}
    pipeline = [
        {"$match": {"status": {"$in": ["draft", "approved", "published"]}}},
        {"$project": {"answer": 1, "icons": {"$setUnion": [[], {"$map": {"input": {"$filter": {"input": "$pieces", "cond": {"$eq": ["$$this.kind", "icon"]}}}, "in": "$$this.id"}}]}}},
        {"$unwind": "$icons"},
        {"$sort": {"answer": 1}},
        {"$group": {"_id": "$icons", "count": {"$sum": 1}, "answers": {"$push": "$answer"}}},
    ]
    async for row in db.rebus_puzzles.aggregate(pipeline):
        out[row["_id"]] = {"count": row["count"], "answers": row["answers"][:sample]}
    return out


async def drafts_in_scope(db: AsyncIOMotorDatabase, category: str | None) -> list[dict[str, Any]]:
    flt: dict[str, Any] = {"status": "draft"}
    if category:
        flt["category"] = category
    return await db.rebus_puzzles.find(flt).sort("id", 1).to_list(length=5000)
