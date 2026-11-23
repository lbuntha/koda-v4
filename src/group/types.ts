/**
 * A group room as the server describes it (`server/app/routers/rebus_rooms.py`, `_view`).
 *
 * Shared by every game a room can run: a Rebus race (puzzles, first claim wins)
 * and a skill lesson (everyone plays the same round from the room's seed). The
 * door, the lobby, the seats and the standings are the same for both.
 */

/** "pending": at the door, waiting for the host to accept. */
export type RoomStatus = "pending" | "lobby" | "playing" | "finished";

export interface RoomPlayer {
  pid: string;
  name: string;
  avatar: string;
  /** Rebus: points won. Skill race: answers right first time. */
  score: number;
  /** Rebus: puzzles won. Skill race: questions finished. */
  solved: number;
  isHost: boolean;
  /** Signed in to Koda. The only thing a room says about anyone's account. */
  isKodaUser: boolean;
  connected: boolean;
  /** Skill race: this player has finished their round. */
  done?: boolean;
}

/** Someone at the door, as the host sees them. */
export interface RoomRequest {
  pid: string;
  name: string;
  avatar: string;
  isKodaUser: boolean;
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

/** What a skill-lesson room was opened for. */
export interface SkillRoomSettings {
  game: "skill";
  skill: string;
  lesson: string;
  title: string;
  /** Questions in the round. */
  count: number;
  language: "en" | "km";
  maxPlayers: number;
  limitSec: number;
}

export interface RoomView<Settings = object, Puzzle = unknown> {
  code: string;
  status: RoomStatus;
  locked: boolean;
  settings: Settings;
  players: RoomPlayer[];
  me: { pid: string; isHost: boolean; isKodaUser: boolean };
  /** The server's clock when this was sent, so a device can tell how far its own is off. */
  nowMs: number;
  /** Only the host gets this: who is waiting to be let in. */
  requests?: RoomRequest[];
  // While playing or finished:
  total?: number;
  results?: PuzzleResult[];
  standings?: Standing[];
  /** Skill race: every device builds its questions from this. */
  seed?: string;
  // While playing:
  index?: number;
  puzzle?: Puzzle;
  startMs?: number;
  limitMs?: number;
  endedMs?: number | null;
  revealUntilMs?: number | null;
  result?: PuzzleResult | null;
}

export type SkillRoomView = RoomView<SkillRoomSettings>;

/** Any game's room, for code that only touches the shared parts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRoomView = RoomView<any, any>;

export interface Seat<View = RoomView> {
  playerToken: string;
  room: View;
}

export interface Choices {
  nicknames: string[];
  avatars: string[];
}
