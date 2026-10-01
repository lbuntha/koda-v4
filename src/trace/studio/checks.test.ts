import { describe, expect, it } from "vitest";
import { CHA, SEVEN } from "../fixtures/items";
import { runChecks } from "./checks";
import { newDraft, strokesPrint } from "./drafts";
import { PRIMITIVES, makePrimitive } from "./primitives";

const failing = (d: ReturnType<typeof newDraft>) => runChecks(d).filter((c) => !c.ok).map((c) => c.id);

describe("publish checks", () => {
  it("a new item needs strokes, a title and tests", () => {
    const d = newDraft({ ...CHA, title: "", strokes: [] });
    expect(failing(d)).toEqual(expect.arrayContaining(["hasTitle", "hasStrokes", "tested"]));
  });

  it("an item passes once every step is test-written on its current strokes", () => {
    const d = newDraft(CHA);
    const print = strokesPrint(CHA);
    for (const s of d.plan.steps) d.tests[s.id] = { score: 95, accepted: true, strokes: print };
    expect(failing(d)).toEqual([]);
  });

  it("changing a stroke asks for the tests again", () => {
    const d = newDraft(CHA);
    const print = strokesPrint(CHA);
    for (const s of d.plan.steps) d.tests[s.id] = { score: 95, accepted: true, strokes: print };
    const moved = { ...d, item: { ...CHA, strokes: CHA.strokes.map((s, i) => (i === 0 ? { ...s, width: 80 } : s)) } };
    expect(runChecks(moved).find((c) => c.id === "tested")?.steps).toHaveLength(d.plan.steps.length);
  });

  it("a stroke that should carry on but doesn't touch the last one is named", () => {
    const loose = { ...SEVEN, strokes: SEVEN.strokes.map((s, i) => (i === 1 ? { ...s, nodes: s.nodes.map((n, k) => (k === 0 ? { ...n, x: n.x - 80 } : n)) } : s)) };
    expect(runChecks(newDraft(loose)).find((c) => c.id === "continueTouches")).toMatchObject({ ok: false, strokes: [2] });
  });

  it("every primitive shape is a valid stroke", () => {
    for (const p of PRIMITIVES) {
      const d = newDraft({ ...CHA, strokes: [makePrimitive(p, "x", 1)] });
      expect(failing(d).filter((f) => f !== "tested")).toEqual([]);
    }
  });
});

import { evalCubic, strokeSegments } from "../geometry/bezier";
import { bendThrough, withHandles } from "./StrokeEditor";

describe("dragging a curve to bend it", () => {
  it("the grabbed point follows the pointer exactly, wherever it was grabbed", () => {
    const line = withHandles(makePrimitive("line", "l", 1), 0);
    for (const t of [0.2, 0.5, 0.8]) {
      const before = evalCubic(strokeSegments(line)[0], t);
      const bent = bendThrough(line, 0, t, { x: 90, y: -40 });
      const after = evalCubic(strokeSegments(bent)[0], t);
      expect(after.x - before.x).toBeCloseTo(90, 6);
      expect(after.y - before.y).toBeCloseTo(-40, 6);
    }
  });
});

import { pasteStrokes } from "./clipboard";

describe("copy and paste", () => {
  it("pasting into the same item gives new ids and shifts the copy so it is visible", () => {
    const s = makePrimitive("line", "a", 1);
    let n = 0;
    const [p] = pasteStrokes([s], [s], () => `new${n++}`);
    expect(p.id).toBe("new0");
    expect(p.nodes[0].x).toBe(s.nodes[0].x + 30);
  });

  it("pasting into another item keeps the exact position", () => {
    const s = makePrimitive("hook", "a", 1);
    const [p] = pasteStrokes([s], [], () => "x");
    expect(p.nodes).toEqual(s.nodes);
  });
});

import { scoreAttempt } from "../score/score";
import { idealAll, reversed } from "../fixtures/traces";

describe("closed shapes", () => {
  it.each(["rectangle", "square", "triangle", "circle", "polygon"] as const)("a %s traced exactly passes, and the other way round is a direction fault", (p) => {
    const item = { ...CHA, kind: "drawing" as const, strokes: [makePrimitive(p, "s", 1)] };
    expect(scoreAttempt(item, idealAll(item), { step: "guided" }).accepted).toBe(true);
    expect(scoreAttempt(item, [reversed(idealAll(item)[0])], { step: "guided" }).feedback?.fault).toBe("direction");
  });
});
