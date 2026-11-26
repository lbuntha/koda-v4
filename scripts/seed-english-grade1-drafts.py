"""Insert the reviewed English Grade 1 collection as local Studio drafts."""
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
    args = parser.parse_args()
    config = settings()
    if config.environment != "development":
        raise SystemExit("This seeder requires a local development database.")

    source = json.loads(args.bundle.read_text())
    if len(source) != 50:
        raise SystemExit("Expected exactly 50 books.")
    books = {}
    for draft in source:
        book_id = _id(draft["id"])
        if book_id in books or not book_id.startswith("en-g1-story-"):
            raise SystemExit(f"Unexpected book ID: {book_id}")
        if (draft["language"], draft["band"], draft["ages"], draft["rev"]) != ("en", "A", [6, 7], 0):
            raise SystemExit(f"Unexpected reading level or language for {book_id}")
        draft = _clean(draft)
        verdict = verify_passage(draft, confirmed_split=True)
        if not verdict.publishable or verdict.counts != {"comprehension": 3, "vocab": 0, "spell": 2, "match": 0}:
            raise SystemExit(f"{book_id}: {verdict.summary()}")
        books[book_id] = draft

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
        studio = await studio_page(db, query="en-g1-story-", status="draft", language="en", page_size=50,
                                   owner={"ownerId": args.owner})
        assert {row["id"] for row in studio["items"]} == set(books)
        print(json.dumps({
            "inserted": result.upserted_count, "verifiedDrafts": len(saved), "published": 0,
            "comprehension": 150, "spelling": 100, "categories": sorted({b["category"] for b in books.values()}),
        }))
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
