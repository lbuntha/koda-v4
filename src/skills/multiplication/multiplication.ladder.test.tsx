import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion as buildFact, type FactQuestion } from "./activities/FactDeck";
import { buildQuestion as buildArray } from "./activities/ArrayGrid";
import { factLevel, type Fact } from "./internal/data/helperFacts";

/**
 * Phase 6's architecture check, as a test.
 *
 * Ten lessons — the nine derived-fact techniques and the array split — shipped
 * as JSON with no new code. The claim is easy to make and easy to get wrong, so
 * this file checks the two things that would show it was false: that every
 * lesson the skill defines actually plays through the engine it names, and that
 * every derived fact leans only on facts the child has already been taught.
 *
 * If one of these needs a component or a level branch, the engine it runs on
 * was under-parameterised and that is the bug to fix — not this test.
 */

interface LessonShape {
  id: string;
  activity: string;
  conceptKey?: string;
  requires?: string[];
  params: { level: number; question?: Record<string, unknown> };
}

const lessons = skill.lessons as unknown as LessonShape[];
const activityOf = (lesson: LessonShape) => skill.activities[lesson.activity.split("/")[1]];

describe("every lesson this skill defines plays on the engine it names", () => {
  it("routes all of them to a registered activity", () => {
    for (const lesson of lessons) {
      expect(activityOf(lesson), `${lesson.id} names ${lesson.activity}, which is not registered`).toBeTruthy();
    }
  });

  /*
   * Mounted, not merely built.
   *
   * `describeActivitySmoke` opens only the first lesson per engine, so the
   * nineteen that share `FactDeck` and `ArrayGrid` with an earlier level have
   * never been opened at all. A lesson whose params its engine cannot serve
   * crashes here, in a second, rather than on a child's tablet.
   */
  it("opens every one of them and presents a question", () => {
    for (const lesson of lessons) {
      const activity = activityOf(lesson);
      const h = renderActivity(activity, {
        params: lesson.params as unknown as Record<string, unknown>,
        level: lesson.params.level,
      });
      expect(h.koda.count("learning.present"), `${lesson.id} presented nothing`).toBe(1);
      expect(h.text().length, `${lesson.id} rendered an empty round`).toBeGreaterThan(20);
      h.unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The derived-fact ladder                                                     */
/* -------------------------------------------------------------------------- */

/** The nine lessons that reach a table through a helper, and the table each owns. */
const DERIVED: { id: string; level: number; drivers?: number[] }[] = [
  { id: "times-five", level: 19, drivers: [5] },
  { id: "times-four", level: 24, drivers: [4] },
  { id: "times-eight", level: 25, drivers: [8] },
  { id: "times-three", level: 26, drivers: [3] },
  { id: "times-six", level: 27, drivers: [6] },
  { id: "times-nine", level: 28, drivers: [9] },
  { id: "times-seven", level: 29, drivers: [7] },
  { id: "times-eleven-twelve", level: 30, drivers: [11, 12] },
  { id: "near-squares", level: 31 },
];

const factsLesson = (id: string): LessonShape => {
  const found = lessons.find((l) => l.id === id);
  expect(found, `${id} is not in lessons.json`).toBeTruthy();
  return found!;
};

describe("every derived fact leans only on facts already taught", () => {
  /**
   * §12 trap 9, and the reason `requires` exists in §3.2.
   *
   * A child cannot be asked to reach the eights by doubling the fours before
   * the fours are recorded. `factLevel` says the earliest level at which each
   * helper is known; every one of them has to come strictly before the lesson
   * doing the deriving.
   */
  it("never builds on a helper the lesson's own level has not reached", () => {
    for (const { id, level } of DERIVED) {
      const lesson = factsLesson(id);
      for (let i = 0; i < 120; i += 1) {
        const question = buildFact(lesson.params.question as never, i) as FactQuestion;
        for (const helper of question.helpers) {
          const known = factLevel([helper.a, helper.b] as Fact);
          expect(
            known,
            `${id} (level ${level}) leans on ${helper.a} × ${helper.b}, first taught at level ${known}`,
          ).toBeLessThan(level);
        }
      }
    }
  });

  it("drills the table its own lesson names", () => {
    for (const { id, drivers } of DERIVED) {
      if (!drivers) continue;
      const lesson = factsLesson(id);
      for (let i = 0; i < 60; i += 1) {
        const question = buildFact(lesson.params.question as never, i) as FactQuestion;
        expect(drivers, `${id} drew ${question.a} × ${question.b}`).toContain(question.driver);
      }
    }
  });

  /**
   * The helper card is the lesson, so it has to reconstruct the answer.
   *
   * Checked against arithmetic done here rather than against the ladder's own
   * `derivedProduct`, which would only prove the table agrees with itself.
   */
  it("reaches the answer from the card the child is shown", () => {
    const reconstruct = (q: FactQuestion): number => {
      const products = q.helpers.map((h) => h.product);
      const last = products[products.length - 1];
      if (/double it/i.test(q.adjustment)) return last * 2;
      if (/halve it/i.test(q.adjustment)) return last / 2;
      const add = /add one more (\d+)/i.exec(q.adjustment);
      if (add) return last + Number(add[1]);
      const take = /take one (\d+) away/i.exec(q.adjustment);
      if (take) return last - Number(take[1]);
      if (/add them together/i.test(q.adjustment)) return products.reduce((a, b) => a + b, 0);
      throw new Error(`unreadable adjustment: ${q.adjustment}`);
    };

    for (const { id } of DERIVED) {
      const lesson = factsLesson(id);
      for (let i = 0; i < 120; i += 1) {
        const question = buildFact(lesson.params.question as never, i) as FactQuestion;
        expect(question.helpers.length, `${id} showed no helper`).toBeGreaterThan(0);
        expect(
          reconstruct(question),
          `${id}: the card for ${question.a} × ${question.b} does not reach ${question.product}`,
        ).toBe(question.product);
      }
    }
  });
});

describe("choosing a route, and drawing one", () => {
  it("only ever offers level 32 a helper it could already have met", () => {
    const lesson = factsLesson("use-a-known-fact");
    for (let i = 0; i < 200; i += 1) {
      const question = buildFact(lesson.params.question as never, i) as FactQuestion;
      const helper = question.candidates.find((c) => c.helps)!;
      expect(factLevel([helper.a, helper.b] as Fact)).toBeLessThan(32);
      // And the three that do not help are still true facts.
      for (const candidate of question.candidates) {
        expect(candidate.product).toBe(candidate.a * candidate.b);
      }
    }
  });

  it("splits level 33's array into two pieces that put it back together", () => {
    const lesson = factsLesson("split-the-array");
    for (let i = 0; i < 200; i += 1) {
      const question = buildArray(lesson.params.question as never, i);
      expect(question.mode).toBe("split_array");
      expect(question.rows).toBeGreaterThanOrEqual(6);
      expect(question.cuts.length).toBeGreaterThan(0);
      for (const cut of question.cuts) {
        expect(cut * question.cols + (question.rows - cut) * question.cols).toBe(question.total);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* No new code                                                                 */
/* -------------------------------------------------------------------------- */

describe("the phase added no engines", () => {
  /*
   * Phrased about the levels rather than about the skill's engine count, so it
   * keeps meaning something as later phases add engines of their own. The claim
   * is that everything up to level 33 runs on the five that existed before
   * Phase 6 — not that the skill never grows again.
   */
  it("runs every level up to 33 on the five engines that already existed", () => {
    const before = ["array", "facts", "groups", "numberline", "table"];
    for (const lesson of lessons.filter((l) => l.params.level <= 33)) {
      expect(before, `${lesson.id} runs on ${lesson.activity}`).toContain(lesson.activity.split("/")[1]);
    }
  });

  it("gives every lesson from 24 to 33 an engine that already existed", () => {
    const phaseSix = lessons.filter((l) => l.params.level >= 24 && l.params.level <= 33);
    expect(phaseSix).toHaveLength(10);
    for (const lesson of phaseSix) {
      expect(["multiplication/facts", "multiplication/array"]).toContain(lesson.activity);
    }
  });
});
