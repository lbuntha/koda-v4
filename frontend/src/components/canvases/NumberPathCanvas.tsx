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
  const [errorNumber, setErrorNumber] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    setSelected([]);
    setErrorNumber(null);
    setSolved(false);
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
    setErrorNumber(null);
    setSolved(false);
  };

  const chooseNumber = (number: number) => {
    if (!isPlayMode || solved || number === config.start && config.task === "count_forward") return;
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

  const numberClass = (number: number) => {
    const isAnchor = number === config.start && config.task !== "find_number";
    const isSelected = selected.includes(number);
    const isError = errorNumber === number;
    const showTarget = !isPlayMode && number === config.target;
    const guidedHint = isPlayMode && config.difficulty === "guided" && !solved && (
      config.task === "count_forward"
        ? number === nextExpected
        : config.view === "chart" && config.task === "find_number"
          ? Math.ceil(number / 10) === Math.ceil(config.target / 10)
          : config.view === "chart" && (config.task === "ten_more" || config.task === "ten_less")
            ? (number - 1) % 10 === (config.start - 1) % 10
            : false
    );

    if (isSelected || solved && number === config.target) {
      return isDark
        ? "bg-emerald-400 text-emerald-950 shadow-[0_4px_14px_rgba(52,211,153,0.25)]"
        : "bg-emerald-500 text-white shadow-[0_4px_14px_rgba(16,185,129,0.22)]";
    }
    if (isError) return "bg-rose-500 text-white animate-shake";
    if (isAnchor) return isDark ? "bg-violet-400 text-violet-950" : "bg-violet-600 text-white";
    // Fuchsia, not amber: this ring has to stand out from the indigo board without the glare
    // of yellow, and rose is reserved for the error state two lines up.
    if (showTarget) return isDark ? "bg-fuchsia-400/20 text-fuchsia-200 ring-2 ring-fuchsia-400" : "bg-fuchsia-50 text-fuchsia-700 ring-2 ring-fuchsia-500";
    if (guidedHint) return isDark ? "bg-indigo-400/25 text-indigo-100 ring-2 ring-indigo-300 animate-pulse" : "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400 animate-pulse";
    return isDark
      ? "bg-white/[0.09] text-slate-100 hover:bg-indigo-400/25 focus-visible:ring-indigo-300"
      : "bg-white text-slate-700 shadow-sm hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500";
  };

  const renderNumber = (number: number, chart = false) => (
    <button
      key={number}
      type="button"
      onClick={() => chooseNumber(number)}
      disabled={!isPlayMode || solved || number === config.start && config.task === "count_forward"}
      aria-label={`Number ${number}${number === config.start && config.task !== "find_number" ? ", starting number" : ""}`}
      aria-pressed={selected.includes(number)}
      className={`relative flex items-center justify-center rounded-xl font-semibold tabular-nums outline-none transition-all focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default ${
        chart ? "h-7 text-[10px] sm:h-8 sm:text-xs" : "h-12 min-w-12 px-2 text-base sm:h-14 sm:min-w-14 sm:text-lg"
      } ${numberClass(number)}`}
    >
      {number}
      {selected.includes(number) && <Check size={chart ? 9 : 12} className="absolute right-1 top-1" />}
    </button>
  );

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
      footerStatus={solved ? `Great work — ${config.target} is correct!` : errorNumber !== null ? `Try again. Look for ${nextExpected}.` : undefined}
      footerSolved={solved}
    >
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-transparent p-2.5 sm:p-4">
        {config.view === "chart" ? (
          <div className="grid w-full max-w-3xl grid-cols-10 gap-1 sm:gap-1.5" aria-label="Numbers 1 through 120">
            {allChartNumbers.map(number => renderNumber(number, true))}
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
              ))) }
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
          /* Wrapped into rows, never scrolled sideways. A path of ten tiles overflowed its
             card, which put the number the child is counting *towards* off-screen — so the
             one thing they need to see to know when they are finished was the thing hidden.
             Asking a six-year-old to scroll to find it is not a fix.

             The column count is fixed rather than left to `flex-wrap` so the wrap points are
             known: a connector is then drawn only between tiles that really are side by side,
             instead of dangling off the end of a row. */
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
