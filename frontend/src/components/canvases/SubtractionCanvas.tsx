import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { CanvasProps } from "./types";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { Button } from "../ui";
import { sounds } from "../../sound";
import { RotateCcw, MinusCircle } from "lucide-react";
import { GhostGuideOverlay, useGhostGuide, useCPASwitcher, CPASwitcherPill, FactFamilyCelebrationCard } from "../../pedagogy";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass, accentTextClass, emptySlotClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { useCanvasAudience } from "./presentation";
import { objectStyle } from "./objectMotion";
import { Rect, contentZone, fitObjectSize, slotPosition } from "./objectLayout";

/**
 * A subtraction object.
 *
 * Deliberately holds no artwork. It used to carry a copy of `assetType`, taken
 * when the items were first built and only rebuilt when a key made of the id,
 * the count and the plate size changed — so a teacher swapping the picture in
 * the studio saw nothing happen. Swapping between two custom SVGs does not even
 * change `assetType` (both are `custom_svg`; only the asset id moves), so the
 * only refresh that is always right is the one that reads the artwork from the
 * question at render.
 */
interface SubtractionItem {
  id: string;
  isCrossed: boolean;
  x: number;
  y: number;
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

const GRID_STEP = 20;

export const SubtractionCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  onSuccess,
  onUpdateQuestionConfig
}) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  /* Read at render, never copied into item state — this is what makes a picture
     swap in the studio show up immediately. */
  const assetType = question.config?.assetType || obj.assetType || "emoji";
  const minuend = question.config.minuend ?? 8;
  const subtrahend = question.config.subtrahend ?? 3;
  const targetRemaining = minuend - subtrahend;

  const [items, setItems] = useState<SubtractionItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /** `null` until the stage has actually been measured. */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const isCompact = stageWidth < 640;

  const crossedCount = items.filter(it => it.isCrossed).length;
  const isSolved = subtrahend > 0 && crossedCount === subtrahend;
  const remainingCount = minuend - crossedCount;

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });
  const { representation, setRepresentation } = useCPASwitcher(question.config.defaultRepresentation || "concrete");
  const { learnerMode } = useCanvasAudience();

  useEffect(() => {
    if (question.config.defaultRepresentation) {
      setRepresentation(question.config.defaultRepresentation);
    }
  }, [question.config.defaultRepresentation, setRepresentation]);

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
   * The plate above, the equation below — both derived from the stage.
   *
   * Object size comes from the room the plate actually has. The old rule was a
   * three-way `minuend > 10 ? 52 : minuend > 7 ? 64 : 76`, written three times
   * over in three different places, and a plate a teacher could drag anywhere.
   */
  const geometry = useMemo(() => {
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;
    const chrome = captionH + pad * 2;

    const readoutHeight = Math.round(
      Math.max(chrome + 40, Math.min(stageHeight * 0.24, chrome + 64))
    );
    const plateHeight = Math.max(chrome + 60, stageHeight - readoutHeight - gap);
    const plate: Rect = { left: 0, top: 0, width: stageWidth, height: plateHeight };

    const itemSize = fitObjectSize({
      width: stageWidth,
      height: plateHeight,
      count: minuend,
      padding: pad,
      captionInset: captionH
    });
    const plateZone = contentZone(plate, itemSize, captionH);

    // A ten-frame is 5 × 2, and the pictorial mode lays its counters in it.
    const cell = Math.min((plateZone.width - pad * 2) / 5, plateZone.height / 2, itemSize * 1.3);

    return {
      gap,
      captionH,
      readoutHeight,
      plateZone,
      itemSize,
      cell,
      frame: {
        left: plateZone.left + (plateZone.width - cell * 5) / 2,
        top: plateZone.top + (plateZone.height - cell * 2) / 2,
        width: cell * 5,
        height: cell * 2
      },
      readoutFontSize: Math.round(Math.max(18, Math.min(40, (readoutHeight - chrome) * 0.8)))
    };
  }, [stageWidth, stageHeight, isCompact, minuend]);

  const { itemSize } = geometry;
  const customPositionKey = JSON.stringify(question.config.customPositions || []);

  /** Where object `index` sits — in a ten-frame cell, or slotted on the plate. */
  const homeSlot = useCallback((index: number) => {
    if (representation === "pictorial" && index < 10) {
      const row = Math.floor(index / 5);
      const column = index % 5;
      return {
        x: Math.round(geometry.frame.left + column * geometry.cell + (geometry.cell - itemSize) / 2),
        y: Math.round(geometry.frame.top + row * geometry.cell + (geometry.cell - itemSize) / 2)
      };
    }
    return slotPosition(index + 1, minuend, geometry.plateZone, itemSize);
  }, [representation, geometry.frame, geometry.cell, geometry.plateZone, minuend, itemSize]);

  const prevQuestionId = useRef(question.id);
  const prevMinuend = useRef(minuend);
  const prevRepresentation = useRef(representation);

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
      const customPositions = (isCompact && isPlayMode) || representation !== "concrete"
        ? []
        : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? stageWidth / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? stageHeight / layoutReference.height : 1;

      const changed = prevQuestionId.current !== question.id
        || prevMinuend.current !== minuend
        || prevRepresentation.current !== representation;

      const next: SubtractionItem[] = Array.from({ length: minuend }).map((_, idx) => {
        const id = `sub-${idx}`;
        const existing = prev.find(it => it.id === id);
        const home = homeSlot(idx);

        if (existing && !changed) {
          if (flipped) return { ...existing, ...home };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(stageWidth - itemSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(stageHeight - itemSize, existing.y * resizeY)))
          };
        }

        const saved = customPositions.find(p => p.id === id);
        return {
          id,
          isCrossed: existing && !changed ? existing.isCrossed : false,
          x: saved ? Math.round(saved.x * scaleX) : home.x,
          y: saved ? Math.round(saved.y * scaleY) : home.y
        };
      });

      if (changed) {
        prevQuestionId.current = question.id;
        prevMinuend.current = minuend;
        prevRepresentation.current = representation;
      }

      return next;
    });
  }, [question.id, minuend, representation, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isCompact, itemSize, homeSlot, stageWidth, stageHeight]);

  const reset = () => {
    sounds.playPop();
    const updated = items.map((it, idx) => ({ ...it, ...homeSlot(idx), isCrossed: false }));
    setItems(updated);

    if (!isPlayMode && onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: updated.map(it => ({ id: it.id, x: it.x, y: it.y })),
        layoutReference: {
          width: containerRef.current?.clientWidth || stageWidth,
          height: containerRef.current?.clientHeight || stageHeight
        }
      });
    }
  };

  const hasTriggeredSuccess = useRef(false);
  useEffect(() => {
    hasTriggeredSuccess.current = false;
  }, [question.id, minuend, subtrahend]);

  /*
    One success per board. Crossing out, undoing and crossing out again used to
    fire `onSuccess` each time it passed through the target, which the launcher
    reads as another solved attempt.
  */
  useEffect(() => {
    if (!isPlayMode) return;
    if (isSolved && !hasTriggeredSuccess.current) {
      hasTriggeredSuccess.current = true;
      sounds.playSuccess();
      onSuccessRef.current?.();
    } else if (!isSolved) {
      hasTriggeredSuccess.current = false;
    }
  }, [isSolved, isPlayMode]);

  const handleToggleCross = (id: string) => {
    reportActivity();
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      if (it.isCrossed) sounds.playSlide(); else sounds.playTick(prev.filter(i => i.isCrossed).length + 1);
      return { ...it, isCrossed: !it.isCrossed };
    }));
  };

  const handleItemPointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlayMode) {
      handleToggleCross(id);
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    sounds.playPop();
    setDraggedItemId(id);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!containerRef.current) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
    setItems(prev => prev.map(it => (it.id === draggedItemId ? { ...it, x, y } : it)));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;

    setItems(prev => {
      if (onUpdateQuestionConfig) {
        onUpdateQuestionConfig({
          customPositions: prev.map(it => ({ id: it.id, x: it.x, y: it.y })),
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
    stageBox.current = null;
  };

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "rose"] || "rose";
  const draggedItem = draggedItemId ? items.find(it => it.id === draggedItemId) : null;
  const toCross = subtrahend - crossedCount;

  const plateLabel = question.config.sourceBinLabel
    || (learnerMode ? `Cross out ${subtrahend}` : "Take away");

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      gridSize={GRID_STEP}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerTitle="Koda Subtraction"
      /* The Count header — see `CountCanvas`, and `AdditionCanvas` for the pair. */
      questionText={question.instruction?.trim() || `Cross out ${subtrahend}. How many are left?`}
      readAloudText={`Subtraction. ${minuend} minus ${subtrahend} equals ${targetRemaining}. Tap items to cross out ${subtrahend} ${obj.label}!`}
      guideRole={isSolved ? "celebrating" : "waiting"}
      {...guidePropsFor(question)}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark} aria-label={`Crossed out ${crossedCount} of ${subtrahend}`}>
            {isSolved ? `${minuend} − ${subtrahend} = ${targetRemaining}` : `${toCross} to cross out`}
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
          ? `${minuend} take away ${subtrahend} leaves ${targetRemaining}!`
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

        {/* The plate — everything the child starts with */}
        <CanvasBin
            surface={false}
          label={plateLabel}
          tally={isPlayMode ? remainingCount : minuend}
          accent={accent}
          isDark={isDark}
          complete={isSolved}
          className="pointer-events-none"
          style={{ flex: "1 1 auto" }}
        >
          <GhostGuideOverlay
            show={showGhostGuide && !isSolved}
            label={`Tap ${subtrahend} ${obj.label} to take them away!`}
            isDark={isDark}
            labelPlacement="top"
          />
        </CanvasBin>

        {/* The equation, filling in as the child crosses objects out */}
        <CanvasBin
            surface={false}
          label={learnerMode ? "How many are left" : "Equation"}
          tally={isPlayMode ? remainingCount : undefined}
          accent={accent}
          isDark={isDark}
          complete={isSolved}
          className="pointer-events-none"
          style={{ flex: `0 0 ${geometry.readoutHeight}px` }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 font-mono font-black overflow-hidden"
            style={{ fontSize: `${geometry.readoutFontSize}px` }}
          >
            <span className={isDark ? "text-slate-100" : "text-slate-800"}>{minuend}</span>
            <span className="opacity-50" style={{ fontSize: `${Math.round(geometry.readoutFontSize * 0.7)}px` }}>−</span>
            <span className={accentTextClass(accent, isDark)}>{crossedCount}</span>
            <span className="opacity-50" style={{ fontSize: `${Math.round(geometry.readoutFontSize * 0.7)}px` }}>=</span>
            <span className={isSolved ? (isDark ? "text-emerald-400" : "text-emerald-600") : (isDark ? "text-slate-100" : "text-slate-800")}>
              {remainingCount}
            </span>
          </div>
        </CanvasBin>

        {/* The ten-frame behind the counters, for the pictorial representation */}
        {representation === "pictorial" && (
          <div
            style={{
              position: "absolute",
              left: `${geometry.frame.left}px`,
              top: `${geometry.frame.top}px`,
              width: `${geometry.frame.width}px`,
              height: `${geometry.frame.height}px`,
              zIndex: 5
            }}
            className="grid grid-cols-5 grid-rows-2 gap-1 pointer-events-none"
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={`border-2 border-dashed rounded-lg ${emptySlotClass(isDark)}`} />
            ))}
          </div>
        )}

        {/* The objects themselves */}
        {items.map((it, idx) => {
          const isDragging = draggedItemId === it.id;

          return (
            <button
              key={it.id}
              type="button"
              aria-label={
                it.isCrossed
                  ? `${obj.label} ${idx + 1}, crossed out. Tap to put it back.`
                  : `${obj.label} ${idx + 1}. Tap to cross it out.`
              }
              aria-pressed={it.isCrossed}
              onPointerDown={e => handleItemPointerDown(e, it.id)}
              style={objectStyle({ x: it.x, y: it.y, size: itemSize, dragging: isDragging })}
              className={`flex items-center justify-center select-none rounded-2xl
                outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40
                ${isPlayMode ? "cursor-pointer hover:scale-105 active:scale-95" : "cursor-grab active:cursor-grabbing"}
                ${isDragging ? "drop-shadow-xl scale-110" : ""}`}
            >
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {it.x}, {it.y}
                </div>
              )}

              <div className="relative flex items-center justify-center w-full h-full">
                <div className={`transition-all duration-200 ${it.isCrossed ? "opacity-30 grayscale scale-90" : "opacity-100"}`}>
                  {representation === "concrete" ? (
                    <CountingAsset type={assetType as any} emoji={obj.emoji} size={Math.round(itemSize * 0.88)} />
                  ) : representation === "pictorial" ? (
                    <div
                      className={`rounded-full flex items-center justify-center ${accentChipClass(accent, isDark)}`}
                      style={{ width: `${itemSize - 6}px`, height: `${itemSize - 6}px` }}
                    >
                      <div className="w-2/5 h-2/5 rounded-full bg-current opacity-30" />
                    </div>
                  ) : (
                    <div
                      className={`rounded-full font-mono font-black flex items-center justify-center ${surfaceClass(isDark, "raised")} ${isDark ? "text-slate-100" : "text-slate-700"}`}
                      style={{ width: `${itemSize}px`, height: `${itemSize}px`, fontSize: `${Math.round(itemSize * 0.38)}px` }}
                    >
                      {idx + 1}
                    </div>
                  )}
                </div>
                {it.isCrossed && (
                  <div
                    className="absolute inset-0 flex items-center justify-center font-black text-rose-500 select-none animate-scale-in drop-shadow z-10 pointer-events-none"
                    style={{ fontSize: `${Math.round(itemSize * 0.55)}px` }}
                  >
                    ✕
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* CPA bridge — the same 8 − 3, three ways: objects, ten-frame, digits */}
      {isPlayMode && (
        <div className="flex justify-center pb-1 z-20">
          <CPASwitcherPill
            representation={representation}
            onChange={(rep) => { reportActivity(); setRepresentation(rep); }}
            isDark={isDark}
          />
        </div>
      )}

      <FactFamilyCelebrationCard
        isSolved={isSolved}
        numberBond={{ part1: subtrahend, part2: targetRemaining, total: minuend }}
        factFamilyText={`Brilliant! You crossed out ${subtrahend} ${obj.label} and found ${targetRemaining} left over!`}
        isDark={isDark}
      />
    </SharedCanvasLayout>
  );
};
