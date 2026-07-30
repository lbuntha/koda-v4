import React from "react";
import { cn } from "../../lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "md" | "lg";
  /** Supply a label when the spinner is the only loading announcement. */
  label?: string;
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

/** Koda's shared loading mark: a soft orbit with a small reward-gold bead. */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size = "md", label, className, ...props }, ref) => (
    <span
      ref={ref}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0 items-center justify-center", SIZE_CLASSES[size], className)}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-full w-full animate-spin overflow-visible motion-reduce:animate-none"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
        <path
          d="M12 3a9 9 0 0 1 8.5 6"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="12" cy="3" r="2.25" fill="#F9C846" />
      </svg>
    </span>
  ),
);
Spinner.displayName = "Spinner";
