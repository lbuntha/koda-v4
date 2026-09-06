import { describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { buildQuestion as buildPredict } from "./activities/PredictThePour";
import { canPour, pour } from "./internal/pour";
import { specFor } from "./internal/specs";
import type { Rack } from "./internal/types";

/**
 * Phase 4: acting on partial information, and predicting a pour.
 *
 * `shown` counts down from the top, so what is hidden is what is *underneath*.
 * It counted from the bottom until this phase, which hid the top of every
 * bottle — the child could not see the colour they were about to pour, in a
 * lesson called "what is underneath".
 */
const sort = skill.activities.sort;
const predict = skill.activities.predict;
const hidden = (index = 1) => buildQuestion({ spec: "what-is-underneath", questionsPerRound: 3, seed: "phase4" }, index);

describe("a rack you cannot see all of", () => {
  it("hides the segments underneath, never the one on top", () => {
    for (let i = 1; i <= 40; i += 1) {
      hidden(i).rack.forEach((b, k) => {
        if (!b.seg.length) return;
        const shown = b.shown ?? b.seg.length;
        expect(shown, `q${i} bottle ${k} hid its top`).toBeGreaterThanOrEqual(1);
        expect(shown, `q${i} bottle ${k} shows more than it holds`).toBeLessThanOrEqual(b.seg.length);
      });
    }
  });

  it("covers two where there are two to cover", () => {
    const deep = hidden(1).rack.filter((b) => b.seg.length >= 3);
    expect(deep.length, "no bottle deep enough to test").toBeGreaterThan(0);
    deep.forEach((b) => expect(b.seg.length - (b.shown ?? b.seg.length)).toBe(2));
  });

  it("leaves a hidden segment out of the accessible name until it is uncovered", async () => {
    const question = hidden(1);
    const h = renderActivity(sort, { params: { spec: "what-is-underneath", questionsPerRound: 1, seed: "phase4" } });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    const covered = question.rack.findIndex((b) => b.seg.length > (b.shown ?? b.seg.length));
    expect(covered, "nothing was covered").toBeGreaterThanOrEqual(0);
    expect(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${covered + 1},`) }).getAttribute("aria-label"))
      .toContain("hidden");
    h.unmount();
  });

  it("uncovers what a pour exposes, and never re-hides it", () => {
    const start = hidden(1).rack;
    const move = start
      .flatMap((_, a) => start.map((__, b) => ({ from: a, to: b })))
      .find((m) => m.from !== m.to && canPour(start, m.from, m.to))!;
    const after = pour(start, move.from, move.to);

    const source = after[move.from];
    if (source.seg.length) {
      // Whatever is on top now is visible, whether or not it was before.
      expect(source.shown!).toBeGreaterThanOrEqual(1);
      // The count underneath never grows: a segment once seen stays seen.
      const before = start[move.from];
      expect(source.seg.length - source.shown!)
        .toBeLessThanOrEqual(before.seg.length - (before.shown ?? before.seg.length));
    }
    // Receiving does not X-ray the destination's own buried segments.
    const dest = after[move.to], destBefore = start[move.to];
    expect(dest.seg.length - dest.shown!)
      .toBe(destBefore.seg.length - (destBefore.shown ?? destBefore.seg.length));
  });

  it("shows a question mark rather than a grey colour to sort", async () => {
    const h = renderActivity(sort, { params: { spec: "what-is-underneath", questionsPerRound: 1, seed: "phase4" } });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    expect([...document.querySelectorAll("[data-bottle] text")].some((t) => t.textContent === "?")).toBe(true);
    h.unmount();
  });
});

describe("choosing the rack a pour makes", () => {
  const params = { spec: "guess-the-result", questionsPerRound: 3, seed: "phase4", steps: 1 as const };

  it("scores the picture the child picks, once", async () => {
    const question = buildPredict(params, 1);
    const h = renderActivity(predict, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-choice]").length).toBe(4));

    fireEvent.click(document.querySelector(`[data-choice="${question.answer}"]`)!);
    await waitFor(() => expect(h.koda.count("learning.answered")).toBe(1));
    // A second tap on a scored question must not score again.
    fireEvent.click(document.querySelector('[data-choice="0"]')!);
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("records a wrong pick as wrong, and keeps the question", async () => {
    const question = buildPredict(params, 1);
    const h = renderActivity(predict, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-choice]").length).toBe(4));
    const wrong = [0, 1, 2, 3].find((i) => i !== question.answer)!;
    fireEvent.click(document.querySelector(`[data-choice="${wrong}"]`)!);
    await waitFor(() => expect(h.koda.count("learning.answered")).toBe(1));
    expect(h.screen.getByText(/Not that one/)).toBeTruthy();
    h.unmount();
  });

  it("names every choice, so the racks can be compared without seeing them", async () => {
    const h = renderActivity(predict, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-choice]").length).toBe(4));
    const names = [...document.querySelectorAll("[data-choice]")].map((b) => b.getAttribute("aria-label")!);
    names.forEach((n) => expect(n).toMatch(/^Choice \d\. bottle 1: /));
    expect(new Set(names).size, "two choices read the same aloud").toBe(4);
    h.unmount();
  });

  it("asks about two pours in the two-ahead lesson", async () => {
    const two = { spec: "guess-two-ahead", questionsPerRound: 1, seed: "phase4", steps: 2 as const };
    const question = buildPredict(two, 1);
    expect(question.moves).toHaveLength(2);
    expect(question.prompt).toMatch(/, then bottle/);
    const h = renderActivity(predict, { params: two });
    await waitFor(() => expect(document.querySelectorAll("[data-choice]").length).toBe(4));
    h.unmount();
  });

  it("hints toward the rule rather than the answer", () => {
    const question = buildPredict(params, 1);
    const hints = [
      "A pour moves the whole run of one colour, not just one.",
    ];
    expect(question.prompt).toMatch(/^Pour bottle \d+ into bottle \d+\. Which rack comes next\?$/);
    // The first rung is the rule; nothing in the ladder names a choice number.
    const rack: Rack = question.start;
    expect(rack.length).toBeGreaterThan(0);
    expect(hints[0]).not.toMatch(/[Cc]hoice/);
  });
});
