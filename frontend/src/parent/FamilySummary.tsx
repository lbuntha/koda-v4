import React from "react";
import type { AnalyticsSummary } from "../api/analytics";
import { SvgLibraryAsset } from "../assets/SvgLibraryAsset";
import { Card, Skeleton } from "../components/ui";
import { KID_NAV_ASSET_IDS } from "../student/home/kidNavAssets";
import { FAMILY_SUMMARY_ASSET_IDS } from "./familySummaryAssets";

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
    { label: "Lessons", value: totals.lessons, detail: "completed", icon: <SvgLibraryAsset assetId={FAMILY_SUMMARY_ASSET_IDS.lessons} size={28} fallback={<img src="/assets/icons/family-summary/lessons.svg" alt="" className="h-7 w-7" />} />, tone: "bg-[#F3F0FF] dark:bg-emerald-400/10" },
    { label: "XP earned", value: totals.xp, detail: "across the family", icon: <SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.xp} size={32} />, tone: "bg-amber-50 dark:bg-amber-400/10" },
    { label: "Practice time", value: learningTime(totals.time), detail: "active answering", icon: <SvgLibraryAsset assetId={FAMILY_SUMMARY_ASSET_IDS.practiceTime} size={28} fallback={<img src="/assets/icons/family-summary/practice-time.svg" alt="" className="h-7 w-7" />} />, tone: "bg-blue-50 dark:bg-blue-400/10" },
    { label: "Skills", value: totals.mastered, detail: "mastered", icon: <SvgLibraryAsset assetId={FAMILY_SUMMARY_ASSET_IDS.skills} size={28} fallback={<img src="/assets/icons/family-summary/skills.svg" alt="" className="h-7 w-7" />} />, tone: "bg-violet-50 dark:bg-violet-400/10" },
  ];

  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0E0B55] dark:text-white">Family summary</h2>
          <p className="mt-1 text-xs font-medium text-[#6D6997] dark:text-[#8F99AD]">Learning progress across every child profile.</p>
        </div>
        {totals.streak > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-600 dark:bg-orange-400/10 dark:text-orange-300"><SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.streak} size={16} /> Best streak · {totals.streak} day{totals.streak === 1 ? "" : "s"}</span>}
      </div>
      {!loading && summaries.length < expectedProfiles && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">Some learner activity is temporarily unavailable. Totals may be incomplete.</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(item => (
          <Card key={item.label} variant="standard" className="flex min-h-24 items-center gap-3 p-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#6D6997] dark:text-[#8F99AD]">{item.label}</p>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-16" shape="line" />
              ) : (
                <p className="mt-1 truncate text-xl font-semibold text-[#0E0B55] dark:text-white">{item.value}</p>
              )}
              <p className="text-[10px] font-bold text-[#8D89AE] dark:text-[#7F899D]">{item.detail}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
