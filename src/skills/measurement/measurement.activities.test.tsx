import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { forgetHowToPlay, markHowToPlaySeen } from "../kit";
import { skill } from ".";
import type { CompareMode } from "./internal/compare";

/*
 * CompareBench driven the way a child drives it: by tapping. Every right answer
 * is worked out from what is drawn (the widths and heights on screen), never
 * from the question object, so a mismatch between drawing and key would fail.
 */

const bench = skill.activities.compare;
const settings = { praiseMs: 0 };
const opts = { settings, skillId: "measurement" };
type H = ReturnType<typeof renderActivity>;

const paramsFor = (mode: CompareMode, extra: Record<string, unknown> = {}) => ({ question: { mode, questionsPerRound: 1, ...extra } });

/** The pieces a child can tap on the bench, with their drawn size in spaces (out of 20). */
function pieces(h: H, dimension: "width" | "height" = "width") {
  return h.screen
    .getByTestId("compare-bench")
    .querySelectorAll<HTMLElement>("button[aria-label]")
    .values()
    .toArray()
    .filter((el) => el.style[dimension].endsWith("%"))
    .map((el) => ({ el, name: el.getAttribute("aria-label")!, size: parseFloat(el.style[dimension]) }));
}

const askOf = (h: H) => (/shorter/.test(h.text().split("Tap it")[0]) ? "small" : "big");
const pickBy = <T extends { size: number }>(list: T[], want: "big" | "small") =>
  [...list].sort((a, b) => (want === "big" ? b.size - a.size : a.size - b.size))[0];

const answered = (h: H) => h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));

beforeEach(() => {
  markHowToPlaySeen("measurement/compare");
  markHowToPlaySeen("measurement/order");
});
afterEach(() => forgetHowToPlay());

describe("CompareBench: longer and taller", () => {
  it.each([["pick", "width"], ["pick_vertical", "height"]] as const)("%s: tapping the right one is one right answer", async (mode, dim) => {
    for (let run = 0; run < 6; run += 1) {
      const h = renderActivity(bench, { ...opts, params: paramsFor(mode) });
      const target = pickBy(pieces(h, dim), askOf(h));
      fireEvent.click(target.el);
      await h.settle();
      expect(answered(h), `${mode} run ${run}`).toHaveLength(1);
      expect(answered(h)[0]).toContain('"correct":true');
      h.unmount();
    }
  });

  it("tapping the wrong one is a wrong answer", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("pick") });
    const wrong = pickBy(pieces(h), askOf(h) === "big" ? "small" : "big");
    fireEvent.click(wrong.el);
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":false');
    expect(h.text()).toMatch(/Look at the ends again/);
    h.unmount();
  });

  it("marks where each one ends on the second hint", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("pick") });
    expect(h.screen.queryAllByTestId("end-mark")).toHaveLength(0);
    await h.press(/hint/i);
    expect(h.screen.queryAllByTestId("end-mark")).toHaveLength(0);
    await h.press("More help");
    expect(h.screen.queryAllByTestId("end-mark")).toHaveLength(2);
    h.unmount();
  });
});

describe("CompareBench: line them up", () => {
  it("refuses an answer before lining up, without counting it", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("align") });
    await h.press(/^The /);
    expect(answered(h)).toHaveLength(0);
    expect(h.text()).toMatch(/Line them up at the start line first/);
    h.unmount();
  });

  it("moves the late one to the start line, then takes the really longer one", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("align") });
    const before = pieces(h);
    const late = before.find((p) => parseFloat(p.el.style.left) > 0)!;
    // The late one sticks out further: by eye, it looks longer, and it is not.
    const longest = pickBy(before, "big");
    expect(late.name).not.toBe(longest.name);
    fireEvent.click(late.el);
    expect(h.text()).toMatch(/Now tap the start line/);
    fireEvent.click(h.screen.getByRole("button", { name: /^Start line\. Tap to move/ }));
    expect(h.text()).toMatch(/They both start at the line now/);
    expect(h.screen.getByRole("button", { name: /start over/i })).toBeTruthy();
    await h.press(longest.name.replace(" on the bench. Tap to pick it up.", ""));
    await h.settle();
    expect(answered(h)).toHaveLength(1);
    expect(answered(h)[0]).toContain('"correct":true');
    h.unmount();
  });

  it("start over puts it back where it began, without an answer", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("align") });
    const late = pieces(h).find((p) => parseFloat(p.el.style.left) > 0)!;
    fireEvent.click(late.el);
    fireEvent.click(h.screen.getByRole("button", { name: /^Start line\. Tap to move/ }));
    await h.press(/start over/i);
    expect(h.screen.queryByRole("button", { name: /start over/i })).toBeNull();
    expect(answered(h)).toHaveLength(0);
    h.unmount();
  });
});

describe("CompareBench: shortest to longest", () => {
  it("fills the spaces in the order tapped, and checks once", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("order") });
    await h.press("Check");
    expect(answered(h)).toHaveLength(0);
    expect(h.text()).toMatch(/Put all three in the spaces first/);
    for (const piece of [...pieces(h)].sort((a, b) => a.size - b.size)) {
      const live = pieces(h).find((p) => p.name === piece.name && /next space/.test(p.name))!;
      fireEvent.click(live.el);
    }
    await h.press("Check");
    await h.settle();
    expect(answered(h)).toHaveLength(1);
    expect(answered(h)[0]).toContain('"correct":true');
    h.unmount();
  });

  it("takes a piece back out when its space is tapped", () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("order") });
    fireEvent.click(pieces(h)[0].el);
    const placed = pieces(h).find((p) => /Tap to take it out/.test(p.name))!;
    fireEvent.click(placed.el);
    expect(pieces(h).filter((p) => /next space/.test(p.name))).toHaveLength(3);
    h.unmount();
  });

  it("a wrong order is one wrong answer", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("order") });
    for (const piece of [...pieces(h)].sort((a, b) => b.size - a.size)) {
      fireEvent.click(pieces(h).find((p) => p.name === piece.name)!.el);
    }
    await h.press("Check");
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":false');
    h.unmount();
  });
});

