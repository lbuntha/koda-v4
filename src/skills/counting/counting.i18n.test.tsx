import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { numberWord } from "./internal/guide/countGuide";

/**
 * Counting in Khmer: every line has a translation, and choosing Khmer in
 * Settings actually reaches the round — the words on screen, the words said
 * aloud, and the lesson's own copy.
 */

describeSkillLocales("counting", {
  complete: ["km"],
  source: { dir: "src/skills/counting", helper: "tc" },
});

const { orbit } = skill.activities;
const lesson = (id: string) => skill.lessons.find((l) => l.id === id)!;

describe("counting in Khmer", () => {
  afterEach(() => {
    PreferencesAPI.update({ language: null });
    vi.restoreAllMocks();
  });

  it("asks the question in Khmer", () => {
    PreferencesAPI.update({ language: "km" });
    vi.spyOn(Math, "random").mockReturnValue(0);
    const h = renderActivity(orbit, {
      params: { ...(lesson("count-in-a-row").params as object), question: { countRange: [4, 4], settleMs: 0 } },
      level: 1,
    });

    expect(screen.getByText("ប៉ះរ៉ុក្កែតម្ដងមួយៗ។ រាប់ពេលប៉ះ!")).toBeTruthy();
    h.unmount();
  });

  it("counts aloud in Khmer", () => {
    PreferencesAPI.update({ language: "km" });
    vi.spyOn(Math, "random").mockReturnValue(0);
    const h = renderActivity(orbit, {
      params: { ...(lesson("count-in-a-row").params as object), question: { countRange: [4, 4], settleMs: 0 } },
      level: 1,
    });

    act(() => {
      screen.getAllByRole("button", { name: /^រ៉ុក្កែត \d/ })[0].click();
    });
    expect(h.koda.only("speech.say").map((call) => call.args[0])).toContain("មួយ");
    h.unmount();
  });

  it("switches back to English without a reload", () => {
    PreferencesAPI.update({ language: "km" });
    expect(numberWord(3)).toBe("បី");
    PreferencesAPI.update({ language: "en" });
    expect(numberWord(3)).toBe("three");
  });

  it("reads the lesson's own copy from the catalog", () => {
    PreferencesAPI.update({ language: "km" });
    const shown = withLessonEdits("counting", lesson("count-in-a-row"));
    const play = (shown.params as { play: { kidTip: string; stepByStep: string[] } }).play;

    expect(shown.title).toBe("រាប់ជួរ");
    expect(play.kidTip).toBe("និយាយលេខមួយ សម្រាប់របស់នីមួយៗដែលអ្នកប៉ះ។");
    expect(play.stepByStep).toHaveLength(3);
    expect(play.stepByStep[0]).toMatch(/[ក-៿]/);
  });

  it("leaves English lessons exactly as written", () => {
    PreferencesAPI.update({ language: "en" });
    expect(withLessonEdits("counting", lesson("count-in-a-row"))).toEqual(lesson("count-in-a-row"));
  });
});
