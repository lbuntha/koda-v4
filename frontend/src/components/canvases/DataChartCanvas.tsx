/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Data Chart — up to three categories, asked four ways (1.MD.C.4).
 *
 *   count     how many are in one category
 *   total     how many altogether
 *   more      how many more one category has than another
 *   most      which category has the most
 *
 * The chart is drawn as counted objects stacked in columns rather than as an abstract bar,
 * because a Grade 1 child reads a graph by counting it. The tally beneath each column is the
 * bridge to the abstract form: same quantity, two representations, side by side.
 */

import React, { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent } from "./canvasTheme";
import type { CanvasProps } from "./types";

export type DataQuestionKind = "count" | "total" | "more" | "most";

export interface DataChartConfig {
  kind: DataQuestionKind;
  categories: string[];
  counts: number[];
  /** Index of the category asked about, and the one compared against for `more`. */
  focus: number;
  against: number;
}

const DEFAULT_CATEGORIES = ["Apples", "Pears", "Plums"];
const EMOJI = ["🍎", "🍐", "🍇"];

export function normalizeDataConfig(input: Partial<DataChartConfig>): DataChartConfig {
  const kind: DataQuestionKind =
    input.kind === "total" || input.kind === "more" || input.kind === "most" ? input.kind : "count";
  const rawCounts = Array.isArray(input.counts) ? input.counts : [];
  const counts = rawCounts
    .map(value => Math.round(Number(value)))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 10);
  const safeCounts = counts.length >= 2 ? counts.slice(0, 3) : [6, 2, 4];
  const categories = (input.categories ?? []).length === safeCounts.length
    ? input.categories!
    : safeCounts.map((_, index) => DEFAULT_CATEGORIES[index] ?? `Group ${index + 1}`);
  const inRange = (value: unknown, fallback: number) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 0 && n < safeCounts.length ? n : fallback;
  };
  return {
    kind,
    categories,
    counts: safeCounts,
    focus: inRange(input.focus, 0),
    against: inRange(input.against, 1),
  };
}

export function dataAnswer(config: DataChartConfig): number {
  if (config.kind === "total") return config.counts.reduce((sum, value) => sum + value, 0);
  if (config.kind === "more") return config.counts[config.focus] - config.counts[config.against];
  if (config.kind === "most") return config.counts.indexOf(Math.max(...config.counts)) + 1;
  return config.counts[config.focus];
}

export function dataPrompt(config: DataChartConfig): string {
  if (config.kind === "total") return "How many altogether?";
  if (config.kind === "more") return `How many more ${config.categories[config.focus]} than ${config.categories[config.against]}?`;
  if (config.kind === "most") return "Which group has the most?";
  return `How many ${config.categories[config.focus]}?`;
}

export const DataChartCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  showGrid,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeDataConfig({
    kind: question.config.dataKind as DataQuestionKind,
    categories: question.config.dataCategories as string[],
    counts: question.config.dataCounts as number[],
    focus: question.config.dataFocus as number,
    against: question.config.dataAgainst as number,
  }), [
    question.config.dataKind, question.config.dataCategories,
    question.config.dataCounts, question.config.dataFocus, question.config.dataAgainst,
  ]);

  const answer = dataAnswer(config);
  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    setPicked(null);
    setSolved(false);
  }, [question.id, config.kind, config.counts.join(","), config.focus, config.against]);

  const choose = (value: number) => {
    if (!isPlayMode || solved) return;
    setPicked(value);
    if (value !== answer) {
      sounds.playFail();
      onAttempt?.("incorrect", { expected: answer, selected: value, details: { kind: config.kind } });
      return;
    }
    sounds.playWin();
    setSolved(true);
    onAttempt?.("correct", { expected: answer, selected: value, details: { kind: config.kind } });
    onSuccess?.();
  };

  const choices = useMemo(() => {
    if (config.kind === "most") return config.counts.map((_, index) => index + 1);
    const options = new Set<number>([answer]);
    for (const delta of [1, -1, 2, -2, 3]) {
      if (options.size >= 4) break;
      const candidate = answer + delta;
      if (candidate >= 0 && candidate <= 30) options.add(candidate);
    }
    return [...options].sort((a, b) => a - b);
  }, [answer, config.kind, config.counts]);

  const accent: CanvasAccent = "rose";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={dataPrompt(config)}
      showGrid={showGrid}
      isDark={isDark}
      accent={accent}
      headerIcon={<BarChart3 size={16} />}
      headerTitle="Data Chart"
      headerSubtitle={dataPrompt(config)}
      readAloudText={dataPrompt(config)}
      headerActions={
        <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
          {solved ? (config.kind === "most" ? config.categories[answer - 1] : answer) : "Read the chart"}
        </CanvasChip>
      }
      footerStatus={solved ? "Spot on! Counting the chart gives the answer." : picked !== null ? "Not quite \u2014 count each column again." : undefined}
      footerSolved={solved}
    >
      {/* Open stage — each element brings its own outline, and a frame around a frame
          misrepresents what a child sees. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5 py-2">
        <div className="flex items-end justify-center gap-5 md:gap-8">
          {config.counts.map((count, index) => (
            <div key={config.categories[index]} className="flex flex-col items-center gap-1.5">
              <div className="flex flex-col-reverse items-center gap-1">
                {Array.from({ length: count }).map((_, item) => (
                  <span key={item} className="text-lg leading-none md:text-xl">{EMOJI[index] ?? "\u2b24"}</span>
                ))}
              </div>
              <span className={`h-0.5 w-14 rounded ${isDark ? "bg-slate-600" : "bg-slate-300"}`} />
              <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                {config.categories[index]}
              </span>
              {/* Tally marks always; the numeral only once the child has answered. Printing
                  it up front turns "how many Apples?" into reading a label off the chart —
                  the numeral is the bridge to the abstract form, not a free answer. */}
              <span className={`font-mono text-[11px] tracking-tighter ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {"|".repeat(count)} {solved && <span className="font-black">{count}</span>}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {choices.map(choice => {
            const isPicked = picked === choice;
            const isRight = solved && choice === answer;
            const label = config.kind === "most" ? config.categories[choice - 1] : choice;
            return (
              <button
                key={choice}
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => choose(choice)}
                className={`h-12 min-w-[52px] rounded-2xl border px-3 font-mono text-base font-black transition-all duration-200 disabled:cursor-default ${
                  isRight
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : isPicked
                      ? "border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : isDark
                        ? "border-white/10 bg-white/5 text-slate-200 hover:scale-105 hover:border-rose-400/60"
                        : "border-slate-200/80 bg-white text-slate-700 shadow-sm hover:scale-105 hover:border-rose-400/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
