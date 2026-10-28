import { describe, expect, it } from "vitest";
import { itemFor, parseList } from "./batch";
import { englishGuide, englishStrokes, hasEnglishStrokes } from "./englishSet";
import { runChecks } from "./checks";
import { newDraft } from "./drafts";

const ALL = [...parseList("A-Z"), ...parseList("a-z"), ...parseList("0-9")];
let n = 0;
const id = () => `s${++n}`;

describe("English first-draft strokes", () => {
  it("covers all 62 characters", () => {
    expect(ALL).toHaveLength(62);
    for (const c of ALL) expect(hasEnglishStrokes(c), c).toBe(true);
    expect(englishStrokes("ក", id)).toBeNull();
  });

  it.each(ALL)("%s passes the Studio's stroke checks", (c) => {
    const strokes = englishStrokes(c, id)!;
    const item = { ...itemFor(c, "x", { grid: "baseline-4-lines", sensitivity: "balanced" }), strokes };
    const bad = runChecks(newDraft(item)).filter((r) => !r.ok && !["tested"].includes(r.id));
    expect(bad, c).toEqual([]);
  });

  it("small letters sit between the middle and baseline lines, capitals between top and baseline", () => {
    const ys = (c: string) => englishStrokes(c, id)!.flatMap((s) => s.nodes.map((nd) => nd.y));
    expect(Math.min(...ys("A"))).toBe(250);
    expect(Math.max(...ys("A"))).toBe(650);
    expect(Math.min(...ys("x"))).toBe(450);
    expect(Math.max(...ys("x"))).toBe(650);
    expect(Math.max(...ys("g"))).toBeGreaterThan(750);
    expect(Math.min(...ys("b"))).toBe(250);
  });

  it("items made from a list carry the guide on the baseline", () => {
    const g = itemFor("a", "x", { grid: "baseline-4-lines", sensitivity: "balanced" }).guide?.glyph;
    expect(g).toMatchObject({ text: "a", y: 650, size: englishGuide("a").size });
  });
});
