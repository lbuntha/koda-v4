import type { KodaSDK, SoundType } from "../../../types";
import { playChrome } from "../../../kit";

/**
 * What each thing a child does sounds like.
 *
 * The SDK offers six tones and no meanings, so every engine picked its own —
 * and they drifted. Three examples this map was written to end: a refused move
 * made no sound at all in Subtraction while the identical refusal chimed in
 * Addition; two of the three undo controls were silent while every other move
 * popped; and the third played the same `clink` as the backward jump it was
 * undoing, so a child could not hear whether their tap had advanced or
 * reverted.
 *
 * Intentions, not tones, so a call site says what happened and this file
 * decides how it sounds. Sound is a channel a child uses to tell moves apart,
 * and it only works if the same event sounds the same way everywhere.
 */
export const SUBTRACTION_SOUND = {
  /** An object, counter or jump moved: the ordinary unit of progress. */
  moved: "pop",
  /** The model itself changed shape — an exchange, a bar drawn, a route chosen. */
  changed: "clink",
  /** A move was taken back. Deliberately not `changed`: undo must not sound
   *  like the thing it reverses. */
  undone: "pop",
  /** The move was not allowed, and nothing was scored. */
  refused: "hint",
  /** A sub-goal inside the question is finished — a jump lands, a trade completes. */
  reached: "success",
} as const satisfies Record<string, SoundType>;

export type SubtractionSound = keyof typeof SUBTRACTION_SOUND;

/**
 * Tones no Subtraction activity plays, and why.
 *
 * `levelup` is the round-complete fanfare and belongs to the shared chrome; an
 * activity firing it would congratulate a child mid-round.
 *
 * `success`/`error` on an *answer* belong to `useSkillRound`, which already
 * plays a spoken reaction through `playAnswerSound` on every submit. Addition
 * leaves it at that; Subtraction used to chime as well, so every answer sounded
 * twice and a wrong one was met with a buzz Addition never gives.
 */
export const CHROME_ONLY: SoundType[] = ["levelup", "error"];

/**
 * Play what just happened.
 *
 * Every engine had written the same two lines — read `sound_chimes`, then guard
 * the call on it — fourteen times over, which is fourteen chances for one of
 * them to forget the guard. `playChrome` in the kit has always done the gating;
 * this only adds the vocabulary, so a call site says `chime(koda, "undone")`
 * and never has to know which tone that is.
 */
export const chime = (koda: KodaSDK, sound: SubtractionSound): void =>
  playChrome(koda, SUBTRACTION_SOUND[sound]);
