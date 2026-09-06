import { describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { UNIFORM, accepts, bottleDone, goalFor, labelFor } from "./internal/goal";
import { canPour, isSolvedRack, legalPours, pour, refuseReason } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import { RACK_SPECS, specFor } from "./internal/specs";
import type { Rack } from "./internal/types";

/**
 * Phase 5: the goal becomes the lesson.
 *
 * Up to level 24 "finished" meant one colour per bottle and a colour could
 * only be poured onto its own kind. Those two facts are the same fact, and
 * changing one without the other breaks the skill: an ordering goal under the
 * matching rule is unreachable, because a 2 may never be placed on a 1. So
 * both live in `goal.ts` and these tests hold them together.
 */
const sort = skill.activities.sort;
const ordering = RACK_SPECS.filter((s) => s.goal);

describe("what a finished bottle is", () => {
  it("leaves the uniform goal exactly as it was", () => {
    expect(bottleDone(UNIFORM, { cap: 4, seg: [] })).toBe(true);
    expect(bottleDone(UNIFORM, { cap: 4, seg: [1, 1, 1, 1] })).toBe(true);
    expect(bottleDone(UNIFORM, { cap: 4, seg: [1, 1, 1] })).toBe(false);
    expect(bottleDone(UNIFORM, { cap: 4, seg: [1, 1, 1, 2] })).toBe(false);
  });

  it("wants the whole order, in order, and nothing else", () => {
    const goal = goalFor(specFor("sort-by-number")!);
    expect(goal.kind).toBe("order");
    expect(bottleDone(goal, { cap: 4, seg: [0, 1, 2, 3] })).toBe(true);
    expect(bottleDone(goal, { cap: 4, seg: [] })).toBe(true);
    // Right numbers, wrong order.
    expect(bottleDone(goal, { cap: 4, seg: [3, 2, 1, 0] })).toBe(false);
    // A prefix is not finished, and neither is four of a kind.
    expect(bottleDone(goal, { cap: 4, seg: [0, 1, 2] })).toBe(false);
    expect(bottleDone(goal, { cap: 4, seg: [0, 0, 0, 0] })).toBe(false);
  });

  it("reverses cleanly for the backwards lesson", () => {
    const goal = goalFor(specFor("sort-backwards")!);
    expect(bottleDone(goal, { cap: 4, seg: [3, 2, 1, 0] })).toBe(true);
    expect(bottleDone(goal, { cap: 4, seg: [0, 1, 2, 3] })).toBe(false);
  });

  it("orders fractions by value, not by the digits", () => {
    // The misconception the lesson exists for: a third is smaller than a half,
    // although three is bigger than two.
    const spec = specFor("sort-by-size")!;
    const goal = goalFor(spec);
    if (goal.kind !== "order") throw new Error("expected an ordering goal");
    expect(goal.order.map((c) => labelFor(goal, spec, c))).toEqual(["1/3", "1/2", "2/3", "3/4"]);
  });

  it("counts by twos on the segments themselves", () => {
    const spec = specFor("count-by-twos")!;
    const goal = goalFor(spec);
    expect([0, 1, 2, 3].map((c) => labelFor(goal, spec, c))).toEqual(["2", "4", "6", "8"]);
  });

  it("keeps odds from evens, in any order within a bottle", () => {
    const goal = goalFor(specFor("odd-and-even-bottles")!);
    expect(goal.kind).toBe("group");
    // Colours 0 and 2 are shown as 1 and 3: the odd ones.
    expect(bottleDone(goal, { cap: 4, seg: [0, 2, 0, 2] })).toBe(true);
    expect(bottleDone(goal, { cap: 4, seg: [1, 3, 3, 1] })).toBe(true);
    expect(bottleDone(goal, { cap: 4, seg: [0, 1, 2, 3] })).toBe(false);
    // Order inside does not matter, but a part-filled bottle is not finished.
    expect(bottleDone(goal, { cap: 4, seg: [0, 2, 0] })).toBe(false);
  });
});

describe("what may be poured onto what", () => {
  it("takes the next in the order, and only one of it", () => {
    const goal = goalFor(specFor("sort-by-number")!);
    const rack: Rack = [{ cap: 4, seg: [1, 1, 1] }, { cap: 4, seg: [0] }];
    // A run of three 1s is on top, but only one belongs on the 0.
    expect(accepts(goal, rack[1], 1)).toBe(1);
    expect(pour(rack, 0, 1, goal)[1].seg).toEqual([0, 1]);
    expect(pour(rack, 0, 1, goal)[0].seg).toEqual([1, 1]);
  });

  it("refuses the same colour, which the matching rule would have allowed", () => {
    const goal = goalFor(specFor("sort-by-number")!);
    const rack: Rack = [{ cap: 4, seg: [1] }, { cap: 4, seg: [0, 1] }];
    // Under the old rule 1-on-1 was the only legal pour; here it is wrong.
    expect(canPour(rack, 0, 1)).toBe(true);
    expect(canPour(rack, 0, 1, goal)).toBe(false);
    expect(refuseReason(rack, 0, 1, goal)).toMatch(/not what comes next/);
  });

  it("will not build on a bottle that is already out of order", () => {
    const goal = goalFor(specFor("sort-by-number")!);
    // [1,0] is not a prefix of 0,1,2,3 — it can only be emptied.
    const rack: Rack = [{ cap: 4, seg: [2] }, { cap: 4, seg: [1, 0] }];
    expect(canPour(rack, 0, 1, goal)).toBe(false);
    expect(refuseReason(rack, 0, 1, goal)).toBe("That bottle is not in order yet.");
  });

  it("lets a group goal move a whole run, because the slot above wants the same kind", () => {
    const goal = goalFor(specFor("odd-and-even-bottles")!);
    const rack: Rack = [{ cap: 4, seg: [1, 3, 3] }, { cap: 4, seg: [1] }];
    // Two 3s on top, both even-group, both travel.
    expect(pour(rack, 0, 1, goal)[1].seg).toEqual([1, 3, 3]);
  });

  it("refuses to mix the groups, and says why", () => {
    const goal = goalFor(specFor("odd-and-even-bottles")!);
    const rack: Rack = [{ cap: 4, seg: [0] }, { cap: 4, seg: [1] }];
    expect(canPour(rack, 0, 1, goal)).toBe(false);
    expect(refuseReason(rack, 0, 1, goal)).toMatch(/Odd numbers and even numbers/);
  });

  it("never invents or loses liquid, whatever the goal", () => {
    const count = (r: Rack) => r.flatMap((b) => b.seg).sort((a, b) => a - b).join(",");
    ordering.forEach((spec) => {
      const goal = goalFor(spec);
      for (let i = 1; i <= 12; i += 1) {
        const { rack } = buildQuestion({ spec: spec.id, questionsPerRound: 3, seed: "phase5" }, i);
        legalPours(rack, goal).forEach((m) =>
          expect(count(pour(rack, m.from, m.to, goal)), `${spec.id} q${i}`).toBe(count(rack)));
      }
    });
  });
});

describe("the ordering lessons deal playable racks", () => {
  it("deals racks that are unfinished, alive and solvable under their own goal", () => {
    ordering.forEach((spec) => {
      const goal = goalFor(spec);
      for (let i = 1; i <= 25; i += 1) {
        const { rack } = buildQuestion({ spec: spec.id, questionsPerRound: 3, seed: "phase5" }, i);
        expect(isSolvedRack(rack, goal), `${spec.id} q${i} arrived finished`).toBe(false);
        expect(legalPours(rack, goal).length, `${spec.id} q${i} has no move`).toBeGreaterThan(0);
        expect(minimumPours(rack, goal).moves, `${spec.id} q${i} unsolvable`).not.toBeNull();
      }
    });
  });

  it("asks for more than a couple of pours", () => {
    // Scrambling under an ordering goal is cheap to undo unless it is pushed:
    // at the first setting these racks solved in two moves.
    ordering.forEach((spec) => {
      const goal = goalFor(spec);
      const lengths: number[] = [];
      for (let i = 1; i <= 10; i += 1) {
        const { rack } = buildQuestion({ spec: spec.id, questionsPerRound: 3, seed: "phase5" }, i);
        lengths.push(minimumPours(rack, goal).moves ?? 0);
      }
      const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      expect(mean, `${spec.id} solves in ${mean} moves on average`).toBeGreaterThan(3);
    });
  });
});

describe("the ordering lessons on screen", () => {
  it("says the order in the prompt, so the goal is never a guess", () => {
    const q = buildQuestion({ spec: "sort-by-number", questionsPerRound: 1, seed: "phase5" }, 1);
    expect(q.prompt).toBe("Put every bottle in order: 1, 2, 3, 4.");
    expect(buildQuestion({ spec: "sort-backwards", questionsPerRound: 1, seed: "phase5" }, 1).prompt)
      .toBe("Put every bottle in order: 4, 3, 2, 1.");
    expect(buildQuestion({ spec: "count-by-twos", questionsPerRound: 1, seed: "phase5" }, 1).prompt)
      .toBe("Put every bottle in order: 2, 4, 6, 8.");
    expect(buildQuestion({ spec: "sort-by-size", questionsPerRound: 1, seed: "phase5" }, 1).prompt)
      .toBe("Put every bottle in order: 1/3, 1/2, 2/3, 3/4.");
  });

  it("labels the segments with the thing being ordered, not a shape", async () => {
    const h = renderActivity(sort, { params: { spec: "count-by-twos", questionsPerRound: 1, seed: "phase5" } });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    const labels = [...document.querySelectorAll("[data-bottle] text")].map((t) => t.textContent);
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((l) => expect(["2", "4", "6", "8"]).toContain(l));
    // ...and the accessible name reads the same numbers.
    expect(h.screen.getAllByRole("button", { name: /^Bottle 1,/ })[0].getAttribute("aria-label"))
      .toMatch(/holds 4\. (2|4|6|8|Empty)/);
    h.unmount();
  });

  it("keeps the shapes on the lessons that sort by colour", async () => {
    const h = renderActivity(sort, { params: { spec: "four-colours", questionsPerRound: 1, seed: "phase5" } });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    expect(document.querySelectorAll("[data-bottle] text").length).toBe(0);
    expect(h.screen.getAllByRole("button", { name: /^Bottle 1,/ })[0].getAttribute("aria-label"))
      .toMatch(/circle|square|triangle|diamond|cross|bar|Empty/);
    h.unmount();
  });
});
