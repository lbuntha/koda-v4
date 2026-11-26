import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import type { Region } from "../region";
import { skill } from ".";
import { US_ONLY_MODES, forRegion } from "./internal/regionModes";

/**
 * Practice is the same engine with the scaffolding taken away: no hint, no
 * speaker, no voice, and a whole round of mixed modes that ends normally. A
 * practice round only asks what the learner's region taught.
 */
type H = ReturnType<typeof renderActivity>;
const practice = skill.lessons.filter((l) => (l.params as { question: { practice?: boolean } }).question.practice);

const mount = (lesson: (typeof practice)[number], region: Region) => {
  const params = lesson.params as { question: Record<string, unknown>; level: number };
  return renderActivity(skill.activities[lesson.activity.split("/")[1]], {
    skillId: "measurement",
    settings: { praiseMs: 0 },
    region,
    params: { ...params, ...params.question },
    level: params.level,
  });
};

const current = (h: H) => h.koda.only("learning.present").at(-1)!.args[0] as { taskKind: string; expected: string; index: number };

/** Answers the question on screen correctly, by its recorded expected value. */
async function answer(h: H) {
  const { taskKind, expected } = current(h);
  if (taskKind === "capacity_fill") {
    const inJug = () => Number(/(\d+)/.exec(h.screen.getByTestId("in-jug").textContent!)![1]);
    const target = Number(expected);
    const pours = h.buttons().filter((b) => /^Pour (in|out) \d+/.test(b));
    const size = (b: string) => Number(/(\d+)/.exec(b)![1]);
    for (let guard = 0; guard < 60 && inJug() !== target; guard += 1) {
      const dir = inJug() < target ? "in" : "out";
      const gap = Math.abs(target - inJug());
      const fits = pours.filter((b) => b.includes(` ${dir} `) && size(b) <= gap).sort((a, b) => size(b) - size(a));
      await h.press(fits[0]);
    }
    expect(inJug(), "filled to the line").toBe(target);
    await h.press("Done");
  } else {
    const label = h.buttons().find((b) => b === expected || b.toLowerCase() === expected.toLowerCase() || b.startsWith(`${expected} `));
    expect(label, `${taskKind}: no button for ${expected} in ${h.buttons().join(" | ")}`).toBeDefined();
    await h.press(label!);
  }
  await h.settle();
}

describe("Measure It practice", () => {
  it.each(practice.map((l) => [l.id, l] as const))("%s plays a full round of ten, unhelped and silent", async (_id, lesson) => {
    for (const region of ["US", "KH"] as const) {
      const h = mount(lesson, region);
      expect(h.buttons().some((b) => /hint/i.test(b)), "hint").toBe(false);
      expect(h.buttons().some((b) => /read question aloud/i.test(b)), "speaker").toBe(false);
      const kinds = new Set<string>();
      for (let i = 1; i <= 10; i += 1) {
        expect(current(h).index).toBe(i);
        kinds.add(current(h).taskKind.replace(/^[a-z]+_/, ""));
        await answer(h);
      }
      await h.settle(50);
      expect(h.results, `${lesson.id} ${region} finished`).toHaveLength(1);
      expect(h.koda.count("speech.say"), "silent").toBe(0);
      const answered = h.koda.only("learning.answered").map((c) => JSON.stringify(c.args));
      expect(answered.every((a) => a.includes('"correct":true')), `${lesson.id} ${region}`).toBe(true);
      const modes = (forRegion(lesson.params as { question: { modes?: string[] } }, region).question as { modes?: string[] }).modes;
      if (modes) {
        // Every mode the region sees comes up; none it does not.
        for (const m of modes) expect([...kinds], `${lesson.id} ${region} ${m}`).toContain(m);
        if (region !== "US") for (const k of kinds) expect(US_ONLY_MODES.has(k), `${lesson.id} asked ${k} in ${region}`).toBe(false);
      }
      h.unmount();
    }
  }, 60_000);
});

describe("forRegion", () => {
  const p = { question: { modes: ["read", "read_lb", "interval"] } };
  it("drops US-only modes outside the US and keeps them in it", () => {
    expect(forRegion(p, "GB").question.modes).toEqual(["read", "interval"]);
    expect(forRegion(p, "INTL").question.modes).toEqual(["read", "interval"]);
    expect(forRegion(p, "US")).toBe(p);
  });
  it("leaves a teaching lesson's single mode alone", () => {
    const one = { question: { mode: "read_lb" } } as { question: { mode: string; modes?: string[] } };
    expect(forRegion(one, "KH")).toBe(one);
  });
});
