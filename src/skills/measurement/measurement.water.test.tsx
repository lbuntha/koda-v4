import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { forgetHowToPlay, markHowToPlaySeen } from "../kit";
import { skill } from ".";

/*
 * BalanceBeam and PourLab, driven by tapping. Answers come from the screen —
 * which way the beam tipped, how many cups filled, where the water stands —
 * never from the question object.
 */

const balance = skill.activities.balance;
const capacity = skill.activities.capacity;
const opts = { settings: { praiseMs: 0 }, skillId: "measurement" };
type H = ReturnType<typeof renderActivity>;
const p = (mode: string, extra: Record<string, unknown> = {}) => ({ question: { mode, questionsPerRound: 1, ...extra } });
const answered = (h: H) => h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));
const angleOf = (h: H) => Number(h.screen.getByTestId("balance").getAttribute("data-angle"));

beforeEach(() => {
  for (const id of ["balance", "pour", "jug"]) markHowToPlaySeen(`measurement/${id}`);
});
afterEach(() => forgetHowToPlay());

describe("BalanceBeam: heavier or lighter", () => {
  it("refuses an answer before weighing, then the beam decides", async () => {
    for (let run = 0; run < 8; run += 1) {
      const h = renderActivity(balance, { ...opts, params: p("compare") });
      const [left, right] = h.buttons().filter((b) => /^The /.test(b));
      await h.press(left);
      expect(answered(h)).toHaveLength(0);
      expect(h.text()).toMatch(/Put them on the balance first/);
      expect(angleOf(h)).toBe(0);
      await h.press("Put them on the balance");
      const heavier = angleOf(h) > 0 ? right : left;
      const lighter = heavier === left ? right : left;
      const wantHeavier = /Which is heavier/.test(h.text());
      await h.press(wantHeavier ? heavier : lighter);
      await h.settle();
      expect(answered(h)[0], `run ${run}`).toContain('"correct":true');
      h.unmount();
    }
  });

  it("calls the side that went up heavier a wrong answer", async () => {
    const h = renderActivity(balance, { ...opts, params: p("compare") });
    const [left, right] = h.buttons().filter((b) => /^The /.test(b));
    await h.press("Put them on the balance");
    const wantHeavier = /Which is heavier/.test(h.text());
    const up = angleOf(h) > 0 ? left : right;
    const down = up === left ? right : left;
    await h.press(wantHeavier ? up : down);
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":false');
    h.unmount();
  });
});

describe("BalanceBeam: balance with cubes", () => {
  it("adds cubes until level; the count balances", async () => {
    for (let run = 0; run < 5; run += 1) {
      const h = renderActivity(balance, { ...opts, params: p("cubes") });
      expect(angleOf(h)).toBeLessThan(0);
      let guard = 0;
      while (angleOf(h) !== 0 && guard++ < 15) await h.press("Add a cube");
      expect(h.text()).toMatch(/The beam is level/);
      await h.press("It balances");
      await h.settle();
      expect(answered(h)[0], `run ${run}`).toContain('"correct":true');
      h.unmount();
    }
  });

  it("one cube too many tips the other way and is wrong if submitted", async () => {
    const h = renderActivity(balance, { ...opts, params: p("cubes") });
    while (angleOf(h) < 0) await h.press("Add a cube");
    await h.press("Add a cube");
    expect(angleOf(h)).toBeGreaterThan(0);
    expect(h.text()).toMatch(/Take a cube off/);
    await h.press("It balances");
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":false');
    h.unmount();
  });

  it("start over takes the cubes off without an answer", async () => {
    const h = renderActivity(balance, { ...opts, params: p("cubes") });
    await h.press("Add a cube");
    await h.press(/start over/i);
    expect(h.text()).toMatch(/0 cubes on the balance/);
    expect(answered(h)).toHaveLength(0);
    h.unmount();
  });
});

describe("PourLab: which holds more", () => {
  it("needs both poured, then the one with more cups wins", async () => {
    for (let run = 0; run < 8; run += 1) {
      const h = renderActivity(capacity, { ...opts, params: p("pour") });
      const choices = h.buttons().filter((b) => /^The /.test(b));
      await h.press(choices[0]);
      expect(answered(h)).toHaveLength(0);
      expect(h.text()).toMatch(/Pour both into cups first/);
      for (const b of h.buttons().filter((x) => /into cups$/.test(x))) await h.press(b);
      const full = [0, 1].map((i) => Number(h.screen.getByTestId(`cups-${i}`).getAttribute("data-full")));
      expect(full[0]).not.toBe(full[1]);
      await h.press(choices[full[0] > full[1] ? 0 : 1]);
      await h.settle();
      expect(answered(h)[0], `run ${run}`).toContain('"correct":true');
      h.unmount();
    }
  });
});

describe("PourLab: how many cups", () => {
  it("counts the full cups after pouring", async () => {
    const h = renderActivity(capacity, { ...opts, params: p("cups") });
    await h.press(h.buttons().find((b) => /into cups$/.test(b))!);
    const n = h.screen.getByTestId("cups-0").getAttribute("data-full")!;
    await h.press(n);
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":true');
    h.unmount();
  });
});

