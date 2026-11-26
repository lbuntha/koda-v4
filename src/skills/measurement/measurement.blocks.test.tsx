import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { forgetHowToPlay, markHowToPlaySeen } from "../kit";
import { skill } from ".";

/* UnitTrack driven by tapping; answers read from what is drawn. */
const units = skill.activities.units;
const opts = { settings: { praiseMs: 0 }, skillId: "measurement" };
type H = ReturnType<typeof renderActivity>;
const p = (mode: string) => ({ question: { mode, questionsPerRound: 1 } });
const answered = (h: H) => h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));
const lengthOf = (h: H) => Number(h.screen.getByTestId("track-thing").getAttribute("data-length"));

beforeEach(() => markHowToPlaySeen("measurement/units"));
afterEach(() => forgetHowToPlay());

describe("UnitTrack: lay blocks", () => {
  it("never prints the count: counting is the lesson", async () => {
    const h = renderActivity(units, { ...opts, params: p("lay") });
    await h.press("Lay a block");
    await h.press("Lay a block");
    expect(h.text()).not.toMatch(/2 blocks/);
    h.unmount();
  });

  it("refuses an answer until the thing is exactly covered, then takes the count", async () => {
    for (let run = 0; run < 5; run += 1) {
      const h = renderActivity(units, { ...opts, params: p("lay") });
      const n = lengthOf(h);
      const options = h.buttons().filter((b) => /^\d+$/.test(b));
      expect(options).toContain(String(n));
      await h.press(String(n));
      expect(answered(h)).toHaveLength(0);
      expect(h.text()).toMatch(/until the \w+ is covered/);
      for (let i = 0; i < n + 1; i += 1) await h.press("Lay a block");
      await h.press(String(n));
      expect(answered(h)).toHaveLength(0);
      expect(h.text()).toMatch(/go past the end/);
      await h.press("Take a block off");
      expect(h.screen.getByTestId("laid").getAttribute("data-count")).toBe(String(n));
      await h.press(String(n));
      await h.settle();
      expect(answered(h)[0], `run ${run}`).toContain('"correct":true');
      h.unmount();
    }
  });

  it("shows where the next block goes on the second hint", async () => {
    const h = renderActivity(units, { ...opts, params: p("lay") });
    await h.press(/hint/i);
    expect(h.screen.queryByTestId("next-ghost")).toBeNull();
    await h.press("More help");
    expect(h.screen.getByTestId("next-ghost")).toBeTruthy();
    h.unmount();
  });
});

describe("UnitTrack: spot the mistake", () => {
  it("the row without a gap or overlap is right; then its count", async () => {
    for (let run = 0; run < 6; run += 1) {
      const h = renderActivity(units, { ...opts, params: p("spot") });
      const n = lengthOf(h);
      const counts = [0, 1].map((i) => Number(h.screen.getByTestId(`row-${i}`).getAttribute("data-count")));
      const good = counts.indexOf(n);
      expect(good).toBeGreaterThanOrEqual(0);
      await h.press(`Row ${good + 1}`);
      expect(answered(h)).toHaveLength(0);
      await h.press(String(n));
      await h.settle();
      expect(answered(h)[0], `run ${run}`).toContain('"correct":true');
      h.unmount();
    }
  });

  it("picking the flawed row is a wrong answer, and the hint marks the flaw", async () => {
    const h = renderActivity(units, { ...opts, params: p("spot") });
    const n = lengthOf(h);
    await h.press(/hint/i);
    await h.press("More help");
    expect(h.screen.getAllByTestId("flaw").length).toBeGreaterThan(0);
    const bad = [0, 1].find((i) => Number(h.screen.getByTestId(`row-${i}`).getAttribute("data-count")) !== n)!;
    await h.press(`Row ${bad + 1}`);
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":false');
    h.unmount();
  });
});

describe("UnitTrack: cubes or rods", () => {
  it("the row with more pieces answers 'more'", async () => {
    for (let run = 0; run < 6; run += 1) {
      const h = renderActivity(units, { ...opts, params: p("unit_size") });
      const cubes = Number(h.screen.getByTestId("cubes").getAttribute("data-count"));
      const rods = Number(h.screen.getByTestId("rods").getAttribute("data-count"));
      expect(cubes).toBeGreaterThan(rods);
      const more = /needs more/.test(h.text());
      await h.press(more ? "Cubes" : "Rods");
      await h.settle();
      expect(answered(h)[0], `run ${run}`).toContain('"correct":true');
      h.unmount();
    }
  });
});

describe("UnitTrack How to play", () => {
  beforeEach(() => forgetHowToPlay());
  it("opens for laying blocks only", () => {
    const lay = renderActivity(units, { ...opts, params: p("lay") });
    expect(lay.screen.getByTestId("units-demo")).toBeTruthy();
    lay.unmount();
    const spot = renderActivity(units, { ...opts, params: p("spot") });
    expect(spot.screen.queryByTestId("units-demo")).toBeNull();
    spot.unmount();
  });
});
