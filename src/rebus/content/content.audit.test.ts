import { describe, expect, it } from "vitest";
import { compactAnswer } from "../answer";
import { CATEGORIES } from "../categories";
import { fitsAge } from "../../lib/ages";
import { ICON_ART, ICON_IDS } from "../icons/library";
import { answerKey, validatePuzzle } from "../puzzle";
import { OFFICIAL_PUZZLES } from "./index";

/** The categories that have puzzles to play; the rest are marked "Soon". */
const LIVE = CATEGORIES.filter((c) => OFFICIAL_PUZZLES.some((p) => p.category === c.id));

describe("the puzzles Koda ships with", () => {
  it("every one passes the same checks the Studio runs before review", () => {
    const failures = OFFICIAL_PUZZLES.flatMap((p) => validatePuzzle(p, { iconIds: ICON_IDS }).map((i) => `${p.id}: ${i.message}`));
    expect(failures).toEqual([]);
  });

  it("has unique ids, and no answer twice, however it is spelled", () => {
    const ids = OFFICIAL_PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = OFFICIAL_PUZZLES.map(answerKey);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it("accepts no spelling that is really another puzzle's answer", () => {
    const answers = new Map(OFFICIAL_PUZZLES.map((p) => [answerKey(p), p.id]));
    const clashes = OFFICIAL_PUZZLES.flatMap((p) => p.accepts.map((a) => ({ id: p.id, other: answers.get(compactAnswer(a)) })).filter((x) => x.other && x.other !== p.id));
    expect(clashes).toEqual([]);
  });

  it("is official, and says what every picture is read as", () => {
    for (const p of OFFICIAL_PUZZLES) {
      expect(p.source).toBe("official");
      for (const piece of p.pieces) if (piece.kind === "icon") expect(piece.name.trim().length, p.id).toBeGreaterThan(0);
    }
  });

  it.each(LIVE.map((c) => [c.id, c.name]))("%s (%s) has enough to play a long round, at more than one difficulty where it can", (id) => {
    const mine = OFFICIAL_PUZZLES.filter((p) => p.category === id);
    expect(mine.length).toBeGreaterThanOrEqual(15);
    expect(new Set(mine.map((p) => p.difficulty)).size).toBeGreaterThanOrEqual(id === "animals" || id === "school" || id === "science" || id === "countries" ? 2 : 1);
  });

  it("gives every learner from 7 to 14 at least ten puzzles in every topic that is open", () => {
    for (const age of [7, 8, 9, 10, 11, 12, 13, 14]) {
      for (const c of LIVE) {
        // The Khmer pack is a first set for early readers, so it stops at 12 until it has harder words.
        if (c.id === "khmer" && age > 12) continue;
        const n = OFFICIAL_PUZZLES.filter((p) => p.category === c.id && fitsAge(p.ages, age)).length;
        expect(n, `${c.id} at ${age}`).toBeGreaterThanOrEqual(10);
      }
    }
  });
});

describe("the icon artwork", () => {
  const used = new Set(OFFICIAL_PUZZLES.flatMap((p) => p.pieces.flatMap((piece) => (piece.kind === "icon" ? [piece.id] : []))));

  it("has no drawing that no puzzle uses", () => {
    expect([...ICON_IDS].filter((id) => !used.has(id)).sort()).toEqual([]);
  });

  it("is a 64×64 drawing with something in it", () => {
    for (const [name, art] of Object.entries(ICON_ART)) {
      expect(art.length, name).toBeGreaterThan(40);
      expect(art, name).not.toContain("<script");
    }
  });

  it("uses no yellow anywhere: it is unreadable on Koda's light surface", () => {
    const yellow: string[] = [];
    for (const [name, art] of Object.entries(ICON_ART)) {
      for (const [, hex] of art.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
        const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        const d = max - min;
        const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
        let h = 0;
        if (d !== 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
        if (h >= 42 && h <= 70 && s > 0.35 && l > 0.3 && l < 0.92) yellow.push(`${name} #${hex}`);
      }
    }
    expect(yellow).toEqual([]);
  });
});
