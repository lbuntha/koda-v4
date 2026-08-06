import React, { useEffect, useMemo, useState } from "react";
import { Check, Circle, Footprints, Grid3X3, RotateCcw, Route, Waypoints } from "lucide-react";
import { sounds } from "../../sound";
import { Button } from "../ui";
import { CanvasProps } from "./types";
import { CanvasChip } from "./canvasTheme";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import {
  arrangedPathNumbers,
  pathColumnCount,
  mazeNumbers,
  normalizeNumberPathConfig,
  numberPathInstruction,
  pathNumbers,
  requiredNumbers,
} from "./numberPathModel";

const allChartNumbers = Array.from({ length: 120 }, (_, index) => index + 1);
const circlePositions10 = [
  "left-1/2 top-[4%]", "left-[76%] top-[13%]", "left-[92%] top-[36%]", "left-[92%] top-[64%]", "left-[76%] top-[87%]",
  "left-1/2 top-[96%]", "left-[24%] top-[87%]", "left-[8%] top-[64%]", "left-[8%] top-[36%]", "left-[24%] top-[13%]",
] as const;
const circlePositions11 = [
  "left-1/2 top-[4%]", "left-[74%] top-[11%]", "left-[90%] top-[29%]", "left-[94%] top-[54%]", "left-[83%] top-[78%]", "left-[62%] top-[93%]",
  "left-[38%] top-[93%]", "left-[17%] top-[78%]", "left-[6%] top-[54%]", "left-[10%] top-[29%]", "left-[26%] top-[11%]",
] as const;

