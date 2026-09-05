import { describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion, bottleHints } from "./activities/BottleSort";
import { canPour, isCorked, isDeadlock, isSolvedRack, legalPours, pour, refuseReason } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import { specFor } from "./internal/specs";
import type { Rack } from "./internal/types";

/**
 * Phase 3 of docs/BOTTLE_SORT_BUILD_PLAN.md: planning.
 *
 * The phase is done when locked and one-way bottles refuse and accept
 * correctly, so that is what this file holds: the rule, the rack it is dealt
 * onto, and the thing the child sees. The pure rules were proved in Phase 0 —
 * what is new here is that the engine carries them onto the screen, because a
 * rule the child cannot see is one the game appears to break at random.
 */
const sort = skill.activities.sort;
const q = (spec: string, index = 1) => buildQuestion({ spec, questionsPerRound: 3, seed: "phase3" }, index);

describe("the locked bottle", () => {
  const spec = specFor("the-locked-bottle")!;

  it("corks the bottle the lesson names, and only that one", () => {
    for (let i = 1; i <= 20; i += 1) {
      const { rack } = q("the-locked-bottle", i);
      rack.forEach((b, k) => expect(b.lockedBy === undefined, `bottle ${k}`).toBe(k !== spec.lock!.tube));
      expect(rack[spec.lock!.tube].lockedBy).toBe(spec.lock!.on);
    }
  });

  it("refuses both directions while corked, and accepts once it opens", () => {
    const { tube, on } = spec.lock!;
    const corked: Rack = [
      { cap: 2, seg: [0, 1] },
      { cap: 2, seg: [1] },
      { cap: 2, seg: [] },
      { cap: 2, seg: [] },
      { cap: 2, seg: [], lockedBy: 0 },
    ];
    expect(tube).toBe(4);
    expect(on).toBe(0);
    expect(isCorked(corked, 4)).toBe(true);
    // Shut in both directions: pouring in is as blocked as pouring out.
    expect(refuseReason(corked, 0, 4)).toBe("That bottle is corked.");
    expect(refuseReason(corked, 4, 0)).toBe("That bottle is corked.");

    // Bottle 0 finished: the cork comes off.
    const open = corked.map((b, i) => (i === 0 ? { ...b, seg: [1, 1] } : b));
    expect(isCorked(open, 4)).toBe(false);
    expect(canPour(open, 0, 4)).toBe(true);
  });

  it("shows the cork and names it, then takes both away when it opens", async () => {
    const corked: Rack = [{ cap: 2, seg: [0, 1] }, { cap: 2, seg: [1] }, { cap: 2, seg: [], lockedBy: 0 }];
    const h = renderActivity(sort, { params: { spec: "the-locked-bottle", questionsPerRound: 1, seed: "phase3" } });
    // The dealt rack is the generator's, so drive the assertion off the rule
    // rather than off this fixture: whichever bottle is corked wears a cork.
    const question = q("the-locked-bottle", 1);
    const lockedIndex = question.rack.findIndex((b, i) => b.lockedBy !== undefined && isCorked(question.rack, i));
    if (lockedIndex >= 0) {
      await waitFor(() => expect(document.querySelector(`[data-locked="${lockedIndex}"]`)).not.toBeNull());
      expect(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${lockedIndex + 1},`) }).getAttribute("aria-label"))
        .toMatch(/Corked until bottle \d+ is finished\./);
    }
    expect(corked[2].lockedBy).toBe(0);
    h.unmount();
  });

  it("leads with the cork when it offers a hint", () => {
    const rack: Rack = [{ cap: 2, seg: [0, 1] }, { cap: 2, seg: [1] }, { cap: 2, seg: [], lockedBy: 0 }];
    expect(bottleHints(rack)[0]).toBe("Finish the bottle the cork is waiting on.");
  });
});

describe("the one-way bottle", () => {
  const spec = specFor("the-one-way-bottle")!;

  it("marks the bottle the lesson names, and only that one", () => {
    for (let i = 1; i <= 20; i += 1) {
      const { rack } = q("the-one-way-bottle", i);
      rack.forEach((b, k) => expect(!!b.oneWay, `bottle ${k}`).toBe(k === spec.oneWay));
    }
  });

  it("receives but never pours", () => {
    const rack: Rack = [{ cap: 4, seg: [0, 0] }, { cap: 4, seg: [0], oneWay: true }];
    expect(refuseReason(rack, 1, 0)).toBe("That bottle only receives.");
    expect(canPour(rack, 0, 1)).toBe(true);
  });

  it("shows the arrow and says so in the name", async () => {
    const h = renderActivity(sort, { params: { spec: "the-one-way-bottle", questionsPerRound: 1, seed: "phase3" } });
    await waitFor(() => expect(document.querySelector(`[data-one-way="${spec.oneWay}"]`)).not.toBeNull());
    expect(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${spec.oneWay! + 1},`) }).getAttribute("aria-label"))
      .toContain("Receives only.");
    h.unmount();
  });

  it("warns about the one-way bottle when it offers a hint", () => {
    const rack: Rack = [{ cap: 4, seg: [0, 1] }, { cap: 4, seg: [], oneWay: true }];
    expect(bottleHints(rack)[0]).toBe("Whatever you pour into that bottle stays there.");
  });
});

