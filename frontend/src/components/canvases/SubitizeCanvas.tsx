import React, { useState, useEffect, useMemo, useRef } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Play, HelpCircle, Check, RotateCcw } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { guidePropsFor } from "../../features/koda-mascot";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentTextClass } from "./canvasTheme";
import { Button } from "../ui";
import { objectStyle } from "./objectMotion";
import { oneToOneLayout, type OneToOnePattern } from "./oneToOneLayout";
import { balancedChoiceOrder } from "./choiceOrder";

/**
 * Arrangements a flash may use.
 *
 * These are the shared pattern layouts, not a second copy: the dice faces here
 * used to be a table of pixel offsets (±65, ±40) that meant one thing on the
 * 440 × 220 box they were tuned against and something else everywhere else —
 * a six spilling off a phone, a two lost in the middle of a projector.
 */
const SUBITIZE_PATTERNS: OneToOnePattern[] = [
  "dice", "ring", "circle", "grid", "columns", "pairs", "line", "wave", "scatter"
];

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

export const SubitizeCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, isDark = false, onSuccess }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const duration = question.config.flashDurationMs || 1500;
  const pattern: OneToOnePattern = SUBITIZE_PATTERNS.includes(question.config.pattern as OneToOnePattern)
    ? (question.config.pattern as OneToOnePattern)
    : "dice";

  const [stage, setStage] = useState<"idle" | "showing" | "hidden" | "correct" | "incorrect">("idle");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 440, height: 220 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: Math.round(entry.contentRect.width),
            height: Math.round(entry.contentRect.height)
          });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    reset();
  }, [question]);

  /*
    A flash that is still in flight when the slide changes used to land on the
    next question and blank it — the child saw nothing to count.
  */
  useEffect(() => () => {
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
  }, []);

  const reset = () => {
    if (flashTimeout.current) {
      clearTimeout(flashTimeout.current);
      flashTimeout.current = null;
    }
    setStage("idle");
    setSelectedOption(null);
    
    // Generate 4 randomized unique options containing the correct count
    const opts = new Set<number>();
    opts.add(count);
    while (opts.size < 4) {
      const randOffset = Math.floor(Math.random() * 5) - 2; // -2 to +2
      const candidate = count + randOffset;
      if (candidate > 0 && candidate <= 15) {
        opts.add(candidate);
      }
    }
    setOptions(balancedChoiceOrder(
      Array.from(opts).sort((a, b) => a - b),
      count,
      question.config.answerChoiceSlot,
    ));
  };

  const handleStartFlash = () => {
    sounds.playSlide();
    setStage("showing");
    setSelectedOption(null);

    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => {
      setStage("hidden");
      flashTimeout.current = null;
    }, duration);
  };

  const handleOptionSelect = (option: number) => {
    if (stage === "correct") return;
    setSelectedOption(option);
    
    if (option === count) {
      sounds.playSuccess();
      setStage("correct");
      if (onSuccess) onSuccess();
    } else {
      sounds.playFailure();
      setStage("incorrect");
    }
  };

  /**
   * Where the objects sit, and how big they are.
   *
   * `oneToOneLayout` places the pattern's centres in the arena first and lets the
   * tightest gap between any two of them decide the object size, so a flash reads
   * the same on a phone and on a projector. `dimensions` is the observer's
   * content box, so it is already the arena the objects are rendered into —
   * the card's padding is not in it and must not be taken off twice.
   */
  const layout = useMemo(() => oneToOneLayout({
    count,
    width: Math.max(120, dimensions.width),
    height: Math.max(100, dimensions.height),
    pattern,
    padding: 10
  }), [count, dimensions.width, dimensions.height, pattern]);

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const isSolved = stage === "correct";
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      accent={accent}
      /*
        No `headerIcon`. It only renders on the header this canvas no longer
        takes — `questionText` below always resolves to a sentence, so the
        icon-and-title row is unreachable here and leaving it set would suggest
        otherwise. `headerTitle` stays: on the question header it becomes the
        eyebrow, and only for an author.
      */
      headerTitle="Subitize"
      /*
        The question is the heading, and the stage is a chip beside it — the
        same shape Count uses.

        This canvas used to lead with "Subitize" and give the prominent line to
        whatever it was doing that second ("Look carefully…", "Yes — 5!"), so a
        child arrived at a status and had to work out the task from it. The task
        is one sentence and it does not change while the flash runs, which is
        exactly what a heading is for; what *does* change every second is the
        stage, and that is what a chip is for.

        Stable across stages on purpose. A heading that rewrites itself mid-
        exercise is a second thing to track at the moment a child is trying to
        hold a quantity in their head.
      */
      questionText={question.instruction?.trim() || "How many did you see?"}
      readAloudText={question.instruction || `Watch carefully. The objects will flash for ${duration / 1000} seconds. How many did you see?`}
      /*
        Which of Koda's four the board is asking for. `showing` deliberately
        reads as waiting rather than talking: the whole point of the flash is
        that a child looks at the objects, and a character moving beside them is
        the one thing on screen that must not pull the eye during it.
      */
      guideRole={stage === "incorrect" ? "oops" : isSolved ? "celebrating" : "waiting"}
      {...guidePropsFor(question)}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {stage === "showing"
              ? `Look carefully · ${duration / 1000}s`
              : stage === "hidden"
                ? "How many?"
                : isSolved
                  ? `Yes — ${count}`
                  : `${pattern.toUpperCase()} · flash then count`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      footerStatus={
        isSolved
          ? `Spot on — there were ${count}!`
          : stage === "incorrect"
            ? "Not quite — flash again and take another look"
            : isPlayMode
              ? undefined
              : "Design Mode · Preview of the flashed layout"
      }
      footerSolved={isSolved}
    >
      {/* Stage.
          `flex-1` made this fill every pixel of vertical space it was given while staying
          capped at 500px wide, so on a laptop the flash surface became a 500×650 column with
          one small button adrift in the middle of it. Holding a 4:3 shape keeps the objects
          grouped closely enough to actually be subitized — which is the whole exercise — and
          `max-h-full` still lets it shrink on a short screen rather than overflow. */}
      <div
        ref={containerRef}
        className={`relative w-full max-w-[500px] mx-auto my-auto aspect-[4/3] max-h-full min-h-[200px] rounded-[2.2rem] flex items-center justify-center p-4 transition-colors duration-300 overflow-hidden touch-none select-none overscroll-none ${surfaceClass(isDark, "panel")}`}
      >
        <GhostGuideOverlay
          show={showGhostGuide && !isSolved}
          label={(stage === "hidden" || stage === "incorrect" ? "Pick the number you saw!" : "Tap the button to flash the objects!")}
          isDark={isDark}
          labelPlacement="top"
        />
        {stage === "idle" && isPlayMode && (
          <button
            onClick={() => { reportActivity(); handleStartFlash(); }}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-xl hover:shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer z-20"
          >
            <Play size={16} fill="white" />
            Flash Layout ({duration / 1000}s)
          </button>
        )}

        {(stage === "showing" || !isPlayMode || stage === "correct" || stage === "incorrect") && (
          <div className="relative w-full h-full flex items-center justify-center animate-scale-in">
            {layout.positions.map((pos, idx) => {
              const assetType = question.config?.assetType || "emoji";

              return (
                <div
                  key={idx}
                  style={objectStyle({ x: pos.x, y: pos.y, size: layout.size, z: 10 })}
                  className={`rounded-2xl flex items-center justify-center pointer-events-none animate-scale-in drop-shadow-sm ${surfaceClass(isDark, "raised")}`}
                >
                  <CountingAsset type={assetType as any} emoji={obj.emoji} size={Math.round(layout.size * 0.7)} />
                </div>
              );
            })}
          </div>
        )}

        {stage === "hidden" && isPlayMode && (
          <div className={`w-11/12 max-w-[360px] h-3/4 rounded-3xl flex flex-col items-center justify-center p-6 animate-scale-in ${surfaceClass(isDark, "raised")}`}>
            <HelpCircle size={36} className={`${accentTextClass(accent, isDark)} animate-bounce mb-2`} />
            <span className={`font-mono text-sm font-extrabold uppercase tracking-widest ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              How many did you see?
            </span>
            <span className={`text-xs mt-1 ${captionClass(isDark)}`}>Select the exact number below</span>
          </div>
        )}
      </div>

      {/* Answer options */}
      <div className="w-full flex flex-col items-center gap-2 z-10 mt-3">
        {isPlayMode && stage !== "idle" && (
          <div className="grid grid-cols-4 gap-3 w-full max-w-xs animate-slide-up">
            {options.map(option => {
              const isSelected = selectedOption === option;
              let btnStyle = `${surfaceClass(isDark, "raised")} ${isDark ? "text-slate-200" : "text-slate-700"}`;

              if (isSelected) {
                btnStyle = option === count
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105"
                  : "bg-rose-500 text-white shadow-lg shadow-rose-500/20";
              }

              return (
                <button
                  key={option}
                  onClick={() => { reportActivity(); handleOptionSelect(option); }}
                  disabled={stage === "correct"}
                  className={`py-2.5 px-3 font-mono text-base font-extrabold rounded-2xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${btnStyle}`}
                >
                  {isSelected && option === count && <Check size={16} strokeWidth={3} />}
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        )}

        {stage === "incorrect" && (
          <Button type="button" variant="outline" size="xs" onClick={handleStartFlash}>
            <Play size={12} fill="currentColor" />
            Flash again
          </Button>
        )}
      </div>
    </SharedCanvasLayout>
  );
};
