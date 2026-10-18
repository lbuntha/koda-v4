import { describe, expect, it } from "vitest";
import { elapsedOf, hintStatus, machineLockedOut, machineProgress, reduceRound, startRound, type RoundConfig, type RoundState } from "./engine";
import { SAMPLE_PUZZLES } from "./fixtures/samplePuzzles";
import { DEFAULT_SETTINGS } from "./settings";

const puzzles = SAMPLE_PUZZLES.filter((p) => p.category === "food").slice(0, 3);
const config = (over: Partial<RoundConfig> = {}): RoundConfig => ({ puzzles, settings: DEFAULT_SETTINGS, level: 1, seed: "t", ...over });

/** The Machine solves at a time the test picks, instead of whenever its seed says. */
const machineAt = (state: RoundState, solvesAt: number | null): RoundState => ({
  ...state,
  run: { ...state.run, plan: { attempts: solvesAt === null ? [{ at: 999, correct: false }] : [{ at: solvesAt, correct: true }], solvesAt } },
});

const answerOf = (state: RoundState) => state.run.puzzle.answer;

describe("a round", () => {
  it("starts on the first puzzle with an empty score", () => {
    const s = startRound(config(), 100);
    expect(s).toMatchObject({ phase: "playing", index: 0 });
    expect(s.score.puzzles).toBe(0);
    expect(s.run.puzzle).toBe(puzzles[0]);
    expect(elapsedOf(s.run, 100)).toBe(0);
  });

  it("refuses to start with nothing to play", () => {
    expect(() => startRound(config({ puzzles: [] }), 0)).toThrow();
  });

  it("plays the same Machine for the same seed", () => {
    expect(startRound(config(), 0).run.plan).toEqual(startRound(config(), 500).run.plan);
    expect(startRound(config({ seed: "other" }), 0).run.plan).not.toEqual(startRound(config(), 0).run.plan);
  });
});

describe("answering", () => {
  it("scores 3 for the first right answer and shows the reveal", () => {
    let s = machineAt(startRound(config(), 0), 50);
    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 12 });
    expect(s.phase).toBe("revealed");
    expect(s.last).toMatchObject({ winner: "child", reason: "solved", points: 3, hintsUsed: 0, seconds: 12 });
    expect(s.score).toMatchObject({ child: 3, machine: 0, solved: 1 });
  });

  it("takes a typo on a long answer and a differently typed alternative", () => {
    const cake = SAMPLE_PUZZLES.find((p) => p.answer === "Slice of cake")!;
    let s = machineAt(startRound(config({ puzzles: [cake] }), 0), null);
    s = reduceRound(s, { type: "answer", text: "PIECE OF CAKE", now: 5 });
    expect(s.last?.winner).toBe("child");
  });

  it("counts a wrong answer without ending the puzzle, and ignores a blank one", () => {
    let s = machineAt(startRound(config(), 0), 50);
    s = reduceRound(s, { type: "answer", text: "nonsense", now: 3 });
    s = reduceRound(s, { type: "answer", text: "   ", now: 4 });
    expect(s.phase).toBe("playing");
    expect(s.run.wrong).toBe(1);
    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 9 });
    expect(s.last?.wrong).toBe(1);
  });

  it("gives the point to the Machine if it solved before the child's answer arrived", () => {
    let s = machineAt(startRound(config(), 0), 10);
    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 11 });
    expect(s.last).toMatchObject({ winner: "machine", reason: "machine", points: 3 });
    expect(s.score).toMatchObject({ child: 0, machine: 3 });
  });
});

describe("the clock", () => {
  it("lets the Machine win when its time comes, on the next tick", () => {
    let s = machineAt(startRound(config(), 0), 20);
    s = reduceRound(s, { type: "tick", now: 19.9 });
    expect(s.phase).toBe("playing");
    s = reduceRound(s, { type: "tick", now: 20 });
    expect(s.last).toMatchObject({ winner: "machine", reason: "machine" });
  });

  it("reveals with no points when the time limit runs out", () => {
    let s = machineAt(startRound(config(), 0), null);
    s = reduceRound(s, { type: "tick", now: DEFAULT_SETTINGS.puzzleLimitSec });
    expect(s.last).toMatchObject({ winner: "none", reason: "time", points: 0, seconds: DEFAULT_SETTINGS.puzzleLimitSec });
    expect(s.score.child + s.score.machine).toBe(0);
  });

  it("ignores a Machine answer that would have come after the limit", () => {
    let s = machineAt(startRound(config(), 0), DEFAULT_SETTINGS.puzzleLimitSec + 30);
    s = reduceRound(s, { type: "tick", now: DEFAULT_SETTINGS.puzzleLimitSec });
    expect(s.last?.reason).toBe("time");
  });

  it("follows the owner's time limit", () => {
    const settings = { ...DEFAULT_SETTINGS, puzzleLimitSec: 30 };
    let s = machineAt(startRound(config({ settings }), 0), null);
    s = reduceRound(s, { type: "tick", now: 29 });
    expect(s.phase).toBe("playing");
    s = reduceRound(s, { type: "tick", now: 30 });
    expect(s.phase).toBe("revealed");
  });

  it("ignores events once the puzzle is over", () => {
    let s = machineAt(startRound(config(), 0), 50);
    s = reduceRound(s, { type: "skip", now: 2 });
    expect(reduceRound(s, { type: "answer", text: answerOf(s), now: 3 })).toBe(s);
    expect(reduceRound(s, { type: "hint", now: 99 })).toBe(s);
  });
});

