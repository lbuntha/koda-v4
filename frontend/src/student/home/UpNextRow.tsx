import React from "react";
import type { CourseQueueItem } from "../../api/course";
import { KIND } from "./kinds";
import { ActivityStatusBadge } from "./ActivityStatusBadge";

interface Props {
  items: CourseQueueItem[];
  /** Tapping a chip starts that activity immediately. */
  onStart: (item: CourseQueueItem) => void;
}

/** The rest of the queue as slim, tappable chips. Hidden when there is nothing more. */
export const UpNextRow: React.FC<Props> = ({ items, onStart }) => {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6A5FA0] dark:text-[#9C93C6]">Up next</p>
      <div className="flex flex-wrap gap-2">
        {items.map(item => {
          const Icon = KIND[item.kind].icon;
          return (
            <button
              key={`${item.assignmentId}:${item.skillId}`}
              type="button"
              onClick={() => onStart(item)}
              className="inline-flex items-center gap-2 rounded-full border border-[#E2DEEF] bg-white px-3.5 py-2 text-xs font-semibold text-[#4A4568] shadow-sm transition hover:border-[#B9AEEC] hover:bg-[#F6F3FF] dark:border-white/10 dark:bg-white/5 dark:text-[#CFCBE6] dark:shadow-none dark:hover:border-white/20 dark:hover:bg-white/10"
            >
              <Icon size={13} className="text-[#6A5FA0] dark:text-[#9C93C6]" /> {item.skillLabel}
              <ActivityStatusBadge status={item.status} />
            </button>
          );
        })}
      </div>
    </section>
  );
};
