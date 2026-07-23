import React from "react";
import { Skeleton, SkeletonText } from "../ui";

/** Loading shell that mirrors Curriculum Studio's sidebar and workspace. */
export const CurriculumStudioSkeleton: React.FC = () => (
  <div
    className="flex h-full min-h-0 w-full flex-col bg-slate-50 md:flex-row"
    role="status"
    aria-label="Loading curriculum studio"
    aria-busy="true"
  >
    <span className="sr-only">Loading curriculum studio…</span>

    <aside className="flex w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-white md:w-72 md:border-b-0 md:border-r">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
        <SkeletonText lines={2} className="flex-1" />
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <div className="hidden min-h-0 flex-1 space-y-2 overflow-hidden p-3 md:block">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className={index % 3 === 0 ? "h-12 w-full" : "ml-4 h-10 w-[calc(100%-1rem)]"} />
        ))}
      </div>
      <div className="hidden space-y-2 border-t border-slate-100 p-3 md:block">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </aside>

    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 p-4 sm:p-6">
      <Skeleton className="h-4 w-48 max-w-full" />
      <Skeleton className="mt-4 h-8 w-72 max-w-full" />
      <SkeletonText lines={2} className="mt-4 max-w-2xl" />
      <Skeleton className="mt-6 h-16 w-full" />
      <Skeleton className="mt-4 min-h-72 w-full flex-1" />
    </main>
  </div>
);
