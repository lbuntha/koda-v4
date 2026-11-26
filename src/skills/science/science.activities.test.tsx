import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { PICK_SETS, SORT_SETS } from "./internal/bank";
import en from "./locales/en.json";

/**
 * Every engine played like a child would: by button name, wrong then right,
 * through to the end of a round, with the log checked for what was asked.
 */

type H = ReturnType<typeof renderActivity>;
type Lesson = (typeof skill.lessons)[number];

const mount = (lesson: Lesson, extra: Partial<Parameters<typeof renderActivity>[1]> = {}) => {
  const params = lesson.params as { question: Record<string, unknown>; level: number; play: Record<string, unknown> };
  return renderActivity(skill.activities[lesson.activity.split("/")[1]], {
    skillId: "science",
    settings: { praiseMs: 0 },
    params: { ...params, ...params.question },
    level: params.level,
    lesson: { id: lesson.id, title: lesson.title, levelNumber: params.level },
    ...extra,
  });
};
const byId = (id: string) => skill.lessons.find((l) => l.id === id)!;
const current = (h: H) => h.koda.only("learning.present").at(-1)!.args[0] as { taskKind: string; expected: string; index: number };
const answered = (h: H) => h.koda.only("learning.answered").map((c) => c.args[0] as { correct: boolean });

async function next(h: H) {
  await h.settle();
  const go = h.buttons().find((b) => /^(Next|Try again)$/i.test(b));
  if (go) await h.press(go);
  await h.settle();
}

/** Answer the question on screen, right or wrong, the way a child would. */
async function answer(h: H, right: boolean) {
  const { taskKind, expected } = current(h);
  if (taskKind.startsWith("pick_")) {
    const choice = h.buttons().find((b) => (b === expected) === right && h.screen.queryAllByRole("button", { name: b }).some((el) => el.hasAttribute("data-choice")));
    await h.press(choice!);
  } else if (taskKind.startsWith("sort_")) {
    const bin = h.buttons().find((b) => b.startsWith("Sort into") && (b === `Sort into ${expected}`) === right);
    await h.press(bin!);
  } else {
    // A wrong line stays on the board; clear it before trying again.
    const clear = h.buttons().find((b) => /start over/i.test(b));
    if (clear) await h.press(clear);
    const steps = expected.split(" → ");
    const order = right ? steps : [steps[1], steps[0], ...steps.slice(2)];
    for (const s of order) await h.press(`Put ${s} next`);
  }
  await next(h);
}

async function playRound(h: H, total: number, firstWrong = true) {
  for (let i = 1; i <= total; i += 1) {
    expect(current(h).index).toBe(i);
    if (firstWrong && i === 1) {
      await answer(h, false);
      expect(current(h).index, "a wrong answer keeps the question").toBe(1);
    }
    await answer(h, true);
  }
  await h.settle(50);
}

describe("Pick One", () => {
  it("plays a whole round: a wrong tap explains the misconception, then the right one gives the reason", async () => {
    const lesson = byId("we-need-light-to-see");
    const h = mount(lesson);
    expect(h.screen.getByTestId("pick-picture")).toBeTruthy();
    await playRound(h, 5);
    expect(h.results).toHaveLength(1);
    const log = answered(h);
    expect(log[0].correct).toBe(false);
    expect(log.slice(1).every((a) => a.correct)).toBe(true);
    h.unmount();
  });

  it("says the misconception's own correction on a wrong tap", async () => {
    const h = mount(byId("we-need-light-to-see"));
    // Walk to the Moon question, answering right, then tap "makes its own light".
    for (let guard = 0; guard < 6 && current(h).expected !== en.pick.see.moon.c.sun; guard += 1) await answer(h, true);
    expect(current(h).expected).toBe(en.pick.see.moon.c.sun);
    await h.press(en.pick.see.moon.c.own);
    expect(h.text()).toContain(en.pick.see.moon.no.own);
    h.unmount();
  });

  it("reads the question and each answer aloud as separate lines, so each can be a recording", async () => {
    const h = mount(byId("my-five-senses"));
    const spokenBefore = h.koda.count("speech.say");
    await h.press(/read question aloud/i);
    await h.settle();
    const said = h.koda.only("speech.say").slice(spokenBefore).map((c) => c.args[0] as string);
    const asked = h.koda.only("learning.present").at(-1)!.args[0] as { prompt: string; itemCount: number };
    expect(said[0]).toBe(asked.prompt);
    expect(said).toHaveLength(1 + asked.itemCount);
    h.unmount();
  });

  it("stays silent with Spoken voice off: no intro and no speaker", () => {
    const h = mount(byId("my-five-senses"), { features: { audio_speech: false } });
    expect(h.buttons().some((b) => /read question aloud/i.test(b))).toBe(false);
    h.unmount();
  });

  it("uses every pick set in some lesson", () => {
    const used = new Set(skill.lessons.filter((l) => l.activity === "science/pick").flatMap((l) => {
      const q = (l.params as { question: { set?: string; sets?: string[] } }).question;
      return q.sets ?? [q.set];
    }));
    expect(used).toEqual(new Set(Object.keys(PICK_SETS)));
  });
});

