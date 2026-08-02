/**
 * The Goods Sort ladder on its own, mounted at `/?preview=goods-sort`.
 *
 * It renders the *real* canvas rather than a mock-up, so what is reviewed here is exactly
 * what a child plays. Reaching this game inside the app means signing in, opening the
 * studio and authoring a question, which is far too much ceremony for the thing it is
 * usually needed for: watching the motion — the pick-up wiggle, the item's name badge,
 * the set-complete flourish, the hint's flight path — and stepping through thirty levels
 * to see the difficulty actually ramp.
 *
 * Unlinked from the app and development-only: `import.meta.env.DEV` is statically false
 * in a production build, so main.tsx drops this branch and the module with it.
 */

import React, { useState } from "react";
import { GoodsSortCanvas } from "./GoodsSortCanvas";
import { GOODS_SORT_LEVELS, spareShelves } from "./goodsSortLevels";
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

export const GoodsSortPreview: React.FC = () => {
  // `&level=30` jumps straight to a rung — checking the biggest board should not mean
  // clicking "Harder" twenty-nine times.
  const [index, setIndex] = useState(() => {
    const asked = Number(new URLSearchParams(window.location.search).get("level"));
    return Number.isFinite(asked) && asked >= 1
      ? Math.min(asked, GOODS_SORT_LEVELS.length) - 1
      : 0;
  });
  const [theme, toggleTheme] = useThemeMode();
  const isDark = theme === "dark";
  // `&frame=modal` reproduces how Curriculum Studio's question preview frames the canvas:
  // `min-h-[420px]` is a *floor*, not a height. Container-query sizing collapsed to nothing
  // there while looking perfect in a fixed-height card, so the two framings are worth being
  // able to flip between.
  const framing = new URLSearchParams(window.location.search).get("frame");
  const level = GOODS_SORT_LEVELS[index];

  // Remounting on level change is the point: it is the same fresh-question path the
  // player takes between activities, so the reset behaviour gets exercised too.
  const question: CountingQuestion = {
    id: `preview-${level.id}`,
    technique: CountingTechnique.GOODS_SORT,
    title: "Goods Shelf Sort",
    instruction: level.teaches,
    objectId: "star",
    targetCount: level.targetCount,
    config: { levelId: level.id },
  };

  return (
    <div className={`${isDark ? "dark" : ""} min-h-screen bg-[#F6F4FF] p-4 dark:bg-[#0F0B1E]`}>
      <header className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-2">
        <h1 className="mr-auto text-sm font-black uppercase tracking-[0.14em] text-[#6F5CC4] dark:text-[#C3B4FF]">
          Goods Sort · level {index + 1} of {GOODS_SORT_LEVELS.length}
        </h1>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow disabled:opacity-40 dark:bg-white/10 dark:text-slate-200"
        >
          ← Easier
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(GOODS_SORT_LEVELS.length - 1, i + 1))}
          disabled={index === GOODS_SORT_LEVELS.length - 1}
          className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow disabled:opacity-40 dark:bg-white/10 dark:text-slate-200"
        >
          Harder →
        </button>
      </header>

      <div className="mx-auto mb-3 flex max-w-5xl flex-wrap items-center gap-2 text-xs font-bold text-[#6E6480] dark:text-[#9A94B8]">
        <span className={`rounded-full px-2 py-0.5 font-black uppercase ${TIER_STYLE[level.difficultyTier]}`}>
          {level.difficultyTier}
        </span>
        <span>{level.name}</span>
        <span>· {level.targetCount} kinds</span>
        <span>· {level.compartmentCapacity} per compartment</span>
        <span>· {spareShelves(level)} spare</span>
        <span>· {level.rows}×{level.cols}</span>
      </div>

      <div
        className={
          framing === "modal"
            ? "mx-auto w-full max-w-2xl min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5"
            : "mx-auto h-[72vh] max-w-5xl rounded-3xl bg-white/70 p-3 shadow-xl ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10"
        }
      >
        <GoodsSortCanvas key={level.id} question={question} isPlayMode isDark={isDark} />
      </div>
    </div>
  );
};
