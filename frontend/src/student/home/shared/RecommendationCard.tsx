import React from "react";
import { Clock, Play, Sparkles, Zap } from "lucide-react";
import { REC_ART } from "./dimensions";

export type RecommendationTone = "purple" | "blue" | "green" | "amber" | "pink";

interface Props {
  tone?: RecommendationTone;
  title: string;
  /** Unit name from the curriculum. */
  subtitle?: string;
  artUrl: string;
  /** Why the engine picked this — shown verbatim, never invented. */
  reason?: string;
  difficulty?: { label: string; filled: number; level: "easy" | "medium" | "hard" };
  minutes?: number;
  xp?: number;
  onStart: () => void;
}

const TONE: Record<RecommendationTone, string> = {
  purple: "bg-[image:radial-gradient(circle_at_72%_28%,#EFEAFF_0%,transparent_62%)] dark:bg-[image:radial-gradient(circle_at_72%_28%,rgba(150,120,255,0.18)_0%,transparent_62%)]",
  blue: "bg-[image:radial-gradient(circle_at_72%_28%,#E6F2FF_0%,transparent_62%)] dark:bg-[image:radial-gradient(circle_at_72%_28%,rgba(90,170,255,0.18)_0%,transparent_62%)]",
  green: "bg-[image:radial-gradient(circle_at_72%_28%,#E5F8EE_0%,transparent_62%)] dark:bg-[image:radial-gradient(circle_at_72%_28%,rgba(80,215,155,0.16)_0%,transparent_62%)]",
  amber: "bg-[image:radial-gradient(circle_at_72%_28%,#FFF3DE_0%,transparent_62%)] dark:bg-[image:radial-gradient(circle_at_72%_28%,rgba(255,190,90,0.16)_0%,transparent_62%)]",
  pink: "bg-[image:radial-gradient(circle_at_72%_28%,#FFEAF3_0%,transparent_62%)] dark:bg-[image:radial-gradient(circle_at_72%_28%,rgba(255,150,200,0.16)_0%,transparent_62%)]",
};

const LEVEL_TEXT: Record<NonNullable<Props["difficulty"]>["level"], string> = {
  easy: "text-emerald-600 dark:text-emerald-300",
  medium: "text-amber-600 dark:text-amber-300",
  hard: "text-rose-600 dark:text-rose-300",
};

/**
 * Recommendation card: the activity, why it was picked, and what it costs — with the artwork
 * as a scene in the corner rather than a boxed thumbnail.
 *
 * Responsive by construction: the text column shrinks (`min-w-0`) while the art is a fixed
 * step per device, and the footer wraps to two rows on a phone so the play button never
 * collides with the meta.
 */
export const RecommendationCard: React.FC<Props> = ({
  tone = "purple",
  title,
  subtitle,
  artUrl,
  reason,
  difficulty,
  minutes,
  xp,
  onStart,
}) => (
  <article className="group relative flex flex-col overflow-hidden rounded-[1.5rem] bg-white/95 dark:bg-[#191338]/92">
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${TONE[tone]}`} />

    <div className="relative flex items-start gap-3 px-5 pt-5">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-lg font-black leading-tight text-[#21183D] sm:text-xl dark:text-[#F2EEFF]">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 truncate text-[13px] font-semibold text-[#8B82A3] dark:text-[#9A94B8]">
            {subtitle}
          </p>
        )}
        {reason && (
          <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F1ECFF] px-3 py-1.5 dark:bg-white/10">
            <Sparkles size={12} className="shrink-0 text-[#5C46DF] dark:text-[#C3B4FF]" />
            <span className="truncate text-[11px] font-bold text-[#5C46DF] dark:text-[#C3B4FF]">{reason}</span>
          </span>
        )}
      </div>

      <img
        src={artUrl}
        alt=""
        className={`-mt-1 shrink-0 object-contain mix-blend-multiply dark:mix-blend-normal ${REC_ART}`}
      />
    </div>

    <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#F3F0FB] px-5 py-3 dark:border-white/10">
      {difficulty && (
        <span className="inline-flex items-center gap-2">
          <span className="flex items-center gap-1" aria-hidden>
            {[0, 1, 2].map(index => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${
                  index < difficulty.filled
                    ? "bg-[#5C46DF] dark:bg-[#A48BFF]"
                    : "bg-[#E4DEF5] dark:bg-white/15"
                }`}
              />
            ))}
          </span>
          <span className={`text-xs font-bold ${LEVEL_TEXT[difficulty.level]}`}>{difficulty.label}</span>
        </span>
      )}

      {typeof minutes === "number" && (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6480] dark:text-[#9A94B8]">
          <Clock size={13} /> {minutes} min
        </span>
      )}

      {typeof xp === "number" && (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E6480] dark:text-[#9A94B8]">
          <Zap size={13} className="fill-current text-amber-500" /> {xp} XP
        </span>
      )}

      <button
        type="button"
        onClick={onStart}
        aria-label={`Start ${title}`}
        className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7663F4] to-[#5844DE] text-white shadow-md shadow-indigo-300/40 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:translate-y-0 sm:h-11 sm:w-11 dark:shadow-none"
      >
        <Play size={17} className="fill-current" />
      </button>
    </div>
  </article>
);
