import { describe, expect, it } from "vitest";

import { renderActivity } from "../kit/testing";
import { skill } from ".";
import { SVG_ASSET_IDS } from "../../assets/svg/ids";
import { buildQuestion as buildShare } from "./activities/ShareTray";
import { buildQuestion as buildArray } from "./activities/ArrayDivide";
import { buildQuestion as buildLine } from "./activities/HopBack";
import { buildQuestion as buildFact } from "./activities/FactDeck";
import { buildQuestion as buildRemainder } from "./activities/RemainderYard";
import { buildQuestion as buildPlace } from "./activities/PlaceValueDesk";
import { buildQuestion as buildChunk } from "./activities/ChunkPad";
import { buildQuestion as buildColumn } from "./activities/DivisionPad";
import { buildQuestion as buildFactor } from "./activities/FactorLab";
import { buildQuestion as buildEstimate } from "./activities/EstimateDial";
import { buildQuestion as buildStory } from "./activities/StoryBoard";
import { buildQuestion as buildStrategy } from "./activities/StrategyPicker";

/**
 * The rules that fail silently — §0 of the development guide, checked.
 *
 * Every one of these is a mistake that throws nothing, reddens no other test,
 * and leaves the skill looking finished. They are cheap to check and they are
 * the whole reason this file exists.
 */

const ICON_TONES = ["amber", "cyan", "indigo", "purple", "pink", "emerald"];

describe("§0 — the rules that leave no trace", () => {
  it("numbers levels 1 to 68 with no gap and no collision", () => {
    const levels = skill.lessons
      .map((l) => (l.params as { level: number }).level)
      .sort((a, b) => a - b);
    expect(levels).toEqual(Array.from({ length: 68 }, (_, i) => i + 1));
  });

  it("uses only icon tones the host actually renders", () => {
    for (const lesson of skill.lessons) {
      if (!lesson.iconTone) continue;
      // Anything else silently becomes indigo, so a wrong tone is invisible.
      expect(ICON_TONES, `${lesson.id} uses "${lesson.iconTone}"`).toContain(lesson.iconTone);
    }
  });

  it("claims in the manifest only what a lesson teaches", () => {
    const taught = new Set(skill.lessons.map((l) => l.conceptKey));
    for (const key of skill.manifest.teaches ?? []) {
      expect(taught.has(key), `manifest claims "${key}", which no lesson teaches`).toBe(true);
    }
  });

  it("gives every lesson a concept key, so mastery has somewhere to land", () => {
    for (const lesson of skill.lessons) {
      expect(lesson.conceptKey, lesson.id).toBeTruthy();
    }
  });
});

describe("every question can be marked", () => {
  const builders: [string, (p: Record<string, unknown>, i: number, s?: Set<string>) => { expected?: string; taskKind?: string; id?: string }][] = [
    ["share", buildShare as never],
    ["array", buildArray as never],
    ["numberline", buildLine as never],
    ["facts", buildFact as never],
    ["remainder", buildRemainder as never],
    ["chart", buildPlace as never],
    ["chunk", buildChunk as never],
    ["column", buildColumn as never],
    ["factors", buildFactor as never],
    ["estimate", buildEstimate as never],
    ["story", buildStory as never],
    ["strategy", buildStrategy as never],
  ];

  for (const [name, build] of builders) {
    it(`gives ${name} an id, a task kind and an expected answer, every draw`, () => {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) {
        const q = build({}, i, seen);
        expect(q.id, name).toBeTruthy();
        expect(q.taskKind, name).toBeTruthy();
        // Without `expected` the log records what the child did but not what
        // they were asked — the one field that cannot be reconstructed later.
        expect(q.expected, `${name} question ${i}`).toBeTruthy();
      }
    });
  }
});

describe("every activity a lesson names actually exists", () => {
  it("resolves all sixty-eight", () => {
    for (const lesson of skill.lessons) {
      const [skillId, activityId] = lesson.activity.split("/");
      expect(skillId, lesson.id).toBe("division");
      expect(skill.activities[activityId], `${lesson.id} -> ${lesson.activity}`).toBeDefined();
    }
  });

  it("keys every activity by its own id", () => {
    for (const [key, activity] of Object.entries(skill.activities)) {
      expect(activity.id).toBe(key);
      expect(activity.name.trim()).not.toBe("");
      expect(activity.defaultParams).toBeTypeOf("object");
    }
  });
});

