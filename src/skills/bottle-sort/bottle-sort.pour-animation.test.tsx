import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { legalPours, pour, pourSteps } from "./internal/pour";
import { RACK_SPECS } from "./internal/specs";
import { rackFor } from "./internal/racks";
import type { Rack } from "./internal/types";

const sort = skill.activities.sort;
const params = { spec: "sort-three-colours", questionsPerRound: 1, seed: "anim" };
const label = (r: Rack) => r.map((b) => b.seg.join("")).join("|");

/** jsdom asks for reduced motion, so the animated path needs saying so. */
const allowMotion = () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
};

afterEach(() => vi.unstubAllGlobals());

describe("the pour, step by step", () => {
  it("ends exactly where a single pour would, every time", () => {
    // The animation is presentation. If its last frame ever differed from the
    // rule's result, the drawing would be deciding the game.
    RACK_SPECS.slice(0, 12).forEach((spec) => {
      for (let i = 1; i <= 6; i += 1) {
        const { rack } = rackFor(spec, "steps", i);
        legalPours(rack).forEach((m) => {
          const steps = pourSteps(rack, m.from, m.to);
          expect(steps.length, `${spec.id} ${m.from}->${m.to}`).toBeGreaterThan(0);
          expect(label(steps[steps.length - 1])).toBe(label(pour(rack, m.from, m.to)));
        });
      }
    });
  });

  it("moves one segment per step, so a run of three reads as three", () => {
    const start: Rack = [{ cap: 4, seg: [0, 1, 1, 1] }, { cap: 4, seg: [1] }];
    const steps = pourSteps(start, 0, 1);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s[1].seg.length)).toEqual([2, 3, 4]);
  });

  it("produces nothing for a pour the rules refuse", () => {
    expect(pourSteps([{ cap: 4, seg: [0] }, { cap: 4, seg: [1] }], 0, 1)).toEqual([]);
  });
});

describe("the pouring animation", () => {
  it("tilts the bottle and draws a stream between the two mouths", async () => {
    allowMotion();
    const q = buildQuestion(params, 1);
    const move = legalPours(q.rack)[0];
    const h = renderActivity(sort, { params });

    // Every bottle carries the marker the stream is anchored to.
    expect(document.querySelectorAll("[data-mouth]").length).toBe(q.rack.length);

    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));

    await waitFor(() => expect(document.querySelector("[data-pouring]")).not.toBeNull());
    await waitFor(() => expect(document.querySelector("[data-stream]")).not.toBeNull(), { timeout: 2000 });
    // ...and it clears itself up afterwards.
    await waitFor(() => expect(document.querySelector("[data-stream]")).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(document.querySelector("[data-pouring]")).toBeNull(), { timeout: 3000 });
    h.unmount();
  }, 20000);

  it("lands the same rack whether it animates or not", async () => {
    const q = buildQuestion(params, 1);
    const move = legalPours(q.rack)[0];
    const expected = pour(q.rack, move.from, move.to);
    const play = async (h: ReturnType<typeof renderActivity>) => {
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
      await waitFor(() => expect(
        h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }).getAttribute("aria-label"),
      ).toMatch(new RegExp(`(${expected[move.to].seg.length} )?`)), { timeout: 3000 });
      return h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }).getAttribute("aria-label");
    };

    allowMotion();
    const animated = renderActivity(sort, { params });
    fireEvent.click(animated.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
    fireEvent.click(animated.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
    await waitFor(() => expect(document.querySelector("[data-pouring]")).toBeNull(), { timeout: 4000 });
    const withMotion = animated.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }).getAttribute("aria-label");
    animated.unmount();
    vi.unstubAllGlobals();

    const instant = renderActivity(sort, { params, features: { pour_animation: false } });
    const withoutMotion = await play(instant);
    instant.unmount();

    expect(withMotion).toBe(withoutMotion);
  }, 20000);

  it("ignores taps while liquid is in the air", async () => {
    allowMotion();
    const q = buildQuestion(params, 1);
    const move = legalPours(q.rack)[0];
    const h = renderActivity(sort, { params });
    const btn = (n: number) => h.screen.getByRole("button", { name: new RegExp(`^Bottle ${n},`) });

    fireEvent.click(btn(move.from + 1));
    fireEvent.click(btn(move.to + 1));
    await waitFor(() => expect(document.querySelector("[data-pouring]")).not.toBeNull());
    // A tap mid-pour must not pick anything up.
    fireEvent.click(btn(move.from + 1));
    expect(btn(move.from + 1).getAttribute("data-picked")).toBe("false");
    await waitFor(() => expect(document.querySelector("[data-pouring]")).toBeNull(), { timeout: 4000 });
    h.unmount();
  }, 20000);
});
