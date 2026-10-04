import React from "react";
import { Search } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

export interface UISearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type" | "className"> {
  /** Names the box for a screen reader, and is its placeholder unless one is given. */
  label: string;
  /** `md`: the box a learner or parent taps. `sm`: sits in a row of compact studio filters. */
  size?: "md" | "sm";
  /** On the wrapper, so a caller can place it in a row (`flex-1`, `min-w-48`). */
  className?: string;
}

/**
 * The one search box: a magnifier inside the theme's field, so every search in
 * the app has the same 2px border, radius and focus ring. A dozen screens had
 * each built their own, and two of them had drifted to a 1px border.
 */
export const UISearchInput = React.forwardRef<HTMLInputElement, UISearchInputProps>(
  ({ label, size = "md", className = "", placeholder, ...props }, ref) => {
    const sm = size === "sm";
    return (
      <label className={`relative block min-w-0 ${className}`}>
        <span className="sr-only">{label}</span>
        <Search
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted ${sm ? "left-2.5" : "left-3.5"}`}
        />
        <input
          ref={ref}
          type="search"
          placeholder={placeholder ?? label}
          className={themeSystem.field("lg", `bg-surface ${sm ? "min-h-9 !py-1.5 pl-8" : "min-h-11 pl-10 pr-4"}`)}
          {...props}
        />
      </label>
    );
  },
);
UISearchInput.displayName = "UISearchInput";
