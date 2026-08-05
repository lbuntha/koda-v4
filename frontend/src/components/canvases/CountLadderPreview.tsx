/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The counting ladder on its own, at `/?preview=count-ladder` (`&level=N` jumps).
 *
 * Renders the *real* canvas for each level, so what is reviewed here is what a child plays.
 * Reaching these inside the app means signing in, authoring a question per level and
 * publishing a release — far too much ceremony for the question this answers: does the
 * ladder actually climb, and does each rung work?
 *
 * Unlike the other previews this one changes *canvas* as it climbs, because the ladder does:
 * no counting canvas spans 3 to 20, so past twelve the strategy has to change. Watching that
 * handoff is most of the point of looking at it.
 *
 * Development only: `import.meta.env.DEV` is statically false in a production build, so
 * main.tsx drops this branch and the module with it.
 */

import React, { Suspense, useState } from "react";
import { COUNT_CURRICULUM_LEVELS } from "./countLevels";
import { EQUATION_PREVIEW_LEVELS } from "./equationPreviewLevels";
import { CANVAS_BY_TECHNIQUE } from "../studio/canvasRegistry";
import { type CountingQuestion } from "../../types";
import { useThemeMode } from "../../theme/appTheme";
import { ThemeToggle } from "../../theme/ThemeToggle";
import { SvgLibraryProvider } from "../../assets/SvgLibraryContext";
import { AuthProvider } from "../../auth/AuthContext";

const TIER_STYLE: Record<string, string> = {
  starter: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  developing: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  secure: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  extending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

/**
 * The counting canvases draw their objects with `CountingAsset`, which reads the account's SVG
 * library, and that provider in turn reads auth. Previews render outside the app's provider
 * tree, so the ladder brings both with it. With no API configured the auth provider resolves
 * straight to offline, which is exactly what a preview wants — no sign-in.
 */
export const CountLadderPreview: React.FC = () => (
  <AuthProvider>
    <SvgLibraryProvider>
      <CountLadder />
    </SvgLibraryProvider>
  </AuthProvider>
);

const CountLadder: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  // `?ladder=equation` swaps in the Equation Mat cases; the harness renders either.
  const ladder = params.get("ladder") === "equation" ? EQUATION_PREVIEW_LEVELS : COUNT_CURRICULUM_LEVELS;
  const [index, setIndex] = useState(() => {
    const asked = Number(params.get("level"));
    return Number.isFinite(asked) && asked >= 1
      ? Math.min(asked, ladder.length) - 1
      : 0;
  });
  const [theme, toggleTheme] = useThemeMode();
  const isDark = theme === "dark";
  const [solved, setSolved] = useState<string | null>(null);

  const level = ladder[index];
  const Canvas = CANVAS_BY_TECHNIQUE[level.technique];

  const question: CountingQuestion = {
    id: `preview-${level.id}`,
    technique: level.technique,
    title: level.label,
    instruction: "Count them all, then tell me how many.",
    objectId: "apple",
    targetCount: level.targetCount,
    config: { ...level.config },
  } as CountingQuestion;

  const go = (next: number) => {
    setSolved(null);
    setIndex(next);
  };

  return (
    <div className={`${isDark ? "dark" : ""} min-h-screen bg-[#F6F4FF] p-4 dark:bg-[#0F0B1E]`}>
      <header className="mx-auto mb-3 flex max-w-4xl flex-wrap items-center gap-2">
        <h1 className="mr-auto text-sm font-black uppercase tracking-[0.14em] text-[#6F5CC4] dark:text-[#C3B4FF]">
          Counting ladder · level {index + 1} of {ladder.length}
        </h1>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <button type="button" onClick={() => go(Math.max(0, index - 1))} disabled={index === 0}
          className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow disabled:opacity-40 dark:bg-white/10 dark:text-slate-200">← Easier</button>
        <button type="button" onClick={() => go(Math.min(ladder.length - 1, index + 1))}
          disabled={index === ladder.length - 1}
          className="rounded-full bg-white px-3 py-1 text-xs font-bold shadow disabled:opacity-40 dark:bg-white/10 dark:text-slate-200">Harder →</button>
      </header>

      <div className="mx-auto mb-2 flex max-w-4xl flex-wrap items-center gap-2 text-xs font-bold text-[#6E6480] dark:text-[#9A94B8]">
        <span className={`rounded-full px-2 py-0.5 font-black uppercase ${TIER_STYLE[level.tier]}`}>{level.tier}</span>
        <span>{level.label}</span>
        <span>· count {level.targetCount}</span>
        <span className="font-mono text-[10px] opacity-70">{level.technique}</span>
        {solved === level.id && <span className="text-emerald-600 dark:text-emerald-400">· solved ✓</span>}
      </div>

      <p className="mx-auto mb-3 max-w-4xl text-xs leading-relaxed text-[#6E6480] dark:text-[#9A94B8]">
        {level.rationale}
      </p>

      {/* No card, no border: each canvas brings its own chrome, and a frame around a frame
          misrepresents what a child actually sees. Height is kept because it is not
          decoration — Group in Tens lays twenty loose beads in a tray below both ten-frames,
          and in a shorter stage they land under the bottom edge. */}
      <div className="mx-auto h-[74vh] min-h-[560px] max-w-4xl">
        <Suspense fallback={<div className="p-6 text-xs text-slate-500">Loading {level.technique}…</div>}>
          {Canvas
            ? <Canvas key={level.id} question={question} isPlayMode isDark={isDark}
                      onSuccess={() => setSolved(level.id)} />
            : <div className="p-6 text-xs text-rose-600">No canvas registered for {level.technique}</div>}
        </Suspense>
      </div>

      {/* The whole ladder at a glance — the handoff between canvases is the thing to look at. */}
      <div className="mx-auto mt-3 flex max-w-4xl flex-wrap gap-1">
        {ladder.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(itemIndex)}
            title={`${item.label} — ${item.technique}`}
            className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
              itemIndex === index
                ? "bg-[#6F5CC4] text-white"
                : "bg-white text-[#6E6480] hover:bg-white/70 dark:bg-white/10 dark:text-slate-300"
            }`}
          >
            {item.targetCount}
          </button>
        ))}
      </div>
    </div>
  );
};
