import React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "../components/ui";
import { cn } from "../lib/utils";
import type { ThemeMode } from "./appTheme";

interface Props {
  theme: ThemeMode;
  onToggle: () => void;
  /** `kid` is rounder and softer; `default` matches the Student/Focus/parent chrome. */
  variant?: "default" | "kid";
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
        variant === "kid"
          ? "rounded-full border-[#E7E0F2] bg-white/70 px-3 text-[#6551BD] dark:border-white/10 dark:bg-white/5 dark:text-[#CDBEFF]"
          : "rounded-full px-3 dark:border-white/10 dark:bg-white/5 dark:text-[#C5CBDA] dark:hover:bg-white/10",
        className,
      )}
    >
      {goingDark ? <Moon size={15} /> : <Sun size={15} />}
    </Button>
  );
};
