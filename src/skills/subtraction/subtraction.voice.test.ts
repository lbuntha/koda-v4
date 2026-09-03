import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { skill } from ".";
import voiceJson from "./voice.json";
import audioManifest from "./audio/manifest.json";
import { isPracticeLesson } from "../../curriculum";
import type { Lesson } from "../types";

/**
 * What Subtraction says, and who owns each line.
 *
 * Three things go wrong with a phrase inventory and none of them is visible on
 * screen. A line the code speaks but the inventory never declared can never be
 * recorded, so it stays on live TTS for ever while everything around it is a
 * clip. A line declared in two places drifts when one copy is reworded. And
 * praise declared without an owner is played by the global registry after
 * *any* skill's answer, so a child finishing an addition round hears the
 * subtraction voice congratulating them.
 *
 * Audio production is deliberately outside this build: the manifest is empty
 * and every line plays through live TTS until the owner records it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const lessons = skill.lessons as unknown as Lesson[];
const teaching = lessons.filter((lesson) => !isPracticeLesson(lesson));
const playOf = (lesson: Lesson) => (lesson.params as { play?: { audioPrompt?: string; kidTip?: string } }).play ?? {};

describe("the subtraction speech inventory", () => {
  it("gives every teaching lesson a spoken opening", () => {
    for (const lesson of teaching) {
      expect(playOf(lesson).audioPrompt, `${lesson.id} has no audioPrompt`).toBeTruthy();
    }
  });

  it("leaves practice lessons silent", () => {
    for (const lesson of lessons.filter(isPracticeLesson)) {
      expect(playOf(lesson).audioPrompt, `${lesson.id} speaks on open`).toBeFalsy();
    }
  });

  it("does not repeat a lesson's prompt in voice.json", () => {
    // Lesson prompts are collected from lessons.json. Declaring them twice is
    // how the two copies drift apart.
    const declared = new Set([...voiceJson.prompts, ...voiceJson.phrases].map((line) => line.toLowerCase()));
    for (const lesson of teaching) {
      const prompt = playOf(lesson).audioPrompt!.toLowerCase();
      expect(declared.has(prompt), `${lesson.id}'s audioPrompt is duplicated in voice.json`).toBe(false);
    }
  });

  /**
   * Every fixed string the engines speak has to be declared, or it can never be
   * recorded. Read from the source rather than listed by hand, so a new spoken
   * line fails this test instead of silently missing the recording pass.
   */
  it("declares every fixed line the activities speak", () => {
    const declared = new Set(voiceJson.phrases);
    const sources = ["RemoveTray", "FrameTakeaway", "BondHouse", "DifferenceLine", "FactDeck",
      "BlockExchange", "PlaceValueDesk", "ColumnPad", "EstimateDial", "StoryBoard", "StrategyPicker"];
    const spoken: string[] = [];
    for (const name of sources) {
      const code = readFileSync(join(HERE, "activities", `${name}.tsx`), "utf8");
      // Only literal strings: a template or a variable is question copy, which
      // the lesson owns, not a fixed line the inventory has to carry.
      for (const match of code.matchAll(/speech\.say\(\s*"([^"]+)"/g)) spoken.push(match[1]);
    }
    expect(spoken.length, "no fixed spoken lines found — has the call shape changed?").toBeGreaterThan(0);
    for (const line of spoken) {
      expect(declared.has(line), `"${line}" is spoken but not declared in voice.json`).toBe(true);
    }
  });

  it("covers the number words the counting engines speak", () => {
    const declared = new Set(voiceJson.phrases);
    for (const word of ["zero", "one", "ten", "twenty"]) expect(declared.has(word)).toBe(true);
  });

  it("owns its praise so another skill's round cannot play it", () => {
    for (const [name, group] of Object.entries(voiceJson.groups)) {
      expect(group.phrases.length, `${name} has no phrases`).toBeGreaterThan(0);
      expect(group.voices.length, `${name} names no voice`).toBeGreaterThan(0);
    }
    // Subtraction-scoped wording: praise that could equally follow an addition
    // round is praise the global registry is free to play after one.
    const correct = voiceJson.groups.correct.phrases.join(" ").toLowerCase();
    expect(/differen|remain|subtract|left|block|column/.test(correct)).toBe(true);
  });

  it("ships no generated audio, exactly as the plan requires", () => {
    expect(audioManifest, "audio production is outside this build").toEqual({});
  });
});
