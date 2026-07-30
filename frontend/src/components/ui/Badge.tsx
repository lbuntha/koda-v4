import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "default", ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase border leading-none select-none",
        variant === "default" && "bg-indigo-50 text-indigo-700 border-indigo-200/50 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
        variant === "secondary" && "bg-slate-100 text-slate-600 border-slate-200/50 dark:bg-white/10 dark:text-slate-300 dark:border-white/10",
        variant === "success" && "bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
        variant === "warning" && "bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
        variant === "destructive" && "bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
        variant === "outline" && "bg-transparent text-slate-500 border-slate-200 dark:text-slate-400 dark:border-white/15",
        className
      )}
      {...props}
    />
  );
};
