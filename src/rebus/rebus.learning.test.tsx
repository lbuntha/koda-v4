import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LearningLog, type LearningEvent } from "../lib/learning";
import { SCORING_DEFAULTS } from "../lib/scoring";
import { SAMPLE_PUZZLES } from "./fixtures/samplePuzzles";
import { DEFAULT_SETTINGS } from "./settings";
import { REBUS_CONCEPT, REBUS_SKILL_ID, RebusRecorder } from "./learning";
import { firstTry, rebusReward } from "./reward";
import type { PuzzleOutcome } from "./engine";

vi.mock("./bank", async () => {
  const { BUILT_IN_CATEGORIES } = await import("./categories");
  const puzzles = SAMPLE_PUZZLES.filter((p) => p.answer === "Hot dog" || p.answer === "Honeymoon");
  const bank = { puzzles, counts: { countries: 0, food: puzzles.length, sayings: 0, animals: 0, sports: 0, school: 0, science: 0 }, loaded: true };
  return { useRebusBank: () => bank, bankForAge: (b: typeof bank) => b, bankForLanguage: (b: typeof bank) => b, useRebusCategories: () => BUILT_IN_CATEGORIES };
});
vi.mock("../utils/audio", () => ({ isVoiceEnabled: () => false, playSound: () => {} }));

import { RebusPage } from "./RebusPage";

const events = () => LearningLog.all({ skillId: REBUS_SKILL_ID });
const of = <T extends LearningEvent["type"]>(type: T) => events().filter((e) => e.type === type) as Array<Extract<LearningEvent, { type: T }>>;
const puzzle = SAMPLE_PUZZLES[7]; // hot dog

const outcome = (over: Partial<PuzzleOutcome>): PuzzleOutcome => ({ puzzle, winner: "child", reason: "solved", points: 3, hintsUsed: 0, wrong: 0, seconds: 10, ...over });

beforeEach(() => {
  localStorage.clear();
  LearningLog.clear();
});

describe("rebusReward", () => {
  it("pays the deployment's stars and XP for first-try solves, and nothing counts a hint as one", () => {
    const first = outcome({});
    expect(firstTry(first)).toBe(true);
    expect(firstTry(outcome({ hintsUsed: 1 }))).toBe(false);
    expect(firstTry(outcome({ wrong: 1 }))).toBe(false);
    expect(firstTry(outcome({ reason: "machine", winner: "machine" }))).toBe(false);

    expect(rebusReward([first, first, first, first, first], SCORING_DEFAULTS)).toEqual({ stars: 3, xp: 20, accuracy: 1 });
    expect(rebusReward([first, first, first, outcome({ hintsUsed: 2 }), outcome({ reason: "time", winner: "none" })], SCORING_DEFAULTS)).toMatchObject({ stars: 2, xp: 14 });
    expect(rebusReward([outcome({ reason: "skipped", winner: "none" })], SCORING_DEFAULTS)).toMatchObject({ stars: 1, xp: 8 });
    expect(rebusReward([], SCORING_DEFAULTS)).toMatchObject({ stars: 1, accuracy: 0 });
  });
});

describe("RebusRecorder", () => {
  it("records nothing for a round left before a puzzle", () => {
    new RebusRecorder({ category: "food" }).abandon();
    expect(events()).toEqual([]);
  });

  it("files a round under the right skill, concept and age band, one question per puzzle", () => {
    const r = new RebusRecorder({ category: "food", ages: [6, 12] });
    r.present(puzzle, 0);
    expect(of("lesson_started")[0]).toMatchObject({ skillId: REBUS_SKILL_ID, lessonId: "rebus:food", conceptKey: REBUS_CONCEPT, ageBand: [6, 12], entry: "picker" });
    expect(of("question_presented")[0]).toMatchObject({ taskKind: "rebus_compound", prompt: "hot + dog" });
  });

  it("records a wrong try, then the solve as the second attempt, and the hint as support", () => {
    const r = new RebusRecorder({ category: "food" });
    r.present(puzzle, 0);
    r.wrong(puzzle);
    r.hint(1);
    r.settle(outcome({ wrong: 1, hintsUsed: 1 }));
    expect(of("answer_submitted").map((a) => [a.correct, a.attempt, a.given])).toEqual([[false, 1, "wrong"], [true, 2, "solved"]]);
    expect(of("support_used")[0]).toMatchObject({ support: "hint", hintLevel: 1 });
  });

  it("never records what the child typed", () => {
    const r = new RebusRecorder({ category: "food" });
    r.present(puzzle, 0);
    r.wrong(puzzle);
    r.settle(outcome({ reason: "skipped", winner: "none" }));
    expect(JSON.stringify(events())).not.toContain("nonsense");
    expect(of("answer_submitted").map((a) => a.given)).toEqual(["wrong", "skipped"]);
  });

  it("records the Machine winning as an unanswered puzzle with its reason", () => {
    const r = new RebusRecorder({ category: "food" });
    r.present(puzzle, 0);
    r.settle(outcome({ reason: "machine", winner: "machine" }));
    expect(of("answer_submitted")[0]).toMatchObject({ correct: false, given: "machine" });
  });

  it("completes with stars and XP, and starts a fresh lesson for a rematch", () => {
    const r = new RebusRecorder({ category: "food" });
    r.present(puzzle, 0);
    r.settle(outcome({}));
    r.complete(3, 20);
    expect(of("lesson_completed")[0]).toMatchObject({ stars: 3, xpEarned: 20, questionsAnswered: 1, correctFirstTry: 1 });
    r.present(puzzle, 0);
    expect(of("lesson_started")).toHaveLength(2);
  });

  it("closes a round left part-way as abandoned", () => {
    const r = new RebusRecorder({ category: "food" });
    r.present(puzzle, 0);
    r.settle(outcome({}));
    r.abandon();
    expect(of("lesson_abandoned")).toHaveLength(1);
    expect(of("lesson_completed")).toHaveLength(0);
  });
});

