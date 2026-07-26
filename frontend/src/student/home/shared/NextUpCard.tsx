import React from "react";
import { CircleHelp, Play } from "lucide-react";
import { Button } from "../../../components/ui";
import { ProgressMeter } from "./ProgressMeter";
import { NEXT_UP_ART } from "./dimensions";

interface Props {
  title: string;
  description?: string;
  artUrl: string;
  /** Authored in the curriculum; the chip is omitted when the author left it blank. */
  minutes?: number;
  questionCount: number;
  xp?: number;
  /** 0–1. There is no per-activity progress in the contracts, so the caller says what it means. */
  progress?: number;
  progressLabel?: string;
  inProgress?: boolean;
  onStart: () => void;
}

/**
 * The "next up" hero: artwork on its own panel, then the activity, its numbers, a progress
 * reading, and one primary action. Split by a hairline so the art reads as a plate rather than
 * floating in the card — the one rule the rest of the page deliberately drops.
 */
export const NextUpCard: React.FC<Props> = ({
  title,
  description,
  artUrl,
  minutes,
  questionCount,
  xp,
  progress,
  progressLabel = "mastered",
  inProgress,
  onStart,
}) => (
  <section className="flex flex-col overflow-hidden rounded-[1.5rem] bg-white/95 sm:flex-row dark:bg-[#191338]/92">
    <div className="flex shrink-0 items-center justify-center bg-[#F7F5FF] px-6 py-6 sm:w-60 sm:border-r sm:border-[#F0ECFA] dark:bg-white/5 dark:sm:border-white/10">
      <img
        src={artUrl}
        alt=""
        className={`object-contain mix-blend-multiply dark:mix-blend-normal ${NEXT_UP_ART}`}
      />
    </div>

    <div className="flex min-w-0 flex-1 flex-col px-5 py-5 sm:px-7 sm:py-6">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#5C46DF] dark:text-[#C3B4FF]">
        Next up
      </p>
      <h2 className="mt-1.5 text-2xl font-black leading-tight tracking-tight text-[#21183D] sm:text-[1.75rem] dark:text-[#F2EEFF]">
        {title}
      </h2>
      {description && (
        <p className="mt-1.5 line-clamp-2 max-w-md text-sm font-semibold leading-snug text-[#6B6280] dark:text-[#A79FC4]">
          {description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-bold text-[#6E6480] dark:text-[#9A94B8]">
        {questionCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <CircleHelp size={14} /> {questionCount} question{questionCount === 1 ? "" : "s"}
          </span>
        )}
        {questionCount > 0 && typeof minutes === "number" && <span aria-hidden>·</span>}
        {typeof minutes === "number" && <span>{minutes} min</span>}
        {typeof xp === "number" && (
          <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
            +{xp} XP
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:mt-auto sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        {typeof progress === "number" ? (
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <ProgressMeter value={progress} label={`${Math.round(progress * 100)}% ${progressLabel}`} />
          </div>
        ) : <span className="hidden sm:block" />}

        <Button
          type="button"
          onClick={onStart}
          className="h-13 shrink-0 rounded-full border-transparent bg-gradient-to-r from-[#7663F4] to-[#5844DE] px-7 text-base font-black text-white shadow-md shadow-indigo-300/40 transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:shadow-none"
        >
          <Play size={18} className="fill-current" /> {inProgress || (progress ?? 0) > 0 ? "Continue" : "Play"}
        </Button>
      </div>
    </div>
  </section>
);
