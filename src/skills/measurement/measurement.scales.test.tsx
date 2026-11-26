import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { forgetHowToPlay, markHowToPlaySeen } from "../kit";
import { skill } from ".";
import { halfText, lbOz } from "./internal/scale";
import { degText } from "./internal/thermo";
import { buildCapacityQuestion } from "./activities/PourLab";
import { ESTIMATE_THINGS } from "./internal/estimate";

/* DialScale, Thermometer, MeasureStory and the Stage 4 JSON lessons, driven by tapping. */
const { scale, thermo, story, estimate } = skill.activities;
const opts = { settings: { praiseMs: 0 }, skillId: "measurement" };
type H = ReturnType<typeof renderActivity>;
const p = (mode: string, extra: Record<string, unknown> = {}) => ({ question: { mode, questionsPerRound: 1, ...extra } });
const answered = (h: H) => h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));
const num = (h: H, id: string, a: string) => Number(h.screen.getByTestId(id).getAttribute(a));

beforeEach(() => {
  for (const id of ["scale", "thermo", "story", "estimate"]) markHowToPlaySeen(`measurement/${id}`);
});
afterEach(() => forgetHowToPlay());

async function pressAndCheck(h: H, label: string, what: string) {
  expect(h.buttons(), `${what}: ${label}`).toContain(label);
  await h.press(label);
  await h.settle();
  expect(answered(h)[0], what).toContain('"correct":true');
  h.unmount();
}

describe("DialScale", () => {
  it.each([
    ["read", (v: number) => `${v} g`],
    ["interval", (v: number) => `${v} g`],
    ["read_kg", (v: number) => `${halfText(v)} kg`],
    ["read_lb", (v: number) => lbOz(v)],
  ] as const)("reads the needle in %s", async (mode, say) => {
    for (let run = 0; run < 5; run += 1) {
      const h = renderActivity(scale, { ...opts, params: p(mode) });
      await pressAndCheck(h, say(num(h, "dial", "data-value")), `${mode} run ${run}`);
    }
  });

  it("arcs from the number before the needle on the second hint", async () => {
    const h = renderActivity(scale, { ...opts, params: p("interval") });
    await h.press(/hint/i);
    expect(h.screen.queryByTestId("dial-arc")).toBeNull();
    await h.press("More help");
    expect(h.screen.getByTestId("dial-arc")).toBeTruthy();
    h.unmount();
  });
});

describe("Thermometer", () => {
  it.each(["read", "negative", "read_f"] as const)("reads the top of the line in %s", async (mode) => {
    for (let run = 0; run < 5; run += 1) {
      const h = renderActivity(thermo, { ...opts, params: p(mode) });
      const unit = mode === "read_f" ? "F" : "C";
      await pressAndCheck(h, `${degText(num(h, "thermometer", "data-value"))} °${unit}`, `${mode} run ${run}`);
    }
  });

  it("works out a change across zero, and offers the wrong way round", async () => {
    for (let run = 0; run < 6; run += 1) {
      const h = renderActivity(thermo, { ...opts, params: p("change") });
      const m = /was (−?\d+) °C\. It got (\d+) degrees (warmer|colder)/.exec(h.text())!;
      const start = Number(m[1].replace("−", "-"));
      const want = m[3] === "warmer" ? start + Number(m[2]) : start - Number(m[2]);
      await pressAndCheck(h, `${degText(want)} °C`, m[0]);
    }
  });

  it("rings the number below the line on the second hint", async () => {
    const h = renderActivity(thermo, { ...opts, params: p("read") });
    await h.press(/hint/i);
    await h.press("More help");
    expect(h.screen.getByTestId("thermo-ring")).toBeTruthy();
    h.unmount();
  });
});

describe("MeasureStory", () => {
  it("solves the story, in the region's unit symbols", async () => {
    for (let run = 0; run < 8; run += 1) {
      const h = renderActivity(story, { ...opts, params: p("same_unit") });
      const m = /(\d+) (cm|g|ml)\b.*?(\d+) (?:cm|g|ml)\b/.exec(h.text())!;
      const [a, b] = [Number(m[1]), Number(m[3])];
      const join = /more\. How much juice|You add|weigh now|tall is it now/.test(h.text()) && !/How much more/.test(h.text());
      await pressAndCheck(h, `${join ? a + b : a - b} ${m[2]}`, m[0]);
    }
  });

  it("shows the bar model on the second hint, with the unknown as ?", async () => {
    const h = renderActivity(story, { ...opts, params: p("same_unit") });
    await h.press(/hint/i);
    await h.press("More help");
    expect(h.screen.getByTestId("bar-model").textContent).toContain("?");
    h.unmount();
  });

  it("writes mL for US learners", () => {
    let sawMl = false;
    for (let run = 0; run < 20 && !sawMl; run += 1) {
      const h = renderActivity(story, { ...opts, region: "US", params: p("same_unit") });
      if (/\d+ mL\b/.test(h.text())) sawMl = true;
      expect(h.text()).not.toMatch(/\d+ ml\b/);
      h.unmount();
    }
    expect(sawMl).toBe(true);
  });
});

describe("g or kg, ml or l", () => {
  it("offers one quantity's units and takes the right one", async () => {
    for (let run = 0; run < 10; run += 1) {
      const h = renderActivity(estimate, { ...opts, params: p("choose_unit", { quantity: "mass_capacity" }) });
      const thing = h.screen.getByTestId("estimate-thing").getAttribute("data-thing")! as keyof typeof ESTIMATE_THINGS;
      const unit = ESTIMATE_THINGS[thing].unit;
      const shown = unit === "mL" ? "ml" : unit === "L" ? "l" : unit;
      const units = h.buttons().filter((b) => /^(g|kg|ml|l|cm|m|km)$/.test(b));
      expect(units).toHaveLength(2);
      await pressAndCheck(h, shown, `${thing} in ${shown}`);
    }
  });
});

describe("the jug lessons step down", () => {
  it("reads 100s, then 50s, then 25s over a round", () => {
    const lesson = skill.lessons.find((l) => l.id === "read-the-jug")!;
    const steps = [1, 2, 3, 4, 5].map((i) => buildCapacityQuestion(lesson.params as never, i).q.step);
    expect(steps).toEqual([100, 100, 50, 50, 25]);
  });
});

describe("Stage 4 How to play", () => {
  beforeEach(() => forgetHowToPlay());
  it("opens the scale, thermometer and story demos", () => {
    for (const [engine, mode, id] of [[scale, "read", "scale-demo"], [thermo, "read", "thermo-demo"], [story, "same_unit", "story-demo"]] as const) {
      const h = renderActivity(engine, { ...opts, params: p(mode) });
      expect(h.screen.getByTestId(id)).toBeTruthy();
      h.unmount();
    }
    const below = renderActivity(thermo, { ...opts, params: p("negative") });
    expect(below.screen.queryByTestId("thermo-demo")).toBeNull();
    below.unmount();
  });
});
