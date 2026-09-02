import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * What a practice round calls itself.
 *
 * A practice lesson is titled "Practice: Number Bonds" and its concept line
 * reads "Practice Without Help", which is right in a list of sixty lessons and
 * wrong inside the round: the screen already *is* the practice, so the bar said
 * the word twice above the question and told the child nothing either time.
 * What is left is the part they came for — the technique.
 */

vi.mock("../../../lib/useKoda", () => ({
  useKoda: () => ({
    access: () => ({ allowed: false, blockedBy: null, offered: false }),
    allows: () => false,
    ask: () => undefined,
    mode: null,
  }),
}));
vi.mock("../../../components/KodaAskModal", () => ({ KodaAskModal: () => null }));
vi.mock("../../../components/LiveVoiceCoachModal", () => ({ LiveVoiceCoachModal: () => null }));
vi.mock("../../../utils/audio", () => ({ playSound: vi.fn() }));

import { createFakeKoda } from "../testing/fakeKoda";
import { SkillRound } from "./SkillRound";
import type { RoundController } from "../round/useSkillRound";
import type { ActivityLesson } from "../../types";

const round = {
  index: 1,
  question: { id: "q1", taskKind: "bond" },
  attempt: 1,
  firstTryCount: 0,
  feedback: null,
  score: null,
  submit: () => undefined,
  advance: () => undefined,
  useSupport: () => undefined,
  hint: { level: 0, open: false, deepest: 0, toggle: () => undefined, next: () => undefined, reset: () => undefined },
  restart: () => undefined,
  describeQuestion: () => undefined,
} as unknown as RoundController;

const draw = (lesson: ActivityLesson) =>
  render(
    <SkillRound
      koda={createFakeKoda().sdk}
      lesson={lesson}
      fallbackTitle="Addition"
      round={round}
      totalQuestions={8}
      prompt="What do 1 and 8 make altogether?"
      onExit={() => undefined}
    >
      <div />
    </SkillRound>,
  );

afterEach(cleanup);

describe("the bar above a practice question", () => {
  it("names the technique and says practice nowhere", () => {
    draw({
      id: "practice-bonds",
      title: "Practice: Number Bonds",
      concept: "Practice Without Help",
      levelNumber: 70,
      practice: true,
    });

    expect(screen.getByText("Number Bonds")).toBeTruthy();
    expect(screen.getByText("Without Help")).toBeTruthy();
    expect(screen.queryByText(/practice/i)).toBeNull();
  });

  it("leaves a teaching lesson's wording exactly as the course wrote it", () => {
    draw({
      id: "bonds",
      title: "Number Bonds to Ten",
      concept: "Part-whole decomposition",
      levelNumber: 12,
    });

    expect(screen.getByText("Number Bonds to Ten")).toBeTruthy();
    expect(screen.getByText("Part-whole decomposition")).toBeTruthy();
  });

  it("does not clip a title that merely begins with the same letters", () => {
    // "Practising Bonds" is a name, not a prefix, and a stripper that reduces
    // it to "ing" is worse than the repetition it was written to remove.
    draw({ id: "x", title: "Practising Bonds", levelNumber: 3, practice: true });

    expect(screen.getByText("Practising Bonds")).toBeTruthy();
  });
});
