import { beforeEach, describe, expect, it } from "vitest";
import { liveStreak, nextStreak, readPlay, saveDaily, savePractice, type GameRecord } from "./playStore";
import { dailySnapshot, levelsFor, practicePuzzle, resetDailyForTests, todaysPuzzle } from "./store";
import type { PuzzleSlot } from "./types";

const won = (puzzleId: string, rows = 3): GameRecord => ({
  puzzleId,
  rows: Array.from({ length: rows }, () => ({ tiles: ["a"], result: ["correct"] })),
  over: true,
  won: true,
  hints: 0,
});

describe("a child's Word Guess record", () => {
  beforeEach(() => localStorage.clear());

  it("grows the streak on days in a row, restarts it after a gap, and counts one day once", () => {
    let s = nextStreak({ last: null, n: 0, best: 0 }, "2026-11-18");
    s = nextStreak(s, "2026-11-19");
    expect(nextStreak(s, "2026-11-19")).toEqual(s);
    expect(s).toEqual({ last: "2026-11-19", n: 2, best: 2 });
    expect(liveStreak(s, "2026-11-20")).toBe(2);
    expect(liveStreak(s, "2026-11-21")).toBe(0);
    expect(nextStreak(s, "2026-11-22")).toEqual({ last: "2026-11-22", n: 1, best: 2 });
  });

  it("saves a daily game per learner, and a solve moves the streak and books the word only once", () => {
    const half: GameRecord = { ...won("wg-en-001"), over: false, won: false };
    saveDaily("word-guess:en:3", "2026-11-20", half, "kid");
    expect(readPlay("kid").streak.n).toBe(0);
    saveDaily("word-guess:en:3", "2026-11-20", won("wg-en-001"), "kid");
    saveDaily("word-guess:en:3", "2026-11-20", won("wg-en-001"), "kid");
    const store = readPlay("kid");
    expect(store.streak.n).toBe(1);
    expect(store.words).toEqual([{ id: "wg-en-001", day: "2026-11-20" }]);
    expect(store.daily["word-guess:en:3|2026-11-20"].won).toBe(true);
    expect(readPlay("sibling").daily).toEqual({});
  });

  it("practice never touches the streak, and remembers words so practice moves on", () => {
    const store = savePractice(won("wg-en-002"), "2026-11-20", "kid");
    expect(store.streak.n).toBe(0);
    expect(store.recent).toEqual(["wg-en-002"]);
    expect(store.words.map((w) => w.id)).toEqual(["wg-en-002"]);
  });
});

describe("the daily words on this device", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDailyForTests();
  });

  it("plays from the starter words with nothing downloaded, the same word all day", () => {
    const snap = dailySnapshot();
    expect(snap.fromServer).toBe(false);
    expect(levelsFor(snap, "en")).toContain(3);
    const slot: PuzzleSlot = { kind: "word-guess", lang: "en", level: 3 };
    const a = todaysPuzzle(snap, slot, "2026-11-20");
    expect(a?.level).toBe(3);
    expect(todaysPuzzle(snap, slot, "2026-11-20")?.id).toBe(a?.id);
  });

  it("uses the server's choice for the day when it has one, and practice avoids today's word", () => {
    const starter = dailySnapshot().puzzles.filter((p) => p.lang === "en" && p.level === 3);
    const pick = starter[starter.length - 1];
    localStorage.setItem("koda.puzzles.daily.v1", JSON.stringify({ lines: { "word-guess:en:3": [{ day: "2026-11-20", puzzleId: pick.id }] }, puzzles: starter }));
    resetDailyForTests();
    const snap = dailySnapshot();
    const slot: PuzzleSlot = { kind: "word-guess", lang: "en", level: 3 };
    expect(snap.fromServer).toBe(true);
    expect(todaysPuzzle(snap, slot, "2026-11-20")?.id).toBe(pick.id);
    for (let i = 0; i < 20; i++) expect(practicePuzzle(snap, slot, new Set([pick.id]))?.id).not.toBe(pick.id);
  });
});