describe("CompareBench: with a string", () => {
  it("needs the string measured and carried before an answer", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("indirect") });
    const carry = h.screen.getByRole("button", { name: /^Take the string to/ }) as HTMLButtonElement;
    expect(carry.disabled).toBe(true);
    const answers = h.buttons().filter((b) => /^The (door|bookcase|window|cupboard)$/.test(b));
    expect(answers).toHaveLength(2);
    await h.press(answers[0]);
    expect(answered(h)).toHaveLength(0);
    expect(h.text()).toMatch(/Use the string first/);

    await h.press(/^Hold the string up to/);
    expect(h.screen.getAllByTestId("string")).toHaveLength(1);
    await h.press(/^Take the string to/);
    // The string stands beside the second thing at the first one's height.
    const string = h.screen.getByTestId("string");
    expect(string).toBeTruthy();
    h.unmount();
  });

  it("answers from what the string shows", async () => {
    for (let run = 0; run < 6; run += 1) {
      const h = renderActivity(bench, { ...opts, params: paramsFor("indirect") });
      const [first, second] = h.screen.getByTestId("compare-bench").querySelectorAll<HTMLElement>(":scope > div > div.flex.w-20");
      const a = parseFloat(first.style.height);
      const b = parseFloat(second.style.height);
      const names = h.buttons().filter((x) => /^The (door|bookcase|window|cupboard)$/.test(x));
      const taller = /taller/.test(h.text().split("?")[0]);
      const wantFirst = taller ? a > b : a < b;
      await h.press(/^Hold the string up to/);
      await h.press(/^Take the string to/);
      await h.press(names[wantFirst ? 0 : 1]);
      await h.settle();
      expect(answered(h)[0], `run ${run}`).toContain('"correct":true');
      h.unmount();
    }
  });
});

describe("CompareBench: what can we measure", () => {
  it("takes the tool that fits the question", async () => {
    const tools: Record<string, string> = { longer: "Ruler", shorter: "Ruler", heavier: "Balance scale", lighter: "Balance scale", "holds more": "Measuring jug" };
    for (let run = 0; run < 8; run += 1) {
      const h = renderActivity(bench, { ...opts, params: paramsFor("attribute") });
      const ask = Object.keys(tools).find((k) => h.text().includes(`Which is ${k},`))!;
      await h.press(tools[ask]);
      await h.settle();
      expect(answered(h)[0], ask).toContain('"correct":true');
      h.unmount();
    }
  });
});

describe("CompareBench switches", () => {
  it("sound_chimes off plays no sounds", async () => {
    for (const enabled of [true, false]) {
      const h = renderActivity(bench, { ...opts, params: paramsFor("pick"), features: { sound_chimes: enabled } });
      fireEvent.click(pieces(h)[0].el);
      await h.settle();
      expect(h.koda.count("sound.play") > 0).toBe(enabled);
      h.unmount();
    }
  });

  it("haptic_feedback off gives no vibration", async () => {
    for (const enabled of [true, false]) {
      const h = renderActivity(bench, { ...opts, params: paramsFor("pick"), features: { haptic_feedback: enabled } });
      fireEvent.click(pieces(h)[0].el);
      await h.settle();
      expect(h.koda.count("haptics.success") + h.koda.count("haptics.pulse") > 0).toBe(enabled);
      h.unmount();
    }
  });

  it("audio_speech off takes away read-aloud and the spoken demo", async () => {
    forgetHowToPlay();
    for (const enabled of [true, false]) {
      const h = renderActivity(bench, { ...opts, params: paramsFor("pick"), features: { audio_speech: enabled } });
      expect(h.screen.queryAllByRole("button", { name: /read/i }).length > 0, `read-aloud ${enabled}`).toBe(enabled);
      await h.settle(50);
      expect(h.koda.count("speech.say") > 0, `speech ${enabled}`).toBe(enabled);
      h.unmount();
      forgetHowToPlay();
    }
  });
});

describe("CompareBench How to play", () => {
  beforeEach(() => forgetHowToPlay());

  it("opens by itself for a comparing lesson, once", async () => {
    const h = renderActivity(bench, { ...opts, params: paramsFor("align") });
    expect(h.screen.getByTestId("compare-demo")).toBeTruthy();
    await h.press("Skip");
    h.unmount();
    const again = renderActivity(bench, { ...opts, params: paramsFor("pick") });
    expect(again.screen.queryByTestId("compare-demo")).toBeNull();
    await again.press("How to play");
    expect(again.screen.getByTestId("compare-demo")).toBeTruthy();
    again.unmount();
  });

  it("shows the ordering demo for ordering, and no demo for the tool or string lessons", () => {
    const order = renderActivity(bench, { ...opts, params: paramsFor("order") });
    expect(order.screen.getByTestId("order-demo")).toBeTruthy();
    order.unmount();
    for (const mode of ["attribute", "indirect"] as const) {
      const h = renderActivity(bench, { ...opts, params: paramsFor(mode) });
      expect(h.screen.queryByTestId("compare-demo")).toBeNull();
      expect(h.screen.queryByRole("button", { name: "How to play" })).toBeNull();
      h.unmount();
    }
  });
});
