import React from "react";
import { BookOpen, Clock3, Flame, Star } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";

interface Props {
  summaries: AnalyticsSummary[];
  loading?: boolean;
}

const learningTime = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const FamilySummary: React.FC<Props> = ({ summaries, loading }) => {
  const totals = summaries.reduce((value, summary) => ({
    lessons: value.lessons + summary.lessonsCompleted,
    xp: value.xp + summary.xpEarned,
    time: value.time + summary.timeOnTaskMs,
    mastered: value.mastered + summary.rank.mastered,
    streak: Math.max(value.streak, summary.currentStreakDays),
  }), { lessons: 0, xp: 0, time: 0, mastered: 0, streak: 0 });

  const items = [
    { label: "Lessons", value: totals.lessons, detail: "completed", icon: BookOpen, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300" },
    { label: "Stars", value: totals.xp, detail: "family XP", icon: Star, tone: "bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300" },
    { label: "Learning time", value: learningTime(totals.time), detail: "all activity", icon: Clock3, tone: "bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300" },
    { label: "Skills", value: totals.mastered, detail: "mastered", icon: Flame, tone: "bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300" },
  ];

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#27334A] dark:text-white">Family summary</h2>
          <p className="mt-1 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">Learning progress across every child profile.</p>
        </div>
        {totals.streak > 0 && <span className="text-xs font-black text-orange-600 dark:text-orange-300">{totals.streak} day best streak</span>}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map(item => (
          <div key={item.label} className="flex min-h-28 items-center gap-4 rounded-3xl bg-white p-5 dark:bg-white/[0.045]">
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
