import React from "react";
import { LogOut } from "lucide-react";
import { Button } from "../../components/ui";
import { cn } from "../../lib/utils";
import { ThemeToggle } from "../../theme/ThemeToggle";
import type { ThemeMode } from "../../theme/appTheme";

interface Props {
  studentName: string;
  studentAvatar?: string | null;
  onExit: () => void;
  /** Optional slot on the right of the greeting (e.g. a streak in later bands). */
  right?: React.ReactNode;
  variant?: "default" | "focus";
  wide?: boolean;
  /** Renders the light/dark switch when both are supplied. */
  theme?: ThemeMode;
  onToggleTheme?: () => void;
}

/** Shared student-home header: avatar + greeting + theme switch + Exit. */
export const HomeHeader: React.FC<Props> = ({
  studentName,
  studentAvatar,
  onExit,
  right,
  variant = "default",
  wide = false,
  theme,
  onToggleTheme,
}) => (
  <header className={cn(
    "border-b px-5 py-4 backdrop-blur md:px-8",
    variant === "focus"
      ? "border-[#DCE1EB] bg-white/85 dark:border-white/10 dark:bg-[#111624]/90"
      : "border-[#E8E5F2] bg-white/90 dark:border-white/10 dark:bg-[#151A2B]/90",
  )}>
    <div className={cn("mx-auto flex items-center justify-between gap-4", wide ? "max-w-6xl" : "max-w-3xl")}>
      <div className="flex items-center gap-3">
        <span className={cn(
          "flex h-11 w-11 items-center justify-center text-xl font-bold text-white",
          variant === "focus"
            ? "rounded-xl bg-[#242B3C] shadow-sm dark:bg-[#4457E0]"
            : "rounded-2xl bg-[#5B48D6] shadow-lg shadow-violet-200 dark:shadow-none",
        )} aria-hidden>
          {studentAvatar || studentName.trim().charAt(0).toUpperCase() || "🙂"}
        </span>
        <div>
          <p className={cn(
            "text-[10px] font-bold uppercase tracking-[0.18em]",
            variant === "focus" ? "text-[#7A8296] dark:text-[#8891AC]" : "text-[#6A5FA0] dark:text-[#9C93C6]",
          )}>Today’s learning</p>
          <h1 className="text-lg font-bold">Koda Learning</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {right}
        {theme && onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
        <Button
          variant="outline"
          onClick={onExit}
          className="dark:border-white/10 dark:bg-white/5 dark:text-[#C5CBDA] dark:hover:bg-white/10"
        >
          <LogOut size={16} /> <span className="hidden sm:inline">Exit</span>
        </Button>
      </div>
    </div>
  </header>
);