describe("PourLab: the measuring jug", () => {
  it.each([100, 50, 25])("reads the water on a jug marked every %i", async (step) => {
    for (let run = 0; run < 4; run += 1) {
      const h = renderActivity(capacity, { ...opts, params: p("jug", { step, labelEvery: 100 }) });
      const ml = h.screen.getByTestId("jug").getAttribute("data-ml")!;
      expect(Number(ml) % step).toBe(0);
      const options = h.buttons().filter((b) => /^\d+ ml$/.test(b));
      expect(options).toHaveLength(4);
      await h.press(`${ml} ml`);
      await h.settle();
      expect(answered(h)[0]).toContain('"correct":true');
      h.unmount();
    }
  });

  it("writes mL in the US and ml elsewhere", () => {
    const us = renderActivity(capacity, { ...opts, region: "US", params: p("jug") });
    expect(us.buttons().filter((b) => /^\d+ mL$/.test(b))).toHaveLength(4);
    us.unmount();
    const kh = renderActivity(capacity, { ...opts, region: "KH", params: p("jug") });
    expect(kh.buttons().filter((b) => /^\d+ ml$/.test(b))).toHaveLength(4);
    kh.unmount();
  });

  it("fills to the line by pouring in and out", async () => {
    const h = renderActivity(capacity, { ...opts, params: p("fill", { step: 50, labelEvery: 100 }) });
    const target = Number(/the line: (\d+) ml/.exec(h.text())![1]);
    const inJug = () => Number(/(\d+) ml in the jug/.exec(h.screen.getByTestId("in-jug").textContent!)![1]);
    while (inJug() < target) await h.press("Pour in 100 ml");
    if (inJug() > target) await h.press("Pour out 50 ml");
    expect(inJug()).toBe(target);
    await h.press("Done");
    await h.settle();
    expect(answered(h)[0]).toContain('"correct":true');
    h.unmount();
  });
});

describe("PourLab: US cups, pints, quarts and gallons", () => {
  it("answers how many and which holds more", async () => {
    const cups: Record<string, number> = { cup: 1, pint: 2, quart: 4, gallon: 16 };
    for (let run = 0; run < 12; run += 1) {
      const h = renderActivity(capacity, { ...opts, region: "US", params: p("customary") });
      const many = /How many (cups|pints|quarts) fill 1 (pint|quart|gallon)/.exec(h.text());
      if (many) {
        await h.press(String(cups[many[2]] / cups[many[1].slice(0, -1)]));
      } else {
        const which = /Which holds more, a (\w+) or a (\w+)\?/.exec(h.text())!;
        const big = cups[which[1]] > cups[which[2]] ? which[1] : which[2];
        await h.press(big[0].toUpperCase() + big.slice(1));
      }
      await h.settle();
      expect(answered(h)[0], h.text().slice(0, 80)).toContain('"correct":true');
      h.unmount();
    }
  });
});

describe("Measure It switches on the new engines", () => {
  it("sound_chimes off plays no pour sounds", async () => {
    for (const enabled of [true, false]) {
      const h = renderActivity(capacity, { ...opts, params: p("pour"), features: { sound_chimes: enabled } });
      await h.press(h.buttons().find((b) => /into cups$/.test(b))!);
      expect(h.koda.count("sound.play") > 0).toBe(enabled);
      h.unmount();
    }
  });
});

describe("How to play on the new engines", () => {
  beforeEach(() => forgetHowToPlay());

  it("opens the balance, pour and jug demos the first time; customary has none", () => {
    const cases: [typeof balance, string, string][] = [
      [balance, "compare", "balance-demo"],
      [capacity, "pour", "pour-demo"],
      [capacity, "jug", "jug-demo"],
    ];
    for (const [engine, mode, id] of cases) {
      const h = renderActivity(engine, { ...opts, params: p(mode) });
      expect(h.screen.getByTestId(id), mode).toBeTruthy();
      h.unmount();
    }
    const us = renderActivity(capacity, { ...opts, params: p("customary") });
    expect(us.screen.queryByRole("button", { name: "How to play" })).toBeNull();
    us.unmount();
  });
});

describe("water is drawn where it is", () => {
  it("sets the water's real y in each vessel and cup, inside an unmoving clip", async () => {
    markHowToPlaySeen("measurement/pour");
    const h = renderActivity(capacity, { ...opts, params: p("pour") });
    await h.press(h.buttons().find((b) => /into cups$/.test(b))!);
    const rects = [...h.screen.getByTestId("cups-0").querySelectorAll("rect[data-level]")];
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) {
      expect(Number(r.getAttribute("y"))).toBeCloseTo(Number(r.getAttribute("data-level")), 1);
      expect(r.getAttribute("clip-path")).toBeNull();
      expect(r.parentElement!.getAttribute("clip-path")).toMatch(/^url\(#v/);
    }
    h.unmount();
  });
});

describe("PourLab never prints the answer", () => {
  it("after pouring, says to count the cups but not how many", async () => {
    for (let run = 0; run < 5; run += 1) {
      const h = renderActivity(capacity, { ...opts, params: p("cups") });
      const pourBtn = h.buttons().find((b) => /into cups$/.test(b))!;
      await h.press(pourBtn);
      const line = h.text();
      expect(line).toMatch(/Count the cups the \w+ filled\./);
      expect(line).not.toMatch(/filled \d+ cups/);
      h.unmount();
    }
  });
});
