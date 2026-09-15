import React, { useState } from "react";
import { Flame, Hand } from "lucide-react";

import { useAbsence } from "../lib/absence";
import type { UserProgress } from "../types";
import { UIBanner } from "./ui/UIBanner";

/**
 * The line a child reads when they have been away.
 *
 * Koda knew perfectly well that somebody had not practised for a week and had
 * nowhere to say so: the rule was computed for the flame and for a parent's
 * notification, and the child — the one person who could do something about it
 * — opened the app to a screen that behaved as though they had never left.
 *
 * A band above Today rather than a modal, and that is the whole of the design.
 * A dialogue stands between a six-year-old and the thing they opened the app to
 * do, has to be dismissed before it can be understood, and is read as a telling
 * off however it is worded. This is a sentence over the cards that answer it —
 * whatever it says, the next tap is already on screen underneath.
 *
 * Closing it lasts until the next launch and nothing is stored, so there is no
 * flag to get stuck on: the band stands while it is true and goes the moment
 * the child finishes a round. `observeAbsence` holds every rule about when it
 * is true at all, including the two silences that matter — a family who has
 * switched streaks off, and a learner who has never started.
 */
export const WelcomeBack: React.FC<{ userProgress: UserProgress }> = ({ userProgress }) => {
  const absence = useAbsence(userProgress);
  const [dismissed, setDismissed] = useState(false);
  if (absence.state === "quiet" || dismissed) return null;

  /*
   * What it says, and what it refuses to.
   *
   * Never a number that was lost, never a countdown, never the word "missed".
   * A child who has been away for a fortnight is being welcomed, not audited —
   * and the sentence has to work at six and at sixteen, which rules out both
   * baby talk and a guilt trip. `daysAway` is the one figure either line
   * carries, because it is the only one that is simply a fact.
   */
  const away = absence.state === "away";
  const message = away
    ? `It's been ${absence.daysAway} days. Pick anything below to start again.`
    : absence.streakDays === 1
      ? "You practised yesterday — one round keeps it going."
      : `Your ${absence.streakDays}-day streak is waiting.`;

  return (
    <UIBanner
      tone={away ? "primary" : "streak"}
      icon={away ? <Hand /> : <Flame className="fill-current" />}
      onDismiss={() => setDismissed(true)}
      dismissLabel="Dismiss welcome back message"
    >
      {message}
    </UIBanner>
  );
};
