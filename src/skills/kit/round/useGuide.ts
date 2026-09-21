import { useCallback, useEffect, useRef, useState } from "react";
import type { KodaSDK } from "../../types";
import type { SupportKind } from "../../../lib/learning/events";

/**
 * The coach: help a learner did not ask for.
 *
 * `useSkillRound`'s hint ladder is *pulled* — a child who knew they were stuck
 * pressed a button. A five-year-old who has lost the thread of a count does not
 * press it: they tap the same rocket twice, or they stop tapping and stare, and
 * the round waits politely for an answer that is not coming. This watches, and
 * speaks up.
 *
 * **It is the same ladder.** Not a second one. An activity already builds three
 * rungs off live state for the Hint button, and those rungs are what this
 * shows — so a child meets one set of words however the help arrived, and the
 * button becomes "show me now" rather than a separate system with its own
 * vocabulary. Passing the same array to both was the whole point of merging
 * them.
 *
 * What is added on top of the rungs is *when*, and *where to look*:
 *
 *  - **When.** A clock that runs while nothing happens, growing less patient
 *    within a question and resetting between them, plus a way for an activity
 *    to say "that move was odd" and skip the clock entirely.
 *  - **Where.** From rung two up, the activity names one thing to light — the
 *    next object, the next cell, the pad the frog lands on. Rung three keeps
 *    that light moving as the child works.
 *
 * Every engine gets those two for free, which is what stops five activities
 * growing five coaches. What an engine still owns is its own wording and its
 * own idea of an odd move, because only it knows what either means.
 *
 * Nothing here reaches the network. The children this is for are on unstable
 * connections, and a coach that arrives after a round trip arrives after they
 * have given up.
 */

/** Why the coach spoke. */
export type GuideReason =
  /** Nothing has happened for a while. */
  | "stalled"
  /** A move that says the idea has come apart — see `stumbled`. */
  | "stumbled"
  /** The child pressed the Hint button. */
  | "asked";

/** How hard the cue leans: say it, show it, walk it. */
export type GuideLevel = 1 | 2 | 3;

export interface GuideCue {
  reason: GuideReason;
  level: GuideLevel;
  /** On screen: the activity's rung, written off what the child has built. */
  text: string;
  /** Which thing to light, or -1. Rung one never lights anything. */
  target: number;
}

/** What a lesson may tune. Wording is not on the list — the rungs are. */
export interface GuideSetup {
  /** Off unless a lesson asks for it. */
  enabled?: boolean;
  /** Stillness before the first move that counts as stuck, in ms. */
  startMs?: number;
  /** Stillness once they are going, in ms. Shorter: they were mid-thought. */
  betweenMs?: number;
  /** How much each cue already given shortens the next wait, in ms. */
  hurryMs?: number;
  /** However impatient it gets, never quicker than this. */
  floorMs?: number;
}

export const GUIDE_DEFAULTS: Required<Omit<GuideSetup, "enabled">> = {
  /*
   * Seven seconds to start, five to carry on.
   *
   * Long enough that a child working it out is left alone — thinking time is
   * the lesson, and an adult who fills every silence teaches a child to wait
   * for the adult. Short enough that the silence does not become the end of the
   * attempt.
   */
  startMs: 7000,
  betweenMs: 5000,
  hurryMs: 1500,
  floorMs: 2500,
};

/**
 * How long a learner is left alone, as a parent's dial rather than a switch.
 *
 * "Smart guide" answers *whether* the coach speaks; this answers *when*. The
 * two settings are different questions and a family usually wants the second:
 * a child who is being interrupted while still thinking does not need the help
 * taken away, they need it to wait longer. Before this the only honest answer
 * to "it butts in too soon" was to turn it off.
 *
 * A multiplier rather than four more millisecond fields, so a lesson that has
 * tuned its own `startMs` keeps its shape and simply gets more or less room.
 * The floor scales too — otherwise "relaxed" still nags once a child has
 * needed help twice, which is exactly when calm matters most.
 */
