import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Package, Move, Check, Calculator, AlertCircle, Delete } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentChipClass } from "./canvasTheme";
import { Button } from "../ui";

interface MagnetItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  inside: boolean;
}

const JAR_WIDTH = 130;
const JAR_HEIGHT = 160;
const GRID_STEP = 20;

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

export const MagnetsCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onUpdateQuestionConfig, onSuccess }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [magnets, setMagnets] = useState<MagnetItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAnimateJar, setShouldAnimateJar] = useState(false);
  const lastCountsRef = useRef<string>("");

  // Answer Input State
  const [answerInput, setAnswerInput] = useState<string>("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "error" | "correct">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showNumberPad, setShowNumberPad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [dimensions, setDimensions] = useState({ width: 480, height: 320 });
  const isMobile = dimensions.width < 640;
  const magnetSize = isMobile ? 46 : 56;

  const [jarPosition, setJarPosition] = useState<{ x: number; y: number }>({ x: 260, y: 40 });

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 320
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Update container position dynamically based on layout dimensions
  useEffect(() => {
    const isMobile = dimensions.width < 640;
    const defaultX = isMobile ? Math.round((dimensions.width - JAR_WIDTH) / 2) : Math.round(dimensions.width * 0.58);
    const defaultY = isMobile ? 30 : Math.round((dimensions.height - JAR_HEIGHT) / 2 - 10);

    const savedPos = question.config.containerPositions?.['jar'];
    if (!isPlayMode && savedPos) {
      setJarPosition({ x: savedPos.x, y: savedPos.y });
    } else {
      setJarPosition({ x: defaultX, y: defaultY });
    }
  }, [dimensions.width, dimensions.height, question.id, isPlayMode]);

  // Reset answer state on question change
  useEffect(() => {
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [question.id, count]);

  // Keep a magnet inside the jar bounded ellipse
  const clampInsideJar = useCallback((mX: number, mY: number, customJarPos?: { x: number; y: number }) => {
    const jarPos = customJarPos || jarPosition;
    const magnetCenterX = mX + magnetSize / 2;
    const magnetCenterY = mY + magnetSize / 2;

    const jarCenterX = jarPos.x + JAR_WIDTH / 2;
    const jarCenterY = jarPos.y + JAR_HEIGHT / 2 + 12;

    const minX = jarPos.x + 22;
    const maxX = jarPos.x + JAR_WIDTH - 22 - magnetSize;
    const minY = jarPos.y + 44;
    const maxY = jarPos.y + JAR_HEIGHT - 24 - magnetSize;

    const clampedX = Math.max(minX, Math.min(maxX, mX));
    const clampedY = Math.max(minY, Math.min(maxY, mY));

    return { x: Math.round(clampedX), y: Math.round(clampedY) };
  }, [jarPosition, magnetSize]);

  // Auto-grid layout for shelf items outside the jar
  const getDockGridPos = useCallback((idx: number, uncountedTotal: number) => {
    const isMobile = dimensions.width < 640;
    if (isMobile) {
      const cols = Math.min(6, Math.max(3, uncountedTotal));
      const rows = Math.ceil(uncountedTotal / cols);
      const stepX = Math.min(48, Math.floor((dimensions.width - 40) / cols));
      const stepY = 44;

      const gridTotalW = (cols - 1) * stepX + magnetSize * 0.7;
      const startX = (dimensions.width - gridTotalW) / 2;
      const startY = dimensions.height - (rows * stepY) - 10;

      const r = Math.floor(idx / cols);
      const c = idx % cols;
      return {
        x: Math.round(startX + c * stepX),
        y: Math.round(startY + r * stepY)
      };
    } else {
      const cols = Math.min(3, Math.max(2, Math.ceil(Math.sqrt(uncountedTotal))));
      const rows = Math.ceil(uncountedTotal / cols);
      const stepX = 52;
      const stepY = 52;

      const gridTotalW = (cols - 1) * stepX + magnetSize;
      const gridTotalH = (rows - 1) * stepY + magnetSize;

      const startX = Math.max(20, Math.round(dimensions.width * 0.28 - gridTotalW / 2));
      const startY = Math.round((dimensions.height - gridTotalH) / 2);

      const r = Math.floor(idx / cols);
      const c = idx % cols;
      return {
        x: Math.round(startX + c * stepX),
        y: Math.round(startY + r * stepY)
      };
    }
  }, [dimensions.width, dimensions.height, magnetSize]);

  // Initialize or update magnet positions
  useEffect(() => {
    const isMobile = dimensions.width < 640;
    const customPositions = (isMobile && isPlayMode) ? [] : (question.config.customPositions || []);

    setMagnets(Array.from({ length: count }).map((_, idx) => {
      const savedPos = customPositions.find(p => p.id === `mag-item-${idx}`);
      const defaultPos = getDockGridPos(idx, count);

      return {
        id: `mag-item-${idx}`,
        emoji: obj.emoji,
        x: savedPos ? savedPos.x : defaultPos.x,
        y: savedPos ? savedPos.y : defaultPos.y,
        inside: false
      };
    }));
  }, [question, count, dimensions.width, dimensions.height, getDockGridPos, obj.emoji, isPlayMode]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);

    const isMobile = dimensions.width < 640;
    const defaultX = isMobile ? Math.round((dimensions.width - JAR_WIDTH) / 2) : Math.round(dimensions.width * 0.58);
    const defaultY = isMobile ? 30 : Math.round((dimensions.height - JAR_HEIGHT) / 2 - 10);
    setJarPosition({ x: defaultX, y: defaultY });

    setMagnets(prev => prev.map((m, idx) => {
      const pos = getDockGridPos(idx, count);
      return { ...m, x: pos.x, y: pos.y, inside: false };
    }));

    if (onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: [],
        containerPositions: { jar: { x: defaultX, y: defaultY } }
      } as any);
    }
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    reportActivity();
    sounds.playPop();
    setDraggedItemId(id);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    let x = e.clientX - parentRect.left - dragOffset.current.x;
    let y = e.clientY - parentRect.top - dragOffset.current.y;

    if (draggedItemId === "jar") {
      x = Math.max(10, Math.min(parentRect.width - JAR_WIDTH - 10, x));
      y = Math.max(10, Math.min(parentRect.height - JAR_HEIGHT - 10, y));

      if (!isPlayMode && showGrid) {
        x = Math.round(x / GRID_STEP) * GRID_STEP;
        y = Math.round(y / GRID_STEP) * GRID_STEP;
      }

      const nextJarPos = { x: Math.round(x), y: Math.round(y) };
      setJarPosition(nextJarPos);
      setDragPos(nextJarPos);

      setMagnets(prev => prev.map(m => m.inside ? { ...m, ...clampInsideJar(m.x, m.y, nextJarPos) } : m));
    } else {
      x = Math.max(5, Math.min(parentRect.width - magnetSize - 5, x));
      y = Math.max(5, Math.min(parentRect.height - magnetSize - 5, y));

      if (!isPlayMode && showGrid) {
        x = Math.round(x / GRID_STEP) * GRID_STEP;
        y = Math.round(y / GRID_STEP) * GRID_STEP;
      }

      setDragPos({ x: Math.round(x), y: Math.round(y) });
      setMagnets(prev => prev.map(m => m.id === draggedItemId ? { ...m, x: Math.round(x), y: Math.round(y) } : m));
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;

    setMagnets(prev => {
      let finalMagnets = prev;

      if (isPlayMode) {
        const currentJarPosition = jarPosition;
        finalMagnets = prev.map((m, idx) => {
          if (m.id === draggedItemId) {
            const isInside =
              Math.hypot((m.x + magnetSize / 2) - (currentJarPosition.x + JAR_WIDTH / 2), (m.y + magnetSize / 2) - (currentJarPosition.y + JAR_HEIGHT / 2 + 15)) < 110;

            if (isInside) {
              const clamped = clampInsideJar(m.x, m.y);
              return { ...m, inside: true, x: clamped.x, y: clamped.y };
            } else {
              const uncountedIndex = prev.filter(item => !item.inside && item.id !== m.id).length;
              const pos = getDockGridPos(uncountedIndex, count);
              return { ...m, inside: false, x: pos.x, y: pos.y };
            }
          }
          return m;
        });
      } else {
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: prev.map(item => ({ id: item.id, x: item.x, y: item.y })),
            containerPositions: { jar: jarPosition }
          } as any);
        }
      }

      return finalMagnets;
    });

    setDraggedItemId(null);
    setDragPos(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    containerRef.current?.releasePointerCapture(e.pointerId);
    setDraggedItemId(null);
    setDragPos(null);
  };

  const insideCount = magnets.filter(m => m.inside).length;
  const isMagnetsComplete = count > 0 && insideCount === count;

  useEffect(() => {
    const key = magnets.map(m => m.id + ":" + m.inside).join("|");
    if (key !== lastCountsRef.current) {
      const prevInsideCount = lastCountsRef.current.split("|").filter(s => s.endsWith("true")).length;
      lastCountsRef.current = key;
      if (insideCount > 0 && isPlayMode && insideCount !== count) {
        sounds.playTick(insideCount);
        if (insideCount > prevInsideCount) {
          setShouldAnimateJar(true);
          const t = setTimeout(() => setShouldAnimateJar(false), 300);
          return () => clearTimeout(t);
        }
      }
    }
  }, [magnets, insideCount, isPlayMode, count]);

  const handleCheckAnswer = (overrideValue?: string) => {
    const valueToTest = overrideValue !== undefined ? overrideValue : answerInput;
    const parsed = parseInt(valueToTest.trim(), 10);

    if (isNaN(parsed) || valueToTest.trim() === "") {
      setAnswerStatus("error");
      setErrorMessage("Please enter a number!");
      sounds.playFailure();
      return;
    }

    if (parsed === count) {
      setAnswerStatus("correct");
      setErrorMessage("");
      sounds.playSuccess();
      successTimeoutRef.current = setTimeout(() => {
        onSuccessRef.current?.();
        successTimeoutRef.current = null;
      }, 500);
    } else {
      setAnswerStatus("error");
      setErrorMessage(`Not quite! You collected ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`);
      sounds.playFailure();
    }
  };

  const handleDigitPress = (digit: string) => {
    if (answerStatus === "correct") return;
    if (answerStatus === "error") {
      setAnswerStatus("idle");
      setErrorMessage("");
    }
    setAnswerInput(prev => (prev.length < 3 ? prev + digit : prev));
  };

  const handleBackspacePress = () => {
    if (answerStatus === "correct") return;
    if (answerStatus === "error") {
      setAnswerStatus("idle");
      setErrorMessage("");
    }
    setAnswerInput(prev => prev.slice(0, -1));
  };

  const hasTriggeredSuccess = useRef(false);

  useEffect(() => {
    hasTriggeredSuccess.current = false;
  }, [question.id]);

  useEffect(() => {
    if (isPlayMode && count > 0 && isMagnetsComplete) {
      if (!requireAnswerInput) {
        if (!hasTriggeredSuccess.current) {
          hasTriggeredSuccess.current = true;
          sounds.playSuccess();
          if (onSuccess) onSuccess();
        }
      } else {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 350);
      }
    } else {
      hasTriggeredSuccess.current = false;
    }
  }, [insideCount, count, isPlayMode, onSuccess, requireAnswerInput, isMagnetsComplete]);

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const solvedForGuide = count > 0 && isMagnetsComplete && (requireAnswerInput ? answerStatus === "correct" : true);
  const isSolved = solvedForGuide;

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });

  const draggedItem = draggedItemId ? (draggedItemId === "jar" ? { x: jarPosition.x, y: jarPosition.y } : magnets.find(i => i.id === draggedItemId)) : null;
  const isDraggingJar = draggedItemId === "jar";

  const renderKawaiiFace = (type: "jar" | "basket" | "box") => {
    const isHappy = shouldAnimateJar;
    const blushColor = type === "basket" ? "url(#basketBlush)" : type === "box" ? "url(#boxBlush)" : "url(#jarBlush)";
    const inkColor = type === "basket" ? "#3e2723" : type === "box" ? "#5d4037" : "#37474f";
    const tongueColor = "#ff769b";

    const cX1 = type === "jar" ? 41 : 39;
    const cX2 = type === "jar" ? 59 : 61;
    const cY = type === "jar" ? 58 : 56;

    const blushX1 = type === "jar" ? 35 : 33;
    const blushX2 = type === "jar" ? 65 : 67;
    const cheekY = type === "jar" ? 65 : 62;

    const smileY = type === "jar" ? 63 : 60;

    return (
      <g>
        <circle cx={blushX1} cy={cheekY} r={5} fill={blushColor} />
        <circle cx={blushX2} cy={cheekY} r={5} fill={blushColor} />

        {isHappy ? (
          <>
            <path d={`M ${cX1 - 4} ${cY + 1} Q ${cX1} ${cY - 3} ${cX1 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M ${cX2 - 4} ${cY + 1} Q ${cX2} ${cY - 3} ${cX2 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M 46,${smileY} C 46,${smileY + 7} 54,${smileY + 7} 54,${smileY} Z`} fill={tongueColor} stroke={inkColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <g>
              <circle cx={cX1} cy={cY} r="4" fill={inkColor} />
              <circle cx={cX1 - 1.5} cy={cY - 2} r="1.5" fill="#ffffff" />
              <circle cx={cX1 + 1.5} cy={cY + 2} r="0.6" fill="#ffffff" />
            </g>
            <g>
              <circle cx={cX2} cy={cY} r="4" fill={inkColor} />
              <circle cx={cX2 - 1.5} cy={cY - 2} r="1.5" fill="#ffffff" />
              <circle cx={cX2 + 1.5} cy={cY + 2} r="0.6" fill="#ffffff" />
            </g>
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY} Z`} fill={tongueColor} />
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY}`} fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </g>
    );
  };

  const dockWidth = isMobile ? Math.min(320, dimensions.width - 32) : Math.min(260, Math.max(220, Math.round(dimensions.width * 0.32)));
  const dockHeight = isMobile ? 95 : Math.min(280, Math.max(230, dimensions.height - 48));
  const dockLeft = isMobile ? Math.round((dimensions.width - dockWidth) / 2) : Math.max(240, dimensions.width - dockWidth - 24);
  const dockTop = isMobile ? dimensions.height - dockHeight - 12 : 24;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      accent={accent}
      headerIcon={<Package size={16} />}
      headerTitle="Magnets"
      headerSubtitle={
        isMagnetsComplete && requireAnswerInput
          ? "Collecting complete! Enter the total answer below."
          : `${insideCount} of ${count} inside`
      }
      readAloudText={question.instruction || `Drag all ${count} ${obj.label} into the container.`}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? "All inside" : `${count - insideCount} left`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset positions">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      footerStatus={
        isSolved
          ? `All ${count} tucked inside!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag the container and items to place them"
      }
      footerSolved={isSolved}
      designerHint="Drag the container or the items to reposition them."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full min-h-[400px] md:min-h-[320px] flex flex-col overflow-hidden touch-none select-none overscroll-none"
      >
      {!isPlayMode && showGrid && (
        <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.15]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="magnets-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#magnets-grid)" />
          </svg>
        </div>
      )}

      {/* Crosshair alignment guides in design mode */}
      {!isPlayMode && draggedItem && (
        <>
          <div
            className="absolute left-0 right-0 border-t border-dashed border-rose-400/40 pointer-events-none z-40"
            style={{ top: `${draggedItem.y + (draggedItemId === "jar" ? JAR_HEIGHT / 2 : magnetSize / 2)}px` }}
          />
          <div
            className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/40 pointer-events-none z-40"
            style={{ left: `${draggedItem.x + (draggedItemId === "jar" ? JAR_WIDTH / 2 : magnetSize / 2)}px` }}
          />
        </>
      )}

      {/* Docking Bay Container */}
      <div
        style={{
          position: "absolute",
          left: `${dockLeft}px`,
          top: `${dockTop}px`,
          width: `${dockWidth}px`,
          height: `${dockHeight}px`
        }}
        className={`rounded-3xl p-3 flex flex-col items-center justify-between transition-colors duration-300 pointer-events-none z-0 ${surfaceClass(isDark)}`}
      >
        <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${captionClass(isDark)}`}>
          {question.config.jarLabel || (question.config.containerShape === "basket" ? "Basket" : question.config.containerShape === "box" ? "Box" : "Collecting Jar")}
        </span>
      </div>

      <GhostGuideOverlay
        show={showGhostGuide && !isSolved}
        label={
          isMagnetsComplete && requireAnswerInput
            ? `Enter how many items you collected (${count}) in the box!`
            : `Drag all ${count} ${obj.label} into the container!`
        }
        isDark={isDark}
        labelPlacement="top"
        style={{
          left: jarPosition.x,
          top: jarPosition.y - 12,
          width: JAR_WIDTH,
          height: JAR_HEIGHT + 24
        }}
      />

      {/* Interactive Container */}
      <div
        onPointerDown={(e) => handlePointerDown(e, "jar")}
        style={{
          position: "absolute",
          left: `${jarPosition.x}px`,
          top: `${jarPosition.y}px`,
          width: `${JAR_WIDTH}px`,
          height: `${JAR_HEIGHT}px`,
          zIndex: isDraggingJar ? 40 : 10
        }}
        className={`select-none touch-none rounded-3xl transition-transform duration-150 ${
          isPlayMode ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        } ${isDraggingJar ? "scale-105 drop-shadow-2xl z-40" : "drop-shadow-lg"}`}
      >
        {!isPlayMode && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white font-mono text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow z-20 pointer-events-none">
            <Move size={8} /> Drag Jar
          </div>
        )}

        {/* SVG Container Illustration */}
        {question.config.containerShape === "basket" ? (
          <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
            <defs>
              <linearGradient id="basketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d7ccc8" />
                <stop offset="100%" stopColor="#a1887f" />
              </linearGradient>
              <radialGradient id="basketBlush" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffab91" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ffab91" stopOpacity="0" />
              </radialGradient>
              <pattern id="weave" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="#8d6e63" strokeWidth="1" opacity="0.4" />
              </pattern>
            </defs>
            <path d="M 25 35 C 25 15, 75 15, 75 35" fill="none" stroke="#8d6e63" strokeWidth="5" strokeLinecap="round" />
            <path d="M 15 38 L 22 105 C 23 112, 77 112, 78 105 L 85 38 Z" fill="url(#basketGrad)" stroke="#5d4037" strokeWidth="3" />
            <path d="M 15 38 L 22 105 C 23 112, 77 112, 78 105 L 85 38 Z" fill="url(#weave)" />
            <ellipse cx="50" cy="38" rx="35" ry="8" fill="#a1887f" stroke="#5d4037" strokeWidth="3" />
            <ellipse cx="50" cy="38" rx="31" ry="5" fill="#6d4c41" opacity="0.6" />
            {renderKawaiiFace("basket")}
          </svg>
        ) : question.config.containerShape === "box" ? (
          <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
            <defs>
              <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffe0b2" />
                <stop offset="100%" stopColor="#ffcc80" />
              </linearGradient>
              <radialGradient id="boxBlush" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffab91" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ffab91" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d="M 10 30 L 90 30 L 85 105 Q 85 112 78 112 L 22 112 Q 15 112 15 105 Z" fill="url(#boxGrad)" stroke="#8d6e63" strokeWidth="3" />
            <path d="M 10 30 L 30 15 L 50 30 Z" fill="#ffb74d" stroke="#8d6e63" strokeWidth="2" />
            <path d="M 90 30 L 70 15 L 50 30 Z" fill="#ffa726" stroke="#8d6e63" strokeWidth="2" />
            <line x1="50" y1="30" x2="50" y2="112" stroke="#bcaaa4" strokeWidth="2" strokeDasharray="4 3" />
            {renderKawaiiFace("box")}
          </svg>
        ) : (
          <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
            <defs>
              <linearGradient id="jarBody" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0f7fa" stopOpacity="0.7" />
                <stop offset="30%" stopColor="#b2ebf2" stopOpacity="0.4" />
                <stop offset="70%" stopColor="#80deea" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#4dd0e1" stopOpacity="0.75" />
              </linearGradient>
              <radialGradient id="jarBlush" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff80ab" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ff80ab" stopOpacity="0" />
              </radialGradient>
            </defs>

            <path d="M 22 28 C 12 36, 12 96, 22 106 C 28 112, 72 112, 78 106 C 88 96, 88 36, 78 28 Z" fill="url(#jarBody)" stroke="#00838f" strokeWidth="3" />
            <rect x="26" y="16" width="48" height="12" rx="4" fill="#e0f7fa" stroke="#00838f" strokeWidth="2.5" />
            <ellipse cx="50" cy="16" rx="22" ry="5" fill="#b2ebf2" stroke="#00838f" strokeWidth="2" />
            <path d="M 28 20 C 35 23, 65 23, 72 20" fill="none" stroke="#00838f" strokeWidth="1.5" opacity="0.6" />
            <path d="M 24 35 Q 20 65 25 100" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
            <circle cx="28" cy="101" r="2" fill="#ffffff" opacity="0.6" />
            {renderKawaiiFace("jar")}

            <g opacity="0.85">
              <ellipse cx="38" cy="46" rx="5" ry="7" fill="#ffe082" transform="rotate(-15 38 46)"/>
              <circle cx="38" cy="42" r="3.5" fill="#ffb74d"/>
              <path d="M 33,39 C 30,41 29,45 29,48" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              <path d="M 64,84 C 70,82 71,78 71,75" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            </g>
            <g transform="translate(76, 34)">
              <ellipse cx="0" cy="0" rx="4" ry="3" fill="#ffeb3b"/>
              <ellipse cx="-1" cy="-3" rx="1.5" ry="2.5" fill="#e0f7fa" opacity="0.8" transform="rotate(-20)"/>
              <ellipse cx="2" cy="-3" rx="1.5" ry="2.5" fill="#e0f7fa" opacity="0.8" transform="rotate(20)"/>
              <line x1="-1" y1="-3" x2="-1" y2="3" stroke="#37474f" strokeWidth="0.8"/>
              <line x1="1" y1="-3" x2="1" y2="3" stroke="#37474f" strokeWidth="0.8"/>
              <circle cx="3" cy="0" r="0.5" fill="#37474f"/>
            </g>
            <path d="M 18,44 Q 18,46 16,46 Q 18,46 18,48 Q 18,46 20,46 Q 18,46 18,44 Z" fill="#fff59d"/>
            <circle cx="22" cy="38" r="1" fill="#fff59d"/>
          </svg>
        )}

        {/* Hanging Vintage Tag Overlay */}
        <div className={`absolute bottom-[8%] left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center select-none py-1 px-3.5 rounded-xl border border-dashed transition-all duration-300 shadow-sm ${
          isDark 
            ? "bg-slate-950/95 border-slate-700 text-slate-200" 
            : "bg-white/95 border-amber-300 text-slate-800"
        }`}>
          <span className="font-mono text-[7px] font-black uppercase tracking-wider block mb-0.5 text-amber-600">
            {question.config.containerShape === "basket" 
              ? "INSIDE BASKET" 
              : question.config.containerShape === "box" 
              ? "INSIDE BOX" 
              : "INSIDE JAR"}
          </span>
          <span className={`text-2xl font-black font-mono transition-all duration-300 ${
            insideCount === count 
              ? "text-emerald-500 scale-105" 
              : "text-slate-800"
          }`}>
            {insideCount}
          </span>
        </div>

        {/* Jar coordinate tooltip in design mode */}
        {!isPlayMode && draggedItemId === "jar" && dragPos && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
            {jarPosition.x}, {jarPosition.y}
          </div>
        )}
      </div>

      {magnets.map(item => {
        const assetType = question.config?.assetType || "emoji";
        const hasFrame = question.config.showItemFrame ?? true;
        const isDragging = draggedItemId === item.id;

        let itemClassName = "flex items-center justify-center select-none touch-none rounded-2xl transition-all duration-250 ease-out";
        itemClassName += " cursor-grab active:cursor-grabbing";

        if (hasFrame) {
          itemClassName += item.inside
            ? ` ${accentChipClass(accent, isDark)} border-2`
            : ` ${surfaceClass(isDark, "raised")} border-0`;
          if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
        } else {
          itemClassName += item.inside
            ? " scale-98 drop-shadow-md"
            : " drop-shadow hover:drop-shadow-md hover:scale-105";
          if (isDragging) itemClassName += " scale-125 drop-shadow-2xl z-50";
        }

        const transitionStyle = isDragging
          ? "none"
          : "left 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";

        return (
          <div
            key={item.id}
            onPointerDown={(e) => handlePointerDown(e, item.id)}
            style={{
              position: "absolute",
              left: `${item.x}px`,
              top: `${item.y}px`,
              width: `${magnetSize}px`,
              height: `${magnetSize}px`,
              zIndex: isDragging ? 50 : item.inside ? 20 : 30,
              transition: transitionStyle
            }}
            className={itemClassName}
          >
            {!isPlayMode && isDragging && dragPos && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                {item.x}, {item.y}
              </div>
            )}
            <CountingAsset type={assetType as any} emoji={item.emoji} size={isMobile ? 32 : 42} />
          </div>
        );
      })}

      {/* ── Answer Input Box Overlay after collecting all items ── */}
      <AnimatePresence>
        {isPlayMode && requireAnswerInput && isMagnetsComplete && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute inset-x-2 bottom-2 z-50 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl backdrop-blur-md border shadow-2xl transition-all max-w-lg mx-auto"
            style={{
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
              borderColor: answerStatus === "error" 
                ? "#ef4444" 
                : answerStatus === "correct" 
                ? "#10b981" 
                : isDark ? "#334155" : "#cbd5e1"
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🎉</span>
              <span className={`text-xs sm:text-sm font-extrabold tracking-tight ${
                isDark ? "text-slate-100" : "text-slate-800"
              }`}>
                How many {obj.label}{count === 1 ? "" : "s"} did you collect in total?
              </span>
            </div>

            {/* Answer Input Controls */}
            <div className="flex items-center gap-2 w-full justify-center max-w-xs">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={answerInput}
                  onChange={(e) => {
                    setAnswerInput(e.target.value);
                    if (answerStatus === "error") {
                      setAnswerStatus("idle");
                      setErrorMessage("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCheckAnswer();
                  }}
                  placeholder="Total..."
                  disabled={answerStatus === "correct"}
                  className={`w-full h-11 px-3 text-center text-lg sm:text-xl font-bold font-mono rounded-xl border-2 transition-all outline-none ${
                    answerStatus === "error"
                      ? "border-red-500 bg-red-50/50 text-red-700 animate-shake dark:bg-red-950/40 dark:text-red-300"
                      : answerStatus === "correct"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : isDark
                      ? "bg-slate-900 border-slate-700 text-white focus:border-indigo-500"
                      : "bg-white border-slate-300 text-slate-900 focus:border-indigo-500"
                  }`}
                />
              </div>

              <Button
                onClick={() => handleCheckAnswer()}
                disabled={answerStatus === "correct" || !answerInput.trim()}
                className={`h-11 px-4 text-sm font-bold flex items-center gap-1.5 rounded-xl shadow-md transition-all active:scale-95 ${
                  answerStatus === "correct"
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {answerStatus === "correct" ? <Check size={18} /> : "Check"}
              </Button>

              <button
                type="button"
                onClick={() => setShowNumberPad(prev => !prev)}
                className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
                  showNumberPad
                    ? "bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-600 dark:text-indigo-300"
                    : isDark
                    ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                }`}
                title="Toggle Number Pad"
              >
                <Calculator size={18} />
              </button>
            </div>

            {/* Error feedback banner */}
            {answerStatus === "error" && errorMessage && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 font-bold mt-2 animate-fade-in text-center">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* On-screen Number Keypad for Kids / Mobile / Tablets */}
            <AnimatePresence>
              {showNumberPad && answerStatus !== "correct" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2 overflow-hidden"
                >
                  <div className="grid grid-cols-5 gap-1.5 w-full max-w-xs">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleDigitPress(String(num))}
                        className={`h-9 font-mono text-base font-extrabold rounded-lg border shadow-sm transition-all active:scale-95 ${
                          isDark
                            ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                            : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={handleBackspacePress}
                      className={`flex-1 h-8 text-xs font-extrabold rounded-lg border flex items-center justify-center gap-1 transition-all ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Delete size={14} /> Backspace
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnswerInput("")}
                      className={`px-3 h-8 text-xs font-extrabold rounded-lg border transition-all ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Clear
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </SharedCanvasLayout>
  );
};
