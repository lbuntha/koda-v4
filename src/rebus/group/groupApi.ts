/**
 * The calls a group room makes.
 *
 * A guest has no account, so nothing here assumes a bearer token: a seat is
 * named by its own token in `X-Player-Token`, and a signed-in Koda user adds
 * their bearer token only where it matters (opening a room, and being recorded
 * as themselves when joining).
 */

import { request } from "../../lib/sync";
import type { Choices, RoomView, Seat } from "./types";

/** A room call that is not worth waiting long for: the next poll is a second away. */
const QUICK_MS = 8_000;

const asSeat = (token: string): Record<string, string> => ({ "X-Player-Token": token });

const path = (code: string, tail = ""): string => `/rebus/rooms/${encodeURIComponent(code)}${tail}`;

export interface OpenRoomBody {
  category: string;
  count: number;
  difficulty: 1 | 2 | 3 | null;
  name: string;
  avatar: string;
  /** The host's language: in Khmer, only puzzles playable in Khmer are dealt. */
  language?: string;
  /** The host's age: the room is dealt puzzles that suit it (to a year either side), when there are enough. */
  age?: number | null;
}

export const GroupAPI = {
  choices: () => request<Choices>("/rebus/rooms/choices", { timeoutMs: QUICK_MS }),

  /** A signed-in Koda user opens a room. */
  open: (body: OpenRoomBody, userToken: string) => request<Seat>("/rebus/rooms", { method: "POST", body, token: userToken }),

  /** Anyone joins with the code; a Koda user's token, when there is one, links the seat to them. */
  join: (code: string, body: { name: string; avatar: string }, userToken?: string | null) =>
    request<Seat>(path(code, "/join"), { method: "POST", body, token: userToken ?? null }),

  poll: (code: string, seat: string, signal?: AbortSignal) => request<RoomView>(path(code), { headers: asSeat(seat), signal, timeoutMs: QUICK_MS }),

  start: (code: string, seat: string) => request<RoomView>(path(code, "/start"), { method: "POST", headers: asSeat(seat), body: {} }),
  lock: (code: string, seat: string, locked: boolean) => request<RoomView>(path(code, "/lock"), { method: "POST", headers: asSeat(seat), body: { locked } }),
  kick: (code: string, seat: string, pid: string) => request<RoomView>(path(code, "/kick"), { method: "POST", headers: asSeat(seat), body: { pid } }),
  /** A guest opened "ask a grown-up". Counted, nothing more. */
  asked: (code: string, seat: string) => request<{ status: string }>(path(code, "/asked"), { method: "POST", headers: asSeat(seat), body: {}, timeoutMs: QUICK_MS }),
  accept: (code: string, seat: string, pid: string) => request<RoomView>(path(code, "/accept"), { method: "POST", headers: asSeat(seat), body: { pid } }),
  decline: (code: string, seat: string, pid: string) => request<RoomView>(path(code, "/decline"), { method: "POST", headers: asSeat(seat), body: { pid } }),
  leave: (code: string, seat: string) => request<{ status: string }>(path(code, "/leave"), { method: "POST", headers: asSeat(seat), body: {}, timeoutMs: QUICK_MS }),
  rematch: (code: string, seat: string) => request<RoomView>(path(code, "/rematch"), { method: "POST", headers: asSeat(seat), body: {} }),
  solve: (code: string, seat: string, index: number, hints: number) =>
    request<{ won: boolean; points: number; room: RoomView }>(path(code, "/solve"), { method: "POST", headers: asSeat(seat), body: { index, hints }, timeoutMs: QUICK_MS }),
};
