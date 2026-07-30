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
    <header className={`sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-md transition-colors dark:border-white/10 dark:bg-[#0B1020]/90 ${mode === "dark" ? "dark" : ""}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <img src="/favicon.svg" alt="Koda" className="h-8 w-8 rounded-lg shadow-sm shadow-indigo-600/10" />
          <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
            Koda
          </span>
        </div>

        {/* Nav Links */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-500 dark:text-slate-400 md:flex">
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-amber-300"
            title="Toggle Theme"
            aria-label="Toggle dark/light mode"
          >
            {mode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignIn}
            className="text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Sign in
          </Button>
          <Button
            size="sm"
            onClick={onStartFree}
            className="rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-700"
          >
            Start free
          </Button>
        </div>
      </div>
    </header>
  );
};
