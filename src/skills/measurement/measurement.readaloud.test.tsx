import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderActivity } from "../kit/testing";
import { forgetHowToPlay, markHowToPlaySeen } from "../kit";
import { skill } from ".";
import { READER_AGE, readsAloud } from "./internal/readsAloud";

/* A lesson for readers keeps its question quiet when the round opens (SKILL_DEVELOPMENT §0.1). */
const opts = { settings: { praiseMs: 0 }, skillId: "measurement" };
const DEMOS = ["compare", "order", "balance", "pour", "units", "ruler-read", "ruler-place", "ruler-draw", "estimate", "scale", "thermo", "story"];

beforeEach(() => DEMOS.forEach((d) => markHowToPlaySeen(`measurement/${d}`)));
afterEach(() => forgetHowToPlay());

function open(id: string) {
  const lesson = skill.lessons.find((l) => l.id === id)!;
  const activity = skill.activities[lesson.activity.split("/")[1]];
  const params = lesson.params as Record<string, unknown>;
  return {
    lesson,
    h: renderActivity(activity, {
      ...opts,
      params: { ...params, ...((params.question as object) ?? {}) },
      lesson: { id, title: lesson.title, levelNumber: 1 },
    }),
  };
}

describe("reading the question aloud", () => {
  it("never speaks in practice", async () => {
    for (const l of skill.lessons.filter((x) => (x.params as { question: { practice?: boolean } }).question.practice)) {
      const { h } = open(l.id);
      await h.settle(50);
      expect(h.koda.count("speech.say"), l.id).toBe(0);
      h.unmount();
    }
  });

  it("is decided by the youngest age the lesson is for", () => {
    for (const l of skill.lessons) expect(readsAloud(l.id), l.id).toBe((l.ageBand?.[0] ?? 0) < READER_AGE);
    expect(readsAloud(undefined)).toBe(true);
    expect(skill.lessons.filter((l) => !readsAloud(l.id)).length).toBeGreaterThan(0);
  });

  it("speaks for a five-year-old's lesson and stays quiet for a reader's, keeping the speaker button", async () => {
    for (const l of skill.lessons.filter((x) => !(x.params as { question: { practice?: boolean } }).question.practice)) {
      const { h } = open(l.id);
      await h.settle(50);
      const spoke = h.koda.only("speech.say").some((c) => JSON.stringify(c.args).includes((l.params as { play: { audioPrompt: string } }).play.audioPrompt));
      expect(spoke, l.id).toBe(readsAloud(l.id));
      expect(h.screen.queryAllByRole("button", { name: /read/i }).length, `${l.id} speaker`).toBeGreaterThan(0);
      h.unmount();
    }
  });
});
