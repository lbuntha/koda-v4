import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Sparkles, LayoutGrid, Check, Calculator, AlertCircle, Delete } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip } from "./canvasTheme";
import { Button } from "../ui";

interface ArrangementItem {
  id: string;
  x: number;
  y: number;
  tapped: boolean;
}

// Layout constants
const GRID_STEP = 20;

export const ArrangementsCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const layoutStyle = question.config.pattern || "scatter";
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [items, setItems] = useState<ArrangementItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [tapOrder, setTapOrder] = useState<string[]>([]);

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

  const isCountComplete = count > 0 && tapOrder.length === count;
  const solvedForGuide = count > 0 && isCountComplete && (requireAnswerInput ? answerStatus === "correct" : true);
  
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });

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

  const w = dimensions.width;
  const h = dimensions.height;

  const isMobile = w < 640;
  const itemSize = isMobile ? 52 : 64;

  // Default coordinate generator
  const getCoordinates = useCallback((index: number, w: number, h: number) => {
    const isMobile = w < 640;
    const itemSize = isMobile ? 52 : 64;
    const margin = isMobile ? 24 : 50;
    const canvasW = w - margin * 2;
    const canvasH = h - 120; // reserve space for stage header & CPA sequence tray
    const centerX = w / 2;
    const centerY = isMobile ? (h - 100) / 2 - 5 : (h - 100) / 2 + 15;

    if (layoutStyle === "circle") {
      const radius = Math.min(canvasW, canvasH) / 2 - (isMobile ? 12 : 20);
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      return {
        x: Math.round(radius * Math.cos(angle) + centerX - itemSize / 2),
        y: Math.round(radius * Math.sin(angle) + centerY - itemSize / 2)
      };
    }

    if (layoutStyle === "line") {
      const spacing = Math.min(isMobile ? 52 : 64, canvasW / count);
      const totalWidth = (count - 1) * spacing;
      return {
        x: Math.round(centerX - totalWidth / 2 + index * spacing - itemSize / 2),
        y: Math.round(centerY - itemSize / 2)
      };
    }

    if (layoutStyle === "scatter") {
      const scale = isMobile ? 0.65 : 1.0;
      const coordinates = [
        { x: centerX - 120 * scale, y: centerY - 50 * scale },
        { x: centerX + 100 * scale, y: centerY + 30 * scale },
        { x: centerX - 150 * scale, y: centerY + 50 * scale },
        { x: centerX + 50 * scale, y: centerY - 65 * scale },
        { x: centerX - 10 * scale, y: centerY + 45 * scale },
        { x: centerX + 120 * scale, y: centerY - 35 * scale },
        { x: centerX - 80 * scale, y: centerY - 40 * scale },
        { x: centerX + 40 * scale, y: centerY + 65 * scale },
        { x: centerX + 140 * scale, y: centerY + 45 * scale },
        { x: centerX - 40 * scale, y: centerY + 10 * scale }
      ];
      const basePos = coordinates[index % coordinates.length];
      return {
        x: Math.round(basePos.x - itemSize / 2 + (isMobile ? 26 : 32)),
        y: Math.round(basePos.y - itemSize / 2 + (isMobile ? 26 : 32))
      };
    }

    // Grid layout
    const columns = Math.ceil(Math.sqrt(count));
    const spacingX = isMobile ? Math.max(56, Math.min(68, Math.floor((w - margin * 2) / columns))) : 84;
    const spacingY = isMobile ? 66 : 80;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const totalRows = Math.ceil(count / columns);

    return {
      x: Math.round(centerX - ((columns - 1) * spacingX) / 2 + col * spacingX - itemSize / 2),
      y: Math.round(centerY - ((totalRows - 1) * spacingY) / 2 + row * spacingY - itemSize / 2)
    };
  }, [count, layoutStyle]);

  // Reset answer state on question change
  useEffect(() => {
    setTapOrder([]);
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [question.id, count]);

  // Initialize layout positions
  useEffect(() => {
    const isMobile = dimensions.width < 640;
    const customPositions = (isMobile && isPlayMode) ? [] : (question.config.customPositions || []);
    setItems(prev => {
      return Array.from({ length: count }).map((_, idx) => {
        const savedPos = customPositions.find(p => p.id === `arr-item-${idx}`);
        const defaultPos = getCoordinates(idx, dimensions.width, dimensions.height);
        const existing = prev.find(i => i.id === `arr-item-${idx}`);

        if (existing) {
          if (savedPos) return { ...existing, x: savedPos.x, y: savedPos.y };
          const prevDefault = getCoordinates(idx, dimensions.width, dimensions.height);
          return { ...existing, x: prevDefault.x, y: prevDefault.y };
        }

        return {
          id: `arr-item-${idx}`,
          x: savedPos ? savedPos.x : defaultPos.x,
          y: savedPos ? savedPos.y : defaultPos.y,
          tapped: false
        };
      });
    });
  }, [question, count, dimensions, getCoordinates, isPlayMode]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setTapOrder([]);
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);

    sounds.playPop();
    onUpdateQuestionConfig?.({
      customPositions: []
    } as any);
    setItems(prev =>
      prev.map((item, idx) => {
        const defaultPos = getCoordinates(idx, dimensions.width, dimensions.height);
        return {
          ...item,
          tapped: false,
          x: defaultPos.x,
          y: defaultPos.y
        };
      })
    );
  };

  const handleTap = (id: string) => {
    reportActivity();
    if (!isPlayMode) return;
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1 || items[idx].tapped) return;

    const nextNumber = tapOrder.length + 1;
    sounds.playTick(nextNumber);

    setTapOrder(prev => [...prev, id]);
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, tapped: true } : item))
    );

    if (tapOrder.length + 1 === count) {
      if (!requireAnswerInput) {
        successTimeoutRef.current = setTimeout(() => {
          sounds.playSuccess();
          onSuccessRef.current?.();
          successTimeoutRef.current = null;
        }, 300);
      } else {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 350);
      }
    }
  };

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
      setErrorMessage(`Not quite! There are ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`);
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

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlayMode) {
      handleTap(id);
      return;
    }
    sounds.playPop();
    setDraggedItemId(id);

    const rect = e.currentTarget.getBoundingClientRect();
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

    x = Math.max(5, Math.min(parentRect.width - itemSize - 5, x));
    y = Math.max(5, Math.min(parentRect.height - itemSize - 5, y));

    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    setDragPos({ x: Math.round(x), y: Math.round(y) });

    setItems(prev =>
      prev.map(item => (item.id === draggedItemId ? { ...item, x: Math.round(x), y: Math.round(y) } : item))
    );
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const id = draggedItemId;

    setItems(prev => {
      if (onUpdateQuestionConfig) {
        onUpdateQuestionConfig({
          customPositions: prev.map(item => ({ id: item.id, x: item.x, y: item.y }))
        });
      }
      return prev;
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

  const frameColor = question.config.frameColor || "indigo";
  let containerBg = isDark ? "bg-slate-900/40 border-violet-500/40 shadow-lg shadow-black/40" : "bg-violet-50/50 border-violet-200 shadow-sm";
  let headerBadgeBg = isDark ? "bg-slate-800/90 border-violet-500/40 text-violet-300" : "bg-white/90 border-violet-200 text-violet-800";
  let headerIconColor = "text-violet-500";
  let countBadgeBg = isDark ? "bg-cyan-950/80 border-cyan-400/50 text-cyan-300" : "bg-indigo-600 border-indigo-500 text-white shadow-indigo-100";
  let itemTappedBg = isDark ? "bg-indigo-950/90 border-2 border-cyan-400 scale-95 opacity-85 shadow-md text-cyan-200" : "bg-indigo-50/90 border-2 border-indigo-400 scale-95 opacity-85 shadow-md text-indigo-950";
  let itemUntappedBg = isDark ? "bg-slate-800/80 border border-violet-500/40 hover:border-cyan-400 hover:scale-105 shadow text-violet-200" : "bg-white border border-slate-200 hover:border-violet-300 hover:scale-105 shadow-sm text-violet-950";
  let tappedBadgeBg = isDark ? "bg-cyan-500 text-slate-950 border-cyan-300" : "bg-indigo-600 text-white border-indigo-400";
  let trayBg = isDark ? "bg-slate-900/80 border-slate-700/80 shadow-black/40" : "bg-white/90 border-slate-200 shadow-sm";
  let seqActiveBg = isDark ? "bg-cyan-500 text-slate-950 border-cyan-300 shadow-md font-black scale-105" : "bg-indigo-600 text-white border-indigo-400 shadow-sm font-black scale-105";
  let seqPendingBg = isDark ? "bg-slate-800/60 border-slate-700/60 text-slate-500 font-medium" : "bg-slate-100/80 border-slate-200/80 text-slate-400 font-medium";

  if (frameColor === "emerald") {
    containerBg = isDark ? "bg-slate-900/40 border-emerald-500/40 shadow-lg shadow-black/40" : "bg-emerald-50/50 border-emerald-200 shadow-sm";
    headerBadgeBg = isDark ? "bg-slate-800/90 border-emerald-500/40 text-emerald-300" : "bg-white/90 border-emerald-200 text-emerald-800";
    headerIconColor = "text-emerald-500";
    countBadgeBg = isDark ? "bg-emerald-950/80 border-teal-400/50 text-teal-300" : "bg-teal-600 border-teal-500 text-white shadow-teal-100";
    itemTappedBg = isDark ? "bg-emerald-950/90 border-2 border-teal-400 scale-95 opacity-85 shadow-md text-teal-200" : "bg-emerald-50/90 border-2 border-teal-400 scale-95 opacity-85 shadow-md text-emerald-950";
    itemUntappedBg = isDark ? "bg-slate-800/80 border border-emerald-500/40 hover:border-teal-400 hover:scale-105 shadow text-emerald-200" : "bg-white border border-slate-200 hover:border-emerald-300 hover:scale-105 shadow-sm text-emerald-950";
    tappedBadgeBg = isDark ? "bg-teal-500 text-slate-950 border-teal-300" : "bg-teal-600 text-white border-teal-400";
    seqActiveBg = isDark ? "bg-teal-500 text-slate-950 border-teal-300 shadow-md font-black scale-105" : "bg-teal-600 text-white border-teal-400 shadow-sm font-black scale-105";
  } else if (frameColor === "purple") {
    containerBg = isDark ? "bg-slate-900/40 border-purple-500/40 shadow-lg shadow-black/40" : "bg-purple-50/50 border-purple-200 shadow-sm";
    headerBadgeBg = isDark ? "bg-slate-800/90 border-purple-500/40 text-purple-300" : "bg-white/90 border-purple-200 text-purple-800";
    headerIconColor = "text-purple-500";
    countBadgeBg = isDark ? "bg-purple-950/80 border-fuchsia-400/50 text-fuchsia-300" : "bg-fuchsia-600 border-fuchsia-500 text-white shadow-fuchsia-100";
    itemTappedBg = isDark ? "bg-purple-950/90 border-2 border-fuchsia-400 scale-95 opacity-85 shadow-md text-fuchsia-200" : "bg-purple-50/90 border-2 border-fuchsia-400 scale-95 opacity-85 shadow-md text-purple-950";
    itemUntappedBg = isDark ? "bg-slate-800/80 border border-purple-500/40 hover:border-fuchsia-400 hover:scale-105 shadow text-purple-200" : "bg-white border border-slate-200 hover:border-purple-300 hover:scale-105 shadow-sm text-purple-950";
    tappedBadgeBg = isDark ? "bg-fuchsia-500 text-slate-950 border-fuchsia-300" : "bg-fuchsia-600 text-white border-fuchsia-400";
    seqActiveBg = isDark ? "bg-fuchsia-500 text-slate-950 border-fuchsia-300 shadow-md font-black scale-105" : "bg-fuchsia-600 text-white border-fuchsia-400 shadow-sm font-black scale-105";
  } else if (frameColor === "pink" || frameColor === "rose" as any) {
    containerBg = isDark ? "bg-slate-900/40 border-rose-500/40 shadow-lg shadow-black/40" : "bg-rose-50/50 border-rose-200 shadow-sm";
    headerBadgeBg = isDark ? "bg-slate-800/90 border-rose-500/40 text-rose-300" : "bg-white/90 border-rose-200 text-rose-800";
    headerIconColor = "text-rose-500";
    countBadgeBg = isDark ? "bg-rose-950/80 border-pink-400/50 text-pink-300" : "bg-pink-600 border-pink-500 text-white shadow-pink-100";
    itemTappedBg = isDark ? "bg-rose-950/90 border-2 border-pink-400 scale-95 opacity-85 shadow-md text-pink-200" : "bg-rose-50/90 border-2 border-pink-400 scale-95 opacity-85 shadow-md text-rose-950";
    itemUntappedBg = isDark ? "bg-slate-800/80 border border-rose-500/40 hover:border-pink-400 hover:scale-105 shadow text-rose-200" : "bg-white border border-slate-200 hover:border-rose-300 hover:scale-105 shadow-sm text-rose-950";
    tappedBadgeBg = isDark ? "bg-pink-500 text-slate-950 border-pink-300" : "bg-pink-600 text-white border-pink-400";
    seqActiveBg = isDark ? "bg-pink-500 text-slate-950 border-pink-300 shadow-md font-black scale-105" : "bg-pink-600 text-white border-pink-400 shadow-sm font-black scale-105";
  }

  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      accent="violet"
      headerIcon={<LayoutGrid size={16} />}
      headerTitle="Count in Different Arrangements"
      headerSubtitle={
        isCountComplete && requireAnswerInput
          ? "Counting complete! Enter the total answer below."
          : `${tapOrder.length} of ${count} Counted`
      }
      readAloudText={question.instruction || `Tap and count the ${obj.label}. No matter how they are arranged, the total count is still ${count}!`}
      headerActions={
        <div className="flex items-center gap-2 flex-shrink-0 z-30 pointer-events-auto">
          <CanvasChip accent="violet" isDark={isDark} icon={<LayoutGrid size={12} />}>
            {layoutStyle === "circle" ? "Circle Arrangement" : layoutStyle === "line" ? "Line Arrangement" : layoutStyle === "grid" ? "Grid Arrangement" : "Scattered Arrangement"}
          </CanvasChip>
          {isPlayMode && (
            <button
              onClick={reset}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                isDark 
                  ? "bg-slate-850 hover:bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white" 
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-550 text-slate-500 hover:text-slate-700"
              }`}
              title="Reset progress"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      }
      designerHint="Drag items to reposition them on the canvas grid."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full h-full bg-transparent border-0 rounded-3xl p-1 flex flex-col justify-between overflow-hidden touch-none select-none overscroll-none"
      >
        <GhostGuideOverlay
          show={showGhostGuide && !solvedForGuide}
          label={
            isCountComplete && requireAnswerInput
              ? `Enter how many items you counted (${count}) in the box!`
              : `Tap each ${obj.label} one by one to count them!`
          }
          isDark={isDark}
          labelPlacement="top"
        />
        {!isPlayMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
            <div className="bg-violet-500/10 border border-violet-500/30 text-violet-500 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
              <Sparkles size={11} className="text-violet-500" />
              <span>Designer Mode</span>
            </div>
            <button
              onClick={reset}
              className="bg-white border border-slate-200 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>
        )}

        {/* Grid overlay in design mode */}
        {!isPlayMode && showGrid && (
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.15]">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="arr-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#arr-grid)" />
            </svg>
          </div>
        )}

        {/* Crosshairs alignment lines in design mode */}
        {!isPlayMode && draggedItem && dragPos && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ top: `${draggedItem.y + itemSize / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ left: `${draggedItem.x + itemSize / 2}px` }}
            />
          </>
        )}

        {/* Workspace Arena (Items) */}
        <div className="relative flex-1 w-full my-2 bg-transparent border-0 shadow-none">
          {items.map((item, idx) => {
            const isTapped = item.tapped;
            const tapSeq = tapOrder.indexOf(item.id);
            const assetType = question.config?.assetType || "emoji";
            const hasFrame = question.config.showItemFrame ?? true;
            const isDragging = draggedItemId === item.id;
            const isFirstHint = isPlayMode && tapOrder.length === 0 && idx === 0;

            let itemClassName = "flex flex-col items-center justify-center select-none touch-none rounded-2xl transition-all duration-200";
            if (isPlayMode) {
              itemClassName += isTapped ? " cursor-default" : " cursor-pointer active:scale-95";
            } else {
              itemClassName += " cursor-grab active:cursor-grabbing";
            }

            if (hasFrame) {
              itemClassName += isTapped
                ? ` ${itemTappedBg}`
                : ` ${itemUntappedBg}`;
              if (isDragging) itemClassName += " shadow-2xl ring-2 ring-indigo-400/30 scale-110 z-50";
              if (isFirstHint) itemClassName += " ring-2 ring-violet-500/40 animate-pulse";
            } else {
              itemClassName += isTapped
                ? " scale-95 opacity-85 drop-shadow"
                : " drop-shadow-sm hover:drop-shadow-md hover:scale-105";
              if (isDragging) itemClassName += " scale-125 drop-shadow-xl z-50";
              if (isFirstHint) itemClassName += " ring-2 ring-violet-500/30 rounded-2xl animate-pulse";
            }

            const transitionStyle = isDragging
              ? "none"
              : "left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.15s ease";

            return (
              <div
                key={item.id}
                onPointerDown={(e) => handlePointerDown(e, item.id)}
                style={{
                  position: "absolute",
                  left: `${item.x}px`,
                  top: `${item.y}px`,
                  width: `${itemSize}px`,
                  height: `${itemSize}px`,
                  zIndex: isDragging ? 50 : isTapped ? 10 : 20,
                  transition: transitionStyle
                }}
                className={itemClassName}
              >
                {/* Tapped Sequence Number Badge */}
                {isTapped && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 font-bold text-[10px] font-mono w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-scale-in border ${tappedBadgeBg}`}>
                    {tapSeq + 1}
                  </div>
                )}

                {/* Coordinate tooltip when dragging in design mode */}
                {!isPlayMode && isDragging && dragPos && (
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                    {item.x}, {item.y}
                  </div>
                )}

                <CountingAsset type={assetType as any} emoji={obj.emoji} size={isMobile ? 36 : 44} />
              </div>
            );
          })}
        </div>

        {/* CPA Abstract Progress Sequence Bar */}
        <div className={`py-2 px-4 rounded-2xl border flex flex-col items-center justify-center gap-1.5 z-20 ${trayBg}`}>
          <div className="flex items-center justify-between w-full">
            <span className={`text-[9px] font-bold font-mono uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-400"}`}>
              {tapOrder.length === count ? "✦ All Objects Accounted For!" : "Tap objects 1 by 1 in any arrangement:"}
            </span>
            <span className={`text-[9px] font-mono font-bold ${isDark ? "text-slate-400" : "text-slate-400"}`}>
              {tapOrder.length} of {count}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1.5 flex-wrap w-full">
            {Array.from({ length: count }).map((_, idx) => {
              const num = idx + 1;
              const isReached = num <= tapOrder.length;
              return (
                <div
                  key={idx}
                  className={`w-6 h-6 rounded-lg border text-xs flex items-center justify-center font-mono transition-all duration-300 ${
                    isReached ? seqActiveBg : seqPendingBg
                  }`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Answer Input Box Overlay after counting all items ── */}
        <AnimatePresence>
          {isPlayMode && requireAnswerInput && isCountComplete && (
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
                  How many {obj.label}{count === 1 ? "" : "s"} did you count in total?
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
                      : "bg-violet-600 hover:bg-violet-700 text-white"
                  }`}
                >
                  {answerStatus === "correct" ? <Check size={18} /> : "Check"}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowNumberPad(prev => !prev)}
                  className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
                    showNumberPad
                      ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-950 dark:border-violet-600 dark:text-violet-300"
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
