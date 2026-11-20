import { describe, expect, it } from "vitest";
import raw from "./content/word-guess.json";
import { addDays, puzzleDay } from "./day";
import { fallbackPick } from "./fallback";
import { STARTER_PUZZLES, parsePuzzle } from "./starter";
import { keyStates, scoreGuess, solved, tileLabel, tilesOf, wordProblem } from "./wordGuess";

describe("Word Guess tiles", () => {
  it("splits Khmer into spelling tiles and English into letters", () => {
    expect(tilesOf("ឆ្មា", "km")).toEqual(["ឆ", "្ម", "ា"]);
    expect(tilesOf("ច្រមុះ", "km")).toEqual(["ច", "្រ", "ម", "ុះ"]);
    expect(tilesOf("Cat", "en")).toEqual(["c", "a", "t"]);
    expect(tileLabel("្ម", "km")).toBe("◌្ម");
  });

  it("says why a word cannot be a puzzle", () => {
    expect(wordProblem("ឆ្មា", "km")).toBeNull();
    expect(wordProblem("cat", "km")).toBe("not_khmer");
    expect(wordProblem("ាក", "km")).toBe("spelling");
    expect(wordProblem("ទា", "km")).toBeNull();
    expect(wordProblem("a", "en")).toBe("too_short");
    expect(wordProblem("ice cream", "en")).toBe("not_letters");
    expect(wordProblem("butterfly", "en")).toBe("too_long");
    expect(wordProblem("  ", "en")).toBe("empty");
  });
});

describe("scoring a guess", () => {
  it("marks right place, wrong place and missing", () => {
    expect(scoreGuess(["ផ", "្ក", "ា"], ["ផ", "្ក", "ា"])).toEqual(["correct", "correct", "correct"]);
    expect(scoreGuess(["ា", "្ក", "ផ"], ["ផ", "្ក", "ា"])).toEqual(["present", "correct", "present"]);
    expect(scoreGuess(["d", "o", "g"], ["c", "a", "t"])).toEqual(["absent", "absent", "absent"]);
  });

  it("lights a repeated tile only as often as the answer has it", () => {
    expect(scoreGuess(["ា", "ា", "ល", "ស"], ["ស", "ា", "ល", "ា"])).toEqual(["present", "correct", "correct", "present"]);
    expect(scoreGuess(["e", "e", "e"], ["b", "e", "d"])).toEqual(["absent", "correct", "absent"]);
    expect(scoreGuess(["l", "l", "a"], ["b", "a", "l"]).filter((s) => s !== "absent")).toHaveLength(2);
  });

  it("colours each key by its best result", () => {
    const keys = keyStates([
      { tiles: ["c", "a", "t"], result: ["absent", "present", "absent"] },
      { tiles: ["b", "a", "t"], result: ["absent", "correct", "absent"] },
    ]);
    expect(keys.get("a")).toBe("correct");
    expect(keys.get("c")).toBe("absent");
    expect(solved(["correct", "correct"])).toBe(true);
    expect(solved(["correct", "present"])).toBe(false);
  });
});

describe("the puzzle day", () => {
  it("turns over at midnight in Phnom Penh", () => {
    expect(puzzleDay(new Date("2026-11-20T16:59:00Z"))).toBe("2026-11-20");
    expect(puzzleDay(new Date("2026-11-20T17:00:00Z"))).toBe("2026-11-21");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("the starter words", () => {
  it("are all playable, with ids that never clash", () => {
    expect(STARTER_PUZZLES).toHaveLength((raw as unknown[]).length);
    expect(new Set(STARTER_PUZZLES.map((p) => p.id)).size).toBe(STARTER_PUZZLES.length);
    for (const p of STARTER_PUZZLES) expect(p.level).toBe(tilesOf(p.data.word, p.lang).length);
  });

  it("cover every level the game offers", () => {
    const count = (lang: string, level: number) => STARTER_PUZZLES.filter((p) => p.lang === lang && p.level === level).length;
    expect(count("km", 3)).toBeGreaterThanOrEqual(15);
    expect(count("km", 4)).toBeGreaterThanOrEqual(15);
    for (const n of [3, 4, 5]) expect(count("en", n)).toBeGreaterThanOrEqual(15);
  });

  it("drops a bad row instead of playing it", () => {
    expect(parsePuzzle({ id: "x", kind: "word-guess", lang: "km", data: { word: "cat", category: "animal" } })).toBeNull();
    expect(parsePuzzle({ id: "x", kind: "word-guess", lang: "en", data: { word: "cat", category: "dragons" } })).toBeNull();
    expect(parsePuzzle({ id: "x", kind: "word-guess", lang: "en", owner: { scope: "creator", userId: "u1" }, status: "review", data: { word: " Cat ", category: "animal" } })).toMatchObject({ level: 3, status: "review", owner: { scope: "creator", userId: "u1" }, data: { word: "cat" } });
  });
});

describe("offline pick", () => {
  const slot = { kind: "word-guess" as const, lang: "km" as const, level: 3 };

  it("is the same on every device and does not repeat until the list is used up", () => {
    const n = STARTER_PUZZLES.filter((p) => p.lang === "km" && p.level === 3).length;
    const days = Array.from({ length: n }, (_, i) => fallbackPick(STARTER_PUZZLES, slot, addDays("2026-11-20", i))!.id);
    expect(new Set(days).size).toBe(n);
    expect(fallbackPick(STARTER_PUZZLES, slot, "2026-11-20")).toBe(fallbackPick([...STARTER_PUZZLES].reverse(), slot, "2026-11-20"));
  });

  it("skips anything not published, and has nothing for an empty level", () => {
    const drafts = STARTER_PUZZLES.map((p) => ({ ...p, status: "draft" as const }));
    expect(fallbackPick(drafts, slot, "2026-11-20")).toBeNull();
  });
});
