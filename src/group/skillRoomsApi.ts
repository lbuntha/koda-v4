/** The calls a skill-lesson room makes: the shared room calls on `/group/rooms`, plus opening one and reporting progress. */

import { request } from "../lib/sync";
import { QUICK_MS, asSeat, createRoomsApi, roomPath } from "./roomsApi";
import type { RaceProgress } from "./raceProgress";
import type { Seat, SkillRoomView } from "./types";

const BASE = "/group/rooms";

export interface OpenLessonRoomBody {
  skill: string;
  lesson: string;
  name: string;
  avatar: string;
  language?: "en" | "km";
}

export const SkillRoomsAPI = {
  ...createRoomsApi<SkillRoomView>(BASE),
  /** A signed-in Koda user opens a room for one lesson. */
  open: (body: OpenLessonRoomBody, userToken: string) => request<Seat<SkillRoomView>>(BASE, { method: "POST", body, token: userToken }),
  /** How far this player has got. Safe to send again: the server keeps only the highest counts. */
  progress: (code: string, seat: string, progress: RaceProgress) =>
    request<SkillRoomView>(roomPath(BASE, code, "/progress"), {
      method: "POST",
      headers: asSeat(seat),
      body: progress,
      timeoutMs: QUICK_MS,
    }),
};
