import React from "react";
import { Award } from "lucide-react";
import type { MasteryLevel } from "../../../api/course";

export type SkillPathTone = "violet" | "emerald" | "amber" | "rose";

interface Props {
  /** Unit name from the curriculum. */
  title: string;
  /** One rung per skill, in curriculum order. Drawn as a segment each. */
  rungs: MasteryLevel[];
  /** Skills at `master`, matching the welcome band's "skills mastered" tile. */
  mastered: number;
  total: number;
  /** 0–1 across the five-rung ladder, so work below mastery still reads. */
  progress: number;
  /** Skills currently due for practice in this path. */
  duePractice?: number;
  /** Most recently promoted skill, if any. */
  milestone?: string;
  /** The first skill not yet mastered — what this path asks for next. */
  nextSkill?: { label: string; level: MasteryLevel };
  tone?: SkillPathTone;
}

/** How full one skill's segment is drawn. Mirrors the ladder, not a pass/fail. */
const RUNG_FILL: Record<MasteryLevel, string> = {
  not_started: "0%",
  beginner: "25%",
  developing: "50%",
  proficient: "75%",
  master: "100%",
};

const LEVEL_WORD: Record<MasteryLevel, string> = {
  not_started: "not started",
  beginner: "just started",
  developing: "getting there",
  proficient: "going well",
  master: "mastered",
};

const TONE_STYLES: Record<SkillPathTone, {
  bg: string;
  border: string;
  progressTrack: string;
  progressFill: string;
  badgeBg: string;
  badgeText: string;
}> = {
  amber: {
    bg: "bg-[#FFF9F2] dark:bg-amber-400/10",
    border: "border-2 border-[#FFE8D1] dark:border-amber-500/30",
    progressTrack: "bg-[#FFE8D1] dark:bg-white/10",
    progressFill: "bg-gradient-to-r from-[#FF7A00] to-[#FF5500]",
    badgeBg: "bg-[#FEF4D5] dark:bg-amber-400/20",
    badgeText: "text-[#9A6212] dark:text-amber-300",
  },
  emerald: {
    bg: "bg-[#F2FAF5] dark:bg-emerald-400/10",
    border: "border-2 border-[#D2F2E1] dark:border-emerald-500/30",
    progressTrack: "bg-[#D2F2E1] dark:bg-white/10",
    progressFill: "bg-gradient-to-r from-[#00C875] to-[#009E5B]",
    badgeBg: "bg-[#E5F8EE] dark:bg-emerald-400/20",
    badgeText: "text-[#00B862] dark:text-emerald-300",
  },
  rose: {
    bg: "bg-[#FCF5FA] dark:bg-pink-400/10",
    border: "border-2 border-[#F5D8EB] dark:border-pink-500/30",
    progressTrack: "bg-[#F5D8EB] dark:bg-white/10",
    progressFill: "bg-gradient-to-r from-[#FF5B6E] to-[#E03348]",
    badgeBg: "bg-[#FFE8F3] dark:bg-rose-400/20",
    badgeText: "text-[#E03348] dark:text-rose-300",
  },
  violet: {
    bg: "bg-[#F8F6FF] dark:bg-violet-400/10",
    border: "border-2 border-[#E5DEFF] dark:border-violet-500/30",
    progressTrack: "bg-[#E5DEFF] dark:bg-white/10",
    progressFill: "bg-gradient-to-r from-[#7663F4] to-[#5844DE]",
    badgeBg: "bg-[#EFEAFF] dark:bg-violet-400/20",
    badgeText: "text-[#5C46DF] dark:text-[#C3B4FF]",
  },
};

export const SkillPathCard: React.FC<Props> = ({
  title,
  rungs,
  mastered,
  total,
  progress,
  duePractice = 0,
  milestone,
  nextSkill,
  tone = "violet",
}) => {
  const styles = TONE_STYLES[tone];
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <article className={`flex flex-col justify-between overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem] p-4 sm:p-5 transition-all shadow-sm hover:shadow-md ${styles.bg} ${styles.border}`}>
      <div>
        {/* No icon: a Unit carries no icon field, so any glyph here would be guessed from
            its name — the same invented signal the thumbnail fallback used to draw. */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate text-base font-black text-[#1E1538] sm:text-lg dark:text-[#F2EEFF]">
            {title}
          </h3>

          {duePractice > 0 && (
            <span className={`shrink-0 rounded-full px-2.5 sm:px-3 py-0.5 text-[11px] sm:text-xs font-extrabold ${styles.badgeBg} ${styles.badgeText}`}>
              {duePractice} skill{duePractice === 1 ? "" : "s"} to practice
            </span>
          )}
        </div>

        {/* One segment per skill, each filled to the rung it has reached. This is the
            mastery ladder drawn literally, so partial progress is visible instead of a
            unit reading 0% while every skill in it is halfway up. */}
        <div className="mt-3.5 flex items-center gap-1 sm:mt-4" role="img" aria-label={`${pct}% of the way through ${total} skill${total === 1 ? "" : "s"}`}>
          {rungs.map((level, index) => (
            <span
              key={index}
              title={LEVEL_WORD[level]}
              className={`h-2.5 flex-1 overflow-hidden rounded-full sm:h-3 ${styles.progressTrack}`}
            >
              <span
                className={`block h-full rounded-full transition-all duration-500 ${styles.progressFill}`}
                style={{ width: RUNG_FILL[level] }}
              />
            </span>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-[#1E1538] sm:text-2xl dark:text-white">{pct}%</span>
            <span className="text-xs font-bold text-[#8C84A3] dark:text-[#9A94B8]">of the way</span>
          </div>
          <span className="text-xs font-bold text-[#8C84A3] whitespace-nowrap dark:text-[#9A94B8]">
            {mastered} of {total} mastered
          </span>
        </div>

        {nextSkill && (
          <p className="mt-2 truncate text-xs font-bold text-[#6B6280] dark:text-[#A79FC4]">
            Next: <span className="font-black text-[#1E1538] dark:text-[#F2EEFF]">{nextSkill.label}</span>
            <span className="font-semibold"> · {LEVEL_WORD[nextSkill.level]}</span>
          </p>
        )}
      </div>

      {milestone && (
        <div className="mt-3.5 flex items-center gap-2 rounded-xl sm:rounded-2xl border border-[#B8F0D0] bg-[#E5F8EE] px-3.5 py-2 text-xs font-extrabold text-[#00B862] dark:bg-emerald-400/15 dark:border-emerald-500/30 dark:text-emerald-300">
          <Award size={15} className="shrink-0 text-[#00B862] dark:text-emerald-400" />
          <span className="text-slate-600 dark:text-slate-300">Mastered milestone</span>
          <span className="font-black text-[#00B862] dark:text-emerald-300 truncate">{milestone}</span>
        </div>
      )}
    </article>
  );
};
