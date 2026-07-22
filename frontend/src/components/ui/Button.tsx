import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
          // Variants
          variant === "default" && "bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/10 border border-indigo-600",
          variant === "secondary" && "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60",
          variant === "outline" && "border border-slate-200 bg-white hover:bg-slate-50/80 text-slate-600 hover:text-slate-900",
          variant === "ghost" && "hover:bg-slate-100/80 text-slate-600 hover:text-slate-900",
          variant === "destructive" && "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/10 border border-rose-600",
          variant === "link" && "text-indigo-600 hover:underline underline-offset-4 bg-transparent p-0 border-none h-auto",
          // Sizes
          size === "xs" && "h-7 px-2 text-[10px] rounded-md gap-1",
          size === "sm" && "h-9 px-3.5 text-xs rounded-lg gap-1.5",
          size === "md" && "h-11 px-5 text-sm gap-2",
          size === "lg" && "h-13 px-7 text-base gap-2.5 rounded-2xl",
          size === "icon" && "h-10 w-10 p-0 rounded-xl",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
