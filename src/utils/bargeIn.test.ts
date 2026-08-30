import { describe, expect, it, vi } from "vitest";

import {
  BARGE_IN_FLOOR,
  BARGE_IN_HOLD_MS,
  GeminiLiveVoiceSession,
  shouldSendMicFrame,
} from "./geminiLiveAudio";

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

/**
 * When Koda counts as talking.
 *
 * The state used to be flipped per audio chunk — `speaking` on arrival,
 * `listening` from `onended` whenever the queue happened to be empty. Chunks
 * arrive in bursts, so between two bursts of a single sentence the mouth
 * stopped, the pill said "Listening…", and the character twitched its way
 * through everything Koda said.
 *
 * The schedule is the honest answer: sound is queued up to `nextPlayTime`, so
 * Koda is talking while that is still ahead of the clock.
 */
describe("whether Koda is talking", () => {
  // The real method, on a stand-in holding just the two fields it reads. A test
  // that reimplemented the comparison could not fail when the rule changed.
  const isSpeaking = (nextPlayTime: number, currentTime: number) =>
    (GeminiLiveVoiceSession.prototype.isSpeaking as () => boolean).call({
      outputAudioCtx: { currentTime },
      nextPlayTime,
    });

  it("is talking while sound is still scheduled ahead of the clock", () => {
    expect(isSpeaking(10.5, 10.0)).toBe(true);
  });

  it("keeps talking across the gap between two bursts of one sentence", () => {
    // The old rule looked at whether any buffer was alive and said no here.
    expect(isSpeaking(10.2, 10.0)).toBe(true);
  });

  it("stops once the last chunk has actually been heard", () => {
    expect(isSpeaking(10.0, 10.0)).toBe(false);
    expect(isSpeaking(10.0, 10.4)).toBe(false);
  });

  it("does not stop a beat early on the final chunk", () => {
    // The tail: the last chunk is scheduled before it is heard.
    expect(isSpeaking(10.06, 10.0)).toBe(true);
  });

  it("is not talking when there is no audio context at all", () => {
    expect(
      (GeminiLiveVoiceSession.prototype.isSpeaking as () => boolean).call({
        outputAudioCtx: null,
        nextPlayTime: 99,
      }),
    ).toBe(false);
  });
});

/**
 * Notes that must not land on top of Koda.
 *
 * A new turn makes the model abandon the one it is in the middle of. The app
 * sends a note every time the child moves to the next question — which is
 * exactly when Koda is most likely to be saying something about the last one —
 * so the note cut him off mid-word, for no reason a child could see.
 */
describe("a note sent while Koda is talking", () => {
  const harness = () => {
    const sent: string[] = [];
    let speaking = true;
    const self = {
      pendingIdleText: null as string | null,
      idleSendTimer: null as number | null,
      isSpeaking: () => speaking,
      sendTextMessage: (t: string) => sent.push(t),
      sendTextWhenIdle: GeminiLiveVoiceSession.prototype.sendTextWhenIdle,
    };
    return { self, sent, stop: () => (speaking = false) };
  };

  it("waits for the sentence to land instead of cutting it off", async () => {
    vi.useFakeTimers();
    const { self, sent, stop } = harness();

    self.sendTextWhenIdle("next question");
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent, "sent while Koda was still talking").toEqual([]);

    stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(sent).toEqual(["next question"]);
    vi.useRealTimers();
  });

  it("keeps only the latest note, not a backlog of stale ones", async () => {
    // Two questions in quick succession should leave Koda addressing the
    // second, not working through the first.
    vi.useFakeTimers();
    const { self, sent, stop } = harness();

    self.sendTextWhenIdle("question 2");
    self.sendTextWhenIdle("question 3");
    await vi.advanceTimersByTimeAsync(500);
    stop();
    await vi.advanceTimersByTimeAsync(300);

    expect(sent).toEqual(["question 3"]);
    vi.useRealTimers();
  });

  it("gives up waiting rather than swallowing the note", async () => {
    // A session that never stops speaking must not silently lose it.
    vi.useFakeTimers();
    const { self, sent } = harness();

    self.sendTextWhenIdle("eventually", 2000);
    await vi.advanceTimersByTimeAsync(3000);

    expect(sent).toEqual(["eventually"]);
    vi.useRealTimers();
  });

  it("sends straight away when Koda is not talking", async () => {
    vi.useFakeTimers();
    const { self, sent, stop } = harness();
    stop();

    self.sendTextWhenIdle("now");
    await vi.advanceTimersByTimeAsync(10);

    expect(sent).toEqual(["now"]);
    vi.useRealTimers();
  });
});
