import React from "react";
import { ChevronRight } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { UISkillThumbnail } from "./UISkillThumbnail";

export interface UISubjectRowProps {
  name: string;
  /** The skill's `thumbnail`, passed straight through. */
  thumbnail?: string;
  fallbackIconName?: string;
  category?: string;
  completedLessons: number;
  totalLessons: number;
  /** How many lessons are open to the learner right now. */
  readyCount?: number;
  onClick(): void;
  className?: string;
}

/**
 * One registered subject, as a single row.
 *
 * The row is the answer to "how do you show twenty skills?". A path per skill
 * grows the page with the *lesson* count, so a modest library turns Home into a
 * scroll of thousands of pixels; a row per skill grows with the *skill* count,
 * which is small and stays scannable. The map lives one tap away, on the
 * subject's own page, where it is scoped to something a person can read.
 */
export const UISubjectRow: React.FC<UISubjectRowProps> = ({
  name,
  thumbnail,
  fallbackIconName,
  category,
  completedLessons,
  totalLessons,
  readyCount = 0,
  onClick,
  className = "",
}) => {
  const percent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${themeSystem.card(
        "interactive",
      )} flex w-full items-center gap-3 p-3 text-left ${className}`}
    >
      <UISkillThumbnail
        thumbnail={thumbnail}
        fallbackIconName={fallbackIconName}
        category={category}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-black text-ink">{name}</h3>
          {readyCount > 0 && (
            <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              {readyCount} ready
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[11px] font-bold text-muted">
            {completedLessons}/{totalLessons}
          </span>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
    </button>
  );
};
