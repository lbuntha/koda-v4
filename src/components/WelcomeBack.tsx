import React, { useState } from "react";
import { Flame, Sparkles, X } from "lucide-react";

import { useAbsence } from "../lib/absence";
import { themeSystem } from "../lib/themeSystem";
import type { UserProgress } from "../types";

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
 * It keeps no state of its own. Nothing is dismissed and nothing is marked
 * seen, so there is no flag to get stuck on: the band stands while it is true
 * and goes the moment the child finishes a round. `observeAbsence` holds every
 * rule about when it is true at all, including the two silences that matter —
 * a family who has switched streaks off, and a learner who has never started.
 */
export const WelcomeBack: React.FC<{ userProgress: UserProgress }> = ({ userProgress }) => {
  const absence = useAbsence(userProgress);
  const [closing, setClosing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (absence.state === "quiet") return null;
  if (dismissed) return null;

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
    <div
      className={`${themeSystem.flash("info")} relative overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-[0_10px_30px_-16px_rgba(79,70,229,0.55)] transition-all duration-300 ${closing ? "translate-y-1 scale-[0.98] opacity-0" : "animate-[fade-in_300ms_ease-out]"}`}
      role="status"
    >
      {away ? (
        <Sparkles className="w-5 h-5 shrink-0" aria-hidden="true" />
      ) : (
        <Flame className="w-5 h-5 shrink-0 fill-current" aria-hidden="true" />
      )}
      <span className="pr-6 font-bold">{message}</span>
      <button
        type="button"
        aria-label="Dismiss welcome back message"
        onClick={() => {
          setClosing(true);
          window.setTimeout(() => setDismissed(true), 280);
        }}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sky-700/70 transition hover:bg-white/80 hover:text-sky-950 active:scale-90 dark:text-sky-200/70 dark:hover:bg-sky-950/40 dark:hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
