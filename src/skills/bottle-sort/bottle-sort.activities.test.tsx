import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { isDeadlock, legalPours, pour, refuseReason } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import type { Rack } from "./internal/types";

const sort = skill.activities.sort;
const params = { spec: "one-pour", questionsPerRound: 1, seed: "driver" };
/** A rack that takes several pours, so a single move does not end the round. */
const longer = { spec: "sort-three-colours", questionsPerRound: 1, seed: "driver" };
const isDone = (r: Rack) => r.every((b) => b.seg.length === 0 || (b.seg.length === b.cap && new Set(b.seg).size === 1));
/** The first legal pour that leaves work to do. */
const openingMove = (rack: Rack) => legalPours(rack).find((m) => !isDone(pour(rack, m.from, m.to)))!;

/** Plays the rack out with the solver's own moves. */
const solveIt = (h: ReturnType<typeof renderActivity>, start: Rack) => {
  let rack = start;
  for (let guard = 0; guard < 40; guard += 1) {
    if (rack.every((b) => b.seg.length === 0 || (b.seg.length === b.cap && new Set(b.seg).size === 1))) return;
    // Take any legal pour that reduces the remaining solution.
    const best = legalPours(rack)
      .map((m) => ({ m, after: pour(rack, m.from, m.to) }))
      .filter(({ after }) => minimumPours(after).moves !== null)
      .sort((a, b) => (minimumPours(a.after).moves ?? 99) - (minimumPours(b.after).moves ?? 99))[0];
    if (!best) return;
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${best.m.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${best.m.to + 1},`) }));
    rack = best.after;
  }
};

describe("the bottle rack", () => {
  it("scores a solved rack exactly once", () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(sort, { params, settings: { praiseMs: 0 } });
    solveIt(h, q.rack);
    expect(h.koda.count("learning.answered")).toBe(1);
    expect(h.results).toHaveLength(1);
    h.unmount();
  });

  it("refuses an illegal pour without scoring it", () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(sort, { params });
    // Find a pair the rules reject, and try it.
    let from = -1, to = -1;
    q.rack.forEach((_, a) => q.rack.forEach((_, b) => {
      if (from < 0 && a !== b && q.rack[a].seg.length && refuseReason(q.rack, a, b)) { from = a; to = b; }
    }));
    expect(from, "no refusable pair in this rack").toBeGreaterThanOrEqual(0);

    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${to + 1},`) }));

    // The whole point of the skill: a refusal is feedback, never an answer.
    expect(h.koda.count("learning.answered")).toBe(0);
    expect(h.results).toHaveLength(0);
    expect(h.text()).toMatch(/full|match|empty|corked|receives/i);
    h.unmount();
  });

  it("leaves the rack untouched when a pour is refused", () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(sort, { params });
    const before = h.screen.getByRole("button", { name: new RegExp("^Bottle 1,") }).getAttribute("aria-label");
    let from = -1, to = -1;
    q.rack.forEach((_, a) => q.rack.forEach((_, b) => {
      if (from < 0 && a !== b && q.rack[a].seg.length && refuseReason(q.rack, a, b)) { from = a; to = b; }
    }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${to + 1},`) }));
    expect(h.screen.getByRole("button", { name: new RegExp("^Bottle 1,") }).getAttribute("aria-label")).toBe(before);
    h.unmount();
  });

  it("moves liquid on a legal pour and says so to a screen reader", () => {
    const q = buildQuestion(longer, 1);
    const move = openingMove(q.rack);
    const h = renderActivity(sort, { params: longer });
    const before = h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }).getAttribute("aria-label");
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
    expect(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }).getAttribute("aria-label")).not.toBe(before);
    h.unmount();
  });

  it("puts a picked-up bottle back down when tapped again", () => {
    const q = buildQuestion(longer, 1);
    const move = openingMove(q.rack);
    const h = renderActivity(sort, { params: longer });
    const bottle = () => h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) });
    fireEvent.click(bottle());
    expect(bottle().getAttribute("data-picked")).toBe("true");
    fireEvent.click(bottle());
    expect(bottle().getAttribute("data-picked")).toBe("false");
    h.unmount();
  });

  it("steps back without scoring", () => {
    const q = buildQuestion(longer, 1);
    const move = openingMove(q.rack);
    const h = renderActivity(sort, { params: longer });
    const before = h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }).getAttribute("aria-label");
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
    fireEvent.click(document.querySelector('[data-action="undo"]')!);
    expect(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }).getAttribute("aria-label")).toBe(before);
    expect(h.koda.count("learning.answered")).toBe(0);
    h.unmount();
  });

  it("honours the switches it declares", () => {
    const q = buildQuestion(longer, 1);
    const move = openingMove(q.rack);
    const play = (h: ReturnType<typeof renderActivity>) => {
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
    };

    const on = renderActivity(sort, { params: longer });
    play(on);
    expect(on.koda.count("sound.play")).toBeGreaterThan(0);
    expect(on.koda.count("haptics.tap")).toBeGreaterThan(0);
    expect(on.buttons().some((n) => /hint/i.test(n))).toBe(true);
    on.unmount();

    const off = renderActivity(sort, { params: longer, features: { sound_chimes: false, haptic_feedback: false, move_hints: false, audio_speech: false } });
    play(off);
    expect(off.koda.count("sound.play")).toBe(0);
    expect(off.koda.count("haptics.tap")).toBe(0);
    expect(off.buttons().some((n) => /hint/i.test(n))).toBe(false);
    expect(off.koda.count("speech.say")).toBe(0);
    off.unmount();
  });
});

describe("the scoring contract", () => {
  it("cannot be lost at these levels, so a round here is only ever won", () => {
    // Searched every legal move of forty racks per spec: none of them makes the
    // rack unsolvable. Levels 1 to 5 are generous enough that a child cannot
    // trap themselves, which means the engine's deadlock branch — the one
    // incorrect answer this skill records — has no path here. It is exercised
    // by the pure rules below, and will be reachable once later phases tighten
    // the space. Worth knowing rather than assuming.
    ["one-pour", "two-pours", "use-the-empty-bottle", "pour-the-whole-run", "sort-three-colours"].forEach((spec) => {
      for (let i = 1; i <= 8; i += 1) {
        const q = buildQuestion({ spec, questionsPerRound: 1, seed: "trap" }, i);
        legalPours(q.rack).forEach((m) => {
          expect(minimumPours(pour(q.rack, m.from, m.to)).moves, `${spec} q${i}: ${m.from + 1}->${m.to + 1}`).not.toBeNull();
        });
      }
    });
  });

  it("knows a dead end when it sees one", () => {
    // No deal can produce this — colour counts are not multiples of a bottle —
    // but the rule has to be right before a later level can rely on it.
    const stuck: Rack = [{ cap: 2, seg: [0, 1] }, { cap: 2, seg: [1, 0] }];
    expect(isDeadlock(stuck)).toBe(true);
    expect(legalPours(stuck)).toEqual([]);
    expect(minimumPours(stuck).moves).toBeNull();
  });

  it("never submits twice for one rack", () => {
    const q = buildQuestion(params, 1);
    const h = renderActivity(sort, { params, settings: { praiseMs: 0 } });
    solveIt(h, q.rack);
    // Tapping on after the round has judged the rack must add nothing.
    fireEvent.click(h.screen.getByRole("button", { name: /^Bottle 1,/ }));
    fireEvent.click(h.screen.getByRole("button", { name: /^Bottle 2,/ }));
    expect(h.koda.count("learning.answered")).toBe(1);
    h.unmount();
  });

  it("gives every question an answer key the log can record", () => {
    for (let i = 1; i <= 3; i += 1) {
      const q = buildQuestion({ spec: "sort-three-colours", questionsPerRound: 3, seed: "keys" }, i);
      expect(q.expected).toBeTruthy();
      expect(q.id).toBeTruthy();
      expect(q.taskKind).toBe("sort_sort-three-colours");
    }
  });
});
