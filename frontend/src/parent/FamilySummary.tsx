import React from "react";
import { BookOpen, Clock3, Flame, Trophy, Zap } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";

interface Props {
  summaries: AnalyticsSummary[];
  loading?: boolean;
  className?: string;
  expectedProfiles?: number;
}

const learningTime = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const FamilySummary: React.FC<Props> = ({ summaries, loading, className = "mt-8", expectedProfiles = summaries.length }) => {
  const totals = summaries.reduce((value, summary) => ({
    lessons: value.lessons + summary.lessonsCompleted,
    xp: value.xp + summary.xpEarned,
    time: value.time + summary.timeOnTaskMs,
    mastered: value.mastered + summary.rank.mastered,
    streak: Math.max(value.streak, summary.longestStreakDays),
  }), { lessons: 0, xp: 0, time: 0, mastered: 0, streak: 0 });

  const items = [
    { label: "Lessons", value: totals.lessons, detail: "completed", icon: BookOpen, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300" },
    { label: "XP earned", value: totals.xp, detail: "across the family", icon: Zap, tone: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300" },
    { label: "Practice time", value: learningTime(totals.time), detail: "active answering", icon: Clock3, tone: "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300" },
    { label: "Skills", value: totals.mastered, detail: "mastered", icon: Trophy, tone: "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300" },
  ];

  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#27334A] dark:text-white">Family summary</h2>
          <p className="mt-1 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">Learning progress across every child profile.</p>
        </div>
        {totals.streak > 0 && <span className="inline-flex items-center gap-1 text-xs font-black text-orange-600 dark:text-orange-300"><Flame size={14} className="fill-current" /> Best streak · {totals.streak} day{totals.streak === 1 ? "" : "s"}</span>}
      </div>
      {!loading && summaries.length < expectedProfiles && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">Some learner activity is temporarily unavailable. Totals may be incomplete.</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(item => (
          <div key={item.label} className="flex min-h-24 items-center gap-3 rounded-3xl bg-white p-4 dark:bg-white/[0.045]">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}><item.icon size={21} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#8A95A8] dark:text-[#8F99AD]">{item.label}</p>
              <p className="mt-1 truncate text-xl font-black text-[#28334A] dark:text-white">{loading ? "—" : item.value}</p>
              <p className="text-[10px] font-bold text-[#A0A8B6] dark:text-[#7F899D]">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