describe("hints", () => {
  it("are locked until the owner's delay, then climb one rung at a time, each costing a point", () => {
    let s = machineAt(startRound(config(), 0), null);
    expect(hintStatus(s, 14)).toMatchObject({ state: "locked" });
    s = reduceRound(s, { type: "hint", now: 14 });
    expect(s.run.hints).toHaveLength(0);

    s = reduceRound(s, { type: "hint", now: 15 });
    expect(s.run.hints.map((h) => h.kind)).toEqual(["category"]);
    expect(hintStatus(s, 20)).toMatchObject({ state: "locked" });

    s = reduceRound(s, { type: "hint", now: 30 });
    s = reduceRound(s, { type: "hint", now: 45 });
    expect(s.run.hints.map((h) => h.kind)).toEqual(["category", "letters", "pieces"]);
    expect(hintStatus(s, 59)).toEqual({ state: "exhausted" });

    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 50 });
    expect(s.last).toMatchObject({ winner: "child", hintsUsed: 3, points: 1 });
  });

  it("follows the owner's delay and cap", () => {
    const settings = { ...DEFAULT_SETTINGS, hintDelaySec: 5, hintRungs: 1 as const };
    let s = machineAt(startRound(config({ settings }), 0), null);
    s = reduceRound(s, { type: "hint", now: 5 });
    expect(s.run.hints).toHaveLength(1);
    s = reduceRound(s, { type: "hint", now: 40 });
    expect(s.run.hints).toHaveLength(1);
  });
});

describe("the owner's points", () => {
  const rules = { ...DEFAULT_SETTINGS, pointsPerPuzzle: 8, hintCost: 3, machinePoints: 5 };

  it("pays a child win in the owner's points, less the owner's cost for each hint", () => {
    let s = machineAt(startRound(config({ settings: rules }), 0), null);
    s = reduceRound(s, { type: "hint", now: 15 });
    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 16 });
    expect(s.last).toMatchObject({ winner: "child", hintsUsed: 1, points: 5 });
    expect(s.score.child).toBe(5);
  });

  it("pays a Machine win in the owner's Machine points", () => {
    let s = machineAt(startRound(config({ settings: rules }), 0), 10);
    s = reduceRound(s, { type: "tick", now: 10 });
    expect(s.last).toMatchObject({ winner: "machine", points: 5 });
    expect(s.score.machine).toBe(5);
  });

  it("lets a hint cost nothing", () => {
    let s = machineAt(startRound(config({ settings: { ...rules, hintCost: 0 } }), 0), null);
    s = reduceRound(s, { type: "hint", now: 15 });
    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 16 });
    expect(s.last?.points).toBe(8);
  });
});

describe("moving on", () => {
  it("starts the next puzzle fresh, and finishes after the last", () => {
    let s = machineAt(startRound(config(), 0), 50);
    s = reduceRound(s, { type: "skip", now: 2 });
    s = reduceRound(s, { type: "next", now: 10 });
    expect(s).toMatchObject({ phase: "playing", index: 1 });
    expect(s.run.puzzle).toBe(puzzles[1]);
    expect(s.run.hints).toEqual([]);
    expect(elapsedOf(s.run, 10)).toBe(0);
    expect(reduceRound(s, { type: "next", now: 11 })).toBe(s);

    for (let i = 1; i < puzzles.length; i++) {
      s = reduceRound(machineAt(s, 50), { type: "skip", now: 12 });
      s = reduceRound(s, { type: "next", now: 13 });
    }
    expect(s.phase).toBe("done");
    expect(s.outcomes).toHaveLength(puzzles.length);
    expect(s.score.puzzles).toBe(puzzles.length);
  });
});

describe("the Machine's level", () => {
  it("is the owner's lock when there is one", () => {
    expect(startRound(config({ level: 0, settings: { ...DEFAULT_SETTINGS, machineLock: 2 } }), 0).run.level).toBe(2);
  });

  it("starts where the last round left off, when adaptive", () => {
    expect(startRound(config({ level: "adaptive", adaptiveStart: 2 }), 0).run.level).toBe(2);
    expect(startRound(config({ level: "adaptive", adaptiveStart: 0 }), 0).run.level).toBe(0);
    // A fixed pick ignores it.
    expect(startRound(config({ level: 1, adaptiveStart: 2 }), 0).run.level).toBe(1);
  });

  it("follows the round when adaptive: up after a child win, down after a Machine win", () => {
    let s = machineAt(startRound(config({ level: "adaptive" }), 0), 50);
    expect(s.run.level).toBe(1);
    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 5 });
    s = reduceRound(s, { type: "next", now: 6 });
    expect(s.run.level).toBe(2);
    s = reduceRound(machineAt(s, 3), { type: "tick", now: 9 });
    s = reduceRound(s, { type: "next", now: 10 });
    expect(s.run.level).toBe(1);
  });

  it("stays put when the child picked a level", () => {
    let s = machineAt(startRound(config({ level: 0 }), 0), 50);
    s = reduceRound(s, { type: "answer", text: answerOf(s), now: 5 });
    s = reduceRound(s, { type: "next", now: 6 });
    expect(s.run.level).toBe(0);
  });
});

describe("what the screen reads", () => {
  it("shows the Machine's thinking and its lockout after a wrong guess", () => {
    const s: RoundState = { ...startRound(config(), 0), run: { ...startRound(config(), 0).run, plan: { attempts: [{ at: 10, correct: false }, { at: 18, correct: true }], solvesAt: 18 } } };
    expect(machineProgress(s, 5)).toBe(0.5);
    expect(machineProgress(s, 12)).toBe(1);
    expect(machineLockedOut(s, 9)).toBe(false);
    expect(machineLockedOut(s, 11)).toBe(true);
    expect(machineLockedOut(s, 14)).toBe(false);
  });
});
