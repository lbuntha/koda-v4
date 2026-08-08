import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, MinusCircle } from "lucide-react";
import { CanvasProps } from "./types";
import { CanvasAnswerPanel, useCanvasAnswer } from "./CanvasAnswerPanel";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass, accentTextClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { useCanvasAudience } from "./presentation";
import { Button } from "../ui";

import { Rect, contentZone, fitObjectSize, slotPosition } from "./objectLayout";
import { objectStyle } from "./objectMotion";

interface CountBackItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  crossed: boolean;
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

export const CountBackCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const totalCount = question.config.totalCount || 8;
  const removeCount = question.config.removeCount || 3;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;
  const expectedAnswer = totalCount - removeCount;

  const [items, setItems] = useState<CountBackItem[]>([]);
  const [crossOrder, setCrossOrder] = useState<string[]>([]); // ids, in the order they were crossed out

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const isCountBackComplete = removeCount > 0 && crossOrder.length === removeCount;
  const answerPanelOpen = isPlayMode && requireAnswerInput && isCountBackComplete;

  // Typing, checking and the success hand-off all live in the shared panel.
  const answer = useCanvasAnswer({
    expected: expectedAnswer,
    resetKey: `${question.id}:${totalCount}:${removeCount}`,
    wrongMessage: `Not quite! ${totalCount} take away ${removeCount} leaves ${expectedAnswer} ${obj.label}${expectedAnswer === 1 ? "" : "s"}. Enter ${expectedAnswer}!`,
    onSuccess,
    open: answerPanelOpen
  });

  const solvedForGuide = removeCount > 0 && isCountBackComplete && (requireAnswerInput ? answer.solved : true);

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });
  const { learnerMode } = useCanvasAudience();

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** `null` until the stage has actually been measured. */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const isCompact = stageWidth < 640;

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
   * The set above, the countdown below — both derived from the stage.
   *
   * The bins fill the stage edge to edge, so their boxes are arithmetic rather
   * than measured. Object size comes from the room the set actually has, which
   * is what the old fixed `52 on a phone / 64 otherwise` could not do: eight
   * objects and twenty objects were laid out on the same spacing.
   */
  const geometry = useMemo(() => {
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;
    /** What a band spends on its own caption and padding before anything fits. */
    const chrome = captionH + pad * 2;

    // The countdown is a readout, not a bin of objects: it needs one line of
    // numbers and nothing more, so the set keeps everything else.
    const countdownHeight = Math.round(
      Math.max(chrome + 40, Math.min(stageHeight * 0.24, chrome + 64))
    );
    const setHeight = Math.max(chrome + 60, stageHeight - countdownHeight - gap);
    const set: Rect = { left: 0, top: 0, width: stageWidth, height: setHeight };

    const itemSize = fitObjectSize({
      width: stageWidth,
      height: setHeight,
      count: totalCount,
      padding: pad,
      captionInset: captionH
    });

    return {
      gap,
      countdownHeight,
      setZone: contentZone(set, itemSize, captionH),
      itemSize,
      countdownFontSize: Math.round(Math.max(18, Math.min(40, (countdownHeight - chrome) * 0.8)))
    };
  }, [stageWidth, stageHeight, isCompact, totalCount]);

  const { itemSize } = geometry;
  const hasFrame = question.config.showItemFrame ?? true;
  const assetSize = Math.round(itemSize * (hasFrame ? 0.7 : 0.92));
  const customPositionKey = JSON.stringify(question.config.customPositions || []);

  /** Where the `order`-th object sits in the set. */
  const setSlot = useCallback(
    (order: number) => slotPosition(order, totalCount, geometry.setZone, itemSize),
    [totalCount, geometry.setZone, itemSize]
  );

  // Reset progress on question change
  useEffect(() => {
    setCrossOrder([]);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [question.id, totalCount, removeCount]);

  const prevQuestionId = useRef(question.id);
  const prevObjectId = useRef(question.objectId);
  const prevTotal = useRef(totalCount);

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
        || prevTotal.current !== totalCount;

      const next: CountBackItem[] = Array.from({ length: totalCount }).map((_, idx) => {
        const itemId = `back-item-${idx}`;
        const existing = prev.find(i => i.id === itemId);

        if (existing && !questionChanged) {
          // Nothing moves between bins here — crossed-out objects stay exactly
          // where they were, because the set the child is counting back from
          // has to keep its shape.
          if (flipped) return { ...existing, ...setSlot(idx + 1) };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(stageWidth - itemSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(stageHeight - itemSize, existing.y * resizeY)))
          };
        }

        const savedPos = customPositions.find(p => p.id === itemId);
        const defaultPos = setSlot(idx + 1);

        return {
          id: itemId,
          emoji: obj.emoji,
          x: savedPos ? Math.round(savedPos.x * scaleX) : defaultPos.x,
          y: savedPos ? Math.round(savedPos.y * scaleY) : defaultPos.y,
          crossed: false
        };
      });

      if (questionChanged) {
        prevQuestionId.current = question.id;
        prevObjectId.current = question.objectId;
        prevTotal.current = totalCount;
      }

      return next;
    });
  }, [question.id, question.objectId, totalCount, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isCompact, itemSize, setSlot, obj.emoji, stageWidth, stageHeight]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setCrossOrder([]);
    answer.reset();
    sounds.playPop();

    const updated = items.map((item, idx) => ({
      ...item,
      ...setSlot(idx + 1),
      crossed: false
    }));
    setItems(updated);

    if (!isPlayMode && onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: updated.map(item => ({ id: item.id, x: item.x, y: item.y })),
        layoutReference: {
          width: containerRef.current?.clientWidth || stageWidth,
          height: containerRef.current?.clientHeight || stageHeight
        }
      });
    }
  };

  const handleItemClick = (id: string) => {
    if (!isPlayMode) return;
    reportActivity();
    const item = items.find(i => i.id === id);
    if (!item || item.crossed) return;

    // Counting back is ordinal: the last object goes first, then the one before it.
    const currentIdx = parseInt(id.split("-").pop() || "0", 10);
    const expectedIndex = totalCount - 1 - crossOrder.length;

    if (currentIdx !== expectedIndex) {
      sounds.playFailure();
      return;
    }

    sounds.playTick(totalCount - crossOrder.length);
    setItems(prev => prev.map(i => (i.id === id ? { ...i, crossed: true } : i)));
    const newCrossOrder = [...crossOrder, id];
    setCrossOrder(newCrossOrder);

    if (newCrossOrder.length === removeCount && removeCount > 0) {
      if (!requireAnswerInput) {
        successTimeoutRef.current = setTimeout(() => {
          sounds.playSuccess();
          onSuccessRef.current?.();
          successTimeoutRef.current = null;
        }, 500);
      }
    }
  };


  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlayMode) {
      handleItemClick(id);
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
  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "rose"] || "rose";
  const remaining = totalCount - crossOrder.length;
  const toCross = removeCount - crossOrder.length;

  const countdown = [totalCount, ...crossOrder.map((_, idx) => totalCount - idx - 1)];
  const dynamicInstruction = `Start at ${totalCount} and tap items to count backward: ${countdown.join(", ")}!`;

  const setLabel = question.config.sourceBinLabel || (learnerMode ? "Tap to take away" : "Count back");

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      gridSize={GRID_STEP}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<MinusCircle size={16} />}
      headerTitle="Count Back"
      headerSubtitle={
        isCountBackComplete && requireAnswerInput
          ? `Count back complete! How many ${obj.label}s are left?`
          : `Start at ${totalCount} • tap ${removeCount} ${obj.label}${removeCount === 1 ? "" : "s"} to count back`
      }
      readAloudText={dynamicInstruction}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={solvedForGuide ? "emerald" : accent} isDark={isDark}>
            {solvedForGuide ? `${expectedAnswer} left` : `${toCross} to cross out`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset object positions">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      footerStatus={
        solvedForGuide
          ? `${totalCount} take away ${removeCount} leaves ${expectedAnswer}!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag objects to set their starting positions"
      }
      footerSolved={solvedForGuide}
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        /*
          `flex-1` is what makes this fill a launcher, so the countdown below
          stays modest on purpose: a taller band than the window can give
          overflows the layout's `min-h-0` parent and pushes the set off stage.
        */
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

        {/* The set being counted back from */}
        <CanvasBin
          label={setLabel}
          tally={isPlayMode ? remaining : undefined}
          accent={accent}
          isDark={isDark}
          complete={isCountBackComplete}
          className="pointer-events-none"
          style={{ flex: "1 1 auto" }}
        >
          <GhostGuideOverlay
            show={showGhostGuide && !solvedForGuide}
            label={
              isCountBackComplete && requireAnswerInput
                ? `Enter how many items are left (${expectedAnswer}) in the box!`
                : `Start at ${totalCount} — tap items to count backward!`
            }
            isDark={isDark}
            labelPlacement="top"
          />
        </CanvasBin>

        {/* The countdown the child is saying out loud */}
        <CanvasBin
          label={learnerMode ? "Say it out loud" : "Countdown"}
          tally={isPlayMode ? countdown[countdown.length - 1] : undefined}
          accent={accent}
          isDark={isDark}
          complete={isCountBackComplete}
          className="pointer-events-none"
          style={{ flex: `0 0 ${geometry.countdownHeight}px` }}
        >
          <div
            className="absolute inset-0 flex flex-wrap items-center justify-center gap-2 font-mono font-black overflow-hidden"
            style={{ fontSize: `${geometry.countdownFontSize}px` }}
          >
            <span className={isDark ? "text-slate-100" : "text-slate-800"}>{totalCount}</span>
            {crossOrder.map((_, idx) => (
              <React.Fragment key={idx}>
                <span className={`${accentTextClass(accent, isDark)} opacity-70`} style={{ fontSize: `${Math.round(geometry.countdownFontSize * 0.62)}px` }}>→</span>
                <span className={accentTextClass(accent, isDark)}>{totalCount - idx - 1}</span>
              </React.Fragment>
            ))}
          </div>
        </CanvasBin>

        {/* The objects themselves */}
        {items.map((item, idx) => {
          const expectedIndex = totalCount - 1 - crossOrder.length;
          const isExpectedNext = isPlayMode && !solvedForGuide && expectedIndex === idx && crossOrder.length < removeCount;
          const assetType = question.config?.assetType || "emoji";
          const isDragging = draggedItemId === item.id;

          let itemClassName = "flex flex-col items-center justify-center select-none touch-none rounded-xl transition-[box-shadow,transform,opacity]";
          itemClassName += isPlayMode
            ? item.crossed ? " cursor-default" : " cursor-pointer active:scale-95"
            : " cursor-grab active:cursor-grabbing";

          if (hasFrame) {
            itemClassName += item.crossed
              ? ` ${accentChipClass("rose", isDark)} border-2 opacity-60 scale-95`
              : isExpectedNext
                ? ` ${accentChipClass(accent, isDark)} border-2 scale-105`
                : ` ${surfaceClass(isDark, "raised")} border-0`;
            if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
          } else {
            itemClassName += item.crossed
              ? " opacity-40 scale-95"
              : isExpectedNext
                ? " scale-110 drop-shadow-md"
                : " drop-shadow-sm hover:scale-105 hover:drop-shadow-md";
            if (isDragging) itemClassName += " scale-125 drop-shadow-xl z-50";
          }

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={
                item.crossed
                  ? `${obj.label} crossed out, count ${totalCount - crossOrder.indexOf(item.id)}`
                  : isExpectedNext
                    ? `${obj.label}, tap to cross out next`
                    : `${obj.label}, still counted`
              }
              onPointerDown={(e) => handlePointerDown(e, item.id)}
              style={objectStyle({ x: item.x, y: item.y, size: itemSize, dragging: isDragging })}
              className={itemClassName}
            >
              {/* The number this object was as it came off the count */}
              {item.crossed && (
                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold text-[9px] font-mono w-5 h-5 flex items-center justify-center rounded-full z-10 animate-scale-in ${accentChipClass("rose", isDark)}`}>
                  {totalCount - crossOrder.indexOf(item.id)}
                </div>
              )}

              {/* Cross-out overlay */}
              {item.crossed && (() => {
                const crossStyle = question.config.crossOutStyle || "red_x";
                if (crossStyle === "slash") {
                  return (
                    <div
                      className="absolute inset-0 rounded-2xl flex items-center justify-center font-black text-slate-500 pointer-events-none select-none"
                      style={{ fontSize: `${Math.round(itemSize * 0.55)}px` }}
                    >
                      ╱
                    </div>
                  );
                }
                if (crossStyle === "fade") {
                  return <div className="absolute inset-0 bg-slate-400/25 rounded-2xl pointer-events-none select-none" />;
                }
                return (
                  <div
                    className="absolute inset-0 bg-rose-500/10 rounded-2xl flex items-center justify-center font-black text-rose-500 pointer-events-none select-none"
                    style={{ fontSize: `${Math.round(itemSize * 0.55)}px` }}
                  >
                    ✕
                  </div>
                );
              })()}

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

        <CanvasAnswerPanel
          answer={answer}
          open={answerPanelOpen}
          isDark={isDark}
          placeholder="Remaining…"
          prompt={`How many ${obj.label}${expectedAnswer === 1 ? "" : "s"} are left?`}
        />
      </div>
    </SharedCanvasLayout>
  );
};
