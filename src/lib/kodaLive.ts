/**
 * Turning a live voice session into a face.
 *
 * `GeminiLiveVoiceSession` already reports everything a mascot needs — a status,
 * and both sides' audio energy every 50ms — and until now none of it drove
 * anything: the modal drew a hand-built orb whose eyes changed colour, and the
 * character a family had chosen was nowhere in the room. This is the mapping in
 * between, kept out of the modal so it can be reasoned about and tested without
 * a microphone.
 *
 * Two rules run through it:
 *
 * **The face may only claim what is true.** Listening is drawn when the
 * microphone is genuinely open — not while muted, not while connecting, not
 * after an error. A child who sees Koda listening and is not heard learns that
 * the app lies, and that is a worse failure than a face that does nothing.
 *
 * **Koda speaking wins over the child speaking.** Both meters can be live at
 * once — a room with an open mic hears the speaker — and a face that flickered
 * between the two would read as broken. The model's own voice is the louder
 * truth about what the session is doing.
 */

import type { ExpressionName, MascotState } from "./kodaFace";

/** What the live session tells us, as the mascot needs it. */
export interface LiveSignals {
  status: "disconnected" | "connecting" | "connected" | "speaking" | "listening" | "error";
  /** 0–1, the child's microphone. Decays smoothly; see `startEnergyMonitoring`. */
  userEnergy: number;
  /** 0–1, Koda's own voice. */
  modelEnergy: number;
  /** A muted mic is not a listening one, whatever the status says. */
  muted?: boolean;
  /** The browser's own speech synthesis, used when Gemini audio is unavailable. */
  fallbackSpeaking?: boolean;
}

/**
 * Above this, a meter counts as sound rather than as room noise.
 *
 * The meters decay by 15% every 50ms, so a threshold this low keeps the mouth
 * moving through the gaps between words instead of snapping shut on every
 * consonant — which is what a naïve "energy > 0" test looks like, and it reads
 * as a stutter rather than as speech.
 */
const FLOOR = 0.04;

/** Which of the five faces a session is wearing right now. */
export function mascotStateFor(signals: LiveSignals): MascotState {
  const { status, userEnergy, modelEnergy, muted = false, fallbackSpeaking = false } = signals;

  // Reaching for the connection is the one honest use of "thinking" here: the
  // session is working and nobody is talking yet.
  if (status === "connecting") return "thinking";

  // Nothing is open. Not listening, not thinking — waiting.
  if (status === "disconnected" || status === "error") return "idle";

  if (status === "speaking" || fallbackSpeaking || modelEnergy > FLOOR) return "speaking";

  // The mic is off. Saying "listening" here would be a lie a child can act on.
  if (muted) return "idle";

  if (status === "listening" || userEnergy > FLOOR) return "listening";

  // Connected, quiet, mic open. Waiting for the child to say something.
  return "idle";
}

/**
 * The mouth, from Koda's own volume.
 *
 * This is what makes it lip-sync rather than a loop: the frame is chosen by how
 * loud the model is at this instant, so the mouth is wide on a stressed syllable
 * and nearly shut between words. Three steps, not a continuous scale, because
 * the faces are three drawings — and because two thresholds are something a
 * person can retune by ear, which a curve is not.
 *
 * **Feed this a smoothed level, not the raw meter.** See `EnvelopeFollower`.
 */
export function mouthForEnergy(energy: number): ExpressionName {
  if (energy > 0.22) return "talkWide";
  if (energy > 0.07) return "talkOpen";
  return "talkClosed";
}

