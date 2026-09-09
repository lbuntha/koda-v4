import type { KodaSDK, SoundType } from "../../../types";
import { playChrome } from "../../../kit";

/**
 * What each thing a child does sounds like.
 *
 * Intentions, not tones: a call site says what happened and this file decides
 * how it sounds. Sound is a channel a child uses to tell moves apart, and it
 * only works if the same event sounds the same way everywhere.
 */
export const MULTIPLICATION_SOUND = {
  /** An object went into a group, or a factor into a slot. */
  placed: "pop",
  /** A group was counted into the running sum, or a model changed shape. */
  counted: "clink",
  /** A move was taken back. Never `counted`: undo must not sound like the thing it reverses. */
  undone: "pop",
  /** The move was not allowed, and nothing was scored. */
  refused: "hint",
  /** A sub-goal finished — the tray is built, both slots are filled. */
  reached: "success",
  right: "success",
  wrong: "error",
} as const satisfies Record<string, SoundType>;

export type MultiplicationSound = keyof typeof MULTIPLICATION_SOUND;

/** `levelup` is the round-complete fanfare and belongs to the shared chrome. */
export const CHROME_ONLY: SoundType[] = ["levelup"];

/** Play what just happened. `playChrome` owns the `sound_chimes` gate. */
export const chime = (koda: KodaSDK, sound: MultiplicationSound): void =>
  playChrome(koda, MULTIPLICATION_SOUND[sound]);
