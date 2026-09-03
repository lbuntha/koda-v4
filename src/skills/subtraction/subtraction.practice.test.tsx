import { describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { isPracticeLesson } from "../../curriculum";
import { skill } from ".";
import type { Lesson } from "../types";

/**
 * Practice is retrieval, not a longer guided round.
 *
 * A practice lesson that still speaks the question, still offers a hint ladder
 * and still explains the answer is just the teaching lesson with a different
 * title — and the child never has to retrieve anything. These tests hold the
 * three promises `kit/practice.ts` makes: the modes are cycled rather than
 * sampled, the help is gone, and it is gone completely.
 */

interface PracticeParams {
  level: number;
  question: { practice?: boolean; modes?: string[]; questionsPerRound?: number };
}

const lessons = skill.lessons as unknown as Lesson[];
const practice = lessons.filter((lesson) => isPracticeLesson(lesson));
const paramsOf = (lesson: Lesson) => lesson.params as unknown as PracticeParams;
const activityOf = (lesson: Lesson) => skill.activities[lesson.activity.split("/")[1]];

/** Every mode each engine actually implements, from its own default params. */
const MODES_TAUGHT: Record<string, string[]> = {
  tray: ["remove", "remainder", "separate", "match_groups", "equation_match", "count_back", "subtract_zero", "subtract_all", "subtract_one", "fingers"],
  frames: ["five", "ten", "from_five", "from_ten"],
  bonds: ["part_unknown", "subtrahend_unknown", "minuend_unknown"],
  numberline: ["path_back", "open_back", "count_up", "bridge_ten", "bridge_hundred", "compensate_subtrahend", "constant_difference", "jump_tens_ones"],
  facts: ["family", "missing_addend", "doubles", "known_fact"],
  base10: ["build_subtract", "multiples_ten", "multiples_hundred", "trade_ten", "trade_hundred"],
  chart: ["chart_subtract", "chart_three", "expanded", "check_addition", "left_right"],
  column: ["standard", "cascade", "across_zero"],
  estimate: ["round_estimate", "reasonable"],
  story: ["remove_result", "remove_change", "remove_start", "compare_difference", "compare_bigger", "compare_smaller", "multi_step"],
  strategy: ["compare_paths"],
};

describe("subtraction ships one practice lesson per engine", () => {
  it("has eleven of them, one for each activity", () => {
    expect(practice).toHaveLength(11);
    const engines = practice.map((lesson) => lesson.activity.split("/")[1]);
    expect(new Set(engines).size).toBe(11);
    expect(new Set(engines)).toEqual(new Set(Object.keys(skill.activities)));
  });

  it("asks at least a hundred questions across the eleven", () => {
    const total = practice.reduce((sum, lesson) => sum + (paramsOf(lesson).question.questionsPerRound ?? 0), 0);
    expect(total).toBeGreaterThanOrEqual(100);
    for (const lesson of practice) {
      const count = paramsOf(lesson).question.questionsPerRound ?? 0;
      expect(count, `${lesson.id} is outside the 9–12 practice range`).toBeGreaterThanOrEqual(9);
      expect(count, `${lesson.id} is outside the 9–12 practice range`).toBeLessThanOrEqual(12);
    }
  });

  it("keeps a concept key its own engine already taught", () => {
    const taughtBy = new Map<string, Set<string>>();
    for (const lesson of lessons) {
      if (isPracticeLesson(lesson)) continue;
      const engine = lesson.activity.split("/")[1];
      if (!taughtBy.has(engine)) taughtBy.set(engine, new Set());
      taughtBy.get(engine)!.add(lesson.conceptKey!);
    }
    for (const lesson of practice) {
      const engine = lesson.activity.split("/")[1];
      expect(taughtBy.get(engine)!.has(lesson.conceptKey!),
        `${lesson.id} invents a concept key its engine never taught`).toBe(true);
    }
  });

  it("names every mode its engine implements, and no mode it does not", () => {
    for (const lesson of practice) {
      const engine = lesson.activity.split("/")[1];
      const modes = paramsOf(lesson).question.modes ?? [];
      expect(new Set(modes), `${lesson.id} skips or invents a mode`).toEqual(new Set(MODES_TAUGHT[engine]));
    }
  });
});

describe("a practice round cycles its modes rather than sampling them", () => {
  for (const lesson of practice) {
    it(`${lesson.id} covers every mode within one round`, () => {
      const activity = activityOf(lesson);
      const { modes = [], questionsPerRound = 0 } = paramsOf(lesson).question;
      const seen = new Set<string>();
      const asked = new Set<string>();
      for (let i = 1; i <= questionsPerRound; i += 1) {
        const question = activity.worksheet!.build!({ practice: true, modes }, i, seen, undefined) as { mode: string };
        asked.add(question.mode);
      }
      // A ten-question round over four modes must hit all four. Random
      // selection would leave a child practising one technique ten times.
      expect(asked.size, `${lesson.id} left a mode unpractised`).toBe(Math.min(modes.length, questionsPerRound));
    });
  }
});

describe("practice takes the scaffolding away completely", () => {
  for (const lesson of practice) {
    it(`${lesson.id} offers no hint, no voice and no spoken opening`, () => {
      const activity = activityOf(lesson);
      const params = paramsOf(lesson);
      const h = renderActivity(activity, {
        params: params.question as unknown as Record<string, unknown>,
        level: params.level,
        lesson: { id: lesson.id, title: lesson.title, levelNumber: params.level },
      });

      // A control that does nothing teaches a child the app's buttons are
      // decorative, so the help is removed rather than disabled.
      expect(h.buttons(), `${lesson.id} still offers a hint`).not.toContain("Hint");
      const readAloud = h.buttons().filter((name) => /read|aloud|speak|listen/i.test(name));
      expect(readAloud, `${lesson.id} still offers a read-aloud control`).toHaveLength(0);
      expect(h.koda.count("speech.say"), `${lesson.id} spoke on open`).toBe(0);

      h.unmount();
      cleanup();
    });
  }
});
