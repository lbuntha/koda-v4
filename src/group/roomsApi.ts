/**
 * The calls every group room makes, whatever game it runs.
 *
 * A guest has no account, so nothing here assumes a bearer token: a seat is
 * named by its own token in `X-Player-Token`, and a signed-in Koda user adds
 * their bearer token only where it matters (opening a room, and being recorded
 * as themselves when joining).
 *
 * `base` is where the game's rooms live: `/rebus/rooms` for Rebus Rush and
 * `/group/rooms` for skill lessons. The door, lobby and lifecycle are the same
 * server handlers under both.
 */

import { request } from "../lib/sync";
import type { AnyRoomView, Choices } from "./types";

/** A room call that is not worth waiting long for: the next poll is a second away. */
export const QUICK_MS = 8_000;

export const asSeat = (token: string): Record<string, string> => ({ "X-Player-Token": token });

/** Where one room's call goes. */
export const roomPath = (base: string, code: string, tail = ""): string => `${base}/${encodeURIComponent(code)}${tail}`;

/** Every member is a call, so a test can mock the whole object by walking its values. */
export const createRoomsApi = <View extends AnyRoomView = AnyRoomView>(base: string) => {
  const path = (code: string, tail = ""): string => roomPath(base, code, tail);
  const post = <T,>(code: string, tail: string, seat: string, body: object = {}, timeoutMs?: number) =>
    request<T>(path(code, tail), { method: "POST", headers: asSeat(seat), body, ...(timeoutMs ? { timeoutMs } : {}) });
  return {
    choices: () => request<Choices>(`${base}/choices`, { timeoutMs: QUICK_MS }),
    /** Anyone joins with the code; a Koda user's token, when there is one, links the seat to them. */
    join: (code: string, body: { name: string; avatar: string }, userToken?: string | null) =>
      request<{ playerToken: string; room: View }>(path(code, "/join"), { method: "POST", body, token: userToken ?? null }),
    poll: (code: string, seat: string, signal?: AbortSignal) => request<View>(path(code), { headers: asSeat(seat), signal, timeoutMs: QUICK_MS }),
    start: (code: string, seat: string) => post<View>(code, "/start", seat),
    lock: (code: string, seat: string, locked: boolean) => post<View>(code, "/lock", seat, { locked }),
    kick: (code: string, seat: string, pid: string) => post<View>(code, "/kick", seat, { pid }),
    /** A guest opened "ask a grown-up". Counted, nothing more. */
    asked: (code: string, seat: string) => post<{ status: string }>(code, "/asked", seat, {}, QUICK_MS),
    accept: (code: string, seat: string, pid: string) => post<View>(code, "/accept", seat, { pid }),
    decline: (code: string, seat: string, pid: string) => post<View>(code, "/decline", seat, { pid }),
    leave: (code: string, seat: string) => post<{ status: string }>(code, "/leave", seat, {}, QUICK_MS),
    rematch: (code: string, seat: string) => post<View>(code, "/rematch", seat),
  };
};

export type RoomsApi<View extends AnyRoomView = AnyRoomView> = ReturnType<typeof createRoomsApi<View>>;