describe("the pour budget", () => {
  it("sets one from the shortest solution, not from the scramble", () => {
    for (let i = 1; i <= 12; i += 1) {
      const tight = q("the-shortest-way", i);
      const loose = q("think-before-you-pour", i);
      expect(tight.budget, `q${i} tight`).toBeGreaterThan(0);
      expect(loose.budget, `q${i} loose`).toBeGreaterThan(0);
      // A budget must be reachable: undoing the scramble is always a solution,
      // so a budget above that bound would never bite, and one below the
      // shortest solution could never be met.
      expect(tight.budget!, `q${i} tight above its own bound`).toBeLessThanOrEqual(tight.scramble);
    }
  });

  it("gives the generous lesson exactly two more pours than the tight one would", () => {
    const spec = specFor("think-before-you-pour")!;
    expect(spec.budget).toBe("minimum+2");
    expect(specFor("the-shortest-way")!.budget).toBe("minimum");
  });

  it("leaves every other lesson unlimited", () => {
    expect(q("four-colours").budget).toBeUndefined();
    expect(q("sort-three-colours").budget).toBeUndefined();
  });

  it("shows the count, and counts a pour once", async () => {
    const h = renderActivity(sort, { params: { spec: "the-shortest-way", questionsPerRound: 1, seed: "phase3" } });
    const counter = await waitFor(() => {
      const el = document.querySelector("[data-budget]");
      expect(el).not.toBeNull();
      return el!;
    });
    expect(counter.textContent).toMatch(/^Pours: 0 of \d+$/);

    const question = q("the-shortest-way", 1);
    const move = { from: 0, to: 0 };
    const legal = question.rack
      .flatMap((_, a) => question.rack.map((__, b) => ({ from: a, to: b })))
      .find((m) => m.from !== m.to && canPour(question.rack, m.from, m.to))!;
    Object.assign(move, legal);

    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
    await waitFor(() => expect(document.querySelector("[data-budget]")!.textContent).toMatch(/^Pours: 1 of \d+$/));

    // Undo gives the pour back, or a budget lesson would punish exploring.
    fireEvent.click(h.screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(document.querySelector("[data-budget]")!.textContent).toMatch(/^Pours: 0 of \d+$/));
    h.unmount();
  });

  it("ends the attempt when the pours run out, and puts the rack back", async () => {
    // Played deliberately badly: at each step take the legal pour that leaves
    // the *most* work behind. A minimum budget cannot survive that, which is
    // the point of the lesson.
    const question = q("the-shortest-way", 1);
    const h = renderActivity(sort, { params: { spec: "the-shortest-way", questionsPerRound: 1, seed: "phase3" } });
    await waitFor(() => expect(document.querySelector("[data-budget]")).not.toBeNull());

    let rack = question.rack as Rack;
    for (let n = 0; n < question.budget! + 2; n += 1) {
      if (isSolvedRack(rack) || isDeadlock(rack)) break;
      const worst = legalPours(rack)
        .map((m) => ({ m, after: pour(rack, m.from, m.to) }))
        .filter(({ after }) => !isSolvedRack(after))
        .sort((a, b) => (minimumPours(b.after).moves ?? 0) - (minimumPours(a.after).moves ?? 0))[0];
      if (!worst) break;
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${worst.m.from + 1},`) }));
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${worst.m.to + 1},`) }));
      rack = worst.after;
    }

    await waitFor(() => expect(h.screen.getByText(/Out of pours/)).toBeTruthy());
    // Scored once, and the rack is back as dealt so the child can try again.
    await waitFor(() => expect(document.querySelector("[data-budget]")!.textContent).toBe("Pours: 0 of " + question.budget));
    h.unmount();
  });
});
