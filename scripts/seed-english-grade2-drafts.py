"""Insert the reviewed English Grade 2 collection as local Studio drafts.

Every check must pass except "confirm the picture": a person confirms each
picture-word question in the Studio. --check verifies without writing.
"""
import argparse
import asyncio
import json
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import UpdateOne

from app.library_verify import verify_passage
from app.models.common import now
from app.repos.library import studio_page
from app.routers.library import _clean, _id
from app.settings import settings


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    config = settings()
    if config.environment != "development":
        raise SystemExit("This seeder requires a local development database.")

    source = json.loads(args.bundle.read_text())
    if len(source) != 50:
        raise SystemExit("Expected exactly 50 books.")
    books = {}
    bad = []
    to_confirm = 0
    for draft in source:
        book_id = _id(draft["id"])
        if book_id in books or not book_id.startswith("en-g2-story-"):
            raise SystemExit(f"Unexpected book ID: {book_id}")
        if (draft["language"], draft["band"], draft["ages"], draft["rev"]) != ("en", "B", [7, 8], 0):
            raise SystemExit(f"Unexpected reading level or language for {book_id}")
        draft = _clean(draft)
        verdict = verify_passage(draft, confirmed_split=True)
        failures = [c for c in verdict.checks if c.status == "fail"]
        problems = [c for c in failures if not c.message.startswith("confirm the picture")]
        to_confirm += len(failures) - len(problems)
        target = draft["questionCounts"]
        expected = {"comprehension": target["understand"], "vocab": target["words"], "spell": target["spell"], "match": target["match"]}
        if problems or not verdict.counts_match_band or verdict.counts != expected:
            bad.append(f"{book_id}: " + "; ".join(f"{c.question} {c.message}" for c in problems) + f" counts={verdict.counts}")
        books[book_id] = draft
    if bad:
        raise SystemExit("\n".join(bad))
    if args.check:
        print(json.dumps({"checked": len(books), "picturesToConfirm": to_confirm}))
        return

    client = AsyncIOMotorClient(config.mongodb_uri)
    try:
        db = client[config.mongodb_db]
        if not await db.users.find_one({"_id": args.owner, "status": "active"}, {"_id": 1}):
            raise SystemExit("An active local Studio owner is required.")
        lookup = {"id": {"$in": list(books)}}
        existing = await db.library_books.find(lookup).to_list(length=len(books))
        for row in existing:
            if row.get("deletedAt") or row.get("published") or row.get("rev") != 0:
                raise SystemExit(f"Existing book cannot be replaced: {row['id']}")
            if row.get("ownerId") != args.owner or row.get("draft") != books[row["id"]]:
                raise SystemExit(f"Existing, different draft was preserved: {row['id']}")
        timestamp = now()
        operations = [
            UpdateOne(
                {"id": book_id},
                {"$setOnInsert": {
                    "id": book_id, "draft": draft, "published": None, "rev": 0,
                    "ownerId": args.owner, "updatedBy": args.owner, "createdAt": timestamp,
                    "updatedAt": timestamp, "deletedAt": None, "confirmedSplit": True, "provider": "offline",
                }},
                upsert=True,
            )
            for book_id, draft in books.items()
        ]
        result = await db.library_books.bulk_write(operations, ordered=True)
        saved = await db.library_books.find(lookup).to_list(length=len(books))
        assert len(saved) == len(books)
        assert all(
            row["draft"] == books[row["id"]] and row["published"] is None and row["rev"] == 0
            and row["ownerId"] == args.owner and row["deletedAt"] is None
            for row in saved
        )
        assert await db.library_revisions.count_documents({"bookId": {"$in": list(books)}}) == 0
        studio = await studio_page(db, query="en-g2-story-", status="draft", language="en", page_size=50,
                                   owner={"ownerId": args.owner})
        assert {row["id"] for row in studio["items"]} == set(books)
        print(json.dumps({
            "inserted": result.upserted_count, "verifiedDrafts": len(saved), "published": 0,
            "picturesToConfirm": to_confirm,
            "questions": {k: sum(1 for b in books.values() for q in b["questions"] if q["kind"] == k)
                          for k in ("comprehension", "match", "vocab", "spell")},
            "categories": sorted({b["category"] for b in books.values()}),
        }))
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
