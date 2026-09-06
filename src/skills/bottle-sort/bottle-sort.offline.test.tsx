import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { aimPour, streamPath } from "./internal/bottle";
import { isSolvedRack, legalPours, pour } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import { RACK_SPECS } from "./internal/specs";
import type { Rack } from "./internal/types";

/**
 * Phase 8: integration, device and offline.
 *
 * The skill is offline-first because the children it is for do not have
 * reliable internet — so the bar is not "degrades politely" but "plays". It
 * fetches nothing itself; what has to hold is that nothing it *does* call
 * reaches for the network on a path a round waits on, and that a round which
 * has already been played once can be played again with the network gone.
 */
const sort = skill.activities.sort;
const params = { spec: "sort-three-colours", questionsPerRound: 1, seed: "phase8" };

/** Plays a rack out along the solver's own line. */
const solve = (h: ReturnType<typeof renderActivity>, start: Rack) => {
  let rack = start;
  for (let guard = 0; guard < 40 && !isSolvedRack(rack); guard += 1) {
    const best = legalPours(rack)
      .map((m) => ({ m, after: pour(rack, m.from, m.to) }))
      .filter(({ after }) => minimumPours(after).moves !== null)
      .sort((a, b) => (minimumPours(a.after).moves ?? 99) - (minimumPours(b.after).moves ?? 99))[0];
    if (!best) break;
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${best.m.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${best.m.to + 1},`) }));
    rack = best.after;
  }
  return rack;
};

describe("with the network gone", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("plays a second round after the first, with every request failing", async () => {
    // Round one, online.
    const first = renderActivity(sort, { params });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    expect(isSolvedRack(solve(first, buildQuestion(params, 1).rack))).toBe(true);
    await waitFor(() => expect(first.koda.count("learning.answered")).toBe(1));
    first.unmount();

    // The network goes. Anything that reaches for it now throws.
    const offline = vi.fn(() => Promise.reject(new Error("offline")));
    vi.stubGlobal("fetch", offline);

    const second = renderActivity(sort, { params: { ...params, seed: "phase8-b" } });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));
    const finished = solve(second, buildQuestion({ ...params, seed: "phase8-b" }, 1).rack);
    expect(finished.every((b) => b.seg.length === 0 || new Set(b.seg).size === 1)).toBe(true);
    await waitFor(() => expect(second.koda.count("learning.answered")).toBe(1));
    // The round never needed the network in the first place.
    expect(offline).not.toHaveBeenCalled();
    second.unmount();
  }, 20000);

  it("deals every lesson's first rack without a network", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    // Generation is pure and seeded, so a rack owes nothing to a server. This
    // is what lets a child open a lesson on a train.
    RACK_SPECS.forEach((spec) => {
      const q = buildQuestion({ spec: spec.id, questionsPerRound: 3, seed: "offline" }, 1);
      expect(q.rack.length, spec.id).toBe(spec.bottles);
    });
  });

  it("plays on while a line of speech never finishes", async () => {
    // The unstable-internet failure is not a request that fails, it is one that
    // hangs. `holdSpeech` leaves every `say()` pending, which is what a round
    // must not wait on: the refusal has to appear and the rack has to stay
    // playable while the sentence is still somewhere on the wire.
    const question = buildQuestion(params, 1);
    const legal = legalPours(question.rack);
    const refused = question.rack
      .flatMap((_, a) => question.rack.map((__, b) => ({ from: a, to: b })))
      .find((m) => m.from !== m.to && question.rack[m.from].seg.length > 0
        && !legal.some((l) => l.from === m.from && l.to === m.to))!;

    const h = renderActivity(sort, { params, holdSpeech: true });
    await waitFor(() => expect(document.querySelectorAll("[data-bottle]").length).toBeGreaterThan(0));

    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${refused.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${refused.to + 1},`) }));
    await waitFor(() => expect(h.koda.count("speech.say")).toBeGreaterThan(0));

    // The refusal is on screen even though nothing has been said yet...
    await waitFor(() => expect(h.screen.getByText(/Not yet/)).toBeTruthy());
    // ...and a real pour still lands, with the speech still hanging.
    const move = legal[0];
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
    fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
    const after = pour(question.rack, move.from, move.to);
    await waitFor(() => expect(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) })
      .getAttribute("aria-label")).toContain(after[move.to].seg.length === 0 ? "Empty" : "holds"));
    h.unmount();
  });
});

describe("on a phone, where the rack wraps", () => {
  /** Two rows: six bottles across, the rest below. */
  const row = (i: number, cols = 6) => ({
    left: 20 + (i % cols) * 56, top: 100 + Math.floor(i / cols) * 150, width: 48, height: 130,
  });
  const mouthOf = (i: number, cols = 6) => {
    const b = row(i, cols);
    return { left: b.left + b.width / 2 - 1, top: b.top + 6, width: 2, height: 2 };
  };

  it("aims the lip over the receiving mouth even when the bottles are on different rows", () => {
    // Eight bottles is the mixed rack, and six across is the phone ceiling —
    // so bottles 6 and 7 sit on a second row and a pour between rows is not a
    // corner case, it is most of that lesson.
    for (const [from, to] of [[0, 6], [6, 0], [7, 1], [2, 7]]) {
      const dir = to >= from ? 1 : -1;
      const aim = aimPour(row(from), mouthOf(from), mouthOf(to), dir as 1 | -1);
      const target = mouthOf(to);
      const landed = aim.lipAfter;
      const mouth = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
      expect(Math.abs(landed.x - mouth.x), `${from}->${to} drifted sideways`).toBeLessThan(22);
      expect(landed.y, `${from}->${to} did not clear the mouth`).toBeLessThan(mouth.y);
    }
  });

  it("draws a stream that starts at the lip and ends in the mouth, across rows", () => {
    const lip = { x: 100, y: 260 };
    const target = { x: 48, y: 118 };
    // Pouring upward into a bottle on the row above: the arc still has to begin
    // at the lip and finish at the mouth, whatever direction it travels.
    const { d } = streamPath(lip, target);
    const pts = d.replace(/^M/, "").replace(/Z$/, "").split(/ ?L/).map((p) => {
      const [x, y] = p.trim().split(" ").map(Number);
      return { x, y };
    });
    expect(Math.hypot(pts[0].x - lip.x, pts[0].y - lip.y)).toBeLessThan(6);
    const mid = pts[(pts.length - 1) / 2 | 0];
    expect(Math.hypot(mid.x - target.x, mid.y - target.y)).toBeLessThan(6);
  });

  it("keeps every rack inside the six-across phone ceiling, or on two tidy rows", () => {
    RACK_SPECS.forEach((spec) => {
      // Nothing is so wide that a bottle drops under the 44px touch target:
      // seven or eight bottles wrap to a second row rather than shrinking.
      expect(spec.bottles, `${spec.id} deals too many bottles`).toBeLessThanOrEqual(8);
    });
  });
});
