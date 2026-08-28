import React from "react";
import { Moon, Sparkles } from "lucide-react";

import { themeSystem } from "../lib/themeSystem";
import { UIButton } from "./ui";

export interface DayDoneScreenProps {
  /** Minutes the grown-up set, so the screen can say what the rule was. */
  cap: number;
  /** Somewhere to go that is not a lesson. */
  onGoHome?: () => void;
}

/**
 * What a child sees when their time for today is up.
 *
 * Written to be read by a five-year-old and to be *kind*. The rule is a
 * grown-up's, so the screen says so plainly rather than implying the child did
 * something wrong — and it closes on what they achieved rather than on what
 * they may not do. Nothing here is a score, a lost streak or a warning.
 *
 * No "just five more minutes" button, deliberately. A cap with an override a
 * child can reach is not a cap, and putting one here would move the argument
 * from the parent's screen to the child's.
 */
export const DayDoneScreen: React.FC<DayDoneScreenProps> = ({ cap, onGoHome }) => (
  <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
    <div className={themeSystem.card("default", "w-full max-w-md p-8 text-center")}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/60">
        <Moon className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
      </div>

      <h2 className="mt-4 font-mono text-xl font-black tracking-tight text-ink">
        That&rsquo;s it for today
      </h2>

      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        You have had your {cap} minutes of Koda today. Your grown-up picked that, and it starts
        again tomorrow.
      </p>

      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-surface-muted p-3">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-sm font-bold text-ink">Everything you earned today is saved.</p>
      </div>

      {onGoHome && (
        <UIButton variant="secondary" className="mt-5" onClick={onGoHome}>
          Back home
        </UIButton>
      )}
    </div>
  </div>
);
