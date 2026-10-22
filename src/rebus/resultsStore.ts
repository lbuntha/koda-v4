/**
 * The per-puzzle results, for the child playing. They live in `playStore.ts`, per child, and sync with
 * their account; the game simply carries on without a memory if storage is missing or full.
 */

import type { PuzzleOutcome } from "./engine";
import { loadPlay, savePlay } from "./playStore";
import { lastPlayOf, recordPlay, type Results } from "./results";

export const loadResults = (): Results => loadPlay().results;

/** Remember how a puzzle just went. */
export const saveOutcome = (outcome: PuzzleOutcome): void => {
  const play = loadPlay();
  savePlay({ ...play, results: recordPlay(play.results, outcome.puzzle.id, lastPlayOf(outcome)) });
};
