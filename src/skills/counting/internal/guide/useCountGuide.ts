import { useCallback, useEffect, useRef, useState } from "react";
import {
  cueFor,
  isWander,
  levelFor,
  nextTarget,
  waitMs,
  type GuideCue,
  type GuideReason,
  type GuideSetup,
} from "./countGuide";

/**
 * The coach, running.
 *
 * `countGuide.ts` decides *what* a stuck child should be told; this decides
 * *when*, which is the part that needs a clock and therefore cannot be pure.
 * Split that way so the wording can be tested against a row of objects without
 * a rendered component and a fake timer, and so the rule that a cue arrives
 * after five seconds of stillness is one line rather than a test that waits.
 */

export interface CountGuide {
  /** What is on screen now, or nothing. */
  cue: GuideCue | null;
  /** The object to light up, or -1. Follows the child while walking. */
  target: number;
  /** Rung three: the light moves with them and the rest of the scene steps back. */
  walking: boolean;
  /**
   * Tell the guide about a tap, before the scene acts on it.
   *
   * Every tap, including the ones the activity throws away. A second tap on an
   * object that already carries a number is the loudest signal a counting
   * activity ever gets, and until now it was the one the code discarded first.
   */
  noteTap(index: number): void;
  /** The child put the cue away. It stays away until they need it again. */
  dismiss(): void;
}

export interface UseCountGuideOptions {
  /** The lesson asked for a coach, the mode suits one, and this is not practice. */
  enabled: boolean;
  setup: GuideSetup;
  /** Changing this is a new question: everything resets. */
  questionId: string;
  count: number;
  /** One object, singular: "rocket". */
  item: string;
  /** Indices carrying a number, in the order they were touched. */
  tapped: number[];
  /** Hold off: feedback is up, the hint panel is open, the round is over. */
  paused: boolean;
  /** A cue was raised — say it out loud, and tell the learning log. */
  onCue(cue: GuideCue): void;
}

export function useCountGuide({
  enabled,
  setup,
  questionId,
  count,
  item,
  tapped,
  paused,
  onCue,
}: UseCountGuideOptions): CountGuide {
  const [cue, setCue] = useState<GuideCue | null>(null);

  /** Cues raised on the open question. Drives both the rung and the patience. */
  const shownRef = useRef(0);
  /** Questions in this round that needed the coach. Survives a new question. */
  const coachedRef = useRef(0);
  /** Jumps over an uncounted object. One is a shrug; two is a lost thread. */
  const wandersRef = useRef(0);
  /** Put away by hand. Re-armed by the next signal, not by the clock. */
  const dismissedRef = useRef(false);

  /*
   * Live values for the timer to read.
   *
   * The timeout is armed once per stretch of stillness and fires much later, by
   * which time `tapped` has usually moved on. Closing over it would build the
   * cue from whatever the row looked like when the clock started — which is the
   * one thing a cue must never be wrong about.
   */
  const stateRef = useRef({ tapped, count, item, setup, onCue, paused });
  stateRef.current = { tapped, count, item, setup, onCue, paused };

  const raise = useCallback((reason: GuideReason) => {
    const { tapped: now, count: total, item: noun, onCue: say, paused: held } = stateRef.current;
    if (held) return;
    const target = nextTarget(total, now);
    // Nothing left to point at: the question is answered and the coach is done.
    if (target < 0) return;

    const level = levelFor({
      shown: shownRef.current,
      coachedQuestions: coachedRef.current,
    });
    const next = cueFor({ reason, level, count: total, tapped: now.length, target, item: noun });

    shownRef.current += 1;
    dismissedRef.current = false;
    setCue(next);
    say(next);
  }, []);

  /* A new question starts clean — except for how the round has gone so far,
     which is the whole of what makes the coach's patience run down. */
  useEffect(() => {
    if (shownRef.current > 0) coachedRef.current += 1;
    shownRef.current = 0;
    wandersRef.current = 0;
    dismissedRef.current = false;
    setCue(null);
  }, [questionId]);

  const target = nextTarget(count, tapped);
  const done = target < 0;

  /*
   * The clock.
   *
   * Re-armed whenever anything that decides the wait changes — a tap, a cue
   * appearing or being put away, the round pausing. Cleared on the way out, so
   * a question that ends while the child is thinking cannot be coached after it
   * is over.
   */
  useEffect(() => {
    if (!enabled) return;
    /* Somebody else has the floor — the child asked for a hint and is reading
       it, or an answer has landed. Koda does not talk over either, and a cue
       still sitting there while they do would be two panels of help stacked on
       one question. (Setting state it already holds is a no-op in React, so
       this cannot spin.) */
    if (paused) {
      setCue(null);
      return;
    }
    if (done) return;
    // A cue already on screen is the help; a second one on top of it is noise.
    if (cue) return;
    const wait = waitMs(setup, {
      tapped: tapped.length,
      shown: dismissedRef.current ? 0 : shownRef.current,
    });
    const timer = window.setTimeout(() => raise("stalled"), wait);
    return () => window.clearTimeout(timer);
    // `tapped.length` rather than the array: a new array with the same contents
    // is the same stretch of stillness and must not restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused, done, cue, tapped.length, questionId, raise]);

  /*
   * Rung three follows the child.
   *
   * At the lower rungs a tap is the answer to the cue and the cue goes away —
   * the child is going again, and a coach that keeps talking is in the way. At
   * rung three the point is to be walked through it, so the light moves to the
   * next object instead. Silently: the count-along has just said the number out
   * loud, and talking over it is how a child ends up hearing neither.
   */
  useEffect(() => {
    if (!cue) return;
    if (done) {
      setCue(null);
      return;
    }
    if (cue.level < 3) return;
    const walked = cueFor({
      reason: cue.reason,
      level: 3,
      count,
      tapped: tapped.length,
      target,
      item,
    });
    if (walked.text !== cue.text) setCue(walked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapped.length, done]);

  const noteTap = useCallback(
    (index: number) => {
      if (!enabled) return;
      const { tapped: now } = stateRef.current;

      if (now.includes(index)) {
        // One-to-one coming apart. Answered at once rather than on a timer:
        // the child is acting, not hesitating, and acting on a wrong idea.
        raise("recount");
        return;
      }

      if (isWander(now, index)) {
        wandersRef.current += 1;
        if (wandersRef.current >= 2) raise("wandered");
        return;
      }

      // A good tap answers whatever was showing. Rung three is the exception,
      // and the effect above moves its light rather than putting it out.
      setCue((open) => (open && open.level < 3 ? null : open));
    },
    [enabled, raise],
  );

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setCue(null);
  }, []);

  return {
    cue,
    target: cue?.target ?? -1,
    walking: cue?.level === 3,
    noteTap,
    dismiss,
  };
}
