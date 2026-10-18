/** A group room as the server describes it (`routers/rebus_rooms.py`, `_view`). */

import type { Puzzle } from "../types";

export type RoomStatus = "lobby" | "playing" | "finished";

export interface RoomPlayer {
  pid: string;
  name: string;
  avatar: string;
  score: number;
  solved: number;
  isHost: boolean;
  /** Signed in to Koda. The only thing a room says about anyone's account. */
  isKodaUser: boolean;
  connected: boolean;
}

export interface RoomSettings {
  category: string;
  count: number;
  difficulty: 1 | 2 | 3 | null;
  maxPlayers: number;
  hintDelaySec: number;
  puzzleLimitSec: number;
  hintRungs: 1 | 2 | 3;
  pointsPerPuzzle: number;
  hintCost: number;
}

export interface PuzzleResult {
  index: number;
  winnerPid: string | null;
  points: number;
  hints: number;
  atMs: number;
}

export interface Standing {
  pid: string;
  place: number;
  score: number;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  locked: boolean;
  settings: RoomSettings;
  players: RoomPlayer[];
  me: { pid: string; isHost: boolean; isKodaUser: boolean };
  /** The server's clock when this was sent, so a device can tell how far its own is off. */
  nowMs: number;
  // While playing or finished:
  total?: number;
  results?: PuzzleResult[];
  standings?: Standing[];
  // While playing:
  index?: number;
  puzzle?: Puzzle;
  startMs?: number;
  limitMs?: number;
  endedMs?: number | null;
  revealUntilMs?: number | null;
  result?: PuzzleResult | null;
}

export interface Seat {
  playerToken: string;
  room: RoomView;
}

export interface Choices {
  nicknames: string[];
  avatars: string[];
}
