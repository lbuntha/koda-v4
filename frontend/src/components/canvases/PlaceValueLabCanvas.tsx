import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Boxes, Check, RefreshCw, RotateCcw } from "lucide-react";
import { sounds } from "../../sound";
import { Button } from "../ui";
import { Base10Scale, OneUnit, TenRod } from "./Base10Blocks";
import { CanvasChip, captionClass, surfaceClass } from "./canvasTheme";
import {
  initialPlaceValueState,
  normalizePlaceValueConfig,
  placeValueChoices,
  placeValueInstruction,
  representedNumber,
  targetPlaces,
} from "./placeValueModel";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasProps } from "./types";

const TASK_LABELS = {
  build_number: "Build",
  read_number: "Read",
  regroup_ones: "Regroup",
} as const;

export const PlaceValueLabCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  compact = false,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizePlaceValueConfig({
    task: question.config.placeValueTask,
    difficulty: question.config.placeValueDifficulty,
    target: question.config.placeValueTarget ?? question.targetCount,
    showExpanded: question.config.placeValueShowExpanded,
  }), [
    question.config.placeValueTask,
    question.config.placeValueDifficulty,
    question.config.placeValueTarget,
    question.config.placeValueShowExpanded,
    question.targetCount,
  ]);
  const target = targetPlaces(config.target);
  const startingState = () => isPlayMode ? initialPlaceValueState(config) : target;
  const [blocks, setBlocks] = useState(startingState);
  const [selected, setSelected] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const solvedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const requestedAssetType = question.config.assetType || question.objectId || "star";
  const assetType = requestedAssetType === "custom_svg" && !question.config.customSvgMarkup ? "star" : requestedAssetType;
  const instruction = question.instruction || placeValueInstruction(config);
  const choices = placeValueChoices(config.target);
  const currentNumber = representedNumber(blocks);

  useEffect(() => {
    const next = isPlayMode ? initialPlaceValueState(config) : targetPlaces(config.target);
    setBlocks(next);
    setSelected(null);
    setSolved(false);
    solvedRef.current = false;
  }, [question.id, config.task, config.target, isPlayMode]);

  const finish = (detail: Record<string, unknown>) => {
    if (solvedRef.current) return;
    solvedRef.current = true;
    setSolved(true);
    sounds.playWin();
    onAttempt?.("correct", { expected: config.target, selected: config.target, details: { task: config.task, ...detail } });
    onSuccess?.();
  };

  const updateBlocks = (next: { tens: number; ones: number }) => {
    setBlocks(next);
    sounds.playTick();
    if (config.task === "build_number" && next.tens === target.tens && next.ones === target.ones) {
      finish({ tens: next.tens, ones: next.ones });
    }
  };

  const addTen = () => {
    if (!isPlayMode || solved || blocks.tens >= 9) return;
    updateBlocks({ ...blocks, tens: blocks.tens + 1 });
  };
  const addOne = () => {
    if (!isPlayMode || solved || blocks.ones >= 19) return;
    updateBlocks({ ...blocks, ones: blocks.ones + 1 });
  };
  const removeTen = () => {
    if (!isPlayMode || solved || config.task !== "build_number" || blocks.tens <= 0) return;
    sounds.playSlide();
    setBlocks({ ...blocks, tens: blocks.tens - 1 });
  };
  const removeOne = () => {
    if (!isPlayMode || solved || config.task !== "build_number" || blocks.ones <= 0) return;
    sounds.playSlide();
    setBlocks({ ...blocks, ones: blocks.ones - 1 });
  };

  const regroup = () => {
    if (!isPlayMode || solved || blocks.ones < 10) return;
    const next = { tens: blocks.tens + 1, ones: blocks.ones - 10 };
    setBlocks(next);
    sounds.playPop();
    if (next.tens === target.tens && next.ones === target.ones) finish({ regrouped: true, tens: next.tens, ones: next.ones });
  };

  const choose = (value: number) => {
    if (!isPlayMode || solved || config.task !== "read_number") return;
    setSelected(value);
    if (value === config.target) {
      finish({ readNumber: value });
    } else {
      sounds.playFail();
      onAttempt?.("incorrect", { expected: config.target, selected: value, details: { task: config.task, tens: blocks.tens, ones: blocks.ones } });
    }
  };

  const reset = () => {
    setBlocks(startingState());
    setSelected(null);
    setSolved(false);
    solvedRef.current = false;
  };

  const zoneClass = `relative flex min-h-[180px] min-w-0 flex-1 flex-col rounded-3xl p-3 transition-colors sm:p-4 ${surfaceClass(isDark)}`;
  const labelClass = `text-[9px] font-bold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-600"}`;
  const showCounts = config.difficulty === "guided" || solved || !isPlayMode;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      showGrid={showGrid}
      isDark={isDark}
      compact={compact}
      accent="indigo"
      headerIcon={<Boxes size={17} />}
      headerTitle="Place Value Lab"
      headerSubtitle={config.task === "read_number" ? "What number do the blocks show?" : `${TASK_LABELS[config.task]} ${config.target}`}
      readAloudText={instruction}
      headerActions={(
        <>
          <CanvasChip accent={solved ? "emerald" : "indigo"} isDark={isDark}>{solved ? "Complete" : `${TASK_LABELS[config.task]} · ${config.difficulty}`}</CanvasChip>
          <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Reset place value lab"><RotateCcw size={14} /></Button>
        </>
      )}
      playHint={instruction}
      designerHint="Choose a two-digit target, activity, guidance level, and base-ten block artwork in Studio."
      footerStatus={solved ? `${target.tens} tens and ${target.ones} ones make ${config.target}!` : selected !== null ? "Try again. Count the tens first, then the ones." : undefined}
      footerSolved={solved}
    >
      <div className="relative my-2 flex min-h-[280px] w-full flex-1 flex-col items-stretch gap-3 bg-transparent sm:flex-row sm:gap-4">
        {config.task === "build_number" && (
          <div className={`flex w-full flex-row items-stretch gap-2 rounded-3xl p-3 sm:w-[30%] sm:flex-col ${surfaceClass(isDark)}`}>
            <span className={labelClass}>Block bank</span>
            <button
              type="button"
              disabled={!isPlayMode || solved}
              onClick={addTen}
              className={`flex min-h-20 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default disabled:opacity-60 ${surfaceClass(isDark, "raised")}`}
            >
              <Base10Scale size={compact ? 16 : 18}><TenRod type={assetType} orientation="horizontal" noEnter highContrast /></Base10Scale>
              <span className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Add 1 ten</span>
            </button>
            <button
              type="button"
              disabled={!isPlayMode || solved}
              onClick={addOne}
              className={`flex min-h-20 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default disabled:opacity-60 ${surfaceClass(isDark, "raised")}`}
            >
              <Base10Scale size={compact ? 22 : 28}><OneUnit type={assetType} noEnter highContrast /></Base10Scale>
              <span className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Add 1 one</span>
            </button>
          </div>
        )}

        <div className={`flex min-w-0 flex-1 flex-col gap-3 ${config.task === "build_number" ? "sm:w-[70%]" : "w-full"}`}>
          <div className="flex min-h-0 flex-1 flex-row items-stretch gap-3">
            <div className={zoneClass}>
              <div className="flex items-center justify-between">
                <span className={labelClass}>Tens</span>
                {showCounts && <span className={`text-sm font-semibold tabular-nums ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>{blocks.tens}</span>}
              </div>
              <Base10Scale size={compact ? 14 : 17}>
                <div className="m-auto flex max-w-full flex-wrap items-end justify-center gap-1.5 py-2">
                  <AnimatePresence mode="popLayout">
                    {Array.from({ length: blocks.tens }, (_, index) => (
                      <motion.button
                        layout
                        key={`ten-${index}`}
                        type="button"
                        onClick={removeTen}
                        disabled={!isPlayMode || solved || config.task !== "build_number"}
                        initial={reduceMotion ? false : { scale: 0.55, x: -14, opacity: 0 }}
                        animate={{ scale: 1, x: 0, opacity: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                        className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default"
                        aria-label="One ten. Tap to return it to the block bank."
                      >
                        <TenRod type={assetType} orientation="vertical" noEnter highContrast />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </Base10Scale>
            </div>

            <div className={zoneClass}>
              <div className="flex items-center justify-between">
                <span className={labelClass}>Ones</span>
                {showCounts && <span className={`text-sm font-semibold tabular-nums ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>{blocks.ones}</span>}
              </div>
              <Base10Scale size={compact ? 22 : 28}>
                <div className="m-auto grid max-w-[300px] grid-cols-5 place-items-center gap-2 py-2 sm:grid-cols-5">
                  <AnimatePresence mode="popLayout">
                    {Array.from({ length: blocks.ones }, (_, index) => (
                      <motion.div layout key={`one-${index}`} exit={reduceMotion ? { opacity: 0 } : { scale: 0.2, y: -12, opacity: 0 }}>
                        <OneUnit
                          type={assetType}
                          isInteractive={isPlayMode && !solved && config.task === "build_number"}
                          onClick={removeOne}
                          label={showCounts ? String(index + 1) : undefined}
                          highContrast
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </Base10Scale>
            </div>
          </div>

          {config.showExpanded && (
            <motion.div layout className={`mx-auto flex w-fit items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${surfaceClass(isDark)}`}>
              <span>{blocks.tens} tens</span><span className={captionClass(isDark)}>+</span><span>{blocks.ones} ones</span>
              <ArrowRight size={14} className={captionClass(isDark)} />
              <motion.span
                key={currentNumber}
                initial={reduceMotion ? false : { scale: 0.65, opacity: 0 }}
                animate={reduceMotion ? { opacity: 1 } : { scale: [1, 1.18, 1], opacity: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 18, duration: 0.42 }}
                className={`min-w-12 text-center text-2xl font-semibold leading-none tabular-nums sm:text-3xl ${solved ? "text-emerald-500" : isDark ? "text-indigo-300" : "text-indigo-700"}`}
              >
                {currentNumber}
              </motion.span>
            </motion.div>
          )}

          {config.task === "regroup_ones" && (
            <Button onClick={regroup} disabled={!isPlayMode || solved || blocks.ones < 10} className="mx-auto" size="sm">
              <RefreshCw size={14} /> Trade 10 ones for 1 ten
            </Button>
          )}

          {config.task === "read_number" && (
            <div className="flex flex-wrap justify-center gap-2" aria-label="Number choices">
              {choices.map(value => {
                const wrong = selected === value && value !== config.target;
                const correct = solved && value === config.target;
                return (
                  <Button
                    key={value}
                    variant="outline"
                    onClick={() => choose(value)}
                    disabled={!isPlayMode || solved}
                    className={`min-w-14 text-base tabular-nums dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100 ${wrong ? "border-rose-400 bg-rose-50 text-rose-700 animate-shake dark:bg-rose-400/15 dark:text-rose-200" : ""} ${correct ? "border-emerald-500 bg-emerald-500 text-white dark:bg-emerald-500 dark:text-white" : ""}`}
                  >
                    {correct && <Check size={14} />}{value}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