/** Curved SVG arrow connecting start cell to target cell in the 120 chart. */
const ConnectionArrow: React.FC<{ task: string }> = ({ task }) => {
  const isTenLess = task === "ten_less";
  const label = isTenLess ? "−10" : "+10";
  return (
    <div className="absolute left-[calc(100%-4px)] top-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center">
      <svg width="28" height="38" viewBox="0 0 28 38" className="overflow-visible text-purple-600 dark:text-purple-400">
        <defs>
          <marker id="chart-arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="currentColor" />
          </marker>
        </defs>
        <path
          d={isTenLess ? "M 2 32 C 20 32 20 6 4 6" : "M 2 6 C 20 6 20 32 4 32"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#chart-arrowhead)"
        />
      </svg>
      <span className="ml-0.5 text-[10px] font-black text-purple-600 dark:text-purple-300 bg-white/95 dark:bg-purple-950/95 px-1 py-0.5 rounded shadow-sm border border-purple-200/80 dark:border-purple-800/80">
        {label}
      </span>
    </div>
  );
};

export const NumberPathCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  compact = false,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeNumberPathConfig({
    view: question.config.numberChartView,
    task: question.config.numberChartTask,
    difficulty: question.config.numberChartDifficulty,
    start: question.config.numberChartStart,
    target: question.config.numberChartEnd ?? question.targetCount,
  }), [
    question.config.numberChartView,
    question.config.numberChartTask,
    question.config.numberChartDifficulty,
    question.config.numberChartStart,
    question.config.numberChartEnd,
    question.targetCount,
  ]);

  const required = useMemo(() => requiredNumbers(config), [config]);
  const path = useMemo(() => arrangedPathNumbers(config), [config]);
  const pathColumns = useMemo(() => pathColumnCount(path.length), [path.length]);
  const maze = useMemo(() => mazeNumbers(config), [config]);

  const [selected, setSelected] = useState<number[]>([]);
  const [stagedNumber, setStagedNumber] = useState<number | null>(null);
  const [errorNumber, setErrorNumber] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);

  useEffect(() => {
    setSelected([]);
    setStagedNumber(null);
    setErrorNumber(null);
    setSolved(false);
    setFlashEffect(false);
  }, [question.id, config.view, config.task, config.difficulty, config.start, config.target]);

  const nextExpected = required[selected.length];
  const instruction = question.instruction || numberPathInstruction(config);
  const taskLabel = config.task === "count_forward"
    ? `${config.start} → ${config.target}`
    : config.task === "find_number"
      ? `Find ${config.target}`
      : config.task === "ten_more"
        ? `${config.start} + 10`
        : `${config.start} − 10`;

  const reset = () => {
    setSelected([]);
    setStagedNumber(null);
    setErrorNumber(null);
    setSolved(false);
    setFlashEffect(false);
  };

  /** In chart mode: stage the tapped number (don't score yet). Other views: score immediately. */
  const chooseNumber = (number: number) => {
    if (!isPlayMode || solved || (number === config.start && config.task === "count_forward")) return;
    if (config.view === "chart" && (config.task === "ten_more" || config.task === "ten_less")) {
      // Stage only — user must confirm
      setErrorNumber(null);
      setStagedNumber(number);
      return;
    }
    // All other tasks/views: score immediately (existing behaviour)
    if (number !== nextExpected) {
      sounds.playFail();
      setErrorNumber(number);
      onAttempt?.("incorrect", { expected: nextExpected, selected: number, details: { task: config.task, view: config.view, difficulty: config.difficulty } });
      return;
    }
    sounds.playTick();
    setErrorNumber(null);
    const nextSelected = [...selected, number];
    setSelected(nextSelected);
    if (nextSelected.length === required.length) {
      setSolved(true);
      sounds.playWin();
      onAttempt?.("correct", { expected: config.target, selected: number, details: { task: config.task, view: config.view, difficulty: config.difficulty } });
      onSuccess?.();
    }
  };

  /** Called when learner presses "Confirm Answer" in the chart ten_more/ten_less flow. */
  const confirmAnswer = () => {
    if (!isPlayMode || solved || stagedNumber === null) return;
    if (stagedNumber !== nextExpected) {
      sounds.playFail();
      setErrorNumber(stagedNumber);
      onAttempt?.("incorrect", {
        expected: nextExpected,
        selected: stagedNumber,
        details: { task: config.task, view: config.view, difficulty: config.difficulty },
      });
      return;
    }
    sounds.playTick();
    setErrorNumber(null);
    const nextSelected = [...selected, stagedNumber];
    setSelected(nextSelected);
    setStagedNumber(null);
    if (nextSelected.length === required.length) {
      setSolved(true);
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 1400);
      sounds.playWin();
      onAttempt?.("correct", {
        expected: config.target,
        selected: stagedNumber,
        details: { task: config.task, view: config.view, difficulty: config.difficulty },
      });
      onSuccess?.();
    }
  };

  // ─── derived display flags ───────────────────────────────────────────────────
  const isTenTask = config.task === "ten_more" || config.task === "ten_less";
  // In the 120 chart ten-task, "revealed" = answer confirmed correct
  const isRevealed = solved || (isTenTask ? selected.includes(config.target) : selected.includes(config.target));
  // Show target details (ANSWER badge, arrow, equation result, place-value) only after reveal, or in designer
  const showTargetDetails = isRevealed || (!isPlayMode && config.difficulty !== "challenge");
  // Show explanation card (right panel) only after first confirm attempt or in designer
  const showExplanationCard = solved || errorNumber !== null || (!isPlayMode && config.difficulty !== "challenge");
  const targetCol = (config.start - 1) % 10;

  // ─── cell styling ────────────────────────────────────────────────────────────
  const numberClass = (number: number) => {
    const isAnchor = number === config.start && config.task !== "find_number";
    const isSelected = selected.includes(number);
    const isStaged = stagedNumber === number && !solved;
    const isTargetAnswer = isRevealed && number === config.target;
    const isError = errorNumber === number;
    const showTarget = !isPlayMode && number === config.target;
    const col = (number - 1) % 10;
    const isColumnHighlight = config.view === "chart" && col === targetCol;
    const guidedHint = isPlayMode && config.difficulty === "guided" && !solved && (
      config.task === "count_forward"
        ? number === nextExpected
        : config.view === "chart" && config.task === "find_number"
          ? Math.ceil(number / 10) === Math.ceil(config.target / 10)
          : config.view === "chart" && isTenTask
            ? (number - 1) % 10 === (config.start - 1) % 10
            : false
    );

    if (isTargetAnswer || (isSelected && number === config.target)) {
      return isDark
        ? "bg-teal-500 text-white font-extrabold shadow-[0_4px_14px_rgba(20,184,166,0.3)] z-10"
        : "bg-[#00BBA7] text-white font-extrabold shadow-[0_4px_14px_rgba(0,187,167,0.3)] z-10";
    }
    if (isError) return "bg-rose-500 text-white animate-shake z-10";
    if (isStaged) return "bg-indigo-600 text-white font-extrabold ring-4 ring-indigo-400/70 shadow-lg shadow-indigo-500/40 scale-105 z-20";
    if (isAnchor) {
      return isDark
        ? "bg-purple-500 text-white font-extrabold shadow-[0_4px_14px_rgba(168,85,247,0.3)] z-10"
        : "bg-[#6844EA] text-white font-extrabold shadow-[0_4px_14px_rgba(104,68,234,0.3)] z-10";
    }
    if (showTarget) return isDark ? "bg-fuchsia-400/20 text-fuchsia-200 ring-2 ring-fuchsia-400" : "bg-fuchsia-50 text-fuchsia-700 ring-2 ring-fuchsia-500";
    if (guidedHint) return isDark ? "bg-indigo-400/25 text-indigo-100 ring-2 ring-indigo-300 animate-pulse" : "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400 animate-pulse";
    if (isColumnHighlight) {
      return isDark
        ? "bg-purple-900/30 text-purple-200 border border-purple-800/40 font-bold hover:bg-purple-800/40"
        : "bg-purple-50/90 text-purple-900 border border-purple-100/80 font-bold hover:bg-purple-100";
    }
    return isDark
      ? "bg-white/[0.09] text-slate-100 hover:bg-indigo-400/25 focus-visible:ring-indigo-300"
      : "bg-white text-slate-700 shadow-sm hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500";
  };

  // ─── cell renderer ───────────────────────────────────────────────────────────
  const renderNumber = (number: number, chart = false) => {
    const isStart = chart && number === config.start && config.task !== "find_number";
    const isTarget = chart && number === config.target;
    return (
      <div key={number} className="relative flex items-center justify-center">
        {isStart && (
          <span className="absolute -top-2.5 z-20 rounded bg-[#6844EA] px-1 py-[1px] text-[7px] font-black tracking-widest text-white uppercase shadow-sm">
            START
          </span>
        )}
        <button
          type="button"
          onClick={() => chooseNumber(number)}
          disabled={!isPlayMode || solved || (number === config.start && config.task === "count_forward")}
          aria-label={`Number ${number}${number === config.start && config.task !== "find_number" ? ", starting number" : ""}`}
          aria-pressed={selected.includes(number) || stagedNumber === number}
          className={`relative flex w-full items-center justify-center rounded-xl font-extrabold tabular-nums outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default ${
            chart
              ? "h-8 text-[11px] sm:h-10 sm:text-sm md:h-11 md:text-base"
              : "h-12 min-w-12 px-2 text-base sm:h-14 sm:min-w-14 sm:text-lg"
          } ${numberClass(number)}`}
        >
          {number}
          {selected.includes(number) && <Check size={chart ? 10 : 12} className="absolute right-1 top-1" />}
        </button>
        {isTarget && showTargetDetails && (
          <span className="absolute -bottom-2.5 z-20 rounded bg-[#00BBA7] px-1 py-[1px] text-[7px] font-black tracking-widest text-white uppercase shadow-sm">
            ANSWER
          </span>
        )}
        {chart && isStart && showTargetDetails && isTenTask && (
          <ConnectionArrow task={config.task} />
        )}
      </div>
    );
  };

  const viewLabel = config.view === "chart" ? "120 chart" : config.view === "circle" ? "number circle" : config.view === "stepping_stones" ? "stepping stones" : config.view === "maze" ? "number maze" : "number path";
  const viewIcon = config.view === "chart" ? <Grid3X3 size={17} /> : config.view === "circle" ? <Circle size={17} /> : config.view === "stepping_stones" ? <Footprints size={17} /> : config.view === "maze" ? <Waypoints size={17} /> : <Route size={17} />;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      showGrid={showGrid}
      isDark={isDark}
      compact={compact}
      accent="indigo"
      headerIcon={viewIcon}
      headerTitle="Number Path & 120 Chart"
      headerSubtitle={taskLabel}
      readAloudText={instruction}
      headerActions={(
        <>
          <CanvasChip accent="indigo" isDark={isDark}>{viewLabel}</CanvasChip>
          <CanvasChip accent={config.difficulty === "challenge" ? "rose" : "indigo"} isDark={isDark}>{config.difficulty}</CanvasChip>
          <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8" aria-label="Reset activity"><RotateCcw size={14} /></Button>
        </>
      )}
      designerHint="Use the Studio controls to choose a number task and range."
      playHint={instruction}
      footerStatus={
        solved
          ? `Great work — ${config.target} is correct!`
          : errorNumber !== null
          ? `Incorrect — try again! Look for ${nextExpected}.`
          : stagedNumber !== null
          ? `Selected ${stagedNumber}. Tap Confirm Answer.`
          : undefined
      }
      footerSolved={solved}
    >
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-transparent p-2.5 sm:p-4">
        {config.view === "chart" ? (
          /* ── 120 Chart layout ───────────────────────────────────────────── */
          <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center gap-6 overflow-y-auto p-2 lg:flex-row lg:items-start lg:gap-8">

            {/* Left: Grid + Confirm button */}
            <div className="flex flex-1 flex-col items-center gap-4 w-full">
              <div
                className="relative grid w-full grid-cols-10 gap-1.5 sm:gap-2"
                aria-label="Numbers 1 through 120"
              >
                {allChartNumbers.map(number => renderNumber(number, true))}
              </div>

              {/* Confirm Answer button — shown during ten_more / ten_less play */}
              {isPlayMode && !solved && isTenTask && (
                <button
                  type="button"
                  onClick={confirmAnswer}
                  disabled={stagedNumber === null}
                  className={`flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold shadow-lg transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                    stagedNumber !== null
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-teal-500/30 hover:scale-[1.02] cursor-pointer"
                      : isDark
                      ? "bg-white/10 text-slate-400"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  <Check size={18} strokeWidth={2.5} />
                  <span>
                    {stagedNumber !== null ? `Confirm Answer (${stagedNumber})` : "Select a Number"}
                  </span>
                </button>
              )}
            </div>

            {/* Right: Explanation Card — hidden until user confirms or makes a wrong attempt */}
            {showExplanationCard && (
              <div
                className={`flex w-full max-w-xs shrink-0 flex-col items-center gap-4 rounded-3xl border p-5 text-center transition-all sm:max-w-sm sm:p-6 ${
                  flashEffect
                    ? "scale-[1.02] border-emerald-300 bg-emerald-50 ring-4 ring-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.5)] dark:border-emerald-700 dark:bg-emerald-950/60"
                    : errorNumber !== null
                    ? "animate-shake border-rose-300 bg-rose-50/90 shadow-lg shadow-rose-500/10 dark:border-rose-800/60 dark:bg-rose-950/50"
                    : isDark
                    ? "border-white/10 bg-[#1B1737] text-slate-100 shadow-2xl shadow-indigo-950/50"
                    : "border-purple-100 bg-white/95 text-slate-800 shadow-xl shadow-purple-500/5"
                }`}
              >
                {/* Equation */}
                <div className="flex items-center justify-center gap-2 text-2xl font-black tracking-tight sm:text-3xl">
                  <span className={isDark ? "text-purple-300" : "text-[#6844EA]"}>{config.start}</span>
                  <span className={isDark ? "text-indigo-300" : "text-indigo-600"}>
                    {config.task === "ten_less" ? "− 10" : "+ 10"}
                  </span>
                  <span className={isDark ? "text-slate-500" : "text-slate-400"}>=</span>
                  {showTargetDetails ? (
                    <span className={`font-black transition-all duration-300 ${isDark ? "text-teal-300" : "text-[#00BBA7]"}`}>
                      {config.target}
                    </span>
                  ) : (
                    <span className={`inline-flex h-9 w-10 items-center justify-center rounded-xl border-2 border-dashed text-xl font-extrabold ${
                      isDark ? "border-purple-700 bg-purple-950/50 text-purple-300" : "border-purple-300 bg-purple-50/50 text-purple-400"
                    }`}>
                      ?
                    </span>
                  )}
                </div>

                {/* Divider */}
                <div className={`w-full border-b-2 border-dashed ${isDark ? "border-purple-800/60" : "border-purple-200/70"}`} />

                {/* Rule sentence */}
                <p className={`text-sm font-extrabold sm:text-base ${isDark ? "text-purple-200" : "text-slate-800"}`}>
                  {errorNumber !== null
                    ? `Try again! ${config.task === "ten_less" ? "Subtracting 10 moves up one row." : "Adding 10 moves down one row."}`
                    : config.task === "ten_less"
                    ? "Subtracting 10 moves up one row."
                    : config.task === "ten_more"
                    ? "Adding 10 moves down one row."
                    : instruction}
                </p>

                {/* Place-value breakdown */}
                {isTenTask && (
                  <div className="mt-1 flex w-full items-center justify-center gap-3">
                    {/* Start box */}
                    <div className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border p-3 ${
                      isDark ? "border-purple-800/50 bg-purple-950/40" : "border-purple-200/80 bg-purple-50/60"
                    }`}>
                      <div className={`text-xs font-bold sm:text-sm ${isDark ? "text-purple-200" : "text-slate-600"}`}>
                        <span className={`text-lg font-black sm:text-xl ${isDark ? "text-purple-300" : "text-[#6844EA]"}`}>
                          {Math.floor(config.start / 10)}
                        </span>{" "}tens
                      </div>
                      <div className={`w-full border-b ${isDark ? "border-purple-800/50" : "border-purple-200/60"}`} />
                      <div className={`text-xs font-bold sm:text-sm ${isDark ? "text-purple-200" : "text-slate-600"}`}>
                        <span className={`text-lg font-black sm:text-xl ${isDark ? "text-purple-300" : "text-[#6844EA]"}`}>
                          {config.start % 10}
                        </span>{" "}ones
                      </div>
                    </div>

                    <div className={`text-xl font-black sm:text-2xl ${isDark ? "text-purple-400" : "text-purple-500"}`}>→</div>

                    {/* Target box */}
                    <div className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border p-3 ${
                      isDark ? "border-teal-800/50 bg-teal-950/40" : "border-teal-200/80 bg-teal-50/60"
                    }`}>
                      {showTargetDetails ? (
                        <>
                          <div className={`text-xs font-bold sm:text-sm ${isDark ? "text-teal-200" : "text-slate-600"}`}>
                            <span className={`text-lg font-black sm:text-xl ${isDark ? "text-teal-300" : "text-[#00BBA7]"}`}>
                              {Math.floor(config.target / 10)}
                            </span>{" "}tens
                          </div>
                          <div className={`w-full border-b ${isDark ? "border-teal-800/50" : "border-teal-200/60"}`} />
                          <div className={`text-xs font-bold sm:text-sm ${isDark ? "text-teal-200" : "text-slate-600"}`}>
                            <span className={`text-lg font-black sm:text-xl ${isDark ? "text-teal-300" : "text-[#00BBA7]"}`}>
                              {config.target % 10}
                            </span>{" "}ones
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`text-xs font-bold sm:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            <span className={`text-lg font-black sm:text-xl ${isDark ? "text-purple-400" : "text-purple-300"}`}>?</span>{" "}tens
                          </div>
                          <div className={`w-full border-b ${isDark ? "border-purple-800/50" : "border-purple-200/60"}`} />
                          <div className={`text-xs font-bold sm:text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            <span className={`text-lg font-black sm:text-xl ${isDark ? "text-purple-400" : "text-purple-300"}`}>?</span>{" "}ones
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : config.view === "maze" ? (
          <div className="relative aspect-square w-full max-w-[430px]" aria-label="Connected number maze">
            <svg aria-hidden="true" viewBox="0 0 100 100" className={`absolute inset-0 h-full w-full ${isDark ? "text-indigo-300/20" : "text-indigo-200"}`}>
              {Array.from({ length: 5 }, (_, index) => 10 + index * 20).map(position => (
                <React.Fragment key={position}>
                  <line x1="10" y1={position} x2="90" y2={position} stroke="currentColor" strokeWidth="1" />
                  <line x1={position} y1="10" x2={position} y2="90" stroke="currentColor" strokeWidth="1" />
                </React.Fragment>
              ))}
              {Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => (
                <React.Fragment key={`${row}-${column}`}>
                  <line x1={10 + column * 20} y1={10 + row * 20} x2={30 + column * 20} y2={30 + row * 20} stroke="currentColor" strokeWidth="0.8" />
                  <line x1={30 + column * 20} y1={10 + row * 20} x2={10 + column * 20} y2={30 + row * 20} stroke="currentColor" strokeWidth="0.8" />
                </React.Fragment>
              )))}
            </svg>
            <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 place-items-center gap-1 p-[2%]">
              {maze.map((number, index) => <React.Fragment key={`${index}-${number}`}>{renderNumber(number)}</React.Fragment>)}
            </div>
          </div>
        ) : config.view === "circle" ? (
          <div className="relative h-[280px] w-full max-w-[380px] sm:h-[320px] sm:max-w-[430px]" aria-label="Number circle">
            <div aria-hidden="true" className={`absolute inset-[10%] rounded-full border-[10px] border-dotted ${isDark ? "border-indigo-300/15" : "border-indigo-100"}`} />
            {path.map((number, index) => {
              const positions = path.length === 11 ? circlePositions11 : circlePositions10;
              return (
                <div key={number} className={`absolute -translate-x-1/2 -translate-y-1/2 ${positions[index] || circlePositions11[index % circlePositions11.length]}`}>
                  {renderNumber(number)}
                </div>
              );
            })}
          </div>
        ) : config.view === "stepping_stones" ? (
          <div className="grid w-full max-w-xl grid-cols-5 gap-x-3 gap-y-7 px-2 py-5 sm:gap-x-5" aria-label="Number stepping stones">
            {path.map(number => (
              <div key={number} className="flex justify-center even:translate-y-4">
                {renderNumber(number)}
              </div>
            ))}
          </div>
        ) : (
          /* Number path (linear) */
          <div className="w-full px-1 py-4">
            <div
              className="mx-auto grid w-fit max-w-full justify-center gap-y-2 sm:gap-y-3"
              style={{ gridTemplateColumns: `repeat(${pathColumns}, auto)` }}
            >
              {path.map((number, index) => {
                const endOfRow = (index + 1) % pathColumns === 0;
                const isLast = index === path.length - 1;
                return (
                  <div key={number} className="flex items-center">
                    {renderNumber(number)}
                    {!endOfRow && !isLast && (
                      <span
                        aria-hidden="true"
                        className={`h-1 w-2 rounded-full sm:w-4 ${isDark ? "bg-white/15" : "bg-indigo-100"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </SharedCanvasLayout>
  );
};
