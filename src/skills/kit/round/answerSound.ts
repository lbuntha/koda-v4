import type { KodaSDK } from "../../types";
import { playReaction } from "../../../lib/voiceClips";

/**
 * Say something about an answer.
 *
 * One function, so that "what a skill does when a question is answered" has a
 * single name and a single implementation. `useSkillRound` calls it for every
 * answer, so a skill built on the round loop gets it without doing anything —
 * but a skill that judges answers its own way can call it directly and sound
 * identical, rather than reaching into the clip layer and re-deriving which
 * group to play and which switches to respect.
 *
 * Two gates, both the learner's own choice:
 *
 *  - `speech.isEnabled()` — the voice preference, shared across every screen.
 *  - the `audio_speech` feature — the skill-level switch for spoken output.
 *
 * The voice switch and not the sound one, because a reaction is a recorded
 * sentence — "Nice work!" — rather than a chime. It used to read
 * `sound.isEnabled()`, which is the "Pops, chimes and fanfares" preference and
 * ships *off*: praise was silent on a fresh install while the same skill counted
 * out loud on every tap, because everything else it says goes through
 * `speech.say`, which never consulted the chime switch either. One kind of
 * output, one switch.
 *
 * Returns whether anything played, which is mostly useful to a test. Callers
 * should ignore it: the answer is never conditional on the sound.
 *
 * Silent when the clips have not been recorded. A reaction fires on every single
 * answer, so falling back to live TTS would put a network round trip between a
 * child and their next question — worse than saying nothing. Record them with
 * `npm run voice:record`; see `docs/VOICE.md`.
 */
export const playAnswerSound = (koda: KodaSDK, correct: boolean): boolean => {
  if (!koda.speech.isEnabled()) return false;
  if (!koda.config.isEnabled("audio_speech", true)) return false;
  // Scoped to this skill: a reaction is written for one subject and does not
  // travel. See `registerSkillVoice`.
  return playReaction(correct ? "correct" : "incorrect", 1, koda.skillId);
};

/**
 * A UI chime, if this skill still wants chimes.
 *
 * The round chrome plays its own little pops — opening the help panel, the
 * overflow menu, leaving. They were unconditional, so a parent who silenced one
 * skill still heard it click at them from the bar above the lesson: the
 * per-skill switch looked broken because half the sounds ignored it.
 *
 * Gated on the same `sound_chimes` feature the activities use, defaulting to on
 * so a skill that never declares it behaves exactly as before.
 */
export const playChrome = (koda: KodaSDK, type: Parameters<KodaSDK["sound"]["play"]>[0]): void => {
  if (!koda.config.isEnabled("sound_chimes", true)) return;
  koda.sound.play(type);
};
