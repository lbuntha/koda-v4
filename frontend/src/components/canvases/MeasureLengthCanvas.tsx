/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Measure Length — lay equal units end to end (1.MD.A.2), or order objects by length
 * (1.MD.A.1). Two tasks, one component, because they are the same idea approached twice:
 * length is a count of units, and comparing is comparing those counts.
 *
 *   measure  a bar with unit cubes laid beneath it, gap-free; the child counts the units
 *   compare  two or three bars drawn to scale; the child taps the longest or the shortest
 *
 * The units are drawn touching, without gaps or overlaps, because "no gaps or overlaps" is
 * literally what the standard asks the child to understand — a picture with gaps teaches the
 * misconception the lesson is meant to prevent.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Ruler } from "lucide-react";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import type { CanvasProps } from "./types";
import { balancedChoiceOrder } from "./choiceOrder";

export type MeasureTask = "measure" | "longest" | "shortest";

export interface MeasureConfig {
  task: MeasureTask;
  /** Unit lengths. `measure` uses the first; the compare tasks use them all. */
  lengths: number[];
  labels: string[];
}

/**
 * A colour name is only worth using when there is more than one bar to tell apart, and only
 * if the bar is actually that colour — "RED" printed beside a green bar is a contradiction a
 * six-year-old spots before an adult does.
 *
 * So the compare tasks get colour names, matched to `BAR_COLOURS` below. The `measure` task
 * draws a single bar with nothing to distinguish it from, so naming it "Red" was pure noise on
 * top of being wrong; it is just "Bar" unless the author names the thing being measured, which
 * is the one label that earns its place ("How long is the pencil?").
 *
 * Colour is the *label*, never a clue: the child is comparing lengths either way.
 */
const DEFAULT_LABELS = ["Red", "Blue", "Green"];

/**
 * Names that carry no meaning on a single bar. Questions authored before the measure task
 * stopped defaulting to colour names still carry `measureLabels: ["Red"]`, and a lone bar
 * captioned RED is both meaningless and — now that the label is inked to match the bar —
 * printed in green. Treated as unnamed, so only a name an author actually chose survives.
 */
const PLACEHOLDER_LABELS = new Set(
  [...DEFAULT_LABELS, "Bar", "Bar 1", "Bar 2", "Bar 3", "Bar 4"].map(name => name.toLowerCase()),
);

export const UNNAMED = "Bar";
export const isPlaceholderLabel = (label: string) =>
  PLACEHOLDER_LABELS.has(label.trim().toLowerCase());

/** Bar fill and label ink, kept together so a label can never name a colour the bar is not. */
export const BAR_COLOURS = [
  { bar: "bg-rose-500/85", ink: "text-rose-600", barDark: "bg-rose-400/85", inkDark: "text-rose-300" },
  { bar: "bg-sky-500/85", ink: "text-sky-600", barDark: "bg-sky-400/85", inkDark: "text-sky-300" },
  { bar: "bg-emerald-500/85", ink: "text-emerald-600", barDark: "bg-emerald-400/85", inkDark: "text-emerald-300" },
  { bar: "bg-violet-500/85", ink: "text-violet-600", barDark: "bg-violet-400/85", inkDark: "text-violet-300" },
];

const swatch = (index: number) => BAR_COLOURS[index % BAR_COLOURS.length];
export const barColour = (index: number, isDark: boolean) =>
  isDark ? swatch(index).barDark : swatch(index).bar;
/** The label is the bar's name, so it is written in the bar's own colour. */
export const labelColour = (index: number, isDark: boolean) =>
  isDark ? swatch(index).inkDark : swatch(index).ink;

export function normalizeMeasureConfig(input: Partial<MeasureConfig>): MeasureConfig {
  const task: MeasureTask =
    input.task === "longest" || input.task === "shortest" ? input.task : "measure";
  const raw = Array.isArray(input.lengths) ? input.lengths : [];
  const cleaned = raw
    .map(value => Math.round(Number(value)))
    .filter(value => Number.isFinite(value) && value >= 1 && value <= 12);
  const lengths = cleaned.length > 0 ? cleaned : task === "measure" ? [5] : [3, 6, 4];
  const authored = (input.labels ?? []).length === lengths.length ? input.labels! : null;
  const labels = task === "measure"
    // A lone bar is unnamed unless the author named the thing being measured. An inherited
    // colour name is not such a name, so it collapses back to the unnamed marker.
    ? [authored && !isPlaceholderLabel(authored[0]) ? authored[0] : UNNAMED]
    : authored ?? lengths.map((_, index) => DEFAULT_LABELS[index] ?? `Bar ${index + 1}`);
  return { task, lengths: task === "measure" ? [lengths[0]] : lengths, labels };
}

/** For `measure` the answer is the unit count; for the compare tasks it is the bar's position. */
export function measureAnswer(config: MeasureConfig): number {
  if (config.task === "measure") return config.lengths[0];
  const target = config.task === "longest"
    ? Math.max(...config.lengths)
    : Math.min(...config.lengths);
  return config.lengths.indexOf(target) + 1;
}

