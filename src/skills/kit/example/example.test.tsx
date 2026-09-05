import { describe, expect, it } from "vitest";
import { renderActivity } from "../testing";
import { ExampleActivity, buildQuestion } from "./ExampleActivity";

/**
 * The example is documentation, so it has to work. A shape a developer copies
 * from a file that never ran is a shape that has never been checked.
 */
const example = {
  id: "example",
  name: "Example",
  defaultParams: { max: 5, questionsPerRound: 2 },
  component: ExampleActivity,
};

describe("the reference activity", () => {
  it("builds the same question from the same params and index", () => {
    expect(buildQuestion({ max: 5 }, 3)).toEqual(buildQuestion({ max: 5 }, 3));
    expect(buildQuestion({ max: 5 }, 3).expected).toBe(String(buildQuestion({ max: 5 }, 3).answer));
  });

  it("scores a right answer once and finishes the round", async () => {
    const params = { max: 5, questionsPerRound: 1 };
    const h = renderActivity(example, { params, settings: { praiseMs: 0 } });
    await h.press(String(buildQuestion(params, 1).answer));
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.results).toHaveLength(1);
    h.unmount();
  });

  it("keeps the question after a wrong answer", async () => {
    const params = { max: 5, questionsPerRound: 2 };
    const q = buildQuestion(params, 1);
    const h = renderActivity(example, { params });
    await h.press(String(q.answer === 1 ? 2 : 1));
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.results).toHaveLength(0);
    h.unmount();
  });

  it("honours the switches it declares", async () => {
    const params = { max: 5, questionsPerRound: 1 };
    const q = buildQuestion(params, 1);
    const on = renderActivity(example, { params });
    await on.press(String(q.answer));
    expect(on.koda.count("sound.play")).toBeGreaterThan(0);
    on.unmount();

    const off = renderActivity(example, { params, features: { sound_chimes: false, audio_speech: false } });
    expect(off.buttons().some((n) => /read .*aloud/i.test(n))).toBe(false);
    await off.press(String(q.answer));
    expect(off.koda.count("sound.play")).toBe(0);
    expect(off.koda.count("speech.say")).toBe(0);
    off.unmount();
  });
});
