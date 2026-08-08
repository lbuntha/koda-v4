import React from "react";
import { cn } from "../../lib/utils";
import { Spinner } from "./Spinner";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", loading = false, loadingText, disabled, children, ...props }, ref) => {
    const spinnerSize = size === "xs" ? "xs" : size === "lg" ? "md" : "sm";
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap font-bold uppercase tracking-[0.06em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7C3AED]/20 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer sm:tracking-[0.08em]",
          // Variants
          variant === "default" && "border border-[#7C3AED] bg-[#7C3AED] text-white shadow-[0_4px_0_#5421B8] hover:border-[#8748EF] hover:bg-[#8748EF] hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_1px_0_#5421B8]",
          variant === "secondary" && "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60",
          variant === "outline" && "border-[3px] border-[#E1E3EA] bg-white text-[#9CA3AF] hover:border-[#D4D6DF] hover:bg-[#FAFAFC] hover:text-[#7D8491] active:translate-y-px",
          variant === "ghost" && "hover:bg-slate-100/80 text-slate-600 hover:text-slate-900",
          variant === "destructive" && "bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/10 border border-rose-600",
          variant === "link" && "normal-case tracking-normal text-indigo-600 hover:underline underline-offset-4 bg-transparent p-0 border-none h-auto",
          // Sizes
          size === "xs" && "h-7 px-2 text-[10px] rounded-lg gap-1",
          size === "sm" && "h-9 px-3.5 text-xs rounded-xl gap-1.5",
          size === "md" && "h-11 px-5 text-sm rounded-2xl gap-2",
          size === "lg" && "h-12 gap-2 rounded-2xl px-5 text-sm sm:h-14 sm:gap-2.5 sm:rounded-[1.35rem] sm:px-8 sm:text-base",
          size === "icon" && "h-10 w-10 p-0 rounded-xl tracking-normal",
          variant === "outline" && (size === "xs" || size === "sm") && "border-2",
          variant === "outline" && size === "lg" && "border-[3px] sm:border-4",
          variant === "default" && size === "lg" && "sm:shadow-[0_6px_0_#5421B8] sm:active:shadow-[0_2px_0_#5421B8]",
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size={spinnerSize} label={loadingText ? undefined : "Loading"} />
            {loadingText && <span>{loadingText}</span>}
          </>
        ) : children}
      </button>
    );
  }
);

Button.displayName = "Button";
