import type { KodaSDK } from "../../types";
import { playChrome } from "../../kit";
import type { SoundType } from "../../types";

export const tagLabelsFrom = (koda: KodaSDK) => ({
  warmup: koda.config.get("warmupLabel", "") || undefined,
  activity: koda.config.get("activityLabel", "") || undefined,
  guided: koda.config.get("guidedLabel", "") || undefined,
  milestone: koda.config.get("milestoneLabel", "") || undefined,
});

export const speechRate = (koda: KodaSDK): { rate: number } => ({
  rate: koda.config.get("speechRate", 0.95),
});

/**
 * What each thing a child does sounds like.
 *
 * Intentions rather than tones, so the same event sounds the same in every
 * engine this skill grows. `refused` is deliberately not `wrong`: a move that
 * was not allowed scored nothing, and sounding like a wrong answer would tell
 * a child they had lost something they had not.
 */
export const SWEEPER_SOUND = {
  chosen: "pop",
  unchosen: "pop",
  refused: "hint",
  right: "success",
  wrong: "error",
} as const satisfies Record<string, SoundType>;

export type SweeperSound = keyof typeof SWEEPER_SOUND;

/** `playChrome` owns the `sound_chimes` gate. */
export const chime = (koda: KodaSDK, sound: SweeperSound): void => playChrome(koda, SWEEPER_SOUND[sound]);
