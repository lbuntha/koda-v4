import React from "react";
import { Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UILessonIcon } from "./UILessonIcon";

export type UILessonCardTone = "review" | "practise" | "advance" | "resume";

/**
 * How much room this card is being given.
 *
 * `card` is the shape the Today band was designed in and the only shape it has
 * from 640px up. `compact` is the same card everywhere except a phone, where it
 * collapses to a row — see the component note below for why only some of them
 * do that.
 */
export type UILessonCardVariant = "card" | "compact";

export interface UILessonCardProps {
  title: string;
  /** Where this lesson comes from — the skill's name. */
  subject: string;
  /** Short line addressed to the child, not to their parent. */
  message?: string;
  /**
   * How far into an unfinished round the child got.
   *
   * Drawn as a bar and a count in place of the message, because "You got to
   * question 7 of 8" is the one thing on this band that is a quantity rather
   * than an encouragement — and a bar says it without the child reading a word.
   */
  progress?: { answered: number; total: number };
  /** `iconName` from the lesson's metadata. */
  iconName?: string;
  /** `iconTone` from the lesson's metadata. */
  iconTone?: string;
  tone?: UILessonCardTone;
  actionLabel?: string;
  variant?: UILessonCardVariant;
  onClick(): void;
  className?: string;
}

/*
 * Why a lesson is being offered, in a word the child can read.
 *
 * Deliberately not a score, a percentage or a status: "review" is the app's
 * word for a concept that is not landing, and putting that judgement in front
 * of a five-year-old would be both unkind and useless. The grown-up wording
 * lives in the recommendation's `reason`.
 */
const TONES: Record<UILessonCardTone, { label: string; chip: string; accent: string }> = {
  /* Rose, not amber. Amber on this chip measured 168,143,0 on 255,249,196 —
     a yellow on a yellow, and the reason yellow is not a Koda colour. */
  review: {
    label: "Warm up",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    accent: "text-rose-700 dark:text-rose-300",
  },
  practise: {
    label: "Keep going",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    accent: "text-sky-700 dark:text-sky-300",
  },
  advance: {
    label: "New",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    accent: "text-emerald-700 dark:text-emerald-300",
  },
  /* Violet, the colour practice wears on the learning path, so the two read as
     the same thing on two different screens. */
  resume: {
    label: "Finish",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
    accent: "text-violet-700 dark:text-violet-300",
  },
};

/**
 * One lesson offered as a choice — the unit of the Today band.
 *
 * A card rather than a node on a track, because the whole point of this surface
 * is that there is more than one thing a learner may do next. The child picks;
 * nothing here implies an order.
 *
 * Nothing here implies an order, but the band still has a first item, and on a
 * phone that distinction is the whole design. Three of these stacked in one
 * column is three identical full-width purple buttons: the same loudness three
 * times, so nothing reads as "start here", and the band alone fills the screen.
 * So the first card stays a card and the rest are `compact` — a 64px row with
 * the reason moved onto the subject line, where it is read, instead of a 10px
 * chip in the corner, where it is not.
 *
 * The collapse is CSS only and happens below 640px. From there up every card is
 * the same shape again: at that width they sit side by side, the repetition
 * reads as a menu rather than a queue, and there is nothing to fix.
 */
export const UILessonCard: React.FC<UILessonCardProps> = ({
  title,
  subject,
  message,
  progress,
  iconName,
  iconTone,
  tone = "advance",
  actionLabel = "Play",
  variant = "card",
  onClick,
  className = "",
}) => {
  const t = TONES[tone];
  const compact = variant === "compact";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${themeSystem.card("interactive")} ${
        compact ? "p-3 sm:p-5" : themeSystem.spacing.card
      } flex w-full text-left ${
        compact ? "items-center gap-3 sm:flex-col sm:items-start" : "flex-col items-start gap-3"
      } ${className}`}
    >
      <div className={`flex items-center gap-3 shrink-0 ${compact ? "sm:w-full" : "w-full"}`}>
        <UILessonIcon name={iconName} tone={iconTone} />
        {/* On a phone the row has no room for a chip, and no need of one: the
            same word rides on the subject line below the title. */}
        <span
          className={`ml-auto shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider ${
            t.chip
          } ${compact ? "hidden sm:inline-block" : ""}`}
        >
          {t.label}
        </span>
      </div>

      <div
        className={`min-w-0 flex flex-col ${compact ? "flex-1 sm:w-full sm:flex-none" : "w-full"}`}
      >
        {/* Title first on a phone row, eyebrow first everywhere else — one
            pair of lines, ordered for the shape they are in. */}
        <h3
          className={`text-base font-black leading-tight text-ink mt-1 ${
            compact ? "order-1 sm:order-none" : ""
          }`}
        >
          {title}
        </h3>
        <p
          className={`truncate text-muted ${
            compact
              ? "order-2 text-[11px] sm:order-first sm:font-mono sm:text-[10px] sm:font-black sm:uppercase sm:tracking-widest"
              : "order-first font-mono text-[10px] font-black uppercase tracking-widest"
          }`}
        >
          {compact ? (
            <>
              {/* The reason, on the line a phone actually reads. Above 640px the
                  chip in the corner carries it and this drops back to the skill. */}
              <span className="sm:hidden">
                {subject} · <span className={`font-bold ${t.accent}`}>{t.label}</span>
              </span>
              <span className="hidden sm:inline">{subject}</span>
            </>
          ) : (
            subject
          )}
        </p>

        {progress && !compact ? (
          <span className="mt-2 block w-full">
            <span
              aria-hidden="true"
              className="block h-2 w-full overflow-hidden rounded-full bg-surface-muted"
            >
              <span
                className="block h-full rounded-full bg-violet-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((progress.answered / Math.max(1, progress.total)) * 100),
                  )}%`,
                }}
              />
            </span>
            <span className="mt-1 block text-xs text-muted">
              Question {progress.answered} of {progress.total}
            </span>
          </span>
        ) : (
          message && (
            <p
              className={`mt-1.5 text-xs text-muted line-clamp-2 ${compact ? "hidden sm:block" : ""}`}
            >
              {message}
            </p>
          )
        )}
      </div>

      {/* The phone row's affordance. The row is already the control, so this is
          a mark rather than a second button — the full-width one below it is
          what a card at 640px and up gets. */}
      {compact && (
        <span className="sm:hidden shrink-0 grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
          <Play className="h-4 w-4 fill-current" />
        </span>
      )}

      {/* A span, not a nested button — the whole card is already the control. */}
      <span className={`mt-auto w-full ${compact ? "hidden sm:block" : "block"}`}>
        <span className={`${themeSystem.button("primary", "sm")} w-full pointer-events-none`}>
          <Play className="fill-current" />
          {actionLabel}
        </span>
      </span>
    </button>
  );
};
