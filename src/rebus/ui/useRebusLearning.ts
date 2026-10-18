/**
 * Writes the round into the learning log, and pays out the XP, as it plays.
 *
 * Watches the engine's state the way the sound hook does, so the log can
 * never disagree with what the child saw: each puzzle shown, each wrong try,
 * each hint, each ending. The round is paid once, when the summary is reached.
 */

import { useEffect, useRef, useState } from "react";
import { ScoringAPI } from "../../lib/scoring";
import type { AgeRange } from "../../lib/ages";
import { RebusRecorder } from "../learning";
import { rebusReward, type RebusReward } from "../reward";
import type { CategoryId } from "../types";
import type { RebusRound } from "./useRebusRound";

export interface RebusLearningOptions {
  category: CategoryId | "mixed" | null;
  ages: AgeRange | null;
  /** Every puzzle in this round was played before: it still counts for stars and the log, but pays no XP. */
  replay?: boolean;
  /** Called once per finished round with the XP it earned. */
  onAwardXp?(xp: number): void;
}

/** What the finished round earned, or null while it is still going. */
export const useRebusLearning = ({ state }: RebusRound, { category, ages, replay = false, onAwardXp }: RebusLearningOptions): RebusReward | null => {
  const recorder = useRef<RebusRecorder | null>(null);
  const seen = useRef<{ index: number; wrong: number; hints: number; phase: string; config: unknown }>({ index: -1, wrong: 0, hints: 0, phase: "", config: null });
  const [earned, setEarned] = useState<RebusReward | null>(null);
  const award = useRef(onAwardXp);
  award.current = onAwardXp;
  const isReplay = useRef(replay);
  isReplay.current = replay;

  useEffect(() => {
    if (!state) {
      // The round was left: an unfinished one is closed as abandoned.
      recorder.current?.abandon();
      recorder.current = null;
      seen.current = { index: -1, wrong: 0, hints: 0, phase: "", config: null };
      setEarned(null);
      return;
    }
    // A new round gets its own recorder, so a replay is logged as practice and a first play is not.
    if (recorder.current && state.config !== seen.current.config && state.phase === "playing") {
      recorder.current.abandon();
      recorder.current = null;
    }
    if (!recorder.current) recorder.current = new RebusRecorder({ category: category ?? "mixed", ages, replay: isReplay.current });
    const rec = recorder.current;
    const prev = seen.current;
    const { run, phase, index } = state;

    if (phase === "playing") {
      // A new puzzle, or the first of a new round (a rematch of one puzzle keeps index 0).
      if (index !== prev.index || state.config !== prev.config) {
        rec.present(run.puzzle, index);
        if (state.config !== prev.config) setEarned(null);
      }
      else {
        for (let i = prev.wrong; i < run.wrong; i++) rec.wrong(run.puzzle);
        for (let i = prev.hints; i < run.hints.length; i++) rec.hint(i + 1);
      }
    } else if (phase === "revealed" && prev.phase !== "revealed" && state.last) {
      // Whatever happened in the instant before the reveal is settled first.
      for (let i = prev.wrong; i < run.wrong; i++) rec.wrong(run.puzzle);
      for (let i = prev.hints; i < run.hints.length; i++) rec.hint(i + 1);
      rec.settle(state.last);
    } else if (phase === "done" && prev.phase !== "done") {
      // The deployment's stars and shares, with the owner's XP for a perfect round when one is set.
      const scoring = ScoringAPI.current();
      const paid = rebusReward(state.outcomes, { ...scoring, xpPerLevel: state.config.settings.xpPerRound ?? scoring.xpPerLevel });
      const reward = isReplay.current ? { ...paid, xp: 0 } : paid;
      rec.complete(reward.stars, reward.xp);
      if (reward.xp > 0) award.current?.(reward.xp);
      setEarned(reward);
    }

    seen.current = { index, wrong: run.wrong, hints: run.hints.length, phase, config: state.config };
  }, [state, category, ages]);

  // Leaving the page mid-round is leaving the round.
  useEffect(() => () => recorder.current?.abandon(), []);

  return earned;
};
