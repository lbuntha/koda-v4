"""Koda Trace: what a trace item and a collection must be before children see them.

Mirrors `src/trace/studio/checks.ts`. The Studio runs those checks live; the
server runs these at publish, whatever the editor said. One difference: the
Studio also ties each test to a fingerprint of the exact strokes it was made
on. The server cannot recompute that fingerprint byte-for-byte from the
browser's JSON, so it checks that every step has a passing test recorded and
leaves "tested on these exact strokes" to the Studio.
"""

from __future__ import annotations

import math
import re
from typing import Any

KINDS = {"line", "drawing", "letter", "mark", "numeral", "word"}
SHAPES = {"line", "curve", "hook", "loop", "dot", "free"}
STEPS = ["watch", "big", "guided", "faded", "copy", "memory"]
GRIDS = {"none", "3x3", "4x3-moeys", "baseline-4-lines", "dots"}
# Mirrors src/trace/paint/palette.ts.
CRAYONS = {"red", "orange", "yellow", "lime", "green", "sky", "blue", "purple", "pink", "peach", "brown", "gray", "black"}
MAX_PAINT_STEPS = 30
MAX_SEEDS = 40
MAX_STROKES = 60
# A colouring page smoothed by the magic pen is line art, not a stroke order: it may have many more lines.
MAX_LINE_ART = 600
MAX_NODES = 300
MAX_TITLE = 40
TOUCH = 18.0
CANVAS_SLACK = 2.0


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _inside(v: Any) -> bool:
    return _num(v) and -CANVAS_SLACK <= v <= 1000 + CANVAS_SLACK


def item_problems(item: Any, plan: Any, tests: Any) -> list[str]:
    """Everything that stops an item being published, in words an author can act on."""
    out: list[str] = []
    if not isinstance(item, dict):
        return ["the item is not readable"]
    title = item.get("title")
    if not isinstance(title, str) or not title.strip():
        out.append("it has no title")
    elif len(title) > MAX_TITLE:
        out.append(f"the title is longer than {MAX_TITLE} characters")
    if item.get("kind") not in KINDS:
        out.append("its kind is not one of " + ", ".join(sorted(KINDS)))
    if item.get("grid", "none") not in GRIDS:
        out.append("its grid is unknown")
    voice = item.get("voice")
    if voice is not None and (not isinstance(voice, str) or not re.fullmatch(r"[0-9a-f]{64}", voice)):
        out.append("its recording is not readable; record it again")
    voice_text = item.get("voiceText")
    if voice_text is not None and (not isinstance(voice_text, str) or len(voice_text) > 200):
        out.append("what the recording says is longer than 200 characters")

    strokes = item.get("strokes")
    colouring = item.get("activity") == "color"
    picture = (item.get("paint") or {}).get("picture") if isinstance(item.get("paint"), dict) else None
    if colouring and picture is not None:
        out.extend(_picture_problems(picture))
    if not isinstance(strokes, list) or (not strokes and not (colouring and picture is not None)):
        # A colouring item made from a picture needs no strokes: the picture is its line art.
        out.append("it has no line art" if colouring else "it has no strokes")
        strokes = []
    elif len(strokes) > (MAX_LINE_ART if colouring else MAX_STROKES):
        out.append(f"it has more than {MAX_LINE_ART if colouring else MAX_STROKES} strokes")
    for i, s in enumerate(strokes, start=1):
        if not isinstance(s, dict):
            out.append(f"stroke {i} is not readable")
            continue
        nodes = s.get("nodes")
        dot = s.get("shape") == "dot"
        if not isinstance(nodes, list) or (len(nodes) != 1 if dot else len(nodes) < 2) or len(nodes) > MAX_NODES:
            out.append(f"stroke {i} does not have the right number of points")
            continue
        if s.get("order") != i:
            out.append("strokes are not numbered 1, 2, 3… in order")
        if s.get("shape") not in SHAPES:
            out.append(f"stroke {i} has an unknown shape")
        if not all(isinstance(n, dict) and _inside(n.get("x")) and _inside(n.get("y")) for n in nodes):
            out.append(f"stroke {i} has a point outside the canvas")
        for n in nodes:
            for h in ("in", "out"):
                handle = n.get(h) if isinstance(n, dict) else None
                if handle is not None and not (isinstance(handle, dict) and _num(handle.get("dx")) and _num(handle.get("dy"))):
                    out.append(f"stroke {i} has a broken curve handle")
                    break
        if i > 1 and s.get("join") == "continue":
            prev = strokes[i - 2]
            pn = prev.get("nodes") if isinstance(prev, dict) else None
            if isinstance(pn, list) and pn and isinstance(pn[0], dict):
                end = pn[0] if prev.get("closed") else pn[-1]
                start = nodes[0]
                if math.hypot(start["x"] - end["x"], start["y"] - end["y"]) > TOUCH:
                    out.append(f"stroke {i} should carry on from stroke {i - 1} but does not touch it")

    activity = item.get("activity", "trace")
    if activity not in ("trace", "color"):
        out.append("its activity is not trace or color")
    elif activity == "color":
        # A colouring item has colour steps instead of writing steps, and no test to pass.
        return out + _paint_problems(item.get("paint"))

    if not isinstance(plan, dict) or not isinstance(plan.get("steps"), list) or not plan["steps"]:
        out.append("it has no writing steps")
        return out
    ids = [s.get("id") for s in plan["steps"] if isinstance(s, dict)]
    if any(i not in STEPS for i in ids) or len(set(ids)) != len(ids):
        out.append("its writing steps are not valid")
        return out
    if plan.get("canDoAt") != ids[-1]:
        out.append("its steps do not end with the tick")
    tests = tests if isinstance(tests, dict) else {}
    untested = []
    for step in plan["steps"]:
        test = tests.get(step["id"])
        bar = step.get("pass", 0)
        if not (
            isinstance(test, dict)
            and test.get("accepted") is True
            and _num(test.get("score"))
            and test["score"] >= (bar if _num(bar) else 0)
        ):
            untested.append(step["id"])
    if untested:
        out.append("not every step was test-written and passed (" + ", ".join(untested) + ")")
    return out