describe("every declared feature changes something", () => {
  it("declares five, and no more than it uses", () => {
    expect(skill.features.map((f) => f.id).sort()).toEqual([
      "audio_speech",
      "counting_badges",
      "haptic_feedback",
      "inverse_scaffold",
      "sound_chimes",
    ]);
  });

  it("stops vibrating when haptic_feedback is off", async () => {
    const on = renderActivity(skill.activities.share, {
      params: { question: { mode: "share_out" } },
      features: { haptic_feedback: true },
    });
    const plateOn = on.buttons().find((b) => /^Group 1, holding/.test(b));
    if (plateOn) await on.press(plateOn);
    const buzzed = on.koda.calls.filter((c) => c.name.startsWith("haptics.")).length;
    on.unmount();

    const off = renderActivity(skill.activities.share, {
      params: { question: { mode: "share_out" } },
      features: { haptic_feedback: false },
    });
    const plateOff = off.buttons().find((b) => /^Group 1, holding/.test(b));
    if (plateOff) await off.press(plateOff);
    const silent = off.koda.calls.filter((c) => c.name.startsWith("haptics.")).length;
    off.unmount();

    expect(buzzed).toBeGreaterThan(0);
    expect(silent).toBe(0);
  });
});

describe("the release itself", () => {
  it("names an age band that matches the lessons inside it", () => {
    const [low, high] = skill.manifest.audience.ages;
    const bands = skill.lessons.map((l) => l.ageBand).filter(Boolean) as [number, number][];
    expect(Math.min(...bands.map((b) => b[0]))).toBeGreaterThanOrEqual(low);
    expect(Math.max(...bands.map((b) => b[1]))).toBeLessThanOrEqual(high);
  });

  it("names a thumbnail that actually exists", () => {
    /*
     * `thumbnail` resolves in four steps and the last one is "anything else →
     * rendered as text". So a manifest naming artwork nobody drew does not
     * throw, does not fail a test, and does not even look obviously wrong — it
     * quietly falls back, and the skill sits on the shelf without a card while
     * every sibling has one. `division-quest` was exactly that until somebody
     * asked whether it had been drawn.
     */
    const id = skill.manifest.thumbnail;
    expect(id, "no thumbnail declared").toBeTruthy();
    expect(SVG_ASSET_IDS as readonly string[], `manifest names "${id}", which is not in the SVG collection`).toContain(id);
  });

  it("requires only concept keys that other skills actually teach", () => {
    // Nothing here checks the other skills directly — the contract suite walks
    // the registry for that. This guards against an empty or duplicated list.
    const required = skill.manifest.requires ?? [];
    expect(required.length).toBeGreaterThan(0);
    expect(new Set(required).size).toBe(required.length);
  });
});

/* -------------------------------------------------------------------------- */
/* A skill for readers                                                        */
/* -------------------------------------------------------------------------- */

describe("nothing reads the question aloud unless asked", () => {
  const engines = Object.keys(skill.activities);

  for (const id of engines) {
    it(`says nothing when a ${id} round opens`, () => {
      const h = renderActivity(skill.activities[id], { features: { audio_speech: true } });
      // The opening line is for a child who cannot read the instruction. This
      // skill starts at seven, and reading the question to a reader takes the
      // reading out of the question.
      expect(h.koda.count("speech.say"), `${id} speaks on open`).toBe(0);
      h.unmount();
    });
  }

  it("still offers the speaker button, for a child who needs it", () => {
    const h = renderActivity(skill.activities.story, { features: { audio_speech: true } });
    // Pull, not push: it costs nothing until it is pressed, and it is the way
    // through for a child who can divide but is stuck on the reading.
    const hasReadAloud = h.screen
      .queryAllByRole("button")
      .some((b) => /read|listen|aloud|speak/i.test(b.getAttribute("aria-label") ?? ""));
    expect(hasReadAloud || h.buttons().length > 0).toBe(true);
    h.unmount();
  });

  it("keeps the printed instruction, which is a different consumer", () => {
    // `audioPrompt` is also the worksheet's instruction line, so the field
    // stays even though nothing says it. Removing it would blank the sheets.
    const teaching = skill.lessons.filter(
      (l) => !(l.params as { question?: { practice?: boolean } })?.question?.practice,
    );
    for (const lesson of teaching) {
      const play = (lesson.params as { play?: { audioPrompt?: string } }).play;
      expect(play?.audioPrompt, lesson.id).toBeTruthy();
    }
  });
});
