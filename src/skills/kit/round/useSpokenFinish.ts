import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Hold a round open until the last word has been *heard*.
 *
 * Counting activities say a number on every move, and the last one is the
 * answer — "eight" is what the eighth tap was for. Submitting in the same tick
 * loses it: the round's praise clip starts by stopping whatever is speaking, so
 * the child is congratulated *instead of* being told the total, and the one
 * repetition that closes the count never happens.
 *
 * A fixed delay was the first fix and it was a guess. On a phone a clip can
 * take a few hundred milliseconds just to begin, so the guess ran out mid-word.
 * So: wait for the word itself, keep the old delay as a floor so the number
 * still has time on screen, and cap the whole wait so silence — blocked
 * autoplay, a file that will not load — cannot strand a child on a finished
 * scene.
 *
 * Written once here because two activities need it and both got it wrong the
 * same way. `cancel()` on a new question, so a late-resolving clip cannot
 * submit into the question that replaced it; unmount cancels itself.
 */

export interface SpokenFinishOptions {
  /** The least time the last word gets, even when it finishes sooner. */
  floorMs?: number;
  /** The longest to wait for a word that never reports back. */
  capMs?: number;
}

export interface SpokenFinish {
  /** Run `then` once `spoken` has finished — floor honoured, cap enforced. */
  after(spoken: Promise<void>, then: () => void): void;
  /** Drop a pending finish. Call it when the question changes. */
  cancel(): void;
}

/** Long enough for a recorded number word, and for it to be read on screen. */
export const SPOKEN_FLOOR_MS = 900;
/** Past this the round moves on regardless: silence must not stall a child. */
export const SPOKEN_CAP_MS = 2600;

export function useSpokenFinish({
  floorMs = SPOKEN_FLOOR_MS,
  capMs = SPOKEN_CAP_MS,
}: SpokenFinishOptions = {}): SpokenFinish {
  const timer = useRef<number | null>(null);
  /** Bumped by every cancel, so a promise that resolves late is ignored. */
  const token = useRef(0);

  const cancel = useCallback(() => {
    token.current += 1;
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Leaving mid-count must not submit for a round that is no longer mounted.
  useEffect(() => cancel, [cancel]);

  const after = useCallback(
    (spoken: Promise<void>, then: () => void) => {
      if (floorMs <= 0) {
        then();
        return;
      }

      const startedAt = Date.now();
      const mine = token.current;
      let done = false;

      const run = () => {
        if (done || token.current !== mine) return;
        done = true;
        timer.current = null;
        then();
      };
      const runIn = (ms: number) => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(run, Math.max(0, ms));
      };

      // The cap goes on first, so a word that never reports back still lands.
      runIn(capMs);
      // A rejection ends the line as surely as an ending does — a round must
      // never stall on a sound, so both settle the same way.
      const ended = () => {
        if (done || token.current !== mine) return;
        runIn(floorMs - (Date.now() - startedAt));
      };
      void Promise.resolve(spoken).then(ended, ended);
    },
    [floorMs, capMs],
  );

  return useMemo(() => ({ after, cancel }), [after, cancel]);
}
