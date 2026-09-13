import { describe, expect, it } from "vitest";

import audioManifest from "./audio/manifest.json";
import voice from "./voice.json";
import { STRIP_REFUSALS } from "./internal/data/fractionStrip";
import { LINE_REFUSALS } from "./internal/data/fractionLine";
import { MILL_REFUSALS } from "./internal/data/fractionEquivalence";
import { COMPARE_REFUSALS } from "./internal/data/fractionCompare";
import { MIXED_REFUSALS } from "./internal/data/fractionMixed";
import { ADD_REFUSALS } from "./internal/data/fractionAdd";
import { MULTIPLY_REFUSALS } from "./internal/data/fractionMultiply";
import { DIVIDE_REFUSALS } from "./internal/data/fractionDivide";

/**
 * The script, and the one way it drifts without anybody noticing.
 *
 * `playClip` looks a line up by its exact text. A refusal reworded in an engine
 * by a single character — a comma, a "the" — misses its recording and falls
 * through to live TTS: nothing throws, no test goes red, and one sentence in a
 * round arrives a beat late in a different voice.
 *
 * It drifted before this test existed. `voice.json` was written in phase 0 from
 * the plan, and all four of its lines were sentences no engine ever said: the
 * wording changed as the engines were built and the script stayed where it was.
 * Four clips would have been recorded for nothing, and the thirteen lines the
 * skill does say would have had none.
 *
 * So the engines' refusal tables are the source of truth, and the script and the
 * recordings are both checked against them rather than against each other.
 */

/** Every fixed line an engine actually speaks. */
const SPOKEN: string[] = [
  ...new Set([
    ...Object.values(STRIP_REFUSALS),
    ...Object.values(LINE_REFUSALS),
    ...Object.values(MILL_REFUSALS),
    ...Object.values(COMPARE_REFUSALS),
    ...Object.values(MIXED_REFUSALS),
    ...Object.values(ADD_REFUSALS),
    ...Object.values(MULTIPLY_REFUSALS),
    ...Object.values(DIVIDE_REFUSALS),
  ]),
];

const recorded = audioManifest as Record<string, string>;

describe("the script says what the skill says", () => {
  it("declares every refusal an engine can give", () => {
    for (const line of SPOKEN) {
      expect(voice.phrases, `nothing declares "${line}"`).toContain(line);
    }
  });

  it("scripts nothing no engine says", () => {
    for (const line of voice.phrases) {
      expect(SPOKEN, `"${line}" is scripted but nothing says it`).toContain(line);
    }
  });

  it("agrees on the count", () => {
    expect(voice.phrases).toHaveLength(SPOKEN.length);
    expect(new Set(voice.phrases).size).toBe(voice.phrases.length);
  });

  it("writes every line as a whole sentence a person would say", () => {
    for (const line of voice.phrases) {
      expect(line, line).toMatch(/^[A-Z]/);
      expect(line, line).toMatch(/[.?!]$/);
      expect(line.split(/\s+/).length, line).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("this skill records only what it says back to a child", () => {
  it("keeps the flag that turns prompt recording off", () => {
    // Fractions starts at eight. Reading a word problem aloud to a reader takes
    // the reading out of the question, which in levels 51 to 56 is most of it.
    expect((voice as { speaksPrompts?: boolean }).speaksPrompts).toBe(false);
    expect(voice.prompts).toHaveLength(0);
    expect(voice.templates).toHaveLength(0);
  });

  it("declares no reactions of its own", () => {
    // Praise comes from the common pack, which names no subject.
    expect((voice as { groups?: Record<string, unknown> }).groups).toBeUndefined();
  });

  it("has a clip for every line, or none at all", () => {
    /*
     * Recording happens separately and later, so an empty manifest is the
     * normal state during a build. What is never acceptable is a *partial* one:
     * half the refusals recorded and half on live TTS is two voices in one
     * round, which sounds like a fault rather than a choice.
     */
    const clips = Object.keys(recorded);
    if (clips.length === 0) return;
    for (const line of SPOKEN) {
      expect(clips, `no recording for "${line}"`).toContain(line);
      expect(recorded[line], line).toMatch(/^phrases\/.+\.(m4a|wav|mp3|ogg)$/);
    }
    for (const line of clips) {
      expect(SPOKEN, `"${line}" is recorded but nothing says it`).toContain(line);
    }
  });
});
