import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./skillRegistryApi", () => ({ queueLocalSkillConfiguration: () => undefined }));

import { LessonContentAPI, editsAsLessonJson, withLessonEdits } from "./lessonContent";
import type { Lesson } from "../skills/types";

/**
 * An edited hint has to reach the round.
 *
 * The overlay's rule is that a lesson is resolved once, file plus edit, so
 * every surface reads the same words. The hint is the case where that is easy
 * to get wrong: the round does not read it off the lesson, it reads it off
 * `params.play`, so an edit written beside the params rather than into them
 * would look saved in the Skill Manager and change nothing a child sees.
 */

const lesson: Lesson = {
  id: "count-in-a-row",
  title: "Count the Row",
  concept: "One-to-one correspondence",
  activity: "counting/orbit",
  params: {
    level: 1,
    play: { kidTip: "Say one number for each one you touch.", audioPrompt: "Count in a row!" },
  },
};

const playOf = (l: Lesson) =>
  (l.params as { play?: { kidTip?: string; audioPrompt?: string } }).play ?? {};

beforeEach(() => {
  localStorage.clear();
  LessonContentAPI.reset("counting", lesson.id);
});

describe("an edited hint", () => {
  it("lands where the activity reads it", () => {
    LessonContentAPI.set("counting", lesson.id, { kidTip: "Point at each one as you say it." });
    expect(playOf(withLessonEdits("counting", lesson)).kidTip).toBe(
      "Point at each one as you say it.",
    );
  });

  it("leaves the rest of the play block alone", () => {
    LessonContentAPI.set("counting", lesson.id, { kidTip: "Point at each one." });
    // The spoken intro is authored beside the tip and is not what was edited.
    expect(playOf(withLessonEdits("counting", lesson)).audioPrompt).toBe("Count in a row!");
  });

  it("falls back to the shipped tip when it is cleared", () => {
    LessonContentAPI.set("counting", lesson.id, { kidTip: "Point at each one." });
    LessonContentAPI.set("counting", lesson.id, { kidTip: "   " });
    expect(playOf(withLessonEdits("counting", lesson)).kidTip).toBe(
      "Say one number for each one you touch.",
    );
  });

  it("copies out nested the way lessons.json nests it", () => {
    LessonContentAPI.set("counting", lesson.id, { kidTip: "Point at each one." });
    expect(JSON.parse(editsAsLessonJson("counting", lesson.id)!)).toEqual({
      id: lesson.id,
      params: { play: { kidTip: "Point at each one." } },
    });
  });
});
