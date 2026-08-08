import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" | "emerald" | "violet" | "indigo" | "rose" | "purple";
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "default", icon, children, ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-fit items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold tracking-wide uppercase border-2 leading-none select-none",
        variant === "default" && "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
        variant === "secondary" && "bg-slate-100 text-slate-600 border-slate-200/60 dark:bg-white/10 dark:text-slate-300 dark:border-white/10",
        variant === "success" && "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
        variant === "emerald" && "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25",
        variant === "warning" && "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/25",
        variant === "destructive" && "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
        variant === "rose" && "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25",
        variant === "outline" && "bg-transparent text-slate-500 border-slate-200 dark:text-slate-400 dark:border-white/15",
        variant === "violet" && "bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25",
        variant === "indigo" && "bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25",
        variant === "purple" && "bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/25",
        className
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
};
