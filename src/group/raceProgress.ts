/**
 * How far one player has got in a skill race, from the answers their round gives.
 *
 * Counted the way the round scores itself (`kit/round/scoreRound.ts`): a
 * question counts as finished when it is answered right, on any attempt, and
 * as right first time only when its first answer was right. So the place in
 * the race and the stars on the round's own card can never disagree.
 */

import type { RoundObserver } from "../skills/sdk/createKodaSDK";

export interface RaceProgress {
  /** Questions finished. */
  answered: number;
  /** Questions answered right at the first attempt. The race score. */
  firstTry: number;
  /** The round is over. */
  done: boolean;
}

export interface RaceTracker extends RoundObserver {
  progress(): RaceProgress;
}

/** A tracker that tells `onChange` after every answer that moves the count, and at the end. */
export function createRaceTracker(onChange: (progress: RaceProgress) => void): RaceTracker {
  /** First verdict on each question, and whether it has been answered right since. */
  const firstVerdict = new Map<string, boolean>();
  const finished = new Set<string>();
  let done = false;

  const progress = (): RaceProgress => ({
    answered: finished.size,
    firstTry: [...finished].filter((id) => firstVerdict.get(id) === true).length,
    done,
  });

  return {
    answered({ questionId, correct }) {
      if (!firstVerdict.has(questionId)) firstVerdict.set(questionId, correct);
      if (!correct || finished.has(questionId)) return;
      finished.add(questionId);
      onChange(progress());
    },
    completed() {
      if (done) return;
      done = true;
      onChange(progress());
    },
    progress,
  };
}
