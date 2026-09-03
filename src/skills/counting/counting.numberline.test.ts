import { describe, expect, it } from "vitest";

import { buildQuestion } from "./activities/FroggySkip";
import lessonsJson from "./lessons.json";

/**
 * Froggy Skip never counts past zero.
 *
 * A backward sequence runs `start - (length - 1) * step`, and the shipped
 * lesson asks for steps of ten from a start as low as 25 — four hops short of
 * what that needs. Children were shown "28, 18, 8, -2, -12" and asked which
 * number was missing, sometimes the -2.
 *
 * Driven from the real lesson parameters rather than a fixture, because that is
 * where the fault was: the generator's defaults and the lesson's declared range
 * disagreed about how far back five hops of ten can go, and nothing checked.
 */

const paramsFor = (id: string): Record<string, unknown> => {
  const lesson = (lessonsJson as { lessons: { id: string; activity: string; params?: { question?: Record<string, unknown> } }[] })
    .lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`no counting lesson "${id}"`);
  return lesson.params?.question ?? {};
};

/** Enough draws that a one-in-six branch cannot pass by luck. */
const DRAWS = 300;

describe("the numbers a number-line question can show", () => {
  it.each(["find-the-missing-number", "practice-numberline"])(
    "%s never shows a negative number",
    (id) => {
      const params = paramsFor(id);

      for (let i = 0; i < DRAWS; i += 1) {
        const q = buildQuestion(params as never, i);
        const shown = [
          ...(q.sequence ?? []).filter((n): n is number => n !== null),
          ...(q.pads ?? []),
          ...(q.options ?? []),
        ];

        for (const n of shown) {
          expect(n, `${id} drew ${JSON.stringify(q.sequence ?? q.pads)} / ${q.options}`).toBeGreaterThanOrEqual(0);
        }
      }
    },
  );

  it("still counts backwards, and still varies where it starts", () => {
    /* The cheap fix would be to stop reversing, or to pin the start to one
       legal value. Both would pass the test above and remove the lesson: half
       the sequences run backwards precisely so the rule has to be read rather
       than assumed. */
    const params = paramsFor("find-the-missing-number");
    const starts = new Set<number>();
    let backwards = 0;

    for (let i = 0; i < DRAWS; i += 1) {
      const q = buildQuestion(params as never, i);
      const seq = (q.sequence ?? []).filter((n): n is number => n !== null);
      if (seq.length > 1 && seq[1] < seq[0]) backwards += 1;
      starts.add(seq[0]);
    }

    expect(backwards).toBeGreaterThan(DRAWS * 0.25);
    expect(starts.size).toBeGreaterThan(5);
  });

  it("offers three wrong answers, all different and none of them the right one", () => {
    /* Filtering the negatives out could have left two options, or three with a
       hole. The top-up counts up from the answer, so a small answer with a big
       step still gets a full set. */
    for (const id of ["find-the-missing-number", "practice-numberline"]) {
      const params = paramsFor(id);

      for (let i = 0; i < DRAWS; i += 1) {
        const q = buildQuestion(params as never, i);
        if (!q.options) continue;

        expect(q.options, `${id}`).toHaveLength(4);
        expect(new Set(q.options).size, `${id}: ${q.options}`).toBe(4);
        expect(q.options).toContain(q.answer);
      }
    }
  });
});
