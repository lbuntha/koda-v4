import React from "react";
import { cn } from "../../lib/utils";

export interface KodaLogoSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "fullscreen";
  label?: string;
  glow?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  xs: "h-5 w-5 sm:h-6 sm:w-6",
  sm: "h-7 w-7 sm:h-8 sm:w-8",
  md: "h-10 w-10 sm:h-12 sm:w-12",
  lg: "h-14 w-14 sm:h-16 sm:w-16",
  xl: "h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24",
  fullscreen: "h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24",
};

/** Lightweight branded loader for page and canvas transitions. */
export const KodaLogoSpinner: React.FC<KodaLogoSpinnerProps> = ({
  size = "md",
  label,
  glow = true,
  className,
  ...props
}) => {
  const isFullscreen = size === "fullscreen";
  const gradientId = React.useId().replace(/:/g, "");

  const spinnerContent = (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
      className={cn(
        "relative flex max-w-full select-none flex-col items-center justify-center gap-3 px-2 text-center",
        className,
      )}
      {...props}
    >
      {glow && (
        <span
          className="pointer-events-none absolute top-1/2 aspect-square w-2/3 -translate-y-1/2 rounded-full bg-indigo-400/15 blur-xl dark:bg-violet-500/15"
          aria-hidden="true"
        />
      )}

      <div className={cn("relative isolate shrink-0 overflow-visible", SIZE_CLASSES[size])} aria-hidden="true">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full overflow-visible drop-shadow-[0_6px_12px_rgba(83,74,183,0.16)]"
        >
          <defs>
            <linearGradient id={gradientId} x1="12%" y1="8%" x2="88%" y2="92%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="55%" stopColor="#534AB7" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>

          <circle cx="50" cy="50" r="43" fill="#FFFFFF" className="dark:fill-[#14182A]" />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="6"
            className="text-indigo-100 dark:text-white/10"
            stroke="currentColor"
          />

          <g className="origin-center animate-[spin_.8s_linear_infinite] motion-reduce:animate-none">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="178 86"
            />
            <circle cx="85.5" cy="27.5" r="4" fill="#F9C846" />
          </g>

          <g
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M37 30v40" />
            <path d="m42 50 20-19" />
            <path d="m42 51 20 18" />
          </g>
          <circle cx="66" cy="28" r="2.5" fill="#F9C846" opacity=".9" />
        </svg>
      </div>

      {label && (
        <span
          aria-hidden="true"
          className="max-w-[min(18rem,80vw)] text-balance text-[11px] font-medium text-slate-600 sm:text-xs dark:text-slate-300"
        >
          {label}
        </span>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:bg-[#080B18]/92">
        {spinnerContent}
      </div>
    );
  }

  return spinnerContent;
};
