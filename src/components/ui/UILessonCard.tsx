import React from "react";
import { Play } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UILessonIcon } from "./UILessonIcon";

export type UILessonCardTone = "review" | "practise" | "advance" | "resume";

export interface UILessonCardProps {
  title: string;
  /** Where this lesson comes from — the skill's name. */
  subject: string;
  /** Short line addressed to the child, not to their parent. */
  message?: string;
  /** `iconName` from the lesson's metadata. */
  iconName?: string;
  /** `iconTone` from the lesson's metadata. */
  iconTone?: string;
  tone?: UILessonCardTone;
  actionLabel?: string;
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
const TONES: Record<UILessonCardTone, { label: string; chip: string }> = {
  /* Rose, not amber. Amber on this chip measured 168,143,0 on 255,249,196 —
     a yellow on a yellow, and the reason yellow is not a Koda colour. */
  review: {
    label: "Warm up",
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
  practise: {
    label: "Keep going",
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  },
  advance: {
    label: "New",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  /* Violet, the colour practice wears on the learning path, so the two read as
     the same thing on two different screens. */
  resume: {
    label: "Finish",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
  },
};

/**
 * One lesson offered as a choice — the unit of the Today band.
 *
 * A card rather than a node on a track, because the whole point of this surface
 * is that there is more than one thing a learner may do next. The child picks;
 * nothing here implies an order.
 */
export const UILessonCard: React.FC<UILessonCardProps> = ({
  title,
  subject,
  message,
  iconName,
  iconTone,
  tone = "advance",
  actionLabel = "Play",
  onClick,
  className = "",
}) => {
  const t = TONES[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${themeSystem.card(
        "interactive",
      )} ${themeSystem.spacing.card} flex w-full flex-col items-start gap-3 text-left ${className}`}
    >
      <div className="flex w-full items-center gap-3">
        <UILessonIcon name={iconName} tone={iconTone} />
        <span
          className={`ml-auto shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider ${t.chip}`}
        >
          {t.label}
        </span>
      </div>

      <div className="min-w-0 w-full">
        <p className="font-mono text-[10px] font-black uppercase tracking-widest text-muted truncate">
          {subject}
        </p>
        <h3 className="mt-1 text-base font-black leading-tight text-ink">{title}</h3>
        {message && <p className="mt-1.5 text-xs text-muted line-clamp-2">{message}</p>}
      </div>

      {/* A span, not a nested button — the whole card is already the control. */}
      <span
        className={`${themeSystem.button("primary", "sm")} mt-auto w-full pointer-events-none`}
      >
        <Play className="fill-current" />
        {actionLabel}
      </span>
    </button>
  );
};
