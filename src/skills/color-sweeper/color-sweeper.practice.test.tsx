import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion as buildLens } from "./activities/NeighborLens";
import { buildQuestion as buildBoard } from "./activities/SweeperBoard";
import { buildQuestion as buildLab } from "./activities/ClueLab";

/**
 * Practice: the same engines with the help taken away, and taken away wholly.
 *
 * A hint button with nothing behind it, or a speaker that does not speak,
 * teaches a child that the app's controls are decorative. So the test is not
 * "hints are empty" — it is that the controls are gone.
 */

const practice = skill.lessons.filter(
  (l) => (l.params as { question?: { practice?: boolean } }).question?.practice,
);
const engineFor = (activity: string) =>
  activity === "color-sweeper/board" ? { def: skill.activities.board, build: buildBoard }
  : activity === "color-sweeper/reason" ? { def: skill.activities.reason, build: buildLab }
  : { def: skill.activities.neighbors, build: buildLens };

describe("ten practice lessons", () => {
  it("there are ten, all nine questions, all silent", () => {
    expect(practice).toHaveLength(10);
    for (const lesson of practice) {
      const q = (lesson.params as { question: { questionsPerRound: number; modes?: string[] } }).question;
      expect(q.questionsPerRound, lesson.id).toBe(9);
      expect(q.modes?.length, `${lesson.id} names no modes to cycle`).toBeGreaterThan(0);
    }
  });

  it.each(practice.map((l) => [l.title, l] as const))("%s offers no help at all", async (_t, lesson) => {
    const { def } = engineFor(lesson.activity);
    const h = renderActivity(def, { params: lesson.params as Record<string, unknown>, level: 31 });
    expect(h.koda.count("speech.say"), `${lesson.id} speaks`).toBe(0);
    const buttons = h.buttons().join(" | ");
    expect(buttons, `${lesson.id} shows a hint button`).not.toMatch(/hint/i);
    expect(buttons, `${lesson.id} shows a read-aloud button`).not.toMatch(/read|aloud|listen/i);
    expect(h.koda.count("learning.supportUsed")).toBe(0);
    h.unmount();
  });

  /*
   * The off-by-one that would have broken every practice round.
   *
   * `modeAt` counts from one and `buildQuestion` counts from zero, so passing
   * the index straight through asked for `modes[-1]` on question one —
   * undefined, and a throw. No teaching lesson sets `modes`, so nothing before
   * this phase could have caught it.
   */
  it.each(practice.map((l) => [l.title, l] as const))("%s builds its first question", (_t, lesson) => {
    const { build } = engineFor(lesson.activity);
    expect(() => build(lesson.params as never, 0)).not.toThrow();
  });

  it.each(practice.map((l) => [l.title, l] as const))("%s uses every mode it names", (_t, lesson) => {
    const { build } = engineFor(lesson.activity);
    const modes = (lesson.params as { question: { modes: string[] } }).question.modes;
    const seen = new Set<string>();
    /* Cycled rather than sampled: nine questions over six modes must reach all
       six, or a child who drew badly would practise one technique nine times. */
    const used = new Set(Array.from({ length: 9 }, (_, i) =>
      (build(lesson.params as never, i, seen) as { mode: string }).mode));
    for (const mode of modes) expect(used, `${lesson.id} never asked ${mode}`).toContain(mode);
  });
});

describe("what a practice round must not claim", () => {
  it("reviews under one concept key, never one per technique it exercises", () => {
    /* Level 31 exercises four foundation techniques and level 36 six clue
       kinds. An aggregate score across them is not evidence of any single one,
       so each carries the one key it reviews and the host's practice flag keeps
       it out of the recommendation catalogue. */
    for (const lesson of practice) {
      expect(typeof lesson.conceptKey, lesson.id).toBe("string");
      expect(lesson.concept).toBe("Practice Without Help");
    }
    const mixed = practice.filter((l) => ((l.params as { question: { modes: string[] } }).question.modes.length > 1));
    expect(mixed.length).toBeGreaterThan(0);
    for (const lesson of mixed) {
      const keys = practice.filter((l) => l.conceptKey === lesson.conceptKey);
      expect(keys, `${lesson.id} shares its key with another practice lesson`).toHaveLength(1);
    }
  });

  it("keeps teaching and practice in separate course units", async () => {
    const course = await import("../../curriculum/course.json");
    const ids = new Set(practice.map((l) => `color-sweeper/${l.id}`));
    for (const unit of (course.default.units as { id: string; lessons: string[] }[])) {
      const ours = unit.lessons.filter((ref) => ref.startsWith("color-sweeper/"));
      if (!ours.length) continue;
      const kinds = new Set(ours.map((ref) => ids.has(ref)));
      expect(kinds.size, `${unit.id} mixes teaching and practice`).toBe(1);
    }
  });

  it("requires only concepts the teaching levels actually taught", () => {
    const taught = new Set(
      skill.lessons.filter((l) => !ids(l)).map((l) => l.conceptKey),
    );
    function ids(l: (typeof skill.lessons)[number]) {
      return (l.params as { question?: { practice?: boolean } }).question?.practice;
    }
    for (const lesson of practice) {
      for (const need of lesson.requires ?? []) {
        expect(taught.has(need), `${lesson.id} requires "${need}", which no lesson teaches`).toBe(true);
      }
    }
  });
});
