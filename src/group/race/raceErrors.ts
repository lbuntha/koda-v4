import { ApiError } from "../../lib/sync";
import { roomErrorKey } from "../../rebus/group/errors";

/** A room error in the player's words: the Rebus door's, plus what only a lesson room can say. */
export const raceErrorKey = (e: unknown): string => {
  if (e instanceof ApiError && ["group_unsupported", "skill_not_found", "lesson_not_found"].includes(e.code)) return `race.err.${e.code}`;
  return roomErrorKey(e);
};
