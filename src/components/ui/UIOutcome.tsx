import React from "react";
import { ArrowRight, Hand, Hourglass, PartyPopper, SkipForward } from "lucide-react";
import { UIBurst } from "./UIBurst";
import { UIButton } from "./ThemeUI";

export type UIOutcomeKind = "correct" | "timeUp" | "beaten" | "skipped";

export interface UIOutcomeProps {
  kind: UIOutcomeKind;
  /** A few words. Read first. */
  title: string;
  message?: string;
  /** Points won, shown as a chip that rises into place. Only a correct answer shows it. */
  points?: number;
  /** What the points chip says, e.g. "+3 points". */
  pointsLabel?: string;
  /** Replaces the icon, e.g. the face of whoever got it first in a group. */
  leading?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

const LOOK: Record<UIOutcomeKind, { card: string; medallion: string; Icon: React.ElementType; motion: string }> = {
  correct: { card: "border-emerald-300 bg-white dark:border-emerald-700 dark:bg-slate-900", medallion: "bg-emerald-500 text-white", Icon: PartyPopper, motion: "ui-pop-in" },
  timeUp: { card: "border-indigo-200 bg-white dark:border-indigo-800 dark:bg-slate-900", medallion: "bg-indigo-500 text-white", Icon: Hourglass, motion: "ui-shake" },
  beaten: { card: "border-purple-200 bg-white dark:border-purple-800 dark:bg-slate-900", medallion: "bg-purple-500 text-white", Icon: Hand, motion: "ui-pop-in" },
  skipped: { card: "border-line bg-white dark:bg-slate-900", medallion: "bg-slate-500 text-white", Icon: SkipForward, motion: "ui-pop-in" },
};

/**
 * How a puzzle ended, said so a child feels it before reading it.
 *
 * Right: a green medallion pops in, a burst of confetti goes off once, and the
 * points rise into place. Out of time: an hourglass gives one shake and the
 * message stays kind. Beaten to it, or passed: a calm card with its own icon,
 * never an alarm. The kind is never colour alone: each has its own icon and
 * its own words. Movement stops for a player who asked for less of it.
 */
export const UIOutcome: React.FC<UIOutcomeProps> = ({ kind, title, message, points, pointsLabel, leading, actionLabel, onAction }) => {
  const { card, medallion, Icon, motion } = LOOK[kind];
  return (
    <div role="status" aria-live="polite" className={`relative flex flex-col gap-3 rounded-3xl border-2 p-4 sm:flex-row sm:items-center ${card}`}>
      {kind === "correct" && <UIBurst className="left-10 top-8" />}
      {leading ? (
        <span className={`${motion} flex shrink-0 items-center justify-center self-center sm:self-auto`}>{leading}</span>
      ) : (
        <span className={`${motion} flex h-14 w-14 shrink-0 items-center justify-center self-center rounded-full ${medallion} sm:self-auto [&>svg]:h-7 [&>svg]:w-7`}>
          <Icon aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="text-xl font-black text-ink">{title}</span>
          {kind === "correct" && typeof points === "number" && points > 0 && (
            <span className="ui-float-up rounded-lg bg-emerald-600 px-2 py-1 font-mono text-xs font-black text-white">{pointsLabel ?? `+${points}`}</span>
          )}
        </div>
        {message && <p className="mt-0.5 text-sm font-bold text-body sm:text-base">{message}</p>}
      </div>
      {actionLabel && onAction && (
        <UIButton size="lg" icon={<ArrowRight />} onClick={onAction} className="shrink-0 self-center">
          {actionLabel}
        </UIButton>
      )}
    </div>
  );
};
