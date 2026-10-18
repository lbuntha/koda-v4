/**
 * A finished group game, in the learning log and in XP, for a signed-in player.
 *
 * It is the same record a solo round leaves (`RebusRecorder`, the deployment's
 * stars and XP, the per-puzzle memory that tells a replay), so the parent's
 * summary and the XP bar cannot tell a race from a round, and nothing here is a
 * second economy. A guest has no account to write to and records nothing.
 *
 * The room only sends the live puzzle, so the puzzles are collected as they are
 * shown. One a device never saw (it was asleep) is left out rather than guessed.
 * A friend winning a puzzle is logged like the Machine winning one: an
 * unanswered puzzle, not a mistake, so it never counts against the child.
 */

import { useEffect, useRef, useState } from "react";
import { ScoringAPI } from "../../lib/scoring";
import type { PuzzleOutcome } from "../engine";
import { RebusRecorder } from "../learning";
import { rebusReward, type RebusReward } from "../reward";
import { loadResults, saveOutcome } from "../resultsStore";
import type { RebusSettings } from "../settings";
import type { CategoryId, Puzzle } from "../types";
import type { RoomView } from "./types";

export interface GroupLearningOptions {
  settings: RebusSettings;
  onAwardXp?(xp: number): void;
}

export interface GroupReward extends RebusReward {
  /** Every puzzle was played before: stars, but no XP. */
  replay: boolean;
}

/** What each puzzle of the game came to for this player. */
export const outcomesFor = (room: RoomView, puzzles: ReadonlyMap<number, Puzzle>): PuzzleOutcome[] => {
  const out: PuzzleOutcome[] = [];
  for (const result of [...(room.results ?? [])].sort((a, b) => a.index - b.index)) {
    const puzzle = puzzles.get(result.index);
    if (!puzzle) continue;
    const mine = result.winnerPid === room.me.pid;
    const winner = mine ? "child" : result.winnerPid ? "machine" : "none";
    out.push({
      puzzle,
      winner,
      reason: mine ? "solved" : result.winnerPid ? "machine" : "time",
      points: mine ? result.points : 0,
      hintsUsed: mine ? result.hints : 0,
      wrong: 0,
      seconds: Math.round(result.atMs / 1000),
    });
  }
  return out;
};

export const useGroupLearning = (room: RoomView | null, { settings, onAwardXp }: GroupLearningOptions): GroupReward | null => {
  const puzzles = useRef(new Map<number, Puzzle>());
  const paid = useRef(false);
  const award = useRef(onAwardXp);
  award.current = onAwardXp;
  const [earned, setEarned] = useState<GroupReward | null>(null);

  useEffect(() => {
    if (!room) return;
    if (room.status === "lobby" || room.status === "pending") {
      // A new game: forget the last one.
      puzzles.current.clear();
      paid.current = false;
      setEarned(null);
      return;
    }
    if (room.status === "playing" && room.puzzle && room.index !== undefined) puzzles.current.set(room.index, room.puzzle);
    if (room.status !== "finished" || paid.current || !room.me.isKodaUser) return;
    paid.current = true;

    const outcomes = outcomesFor(room, puzzles.current);
    if (outcomes.length === 0) return;
    const before = loadResults();
    const replay = outcomes.every((o) => before[o.puzzle.id] !== undefined);
    const scoring = ScoringAPI.current();
    const reward = rebusReward(outcomes, { ...scoring, xpPerLevel: settings.xpPerRound ?? scoring.xpPerLevel });
    const xp = replay ? 0 : reward.xp;

    const ages = outcomes.map((o) => o.puzzle.ages);
    const recorder = new RebusRecorder({
      category: room.settings.category as CategoryId | "mixed",
      ages: [Math.min(...ages.map((a) => a[0])), Math.max(...ages.map((a) => a[1]))],
      replay,
    });
    outcomes.forEach((o, i) => {
      recorder.present(o.puzzle, i);
      for (let h = 1; h <= o.hintsUsed; h++) recorder.hint(h);
      recorder.settle(o);
      saveOutcome(o);
    });
    recorder.complete(reward.stars, xp);
    if (xp > 0) award.current?.(xp);
    setEarned({ ...reward, xp, replay });
  }, [room, settings.xpPerRound]);

  return earned;
};
