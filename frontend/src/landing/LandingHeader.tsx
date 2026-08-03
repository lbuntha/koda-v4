import React from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "../theme/appTheme";
import { Button } from "../components/ui";

interface LandingHeaderProps {
  onSignIn: () => void;
  onStartFree: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ onSignIn, onStartFree }) => {
  const [mode, toggleTheme] = useThemeMode();

  return (
    <header className={`sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)] [-webkit-tap-highlight-color:transparent] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] transition-all dark:border-white/10 dark:bg-[#0B1020]/90 dark:shadow-[0_4px_20px_-8px_rgba(0,0,0,0.4)] ${mode === "dark" ? "dark" : ""}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 sm:px-8 sm:py-3.5">
        {/* Brand Logo */}
        <div
          className="flex touch-manipulation cursor-pointer items-center gap-2.5 select-none active:scale-95 transition-transform shrink-0"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <img
            src="/favicon.svg"
            alt="Koda"
            className="h-8 w-8 shrink-0 rounded-xl shadow-md shadow-indigo-600/20"
          />
          <span className="text-base font-black tracking-tight text-slate-900 sm:text-lg dark:text-white">
            Koda
          </span>
        </div>

        {/* Nav Links (Desktop) */}
        <nav className="hidden items-center gap-7 text-sm font-bold text-slate-500 dark:text-slate-400 md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">
            How it works
          </a>
          <a href="#learning" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">
            Learning
          </a>
          <a href="#for-parents" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">
            For parents
          </a>
          <a href="#faq" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-300">
            FAQ
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-9 w-9 touch-manipulation cursor-pointer rounded-xl p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-800 active:scale-90 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-amber-300"
            title="Toggle Theme"
            aria-label="Toggle dark/light mode"
          >
            {mode === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSignIn}
            className="h-9 touch-manipulation cursor-pointer rounded-xl px-2.5 text-xs font-black text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-95 sm:px-3.5 sm:text-sm dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Sign in
          </Button>

          <Button
            size="sm"
            onClick={onStartFree}
            className="h-9 touch-manipulation cursor-pointer rounded-xl bg-gradient-to-r from-[#6844EA] to-[#534AB7] px-3.5 text-xs font-black text-white shadow-md shadow-indigo-600/30 hover:from-[#5C39DF] hover:to-[#473EA3] active:scale-95 sm:px-4 sm:text-sm"
          >
            Start free
          </Button>
        </div>
      </div>
    </header>
  );
};
