import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ListOrdered, Check, Calculator, AlertCircle, Delete } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { OBJECT_SIZE } from "./objectLayout";
import { Button } from "../ui";

interface LineUpItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  snappedSlotIndex: number | null;
}

const GRID_STEP = 20;
/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

export const LineUpCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [items, setItems] = useState<LineUpItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Answer Input State
  const [answerInput, setAnswerInput] = useState<string>("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "error" | "correct">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showNumberPad, setShowNumberPad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /** `null` until measured — nothing is placed against a guessed stage. */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  /** Height the answer panel takes off the bottom, once it is open. */
  const [panelHeight, setPanelHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const isLinedUpComplete = items.length > 0 && items.every(i => i.snappedSlotIndex !== null);
  const solvedForGuide = count > 0 && isLinedUpComplete && (requireAnswerInput ? answerStatus === "correct" : true);
  
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });

  // Measure before paint, then keep following the container.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const seed = container.getBoundingClientRect();
    setDimensions({ width: seed.width || 480, height: seed.height || 280 });
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 280
        });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const stageWidth = dimensions?.width ?? 480;
  const stageHeightAvailable = dimensions?.height ?? 280;

  const answerPanelOpen = isPlayMode && requireAnswerInput && isLinedUpComplete;
  /**
   * The answer box gets its own space at the bottom rather than floating over the
   * line-up: the child is being asked how many they lined up, so the line-up has
   * to stay in view while they answer.
   */
  const layoutHeight = Math.max(160, stageHeightAvailable - (answerPanelOpen ? panelHeight + 12 : 0));

  /**
   * Both rows sized from the space, not from a breakpoint.
   *
   * The old rule capped an object at 64px whatever the screen, which left a
   * classroom display showing a thin line of tiny objects across an empty band.
   * The width has to carry a row of `count` objects and the height has to carry
   * two bands of one, so the object is whichever of those two allows less —
   * bounded by the same limits every other canvas uses.
   */
  const geometry = useMemo(() => {
    const w = stageWidth;
    const h = layoutHeight;
    const isCompact = w < 640;
    const sideInset = isCompact ? 10 : 20;
    const captionH = isCompact ? 22 : 28;
    const zonePad = isCompact ? 12 : 16;
    const zoneGap = isCompact ? 10 : 16;
    const minGap = isCompact ? 6 : 10;

    const usableWidth = Math.max(OBJECT_SIZE.min, w - sideInset * 2);
    const widthCap = usableWidth / Math.max(1, count) / 1.16;      // one row, ~16% of an object between
    const heightCap = (h - zoneGap - 2 * (captionH + zonePad * 2)) / 2;   // two bands, one object tall each
    const unit = Math.round(
      Math.max(OBJECT_SIZE.min, Math.min(OBJECT_SIZE.max, Math.min(widthCap, heightCap)))
    );

    const trayHeight = Math.round(unit + captionH + zonePad * 2);
    const stageTop = trayHeight + zoneGap;
    const stageHeight = Math.max(unit + captionH + zonePad * 2, h - stageTop);

    const rowWidth = (gap: number) => count * unit + gap * Math.max(0, count - 1);
    const gapFor = (maxGap: number) => {
      const available = usableWidth - count * unit;
      return Math.max(minGap, Math.min(maxGap, available / Math.max(1, count - 1)));
    };

    // Gaps scale with the object, so a big object is not laid out on small-object spacing.
    const trayGap = gapFor(unit * 0.28);
    const slotGap = gapFor(unit * 0.45);

    return {
      isCompact,
      unit,
      captionH,
      trayHeight,
      trayItemY: Math.round(captionH + (trayHeight - captionH - unit) / 2),
      stageTop,
      stageHeight,
      slotY: Math.round(stageTop + captionH + (stageHeight - captionH - unit) / 2),
      trayStartX: Math.round((w - rowWidth(trayGap)) / 2),
      trayGap,
      slotStartX: Math.round((w - rowWidth(slotGap)) / 2),
      slotGap,
      snapRadius: Math.max(48, unit * 1.15)
    };
  }, [stageWidth, layoutHeight, count]);

  const getShelfX = useCallback(
    (idx: number) => Math.round(geometry.trayStartX + idx * (geometry.unit + geometry.trayGap)),
    [geometry]
  );

  const getSlotCenter = useCallback(
    (idx: number) => ({
      x: geometry.slotStartX + idx * (geometry.unit + geometry.slotGap) + geometry.unit / 2,
      y: geometry.slotY + geometry.unit / 2
    }),
    [geometry]
  );

  /**
   * Measure the answer panel instead of guessing: it grows by about half again
   * when the number pad opens, and the line-up above it moves up by exactly that.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!answerPanelOpen || !panel) {
      setPanelHeight(0);
      return;
    }
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setPanelHeight(entry.contentRect.height);
    });
    observer.observe(panel);
    setPanelHeight(panel.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [answerPanelOpen, showNumberPad]);

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

  // Initialize items
  useEffect(() => {
    const customPositions = question.config.customPositions || [];
    setItems(prev => {
      return Array.from({ length: count }).map((_, idx) => {
        const savedPos = customPositions.find(p => p.id === `lineup-item-${idx}`);
        const shelfX = getShelfX(idx);
        const existing = prev.find(i => i.id === `lineup-item-${idx}`);

        if (existing) {
          if (existing.snappedSlotIndex !== null) {
            const c = getSlotCenter(existing.snappedSlotIndex);
            return { ...existing, x: Math.round(c.x - geometry.unit / 2), y: Math.round(c.y - geometry.unit / 2) };
          }
          if (savedPos) return { ...existing, x: savedPos.x, y: savedPos.y, snappedSlotIndex: null };
          return { ...existing, x: shelfX, y: geometry.trayItemY };
        }

        return {
          id: `lineup-item-${idx}`,
          emoji: obj.emoji,
          x: savedPos ? savedPos.x : shelfX,
          y: savedPos ? savedPos.y : geometry.trayItemY,
          snappedSlotIndex: null
        };
      });
    });
  }, [question, count, geometry, getShelfX, getSlotCenter, obj.emoji]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);

    sounds.playPop();
    setItems(Array.from({ length: count }).map((_, idx) => ({
      id: `lineup-item-${idx}`,
      emoji: obj.emoji,
      x: getShelfX(idx),
      y: geometry.trayItemY,
      snappedSlotIndex: null
    })));
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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    let x = e.clientX - parentRect.left - dragOffset.current.x;
    let y = e.clientY - parentRect.top - dragOffset.current.y;

    x = Math.max(0, Math.min(parentRect.width - geometry.unit, x));
    y = Math.max(0, Math.min(parentRect.height - geometry.unit, y));

    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    if (isPlayMode) {
      const itemCenterX = x + geometry.unit / 2;
      const itemCenterY = y + geometry.unit / 2;
      let snapIdx: number | null = null;
      let minDistance = geometry.snapRadius;

      for (let i = 0; i < count; i++) {
        const c = getSlotCenter(i);
        const dist = Math.hypot(itemCenterX - c.x, itemCenterY - c.y);
        if (dist < minDistance) {
          const isOccupied = items.some(it => it.snappedSlotIndex === i && it.id !== draggedItemId);
          if (!isOccupied) {
            minDistance = dist;
            snapIdx = i;
          }
        }
      }
      setHoveredSlotIndex(snapIdx);
    }

    setItems(prev => prev.map(item =>
      item.id === draggedItemId ? { ...item, x: Math.round(x), y: Math.round(y), snappedSlotIndex: null } : item
    ));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const id = draggedItemId;

    if (isPlayMode) {
      setItems(prev => {
        const item = prev.find(i => i.id === id);
        if (!item) return prev;

        const itemCenterX = item.x + geometry.unit / 2;
        const itemCenterY = item.y + geometry.unit / 2;

        let snappedIndex: number | null = null;
        let minDistance = geometry.snapRadius;

        for (let i = 0; i < count; i++) {
          const c = getSlotCenter(i);
          const dist = Math.hypot(itemCenterX - c.x, itemCenterY - c.y);
          if (dist < minDistance) {
            const isOccupied = prev.some(it => it.snappedSlotIndex === i && it.id !== id);
            if (!isOccupied) {
              minDistance = dist;
              snappedIndex = i;
            }
          }
        }

        return prev.map(i => {
          if (i.id !== id) return i;
          if (snappedIndex !== null) {
            const c = getSlotCenter(snappedIndex);
            sounds.playTick(snappedIndex + 1);
            return {
              ...i,
              snappedSlotIndex: snappedIndex,
              x: Math.round(c.x - geometry.unit / 2),
              y: Math.round(c.y - geometry.unit / 2)
            };
          }
          if (i.snappedSlotIndex !== null) sounds.playSlide();
          const itemIdx = parseInt(id.split("-").pop() || "0");
          return { ...i, snappedSlotIndex: null, x: getShelfX(itemIdx), y: geometry.trayItemY };
        });
      });
    } else {
      setItems(prev => {
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: prev.map(item => ({ id: item.id, x: item.x, y: item.y }))
          });
        }
        return prev;
      });
    }

    setHoveredSlotIndex(null);
    setDraggedItemId(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
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
      setErrorMessage(`Not quite! You lined up ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`);
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

  // Success trigger
  useEffect(() => {
    if (isLinedUpComplete) {
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
  }, [items.map(i => i.snappedSlotIndex).join(","), requireAnswerInput, isLinedUpComplete]);

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const borderStyle = question.config.slotBorderStyle === "solid"
    ? "border-solid"
    : question.config.slotBorderStyle === "dotted"
      ? "border-dotted"
      : "border-dashed";

  const linedUp = items.filter(i => i.snappedSlotIndex !== null).length;
  const remaining = count - linedUp;
  const isSolved = solvedForGuide;
  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;

  // Slot numbers and ordinal badges track the object, like every other canvas.
  const badgeSize = Math.round(Math.max(18, Math.min(32, geometry.unit * 0.3)));
  const slotNumberSize = Math.round(Math.max(11, Math.min(28, geometry.unit * 0.26)));

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      accent={accent}
      headerIcon={<ListOrdered size={16} />}
      headerTitle="Line Up"
      headerSubtitle={
        isLinedUpComplete && requireAnswerInput
          ? "Line-up complete! Enter the total answer below."
          : `${linedUp} of ${count} lined up`
      }
      readAloudText={question.instruction || `Drag each ${obj.label} into the numbered slots, in order from 1 to ${count}.`}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? "All lined up" : `${remaining} to place`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset item positions">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      footerStatus={
        isSolved
          ? `Perfect line-up! All ${count} in order.`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag items to set their starting positions"
      }
      footerSolved={isSolved}
      designerHint="Drag items to set where they start in the tray."
    >
      <div
        ref={containerRef}
        className="relative flex-1 w-full min-h-[260px] sm:min-h-[300px] md:min-h-[340px] touch-none select-none overscroll-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Grid overlay */}
        {!isPlayMode && showGrid && (
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.15]">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="lineup-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#lineup-grid)" />
            </svg>
          </div>
        )}

        {/* Crosshair guides while dragging in design mode */}
        {!isPlayMode && draggedItem && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ top: `${draggedItem.y + geometry.unit / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ left: `${draggedItem.x + geometry.unit / 2}px` }}
            />
          </>
        )}

        {/* Zone 1 — the tray the objects start in */}
        <CanvasBin
          label={question.config.sourceBinLabel || "Tray"}
          tally={isPlayMode ? remaining : undefined}
          accent={accent}
          isDark={isDark}
          complete={isPlayMode && remaining === 0}
          className="left-0 right-0 pointer-events-none"
          /* Position inline: the bin's own `relative` class would otherwise win over
             an `absolute` utility, and these two bands are placed by measurement. */
          style={{ position: "absolute", top: 0, height: `${geometry.trayHeight}px` }}
        />

        {/* Idle hint — highlights the slot row after 10s of inactivity */}
        <GhostGuideOverlay
          show={showGhostGuide && !isSolved}
          label={
            isLinedUpComplete && requireAnswerInput
              ? `Enter how many items you lined up (${count}) in the box!`
              : `Drag each ${obj.label} into the numbered slots!`
          }
          isDark={isDark}
          labelPlacement="top"
          style={{ top: geometry.stageTop, left: 0, right: 0, height: geometry.stageHeight }}
        />

        {/* Zone 2 — the numbered line-up */}
        <CanvasBin
          label={question.config.destinationBinLabel || "Line-up"}
          tally={isPlayMode ? `${linedUp} / ${count}` : undefined}
          accent={accent}
          isDark={isDark}
          active={hoveredSlotIndex !== null}
          complete={isLinedUpComplete}
          className="left-0 right-0 pointer-events-none"
          style={{ position: "absolute", top: `${geometry.stageTop}px`, height: `${geometry.stageHeight}px` }}
        />

        {/* Numbered slots — the one place an outline is functional */}
        {Array.from({ length: count }).map((_, idx) => {
          const center = getSlotCenter(idx);
          const isFilled = items.some(item => item.snappedSlotIndex === idx);
          const isHovered = hoveredSlotIndex === idx;

          return (
            <div
              key={`slot-${idx}`}
              style={{
                position: "absolute",
                left: `${center.x - geometry.unit / 2}px`,
                top: `${center.y - geometry.unit / 2}px`,
                width: `${geometry.unit}px`,
                height: `${geometry.unit}px`
              }}
              className={`border-2 ${borderStyle} flex items-center justify-center transition-all duration-200 font-mono font-bold
                ${geometry.unit > 88 ? "rounded-3xl" : "rounded-2xl"}
                ${isHovered
                  ? `${accentChipClass(accent, isDark)} border-solid scale-110`
                  : isFilled
                    ? "border-transparent"
                    : emptySlotClass(isDark)
                }`}
            >
              {(question.config.showNumbersInSlots ?? true) && (
                <span
                  className={isFilled ? "opacity-0" : ""}
                  style={{ fontSize: `${slotNumberSize}px` }}
                >
                  {idx + 1}
                </span>
              )}
            </div>
          );
        })}

        {/* Draggable items */}
        {items.map(item => {
          const assetType = question.config?.assetType || "emoji";
          const isDragging = draggedItemId === item.id;
          const hasFrame = question.config.showItemFrame ?? true;
          const isPlaced = item.snappedSlotIndex !== null;

          let itemClassName = `flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing transition-transform ${geometry.unit > 88 ? "rounded-3xl" : "rounded-2xl"}`;
          if (hasFrame) {
            itemClassName += ` ${isPlaced ? accentChipClass(accent, isDark) : surfaceClass(isDark, "raised")} ${isPlaced ? "border-2" : "border-0"}`;
          }
          itemClassName += isDragging ? " scale-110 drop-shadow-xl" : " drop-shadow-sm";

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
                width: `${geometry.unit}px`,
                height: `${geometry.unit}px`,
                zIndex: isDragging ? 50 : 20,
                transition: transitionStyle
              }}
              className={itemClassName}
            >
              {/* Ordinal badge once placed — reinforces the 1..n counting order */}
              {isPlaced && (
                <div
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 font-mono font-bold flex items-center justify-center rounded-full animate-scale-in z-10 ${accentChipClass(accent, isDark)}`}
                  style={{
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                    fontSize: `${Math.round(badgeSize * 0.52)}px`
                  }}
                >
                  {(item.snappedSlotIndex ?? 0) + 1}
                </div>
              )}

              {/* Coordinate tooltip while dragging in design mode */}
              {!isPlayMode && isDragging && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {item.x}, {item.y}
                </div>
              )}

              <CountingAsset type={assetType as any} emoji={item.emoji} size={Math.round(geometry.unit * (hasFrame ? 0.7 : 0.92))} />
            </div>
          );
        })}

        {/* ── Answer Input Box Overlay after lining up all items ── */}
        <AnimatePresence>
          {isPlayMode && requireAnswerInput && isLinedUpComplete && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-x-2 bottom-2 z-50 flex flex-col items-center justify-center p-3 sm:p-4 md:p-5
                rounded-2xl md:rounded-3xl backdrop-blur-md border shadow-2xl max-w-lg md:max-w-xl mx-auto"
              style={{
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
                borderColor: answerStatus === "error" 
                  ? "#ef4444" 
                  : answerStatus === "correct" 
                  ? "#10b981" 
                  : isDark ? "#334155" : "#cbd5e1"
              }}
            >
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <span className="text-xl md:text-2xl">🎉</span>
                <span className={`text-xs sm:text-sm md:text-base lg:text-lg font-extrabold tracking-tight ${
                  isDark ? "text-slate-100" : "text-slate-800"
                }`}>
                  How many {obj.label}{count === 1 ? "" : "s"} did you line up in total?
                </span>
              </div>

              {/* Answer Input Controls */}
              <div className="flex items-center gap-2 md:gap-3 w-full justify-center max-w-xs md:max-w-sm">
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
                    className={`w-full h-11 md:h-14 px-3 text-center text-lg sm:text-xl md:text-2xl font-bold font-mono rounded-xl border-2 transition-all outline-none ${
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
                  className={`h-11 md:h-14 px-4 md:px-6 text-sm md:text-base font-bold flex items-center gap-1.5 rounded-xl shadow-md transition-all active:scale-95 ${
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
                  className={`h-11 w-11 md:h-14 md:w-14 flex-shrink-0 flex items-center justify-center rounded-xl border transition-all ${
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
                    <div className="grid grid-cols-5 gap-1.5 md:gap-2 w-full max-w-xs md:max-w-sm">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleDigitPress(String(num))}
                          className={`h-9 md:h-12 font-mono text-base md:text-xl font-extrabold rounded-lg md:rounded-xl border shadow-sm transition-all active:scale-95 ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 w-full max-w-xs md:max-w-sm">
                      <button
                        type="button"
                        onClick={handleBackspacePress}
                        className={`flex-1 h-8 md:h-10 text-xs md:text-sm font-extrabold rounded-lg border flex items-center justify-center gap-1 transition-all ${
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
                        className={`px-3 md:px-5 h-8 md:h-10 text-xs md:text-sm font-extrabold rounded-lg border transition-all ${
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
