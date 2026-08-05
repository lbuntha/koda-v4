import React from "react";
import { cn } from "../../lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "indigo" | "violet" | "amber" | "emerald" | "rainbow";
  /** Supply a label when the spinner is the only loading announcement. */
  label?: string;
  /** Whether to add a subtle ambient glow backdrop behind the spinner */
  glow?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const VARIANT_STROKE: Record<NonNullable<SpinnerProps["variant"]>, { primary: string; secondary: string }> = {
  indigo: { primary: "#6366F1", secondary: "#C7D2FE" },
  violet: { primary: "#8B5CF6", secondary: "#DDD6FE" },
  amber: { primary: "#F59E0B", secondary: "#FDE68A" },
  emerald: { primary: "#10B981", secondary: "#A7F3D0" },
  rainbow: { primary: "url(#koda-spinner-gradient)", secondary: "#E2E8F0" },
};

/** Koda's shared loading mark: a vibrant dual-orbit spinner with a reward-gold bead. */
export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ size = "md", variant = "violet", glow = false, label, className, ...props }, ref) => {
    const stroke = VARIANT_STROKE[variant];
    const gradientId = React.useId().replace(/:/g, "");

    return (
      <span
        ref={ref}
        role={label ? "status" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn("relative inline-flex shrink-0 items-center justify-center", SIZE_CLASSES[size], className)}
        {...props}
      >
        {glow && (
          <span className="absolute inset-0 animate-pulse rounded-full bg-violet-400/20 blur-md motion-reduce:animate-none" />
        )}
        <svg
          viewBox="0 0 32 32"
          className="absolute inset-0 h-full w-full animate-[spin_1.15s_cubic-bezier(0.55,0.15,0.45,0.85)_infinite] overflow-visible motion-reduce:animate-none"
          fill="none"
          aria-hidden="true"
        >
          {variant === "rainbow" && (
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#EC4899" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
          )}

          {/* Outer track */}
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke={stroke.secondary}
            strokeWidth="3"
            strokeOpacity="0.35"
          />

          {/* Active arc */}
          <path
            d="M 16 4 A 12 12 0 0 1 28 16"
            stroke={variant === "rainbow" ? `url(#${gradientId})` : stroke.primary}
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Orbiting gold bead */}
          <circle
            cx="16"
            cy="4"
            r="2"
            fill="#F9C846"
            className="drop-shadow-[0_0_6px_rgba(249,200,70,0.8)]"
          />
        </svg>

        {/* Keep the brand mark still while the progress orbit moves around it. */}
        <svg viewBox="0 0 32 32" className="relative h-full w-full" fill="none" aria-hidden="true">
          <g fill="none" stroke={stroke.primary} strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
            <line x1="12" y1="9" x2="12" y2="23" strokeWidth="3" />
            <line x1="14" y1="16" x2="22" y2="9" strokeWidth="2.8" />
            <line x1="14" y1="16" x2="22" y2="23" strokeWidth="2.8" />
          </g>
        </svg>
      </span>
    );
  },
);
Spinner.displayName = "Spinner";
