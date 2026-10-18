/**
 * What Rebus Rush sounds like.
 *
 * The app's own synthesised chimes, nothing recorded and nothing fetched, so
 * the game is as loud or as silent offline as online. `playSound` already
 * honours the family's sound setting, so a parent who turned the chimes off
 * has turned them off here too. Every moment has one named cue, in one place:
 * a screen says what happened, this says how it sounds.
 *
 * Some cues are also said aloud, from Rebus Rush's own recorded lines
 * (`src/voice/rebus`). Speech is its own switch, separate from the chimes, and
 * a line that was never recorded is simply not said: the game never waits on a
 * network and never reads a stranger's voice out of a speaker.
 *
 * A loss is never an alarm. The harsh "error" tone is for a wrong answer
 * only, because that is the one moment a child is asked to try again; the
 * Machine getting there first, or time running out, is a soft clink.
 */

import { playReaction } from "../lib/voiceClips";
import { isVoiceEnabled, playSound } from "../utils/audio";
import { REBUS_VOICE } from "../voice/rebus";

export type RebusCue =
  | "start"
  | "pick"
  | "next"
  | "wrong"
  | "hintReady"
  | "hintTaken"
  | "machineMissed"
  | "solved"
  | "machineWon"
  | "timeUp"
  | "roundWon"
  | "roundTie"
  | "roundEnd"
  | "friendWon"
  | "groupWon"
  | "groupEnd";

const SOUND: Record<RebusCue, Parameters<typeof playSound>[0]> = {
  start: "pop",
  pick: "pop",
  next: "page",
  wrong: "error",
  hintReady: "pop",
  hintTaken: "hint",
  machineMissed: "pop",
  solved: "success",
  machineWon: "clink",
  timeUp: "clink",
  roundWon: "levelup",
  roundTie: "success",
  roundEnd: "clink",
  friendWon: "clink",
  groupWon: "levelup",
  groupEnd: "success",
};

/** The reaction group each cue says, where it says anything. */
const SAY: Partial<Record<RebusCue, string>> = {
  start: "rebus-start",
  next: "rebus-next",
  wrong: "rebus-wrong",
  machineMissed: "rebus-machineMissed",
  solved: "rebus-solved",
  machineWon: "rebus-machineWon",
  timeUp: "rebus-timeUp",
  roundWon: "rebus-roundWon",
  roundTie: "rebus-roundTie",
  roundEnd: "rebus-roundEnd",
  friendWon: "rebus-friendWon",
  groupWon: "rebus-groupWon",
  groupEnd: "rebus-groupEnd",
};

export const cue = (name: RebusCue): void => {
  playSound(SOUND[name]);
  const line = SAY[name];
  if (line && isVoiceEnabled()) playReaction(line, 1, REBUS_VOICE);
};
