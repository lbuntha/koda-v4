import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The flame in the bar, at the moment it is supposed to light.
 *
 * The standing is read once because the figures only move when a round ends.
 * That was half a rule: the bar stays on screen behind the summary, so the end
 * of the round — the only moment the streak actually changes — was the one
 * moment it never re-read. A child finished the round that earned their first
 * day and watched a flame saying 0.
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

import { createFakeKoda, type FakeKodaOptions } from "../testing/fakeKoda";
import { SkillRound } from "./SkillRound";
import type { RoundController } from "../round/useSkillRound";

const roundWith = (score: RoundController["score"]) =>
  ({
    index: 5,
    question: { id: "q5", taskKind: "desk_partial_sums" },
    attempt: 1,
    firstTryCount: 5,
    feedback: null,
    score,
    submit: () => undefined,
    advance: () => undefined,
    useSupport: () => undefined,
    hint: {
      level: 0,
      open: false,
      deepest: 0,
      toggle: () => undefined,
      next: () => undefined,
      reset: () => undefined,
    },
    restart: () => undefined,
    describeQuestion: () => undefined,
  }) as unknown as RoundController;

afterEach(cleanup);

describe("the learner's standing in the round bar", () => {
  it("lights the flame when the round that earned the day is scored", async () => {
    // The host records the practice as it hears the result, so the figures it
    // answers with change underneath the bar — which is the whole point.
    const options: FakeKodaOptions = { snapshot: { streakDays: 0, xp: 0 } };
    const koda = createFakeKoda(options).sdk;

    const draw = (score: RoundController["score"]) => (
      <SkillRound
        koda={koda}
        fallbackTitle="Partial Sums"
        round={roundWith(score)}
        totalQuestions={5}
        prompt="52 plus 88."
        onExit={() => undefined}
      >
        <div />
      </SkillRound>
    );

    const { rerender } = render(draw(null));
    await waitFor(() => expect(screen.getByLabelText("0 day streak")).toBeTruthy());

    options.snapshot = { streakDays: 1, xp: 40 };
    rerender(draw({ stars: 3, xp: 40, correctFirstTry: 5, total: 5 } as RoundController["score"]));

    await waitFor(() => expect(screen.getByLabelText("1 day streak")).toBeTruthy());
  });
});
