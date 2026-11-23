import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createFakeKoda } from "../testing/fakeKoda";
import { useSkillRound } from "./useSkillRound";

const question = (n: number) => ({ id: `q${n}`, taskKind: "test" });

function play(timeUp: () => boolean) {
  const fake = createFakeKoda({ timeUp });
  const { result } = renderHook(() =>
    useSkillRound({ koda: fake.sdk, totalQuestions: 3, levelNumber: 1, nextQuestion: question }),
  );
  const answerRight = () => {
    act(() => result.current.submit({ correct: true, title: "Yes" }));
    act(() => result.current.advance());
  };
  const exits = () => fake.calls.filter((c) => c.name === "ui.exit").length;
  return { result, answerRight, exits };
}

describe("a grown-up's time limit inside a round", () => {
  it("lets the open question finish, then leaves instead of asking the next one", () => {
    let up = false;
    const round = play(() => up);

    round.answerRight();
    expect(round.result.current.index).toBe(2);
    expect(round.exits()).toBe(0);

    up = true;
    round.answerRight();
    expect(round.exits()).toBe(1);
    expect(round.result.current.index).toBe(2);
  });

  it("still finishes the round normally on its last question", () => {
    let up = false;
    const round = play(() => up);
    round.answerRight();
    round.answerRight();
    up = true;
    round.answerRight();
    expect(round.exits()).toBe(0);
    expect(round.result.current.score).not.toBeNull();
  });
});
