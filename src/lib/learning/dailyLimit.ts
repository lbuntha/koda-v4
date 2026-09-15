import type { DailyLimitReachedEvent } from "./events";
import {
  APP_VERSION,
  LearningLog,
  activeLearnerId,
  currentSessionId,
  localDayOf,
  newEventId,
  nextSeq,
} from "./learningLog";

/**
 * Telling the server that today's time limit was spent, once.
 *
 * The limit is enforced here, on the child's device, because that is where the
 * clock runs and it must hold with no network. The server therefore never knew
 * the moment a child ran out of time — which is exactly what a parent who set
 * the limit wants to hear. This writes that moment into the learning log, which
 * the sync already uploads, and the server tells the parent.
 *
 * Once per child per local day, remembered on the device: the clock keeps
 * ticking past the cap when a round overruns it, and every tick after the first
 * is the same fact.
 */
const NOTED_KEY = "koda_daily_limit_noted_v1";

export function noteDailyLimitReached(
  limitMinutes: number,
  now: Date = new Date(),
  learnerId: string = activeLearnerId(),
): boolean {
  const day = localDayOf(now);
  const key = `${NOTED_KEY}__${learnerId}`;
  try {
    if (localStorage.getItem(key) === day) return false;
    localStorage.setItem(key, day);
  } catch {
    // No storage: the server's own once-a-day claim still stops a repeat.
  }

  const event: DailyLimitReachedEvent = {
    skillId: "",
    activityId: "",
    lessonId: "",
    conceptKey: "",
    id: newEventId(),
    ts: now.toISOString(),
    sessionId: currentSessionId,
    learnerId,
    seq: nextSeq(),
    appVersion: APP_VERSION,
    tzOffsetMinutes: -now.getTimezoneOffset(),
    localDay: day,
    type: "daily_limit_reached",
    limitMinutes,
  };
  LearningLog.record(event);
  return true;
}
