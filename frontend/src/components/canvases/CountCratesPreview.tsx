/**
 * The Counting Crates ladder on its own, at `/?preview=count-crates` (`&level=N` jumps).
 *
 * Renders the *real* canvas, so what is reviewed here is what a child plays. Reaching this
 * game inside the app means signing in and authoring a question, which is far too much
 * ceremony for watching the motion or stepping through the ladder.
 *
 * Development only: `import.meta.env.DEV` is statically false in a production build, so
 * main.tsx drops this branch and the module with it.
 */

import React, { useState } from "react";
import { CountCratesCanvas } from "./CountCratesCanvas";
import { COUNT_CRATES_LEVELS } from "./countCratesModel";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { useThemeMode } from "../../theme/appTheme";
import { ThemeToggle } from "../../theme/ThemeToggle";

const TIER_STYLE: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  apprentice: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  advanced: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  master: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  grandmaster: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

export const CountCratesPreview: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const [index, setIndex] = useState(() => {
    const asked = Number(params.get("level"));
    return Number.isFinite(asked) && asked >= 1
      ? Math.min(asked, COUNT_CRATES_LEVELS.length) - 1
      : 0;
  });
  const [theme, toggleTheme] = useThemeMode();
  const isDark = theme === "dark";
  const framing = params.get("frame");
  const level = COUNT_CRATES_LEVELS[index];

  const question: CountingQuestion = {
    id: `preview-${level.id}`,
    technique: CountingTechnique.COUNT_CRATES,
    title: "Counting Crates",
    instruction: level.teaches,
    objectId: "star",
    targetCount: level.orderTotal,
    config: { levelId: level.id },
  };

  return (
    <div className={`${isDark ? "dark" : ""} min-h-screen bg-[#F6F4FF] p-4 dark:bg-[#0F0B1E]`}>
      <header className="mx-auto mb-3 flex max-w-4xl flex-wrap items-center gap-2">
        <h1 className="mr-auto text-sm font-black uppercase tracking-[0.14em] text-[#6F5CC4] dark:text-[#C3B4FF]">
          Counting Crates · level {index + 1} of {COUNT_CRATES_LEVELS.length}
        </h1>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button type="button" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}
          className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow disabled:opacity-40 dark:bg-white/10 dark:text-slate-200">← Easier</button>
        <button type="button" onClick={() => setIndex(i => Math.min(COUNT_CRATES_LEVELS.length - 1, i + 1))}
          disabled={index === COUNT_CRATES_LEVELS.length - 1}
          className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow disabled:opacity-40 dark:bg-white/10 dark:text-slate-200">Harder →</button>
      </header>

      <div className="mx-auto mb-3 flex max-w-4xl flex-wrap items-center gap-2 text-xs font-bold text-[#6E6480] dark:text-[#9A94B8]">
        <span className={`rounded-full px-2 py-0.5 font-black uppercase ${TIER_STYLE[level.difficultyTier]}`}>
          {level.difficultyTier}
        </span>
        <span>{level.name}</span>
        <span>· order {level.orderTotal}</span>
        <span>· {level.constraint}</span>
        <span>· {level.opensAllowed} openings</span>
      </div>

      <div className={framing === "modal"
        ? "mx-auto w-full max-w-2xl min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5"
        : "mx-auto h-[70vh] max-w-4xl rounded-3xl bg-white/70 p-3 shadow-xl ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"}>
        <CountCratesCanvas key={level.id} question={question} isPlayMode isDark={isDark} />
      </div>
    </div>
  );
};
