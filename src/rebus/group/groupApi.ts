/**
 * The calls a Rebus room makes: the shared room calls (`group/roomsApi.ts`) on
 * `/rebus/rooms`, plus opening a room and claiming a puzzle, which only Rebus has.
 */

import { request } from "../../lib/sync";
import { QUICK_MS, asSeat, createRoomsApi, roomPath } from "../../group/roomsApi";
import type { RoomView, Seat } from "./types";

const rooms = createRoomsApi<RoomView>("/rebus/rooms");

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
  ...rooms,
  /** A signed-in Koda user opens a room. */
  open: (body: OpenRoomBody, userToken: string) => request<Seat>("/rebus/rooms", { method: "POST", body, token: userToken }),
  solve: (code: string, seat: string, index: number, hints: number) =>
    request<{ won: boolean; points: number; room: RoomView }>(roomPath("/rebus/rooms", code, "/solve"), {
      method: "POST",
      headers: asSeat(seat),
      body: { index, hints },
      timeoutMs: QUICK_MS,
    }),
};
