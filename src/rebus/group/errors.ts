import { ApiError } from "../../lib/sync";

/** What went wrong joining or opening a room, in the player's words (a key in the language files). */
export const roomErrorKey = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.isOffline) return "rebus.group.err.offline";
    const known = ["room_not_found", "name_taken", "room_full", "room_locked", "room_started", "group_off", "need_players", "not_enough_puzzles", "bad_nickname", "bad_avatar", "too_many_attempts"];
    if (known.includes(e.code)) return `rebus.group.err.${e.code}`;
    if (e.status === 401) return "rebus.group.err.signIn";
  }
  return "rebus.group.err.other";
};
