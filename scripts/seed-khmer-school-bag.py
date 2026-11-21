"""Insert exactly one illustrated local draft, using Library Studio's storage code.

Run inside the local API container, with the prepared assets copied there:
  python seed-khmer-school-bag.py /tmp/koda-school-bag --owner <local-user-id>
  python seed-khmer-school-bag.py /tmp/koda-little-cat --owner <local-user-id> --book-id km-g1-story-little-cat
No AI APIs are called. Existing books, published revisions and accounts are untouched.
"""
import argparse
import asyncio
import base64
import hashlib
import json
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient
from app.repos import library
from app.routers.library import ImageWrite, _clean, _id, _out, photo_ids_of, store_image
from app.library_verify import verify_passage
from app.settings import settings


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("assets", type=Path)
    parser.add_argument("--owner", required=True)
    parser.add_argument("--book-id", default="km-g1-story-school-bag")
    parser.add_argument("--update-exercises", action="store_true")
    args = parser.parse_args()
    config = settings()
    if config.environment != "development":
        raise SystemExit("This seeder is restricted to the local development environment.")
    passage = _clean(json.loads((args.assets / "book.json").read_text()))
    manifest = json.loads((args.assets / "art-prompts.json").read_text())
    book_id = _id(args.book_id)
    assert passage["id"] == manifest["bookId"] == book_id
    if args.update_exercises and book_id != "km-g1-story-school-bag":
        raise SystemExit("The exercise update is specific to the school-bag book.")
    referenced_ids = photo_ids_of(passage) | {
        key[6:] for key in passage.get("pictures", {}).values() if key.startswith("photo-")
    }
    supplied_ids = {item["picture"][6:] for item in manifest["assets"]}
    assert supplied_ids == referenced_ids and len(manifest["assets"]) == len(supplied_ids)
    prepared = []
    for item in manifest["assets"]:
        data = (args.assets / item["file"]).read_bytes()
        expected = "photo-" + hashlib.sha256(data).hexdigest()
        assert expected == item["picture"], item["file"]
        body = ImageWrite(mime="image/webp", data=base64.b64encode(data).decode(), source="ai", prompt=item["prompt"][:2000])
        prepared.append((item, body))

    client = AsyncIOMotorClient(config.mongodb_uri)
    try:
        db = client[config.mongodb_db]
        owner = await db.users.find_one({"_id": args.owner, "status": "active"}, {"_id": 1})
        assert owner, "A real active local owner is required."
        existing = await library.get_any(db, book_id)
        if args.update_exercises:
            if not existing or existing.get("deletedAt") or existing.get("ownerId") != args.owner:
                raise SystemExit("Expected the existing draft owned by this account.")
            current = existing["draft"]
            prepared_sentences = {s["id"]: s for s in passage["sentences"]}
            if [(s["id"], s["text"]) for s in current["sentences"]] != [(s["id"], s["text"]) for s in passage["sentences"]]:
                raise SystemExit("Story text changed. Review the new exercises against the edited story first.")
            exercise_kinds = {"vocab", "spell", "match"}
            if any(q["kind"] in exercise_kinds for q in current["questions"]) or current.get("wordNotes"):
                raise SystemExit("The draft already has exercises or notes. Existing work was preserved.")
            passage = _clean({
                **current,
                "sentences": [
                    {**s, "words": prepared_sentences[s["id"]]["words"]}
                    if not existing.get("confirmedSplit") and not s.get("audioCues") else s
                    for s in current["sentences"]
                ],
                "questions": current["questions"] + [q for q in passage["questions"] if q["kind"] in exercise_kinds],
                "questionCounts": {**current["questionCounts"], "words": 3, "spell": 3, "match": 1},
                "pictures": {**current.get("pictures", {}), **passage["pictures"]},
                "confirmedPictures": {**current.get("confirmedPictures", {}), **passage["confirmedPictures"]},
                "wordNotes": passage["wordNotes"],
                "notesInQuiz": passage["notesInQuiz"],
            })
            prepared = [(item, body) for item, body in prepared if item["name"].startswith("word-")]
        elif existing:
            raise SystemExit("Book already exists; refusing to overwrite or create a duplicate.")
        confirmed_split = bool(existing and existing.get("confirmedSplit"))
        verdict = verify_passage(passage, confirmed_split=confirmed_split)
        failures = [c for c in verdict.checks if c.status == "fail" and c.rule != 8]
        if failures or not verdict.counts_match_band:
            raise SystemExit(f"Exercise checks failed: {failures}")
        before = await db.library_books.count_documents({})
        revisions_before = await db.library_revisions.count_documents({"bookId": book_id})
        for item, body in prepared:
            saved = await store_image(body, db, args.owner)
            assert "photo-" + saved.id == item["picture"]
        if args.update_exercises:
            from app.models.common import now
            result = await db.library_books.update_one(
                {"id": book_id, "updatedAt": existing["updatedAt"], "rev": existing["rev"], "deletedAt": None},
                {"$set": {"draft": passage, "updatedAt": now(), "updatedBy": args.owner}},
            )
            assert result.matched_count == 1, "The draft changed during the exercise update."
            row = await library.get(db, book_id)
        else:
            row = await library.save_draft(db, book_id, passage,
                {"confirmedSplit": False, "provider": "offline"}, args.owner, owner_id=args.owner)
        assert row["published"] == (existing.get("published") if existing else None)
        assert row["rev"] == (existing["rev"] if existing else 0)
        assert bool(row.get("confirmedSplit")) == confirmed_split
        image_ids = {item["picture"][6:] for item in manifest["assets"]}
        assert not await library.missing_images(db, image_ids)
        for item, _ in prepared:
            image = await library.get_image(db, item["picture"][6:])
            assert hashlib.sha256(bytes(image["data"])).hexdigest() == image["id"]
        assert await db.library_revisions.count_documents({"bookId": book_id}) == revisions_before
        inserted = 0 if args.update_exercises else 1
        assert await db.library_books.count_documents({}) == before + inserted
        studio = await library.studio_page(db, query=book_id, owner={"ownerId": args.owner})
        assert studio["total"] == 1
        out = _out(await library.get(db, book_id))
        print(json.dumps({"id": out.id, "title": out.title, "status": out.status,
            "database": config.mongodb_db, "booksInserted": inserted, "imagesStored": len(image_ids),
            "sentences": len(out.draft["sentences"]), "questions": verdict.counts,
            "notesInQuiz": out.draft["notesInQuiz"],
            "confirmedSplit": out.confirmed_split, "publishedRevision": out.rev if out.published else None,
            "visibleInStudio": studio["total"] == 1}, ensure_ascii=False))
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
