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

/** A calm, brand-led loader for page and canvas transitions. */
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
          className="pointer-events-none absolute top-0 aspect-square w-3/4 animate-pulse rounded-full bg-indigo-400/20 blur-2xl motion-reduce:animate-none dark:bg-violet-500/20"
          aria-hidden="true"
        />
      )}

      <div className={cn("relative isolate shrink-0 overflow-visible", SIZE_CLASSES[size])} aria-hidden="true">
        <span className="absolute inset-[9%] rounded-full bg-white/95 shadow-[0_8px_24px_-10px_rgba(79,70,229,0.55)] ring-1 ring-indigo-100/90 dark:bg-slate-900 dark:ring-white/10" />

        {/* The ring moves while the logo remains still and easy to recognize. */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-[spin_1.2s_cubic-bezier(0.55,0.15,0.45,0.85)_infinite] overflow-visible motion-reduce:animate-none"
        >
          <defs>
            <linearGradient id={gradientId} x1="12%" y1="8%" x2="88%" y2="92%">
              <stop offset="0%" stopColor="#7252D8" />
              <stop offset="52%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#55B9F3" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            className="text-indigo-100 dark:text-white/10"
          />
          <path
            d="M 50 5 A 45 45 0 0 1 94 40"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="5"
            strokeLinecap="round"
          />
          <circle cx="94" cy="40" r="3.8" fill="#F9C846" className="drop-shadow-[0_0_5px_rgba(249,200,70,0.85)]" />
        </svg>

        <span className="absolute inset-[3%] animate-[spin_2.8s_linear_infinite_reverse] rounded-full motion-reduce:animate-none">
          <span className="absolute bottom-[13%] left-[8%] h-[8%] w-[8%] rounded-full bg-rose-400 shadow-[0_0_7px_rgba(251,113,133,0.55)]" />
        </span>

        <div className="absolute inset-[24%] flex items-center justify-center">
          <svg
            viewBox="0 0 512 512"
            className="h-full w-full drop-shadow-[0_2px_5px_rgba(114,82,216,0.28)]"
          >
            <defs>
              <linearGradient id={`${gradientId}-mark`} x1="10%" y1="5%" x2="90%" y2="95%">
                <stop offset="0%" stopColor="#7252D8" />
                <stop offset="100%" stopColor="#534AB7" />
              </linearGradient>
            </defs>
            <g fill="none" stroke={`url(#${gradientId}-mark)`} strokeLinecap="round" strokeLinejoin="round">
              <line x1="156" y1="100" x2="156" y2="412" strokeWidth="68" />
              <line x1="188" y1="256" x2="368" y2="100" strokeWidth="64" />
              <line x1="188" y1="266" x2="368" y2="412" strokeWidth="64" />
            </g>
          </svg>
        </div>
      </div>

      {label && (
        <span
          aria-hidden="true"
          className="max-w-[min(18rem,80vw)] text-balance text-[11px] font-semibold tracking-wide text-slate-600 sm:text-xs dark:text-slate-300"
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
