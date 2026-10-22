/**
 * The seen log, for the child playing. It lives in `playStore.ts`, per child, and syncs with their account;
 * the game carries on, repeating a puzzle at worst, if storage is missing or full.
 */

import { loadPlay, savePlay } from "./playStore";
import { recordSeen } from "./seen";

export const loadSeen = (): string[] => loadPlay().seen;

/** Remember that these puzzles were played. */
export const markSeen = (ids: readonly string[]): void => {
  const play = loadPlay();
  savePlay({ ...play, seen: recordSeen(play.seen, ids) });
};
