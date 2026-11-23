/** Rebus rooms are kept up to date by the shared room feed, asking the Rebus rooms API. */

import { useRoom as useSharedRoom, type RoomFeed } from "../../group/useRoom";
import { GroupAPI } from "./groupApi";
import type { RoomView } from "./types";

export { POLL_MS, type Link } from "../../group/useRoom";
export type { RoomFeed };

export const useRoom = (code: string | null, seat: string | null, initial: RoomView | null = null): RoomFeed<RoomView> =>
  useSharedRoom<RoomView>(GroupAPI.poll, code, seat, initial);
