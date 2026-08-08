import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Grid2X2, PartyPopper } from "lucide-react";
import { CanvasProps } from "./types";
import { CanvasAnswerPanel, useCanvasAnswer } from "./CanvasAnswerPanel";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { useCanvasAudience } from "./presentation";
import { Button } from "../ui";

import { OBJECT_SIZE, Rect, contentZone, relativeRect, slotPosition } from "./objectLayout";
import { objectStyle } from "./objectMotion";

interface TenFrameDot {
  id: string;
  emoji: string;
  x: number;
  y: number;
  snappedCell: { frameIdx: number; cellIdx: number } | null;
}

interface CellRef {
  frameIdx: number;
  cellIdx: number;
}

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

const GRID_STEP = 20;

export const GroupTensCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [dots, setDots] = useState<TenFrameDot[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  /** Which bin the drag is currently over — `-1` is the shelf, otherwise a frame index. */
  const [activeZone, setActiveZone] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellRef | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  /** Where the pointer went down, and whether it has travelled far enough to be a drag. */
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cellRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /**
   * `null` until the stage has actually been measured.
   *
   * Dots are positioned in stage pixels, so laying them out against a guessed
   * size and correcting later drops them outside the shelf.
   */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const isCompact = stageWidth < 640;

  const snappedList = dots.filter(d => d.snappedCell !== null);
  const isGroupTensComplete = snappedList.length === count && count > 0;
  const answerPanelOpen = isPlayMode && requireAnswerInput && isGroupTensComplete;

  // Typing, checking and the success hand-off all live in the shared panel.
  const answer = useCanvasAnswer({
    expected: count,
    resetKey: `${question.id}:${count}`,
    wrongMessage: `Not quite! You grouped ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`,
    onSuccess,
    open: answerPanelOpen
  });

  const solvedForGuide = isGroupTensComplete && (requireAnswerInput ? answer.solved : true);

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });
  const { learnerMode } = useCanvasAudience();

  // Measure the stage before paint so the first layout is the real one.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const seed = container.getBoundingClientRect();
    setDimensions({
      width: seed.width || 480,
      height: seed.height || 320
    });
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 320
        });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const frameCount = count > 10 ? 2 : 1;

  /**
   * Every size on this canvas comes from the room the stage actually has.
   *
   * The dot is sized *first*, from what all three of its masters can afford — a
   * ten-frame cell, a row on the shelf, and the height left over once both bands
   * have paid for their own chrome — and the shelf is then sized to hold it.
   * Handing the shelf a flat share of the stage instead is what left it with a
   * content area a few pixels tall, and every dot at the minimum size.
   */
  const geometry = useMemo(() => {
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;
    /** What a band spends on its own caption and padding before an object fits. */
    const chrome = captionH + pad * 2;
    const framesStacked = isCompact && frameCount > 1;

    const usableWidth = Math.max(OBJECT_SIZE.min, stageWidth - pad * 2);
    const frameWidth = framesStacked || frameCount === 1 ? usableWidth : (usableWidth - gap) / 2;

    // A ten-frame is always 5 × 2, so its cell is not a `bestGrid` question.
    const widthCap = frameWidth / 5 / 1.16;
    // A narrow stage lets the shelf run to two rows rather than shrinking every
    // dot to fit one — `slotPosition` wraps them there anyway.
    const shelfWidthCap = usableWidth / Math.ceil(count / (isCompact ? 2 : 1)) / 1.28;
    // Two cell rows per frame — twice over when the frames stack — plus one row
    // of loose dots on the shelf, plus each band's chrome.
    const heightCap = framesStacked
      ? (stageHeight - 3 * chrome - 2 * gap) / 6.2
      : (stageHeight - 2 * chrome - gap) / 3.6;

    const dotSize = Math.round(
      Math.max(OBJECT_SIZE.min, Math.min(OBJECT_SIZE.max, widthCap, shelfWidthCap, heightCap))
    );

    // Below the floor a single row stops fitting, so the dots wrap — and the
    // shelf has to be tall enough for the rows `slotPosition` will actually make.
    const columns = Math.max(1, Math.min(count, Math.floor(usableWidth / (dotSize * 1.28))));
    const rows = Math.ceil(count / columns);
    const shelfHeight = Math.round(
      Math.min(stageHeight * 0.42, dotSize + (rows - 1) * dotSize * 1.28 + chrome)
    );

    return {
      gap,
      captionH,
      framesStacked,
      shelfHeight,
      dotSize,
      cellSize: Math.round(dotSize * 1.16),
      snapRadius: Math.max(40, dotSize * 0.9)
    };
  }, [stageWidth, stageHeight, isCompact, frameCount, count]);

  const { dotSize, cellSize } = geometry;
  const hasFrame = question.config.showItemFrame ?? true;
  const assetSize = Math.round(dotSize * (hasFrame ? 0.7 : 0.92));
  const customPositionKey = JSON.stringify(question.config.customPositions || []);

  /** The shelf's content area, in stage pixels. Measured, with a sane fallback. */
  const shelfZone = useCallback((): Rect => {
    const stageRect = containerRef.current?.getBoundingClientRect();
    if (stageRect && shelfRef.current) {
      return contentZone(relativeRect(shelfRef.current, stageRect), dotSize, geometry.captionH);
    }
    return {
      left: 0,
      top: Math.max(0, stageHeight - geometry.shelfHeight) + geometry.captionH,
      width: Math.max(dotSize, stageWidth),
      height: Math.max(dotSize, geometry.shelfHeight - geometry.captionH - 12)
    };
  }, [dotSize, geometry.shelfHeight, geometry.captionH, stageWidth, stageHeight]);

  /** Where the `order`-th loose dot sits on the shelf. */
  const shelfSlot = useCallback(
    (order: number) => slotPosition(order, count, shelfZone(), dotSize),
    [count, shelfZone, dotSize]
  );

  /** Top-left a dot needs to sit centred in a ten-frame cell. */
  const cellOrigin = useCallback((cell: CellRef) => {
    const target = cellRefs.current[`${cell.frameIdx}-${cell.cellIdx}`];
    const stageRect = containerRef.current?.getBoundingClientRect();
    if (!target || !stageRect) return null;
    const rect = target.getBoundingClientRect();
    return {
      x: Math.round(rect.left - stageRect.left + rect.width / 2 - dotSize / 2),
      y: Math.round(rect.top - stageRect.top + rect.height / 2 - dotSize / 2)
    };
  }, [dotSize]);

  // Reset answer state on question change
  useEffect(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [question.id, count]);

  const prevQuestionId = useRef(question.id);
  const prevObjectId = useRef(question.objectId);
  const prevCount = useRef(count);

  /** Stage the current dot coordinates were laid out against. */
  const laidOutAt = useRef<{ width: number; height: number; stacked: boolean } | null>(null);

  // Responsive dot placement & rescaling on resize / orientation change
  useEffect(() => {
    if (!dimensions) return;

    const previous = laidOutAt.current;
    laidOutAt.current = { width: stageWidth, height: stageHeight, stacked: geometry.framesStacked };

    // Frames that flip from side-by-side to stacked have moved somewhere a
    // proportional nudge cannot follow, so loose dots are re-slotted onto the
    // shelf. An ordinary resize only scales them.
    const flipped = previous ? previous.stacked !== geometry.framesStacked : false;
    const resizeX = previous?.width ? stageWidth / previous.width : 1;
    const resizeY = previous?.height ? stageHeight / previous.height : 1;
    const resized = !flipped && (resizeX !== 1 || resizeY !== 1);

    setDots(prev => {
      const customPositions = (isCompact && isPlayMode) ? [] : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? stageWidth / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? stageHeight / layoutReference.height : 1;

      const questionChanged = prevQuestionId.current !== question.id || prevObjectId.current !== question.objectId || prevCount.current !== count;

      // Re-slotting reads the child's progress, not the dot index: loose dots
      // close up on the shelf rather than leaving a hole where a grouped one was.
      let looseSeen = 0;

      const newDots: TenFrameDot[] = Array.from({ length: count }).map((_, idx) => {
        const itemId = `tenframe-dot-${idx}`;
        const existing = prev.find(d => d.id === itemId);

        if (existing && !questionChanged) {
          if (existing.snappedCell !== null) {
            const origin = cellOrigin(existing.snappedCell);
            return origin ? { ...existing, ...origin } : existing;
          }

          looseSeen += 1;
          if (flipped) return { ...existing, ...shelfSlot(looseSeen) };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(stageWidth - dotSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(stageHeight - dotSize, existing.y * resizeY)))
          };
        }

        const savedPos = customPositions.find(p => p.id === itemId);
        looseSeen += 1;
        const defaultPos = shelfSlot(looseSeen);

        return {
          id: itemId,
          emoji: obj.emoji,
          x: savedPos ? Math.round(savedPos.x * scaleX) : defaultPos.x,
          y: savedPos ? Math.round(savedPos.y * scaleY) : defaultPos.y,
          snappedCell: null
        };
      });

      if (questionChanged) {
        prevQuestionId.current = question.id;
        prevObjectId.current = question.objectId;
        prevCount.current = count;
      }

      return newDots;
    });
  }, [question.id, question.objectId, count, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isCompact, geometry.framesStacked, dotSize, shelfSlot, cellOrigin, obj.emoji, stageWidth, stageHeight]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    answer.reset();
    sounds.playPop();

    const updated = dots.map((dot, idx) => ({
      ...dot,
      ...shelfSlot(idx + 1),
      snappedCell: null
    }));
    setDots(updated);

    if (!isPlayMode && onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: updated.map(dot => ({ id: dot.id, x: dot.x, y: dot.y })),
        layoutReference: {
          width: containerRef.current?.clientWidth || stageWidth,
          height: containerRef.current?.clientHeight || stageHeight
        }
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    reportActivity();
    sounds.playPop();
    setActiveDragId(id);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!containerRef.current) return;

    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    stageBox.current = containerRef.current.getBoundingClientRect();
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;

    containerRef.current.setPointerCapture(e.pointerId);
  };

  /** The free cell a dot at this position would snap into, if any. */
  const nearestFreeCell = useCallback((x: number, y: number, dragId: string, current: TenFrameDot[]): CellRef | null => {
    const stageRect = containerRef.current?.getBoundingClientRect();
    if (!stageRect) return null;

    const centerX = x + dotSize / 2;
    const centerY = y + dotSize / 2;
    let closest: CellRef | null = null;
    let minDistance = geometry.snapRadius;

    for (const key in cellRefs.current) {
      const cell = cellRefs.current[key];
      if (!cell) continue;

      const cellRect = cell.getBoundingClientRect();
      const cellCenterX = cellRect.left - stageRect.left + cellRect.width / 2;
      const cellCenterY = cellRect.top - stageRect.top + cellRect.height / 2;
      const dist = Math.hypot(centerX - cellCenterX, centerY - cellCenterY);
      if (dist >= minDistance) continue;

      const [frameIdxStr, cellIdxStr] = key.split("-");
      const frameIdx = parseInt(frameIdxStr, 10);
      const cellIdx = parseInt(cellIdxStr, 10);

      const isOccupied = current.some(
        d => d.id !== dragId && d.snappedCell?.frameIdx === frameIdx && d.snappedCell?.cellIdx === cellIdx
      );
      if (isOccupied) continue;

      minDistance = dist;
      closest = { frameIdx, cellIdx };
    }

    return closest;
  }, [dotSize, geometry.snapRadius]);

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!activeDragId) return;
    const stageRect = stageBox.current;
    if (!stageRect) return;

    // A tap is not a drag: a child pressing a dot to hear it should not have it
    // slide anywhere, and 4px of hand tremor is a press.
    if (!dragMoved.current && pressOrigin.current) {
      const travelled = Math.hypot(e.clientX - pressOrigin.current.x, e.clientY - pressOrigin.current.y);
      if (travelled > 4) dragMoved.current = true;
    }

    let x = e.clientX - stageRect.left - dragOffset.current.x;
    let y = e.clientY - stageRect.top - dragOffset.current.y;

    x = Math.max(0, Math.min(stageRect.width - dotSize, x));
    y = Math.max(0, Math.min(stageRect.height - dotSize, y));

    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    x = Math.round(x);
    y = Math.round(y);
    setDragPos({ x, y });

    if (isPlayMode) {
      const centerX = x + dotSize / 2;
      const centerY = y + dotSize / 2;
      const inZone = (element: HTMLElement | null | undefined) => {
        if (!element) return false;
        const zone = relativeRect(element, stageRect);
        return (
          centerX >= zone.left &&
          centerX <= zone.left + zone.width &&
          centerY >= zone.top &&
          centerY <= zone.top + zone.height
        );
      };

      const frameIdx = frameRefs.current.findIndex((frame, idx) => idx < frameCount && inZone(frame));
      setActiveZone(frameIdx >= 0 ? frameIdx : inZone(shelfRef.current) ? -1 : null);
      setHoveredCell(nearestFreeCell(x, y, activeDragId, dots));
    }

    setDots(prev => prev.map(item =>
      item.id === activeDragId ? { ...item, x, y, snappedCell: null } : item
    ));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!activeDragId) return;
    const dragId = activeDragId;

    if (isPlayMode) {
      setDots(prev => {
        const item = prev.find(d => d.id === dragId);
        if (!item) return prev;

        const target = nearestFreeCell(item.x, item.y, dragId, prev);
        const origin = target ? cellOrigin(target) : null;

        if (target && origin) {
          sounds.playTick(target.frameIdx * 10 + target.cellIdx + 1);
        } else if (dragMoved.current) {
          // Missed the frames. A tap that went nowhere gets no sound at all.
          sounds.playSlide();
        }

        const settled = prev.map(d => {
          if (d.id !== dragId) return d;
          return target && origin ? { ...d, ...origin, snappedCell: target } : { ...d, snappedCell: null };
        });

        /*
          Re-flow the whole shelf, not just the dot that was released: placing it
          on its own left it on top of whichever dot already sat at that slot, and
          left holes in the group a child is supposed to be able to count.
        */
        let rank = 0;
        return settled.map(d => {
          if (d.snappedCell !== null) return d;
          rank += 1;
          return { ...d, ...shelfSlot(rank) };
        });
      });
    } else {
      setDots(prev => {
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: prev.map(item => ({ id: item.id, x: item.x, y: item.y })),
            layoutReference: {
              width: containerRef.current?.clientWidth || stageWidth,
              height: containerRef.current?.clientHeight || stageHeight
            }
          });
        }
        return prev;
      });
    }

    setActiveDragId(null);
    setDragPos(null);
    setActiveZone(null);
    setHoveredCell(null);
    pressOrigin.current = null;
    dragMoved.current = false;
    stageBox.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!activeDragId) return;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    setActiveDragId(null);
    setDragPos(null);
    setActiveZone(null);
    setHoveredCell(null);
    pressOrigin.current = null;
    dragMoved.current = false;
    stageBox.current = null;
  };


  const frame1Count = snappedList.filter(d => d.snappedCell!.frameIdx === 0).length;
  const frame2Count = snappedList.filter(d => d.snappedCell!.frameIdx === 1).length;

  const hasTriggeredSuccess = useRef(false);

  useEffect(() => {
    if (isGroupTensComplete) {
      if (!requireAnswerInput) {
        if (!hasTriggeredSuccess.current) {
          hasTriggeredSuccess.current = true;
          sounds.playSuccess();
          if (onSuccess) onSuccess();
        }
      }
    } else {
      hasTriggeredSuccess.current = false;
    }
  }, [snappedList.length, requireAnswerInput, isGroupTensComplete]);

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const draggedDot = activeDragId ? dots.find(d => d.id === activeDragId) : null;

  const isSolved = solvedForGuide;
  const remaining = count - snappedList.length;
  const tens = frame1Count === 10 ? 1 : 0;
  const ones = snappedList.length - tens * 10;

  // Bin names come from the slide when a teacher set them; the fallbacks are the
  // instruction itself, so a child who cannot yet read "shelf" still knows which
  // box is which.
  const shelfLabel = question.config.sourceBinLabel || (learnerMode ? "Group these" : "Shelf");

  const renderFrame = (frameIdx: number, label: string, filled: number, numberBase: number, capacity: number) => (
    <CanvasBin
      ref={el => { frameRefs.current[frameIdx] = el; }}
      label={frameIdx === 0 ? (question.config.destinationBinLabel || label) : label}
      tally={isPlayMode ? `${filled} / 10` : undefined}
      accent={accent}
      isDark={isDark}
      active={activeZone === frameIdx}
      complete={filled >= capacity}
      className="pointer-events-none"
    >
      {/*
        The cells are the invitation here, so the bin gets no empty hint — a
        dashed ten-frame already says "one object per box" better than a caption.
      */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          {Array.from({ length: 10 }).map((_, cellIdx) => {
            const key = `${frameIdx}-${cellIdx}`;
            const isCellFilled = dots.some(d => d.snappedCell?.frameIdx === frameIdx && d.snappedCell?.cellIdx === cellIdx);
            const isHovered = hoveredCell?.frameIdx === frameIdx && hoveredCell?.cellIdx === cellIdx;
            return (
              <div
                key={key}
                ref={el => { cellRefs.current[key] = el; }}
                style={{ width: `${cellSize}px`, height: `${cellSize}px` }}
                className={`rounded-xl border-2 flex items-center justify-center transition-all duration-200 relative
                  ${isCellFilled
                    ? "border-transparent"
                    : isHovered
                      ? `border-solid scale-105 ${accentChipClass(accent, isDark)}`
                      : `border-dashed ${emptySlotClass(isDark)}`}`}
              >
                {!isCellFilled && (question.config.showNumbersInSlots ?? true) && (
                  <span className="font-mono text-[9px] font-bold select-none opacity-60">{numberBase + cellIdx}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </CanvasBin>
  );

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      gridSize={GRID_STEP}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<Grid2X2 size={16} />}
      headerTitle="Group Tens"
      headerSubtitle={
        isGroupTensComplete && requireAnswerInput
          ? "Grouping complete! Enter the total answer below."
          : `${tens} ten + ${ones} ${ones === 1 ? "one" : "ones"} = ${snappedList.length}`
      }
      readAloudText={question.instruction || `Group ${count} ${obj.label} into tens. Fill the ten-frame first, then place the extra ones.`}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? "All grouped" : `${remaining} to group`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset object positions">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      footerStatus={
        isSolved
          ? `${tens} ten and ${ones} ${ones === 1 ? "one" : "ones"} makes ${count}!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag objects to set their starting positions"
      }
      footerSolved={isSolved}
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        /*
          `flex-1` is what makes this fill a launcher, so the shelf below stays
          modest on purpose: a taller shelf than the window can give overflows
          the layout's `min-h-0` parent and pushes the frames off the stage.
        */
        className="relative flex-1 w-full flex flex-col items-stretch min-h-[280px] sm:min-h-[320px] md:min-h-[360px] touch-none select-none overscroll-none"
        style={{ gap: `${geometry.gap}px` }}
      >
        {/* Crosshair alignment guides on active drag */}
        {!isPlayMode && draggedDot && dragPos && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ top: `${draggedDot.y + dotSize / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ left: `${draggedDot.x + dotSize / 2}px` }}
            />
          </>
        )}

        {/* Ten-frames — stacked on a narrow stage, side-by-side above */}
        <div
          className={`relative flex ${geometry.framesStacked ? "flex-col" : "flex-row"} items-stretch min-h-0 flex-1`}
          style={{ gap: `${geometry.gap}px` }}
        >
          <GhostGuideOverlay
            show={showGhostGuide && !isSolved}
            label={
              isGroupTensComplete && requireAnswerInput
                ? `Enter how many items you grouped (${count}) in the box!`
                : "Drag items up into the ten-frame!"
            }
            isDark={isDark}
            labelPlacement="top"
          />
          {renderFrame(0, "Tens", frame1Count, 1, Math.min(10, count))}
          {frameCount > 1 && renderFrame(1, "Ones", frame2Count, 11, count - 10)}
        </div>

        {/* Shelf — the objects still to group */}
        <CanvasBin
          ref={shelfRef}
          label={shelfLabel}
          tally={isPlayMode ? remaining : undefined}
          accent={accent}
          isDark={isDark}
          active={activeZone === -1}
          complete={isPlayMode && remaining === 0}
          isEmpty={isPlayMode && remaining === 0}
          emptyIcon={<PartyPopper size={22} />}
          // Suppressed once the answer panel docks here, or the two would stack up.
          emptyHint={isPlayMode && !answerPanelOpen ? "All grouped!" : undefined}
          style={{ flex: `0 0 ${geometry.shelfHeight}px` }}
        />

        {/* Draggable dots */}
        {dots.map(dot => {
          const assetType = question.config?.assetType || "emoji";
          const isDragging = activeDragId === dot.id;
          const isSnapped = dot.snappedCell !== null;

          let dotClassName = "flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing select-none touch-none transition-transform outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40";
          if (hasFrame) {
            dotClassName += isSnapped
              ? ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
          }
          dotClassName += isDragging ? " scale-125 drop-shadow-xl z-50" : " drop-shadow-sm";

          return (
            <div
              key={dot.id}
              role="button"
              tabIndex={0}
              aria-label={`${isSnapped ? "Grouped" : "Loose"} ${obj.label}. Drag into the ten-frame.`}
              onPointerDown={(e) => handlePointerDown(e, dot.id)}
              style={objectStyle({ x: dot.x, y: dot.y, size: dotSize, dragging: isDragging })}
              className={dotClassName}
            >
              {/* Coordinate tooltip when dragging in design mode */}
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {dot.x}, {dot.y}
                </div>
              )}
              <CountingAsset type={assetType as any} emoji={dot.emoji} size={assetSize} />
            </div>
          );
        })}

        <CanvasAnswerPanel
          answer={answer}
          open={answerPanelOpen}
          isDark={isDark}
          prompt={`How many ${obj.label}${count === 1 ? "" : "s"} did you group in total?`}
        />
      </div>
    </SharedCanvasLayout>
  );
};