# The paint grid is 500×500 cells, one bit each, base64 (see src/trace/paint/picture.ts).
PACKED_WALLS = ((500 * 500 // 8 + 2) // 3) * 4


def _picture_problems(picture: Any) -> list[str]:
    """A colouring picture: its line art PNG and the matching line mask."""
    if not isinstance(picture, dict):
        return ["its picture is not readable"]
    lines = picture.get("lines")
    walls = picture.get("walls")
    if not isinstance(lines, str) or not lines.startswith("data:image/png;base64,"):
        return ["its picture's line art is not readable; upload the picture again"]
    if not isinstance(walls, str) or len(walls) != PACKED_WALLS:
        return ["its picture's parts are not readable; upload the picture again"]
    raw = picture.get("raw")
    if raw is not None and (not isinstance(raw, str) or len(raw) != PACKED_WALLS):
        return ["its picture's lines are not readable; upload the picture again"]
    return []


def _paint_problems(paint: Any) -> list[str]:
    """A colouring item's steps: each a known crayon (or a hex colour) and at least one area.

    Whether two steps share an area is the Studio's to check: it needs the line art drawn.
    """
    steps = paint.get("steps") if isinstance(paint, dict) else None
    if not isinstance(steps, list) or not steps:
        return ["it has no colour steps"]
    if len(steps) > MAX_PAINT_STEPS:
        return [f"it has more than {MAX_PAINT_STEPS} colour steps"]
    out: list[str] = []
    for i, st in enumerate(steps, start=1):
        if not isinstance(st, dict):
            out.append(f"colour step {i} is not readable")
            continue
        colour = st.get("color")
        if colour not in CRAYONS and not (isinstance(colour, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", colour)):
            out.append(f"colour step {i} has an unknown colour")
        seeds = st.get("seeds")
        if not isinstance(seeds, list) or not seeds:
            out.append(f"colour step {i} has no areas to colour")
        elif len(seeds) > MAX_SEEDS or not all(isinstance(p, dict) and _inside(p.get("x")) and _inside(p.get("y")) for p in seeds):
            out.append(f"colour step {i} has an area outside the canvas")
        words = st.get("instruction")
        if words is not None and (not isinstance(words, str) or len(words) > 200):
            out.append(f"the words of colour step {i} are longer than 200 characters")
    return out


def for_children(item: dict[str, Any]) -> dict[str, Any]:
    """What a published item carries: everything but the Studio's guide (a typed letter or an uploaded picture)."""
    return {k: v for k, v in item.items() if k != "guide"}
