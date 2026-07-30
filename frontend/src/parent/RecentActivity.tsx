import React, { useMemo } from "react";
import { BookOpenCheck, CheckCircle2 } from "lucide-react";
import type { ActivityEvent, AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import { KidAvatar } from "../components/KidAvatar";
import { Button, Skeleton } from "../components/ui";
import { PROFILE_TONE_CLASS, profileToneFor } from "./profileTone";

interface Props {
  profiles: Child[];
  summaries: Record<string, AnalyticsSummary>;
  loading?: boolean;
  onOpenProgress: (child: Child) => void;
}

interface FeedItem {
  child: Child;
  event: ActivityEvent;
}

const readable = (value?: string | null) => {
  if (!value) return "Learning activity";
  return value
    .replace(/^(seed-[a-z0-9]+-skill-|skill-)/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
};

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
};

const activityCopy = (event: ActivityEvent) => {
  const skill = event.skillLabel || readable(event.technique || event.skillId);
  if (event.eventType === "lesson_complete") {
    return {
      title: `completed ${skill}`,
      detail: event.totalSlides ? `Finished all ${event.totalSlides} activities` : "Finished the full lesson",
    };
  }

  const position = event.slideNumber && event.totalSlides
    ? `Activity ${event.slideNumber} of ${event.totalSlides}`
    : "Practice activity";
  if (event.outcome === "correct") {
    const result = event.attemptNumber === 1
      ? "Correct on the first try"
      : `Correct after ${event.attemptNumber ?? "another"} tries`;
    return {
      title: `practiced ${skill}`,
      detail: `${result}${event.hintUsed ? " · Used a hint" : ""} · ${position}`,
    };
  }
  return {
    title: `worked on ${skill}`,
    detail: `Ready for another try · ${position}`,
  };
};

export const RecentActivity: React.FC<Props> = ({ profiles, summaries, loading, onOpenProgress }) => {
  const items = useMemo(() => profiles
    .flatMap(child => (summaries[child.id]?.recentEvents ?? []).map(event => ({ child, event })))
    .sort((left, right) => new Date(right.event.occurredAt).getTime() - new Date(left.event.occurredAt).getTime())
    .slice(0, 4), [profiles, summaries]);

  return (
    <section>
      <div>
        <h2 className="text-lg font-black text-[#27334A] dark:text-white">Recent activity</h2>
        <p className="mt-1 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">Latest verified learning across your family.</p>
      </div>

      <div className="mt-4 min-h-28 rounded-3xl bg-white p-2.5 dark:bg-white/[0.045]">
        {loading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full rounded-xl" />)}
          </div>
        ) : items.length > 0 ? (
          <div className="divide-y divide-[#EEF0F5] dark:divide-white/10">
            {items.map(({ child, event }) => {
              const tone = PROFILE_TONE_CLASS[profileToneFor(child.id)];
              const copy = activityCopy(event);
              return (
                <Button
                  key={`${child.id}-${event.id}`}
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenProgress(child)}
                  className="h-auto w-full justify-start gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[#F8F7FF] dark:hover:bg-white/5"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${tone}`}>
                    <KidAvatar avatar={child.avatar ?? undefined} className="h-9 w-9 text-2xl" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-black text-[#334057] dark:text-white">
                      {event.eventType === "lesson_complete" ? <BookOpenCheck size={14} className="text-emerald-500" /> : <CheckCircle2 size={14} className="text-blue-500" />}
                      <span className="truncate">{child.name} {copy.title}</span>
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-bold text-[#8A95A8] dark:text-[#8F99AD]">
                      {copy.detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold text-[#A0A8B6] dark:text-[#778196]">{relativeTime(event.occurredAt)}</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F0EBFF] text-[#7252D8] dark:bg-violet-400/15 dark:text-[#CDBEFF]"><BookOpenCheck size={20} /></span>
            <p className="mt-3 text-sm font-black text-[#344057] dark:text-white">No activity yet</p>
            <p className="mt-1 text-xs font-bold text-[#8A95A8] dark:text-[#8F99AD]">Completed lessons and verified practice will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
};
