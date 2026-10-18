/**
 * What Rebus Rush sounds like.
 *
 * The app's own synthesised chimes, nothing recorded and nothing fetched, so
 * the game is as loud or as silent offline as online. `playSound` already
 * honours the family's sound setting, so a parent who turned the chimes off
 * has turned them off here too. Every moment has one named cue, in one place:
 * a screen says what happened, this says how it sounds.
 *
 * A loss is never an alarm. The harsh "error" tone is for a wrong answer
 * only, because that is the one moment a child is asked to try again; the
 * Machine getting there first, or time running out, is a soft clink.
 */

import { playSound } from "../utils/audio";

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
  | "roundEnd";

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
  roundEnd: "clink",
};

export const cue = (name: RebusCue): void => playSound(SOUND[name]);
