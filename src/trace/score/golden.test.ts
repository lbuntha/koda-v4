/**
 * The golden set: every item, traced well and traced wrong in each way a
 * child does. Good traces must pass; each wrong one must fail with the fault
 * a child can act on. Synthetic ink for now — recorded children's traces join
 * this set once the Phase 1 player can save them.
 */
import { describe, expect, it } from "vitest";
import { AA_MARK, CAT, CHA, GOLDEN_ITEMS, HOOK, KHA, LOOP, SEVEN } from "../fixtures/items";
import { ideal, idealAll, moved, part, reversed, scribble, wobbleAll } from "../fixtures/traces";
import type { TraceItem } from "../geometry/types";
import type { AttemptOptions } from "./score";
import { scoreAttempt } from "./score";

const guided: AttemptOptions = { step: "guided" };
const memory: AttemptOptions = { step: "memory" };
const name = (item: TraceItem) => `${item.title} (${item.kind})`;

describe.each(GOLDEN_ITEMS.map((item) => [name(item), item] as const))("%s", (_, item) => {
  const strokes = idealAll(item);
  const first = strokes[0];
  const firstShape = [...item.strokes].sort((a, b) => a.order - b.order)[0].shape;

  it("traced exactly: accepted, 3 stars, nothing to fix", () => {
    const r = scoreAttempt(item, strokes, guided);
    expect(r.accepted).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(98);
    expect(r.stars).toBe(3);
    expect(r.feedback).toBeNull();
  });

  it("an unsteadier hand scores lower, in order, and is still accepted", () => {
    const scores = [0, 8, 14, 25].map((amp) => scoreAttempt(item, amp === 0 ? strokes : wobbleAll(item, amp), guided));
    for (const r of scores) expect(r.accepted).toBe(true);
    for (let i = 1; i < scores.length; i++) expect(scores[i].score).toBeLessThan(scores[i - 1].score);
    expect(scores[1].score).toBeGreaterThanOrEqual(85);
    expect(scores[3].feedback?.fault).toBe("path");
  });

  if (firstShape !== "dot") {
    it("stroke 1 drawn backwards → direction", () => {
      expect(scoreAttempt(item, [reversed(first)], guided).feedback).toMatchObject({ fault: "direction", order: 1 });
    });

    it("stroke 1 stopped halfway → coverage (stopped early)", () => {
      expect(scoreAttempt(item, [part(first, 0, 0.5)], guided).feedback).toMatchObject({ fault: "coverage", order: 1 });
    });

    it("stroke 1 begun a third of the way along → start", () => {
      expect(scoreAttempt(item, [part(first, 0.35, 1)], guided).feedback).toMatchObject({ fault: "start", order: 1 });
    });

    it("stroke 1 scribbled back and forth → scribble", () => {
      expect(scoreAttempt(item, [scribble(first)], guided).feedback).toMatchObject({ fault: "scribble", order: 1 });
    });
  }

  it("written from memory, smaller and off-centre: accepted", () => {
    // A mark stays beside its letter, so it only moves a little.
    const shift = item.carrier ? { dx: 20, dy: -15 } : { scale: 0.6, dx: 80, dy: -50, rotation: 6 };
    const r = scoreAttempt(item, moved(strokes, shift), memory);
    expect(r.accepted).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("written from memory with an unsteady hand: accepted, lower", () => {
    const r = scoreAttempt(item, moved(wobbleAll(item, 14), item.carrier ? {} : { scale: 0.7, dx: -40 }), memory);
    expect(r.accepted).toBe(true);
    expect(r.score).toBeLessThan(95);
  });

  it("almost nothing written → unfit", () => {
    const r = scoreAttempt(item, [part(first.length > 1 ? first : ideal(item.strokes[0]), 0, 0.05)], memory);
    expect(r.accepted).toBe(false);
    expect(r.score).toBe(0);
    if (first.length > 1) expect(r.feedback?.fault).toBe("unfit");
  });
});

describe("stroke order", () => {
  it("writing from memory: ច with its strokes swapped → order, naming both strokes", () => {
    const [s1, s2] = idealAll(CHA);
    const r = scoreAttempt(CHA, [s2, s1], memory);
    expect(r.accepted).toBe(false);
    expect(r.feedback).toMatchObject({ fault: "order", order: 2, expected: 1 });
  });

  it("guided: drawing stroke 2 when stroke 1 is next → 'that was stroke 2 — do 1 first'", () => {
    const [, s2] = idealAll(CHA);
    expect(scoreAttempt(CHA, [s2], guided).feedback).toMatchObject({ fault: "order", order: 2, expected: 1 });
  });

  it("a drawing may be drawn in any order", () => {
    const strokes = idealAll(CAT);
    const shuffled = [strokes[5], strokes[3], strokes[0], strokes[6], strokes[1], strokes[4], strokes[2]];
    expect(scoreAttempt(CAT, shuffled, memory).accepted).toBe(true);
    expect(scoreAttempt(CAT, shuffled, guided).accepted).toBe(true);
  });

  it("a stroke left out → missing", () => {
    const [s1] = idealAll(CHA);
    const r = scoreAttempt(CHA, [s1], memory);
    expect(r.strokes[1]).toMatchObject({ accepted: false, fault: "missing" });
    expect(r.feedback).toMatchObject({ fault: "missing", order: 2 });
  });
});

describe("strokes that carry on (join: continue)", () => {
  it("7 written in one motion counts as both strokes — guided and from memory", () => {
    const one = [idealAll(SEVEN).flat()];
    for (const opts of [guided, memory]) {
      const r = scoreAttempt(SEVEN, one, opts);
      expect(r.accepted).toBe(true);
      expect(r.strokes.map((s) => s.accepted)).toEqual([true, true]);
    }
  });

  it("ខ written in one motion counts as its three strokes", () => {
    const r = scoreAttempt(KHA, [idealAll(KHA).flat()], memory);
    expect(r.accepted).toBe(true);
    expect(r.strokes).toHaveLength(3);
  });

  it("7 written as two separate strokes is fine too", () => {
    expect(scoreAttempt(SEVEN, idealAll(SEVEN), guided).accepted).toBe(true);
  });
});

describe("shapes", () => {
  it("a loop drawn the other way round → direction", () => {
    expect(scoreAttempt(LOOP, [reversed(idealAll(LOOP)[0])], guided).feedback).toMatchObject({ fault: "direction", shape: "loop" });
  });

  it("a hook that skips its curl but reaches the end → checkpoint", () => {
    const [hook] = idealAll(HOOK);
    const skip = [...part(hook, 0, 0.6), ...part(hook, 0.99, 1)];
    expect(scoreAttempt(HOOK, [skip], guided).feedback).toMatchObject({ fault: "checkpoint", shape: "hook" });
  });

  it("an eye (a dot) is a tap near its place", () => {
    const strokes = idealAll(CAT);
    const tapped = strokes.map((s, i) => (i === 3 ? [{ x: 415, y: 548 }] : s));
    expect(scoreAttempt(CAT, tapped, guided).accepted).toBe(true);
    const missed = strokes.map((s, i) => (i === 3 ? [{ x: 250, y: 300 }] : s));
    expect(scoreAttempt(CAT, missed, guided).accepted).toBe(false);
  });
});

describe("marks around a carrier letter", () => {
  it("◌ា written on the wrong side of ក → placement", () => {
    const r = scoreAttempt(AA_MARK, moved(idealAll(AA_MARK), { dx: -560 }), memory);
    expect(r.feedback).toMatchObject({ fault: "placement", order: 1 });
  });
});

describe("sensitivity and steps", () => {
  it("the same wobbly trace is looser in Relaxed and tighter in Strict", () => {
    const ink = wobbleAll(HOOK, 14);
    const relaxed = scoreAttempt(HOOK, ink, { step: "guided", sensitivity: "relaxed" }).score;
    const balanced = scoreAttempt(HOOK, ink, { step: "guided", sensitivity: "balanced" }).score;
    const strict = scoreAttempt(HOOK, ink, { step: "guided", sensitivity: "strict" }).score;
    expect(relaxed).toBeGreaterThan(balanced);
    expect(balanced).toBeGreaterThan(strict);
  });

  it("a younger child gets a wider band than an older one", () => {
    const ink = wobbleAll(KHA, 18);
    expect(scoreAttempt(KHA, ink, { step: "guided", ageBand: "A" }).score).toBeGreaterThan(
      scoreAttempt(KHA, ink, { step: "guided", ageBand: "C" }).score,
    );
  });

  it("a retried stroke costs a little: the accepted try scores 10 less per failed one", () => {
    const [s1, s2] = idealAll(CHA);
    const clean = scoreAttempt(CHA, [s1, s2], guided);
    const retried = scoreAttempt(CHA, [reversed(s1), s1, s2], guided);
    expect(retried.accepted).toBe(true);
    expect(retried.strokes[0]).toMatchObject({ tries: 2, faults: ["direction"] });
    expect(retried.strokes[0].score).toBe(clean.strokes[0].score - 10);
  });
});

describe("writing with no guide is judged on shape, not exact position", () => {
  it("ច from memory with its strokes in a child's own proportions still passes", () => {
    const [s1, s2] = idealAll(CHA);
    // The top bar written 50 units further right and 40 higher than the model has it.
    const own = [s1, s2.map((p) => ({ x: p.x + 50, y: p.y - 40 }))];
    expect(scoreAttempt(CHA, own, memory).accepted).toBe(true);
  });

  it("but a stroke begun from its far end is still a start or direction fault", () => {
    const [s1, s2] = idealAll(CHA);
    const r = scoreAttempt(CHA, [s1, reversed(s2)], memory);
    expect(r.accepted).toBe(false);
    expect(["start", "direction"]).toContain(r.feedback?.fault);
  });

  it("and the wrong order is still wrong", () => {
    const [s1, s2] = idealAll(CHA);
    expect(scoreAttempt(CHA, [s2, s1], memory).feedback?.fault).toBe("order");
  });
});
