"""Link every Grade 1 skill to artwork from the owner's SVG library.

Skills added by the path/question seeds shipped without a thumbnail, so they fell through to
the generic mascot on the learner card. This attaches a real library asset to each.

Only `thumbnailAssetId` is set, never `thumbnailUrl` — the two are mutually exclusive
(`content/schemas.py`), and an asset id is what gets snapshotted into the release and served
from `/learning/assets/{release}/{asset}`. Skills that already have artwork are left alone
unless `--relink` is passed.

    docker exec koda-v4-api-1 python -m scripts.link_skill_artwork --dry-run
    docker exec koda-v4-api-1 python -m scripts.link_skill_artwork
"""

from __future__ import annotations

import argparse
import asyncio

from app.core.db import init_db
from app.models.assignment import Assignment
from app.models.content import Curriculum, SvgLibrary
from app.models.user import User

CURRICULUM_ID = "seed-grade1-phase1"

#: skill id -> the library asset *label* to link. Labels, not ids, so the mapping stays
#: readable and survives an asset being recreated with a new id.
WANTED: dict[str, str] = {
    "seed-g1-skill-count": "Move and Count",
    "seed-g1-skill-subitize": "Kitty",
    "demo-g1-count-20": "TenBlock",
    "demo-g1-compare": "Duck",
    "seed-g1-skill-add": "Smiling",
    "demo-g1-add-20": "Adding Within 20",
    "demo-g1-add-three": "Jar",
    "seed-g1-skill-subtract": "Orange",
    "demo-g1-sub-20": "Orange",
}


async def main(dry_run: bool, relink: bool) -> None:
    await init_db()
    doc = await Curriculum.find_one(Curriculum.curriculum_id == CURRICULUM_ID)
    library = await SvgLibrary.find_one(SvgLibrary.owner_id == doc.owner_id)
    if not doc or not library:
        raise SystemExit("curriculum or SVG library not found")

    by_label = {asset.get("label"): asset.get("id") for asset in library.assets}
    available = {asset.get("id") for asset in library.assets}

    changed = 0
    for skill in doc.tree["skills"]:
        skill_id = skill.get("id")
        wanted_label = WANTED.get(skill_id)
        if not wanted_label:
            continue
        presentation = skill.setdefault("presentation", {})
        current = presentation.get("thumbnailAssetId")
        if current in available and not relink:
            print(f"  keep   {skill.get('label'):<26} -> {current}")
            continue
        asset_id = by_label.get(wanted_label)
        if not asset_id:
            print(f"  SKIP   {skill.get('label'):<26} -> no library asset labelled {wanted_label!r}")
            continue
        presentation["thumbnailAssetId"] = asset_id
        # A URL alongside an asset id is rejected on save; the asset is the source of truth.
        presentation.pop("thumbnailUrl", None)
        print(f"  link   {skill.get('label'):<26} -> {wanted_label} ({asset_id})")
        changed += 1

    print(f"\n{'would link' if dry_run else 'linked'} {changed} skill(s)")
    if dry_run or not changed:
        return

    doc.revision += 1
    await doc.save()

    from app.features.content.router import _publish_release
    owner = await User.get(doc.owner_id)
    release = await _publish_release(doc, owner)
    print(f"published rev {release.revision} ({release.release_id})")

    rows = await Assignment.find(
        Assignment.curriculum_id == CURRICULUM_ID, Assignment.status == "active"
    ).to_list()
    for assignment in rows:
        assignment.release_id = release.release_id
        await assignment.save()
    print(f"moved {len(rows)} assignment(s) onto it")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--relink", action="store_true", help="overwrite existing artwork too")
    args = parser.parse_args()
    asyncio.run(main(args.dry_run, args.relink))
