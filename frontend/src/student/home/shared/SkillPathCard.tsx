import React from "react";
import { Award } from "lucide-react";
import { ProgressMeter } from "./ProgressMeter";
import { PATH_GLYPH } from "./dimensions";

export type SkillPathTone = "violet" | "emerald" | "amber" | "rose";

interface Props {
  /** Unit name from the curriculum. */
  title: string;
  /** Short glyph for the tile — "123", "+", "−", "×". */
  glyph: string;
  mastered: number;
  total: number;
  /** Skills currently due for practice in this path. */
  duePractice?: number;
  /** Most recently promoted skill, if any. */
  milestone?: string;
  tone?: SkillPathTone;
}

const TONE: Record<SkillPathTone, { tile: string; pill: string }> = {
  violet: {
    tile: "bg-[image:linear-gradient(160deg,#8B73F7,#5B43DD)]",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  emerald: {
    tile: "bg-[image:linear-gradient(160deg,#4ED8A0,#159C68)]",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  amber: {
    tile: "bg-[image:linear-gradient(160deg,#FFC24B,#F08A2E)]",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
  rose: {
    tile: "bg-[image:linear-gradient(160deg,#FF7A9C,#E23E67)]",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  },
};

/**
 * One learning path: glyph tile, unit name, how much is due, mastery with a handle on the
 * track, and the last milestone on its own row. Shared so the kid and focus bands report
 * progress identically.
 */
export const SkillPathCard: React.FC<Props> = ({
  title,
  glyph,
  mastered,
  total,
  duePractice = 0,
  milestone,
  tone = "violet",
}) => {
  const styles = TONE[tone];
  const pct = total > 0 ? mastered / total : 0;
  return (
    <article className="overflow-hidden rounded-[1.4rem] bg-white/90 ring-1 ring-inset ring-[#EFEBFA] dark:bg-white/5 dark:ring-white/10">
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span
          className={`flex shrink-0 items-center justify-center rounded-2xl font-black text-white shadow-sm ${PATH_GLYPH} ${styles.tile}`}
          aria-hidden
        >
          {glyph}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-black text-[#332750] dark:text-[#E4DEFF]">{title}</h3>
            {duePractice > 0 && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${styles.pill}`}>
                {duePractice} skill{duePractice === 1 ? "" : "s"} to practise
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-3">
            <p className="shrink-0 text-xl font-black leading-none text-[#21183D] dark:text-[#F2EEFF]">
              {Math.round(pct * 100)}%
              <span className="ml-1 text-[11px] font-bold text-[#6E6480] dark:text-[#9A94B8]">mastered</span>
            </p>
            <span className="min-w-0 flex-1">
              <ProgressMeter value={pct} tone={tone} knob size="md" />
            </span>
            <p className="hidden shrink-0 text-[11px] font-bold text-[#6E6480] sm:block dark:text-[#9A94B8]">
              {mastered} of {total} skills
            </p>
          </div>
        </div>
      </div>

      {milestone && (
        <div className="flex items-center gap-2 bg-[#F7F5FD] px-4 py-2.5 dark:bg-white/5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Award size={13} />
          </span>
          <p className="min-w-0 truncate text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <span className="font-black">Mastered milestone</span>
            <span className="mx-1.5 text-[#B9B2CC] dark:text-white/25">·</span>
            {milestone}
          </p>
        </div>
      )}
    </article>
  );
};
