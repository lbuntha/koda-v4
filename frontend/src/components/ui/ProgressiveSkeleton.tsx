import React from "react";
import { Spinner } from "./Spinner";
import { KodaLogoSpinner } from "./KodaLogoSpinner";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
}

/** Basic animated shimmer skeleton line/box */
export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  rounded = "xl",
  ...props
}) => {
  const roundedClass = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    "3xl": "rounded-3xl",
    full: "rounded-full",
  }[rounded];

  return (
    <div
      className={`relative overflow-hidden bg-slate-200/80 dark:bg-slate-800/80 animate-pulse ${roundedClass} ${className}`}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
    </div>
  );
};

/** Canvas structural layout skeleton shown when downloading lazy activity bundles */
export const CanvasSkeleton: React.FC<{ label?: string }> = ({ label = "Loading learning canvas…" }) => (
  <div className="relative flex h-full w-full min-h-[360px] sm:min-h-[440px] flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-b from-indigo-50/40 via-white to-violet-50/30 p-4 shadow-sm dark:border-slate-800 dark:from-slate-900/60 dark:via-slate-900 dark:to-slate-950">
    {/* Canvas Header Skeleton */}
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0" rounded="xl" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-36" rounded="md" />
          <Skeleton className="h-3 w-24" rounded="md" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20" rounded="full" />
        <Skeleton className="h-8 w-8" rounded="lg" />
      </div>
    </div>

    {/* Canvas Body Playground Skeleton */}
    <div className="my-6 flex flex-1 flex-col items-center justify-center gap-5">
      <div className="flex flex-col items-center gap-3">
        <KodaLogoSpinner size="lg" label={label} />
      </div>

      <div className="grid w-full max-w-lg grid-cols-4 gap-3 px-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full shadow-inner" rounded="2xl" />
        ))}
      </div>
    </div>

    {/* Canvas Footer Status Skeleton */}
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/80">
      <Skeleton className="h-4 w-48" rounded="md" />
      <Skeleton className="h-8 w-28" rounded="xl" />
    </div>
  </div>
);

/** Generic Card Skeleton for dashboards and lists */
export const CardSkeleton: React.FC = () => (
  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-3">
      <Skeleton className="h-12 w-12" rounded="xl" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4" rounded="md" />
        <Skeleton className="h-3 w-1/2" rounded="md" />
      </div>
    </div>
    <Skeleton className="h-20 w-full" rounded="xl" />
  </div>
);
