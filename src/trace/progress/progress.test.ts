import { describe, expect, it } from "vitest";
import { CAT, CHA } from "../fixtures/items";
import { myWayScoring, stepSwitches } from "../player/help";
import { aidsFor, coachAttempt, coachStroke, initialCoach } from "./coach";
import type { ItemProgress, StepPlan } from "./ladder";
import { DAY, applyAttempt, defaultPlan, initialProgress, isRecheckDue } from "./ladder";

const plan = defaultPlan(CHA);
const pass = (p: ItemProgress, plan: StepPlan, score = 90, now = 0) => applyAttempt(p, plan, { step: p.step, accepted: true, score }, now);
const fail = (p: ItemProgress, plan: StepPlan, now = 0) => applyAttempt(p, plan, { step: p.step, accepted: false, score: 0 }, now);

function climb(plan: StepPlan, now = 0) {
  let p = initialProgress(0);
  const events: string[] = [];
  for (let i = 0; i < 20 && p.status === "learning"; i++) {
    const r = pass(p, plan, 90, now);
    p = r.progress;
    events.push(`${r.event}`);
  }
  return { p, events };
}

describe("writing steps", () => {
  it("a letter climbs watch → big → guided ×2 → faded → copy → memory, then can write", () => {
    const { p, events } = climb(plan);
    expect(events).toEqual(["up", "up", "stay", "up", "up", "up", "canDo"]);
    expect(p).toMatchObject({ step: "memory", status: "canDo", recheckRound: 0, dueAt: 3 * DAY });
  });

  it("a drawing is done at the faded step — can draw", () => {
    const { p } = climb(defaultPlan(CAT));
    expect(p).toMatchObject({ step: "faded", status: "canDo" });
  });

  it("a score under the bar is not a pass", () => {
    let p = climb(plan).p;
    p = { ...initialProgress(), step: "guided" };
    expect(pass(p, plan, 65).progress.passes).toBe(0);
  });

  it("two fails in a row go back one step — never to watch", () => {
    let p: ItemProgress = { ...initialProgress(), step: "copy" };
    p = fail(p, plan).progress;
    expect(p.step).toBe("copy");
    const r = fail(p, plan);
    expect(r.event).toBe("down");
    expect(r.progress.step).toBe("faded");

    let big: ItemProgress = { ...initialProgress(), step: "big" };
    big = fail(fail(big, plan).progress, plan).progress;
    expect(big.step).toBe("big");
  });

  it("re-checks after 3 days and then 10; passing both means learned", () => {
    let p = climb(plan).p;
    expect(isRecheckDue(p, 2 * DAY)).toBe(false);
    expect(isRecheckDue(p, 3 * DAY)).toBe(true);
    let r = applyAttempt(p, plan, { step: "memory", accepted: true, score: 80 }, 3 * DAY, true);
    expect(r.event).toBe("rechecked");
    expect(r.progress.dueAt).toBe(13 * DAY);
    p = r.progress;
    r = applyAttempt(p, plan, { step: "memory", accepted: true, score: 80 }, 13 * DAY, true);
    expect(r.event).toBe("learned");
    expect(r.progress.status).toBe("learned");
    expect(isRecheckDue(r.progress, 100 * DAY)).toBe(false);
  });

  it("failing a re-check means needs practice, back at copy", () => {
    const p = climb(plan).p;
    const r = applyAttempt(p, plan, { step: "memory", accepted: false, score: 0 }, 3 * DAY, true);
    expect(r.event).toBe("lost");
    expect(r.progress).toMatchObject({ status: "needsPractice", step: "copy" });
    // …and earns it back by climbing again.
    const back = pass(pass(r.progress, plan).progress, plan);
    expect(back.event).toBe("canDo");
  });
});

describe("coach", () => {
  it("the same fault twice on a stroke turns on its help, and 2 good strokes fade it", () => {
    let s = initialCoach();
    s = coachStroke(s, 1, "direction", "line").state;
    expect(aidsFor(s, 1)).toEqual([]);
    s = coachStroke(s, 1, "direction", "line").state;
    expect(aidsFor(s, 1)).toEqual(["arrows"]);
    s = coachStroke(s, 1, null, "line").state;
    expect(aidsFor(s, 1)).toEqual(["arrows"]);
    s = coachStroke(s, 1, null, "line").state;
    expect(aidsFor(s, 1)).toEqual([]);
  });

  it("4 fails on a loop suggests practising the loop; on a line, watching it again", () => {
    let s = initialCoach();
    let last;
    for (let i = 0; i < 4; i++) last = coachStroke(s, 2, "checkpoint", "loop"), (s = last.state);
    expect(last!.suggestion).toEqual({ kind: "drill", order: 2 });
    s = initialCoach();
    for (let i = 0; i < 4; i++) last = coachStroke(s, 1, "start", "line"), (s = last.state);
    expect(last!.suggestion).toEqual({ kind: "watch", order: 1 });
  });

  it("5 failed attempts in a row suggest a rest, never a sixth try", () => {
    let s = initialCoach();
    let r;
    for (let i = 0; i < 5; i++) r = coachAttempt(s, false), (s = r.state);
    expect(r!.suggestion).toEqual({ kind: "rest" });
  });
});

describe("help switches", () => {
  it("guided shows everything; memory shows only the grid", () => {
    expect(Object.values(stepSwitches("guided")).every(Boolean)).toBe(true);
    expect(stepSwitches("memory")).toEqual({ ghost: false, strokes: false, arrows: false, numbers: false, startDot: false, grid: true });
  });

  it("My way counts toward can write only with Ghost and Strokes off", () => {
    expect(myWayScoring({ ...stepSwitches("guided") })).toEqual({ step: "guided", counts: false });
    expect(myWayScoring({ ...stepSwitches("memory"), arrows: true, numbers: true })).toEqual({ step: "memory", counts: true });
    expect(myWayScoring({ ...stepSwitches("memory"), ghost: true })).toEqual({ step: "faded", counts: false });
  });
});
