import React from "react";

import { Moon, Sparkles } from "lucide-react";

import { hourLabel } from "../lib/sessionTime";
import { themeSystem } from "../lib/themeSystem";
import { UIButton } from "./ui";

export interface KodaAsleepScreenProps {
  /** The hour Koda opens again, so the screen can name it. */
  opensAt: number;
  /** Somewhere to go that is not a lesson. */
  onGoHome?: () => void;
}

/**
 * What a child sees outside the hours their grown-up opened.
 *
 * A sibling of `DayDoneScreen` rather than a prop on it, because the two say
 * different things for different reasons: one is "you have had your time", this
 * is "come back later". Folding them together would have produced a screen
 * whose every sentence was a ternary, and a child reading "that's it for today"
 * at seven in the morning.
 *
 * Written for a five-year-old and framed as Koda's state, not the child's
 * fault: Koda is asleep, and it says when Koda wakes up, so the child is left
 * with a time rather than a refusal. No way back into a lesson, for the reason
 * `DayDoneScreen` gives at length — a rule a child can tap past is not a rule,
 * and an override here would move the argument off the parent's screen.
 */
export const KodaAsleepScreen: React.FC<KodaAsleepScreenProps> = ({ opensAt, onGoHome }) => (
  <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
    <div className={themeSystem.card("default", "w-full max-w-md p-8 text-center")}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/60">
        <Moon className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
      </div>

      <h2 className="mt-4 font-mono text-xl font-black tracking-tight text-ink">
        Koda is asleep
      </h2>

      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Koda wakes up at {hourLabel(opensAt)}. Your grown-up picked that, so come back and find
        him then.
      </p>

      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-surface-muted p-3">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
        <p className="text-sm font-bold text-ink">Everything you earned is saved.</p>
      </div>

      {onGoHome && (
        <UIButton variant="secondary" className="mt-5" onClick={onGoHome}>
          Back home
        </UIButton>
      )}
    </div>
  </div>
);
