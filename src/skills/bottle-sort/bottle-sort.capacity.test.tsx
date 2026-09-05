import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { buildQuestion } from "./activities/BottleSort";
import { legalPours, pour, refuseReason } from "./internal/pour";
import { minimumPours } from "./internal/solve";
import { topRun, type Rack } from "./internal/types";
import { rackFor } from "./internal/racks";
import { specFor } from "./internal/specs";


const sort = skill.activities.sort;
const isDone = (r: Rack) => r.every((b) => b.seg.length === 0 || (b.seg.length === b.cap && new Set(b.seg).size === 1));

describe("capacity", () => {
  it("deals bottles of different heights in one rack", () => {
    const spec = specFor("short-and-tall")!;
    for (let i = 1; i <= 20; i += 1) {
      const caps = new Set(rackFor(spec, "caps", i).rack.map((b) => b.cap));
      expect(caps.size, `q${i} dealt only one height`).toBeGreaterThan(1);
    }
  });

  it("refuses a colour-matching pour when the room runs out", () => {
    // Matching tops, but the destination cannot take the whole run.
    const tight: Rack = [{ cap: 4, seg: [0, 1, 1, 1] }, { cap: 3, seg: [1, 1, 1] }];
    expect(refuseReason(tight, 0, 1)).toBe("That bottle is full.");

    // Matching tops with room takes as much as fits, and no more.
    const partial: Rack = [{ cap: 4, seg: [0, 1, 1, 1] }, { cap: 4, seg: [1, 1, 1] }];
    expect(refuseReason(partial, 0, 1)).toBeNull();
    const after = pour(partial, 0, 1);
    expect(after[1].seg).toHaveLength(4);
    expect(after[0].seg).toEqual([0, 1, 1]);
  });

  it("counts a bottle finished only when it is full, not merely tidy", () => {
    const spec = specFor("fill-to-the-top")!;
    const { rack } = rackFor(spec, "exact", 1);
    // A bottle holding one colour but short of the top is not done.
    const tidy: Rack = [{ cap: 5, seg: [2, 2, 2] }];
    expect(isDone(tidy)).toBe(false);
    expect(isDone([{ cap: 3, seg: [2, 2, 2] }])).toBe(true);
    expect(rack.length).toBeGreaterThan(0);
  });

  it("tells a screen reader how tall every bottle is", () => {
    const params = { spec: "short-and-tall", questionsPerRound: 1, seed: "labels" };
    const h = renderActivity(sort, { params });
    const labels = h.buttons().filter((n) => n.startsWith("Bottle "));
    labels.forEach((n) => expect(n).toMatch(/holds \d/));
    expect(new Set(labels.map((n) => n.match(/holds (\d)/)![1])).size).toBeGreaterThan(1);
    h.unmount();
  });
});

describe("counting the run", () => {
  it("shows how many will pour, only where the lesson asks", () => {
    const params = { spec: "count-before-you-pour", questionsPerRound: 1, seed: "run", showRunCount: true };
    const q = buildQuestion(params, 1);
    const from = legalPours(q.rack)[0].from;

    const on = renderActivity(sort, { params });
    fireEvent.click(on.screen.getByRole("button", { name: new RegExp(`^Bottle ${from + 1},`) }));
    const badge = document.querySelector("[data-run-count]");
    expect(badge?.getAttribute("data-run-count")).toBe(String(topRun(q.rack[from]).n));
    // And it is in the accessible name, not only drawn.
    expect(on.screen.getByRole("button", { name: new RegExp(`^Bottle ${from + 1},`) }).getAttribute("aria-label")).toMatch(/will pour/);
    on.unmount();

    const off = renderActivity(sort, { params: { spec: "count-before-you-pour", questionsPerRound: 1, seed: "run" } });
    fireEvent.click(off.screen.getByRole("button", { name: new RegExp(`^Bottle ${from + 1},`) }));
    expect(document.querySelector("[data-run-count]")).toBeNull();
    off.unmount();
  });
});

describe("practice", () => {
  const practice = { specs: ["use-the-empty-bottle", "sort-three-colours", "short-and-tall", "will-it-fit"], questionsPerRound: 5, practice: true, seed: "pace" };

  it("draws its five racks from across the taught techniques", () => {
    const kinds = new Set(Array.from({ length: 5 }, (_, i) => buildQuestion(practice, i + 1).taskKind));
    expect(kinds.size).toBeGreaterThan(2);
  });

  it("offers no hints and speaks no opening", () => {
    const h = renderActivity(sort, { params: practice });
    expect(h.buttons().some((n) => /hint/i.test(n))).toBe(false);
    expect(h.buttons().some((n) => /read .*aloud/i.test(n))).toBe(false);
    expect(h.koda.count("speech.say")).toBe(0);
    h.unmount();
  });

  it("still scores a solved rack, so pace has something to measure", () => {
    const q = buildQuestion({ ...practice, questionsPerRound: 1 }, 1);
    const h = renderActivity(sort, { params: { ...practice, questionsPerRound: 1 }, settings: { praiseMs: 0 } });
    let rack: Rack = q.rack;
    for (let guard = 0; guard < 40 && !isDone(rack); guard += 1) {
      // Follow the solver, not the first legal pour: a greedy walk goes in
      // circles and would leave the round unanswered for the wrong reason.
      const move = legalPours(rack)
        .map((m) => ({ m, after: pour(rack, m.from, m.to) }))
        .filter(({ after }) => minimumPours(after).moves !== null)
        .sort((a, b) => (minimumPours(a.after).moves ?? 99) - (minimumPours(b.after).moves ?? 99))[0]?.m;
      if (!move) break;
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.from + 1},`) }));
      fireEvent.click(h.screen.getByRole("button", { name: new RegExp(`^Bottle ${move.to + 1},`) }));
      rack = pour(rack, move.from, move.to);
    }
    expect(h.koda.count("learning.answered")).toBeGreaterThan(0);
    h.unmount();
  });
});
