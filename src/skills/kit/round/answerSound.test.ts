import { beforeEach, describe, expect, it, vi } from "vitest";

import { playAnswerSound } from "./answerSound";
import { registerSkillVoice } from "../../../lib/voiceClips";
import { createFakeKoda } from "../testing/fakeKoda";

/**
 * The one function that answers-to-sound goes through.
 *
 * Worth its own test because everything it does is a decision rather than a
 * calculation: which group a right answer maps to, and which two switches may
 * silence it. A regression here is a child hearing praise for a wrong answer, or
 * hearing anything at all after a parent muted the device.
 */

let played: string[] = [];

beforeEach(() => {
  played = [];
  vi.stubGlobal(
    "Audio",
    class {
      playbackRate = 1;
      play = vi.fn(async () => undefined);
      pause = vi.fn();
      addEventListener = vi.fn();
      constructor(src: string) {
        played.push(src);
      }
    },
  );

  registerSkillVoice(
    { Yes: "correct/yes.wav", Oops: "incorrect/oops.wav" },
    { "./audio/correct/yes.wav": "/a/yes.wav", "./audio/incorrect/oops.wav": "/a/oops.wav" },
    { correct: { phrases: ["Yes"] }, incorrect: { phrases: ["Oops"] } },
  );
});

describe("playAnswerSound", () => {
  it("praises a right answer", () => {
    expect(playAnswerSound(createFakeKoda().sdk, true)).toBe(true);
    expect(played).toEqual(["/a/yes.wav"]);
  });

  it("encourages a wrong answer", () => {
    expect(playAnswerSound(createFakeKoda().sdk, false)).toBe(true);
    expect(played).toEqual(["/a/oops.wav"]);
  });

  it("stays silent when the voice is off", () => {
    const koda = createFakeKoda({ voiceEnabled: false }).sdk;
    expect(playAnswerSound(koda, true)).toBe(false);
    expect(played).toHaveLength(0);
  });

  /*
   * The bug this pair exists for: a spoken reaction read the chime preference,
   * which ships off, so praise was silent on a fresh install while the same
   * activity counted out loud on every tap. Words follow the voice switch.
   */
  it("speaks with the chimes off, because a reaction is words and not a chime", () => {
    const koda = createFakeKoda().sdk;
    koda.sound.isEnabled = () => false;
    expect(playAnswerSound(koda, true)).toBe(true);
    expect(played).toEqual(["/a/yes.wav"]);
  });

  it("stays silent when the skill's audio_speech feature is off", () => {
    const koda = createFakeKoda().sdk;
    koda.config.isEnabled = (id: string) => id !== "audio_speech";
    expect(playAnswerSound(koda, true)).toBe(false);
    expect(played).toHaveLength(0);
  });
});
