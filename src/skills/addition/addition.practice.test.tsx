import { describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { skill } from ".";

/**
 * Practice is the same engine with the scaffolding taken away.
 *
 * Not a smaller lesson: retrieving something unaided is a different act from
 * being walked through it. So the three supports come off together, and they
 * come off *completely* — a speaker button that does nothing, or a hint button
 * with nothing behind it, teaches a child that the app's controls are
 * decorative.
 */

const practiceLessons = skill.lessons.filter((l) => l.id.startsWith("practice-"));

const mount = (lesson: (typeof skill.lessons)[number]) => {
  const engine = lesson.activity.split("/")[1];
  const params = lesson.params as { question: Record<string, unknown>; level: number };
  return renderActivity(skill.activities[engine], {
    params: { ...params, ...params.question },
    level: params.level,
  });
};

describe("practice lessons", () => {
  it("there are twelve of them, one per engine, over a hundred questions", () => {
    expect(practiceLessons).toHaveLength(Object.keys(skill.activities).length);
    const engines = practiceLessons.map((l) => l.activity.split("/")[1]);
    expect(new Set(engines).size).toBe(engines.length);

    const questions = practiceLessons.reduce(
      (n, l) => n + ((l.params as { question: { questionsPerRound: number } }).question.questionsPerRound),
      0,
    );
    expect(questions).toBeGreaterThanOrEqual(100);
  });

  it.each(practiceLessons)("$id offers no hint", (lesson) => {
    const h = mount(lesson);
    expect(h.buttons().some((b) => /hint/i.test(b)), "a hint button was offered").toBe(false);
    h.unmount();
  });

  it.each(practiceLessons)("$id offers no read-aloud", (lesson) => {
    const h = mount(lesson);
    expect(
      h.buttons().some((b) => /read question aloud/i.test(b)),
      "a speaker was offered in a silent round",
    ).toBe(false);
    h.unmount();
  });

  it.each(practiceLessons)("$id says nothing when it opens", (lesson) => {
    const h = mount(lesson);
    expect(h.koda.count("speech.say"), "a practice round spoke").toBe(0);
    h.unmount();
  });

  it.each(practiceLessons)("$id names more questions than it has modes", (lesson) => {
    // Cycled rather than sampled: a run that drew badly would practise one
    // technique ten times and call it mixed practice. `modeAt` does the
    // cycling, and is tested directly below — here we only check the lesson
    // gives it enough questions to get all the way round.
    const { modes, questionsPerRound } = (lesson.params as {
      question: { modes: string[]; questionsPerRound: number };
    }).question;
    expect(modes.length).toBeGreaterThan(0);
    expect(questionsPerRound).toBeGreaterThanOrEqual(modes.length);
  });

  it("opens on the first mode it names, where the log records the mode", () => {
    // Most engines put the mode in their taskKind. StrategyPicker does not —
    // its taskKinds name its two steps, and it has one mode to begin with — so
    // it is not something this can check, rather than something it fails.
    for (const lesson of practiceLessons) {
      const { modes } = (lesson.params as { question: { modes: string[] } }).question;
      if (modes.length < 2) continue;
      const h = mount(lesson);
      const first = h.koda.only("learning.present").at(-1)!.args[0] as { taskKind: string };
      expect(first.taskKind, `${lesson.id} did not open on ${modes[0]}`).toContain(modes[0]);
      h.unmount();
    }
  });

  it("keeps the concept each engine already teaches, so practice builds mastery", () => {
    // A lesson carries one conceptKey and mastery aggregates on it. A practice
    // lesson filed under a new key would leave a child practising make-ten a
    // hundred times with the log showing no change in make-ten.
    const taught = new Set(
      skill.lessons.filter((l) => !l.id.startsWith("practice-")).map((l) => l.conceptKey),
    );
    for (const lesson of practiceLessons) {
      expect(taught.has(lesson.conceptKey), `${lesson.id} invents a concept`).toBe(true);
    }
  });
});
