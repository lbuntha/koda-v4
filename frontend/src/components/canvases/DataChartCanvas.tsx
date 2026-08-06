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

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent, captionClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { CountingAsset, AssetType } from "../Assets";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { OBJECT_SIZE } from "./objectLayout";
import type { CanvasProps } from "./types";
import { balancedChoiceOrder } from "./choiceOrder";

export type DataQuestionKind = "count" | "total" | "more" | "most";

export interface DataChartConfig {
  kind: DataQuestionKind;
  categories: string[];
  counts: number[];
  /** Index of the category asked about, and the one compared against for `more`. */
  focus: number;
  against: number;
  /**
   * Artwork per category — an asset type id, or `emoji`.
   *
   * A chart is read by telling its columns apart, so each one needs its own
   * picture. This used to be three hardcoded fruit emoji, which meant a slide
   * about ladybirds and frogs drew apples and pears, and choosing an SVG in the
   * studio changed nothing at all.
   */
  assets: string[];
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
  const rawAssets = Array.isArray(input.assets) ? input.assets : [];
  const assets = safeCounts.map((_, index) =>
    typeof rawAssets[index] === "string" && rawAssets[index].trim() ? rawAssets[index] : "");

  return {
    kind,
    categories,
    counts: safeCounts,
    focus: inRange(input.focus, 0),
    against: inRange(input.against, 1),
    assets,
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
    assets: question.config.dataAssets as string[],
  }), [
    question.config.dataKind, question.config.dataCategories,
    question.config.dataCounts, question.config.dataFocus, question.config.dataAgainst,
    question.config.dataAssets,
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
    if (config.kind === "most") {
      return balancedChoiceOrder(config.counts.map((_, index) => index + 1), answer, question.config.answerChoiceSlot);
    }
    const options = new Set<number>([answer]);
    for (const delta of [1, -1, 2, -2, 3]) {
      if (options.size >= 4) break;
      const candidate = answer + delta;
      if (candidate >= 0 && candidate <= 30) options.add(candidate);
    }
    return balancedChoiceOrder([...options].sort((a, b) => a - b), answer, question.config.answerChoiceSlot);
  }, [answer, config.kind, config.counts, question.config.answerChoiceSlot]);

  const accent: CanvasAccent = (["indigo", "violet", "emerald", "purple", "rose"] as CanvasAccent[])
    .includes(question.config.frameColor as CanvasAccent)
    ? (question.config.frameColor as CanvasAccent)
    : "rose";
  const { showGhostGuide, reportActivity } = useGhostGuide({ isPlayMode, isSolved: solved, idleThresholdMs: 10000 });

  /**
   * The chart, sized from the room it has.
   *
   * Objects were a fixed `text-lg` (`md:text-xl`), so a chart of ten read the
   * same on a phone as on a projector: a thin ribbon of tiny fruit adrift in an
   * empty card. The column is the bin here — its width divided by the number of
   * categories, its height divided by the tallest column — and the object takes
   * whichever of those allows less, exactly as every other canvas sizes objects.
   */
  const chartRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const node = chartRef.current;
    if (!node) return;
    const seed = node.getBoundingClientRect();
    setChart({ width: seed.width || 480, height: seed.height || 240 });
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setChart({ width: entry.contentRect.width || 480, height: entry.contentRect.height || 240 });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const width = chart?.width ?? 480;
    const height = chart?.height ?? 240;
    const columns = Math.max(1, config.counts.length);
    const tallest = Math.max(1, ...config.counts);
    /* Baseline, label and tally under every column — the chart proper gets the rest. */
    const footer = width < 420 ? 46 : 56;
    const gap = width < 420 ? 8 : width < 760 ? 16 : 28;

    const columnWidth = (width - gap * (columns - 1)) / columns;
    const stackHeight = Math.max(OBJECT_SIZE.min, height - footer);
    /* Floored, never rounded: rounding a fit up is how a column overflows the
       chart it was measured into by a pixel or two. */
    const size = Math.floor(Math.max(
      14,
      Math.min(
        OBJECT_SIZE.max,
        columnWidth * 0.86,
        (stackHeight - (tallest - 1) * 2) / tallest
      )
    ));

    return { gap, columnWidth, size, footer };
  }, [chart?.width, chart?.height, config.counts]);

  /** A category's artwork: the slide's choice, then the built-in fruit. */
  const assetFor = (index: number) => config.assets[index] || "emoji";

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
      <div className="relative flex w-full flex-1 flex-col items-stretch gap-3 py-1">
        <GhostGuideOverlay
          show={showGhostGuide && !solved && isPlayMode}
          label="Count each column, then tap your answer!"
          isDark={isDark}
          labelPlacement="top"
        />

        <CanvasBin
          label={dataPrompt(config)}
          accent={accent}
          isDark={isDark}
          complete={solved}
          className="flex-1"
        >
          <div ref={chartRef} className="absolute inset-0 flex items-end justify-center" style={{ gap: `${geometry.gap}px` }}>
            {config.counts.map((count, index) => (
              <div
                key={config.categories[index]}
                className="flex min-w-0 flex-col items-center gap-1"
                style={{ width: `${geometry.columnWidth}px` }}
              >
                {/* The column, counted from the baseline up, the way a child reads it. */}
                <div className="flex flex-1 flex-col-reverse items-center justify-start" style={{ gap: "2px" }}>
                  {Array.from({ length: count }).map((_, item) => (
                    <CountingAsset
                      key={item}
                      type={assetFor(index) as AssetType}
                      emoji={EMOJI[index] ?? "\u2b24"}
                      size={geometry.size}
                    />
                  ))}
                </div>
                <span className={`h-0.5 w-full rounded ${isDark ? "bg-slate-600" : "bg-slate-300"}`} />
                <span className={`w-full truncate text-center text-[10px] font-black uppercase tracking-[0.1em] sm:text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {config.categories[index]}
                </span>
                {/* Tally marks always; the numeral only once the child has answered. Printing
                    it up front turns "how many Apples?" into reading a label off the chart —
                    the numeral is the bridge to the abstract form, not a free answer. */}
                <span className={`font-mono text-[11px] tracking-tighter sm:text-xs ${captionClass(isDark)}`}>
                  {"|".repeat(count)} {solved && <span className="font-black">{count}</span>}
                </span>
              </div>
            ))}
          </div>
        </CanvasBin>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Answer choices">
          {choices.map(choice => {
            const isPicked = picked === choice;
            const isRight = solved && choice === answer;
            const dimmed = solved && choice !== answer;
            const label = config.kind === "most" ? config.categories[choice - 1] : choice;
            return (
              <button
                key={choice}
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => { reportActivity(); choose(choice); }}
                aria-pressed={isPicked}
                className={`flex items-center justify-center rounded-2xl border-2 px-4 font-mono font-black tabular-nums
                  outline-none transition-[transform,background-color,border-color,opacity] duration-150
                  focus-visible:ring-4 focus-visible:ring-indigo-400/40
                  h-14 min-w-[4rem] text-2xl sm:h-16 sm:min-w-[4.5rem] sm:text-3xl
                  ${config.kind === "most" ? "text-base sm:text-lg" : ""}
                  ${isPlayMode && !solved ? "cursor-pointer hover:-translate-y-0.5 active:scale-95" : "cursor-default"}
                  ${isRight
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                    : isPicked
                      ? "animate-shake border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200"
                      : isDark
                        ? "border-white/10 bg-white/[0.08] text-slate-100 hover:border-white/25 hover:bg-white/[0.14]"
                        : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:shadow-md"}
                  ${dimmed ? "opacity-40" : ""}`}
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
