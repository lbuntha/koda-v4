import { describe, expect, it } from "vitest";
import { SAMPLE_PUZZLES } from "../fixtures/samplePuzzles";
import { DEFAULT_SETTINGS } from "../settings";
import { playerOf, reduceTurns, standingsOf, startTurns, type TurnsEvent, type TurnsState } from "./engine";

const players = [
  { name: "Brave Tiger", avatar: "tiger" },
  { name: "Clever Fox", avatar: "fox" },
];
const puzzles = SAMPLE_PUZZLES.slice(0, 4);
const game = (over: Partial<Parameters<typeof startTurns>[0]> = {}) => startTurns({ puzzles, players, settings: DEFAULT_SETTINGS, ...over });
const send = (s: TurnsState, ...events: TurnsEvent[]) => events.reduce(reduceTurns, s);
const answerOf = (s: TurnsState) => s.config.puzzles[s.index].answer;

describe("taking turns", () => {
  it("opens on a hand-over, and starts the clock only when the player says they are ready", () => {
    let s = game();
    expect(s.phase).toBe("handover");
    // Time passing while the device is handed over costs nobody anything.
    s = send(s, { type: "tick", now: 500 });
    expect(s.phase).toBe("handover");
    s = send(s, { type: "ready", now: 500 });
    expect(s.phase).toBe("playing");
    expect(s.startedAt).toBe(500);
    expect(send(s, { type: "tick", now: 500 + DEFAULT_SETTINGS.puzzleLimitSec - 1 }).phase).toBe("playing");
  });

  it("gives the puzzles to the players in turn", () => {
    expect([0, 1, 2, 3].map((index) => playerOf({ config: game().config, index }))).toEqual([0, 1, 0, 1]);
  });

  it("scores the player whose turn it is, with hints taking points off, and a wrong answer costing nothing", () => {
    let s = send(game(), { type: "ready", now: 0 });
    s = send(s, { type: "answer", text: "definitely not it", now: 1 });
    expect(s.wrong).toBe(1);
    expect(s.phase).toBe("playing");
    s = send(s, { type: "hint", now: 100 });
    expect(s.hints).toHaveLength(1);
    s = send(s, { type: "answer", text: answerOf(s), now: 101 });
    expect(s.phase).toBe("revealed");
    expect(s.scores).toEqual([DEFAULT_SETTINGS.pointsPerPuzzle - DEFAULT_SETTINGS.hintCost, 0]);
    expect(s.last).toMatchObject({ player: 0, reason: "solved", hints: 1 });
  });

  it("refuses a hint before the owner's delay is up", () => {
    const s = send(game(), { type: "ready", now: 0 }, { type: "hint", now: 1 });
    expect(s.hints).toHaveLength(0);
  });

  it("scores nobody when the time runs out or the player passes, and the next puzzle goes to the next player", () => {
    let s = send(game(), { type: "ready", now: 0 }, { type: "tick", now: DEFAULT_SETTINGS.puzzleLimitSec });
    expect(s.last).toMatchObject({ reason: "time", points: 0, player: 0 });
    s = send(s, { type: "next", now: 70 });
    expect(s.phase).toBe("handover");
    expect(playerOf(s)).toBe(1);
    s = send(s, { type: "ready", now: 80 }, { type: "skip", now: 81 });
    expect(s.last).toMatchObject({ reason: "skipped", player: 1, points: 0 });
    expect(s.scores).toEqual([0, 0]);
  });

  it("plays through to the end and ranks the players, equal scores sharing a place", () => {
    let s = game();
    const win = (s0: TurnsState) => send(s0, { type: "ready", now: 0 }, { type: "answer", text: answerOf(s0), now: 1 });
    // Player 0 solves their two puzzles, player 1 passes on theirs.
    s = win(s);
    s = send(s, { type: "next", now: 2 });
    s = send(s, { type: "ready", now: 3 }, { type: "skip", now: 4 }, { type: "next", now: 5 });
    s = win(s);
    s = send(s, { type: "next", now: 6 });
    s = send(s, { type: "ready", now: 7 }, { type: "skip", now: 8 }, { type: "next", now: 9 });
    expect(s.phase).toBe("done");
    expect(standingsOf(s)).toEqual([
      { player: 0, place: 1, score: DEFAULT_SETTINGS.pointsPerPuzzle * 2, solved: 2 },
      { player: 1, place: 2, score: 0, solved: 0 },
    ]);
    expect(standingsOf({ scores: [3, 3, 1], outcomes: [] }).map((x) => x.place)).toEqual([1, 1, 3]);
  });

  it("needs two to four players and at least one puzzle", () => {
    expect(() => game({ players: [players[0]] })).toThrow();
    expect(() => game({ puzzles: [] })).toThrow();
  });
});
