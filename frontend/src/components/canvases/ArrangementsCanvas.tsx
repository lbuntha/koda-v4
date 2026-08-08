import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, LayoutGrid } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { CanvasAnswerPanel, useCanvasAnswer } from "./CanvasAnswerPanel";
import { useCanvasAudience } from "./presentation";
import { Button } from "../ui";

import { OBJECT_SIZE, Rect, contentZone } from "./objectLayout";
import { oneToOneLayout, type OneToOnePattern } from "./oneToOneLayout";
import { objectStyle } from "./objectMotion";

interface ArrangementItem {
  id: string;
  x: number;
  y: number;
  tapped: boolean;
}

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  violet: "violet",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

/** Every arrangement a slide may ask for, and how a child hears it named. */
const PATTERN_LABELS: Record<OneToOnePattern, string> = {
  grid: "Grid Arrangement",
  columns: "Column Arrangement",
  pairs: "Paired Arrangement",
  line: "Line Arrangement",
  circle: "Curved Arrangement",
  ring: "Ring Arrangement",
  wave: "Wave Arrangement",
  dice: "Dice Arrangement",
  scatter: "Scattered Arrangement"
};

const GRID_STEP = 20;

export const ArrangementsCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const pattern: OneToOnePattern = PATTERN_LABELS[question.config.pattern as OneToOnePattern]
    ? (question.config.pattern as OneToOnePattern)
    : "scatter";
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [items, setItems] = useState<ArrangementItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tapOrder, setTapOrder] = useState<string[]>([]);

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /** `null` until the stage has actually been measured. */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const isCompact = stageWidth < 640;

  const isCountComplete = count > 0 && tapOrder.length === count;
  const answerPanelOpen = isPlayMode && requireAnswerInput && isCountComplete;

  // Typing, checking and the success hand-off all live in the shared panel.
  const answer = useCanvasAnswer({
    expected: count,
    resetKey: `${question.id}:${count}`,
    wrongMessage: `Not quite! There are ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`,
    onSuccess,
    open: answerPanelOpen
  });

  const solvedForGuide = count > 0 && isCountComplete && (requireAnswerInput ? answer.solved : true);

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });
  const { learnerMode } = useCanvasAudience();

  // Measure before paint so the first layout is the real one.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const seed = container.getBoundingClientRect();
    setDimensions({ width: seed.width || 480, height: seed.height || 320 });
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

  /**
   * The arena, the strip beneath it, and where every object sits.
   *
   * The arrangement itself comes from `oneToOneLayout` — the shared module that
   * places a pattern's centres first and lets the tightest gap between any two
   * of them decide how big an object may be. This canvas used to carry its own
   * copy: a hardcoded 52/64px object, per-pattern pixel spacings, and a table of
   * ten scatter coordinates that a slide asking for twelve wrapped straight back
   * round, so objects 11 and 12 sat exactly on top of 1 and 2.
   */
  const geometry = useMemo(() => {
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;
    /** What a band spends on its own caption and padding before anything fits. */
    const chrome = captionH + pad * 2;

    // The strip is a readout of numbers, so it takes a row of chips and no more.
    const chipSize = isCompact ? 22 : 26;
    const chipsPerRow = Math.max(1, Math.floor((stageWidth - pad * 2) / (chipSize + 6)));
    const chipRows = Math.min(3, Math.ceil(count / chipsPerRow));
    const stripHeight = Math.round(
      Math.min(stageHeight * 0.32, chrome + chipRows * (chipSize + 6))
    );
    const arenaHeight = Math.max(chrome + OBJECT_SIZE.min, stageHeight - stripHeight - gap);

    const arena: Rect = { left: 0, top: 0, width: stageWidth, height: arenaHeight };
    const zone = contentZone(arena, OBJECT_SIZE.min, captionH);

    const layout = oneToOneLayout({
      count,
      width: zone.width,
      height: zone.height,
      pattern,
      gridColumns: question.config.gridColumns,
      padding: isCompact ? 8 : 14
    });

    return {
      gap,
      chipSize,
      stripHeight,
      itemSize: layout.size,
      // `oneToOneLayout` works in its own box; lift it into stage coordinates.
      positions: layout.positions.map(p => ({ x: p.x + zone.left, y: p.y + zone.top }))
    };
  }, [stageWidth, stageHeight, isCompact, count, pattern, question.config.gridColumns]);

  const { itemSize } = geometry;
  const hasFrame = question.config.showItemFrame ?? true;
  const showTapNumbers = question.config.showNumbersOnTap ?? true;
  const assetSize = Math.round(itemSize * (hasFrame ? 0.7 : 0.92));
  const customPositionKey = JSON.stringify(question.config.customPositions || []);

  // Reset progress on question change
  useEffect(() => {
    setTapOrder([]);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [question.id, count]);

  const prevQuestionId = useRef(question.id);
  const prevObjectId = useRef(question.objectId);
  const prevCount = useRef(count);
  const prevPattern = useRef(pattern);

  /** Stage the current coordinates were laid out against. */
  const laidOutAt = useRef<{ width: number; height: number; compact: boolean } | null>(null);

  // Responsive placement & rescaling on resize / orientation change
  useEffect(() => {
    if (!dimensions) return;

    const previous = laidOutAt.current;
    laidOutAt.current = { width: stageWidth, height: stageHeight, compact: isCompact };

    const flipped = previous ? previous.compact !== isCompact : false;
    const resizeX = previous?.width ? stageWidth / previous.width : 1;
    const resizeY = previous?.height ? stageHeight / previous.height : 1;
    const resized = !flipped && (resizeX !== 1 || resizeY !== 1);

    setItems(prev => {
      const customPositions = (isCompact && isPlayMode) ? [] : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? stageWidth / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? stageHeight / layoutReference.height : 1;

      const questionChanged = prevQuestionId.current !== question.id
        || prevObjectId.current !== question.objectId
        || prevCount.current !== count
        || prevPattern.current !== pattern;

      const next: ArrangementItem[] = Array.from({ length: count }).map((_, idx) => {
        const itemId = `arr-item-${idx}`;
        const existing = prev.find(i => i.id === itemId);
        const arranged = geometry.positions[idx] || { x: 0, y: 0 };

        if (existing && !questionChanged) {
          // An arrangement is the point of this activity, so a teacher's own
          // placement is kept and only rescaled; everything else re-arranges.
          const saved = customPositions.find(p => p.id === itemId);
          if (!saved) return { ...existing, ...arranged };
          if (flipped) return { ...existing, ...arranged };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(stageWidth - itemSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(stageHeight - itemSize, existing.y * resizeY)))
          };
        }

        const saved = customPositions.find(p => p.id === itemId);
        return {
          id: itemId,
          x: saved ? Math.round(saved.x * scaleX) : arranged.x,
          y: saved ? Math.round(saved.y * scaleY) : arranged.y,
          tapped: false
        };
      });

      if (questionChanged) {
        prevQuestionId.current = question.id;
        prevObjectId.current = question.objectId;
        prevCount.current = count;
        prevPattern.current = pattern;
      }

      return next;
    });
  }, [question.id, question.objectId, count, pattern, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isCompact, itemSize, geometry.positions, stageWidth, stageHeight]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setTapOrder([]);
    answer.reset();
    sounds.playPop();

    setItems(prev => prev.map((item, idx) => ({
      ...item,
      ...(geometry.positions[idx] || { x: item.x, y: item.y }),
      tapped: false
    })));

    // Back to the arrangement the slide asks for: a teacher's overrides are what
    // "reset" is for in design mode.
    if (!isPlayMode) {
      onUpdateQuestionConfig?.({ customPositions: [], layoutReference: undefined } as any);
    }
  };

  const handleTap = (id: string) => {
    if (!isPlayMode) return;
    reportActivity();
    const item = items.find(i => i.id === id);
    if (!item || item.tapped) return;

    setTapOrder(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      sounds.playTick(next.length);

      if (next.length === count && count > 0) {
        // With an answer required, the panel takes over — including focusing itself.
        if (!requireAnswerInput) {
          successTimeoutRef.current = setTimeout(() => {
            sounds.playSuccess();
            onSuccessRef.current?.();
            successTimeoutRef.current = null;
          }, 300);
        }
      }
      return next;
    });
    setItems(prev => prev.map(i => (i.id === id ? { ...i, tapped: true } : i)));
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlayMode) {
      handleTap(id);
      return;
    }
    if (e.button !== 0) return;
    sounds.playPop();
    setDraggedItemId(id);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!containerRef.current) return;

    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    stageBox.current = containerRef.current.getBoundingClientRect();

    containerRef.current.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const stageRect = stageBox.current;
    if (!stageRect) return;

    let x = e.clientX - stageRect.left - dragOffset.current.x;
    let y = e.clientY - stageRect.top - dragOffset.current.y;

    x = Math.max(0, Math.min(stageRect.width - itemSize, x));
    y = Math.max(0, Math.min(stageRect.height - itemSize, y));

    if (showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    x = Math.round(x);
    y = Math.round(y);
    setDragPos({ x, y });

    setItems(prev => prev.map(item => (item.id === draggedItemId ? { ...item, x, y } : item)));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;

    setItems(prev => {
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

    setDraggedItemId(null);
    setDragPos(null);
    stageBox.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    setDraggedItemId(null);
    setDragPos(null);
  };

  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;
  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "violet"] || "violet";
  const counted = tapOrder.length;
  const remaining = count - counted;

  const arenaLabel = question.config.sourceBinLabel
    || (learnerMode ? `Tap every ${obj.label}` : PATTERN_LABELS[pattern]);

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      gridSize={GRID_STEP}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<LayoutGrid size={16} />}
      headerTitle="Count in Different Arrangements"
      headerSubtitle={
        isCountComplete && requireAnswerInput
          ? "Counting complete! Enter the total answer below."
          : `${counted} of ${count} counted`
      }
      readAloudText={question.instruction || `Tap and count the ${obj.label}. No matter how they are arranged, the total count is still ${count}!`}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <CanvasChip accent={solvedForGuide ? "emerald" : accent} isDark={isDark} icon={<LayoutGrid size={12} />}>
            {isPlayMode && !solvedForGuide ? `${remaining} to count` : PATTERN_LABELS[pattern]}
          </CanvasChip>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={reset}
            title={isPlayMode ? "Start counting again" : "Back to the slide's arrangement"}
          >
            <RotateCcw size={12} />
            Reset
          </Button>
        </div>
      }
      footerStatus={
        solvedForGuide
          ? `${count} ${obj.label}${count === 1 ? "" : "s"}, however they are arranged!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag objects to override the arrangement"
      }
      footerSolved={solvedForGuide}
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full flex flex-col items-stretch min-h-[280px] sm:min-h-[320px] md:min-h-[360px] touch-none select-none overscroll-none"
        style={{ gap: `${geometry.gap}px` }}
      >
        {/* Crosshair alignment guides in design mode */}
        {!isPlayMode && draggedItem && dragPos && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ top: `${draggedItem.y + itemSize / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ left: `${draggedItem.x + itemSize / 2}px` }}
            />
          </>
        )}

        {/* The arrangement */}
        <CanvasBin
          label={arenaLabel}
          tally={isPlayMode ? `${counted} / ${count}` : undefined}
          accent={accent}
          isDark={isDark}
          complete={isCountComplete}
          className="pointer-events-none"
          style={{ flex: "1 1 auto" }}
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
        </CanvasBin>

        {/* The number track — what the child has said out loud so far */}
        <CanvasBin
          label={learnerMode ? "Count with me" : "Counted so far"}
          tally={isPlayMode ? counted : undefined}
          accent={accent}
          isDark={isDark}
          complete={isCountComplete}
          className="pointer-events-none"
          style={{ flex: `0 0 ${geometry.stripHeight}px` }}
        >
          <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1.5 overflow-hidden">
            {Array.from({ length: count }).map((_, idx) => {
              const reached = idx < counted;
              return (
                <div
                  key={idx}
                  style={{ width: `${geometry.chipSize}px`, height: `${geometry.chipSize}px` }}
                  className={`rounded-lg border-2 text-[11px] flex items-center justify-center font-mono font-bold transition-all duration-300
                    ${reached ? accentChipClass(accent, isDark) : `border-dashed ${emptySlotClass(isDark)}`}`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>
        </CanvasBin>

        {/* The objects themselves */}
        {items.map((item, idx) => {
          const isTapped = item.tapped;
          const tapSeq = tapOrder.indexOf(item.id);
          const assetType = question.config?.assetType || "emoji";
          const isDragging = draggedItemId === item.id;

          let itemClassName = "flex flex-col items-center justify-center select-none touch-none rounded-2xl transition-[box-shadow,transform,opacity] duration-200 outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40";
          itemClassName += isPlayMode
            ? isTapped ? " cursor-default" : " cursor-pointer active:scale-95"
            : " cursor-grab active:cursor-grabbing";

          if (hasFrame) {
            itemClassName += isTapped
              ? ` ${accentChipClass(accent, isDark)} border-2 scale-95`
              : ` ${surfaceClass(isDark, "raised")} border-0 hover:scale-105`;
            if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
          } else {
            itemClassName += isTapped
              ? " scale-95 opacity-85 drop-shadow"
              : " drop-shadow-sm hover:drop-shadow-md hover:scale-105";
            if (isDragging) itemClassName += " scale-125 drop-shadow-xl z-50";
          }

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={
                isTapped
                  ? `${obj.label} counted as ${tapSeq + 1}`
                  : `${obj.label} ${idx + 1}, not counted yet. Tap to count it.`
              }
              onPointerDown={(e) => handlePointerDown(e, item.id)}
              onKeyDown={(e) => {
                if (isPlayMode && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  handleTap(item.id);
                }
              }}
              style={objectStyle({
                x: item.x,
                y: item.y,
                size: itemSize,
                dragging: isDragging,
                z: isTapped ? 10 : 20
              })}
              className={itemClassName}
            >
              {/* The number this object was given as it was counted */}
              {isTapped && showTapNumbers && (
                <div
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold font-mono flex items-center justify-center rounded-full z-10 animate-scale-in ${accentChipClass(accent, isDark)}`}
                  style={{
                    width: `${Math.round(Math.max(18, Math.min(32, itemSize * 0.3)))}px`,
                    height: `${Math.round(Math.max(18, Math.min(32, itemSize * 0.3)))}px`,
                    fontSize: `${Math.round(Math.max(18, Math.min(32, itemSize * 0.3)) * 0.52)}px`
                  }}
                >
                  {tapSeq + 1}
                </div>
              )}

              {/* Coordinate tooltip when dragging in design mode */}
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {item.x}, {item.y}
                </div>
              )}

              <CountingAsset type={assetType as any} emoji={obj.emoji} size={assetSize} />
            </div>
          );
        })}

        {/*
          Docked over the number track, never over the objects: the whole lesson
          is that the arrangement does not change the count, so the arrangement
          has to stay in view while the child answers.
        */}
        <CanvasAnswerPanel
          answer={answer}
          open={answerPanelOpen}
          isDark={isDark}
          prompt={`How many ${obj.label}${count === 1 ? "" : "s"} did you count in total?`}
        />
      </div>
    </SharedCanvasLayout>
  );
};
