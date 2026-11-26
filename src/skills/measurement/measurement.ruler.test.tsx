import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { forgetHowToPlay, markHowToPlaySeen } from "../kit";
import { skill } from ".";
import { quartersText } from "./internal/ruler";

/* RulerDesk and EstimateCards driven by tapping; answers read from what is drawn. */
const ruler = skill.activities.ruler;
const estimate = skill.activities.estimate;
const opts = { settings: { praiseMs: 0 }, skillId: "measurement" };
type H = ReturnType<typeof renderActivity>;
const p = (mode: string) => ({ question: { mode, questionsPerRound: 1 } });
const answered = (h: H) => h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));
const attr = (h: H, id: string, a: string) => Number(h.screen.getByTestId(id).getAttribute(a));
/** The length a child reads: end number minus start number, from what is drawn. */
const drawnLength = (h: H, sub: number, id = "thing") => attr(h, id, "data-steps") / sub;

beforeEach(() => {
  for (const id of ["ruler-read", "ruler-place", "ruler-draw", "estimate"]) markHowToPlaySeen(`measurement/${id}`);
});
afterEach(() => forgetHowToPlay());

async function answerRight(mode: string, read: (h: H) => string) {
  for (let run = 0; run < 6; run += 1) {
    const h = renderActivity(ruler, { ...opts, params: p(mode) });
    const want = read(h);
    expect(h.buttons(), `${mode}: ${want}`).toContain(want);
    await h.press(want);
    await h.settle();
    expect(answered(h)[0], `${mode} run ${run}`).toContain('"correct":true');
    h.unmount();
  }
}

describe("RulerDesk reading", () => {
  it("reads cm from 0", () => answerRight("read", (h) => `${drawnLength(h, 2)} cm`));
  it("reads whole inches, and says 12 in = 1 ft", async () => {
    const h = renderActivity(ruler, { ...opts, params: p("read_inch") });
    expect(h.text()).toContain("12 in = 1 ft");
    h.unmount();
    await answerRight("read_inch", (h) => `${drawnLength(h, 4)} in`);
  });
  it("reads quarter inches through the zoom lens", () =>
    answerRight("read_inch_fraction", (h) => {
      expect(h.screen.getByTestId("zoom")).toBeTruthy();
      return `${quartersText(attr(h, "thing", "data-steps"))} in`;
    }));
  it("reads mm through the zoom lens on the centimetre where it ends", () =>
    answerRight("read_mm", (h) => {
      const mm = attr(h, "thing", "data-steps");
      expect(attr(h, "zoom", "data-from")).toBe(mm % 10 ? Math.floor(mm / 10) : mm / 10 - 1);
      return `${mm} mm`;
    }));
  it("counts spaces on a broken ruler, and offers the end number as a trap", () =>
    answerRight("offset", (h) => {
      const len = drawnLength(h, 2);
      const start = attr(h, "ruler", "data-start");
      expect(start).toBeGreaterThan(0);
      expect(h.buttons()).toContain(`${start + len} cm`);
      return `${len} cm`;
    }));
  it("finds how much longer", () =>
    answerRight("difference", (h) => `${drawnLength(h, 2) - drawnLength(h, 2, "other")} cm`));
});

describe("RulerDesk placing", () => {
  it("refuses the edge and other marks; reads only once the thing is on 0", async () => {
    const h = renderActivity(ruler, { ...opts, params: p("place") });
    const len = drawnLength(h, 2);
    expect(attr(h, "thing", "data-from")).toBeGreaterThan(0);
    await h.press(`${len} cm`);
    expect(answered(h)).toHaveLength(0);
    expect(h.text()).toMatch(/Move the \w+ to the 0 first/);
    await h.press("Mark 0");
    expect(h.text()).toMatch(/Pick up the \w+ first/);
    await h.press(/^Pick up the/);
    await h.press("Edge of the ruler");
    expect(h.text()).toContain("That is the edge of the ruler. Start at 0.");
    await h.press("Mark 1");
    expect(h.text()).toContain("Start at 0, not at 1.");
    await h.press("Mark 0");
    expect(attr(h, "thing", "data-from")).toBe(0);
    await h.press(`${len} cm`);
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":true');
    h.unmount();
  });
});

