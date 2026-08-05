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

import React, { useEffect, useMemo, useState } from "react";
import { Ruler } from "lucide-react";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent } from "./canvasTheme";
import type { CanvasProps } from "./types";

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

const UNIT = 26;

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

  useEffect(() => {
    setPicked(null);
    setSolved(false);
  }, [question.id, config.task, config.lengths.join(","), config.labels.join(",")]);

  const choose = (value: number) => {
    if (!isPlayMode || solved) return;
    setPicked(value);
    if (value !== answer) {
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
    const isRight = solved && index + 1 === answer;
    const isWrong = picked === index + 1 && !isRight;
    return (
      <button
        key={`${label}-${index}`}
        type="button"
        disabled={!selectable || !isPlayMode || solved}
        onClick={() => selectable && choose(index + 1)}
        className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-all duration-200 disabled:cursor-default ${
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
          <span className={`w-14 shrink-0 text-[10px] font-black uppercase tracking-[0.12em] ${
            config.task === "measure"
              ? isDark ? "text-emerald-300" : "text-emerald-600"
              : labelColour(index, isDark)
          }`}>
            {label}
          </span>
        )}
        <span className="flex flex-col gap-1">
          <span
            className={`block h-5 rounded-full ${
              // The measure task draws one unnamed bar, so it keeps the activity's own accent;
              // the compare tasks draw named bars, which must match the name.
              config.task === "measure" ? (isDark ? "bg-emerald-400/85" : "bg-emerald-500/85") : barColour(index, isDark)
            }`}
            style={{ width: length * UNIT }}
          />
          {config.task === "measure" && (
            <span className="flex" aria-label={`${length} units`}>
              {Array.from({ length }).map((_, unit) => (
                <span
                  key={unit}
                  style={{ width: UNIT }}
                  // Violet against the emerald bar: two distinct hues so the units read as a
                  // separate ruler, without the glare of yellow on a white worksheet.
                  className={`h-4 border-y border-r first:rounded-l-md first:border-l last:rounded-r-md ${
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
    return [...options].sort((a, b) => a - b);
  })();

  const accent: CanvasAccent = "emerald";

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
      {/* Open stage — each element brings its own outline, and a frame around a frame
          misrepresents what a child sees. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5 py-2">
        <div className="flex w-full max-w-md flex-col gap-2">
          {config.lengths.map((length, index) => bar(length, config.labels[index], index))}
        </div>

        {config.task === "measure" && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {numberChoices.map(choice => {
              const isPicked = picked === choice;
              const isRight = solved && choice === answer;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={!isPlayMode || solved}
                  onClick={() => choose(choice)}
                  className={`h-12 w-12 rounded-2xl border font-mono text-lg font-black transition-all duration-200 disabled:cursor-default ${
                    isRight
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : isPicked
                        ? "border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                        : isDark
                          ? "border-white/10 bg-white/5 text-slate-200 hover:scale-105 hover:border-emerald-400/60"
                          : "border-slate-200/80 bg-white text-slate-700 shadow-sm hover:scale-105 hover:border-emerald-400/60"
                  }`}
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