export const MeasureLengthCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  showGrid,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeMeasureConfig({
    task: question.config.measureTask as MeasureTask,
    lengths: question.config.measureLengths as number[],
    labels: question.config.measureLabels as string[],
  }), [question.config.measureTask, question.config.measureLengths, question.config.measureLabels]);

  const answer = measureAnswer(config);
  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const { showGhostGuide, reportActivity } = useGhostGuide({ isPlayMode, isSolved: solved, idleThresholdMs: 10000 });

  /**
   * The unit, sized from the room the board has.
   *
   * It was a flat 26px inside a `max-w-md` column, so a twelve-unit bar was
   * 312px whatever it was drawn on: it ran off a phone and sat as a thin ribbon
   * in the middle of a projector. Length is the whole subject here, so the unit
   * has to be as big as the board can honestly carry — and the units under the
   * bar must stay touching at every size, since "no gaps or overlaps" is the
   * misconception this activity exists to prevent.
   */
  const boardRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    const seed = node.getBoundingClientRect();
    setBoard({ width: seed.width || 520, height: seed.height || 220 });
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setBoard({ width: entry.contentRect.width || 520, height: entry.contentRect.height || 220 });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const width = board?.width ?? 520;
    const height = board?.height ?? 220;
    const isCompact = width < 480;
    const rows = Math.max(1, config.lengths.length);
    const longest = Math.max(1, ...config.lengths);

    const labelWidth = config.task === "measure" ? 0 : isCompact ? 52 : 72;
    const rowGap = isCompact ? 8 : 12;
    const rowPadding = isCompact ? 12 : 20;
    const trackWidth = Math.max(60, width - labelWidth - rowPadding);

    /* Every row must fit: the bar, and in the measure task the ruler under it. */
    const rowHeight = (height - rowGap * (rows - 1)) / rows;
    const stacked = config.task === "measure" ? 2.35 : 1.5;

    // Floored, never rounded: rounding a fit up is how the last unit falls off
    // the end of the board.
    const unit = Math.floor(Math.max(
      10,
      // Capped at 72: past that a unit cube stops reading as a unit and starts
      // reading as the object being measured.
      Math.min(72, trackWidth / longest, (rowHeight - 8) / stacked)
    ));

    return {
      isCompact,
      unit,
      labelWidth,
      rowGap,
      barHeight: Math.max(10, Math.round(unit * 0.78)),
      unitHeight: Math.max(8, Math.round(unit * 0.62))
    };
  }, [board?.width, board?.height, config.lengths, config.task]);

  useEffect(() => {
    setPicked(null);
    setSolved(false);
  }, [question.id, config.task, config.lengths.join(","), config.labels.join(",")]);

  /**
   * A tap is right if it names a bar of the right *length*, not the one index
   * `measureAnswer` happened to return first. Two bars of equal length are both
   * "the longest", and marking the second one wrong is a lie a child can see.
   */
  const isCorrectChoice = (value: number) => {
    if (value === answer) return true;
    if (config.task === "measure") return false;
    const chosen = config.lengths[value - 1];
    return chosen !== undefined && chosen === config.lengths[answer - 1];
  };

  const choose = (value: number) => {
    if (!isPlayMode || solved) return;
    setPicked(value);
    if (!isCorrectChoice(value)) {
      sounds.playFail();
      onAttempt?.("incorrect", { expected: answer, selected: value, details: { task: config.task } });
      return;
    }
    sounds.playWin();
    setSolved(true);
    onAttempt?.("correct", { expected: answer, selected: value, details: { task: config.task } });
    onSuccess?.();
  };

  /** A bar drawn to scale. In `measure` the units sit beneath it, touching. */
  const bar = (length: number, label: string, index: number) => {
    const selectable = config.task !== "measure";
    const isRight = solved && isCorrectChoice(index + 1);
    const isWrong = picked === index + 1 && !isRight;
    return (
      <button
        key={`${label}-${index}`}
        type="button"
        disabled={!selectable || !isPlayMode || solved}
        onClick={() => selectable && choose(index + 1)}
        className={`flex w-full items-center rounded-2xl border text-left outline-none transition-all duration-200 disabled:cursor-default
          focus-visible:ring-4 focus-visible:ring-indigo-400/40 ${geometry.isCompact ? "gap-2 p-1.5" : "gap-3 p-2"} ${
          isRight
            ? "border-emerald-400 bg-emerald-500/10"
            : isWrong
              ? "border-rose-400 bg-rose-500/10"
              : selectable
                ? isDark
                  ? "border-white/10 bg-white/5 hover:border-emerald-400/60"
                  : "border-slate-200/80 bg-white hover:border-emerald-400/60"
                : "border-transparent"
        }`}
      >
        {/* One unnamed bar has nothing to be told apart from, so the placeholder label is not
            drawn at all — but an author who named the thing being measured keeps their name. */}
        {!(config.task === "measure" && label === UNNAMED) && (
          <span
            style={{ width: `${geometry.labelWidth}px` }}
            className={`shrink-0 truncate text-[10px] font-black uppercase tracking-[0.12em] sm:text-xs ${
            config.task === "measure"
              ? isDark ? "text-emerald-300" : "text-emerald-600"
              : labelColour(index, isDark)
          }`}
          >
            {label}
          </span>
        )}
        <span className="flex flex-col gap-1">
          <span
            style={{ width: length * geometry.unit, height: geometry.barHeight }}
            className={`block rounded-full ${
              // The measure task draws one unnamed bar, so it keeps the activity's own accent;
              // the compare tasks draw named bars, which must match the name.
              config.task === "measure" ? (isDark ? "bg-emerald-400/85" : "bg-emerald-500/85") : barColour(index, isDark)
            }`}
          />
          {config.task === "measure" && (
            <span className="flex" aria-label={`${length} units`}>
              {Array.from({ length }).map((_, unit) => (
                <span
                  key={unit}
                  style={{ width: geometry.unit, height: geometry.unitHeight }}
                  // Violet against the emerald bar: two distinct hues so the units read as a
                  // separate ruler, without the glare of yellow on a white worksheet.
                  className={`border-y border-r first:rounded-l-md first:border-l last:rounded-r-md ${
                    isDark ? "border-violet-300/70 bg-violet-400/25" : "border-violet-500/60 bg-violet-300/35"
                  }`}
                />
              ))}
            </span>
          )}
        </span>
      </button>
    );
  };

  const numberChoices = (() => {
    const options = new Set<number>([answer]);
    for (const delta of [1, -1, 2, -2]) {
      if (options.size >= 4) break;
      const candidate = answer + delta;
      if (candidate >= 1 && candidate <= 12) options.add(candidate);
    }
    return balancedChoiceOrder(
      [...options].sort((a, b) => a - b),
      answer,
      question.config.answerChoiceSlot,
    );
  })();

  const accent: CanvasAccent = (["indigo", "violet", "emerald", "purple", "rose"] as CanvasAccent[])
    .includes(question.config.frameColor as CanvasAccent)
    ? (question.config.frameColor as CanvasAccent)
    : "emerald";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={config.task === "measure" ? "Count the units under the bar. How long is it?" : `Tap the ${config.task} bar.`}
      showGrid={showGrid}
      isDark={isDark}
      accent={accent}
      headerIcon={<Ruler size={16} />}
      headerTitle="Measure Length"
      // Never the unit count here — for the measure task that IS the answer, printed above a
      // question asking the child to work it out.
      headerSubtitle={config.task === "measure" ? "count the units" : `find the ${config.task}`}
      readAloudText={config.task === "measure" ? "Count the units under the bar. How long is it?" : `Tap the ${config.task} bar.`}
      headerActions={
        <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
          {solved ? (config.task === "measure" ? answer : config.labels[answer - 1]) : "Look closely"}
        </CanvasChip>
      }
      footerStatus={solved ? (config.task === "measure" ? `Spot on! ${answer} units end to end.` : `Spot on! ${config.labels[answer - 1]} is the ${config.task}.`) : picked !== null ? "Not quite \u2014 check again, counting every unit." : undefined}
      footerSolved={solved}
    >
      <div className="relative flex w-full flex-1 flex-col items-stretch gap-3 py-1">
        <GhostGuideOverlay
          show={showGhostGuide && !solved && isPlayMode}
          label={config.task === "measure" ? "Count the units under the bar — no gaps!" : `Tap the ${config.task} bar!`}
          isDark={isDark}
          labelPlacement="top"
        />

        <CanvasBin
          label={config.task === "measure" ? "How long is it?" : `Find the ${config.task}`}
          accent={accent}
          isDark={isDark}
          complete={solved}
          className="flex-1"
        >
          {/* The board fills its bin, so the unit is as big as the room honestly allows. */}
          <div
            ref={boardRef}
            className="absolute inset-0 flex flex-col justify-center"
            style={{ gap: `${geometry.rowGap}px` }}
          >
            {config.lengths.map((length, index) => bar(length, config.labels[index], index))}
          </div>
        </CanvasBin>

        {config.task === "measure" && (
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Answer choices">
            {numberChoices.map(choice => {
              const isPicked = picked === choice;
              const isRight = solved && choice === answer;
              const dimmed = solved && choice !== answer;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={!isPlayMode || solved}
                  onClick={() => { reportActivity(); choose(choice); }}
                  aria-pressed={isPicked}
                  aria-label={`Answer ${choice}`}
                  className={`flex items-center justify-center rounded-2xl border-2 font-mono font-black tabular-nums
                    outline-none transition-[transform,background-color,border-color,opacity] duration-150
                    focus-visible:ring-4 focus-visible:ring-indigo-400/40
                    h-14 min-w-[4rem] px-4 text-2xl sm:h-16 sm:min-w-[4.5rem] sm:text-3xl
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
                  {choice}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </SharedCanvasLayout>
  );
};