describe("RulerDesk drawing and number lines", () => {
  it("draws from 0 to the tapped mark; Done before drawing is refused", async () => {
    for (let run = 0; run < 4; run += 1) {
      const h = renderActivity(ruler, { ...opts, params: p("draw") });
      const n = Number(/a line (\d+) cm long/.exec(h.text())![1]);
      await h.press("Done");
      expect(answered(h)).toHaveLength(0);
      await h.press(`Mark ${n}`);
      expect(h.screen.getByTestId("drawn").getAttribute("data-to")).toBe(String(n));
      await h.press("Done");
      await h.settle();
      expect(answered(h)[0]).toContain('"correct":true');
      h.unmount();
    }
  });

  it("lands on the right mark after adding or cutting", async () => {
    for (let run = 0; run < 6; run += 1) {
      const h = renderActivity(ruler, { ...opts, params: p("numberline") });
      const m = /is (\d+) cm long\. You (add|cut) (\d+) cm/.exec(h.text())!;
      const want = m[2] === "add" ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
      await h.press("Check");
      expect(answered(h)).toHaveLength(0);
      await h.press(`Mark ${want}`);
      await h.press("Check");
      await h.settle();
      expect(answered(h)[0], m[0]).toContain('"correct":true');
      h.unmount();
    }
  });

  it("shows the green spaces and rings 0 on the second hint", async () => {
    const h = renderActivity(ruler, { ...opts, params: p("read") });
    await h.press(/hint/i);
    expect(h.screen.queryByTestId("green")).toBeNull();
    await h.press("More help");
    expect(h.screen.getByTestId("green")).toBeTruthy();
    h.unmount();
  });
});

describe("EstimateCards", () => {
  const SIZE: Record<string, [number, string]> = {
    key: [6, "cm"], pencil: [15, "cm"], phone: [15, "cm"], book: [25, "cm"], scissors: [13, "cm"],
    door: [2, "m"], bed: [2, "m"], car: [4, "m"], bus: [12, "m"], tree: [10, "m"],
    walk: [2, "km"], town: [20, "km"], train: [300, "km"],
  };
  const thingOf = (h: H) => h.screen.getByTestId("estimate-thing").getAttribute("data-thing")!;

  it("picks the unit a school would use", async () => {
    for (let run = 0; run < 8; run += 1) {
      const h = renderActivity(estimate, { ...opts, params: p("choose_unit") });
      expect(h.buttons()).toEqual(expect.arrayContaining(["cm", "m", "km"]));
      await h.press(SIZE[thingOf(h)][1]);
      await h.settle();
      expect(answered(h)[0]).toContain('"correct":true');
      h.unmount();
    }
  });

  it("picks the real size over one ten times off", async () => {
    for (let run = 0; run < 8; run += 1) {
      const h = renderActivity(estimate, { ...opts, params: p("benchmark") });
      const [n, u] = SIZE[thingOf(h)];
      await h.press(`About ${n} ${u}`);
      await h.settle();
      expect(answered(h)[0]).toContain('"correct":true');
      h.unmount();
    }
  });

  it("shows what 1 cm, 1 m and 1 km are like on the second hint", async () => {
    const h = renderActivity(estimate, { ...opts, params: p("choose_unit") });
    await h.press(/hint/i);
    await h.press("More help");
    expect(h.screen.getByTestId("benchmarks").textContent).toMatch(/1 cm.*1 m.*1 km/);
    h.unmount();
  });
});

describe("Ruler and estimate How to play", () => {
  beforeEach(() => forgetHowToPlay());
  it("opens the read, place, draw and door demos on their first lessons only", () => {
    for (const mode of ["read", "place", "draw"]) {
      const h = renderActivity(ruler, { ...opts, params: p(mode) });
      expect(h.screen.getByTestId("ruler-demo"), mode).toBeTruthy();
      h.unmount();
    }
    const off = renderActivity(ruler, { ...opts, params: p("offset") });
    expect(off.screen.queryByTestId("ruler-demo")).toBeNull();
    off.unmount();
    const est = renderActivity(estimate, { ...opts, params: p("benchmark") });
    expect(est.screen.getByTestId("estimate-demo")).toBeTruthy();
    est.unmount();
  });
});
