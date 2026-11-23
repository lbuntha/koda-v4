import type { AnyRoomView } from "./types";
import type { RoomFeed } from "./useRoom";

/**
 * Why this player is out of the room, as a key in the language files.
 *
 * One answer for every game's room, so Rebus and a lesson race never say
 * different things about the same event.
 */
export const roomGoneKey = (room: AnyRoomView | null, goneBecause: RoomFeed["goneBecause"]): string => {
  if (goneBecause === "hostLeft") return room?.me.isHost ? "rebus.group.hostLeftYou" : "rebus.group.hostLeft";
  // Still at the door when the room went: the host said no.
  if (room?.status === "pending") return "rebus.group.declined";
  if (goneBecause === "removed") return "rebus.group.removed";
  return "rebus.group.closed";
};
