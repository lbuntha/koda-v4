import React from "react";
import { Loader2 } from "lucide-react";

export type SpinnerSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<SpinnerSize, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-9 h-9",
  xl: "w-12 h-12",
};

export interface UISpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** Announced to screen readers; also the visible caption on the loader shells. */
  label?: string;
}

/**
 * The one spinner. Everything that waits — pages, panels, buttons — should render
 * this rather than hand-rolling an animated border, so a spinner always looks and
 * announces the same way.
 */
export const UISpinner: React.FC<UISpinnerProps> = ({
  size = "md",
  className = "",
  label = "Loading",
}) => (
  <Loader2
    role="status"
    aria-label={label}
    className={`${SIZES[size]} animate-spin text-indigo-600 dark:text-indigo-400 ${className}`}
  />
);

export interface UILoaderProps {
  label?: string;
  size?: SpinnerSize;
  className?: string;
}

/**
 * Fills the content area while a view loads. Sized to hold its own vertical space
 * so the layout does not jump when the content arrives.
 */
export const UIPageLoader: React.FC<UILoaderProps> = ({
  label = "Loading",
  size = "lg",
  className = "",
}) => (
  <div
    className={`flex-1 min-h-[60vh] w-full flex flex-col items-center justify-center gap-3 ${className}`}
  >
    <UISpinner size={size} label={label} />
    <p className="text-sm font-bold font-mono text-slate-500 dark:text-slate-400">{label}</p>
  </div>
);

export interface UIOverlayLoaderProps extends UILoaderProps {
  isOpen: boolean;
}

/**
 * Covers content that is being refreshed in place, keeping it visible underneath
 * so the user does not lose their bearings mid-update.
 */
export const UIOverlayLoader: React.FC<UIOverlayLoaderProps> = ({
  isOpen,
  label = "Loading",
  size = "lg",
  className = "",
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-white/75 dark:bg-slate-950/75 backdrop-blur-sm ${className}`}
    >
      <UISpinner size={size} label={label} />
      <p className="text-sm font-bold font-mono text-slate-600 dark:text-slate-300">{label}</p>
    </div>
  );
};

/** Inline spinner for buttons — inherits the button's text color. */
export const UIButtonSpinner: React.FC<{ className?: string }> = ({ className = "" }) => (
  <Loader2 role="status" aria-label="Loading" className={`w-4 h-4 animate-spin ${className}`} />
);
