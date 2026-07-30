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
        "shrink-0 transition-all duration-200",
        variant === "kid" && "h-9 rounded-full border-0 bg-transparent px-3 text-[#6551BD] hover:bg-[#F0EBFF] hover:text-[#5C46DF] dark:text-[#CDBEFF] dark:hover:bg-white/10",
        variant === "round"
          && [
            "h-9 w-9 rounded-full border-0 p-0 flex items-center justify-center shadow-none ring-0",
            "bg-transparent text-[#6551BD] hover:bg-[#F0EBFF] hover:text-[#5C46DF]",
            "dark:text-[#CDBEFF] dark:hover:bg-white/10 dark:hover:text-white",
          ].join(" "),
        variant === "default" && "rounded-full px-3 dark:border-white/10 dark:bg-white/5 dark:text-[#C5CBDA] dark:hover:bg-white/10",
        className,
      )}
    >
      <span key={theme} className="flex items-center justify-center">
        {goingDark
          ? <Moon size={18} strokeWidth={2} />
          : <Sun size={18} strokeWidth={2} className="text-amber-500 dark:text-amber-300" />}
      </span>
    </Button>
  );
};
