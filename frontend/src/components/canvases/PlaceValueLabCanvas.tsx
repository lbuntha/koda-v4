import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Boxes, Check, RefreshCw, RotateCcw } from "lucide-react";
import { sounds } from "../../sound";
import { hasAssetRef } from "../../assets/assetRef";
import { Button } from "../ui";
import {
  Base10Scale,
  OneUnit,
  TenRod,
  UNIT_MAX,
  UNIT_MIN,
  fitRodGrid,
} from "./Base10Blocks";
import { CanvasChip, CanvasAccent, captionClass, surfaceClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { bestGrid } from "./objectLayout";
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
  // "custom_svg" with nothing to draw would render empty blocks, so fall back to a shape.
  const assetType = requestedAssetType === "custom_svg" && !hasAssetRef(question.config) ? "star" : requestedAssetType;
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

  const showCounts = config.difficulty === "guided" || solved || !isPlayMode;
  const { showGhostGuide, reportActivity } = useGhostGuide({ isPlayMode, isSolved: solved, idleThresholdMs: 10000 });

  /**
   * Every block on this mat is sized from the room its own zone has.
   *
   * `Base10Blocks` ships the fitters for exactly this, and this canvas ignored
   * them: it hardcoded five different unit sizes (14, 16, 17, 18, 22, 28) that
   * matched no particular box. The bank's ten-rod at unit 18 is ~200px wide and
   * its card is not, so the rod hung out over both edges of the bank; the tens
   * zone drew *vertical* rods, which are ten cells tall, into a 180px box.
   */
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const seed = node.getBoundingClientRect();
    setStage({ width: seed.width || 720, height: seed.height || 320 });
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setStage({ width: entry.contentRect.width || 720, height: entry.contentRect.height || 320 });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const width = stage?.width ?? 720;
    const height = stage?.height ?? 320;
    const isCompact = width < 640;
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;
    const chrome = captionH + pad * 2;
    const hasBank = config.task === "build_number";

    /* On a narrow stage the bank sits above the two places as a row; on a wide
       one it is a column beside them. */
    const bankShare = hasBank ? (isCompact ? 0 : 0.28) : 0;
    const bankWidth = isCompact ? width : Math.round(width * bankShare);
    const bankHeight = isCompact && hasBank ? Math.round(Math.min(height * 0.3, chrome + UNIT_MAX * 1.6)) : height;
    const placesWidth = isCompact ? width : width - bankWidth - (hasBank ? gap : 0);
    const placesHeight = isCompact && hasBank ? height - bankHeight - gap : height;

    const zoneWidth = Math.max(120, (placesWidth - gap) / 2);
    const zoneInnerW = Math.max(60, zoneWidth - pad * 2);
    const zoneInnerH = Math.max(60, placesHeight - chrome);

    // Tens: whichever orientation and grid make the rods biggest here. On a
    // phone the place column is narrow and tall, so they stand up.
    const rods = fitRodGrid({
      width: zoneInnerW,
      height: zoneInnerH,
      count: Math.max(1, blocks.tens),
      gap: 6
    });

    // Ones: the unit is the module, so it is fitted like any other object.
    const onesGrid = bestGrid(Math.max(1, blocks.ones), zoneInnerW, zoneInnerH);
    // Floored below `UNIT_MIN` for the same reason rods are: nineteen ones that
    // fit and are small beat nineteen that overflow the zone.
    const onesUnit = Math.max(12, Math.min(UNIT_MAX, Math.floor(onesGrid.cell * 0.82)));

    // Bank: one rod across the widest the bank button can offer.
    const bankInnerW = Math.max(80, (isCompact ? width / 2 : bankWidth) - pad * 2 - 16);
    /* Fitted, not floored to `UNIT_MIN`: a bank card narrower than a rod is
       exactly the case that used to push the rod out over both its edges. The
       bank's rod rotates on the same rule as the ones on the mat. */
    const bankInnerH = Math.max(60, bankHeight - chrome - 24);
    const bankRod = fitRodGrid({ width: bankInnerW, height: bankInnerH, count: 1 });

    return {
      isCompact,
      gap,
      hasBank,
      bankWidth,
      bankHeight,
      rodUnit: rods.unit,
      rodColumns: rods.columns,
      rodOrientation: rods.orientation,
      onesUnit,
      onesColumns: Math.max(1, onesGrid.columns),
      bankRod
    };
  }, [stage?.width, stage?.height, config.task, blocks.tens, blocks.ones]);

  const accent: CanvasAccent = (["indigo", "violet", "emerald", "purple", "rose"] as CanvasAccent[])
    .includes(question.config.frameColor as CanvasAccent)
    ? (question.config.frameColor as CanvasAccent)
    : "indigo";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      showGrid={showGrid}
      isDark={isDark}
      compact={compact}
      accent={accent}
      headerIcon={<Boxes size={17} />}
      headerTitle="Place Value Lab"
      headerSubtitle={config.task === "read_number" ? "What number do the blocks show?" : `${TASK_LABELS[config.task]} ${config.target}`}
      readAloudText={instruction}
      headerActions={(
        <>
          <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>{solved ? "Complete" : `${TASK_LABELS[config.task]} · ${config.difficulty}`}</CanvasChip>
          <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Reset place value lab"><RotateCcw size={14} /></Button>
        </>
      )}
      playHint={instruction}
      designerHint="Choose a two-digit target, activity, guidance level, and base-ten block artwork in Studio."
      footerStatus={solved ? `${target.tens} tens and ${target.ones} ones make ${config.target}!` : selected !== null ? "Try again. Count the tens first, then the ones." : undefined}
      footerSolved={solved}
    >
      <div
        ref={stageRef}
        className={`relative my-2 flex min-h-[280px] w-full flex-1 items-stretch bg-transparent ${geometry.isCompact ? "flex-col" : "flex-row"}`}
        style={{ gap: `${geometry.gap}px` }}
      >
        <GhostGuideOverlay
          show={showGhostGuide && !solved && isPlayMode}
          label={config.task === "read_number" ? "Count the tens, then the ones — then tap the number!" : "Tap the blocks in the bank to build the number!"}
          isDark={isDark}
          labelPlacement="top"
        />

        {geometry.hasBank && (
          <CanvasBin
            label="Block bank"
            accent={accent}
            isDark={isDark}
            className="pointer-events-auto"
            style={geometry.isCompact
              ? { flex: `0 0 ${geometry.bankHeight}px` }
              : { flex: `0 0 ${geometry.bankWidth}px` }}
          >
            <div className={`absolute inset-0 flex items-stretch gap-2 ${geometry.isCompact ? "flex-row" : "flex-col"}`}>
              {/* A rod sized to the bank it lives in — it used to hang out over both edges. */}
              <button
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => { reportActivity(); addTen(); }}
                aria-label="Add one ten"
                className={`flex flex-1 min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl px-2 outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default disabled:opacity-60 ${surfaceClass(isDark, "raised")}`}
              >
                <Base10Scale size={geometry.bankRod.unit}>
                  <TenRod type={assetType} orientation={geometry.bankRod.orientation} noEnter highContrast />
                </Base10Scale>
                <span className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Add 1 ten</span>
              </button>
              <button
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => { reportActivity(); addOne(); }}
                aria-label="Add one one"
                className={`flex flex-1 min-w-0 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl px-2 outline-none transition hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default disabled:opacity-60 ${surfaceClass(isDark, "raised")}`}
              >
                <Base10Scale size={Math.min(UNIT_MAX, Math.max(UNIT_MIN, geometry.bankRod.unit * 2))}>
                  <OneUnit type={assetType} noEnter highContrast />
                </Base10Scale>
                <span className={`text-[10px] font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>Add 1 one</span>
              </button>
            </div>
          </CanvasBin>
        )}

        <div className="flex min-w-0 flex-1 flex-col" style={{ gap: `${geometry.gap}px` }}>
          <div className="flex min-h-0 flex-1 flex-row items-stretch" style={{ gap: `${geometry.gap}px` }}>
            <CanvasBin
              label="Tens"
              tally={showCounts ? blocks.tens : undefined}
              accent={accent}
              isDark={isDark}
              complete={solved && blocks.tens === target.tens}
              className="pointer-events-auto"
            >
              {/* Orientation follows the room: lying down in a wide zone, standing
                  up in a phone's narrow place column — see `fitRodGrid`. */}
              <Base10Scale size={geometry.rodUnit}>
                <div
                  className="absolute inset-0 m-auto grid place-content-center place-items-center gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${geometry.rodColumns}, minmax(0, 1fr))` }}
                >
                  <AnimatePresence mode="popLayout">
                    {Array.from({ length: blocks.tens }, (_, index) => (
                      <motion.button
                        layout
                        key={`ten-${index}`}
                        type="button"
                        onClick={() => { reportActivity(); removeTen(); }}
                        disabled={!isPlayMode || solved || config.task !== "build_number"}
                        initial={reduceMotion ? false : { scale: 0.55, x: -14, opacity: 0 }}
                        animate={{ scale: 1, x: 0, opacity: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
                        className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default"
                        aria-label="One ten. Tap to return it to the block bank."
                      >
                        <TenRod type={assetType} orientation={geometry.rodOrientation} noEnter highContrast />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </Base10Scale>
            </CanvasBin>

            <CanvasBin
              label="Ones"
              tally={showCounts ? blocks.ones : undefined}
              accent={accent}
              isDark={isDark}
              complete={solved && blocks.ones === target.ones}
              className="pointer-events-auto"
            >
              <Base10Scale size={geometry.onesUnit}>
                <div
                  className="absolute inset-0 m-auto grid place-content-center place-items-center gap-2"
                  style={{ gridTemplateColumns: `repeat(${geometry.onesColumns}, minmax(0, 1fr))` }}
                >
                  <AnimatePresence mode="popLayout">
                    {Array.from({ length: blocks.ones }, (_, index) => (
                      <motion.div layout key={`one-${index}`} exit={reduceMotion ? { opacity: 0 } : { scale: 0.2, y: -12, opacity: 0 }}>
                        <OneUnit
                          type={assetType}
                          isInteractive={isPlayMode && !solved && config.task === "build_number"}
                          onClick={() => { reportActivity(); removeOne(); }}
                          label={showCounts ? String(index + 1) : undefined}
                          highContrast
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </Base10Scale>
            </CanvasBin>
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
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Number choices">
              {choices.map(value => {
                const wrong = selected === value && value !== config.target;
                const correct = solved && value === config.target;
                const dimmed = solved && value !== config.target;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { reportActivity(); choose(value); }}
                    disabled={!isPlayMode || solved}
                    aria-pressed={selected === value}
                    aria-label={`Answer ${value}`}
                    className={`flex items-center justify-center gap-1.5 rounded-2xl border-2 font-mono font-black tabular-nums
                      outline-none transition-[transform,background-color,border-color,opacity] duration-150
                      focus-visible:ring-4 focus-visible:ring-indigo-400/40
                      ${compact ? "h-11 min-w-[3rem] px-3 text-lg" : "h-14 min-w-[4rem] px-4 text-2xl sm:h-16 sm:min-w-[4.5rem] sm:text-3xl"}
                      ${isPlayMode && !solved ? "cursor-pointer hover:-translate-y-0.5 active:scale-95" : "cursor-default"}
                      ${correct
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                        : wrong
                          ? "animate-shake border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200"
                          : isDark
                            ? "border-white/10 bg-white/[0.08] text-slate-100 hover:border-white/25 hover:bg-white/[0.14]"
                            : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:shadow-md"}
                      ${dimmed ? "opacity-40" : ""}`}
                  >
                    {correct && <Check size={compact ? 16 : 22} strokeWidth={3} />}{value}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
