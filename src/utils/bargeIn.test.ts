import { describe, expect, it } from "vitest";

import { BARGE_IN_FLOOR, BARGE_IN_HOLD_MS, shouldSendMicFrame } from "./geminiLiveAudio";

/**
 * When the microphone is worth listening to.
 *
 * Koda kept stopping mid-sentence. The microphone stays open while he talks —
 * deliberately, so a child can cut in — but every frame was being uploaded,
 * silence and room noise included, and the model's voice-activity detector
 * reads "audio arriving" as "someone is speaking". On a laptop it was stopping
 * him with his own voice coming back through the speakers.
 *
 * The rule has to hold two things at once, and the tests are mostly about the
 * second: Koda must be interruptible, and Koda must not interrupt himself.
 */

const frame = (over: Partial<Parameters<typeof shouldSendMicFrame>[0]> = {}) =>
  shouldSendMicFrame({ rms: 0, kodaSpeaking: true, holdUntil: 0, now: 1_000, ...over });

describe("while Koda is talking", () => {
  it("ignores a quiet room, which is what was cutting him off", () => {
    expect(frame({ rms: 0.005 }).send).toBe(false);
    expect(frame({ rms: BARGE_IN_FLOOR - 0.001 }).send).toBe(false);
  });

  it("lets a child cut in the moment they actually speak", () => {
    expect(frame({ rms: BARGE_IN_FLOOR }).send).toBe(true);
    expect(frame({ rms: 0.3 }).send).toBe(true);
  });

  it("keeps the gate open through the gaps between words", () => {
    // Otherwise an interruption arrives as a stutter of half-frames and the
    // model hears a stammer rather than a sentence.
    const started = frame({ rms: 0.2, now: 1_000 });
    expect(started.holdUntil).toBe(1_000 + BARGE_IN_HOLD_MS);

    const gap = frame({ rms: 0.001, holdUntil: started.holdUntil, now: 1_200 });
    expect(gap.send).toBe(true);
    expect(gap.holdUntil).toBe(started.holdUntil);
  });

  it("closes again once the burst is over", () => {
    const after = frame({ rms: 0.001, holdUntil: 1_000, now: 1_000 + BARGE_IN_HOLD_MS + 1 });

    expect(after.send).toBe(false);
    expect(after.holdUntil).toBe(0);
  });
});

describe("while Koda is silent", () => {
  it("sends everything, so a child's first word is never the one clipped", () => {
    expect(frame({ kodaSpeaking: false, rms: 0 }).send).toBe(true);
    expect(frame({ kodaSpeaking: false, rms: 0.0001 }).send).toBe(true);
  });

  it("forgets any hold, so the next turn starts clean", () => {
    expect(frame({ kodaSpeaking: false, holdUntil: 9_999 }).holdUntil).toBe(0);
  });
});
