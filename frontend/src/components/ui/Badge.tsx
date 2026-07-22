import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "default", ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-extrabold font-mono tracking-wider uppercase border select-none",
        variant === "default" && "bg-indigo-50 text-indigo-700 border-indigo-200/50",
        variant === "secondary" && "bg-slate-100 text-slate-600 border-slate-200/50",
        variant === "success" && "bg-emerald-50 text-emerald-700 border-emerald-200/50",
        variant === "warning" && "bg-amber-50 text-amber-700 border-amber-200/50",
        variant === "destructive" && "bg-rose-50 text-rose-700 border-rose-200/50",
        variant === "outline" && "bg-transparent text-slate-500 border-slate-200",
        className
      )}
      {...props}
    />
  );
};