describe("a played round, in the log", () => {
  let nowMs = 1_000;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  });
  afterEach(() => vi.useRealTimers());

  const answerNow = () => {
    const names = [...screen.getByRole("group", { name: "Puzzle" }).querySelectorAll("[role=img]")].map((n) => n.getAttribute("aria-label"));
    return names.join("") === "honeymoon" ? "Honeymoon" : "Hot dog";
  };
  const type = (text: string) => {
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));
  };

  it("logs the puzzles, the wrong try, the completion, and pays the round's XP once", () => {
    const award = vi.fn();
    render(<RebusPage settings={DEFAULT_SETTINGS} onAwardXp={award} />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    type("nonsense");
    type(answerNow());
    fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
    type(answerNow());
    expect(award).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "See results" }));

    expect(of("question_presented")).toHaveLength(2);
    expect(of("answer_submitted").map((a) => a.correct)).toEqual([false, true, true]);
    expect(of("lesson_completed")).toHaveLength(1);
    expect(of("lesson_completed")[0]).toMatchObject({ questionsAnswered: 2, correctFirstTry: 1 });
    expect(award).toHaveBeenCalledTimes(1);
    // One of two solved on the first try is 50%: one star, 40% of a level's 20 XP.
    expect(award).toHaveBeenCalledWith(8);
    expect(screen.getByText(/8 XP/)).toBeTruthy();
  });

  it("pays the owner's XP for a perfect round when one is set, instead of the deployment's XP per level", () => {
    const award = vi.fn();
    render(<RebusPage settings={{ ...DEFAULT_SETTINGS, xpPerRound: 50 }} onAwardXp={award} />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    type(answerNow());
    fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
    type(answerNow());
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    // Two first-try solves of two: three stars, the full 50.
    expect(award).toHaveBeenCalledWith(50);
    expect(of("lesson_completed")[0]).toMatchObject({ stars: 3, xpEarned: 50 });
  });

  it("pays no XP for a replay of puzzles already played, and logs it as practice", () => {
    const award = vi.fn();
    render(<RebusPage settings={DEFAULT_SETTINGS} onAwardXp={award} />);
    const playRound = () => {
      type(answerNow());
      fireEvent.click(screen.getByRole("button", { name: "Next puzzle" }));
      type(answerNow());
      fireEvent.click(screen.getByRole("button", { name: "See results" }));
    };
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    playRound();
    expect(award).toHaveBeenCalledTimes(1);
    expect(of("lesson_started")[0].practice).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    playRound();
    expect(award).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/no XP this time/)).toBeTruthy();
    expect(of("lesson_started")[1].practice).toBe(true);
    expect(of("lesson_completed")[1]).toMatchObject({ xpEarned: 0 });
  });

  it("closes the round as abandoned when the child leaves part-way", () => {
    const { unmount } = render(<RebusPage settings={DEFAULT_SETTINGS} />);
    fireEvent.click(screen.getByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    type(answerNow());
    act(() => unmount());
    expect(of("lesson_abandoned")).toHaveLength(1);
    expect(of("lesson_completed")).toHaveLength(0);
  });
});
