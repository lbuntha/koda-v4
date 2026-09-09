import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";

/**
 * The twelve practice lessons, checked as a set.
 *
 * A lesson teaches one technique with everything switched on. Practice is what
 * comes after: the same apparatus, several techniques mixed, and nothing to
 * lean on. That help is removed on purpose and it is removed *completely* — a
 * speaker button that does nothing, or a hint panel with nothing behind it,
 * teaches a child that the app's controls are decorative.
 *
 * These are the checks that only make sense across all twelve at once.
 */

interface LessonShape {
  id: string;
  activity: string;
  conceptKey?: string;
  params: {
    level: number;
    question: { practice?: boolean; modes?: string[]; questionsPerRound?: number };
    play: Record<string, unknown>;
  };
}

const lessons = skill.lessons as unknown as LessonShape[];
const practice = lessons.filter((l) => l.params.question.practice);
const activityOf = (l: LessonShape) => skill.activities[l.activity.split("/")[1]];

describe("there is one practice lesson for every engine", () => {
  it("covers all twelve, and nothing twice", () => {
    expect(practice).toHaveLength(12);
    const engines = practice.map((l) => l.activity.split("/")[1]);
    expect(new Set(engines).size).toBe(12);
    expect(new Set(engines)).toEqual(new Set(Object.keys(skill.activities)));
  });

  it("numbers them last, from 57 to 68", () => {
    const levels = practice.map((l) => l.params.level).sort((a, b) => a - b);
    expect(levels).toEqual(Array.from({ length: 12 }, (_, i) => 57 + i));
  });

  /*
   * None of them invents a concept.
   *
   * Practising a technique should update the record that technique already
   * has. A `practice-groups` key would be a second mastery record for the same
   * competence, and the progression would never see them as the same thing.
   */
  it("reuses a conceptKey its own engine already teaches", () => {
    const taught = new Set(
      lessons.filter((l) => !l.params.question.practice).map((l) => l.conceptKey),
    );
    for (const lesson of practice) {
      expect(lesson.conceptKey, `${lesson.id} has no concept`).toBeTruthy();
      expect(taught.has(lesson.conceptKey), `${lesson.id} invents ${lesson.conceptKey}`).toBe(true);
      expect(lesson.conceptKey).not.toMatch(/^practice/);
    }
  });
});

describe("every practice lesson takes the scaffolding away", () => {
  it("opens silently, offers no read-aloud and no hints", async () => {
    for (const lesson of practice) {
      const h = renderActivity(activityOf(lesson), {
        params: lesson.params as unknown as Record<string, unknown>,
        level: lesson.params.level,
      });
      expect(h.koda.count("speech.say"), `${lesson.id} spoke on opening`).toBe(0);
      expect(h.buttons(), `${lesson.id} offers a read-aloud`).not.toContain("Read question aloud");
      expect(h.buttons(), `${lesson.id} offers a hint`).not.toContain("Hint");
      h.unmount();
    }
  });

  it("presents a question on every one of them", () => {
    for (const lesson of practice) {
      const h = renderActivity(activityOf(lesson), {
        params: lesson.params as unknown as Record<string, unknown>,
        level: lesson.params.level,
      });
      expect(h.koda.count("learning.present"), `${lesson.id} presented nothing`).toBe(1);
      expect(h.text().length).toBeGreaterThan(20);
      h.unmount();
    }
  });
});

describe("the modes are cycled, not sampled", () => {
  /*
   * Cycled so a run covers every technique.
   *
   * Random selection would leave a child who drew badly practising one thing
   * nine times and calling it mixed practice.
   */
  it("walks the declared modes in order, starting at the first", () => {
    for (const lesson of practice) {
      const modes = lesson.params.question.modes!;
      expect(modes.length, `${lesson.id} declares no modes`).toBeGreaterThan(0);
      const build = activityOf(lesson).worksheet!.build!;
      for (let i = 0; i < modes.length * 2; i += 1) {
        const question = build(lesson.params as never, i, new Set(), { current: null }) as { mode: string };
        expect(question.mode, `${lesson.id} question ${i}`).toBe(modes[i % modes.length]);
      }
    }
  });

  it("asks enough questions to reach every mode at least once", () => {
    for (const lesson of practice) {
      const modes = lesson.params.question.modes!.length;
      const asked = lesson.params.question.questionsPerRound ?? 5;
      expect(
        asked,
        `${lesson.id} asks ${asked} questions across ${modes} modes`,
      ).toBeGreaterThanOrEqual(Math.min(modes, 8));
    }
  });

  it("names only modes its engine actually has", () => {
    for (const lesson of practice) {
      const build = activityOf(lesson).worksheet!.build!;
      for (const [i] of lesson.params.question.modes!.entries()) {
        // An unknown mode would fall through to the engine's default and be
        // silently replaced, so this checks the round-trip rather than a list.
        const question = build(lesson.params as never, i, new Set(), { current: null }) as { mode: string };
        expect(question.mode).toBe(lesson.params.question.modes![i]);
      }
    }
  });
});