export const PATIENCE: Record<string, number> = {
  relaxed: 1.6,
  normal: 1,
  quick: 0.6,
};

/** The lesson's `guide` block, if it authored one. */
export function guideSetup(params: unknown): GuideSetup {
  const guide = (params as { guide?: unknown } | null | undefined)?.guide;
  return guide && typeof guide === "object" ? (guide as GuideSetup) : {};
}

/**
 * How long to wait before speaking up, given how this question has gone.
 *
 * Each cue already given shortens the next wait: a child who needed help once
 * is likelier to need it again, and making them sit out the full seven seconds
 * a second time is the coach being slow exactly where it should be quick. The
 * floor stops it turning into a running commentary.
 */
export const waitMs = (
  setup: GuideSetup,
  state: { started: boolean; shown: number },
): number => {
  const base = state.started
    ? setup.betweenMs ?? GUIDE_DEFAULTS.betweenMs
    : setup.startMs ?? GUIDE_DEFAULTS.startMs;
  const hurry = (setup.hurryMs ?? GUIDE_DEFAULTS.hurryMs) * state.shown;
  return Math.max(setup.floorMs ?? GUIDE_DEFAULTS.floorMs, base - hurry);
};

/**
 * Which rung a cue comes in at.
 *
 * Two things push it up, and neither is what went wrong. Cues already given on
 * this question — the child has heard the gentle version and is still stuck, so
 * the gentle version is not the one to repeat. And a round where the coach has
 * already been needed on two questions, because a child that far in is not
 * served by starting at the bottom a third time.
 *
 * A stumble changes the *timing*, not the rung: it skips the clock, because a
 * child making a wrong move is acting rather than hesitating. It is tempting to
 * have it skip a rung as well, but the gentle rung usually names the thing they
 * have stopped reading — the number already on the object, the row they were
 * told to fill first — and lighting the answer instead does that reading for
 * them.
 */
export const levelFor = (state: { shown: number; coachedQuestions: number }): GuideLevel =>
  Math.min(3, (state.coachedQuestions >= 2 ? 2 : 1) + state.shown) as GuideLevel;

export interface GuideController {
  /** What is on screen, or nothing. */
  cue: GuideCue | null;
  /** The thing to light, or -1. Follows the child while walking. */
  target: number;
  /** Rung three: the light moves with them and the scene steps back. */
  walking: boolean;
  /** Whether a cue is showing — what the Hint button's label reads from. */
  open: boolean;
  /** How many rungs there are, for "Hint 2 of 3". */
  rungs: number;
  /**
   * The Hint button: show the coach, or put it away.
   *
   * A toggle and nothing more. The old panel also carried a "More help" button
   * to climb with, and between that, "Got it" and the page arrows the bubble
   * would have had four controls in it — which is three more than a
   * five-year-old should have to choose between. Climbing is the coach's job:
   * a child still stuck a few seconds later gets the stronger rung without
   * asking twice.
   */
  ask(): void;
  /** The child put it away. */
  dismiss(): void;
  /** A good move: clears a gentle cue and restarts the clock. */
  moved(): void;
  /** An odd move: raise a cue now, without waiting for the clock. */
  stumbled(): void;
}

export interface UseGuideOptions {
  koda: KodaSDK;
  /** The lesson asked for a coach, the mode suits one, and this is not practice. */
  enabled: boolean;
  setup: GuideSetup;
  /** Changing this is a new question: everything resets. */
  questionId: string;
  /**
   * The ladder, gentlest first — the very array the Hint button was given.
   *
   * Read on every render rather than captured when a cue is raised, because a
   * rung that describes what the child has built has to stay true as they build
   * it. That is also what makes rung three follow them for free.
   */
  rungs: string[];
  /** Short spoken forms by rung, where a recorded line exists. */
  spoken?: (string | undefined)[];
  /** What rung two and up should light, or -1. */
  target: number;
  /** Anything the learner has done on this question — re-arms the clock. */
  progress: number;
  /** Nothing left to coach: the question is answered. */
  done: boolean;
  /** Hold off: an answer has landed, or the round is over. */
  paused: boolean;
  /** `round.useSupport`, so help given is filed like help taken. */
  useSupport(kind: SupportKind, level?: number): void;
}

