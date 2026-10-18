/**
 * Taking turns on one device: the rules, with no clock of its own.
 *
 * Two to four players share a screen. Puzzle after puzzle goes round the
 * players in order; whoever's turn it is gets the puzzle alone, with the same
 * hints, the same time limit and the same points as a game against the Machine.
 * Between turns the screen says who to pass the device to, and the clock does
 * not run while it is being passed. Most points at the end wins; equal points
 * share a place.
 *
 * It is a reducer over a state, with the time handed in, like the solo engine,
 * so a whole game can be played in a test. It needs no network at all.
 */

import { matchAnswer } from "../answer";
import { hintFor, hintState, pointsFor, type Hint, type HintState } from "../hints";
import type { RebusSettings } from "../settings";
import type { Puzzle } from "../types";

export interface TurnPlayer {
  /** From the fixed nickname list, never typed. */
  name: string;
  avatar: string;
}

export interface TurnsConfig {
  puzzles: readonly Puzzle[];
  players: readonly TurnPlayer[];
  settings: RebusSettings;
}

/** `handover`: pass the device, nothing is running. `playing`, `revealed` (the answer), `done`. */
export type TurnsPhase = "handover" | "playing" | "revealed" | "done";

export interface TurnOutcome {
  index: number;
  /** Which player (an index into `config.players`) had the turn. */
  player: number;
  puzzle: Puzzle;
  reason: "solved" | "time" | "skipped";
  hints: number;
  points: number;
  seconds: number;
}

export interface TurnsState {
  phase: TurnsPhase;
  config: TurnsConfig;
  index: number;
  startedAt: number;
  lastHintAt: number;
  hints: Hint[];
  wrong: number;
  scores: number[];
  outcomes: TurnOutcome[];
  last: TurnOutcome | null;
}

export type TurnsEvent =
  | { type: "ready"; now: number }
  | { type: "tick"; now: number }
  | { type: "answer"; text: string; now: number }
  | { type: "hint"; now: number }
  | { type: "skip"; now: number }
  | { type: "next"; now: number };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const startTurns = (config: TurnsConfig): TurnsState => {
  if (config.puzzles.length === 0) throw new Error("A game needs at least one puzzle.");
  if (config.players.length < MIN_PLAYERS || config.players.length > MAX_PLAYERS) throw new Error("A game is for two to four players.");
  return { phase: "handover", config, index: 0, startedAt: 0, lastHintAt: 0, hints: [], wrong: 0, scores: config.players.map(() => 0), outcomes: [], last: null };
};

/** Whose turn it is: the puzzles go round the players in order. */
export const playerOf = (state: Pick<TurnsState, "config" | "index">): number => state.index % state.config.players.length;

export const elapsedOf = (state: TurnsState, now: number): number => Math.max(0, now - state.startedAt);

export const hintStatus = (state: TurnsState, now: number): HintState => hintState(state.config.settings, state.hints.length, state.lastHintAt, now);

const finish = (state: TurnsState, reason: TurnOutcome["reason"], now: number): TurnsState => {
  const player = playerOf(state);
  const puzzle = state.config.puzzles[state.index];
  const points = reason === "solved" ? pointsFor(state.hints.length, state.config.settings) : 0;
  const outcome: TurnOutcome = { index: state.index, player, puzzle, reason, hints: state.hints.length, points, seconds: Math.round(elapsedOf(state, now)) };
  return {
    ...state,
    phase: "revealed",
    scores: state.scores.map((s, i) => (i === player ? s + points : s)),
    outcomes: [...state.outcomes, outcome],
    last: outcome,
  };
};

export const reduceTurns = (state: TurnsState, event: TurnsEvent): TurnsState => {
  switch (event.type) {
    case "ready":
      return state.phase === "handover" ? { ...state, phase: "playing", startedAt: event.now, lastHintAt: event.now, hints: [], wrong: 0, last: null } : state;
    case "tick":
      return state.phase === "playing" && elapsedOf(state, event.now) >= state.config.settings.puzzleLimitSec ? finish(state, "time", event.now) : state;
    case "answer": {
      if (state.phase !== "playing") return state;
      if (matchAnswer(state.config.puzzles[state.index], event.text).ok) return finish(state, "solved", event.now);
      return { ...state, wrong: state.wrong + 1 };
    }
    case "hint": {
      if (state.phase !== "playing") return state;
      const status = hintStatus(state, event.now);
      if (status.state !== "ready") return state;
      return { ...state, hints: [...state.hints, hintFor(state.config.puzzles[state.index], status.rung)], lastHintAt: event.now };
    }
    case "skip":
      return state.phase === "playing" ? finish(state, "skipped", event.now) : state;
    case "next": {
      if (state.phase !== "revealed") return state;
      if (state.index + 1 >= state.config.puzzles.length) return { ...state, phase: "done" };
      return { ...state, phase: "handover", index: state.index + 1, last: null, hints: [], wrong: 0 };
    }
  }
};

export interface TurnStanding {
  player: number;
  place: number;
  score: number;
  /** Puzzles this player solved. */
  solved: number;
}

/** Players by score, highest first; equal scores share a place and keep their seating order. */
export const standingsOf = (state: Pick<TurnsState, "scores" | "outcomes">): TurnStanding[] => {
  const ranked = state.scores
    .map((score, player) => ({ player, score, solved: state.outcomes.filter((o) => o.player === player && o.reason === "solved").length }))
    .sort((a, b) => b.score - a.score || a.player - b.player);
  let place = 0;
  let last: number | null = null;
  return ranked.map((r, i) => {
    if (r.score !== last) {
      place = i + 1;
      last = r.score;
    }
    return { ...r, place };
  });
};
