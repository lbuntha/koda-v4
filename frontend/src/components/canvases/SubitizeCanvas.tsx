import React, { useState, useEffect, useRef } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Play, HelpCircle, Check, RotateCcw, Eye } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentTextClass } from "./canvasTheme";
import { Button } from "../ui";

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
  const pattern = question.config.pattern || "dice";

  const [stage, setStage] = useState<"idle" | "showing" | "hidden" | "correct" | "incorrect">("idle");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [options, setOptions] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
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

  const reset = () => {
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
    setOptions(Array.from(opts).sort((a, b) => a - b));
  };

  const handleStartFlash = () => {
    sounds.playSlide();
    setStage("showing");
    setSelectedOption(null);

    setTimeout(() => {
      setStage("hidden");
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

  // Centered, responsive coordinate calculation inside the Subitize Stage Container
  const getCoordinates = (index: number, total: number, arenaW: number, arenaH: number) => {
    const itemSize = 60;
    const usableW = Math.max(160, arenaW - 60);
    const usableH = Math.max(100, arenaH - 80);
    const centerX = (arenaW - itemSize) / 2;
    const centerY = 36 + (usableH - itemSize) / 2;

    if (pattern === "dice" && total <= 6) {
      const diceSlots: { [key: number]: { dx: number; dy: number }[] } = {
        1: [{ dx: 0, dy: 0 }],
        2: [{ dx: -60, dy: -35 }, { dx: 60, dy: 35 }],
        3: [{ dx: -65, dy: -40 }, { dx: 0, dy: 0 }, { dx: 65, dy: 40 }],
        4: [{ dx: -65, dy: -40 }, { dx: 65, dy: -40 }, { dx: -65, dy: 40 }, { dx: 65, dy: 40 }],
        5: [{ dx: -65, dy: -40 }, { dx: 65, dy: -40 }, { dx: 0, dy: 0 }, { dx: -65, dy: 40 }, { dx: 65, dy: 40 }],
        6: [{ dx: -70, dy: -40 }, { dx: 70, dy: -40 }, { dx: -70, dy: 0 }, { dx: 70, dy: 0 }, { dx: -70, dy: 40 }, { dx: 70, dy: 40 }]
      };
      const slots = diceSlots[total] || diceSlots[1];
      const slot = slots[index % slots.length];
      return { x: Math.round(centerX + slot.dx), y: Math.round(centerY + slot.dy) };
    }

    if (pattern === "ring") {
      const radius = Math.min(usableW, usableH) * 0.38;
      const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
      return {
        x: Math.round(centerX + radius * Math.cos(angle)),
        y: Math.round(centerY + radius * Math.sin(angle))
      };
    }

    // Grid / Scatter fallback inside stage bounds
    const cols = total <= 4 ? 2 : Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    const stepX = Math.min(68, usableW / cols);
    const stepY = Math.min(68, usableH / rows);
    const gridW = (cols - 1) * stepX;
    const gridH = (rows - 1) * stepY;
    const startX = centerX - gridW / 2;
    const startY = centerY - gridH / 2;

    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: Math.round(startX + col * stepX),
      y: Math.round(startY + row * stepY)
    };
  };

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
      headerIcon={<Eye size={16} />}
      headerTitle="Subitize"
      headerSubtitle={
        stage === "showing"
          ? "Look carefully…"
          : stage === "hidden"
            ? "How many did you see?"
            : isSolved
              ? `Yes — ${count}!`
              : "Flash, then count"
      }
      readAloudText={question.instruction || `Watch carefully. The objects will flash for ${duration / 1000} seconds. How many did you see?`}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {stage === "showing" ? `${duration / 1000}s flash` : pattern.toUpperCase()}
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
        className={`relative w-full max-w-[500px] mx-auto my-auto aspect-[4/3] max-h-full min-h-[200px] rounded-[2.2rem] flex items-center justify-center p-4 transition-colors duration-300 overflow-hidden touch-none select-none overscroll-none ${surfaceClass(isDark)}`}
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
            {Array.from({ length: count }).map((_, idx) => {
              const pos = getCoordinates(idx, count, dimensions.width || 440, dimensions.height || 220);
              const assetType = question.config?.assetType || "emoji";

              return (
                <div
                  key={idx}
                  style={{
                    position: "absolute",
                    left: `${pos.x}px`,
                    top: `${pos.y}px`
                  }}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center pointer-events-none animate-scale-in drop-shadow-sm ${surfaceClass(isDark, "raised")}`}
                >
                  <CountingAsset type={assetType as any} emoji={obj.emoji} size={40} />
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
