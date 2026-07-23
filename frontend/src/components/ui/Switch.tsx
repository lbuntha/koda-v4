import React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: "sm" | "md";
}

const switchSize = {
  sm: {
    track: "h-6 w-11",
    thumb: "h-[18px] w-[18px]",
    thumbOff: "translate-x-[3px]",
    thumbOn: "translate-x-[23px]",
  },
  md: {
    track: "h-7 w-12",
    thumb: "h-5 w-5",
    thumbOff: "translate-x-1",
    thumbOn: "translate-x-6",
  },
} as const;

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, size = "md", className, disabled, onClick, ...props }, ref) => {
    const dimensions = switchSize[size];
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        data-state={checked ? "checked" : "unchecked"}
        aria-checked={checked}
        disabled={disabled}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) onCheckedChange?.(!checked);
        }}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6DD8]/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          checked ? "bg-[#534AB7] hover:bg-[#453DA0]" : "bg-[#D8D5E7] hover:bg-[#C9C5DA]",
          dimensions.track,
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none block rounded-full bg-white shadow-[0_2px_6px_rgba(14,11,85,0.22)] ring-1 ring-black/5 transition-transform duration-200 ease-out motion-reduce:transition-none",
            dimensions.thumb,
            checked ? dimensions.thumbOn : dimensions.thumbOff,
          )}
        />
      </button>
    );
  },
);

Switch.displayName = "Switch";
