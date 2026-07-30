"""Repair SVG library artwork corrupted by the studio's attribute stripper.

`preprocessSvgMarkup` stripped `width`/`height`/`viewBox` with a value pattern that stopped
at the first space, so a multi-value `viewBox="0 0 100 100"` lost only `viewBox="0` and left
` 0 100 100"` stranded inside the opening tag. The result is not well-formed XML, so a
browser refuses to render it as a standalone SVG document — the asset saves, and every
learner card shows a broken image.

The frontend bug is fixed; this repairs what was already written. It rebuilds each opening
tag from its well-formed `name="value"` attributes only, dropping stray tokens, and leaves
anything that already parses untouched.

Immutable releases are deliberately NOT edited: fix the library, then publish a new release
and move assignments onto it.

    docker exec koda-v4-api-1 python -m scripts.repair_svg_markup --dry-run
    docker exec koda-v4-api-1 python -m scripts.repair_svg_markup
"""

from __future__ import annotations

import argparse
import asyncio
import re
import xml.etree.ElementTree as ET

from app.core.db import init_db
from app.models.content import SvgLibrary

ATTRIBUTE = re.compile(r"""[\w:.-]+\s*=\s*("[^"]*"|'[^']*')""")


def is_well_formed(markup: str) -> bool:
    try:
        ET.fromstring(markup)
        return True
    except ET.ParseError:
        return False


def repair_markup(markup: str) -> str:
    """Rebuild the opening tag from valid attributes, keeping the last of any duplicate."""
    if not isinstance(markup, str) or not markup.lstrip().lower().startswith("<svg"):
        return markup
    stripped = markup.lstrip()
    end = stripped.find(">")
    if end == -1:
        return markup
    self_closing = stripped[end - 1] == "/"
    tag = stripped[:end]

    by_name: dict[str, str] = {}
    for match in ATTRIBUTE.finditer(tag):
        name = match.group(0).split("=", 1)[0].strip()
        by_name[name] = match.group(0)  # last occurrence wins

    rebuilt = "<svg" + "".join(f" {value}" for value in by_name.values())
    return rebuilt + ("/>" if self_closing else ">") + stripped[end + 1:]


async def main(dry_run: bool) -> None:
    await init_db()
    repaired = broken = 0
    for library in await SvgLibrary.find_all().to_list():
        changed = False
        for asset in library.assets:
            markup = asset.get("markup")
            if not isinstance(markup, str) or is_well_formed(markup):
                continue
            broken += 1
            fixed = repair_markup(markup)
            if not is_well_formed(fixed):
                print(f"  UNREPAIRABLE {asset.get('id')} ({asset.get('label')})")
                continue
            print(f"  repaired {asset.get('id')} ({asset.get('label')})")
            asset["markup"] = fixed
            changed = True
            repaired += 1
        if changed and not dry_run:
            library.revision += 1
            await library.save()
    verb = "would repair" if dry_run else "repaired"
    print(f"\n{verb} {repaired} of {broken} malformed assets")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report without writing")
    asyncio.run(main(parser.parse_args().dry_run))
