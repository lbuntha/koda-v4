/**
 * Plays the right cue as the round changes.
 *
 * Watches the engine's state rather than being called from each button, so a
 * sound can never be forgotten on one path or doubled on another: a wrong
 * answer sounds the same whether it came from the keyboard or from the letter
 * tiles. Each cue fires on the *change* (a new wrong answer, a new hint, the
 * hint button becoming ready), never on a re-render.
 */

import { useEffect, useRef } from "react";
import { hintStatus, machineLockedOut } from "../engine";
import { cue } from "../sound";
import type { RebusRound } from "./useRebusRound";

export const useRebusSounds = ({ state, now }: RebusRound): void => {
  const seen = useRef({ index: -1, phase: "", wrong: 0, hints: 0, ready: false, locked: false });

  useEffect(() => {
    const prev = seen.current;
    if (!state) {
      seen.current = { index: -1, phase: "", wrong: 0, hints: 0, ready: false, locked: false };
      return;
    }

    const { run, phase, index } = state;
    const next = { index, phase, wrong: run.wrong, hints: run.hints.length, ready: false, locked: false };

    if (phase === "playing") {
      if (index !== prev.index) {
        // A new puzzle: no "wrong" or "hint" carries over from the last one.
        cue(index === 0 ? "start" : "next");
      } else {
        if (run.wrong > prev.wrong) cue("wrong");
        if (run.hints.length > prev.hints) cue("hintTaken");
      }
      next.ready = hintStatus(state, now).state === "ready";
      next.locked = machineLockedOut(state, now);
      if (index === prev.index && next.ready && !prev.ready && run.hints.length === prev.hints) cue("hintReady");
      if (index === prev.index && next.locked && !prev.locked) cue("machineMissed");
    } else if (phase !== prev.phase && phase === "revealed" && state.last) {
      const { reason } = state.last;
      if (reason === "solved") cue("solved");
      else if (reason === "machine") cue("machineWon");
      else if (reason === "time") cue("timeUp");
    } else if (phase !== prev.phase && phase === "done") {
      cue(state.score.child > state.score.machine ? "roundWon" : state.score.child === state.score.machine ? "roundTie" : "roundEnd");
    }

    seen.current = next;
  }, [state, now]);
};
