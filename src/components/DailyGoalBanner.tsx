import React, { useState } from "react";
import { PartyPopper } from "lucide-react";

import { useStreak } from "../lib/streak";
import { currentLearnerId } from "../lib/learnerProgress";
import type { UserProgress } from "../types";
import { UIBanner } from "./ui/UIBanner";

/**
 * The line a child reads when they have finished today's goal.
 *
 * The counterpart to `WelcomeBack`, and the two can never both speak: that band
 * is about a gap, and this one only exists on a day with practice in it. The
 * sidebar already *counts* — "4 / 5 lessons today" — which is a measure, not a
 * moment. Reaching the goal is the moment, and it was passing silently.
 *
 * What it refuses to do is as deliberate as what it says:
 *
 *   - **It never asks for more.** No "keep going", no next target, no second
 *     goal appearing the instant the first is met. The goal a family set is the
 *     finish line, and moving it the moment a child arrives is how a goal stops
 *     meaning anything.
 *   - **It never mentions a streak a child does not have.** One day in is not a
 *     streak, and "1-day streak" said to a five-year-old is a number pretending
 *     to be an achievement — the same rule `WelcomeBack` keeps.
 *   - **It goes when it is dismissed, and does not come back that day.** Kept
 *     per learner and per day, so a shared tablet does not hand one child's
 *     dismissal to another, and tomorrow's goal gets its own moment.
 */
const SEEN_KEY = "koda_goal_met_seen_v1";

const seenKeyFor = (learnerId: string): string => `${SEEN_KEY}__${learnerId}`;

const wasSeen = (learnerId: string, day: string): boolean => {
  try {
    return localStorage.getItem(seenKeyFor(learnerId)) === day;
  } catch {
    return false;
  }
};

const remember = (learnerId: string, day: string): void => {
  try {
    localStorage.setItem(seenKeyFor(learnerId), day);
  } catch {
    // A blocked store costs one repeat of a congratulation. Nothing else.
  }
};

/** What the card says under its title, given the run behind today. */
export const streakLine = (days: number, cadence: "daily" | "weekly"): string => {
  if (days < 2) return "Come back tomorrow to start a streak.";
  return cadence === "weekly"
    ? `That's ${days} weeks in a row.`
    : `That's ${days} days in a row.`;
};

export const DailyGoalBanner: React.FC<{ userProgress: UserProgress }> = ({ userProgress }) => {
  const streak = useStreak(userProgress);
  const goal = Math.max(1, userProgress.dailyGoal);
  // The day this counts for is the day the record last practised on — which,
  // while `solvedToday` is above zero, is today on the learner's own clock.
  const day = userProgress.lastPracticeDay ?? "";
  const learnerId = currentLearnerId();
  const [dismissed, setDismissed] = useState(() => wasSeen(learnerId, day));

  if (streak.solvedToday < goal || dismissed) return null;

  return (
    <UIBanner
      tone="success"
      tinted
      // The card arrives with a small overshoot and the popper pops a beat
      // later. Both are finite, and both stop for a reduced-motion setting.
      className="koda-celebrate"
      icon={<PartyPopper className="koda-celebrate-icon" />}
      title={`Goal met — ${streak.solvedToday} of ${goal} today`}
      dismissLabel="Dismiss goal met message"
      onDismiss={() => {
        remember(learnerId, day);
        setDismissed(true);
      }}
    >
      {streakLine(streak.days, streak.cadence)}
    </UIBanner>
  );
};