/**
 * Whether the mouth is in an open beat, and how wide.
 *
 * Simulating the real meter against a speaking voice turned up the opposite
 * problem from the one this was written to solve. The meter is an RMS decayed
 * only 15% every 50ms — a fall time of roughly 300ms, longer than a syllable —
 * so during speech it never comes back down: it sits between 0.4 and 1.0 for
 * the whole sentence. Feeding that to fixed thresholds pinned the mouth **wide
 * open for 4.8 seconds at a time**, which is not lip-sync, it is a face stuck
 * mid-vowel.
 *
 * So the level does not decide *when* the mouth moves — it cannot, that
 * information is already smeared out of it. It decides **how wide**, while a
 * cycle at speaking rate decides **when**:
 *
 * * quiet → the mouth is shut, and stays shut through a real pause
 * * speaking, closed beat → `talkClosed`
 * * speaking, open beat → `talkOpen`, or `talkWide` when the voice is loud
 *
 * That is how game lip-sync works from an amplitude envelope alone, and it is
 * honest about what this signal can support: the mouth moves in time with
 * speech and its openness follows the voice, without claiming to know which
 * phoneme is being said.
 */

/**
 * An envelope follower — the physics that keeps the level honest.
 *
 * The raw meter is one buffer's RMS, and it jumps around inside a single word.
 * A real mouth has mass, so this is asymmetric on purpose: **attack is quick**,
 * because a syllable starts sharply and a lagging mouth looks dubbed;
 * **release is slower**, so a consonant does not slam it shut.
 *
 * Frame-rate independent — the coefficient is computed from elapsed
 * milliseconds, so a browser dropping to 30fps gets the same envelope shape as
 * one at 120 rather than a mouth that closes at half speed.
 */
export class EnvelopeFollower {
  private level = 0;

  constructor(
    private readonly attackMs = 45,
    /**
     * 120ms, chosen by simulation rather than by feel.
     *
     * Against a synthetic 5-syllable-a-second voice run through the real meter's
     * own decay, 90–120ms keeps the mouth shut for 76% of a pause while holding
     * the change rate at ~8.7/sec — inside the 8–14 a real speaking mouth makes.
     * Longer smears the pauses; shorter buys nothing.
     */
    private readonly releaseMs = 120,
  ) {}

  /** Advance by `dt` milliseconds towards `target`, and return the new level. */
  follow(target: number, dt: number): number {
    const tau = target > this.level ? this.attackMs : this.releaseMs;
    // 1 - e^(-dt/tau): the share of the remaining distance to close this frame.
    // Clamped, so a tab returning from the background cannot jump the level
    // past its target on one enormous `dt`.
    const alpha = Math.min(1, 1 - Math.exp(-Math.max(0, dt) / tau));
    this.level += (target - this.level) * alpha;
    return this.level;
  }

  get value(): number {
    return this.level;
  }

  reset(): void {
    this.level = 0;
  }
}

/** Below this, the voice has genuinely stopped and the mouth shuts. */
const SILENCE = 0.06;

/**
 * Loud, relative to how loud this speaker has been.
 *
 * Absolute thresholds do not survive a quiet voice or a hot microphone; a share
 * of the recent peak does. `peak` is tracked by the caller and decays, so a
 * shout raises the bar for a few seconds and then it drifts back down.
 */
const WIDE_SHARE = 0.62;

export function talkingMouth(level: number, peak: number, openBeat: boolean): ExpressionName {
  if (level < SILENCE) return "talkClosed";
  if (!openBeat) return "talkClosed";
  return level >= Math.max(SILENCE * 2, peak * WIDE_SHARE) ? "talkWide" : "talkOpen";
}

/**
 * How long the current open-or-closed beat lasts, in milliseconds.
 *
 * Speech runs at four to seven syllables a second, so a beat is 70–110ms. A
 * louder passage is a faster one — people speed up when they emphasise — which
 * is a small effect and the thing that stops the cycle sounding metronomic.
 */
export function beatMs(level: number): number {
  return 110 - Math.min(1, level) * 40;
}

/** What the status line says, so the words and the face never disagree. */
export function liveCaption(state: MascotState, name: string): string {
  switch (state) {
    case "speaking":
      return `${name} is speaking`;
    case "listening":
      return "Listening…";
    case "thinking":
      return "Connecting…";
    default:
      return `${name} is ready`;
  }
}