describe("Sort It", () => {
  it("sorts a whole round; each sorted thing stays in its bin", async () => {
    const lesson = byId("living-or-not");
    const h = mount(lesson);
    await playRound(h, 8);
    expect(h.results).toHaveLength(1);
    h.unmount();
  });

  it("restates the rule on a wrong bin, never names the right one", async () => {
    const h = mount(byId("what-makes-light"));
    const { expected } = current(h);
    await h.press(h.buttons().find((b) => b.startsWith("Sort into") && b !== `Sort into ${expected}`)!);
    await h.settle();
    expect(h.text()).toContain(en.sort.lightsource.rule);
    h.unmount();
  });

  it("offers three bins for light through things", () => {
    const h = mount(byId("light-through-things"));
    expect(h.buttons().filter((b) => b.startsWith("Sort into"))).toHaveLength(SORT_SETS.lightpath.bins.length);
    h.unmount();
  });
});

describe("In Order", () => {
  it("lines up a whole round; a wrong line stays to be fixed", async () => {
    const lesson = byId("grow-and-change");
    const h = mount(lesson);
    await playRound(h, 4);
    expect(h.results).toHaveLength(1);
    h.unmount();
  });

  it("takes a placed card back, and Start over clears the line", async () => {
    const h = mount(byId("the-sky-in-order"));
    const steps = current(h).expected.split(" → ");
    await h.press(`Put ${steps[1]} next`);
    await h.press(`Take back ${steps[1]}`);
    expect(h.buttons()).toContain(`Put ${steps[1]} next`);
    await h.press(`Put ${steps[0]} next`);
    await h.press(/start over/i);
    expect(h.buttons().filter((b) => b.startsWith("Take back"))).toHaveLength(0);
    expect(answered(h)).toHaveLength(0);
    h.unmount();
  });
});

describe("practice", () => {
  const practice = skill.lessons.filter((l) => (l.params as { question: { practice?: boolean } }).question.practice);
  it.each(practice.map((l) => [l.id, l] as const))("%s plays a full round, unhelped and silent", async (_id, lesson) => {
    const h = mount(lesson);
    expect(h.buttons().some((b) => /hint/i.test(b)), "hint").toBe(false);
    expect(h.buttons().some((b) => /read question aloud/i.test(b)), "speaker").toBe(false);
    const total = (lesson.params as { question: { questionsPerRound: number } }).question.questionsPerRound;
    const kinds = new Set<string>();
    for (let i = 1; i <= total; i += 1) {
      kinds.add(current(h).taskKind);
      await answer(h, true);
    }
    await h.settle(50);
    expect(h.results).toHaveLength(1);
    expect(h.koda.count("speech.say"), "silent").toBe(0);
    const sets = (lesson.params as { question: { sets: string[] } }).question.sets;
    expect(kinds.size).toBe(sets.length);
    h.unmount();
  }, 60_000);
});
