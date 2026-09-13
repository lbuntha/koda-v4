import { describe, expect, it } from "vitest";

import audioManifest from "./audio/manifest.json";
import voice from "./voice.json";
import { REFUSALS } from "./internal/data/divisionTray";
import { ARRAY_REFUSALS } from "./internal/data/divisionArray";
import { LINE_REFUSALS } from "./internal/data/divisionLine";
import { PAIR_REFUSALS } from "./internal/data/divisionRemainder";
import { CHUNK_REFUSALS } from "./internal/data/divisionChunk";
import { DIGIT_REFUSALS } from "./internal/data/divisionColumn";

/**
 * The recordings, and the one way they stop playing without anybody noticing.
 *
 * `playClip` looks a line up by its exact text. A refusal reworded in the engine
 * by a single character — a comma, a "the" — misses the recording and falls
 * through to live TTS. Nothing throws, no test goes red, and the only symptom is
 * that one sentence out of eighteen arrives a beat late in a different voice.
 *
 * So the engines' refusal tables are the source of truth here, and both the
 * script and the recordings are checked against them rather than against each
 * other.
 */

/** Every fixed line an engine actually speaks. */
const SPOKEN: string[] = [
  ...Object.values(REFUSALS),
  ...Object.values(ARRAY_REFUSALS),
  ...Object.values(LINE_REFUSALS),
  ...Object.values(PAIR_REFUSALS),
  ...Object.values(CHUNK_REFUSALS),
  ...Object.values(DIGIT_REFUSALS),
  // StoryBoard speaks this one inline rather than from a table.
  "Cut the bar into the right number of parts first.",
];

const recorded = audioManifest as Record<string, string>;

describe("every line an engine says has a recording", () => {
  it("declares all of them in voice.json", () => {
    for (const line of SPOKEN) {
      expect(voice.phrases, `nothing declares "${line}"`).toContain(line);
    }
  });

  it("has a clip for every one, matched on the exact text", () => {
    for (const line of SPOKEN) {
      expect(Object.keys(recorded), `no recording for "${line}"`).toContain(line);
      expect(recorded[line], line).toMatch(/^phrases\/.+\.(m4a|wav|mp3|ogg)$/);
    }
  });

  it("records nothing that no engine says", () => {
    // A clip nothing plays is the same waste as a switch nothing reads, and it
    // is how a folder grows lines that were reworded a year ago.
    for (const line of Object.keys(recorded)) {
      expect(SPOKEN, `"${line}" is recorded but nothing says it`).toContain(line);
    }
  });

  it("agrees on the count, all three ways", () => {
    expect(SPOKEN).toHaveLength(18);
    expect(voice.phrases).toHaveLength(18);
    expect(Object.keys(recorded)).toHaveLength(18);
  });
});

describe("this skill records only what it says back to a child", () => {
  it("records no lesson prompt", () => {
    // A skill for readers does not read the question aloud. Everything here is
    // in `phrases/`; a `lessons/` entry would mean the flag stopped working.
    for (const path of Object.values(recorded)) {
      expect(path.startsWith("phrases/"), `${path} is not a refusal`).toBe(true);
    }
  });

  it("keeps the flag that turns prompt recording off", () => {
    expect((voice as { speaksPrompts?: boolean }).speaksPrompts).toBe(false);
  });

  it("declares no reactions of its own", () => {
    // Praise comes from the common pack, which names no subject.
    expect((voice as { groups?: Record<string, unknown> }).groups).toBeUndefined();
  });
});