export function useGuide({
  koda,
  enabled,
  setup,
  questionId,
  rungs,
  spoken,
  target,
  progress,
  done,
  paused,
  useSupport,
}: UseGuideOptions): GuideController {
  /*
   * The rung showing, and nothing else.
   *
   * The words are *not* state. Deriving them from `rungs` on each render is
   * what lets a cue stay true while the child works — "you have counted three"
   * becoming "you have counted four" — and it is why walking needs no code of
   * its own: the light is `target`, and `target` is a prop.
   */
  const [level, setLevel] = useState(0);
  const [reason, setReason] = useState<GuideReason>("stalled");

  /** Cues raised on the open question. Drives the rung and the patience. */
  const shownRef = useRef(0);
  /** Questions in this round that needed the coach. Survives a new question. */
  const coachedRef = useRef(0);
  /** Put away by hand: not a mute, but it buys back the full wait. */
  const dismissedRef = useRef(false);
  /** The rung last said out loud, so following the child stays quiet. */
  const spokenRef = useRef(0);
  /** The deepest rung reached on this question, open or not. */
  const deepestRef = useRef(0);

  /*
   * The lesson's timings, stretched or shortened by the family's dial.
   *
   * Applied here rather than in `waitMs` so that function stays pure and a
   * test can state a wait in milliseconds without knowing what a household has
   * chosen.
   */
  const scale = PATIENCE[String(koda.config.get("coachPatience", "normal"))] ?? 1;
  const patient: GuideSetup = {
    ...setup,
    startMs: (setup.startMs ?? GUIDE_DEFAULTS.startMs) * scale,
    betweenMs: (setup.betweenMs ?? GUIDE_DEFAULTS.betweenMs) * scale,
    hurryMs: (setup.hurryMs ?? GUIDE_DEFAULTS.hurryMs) * scale,
    floorMs: (setup.floorMs ?? GUIDE_DEFAULTS.floorMs) * scale,
  };

  /* Live values for the timer, which is armed long before it fires. Closing
     over them would build a cue from the screen as it was when the clock
     started, which is the one thing a cue must never be wrong about. */
  const live = useRef({ rungs, spoken, paused, koda, useSupport });
  live.current = { rungs, spoken, paused, koda, useSupport };

  const raise = useCallback((why: GuideReason, at?: number) => {
    if (live.current.paused) return;
    const ladder = live.current.rungs;
    if (ladder.length === 0) return;

    const next = Math.min(
      at ?? levelFor({ shown: shownRef.current, coachedQuestions: coachedRef.current }),
      ladder.length,
    ) as GuideLevel;

    shownRef.current += 1;
    dismissedRef.current = false;
    deepestRef.current = Math.max(deepestRef.current, next);
    setReason(why);
    setLevel(next);
  }, []);

  /* A new question starts clean — except for how the round has gone so far,
     which is the whole of what makes the coach's patience run down. */
  useEffect(() => {
    if (shownRef.current > 0) coachedRef.current += 1;
    shownRef.current = 0;
    spokenRef.current = 0;
    deepestRef.current = 0;
    dismissedRef.current = false;
    setLevel(0);
  }, [questionId]);

  /*
   * The clock.
   *
   * Re-armed whenever anything that decides the wait changes — a move, a cue
   * appearing or being put away, the round pausing. Cleared on the way out, so
   * a question that ends while the child is thinking cannot be coached after it
   * is over.
   */
  useEffect(() => {
    if (!enabled) return;
    /* Somebody else has the floor, or there is nothing left to help with. A cue
       still sitting there would be help about a question already answered.
       (Setting state it already holds is a no-op in React, so this cannot
       spin.) */
    if (paused || done) {
      setLevel(0);
      return;
    }
    /*
     * A cue on screen does not stop the clock — it only stops it at the top.
     *
     * This used to return whenever anything was showing, which quietly made
     * rungs two and three unreachable for the child who needs them most: a
     * learner who reads "say one number for each one you touch", does nothing,
     * and waits. Climbing only happened after they *acted*, so the one who was
     * frozen stayed on the gentlest rung for ever, and the light that rung two
     * turns on never came.
     *
     * At the top rung there is nothing left to climb to, so the clock does
     * stop: re-raising the same words would be nagging.
     */
    if (level >= Math.min(3, rungs.length)) return;

    const wait = waitMs(patient, {
      started: progress > 0,
      shown: dismissedRef.current ? 0 : shownRef.current,
    });
    const timer = window.setTimeout(() => raise("stalled"), wait);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused, done, level, rungs.length, progress, questionId, raise, scale]);

  /*
   * Said once per rung, not once per render.
   *
   * The wording changes as the child works, and re-speaking on every one of
   * those would talk over them mid-tap — and over the activity's own counting,
   * which has just said a number out loud. The rung is what marks new help.
   */
  useEffect(() => {
    if (level === 0) {
      spokenRef.current = 0;
      return;
    }
    if (spokenRef.current === level) return;
    const climbed = level > spokenRef.current;
    spokenRef.current = level;

    const { rungs: ladder, spoken: short, koda: sdk, useSupport: report } = live.current;
    /*
     * Help offered and help asked for are different facts about a learner, so
     * the log is told which: `walkthrough` for a cue the child did not ask for,
     * `hint` for one they pressed a button to get. Both count against an
     * unaided answer, which is why neither can be skipped.
     */
    if (climbed) report(reason === "asked" ? "hint" : "walkthrough", level);

    /*
     * Two switches, because they answer two questions.
     *
     * "Spoken voice" is whether the *lesson* talks — the prompt read out, the
     * numbers counted along. This is whether the coach does, and a family can
     * reasonably want one without the other: a child who reads well enough to
     * take the cue off the screen may still want the counting said aloud, and
     * a child working beside a sleeping sibling wants neither. Turning the
     * coach's voice off leaves the bubble exactly where it was, because a cue
     * that cannot be heard is still a cue.
     */
    if (!sdk.config.isEnabled("audio_speech", true)) return;
    if (!sdk.config.isEnabled("guide_voice", true)) return;
    /* The short form where one exists, because it is recorded and plays in the
       same tick; the rung itself otherwise, which is what the hint panel has
       always spoken. A coach that cannot be heard is still a coach — the panel
       never waits on a clip. */
    const line = short?.[level - 1] ?? ladder[level - 1];
    if (!line) return;
    void sdk.speech
      .say(line, { rate: sdk.config.get("speechRate", 1.0) })
      .catch(() => {});
  }, [level, reason]);

  const ask = useCallback(() => {
    if (level > 0) {
      setLevel(0);
      return;
    }
    /* Re-opening returns to the deepest rung already reached rather than to the
       bottom: a child who has read the nudge and then seen the light should not
       have to climb past the nudge again, and the log should not record a
       second first-rung hint for the same question. */
    raise("asked", Math.max(1, deepestRef.current));
  }, [level, raise]);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setLevel(0);
  }, []);

  const moved = useCallback(() => {
    if (!enabled) return;
    /* A good move answers a gentle cue, and the child is going again. Rung
       three is the exception: being walked through is the help, so its light
       moves to the next thing instead of going out. */
    setLevel((open) => (open > 0 && open < 3 ? 0 : open));
  }, [enabled]);

  const stumbled = useCallback(() => {
    if (!enabled) return;
    raise("stumbled");
  }, [enabled, raise]);

  const text = level > 0 ? rungs[level - 1] : undefined;
  const cue: GuideCue | null =
    level > 0 && text
      ? { reason, level: level as GuideLevel, text, target: level >= 2 ? target : -1 }
      : null;

  return {
    cue,
    target: cue?.target ?? -1,
    walking: level === 3,
    open: level > 0,
    rungs: rungs.length,
    ask,
    dismiss,
    moved,
    stumbled,
  };
}
