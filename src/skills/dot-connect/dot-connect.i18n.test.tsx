import { afterEach, describe, expect, it } from "vitest";
import { describeSkillLocales, renderActivity } from "../kit/testing";
import { skill } from ".";
import { PreferencesAPI } from "../../lib/preferences";
import { withLessonEdits } from "../../lib/lessonContent";
import { promptFor } from "./activities/ConnectBoard";
import { connectHints } from "./internal/hints";
import { emptyLines } from "./internal/drawing";
import { BANK } from "./internal/bank";

/** Dot Connect in Khmer: every line translated, and choosing Khmer reaches the words. */

describeSkillLocales("dot-connect", {
  complete: ["km"],
  source: { dir: "src/skills/dot-connect", helper: "td" },
});

const khmer = /[ក-៿]/;

describe("Dot Connect in Khmer", () => {
  afterEach(() => PreferencesAPI.update({ language: null }));

  it("reads prompts and hints in the language on screen, keeping the A B C letters", () => {
    const board = BANK["exact-steps"][0];
    PreferencesAPI.update({ language: "km" });
    const prompt = promptFor({ board, mustFill: true });
    expect(prompt).toMatch(khmer);
    expect(prompt).toContain(String(board.steps!.steps));
    const ladder = connectHints(board, emptyLines(board), { mustFill: true });
    for (const rung of ladder) expect(rung).toMatch(khmer);
    expect(ladder[2]).toMatch(/[A-G]/);
  });

  it("translates every lesson's title and opening line", () => {
    PreferencesAPI.update({ language: "km" });
    for (const lesson of skill.lessons) {
      const local = withLessonEdits("dot-connect", lesson);
      expect(local.title, lesson.id).toMatch(khmer);
      const audio = (local.params as { play?: { audioPrompt?: string } }).play?.audioPrompt;
      if (audio) expect(audio, lesson.id).toMatch(khmer);
    }
  });

  it("shows the board in Khmer", () => {
    PreferencesAPI.update({ language: "km" });
    const h = renderActivity(skill.activities.connect, { params: { spec: "two-pairs", offset: 0 } });
    expect(h.text()).toMatch(khmer);
    h.unmount();
  });
});
