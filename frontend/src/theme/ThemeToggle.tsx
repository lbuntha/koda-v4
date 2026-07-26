import React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "../components/ui";
import { cn } from "../lib/utils";
import type { ThemeMode } from "./appTheme";

interface Props {
  theme: ThemeMode;
  onToggle: () => void;
  /**
   * `kid` is rounder and softer, `round` is a borderless white disc for the parent toolbar,
   * `default` matches the Student/Focus chrome.
   */
  variant?: "default" | "kid" | "round";
  className?: string;
}

/** Light/dark switch for learner and parent pages. Icon shows the mode you get by pressing it. */
export const ThemeToggle: React.FC<Props> = ({ theme, onToggle, variant = "default", className }) => {
  const goingDark = theme === "light";
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onToggle}
      aria-label={goingDark ? "Switch to dark mode" : "Switch to light mode"}
      title={goingDark ? "Dark mode" : "Light mode"}
      className={cn(
        "shrink-0",
        variant === "kid" && "rounded-full border-[#E7E0F2] bg-white/70 px-3 text-[#6551BD] dark:border-white/10 dark:bg-white/5 dark:text-[#CDBEFF]",
        variant === "round"
          && [
            // A lit disc rather than a flat circle: top-down gradient, hairline ring, and a
            // coloured shadow so it reads as a raised control on the tinted toolbar.
            "h-11 w-11 rounded-full border-0 p-0 transition-all duration-200",
            "bg-[image:linear-gradient(180deg,#FFFFFF_0%,#F3F0FF_100%)] text-[#5B48D6]",
            "ring-1 ring-[#E9E3FA] shadow-[0_6px_16px_-6px_rgba(70,50,155,0.35)]",
            "hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-8px_rgba(70,50,155,0.45)] active:translate-y-0",
            // Dark: a soft glass plate, and the sun picks up warmth so the cue reads instantly.
            "dark:bg-[image:linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_100%)]",
            "dark:text-amber-300 dark:ring-white/10 dark:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.7)]",
          ].join(" "),
        variant === "default" && "rounded-full px-3 dark:border-white/10 dark:bg-white/5 dark:text-[#C5CBDA] dark:hover:bg-white/10",
        className,
      )}
    >
      <span key={theme} className={variant === "round" ? "animate-scale-in" : undefined}>
        {goingDark
          ? <Moon size={variant === "round" ? 19 : 15} strokeWidth={variant === "round" ? 2.2 : 2} />
          : <Sun size={variant === "round" ? 19 : 15} strokeWidth={variant === "round" ? 2.2 : 2} />}
      </span>
    </Button>
  );
};
