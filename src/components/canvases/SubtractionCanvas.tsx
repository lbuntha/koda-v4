import React, { useState, useEffect, useRef, useCallback } from "react";
import { CanvasProps } from "./types";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Move, Grid, Maximize2, MinusCircle } from "lucide-react";
import { GhostGuideOverlay, useGhostGuide, useCPASwitcher, CPASwitcherPill, FactFamilyCelebrationCard } from "../../pedagogy";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, surfaceClass, accentChipClass } from "./canvasTheme";

const getTenFrameMetrics = (plate: { width: number; height: number }) => {
  const availW = Math.max(80, plate.width - 24);
  const availH = Math.max(40, plate.height - 24);
  
  // Aspect ratio 5:2
  const frameW = Math.min(availW, availH * 2.5);
  const frameH = frameW / 2.5;
  
  const frameLeft = (plate.width - frameW) / 2;
  const frameTop = (plate.height - frameH) / 2;
  
  const cellW = frameW / 5;
  const cellH = frameH / 2;
  
  return {
    left: frameLeft,
    top: frameTop,
    width: frameW,
    height: frameH,
    cellWidth: cellW,
    cellHeight: cellH,
    itemSize: Math.max(16, cellH * 0.62)
  };
};

const TenFrameGrid: React.FC<{ isDark?: boolean; metrics: ReturnType<typeof getTenFrameMetrics> }> = ({
  isDark = false,
  metrics
}) => {
  const cellBg = isDark ? "bg-black/25" : "bg-slate-900/[0.06]";
  return (
    <div 
      style={{
        position: "absolute",
        left: `${metrics.left}px`,
        top: `${metrics.top}px`,
        width: `${metrics.width}px`,
        height: `${metrics.height}px`,
      }}
      className="grid grid-cols-5 grid-rows-2 gap-1 p-1 rounded-lg bg-slate-500/10 pointer-events-none"
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <div 
          key={i} 
          className={`rounded flex items-center justify-center relative overflow-hidden transition-all duration-300 ${cellBg}`}
        />
      ))}
    </div>
  );
};

interface SubtractionItem {
  id: string;
  emoji: string;
  assetType: string;
  isCrossed: boolean;
  x: number;
  y: number;
}

const GRID_STEP = 20;

interface PlateLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SubtractionCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  onSuccess,
  onUpdateQuestionConfig
}) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const assetType = question.config?.assetType || obj.assetType || "emoji";
  const minuend = question.config.minuend ?? 8;
  const subtrahend = question.config.subtrahend ?? 3;
  const targetRemaining = minuend - subtrahend;

  const [items, setItems] = useState<SubtractionItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  // Separate ref for the interactive center area
  const centerRef = useRef<HTMLDivElement>(null);
  const [centerDim, setCenterDim] = useState({ width: 0, height: 0 });

  const crossedCount = items.filter(it => it.isCrossed).length;
  const isSolved = crossedCount === subtrahend;
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });
  const { representation, setRepresentation } = useCPASwitcher(question.config.defaultRepresentation || "concrete");

  useEffect(() => {
    if (question.config.defaultRepresentation) {
      setRepresentation(question.config.defaultRepresentation);
    }
  }, [question.config.defaultRepresentation, setRepresentation]);

  const initializedRef = useRef<string | null>(null);

  // Plate drag/resize state
  const [plateDrag, setPlateDrag] = useState<'move' | 'resize' | null>(null);
  const plateDragStart = useRef({ mx: 0, my: 0 });
  const plateDragStartLayout = useRef<PlateLayout>({ x: 0, y: 0, width: 0, height: 0 });

  // Measure only the center interactive area
  useEffect(() => {
    if (!centerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCenterDim({
          width: entry.contentRect.width || 440,
          height: entry.contentRect.height || 200
        });
      }
    });
    ro.observe(centerRef.current);
    return () => ro.disconnect();
  }, []);

  const cw = centerDim.width || 440;
  const ch = centerDim.height || 200;

  const getDefaultPlate = useCallback((w: number, h: number): PlateLayout => {
    const pw = Math.round(Math.min(w * 0.72, w - 40));
    const ph = Math.round(Math.min(h * 0.78, h - 16));
    return {
      x: Math.round((w - pw) / 2),
      y: Math.round((h - ph) / 2),
      width: pw,
      height: ph
    };
  }, []);

  const [plateLayout, setPlateLayout] = useState<PlateLayout>({ x: 0, y: 0, width: 0, height: 0 });

  // Init/sync plate layout when center dimensions arrive
  useEffect(() => {
    if (cw > 0 && ch > 0) {
      const saved = question.config.containerPositions?.['plate'];
      const savedDim = (question.config as any).plateDimensions;
      if (saved && savedDim) {
        const effectiveW = Math.min(savedDim.width, Math.max(160, cw - 16));
        const effectiveH = Math.min(savedDim.height, Math.max(120, ch - 16));
        const effectiveX = Math.min(saved.x, Math.max(8, cw - effectiveW - 8));
        const effectiveY = Math.min(saved.y, Math.max(8, ch - effectiveH - 8));
        setPlateLayout({ x: effectiveX, y: effectiveY, width: effectiveW, height: effectiveH });
      } else {
        setPlateLayout(getDefaultPlate(cw, ch));
      }
    }
  }, [cw, ch, question.id, getDefaultPlate]);

  // Reset/init items inside the center area
  const reset = useCallback(() => {
    if (cw === 0 || plateLayout.width === 0) return;

    const areaLeft = plateLayout.x + 20;
    const areaTop = plateLayout.y + 20;
    const areaW = plateLayout.width - 40;
    // Extra bottom inset keeps the item grid clear of the "N left" badge that
    // straddles the plate's bottom edge.
    const areaH = plateLayout.height - 40 - 24;

    const metrics = getTenFrameMetrics(plateLayout);
    // Abstract uses same grid layout as concrete; pictorial uses ten-frame positions
    const useGridLayout = representation !== "pictorial";
    const abstractSize = minuend > 10 ? 44 : minuend > 6 ? 52 : 60;
    const dynamicSize = representation === "pictorial" ? metrics.itemSize : (representation === "abstract" ? abstractSize : (minuend > 10 ? 52 : minuend > 7 ? 64 : 76));
    const cols = Math.ceil(Math.sqrt(minuend));
    const rows = Math.ceil(minuend / cols);
    // Clamp the step between items: never touching, never scattered to the
    // corners — the group must still read as "8 donuts", not 8 lonely dots.
    const clampStep = (raw: number) => Math.max(dynamicSize + 10, Math.min(dynamicSize + 34, raw));
    const spacingX = cols > 1 ? clampStep((areaW - dynamicSize) / (cols - 1)) : 0;
    const spacingY = rows > 1 ? clampStep((areaH - dynamicSize) / (rows - 1)) : 0;
    // Center the grid inside the plate area
    const gridW = (cols - 1) * spacingX + dynamicSize;
    const gridH = (rows - 1) * spacingY + dynamicSize;
    const gridOffsetX = areaLeft + Math.max(0, (areaW - gridW) / 2);
    const gridOffsetY = areaTop + Math.max(0, (areaH - gridH) / 2);

    const list: SubtractionItem[] = [];
    for (let i = 0; i < minuend; i++) {
      let defaultX, defaultY;
      if (representation === "pictorial") {
        const row = Math.floor(i / 5);
        const col = i % 5;
        defaultX = Math.round(plateLayout.x + metrics.left + col * metrics.cellWidth + (metrics.cellWidth - metrics.itemSize) / 2);
        defaultY = Math.round(plateLayout.y + metrics.top + row * metrics.cellHeight + (metrics.cellHeight - metrics.itemSize) / 2);
      } else {
        const col = i % cols;
        const row = Math.floor(i / cols);
        defaultX = Math.round(gridOffsetX + col * spacingX);
        defaultY = Math.round(gridOffsetY + row * spacingY);
      }

      const savedPos = !isPlayMode && representation === "concrete" ? question.config.customPositions?.find(p => p.id === `sub-${i}`) : undefined;
      list.push({
        id: `sub-${i}`,
        emoji: obj.emoji,
        assetType,
        isCrossed: false,
        x: savedPos ? savedPos.x : defaultX,
        y: savedPos ? savedPos.y : defaultY
      });
    }
    setItems(list);
  }, [minuend, obj.emoji, assetType, plateLayout, cw, question.config.customPositions, representation, isPlayMode]);

  useEffect(() => {
    if (cw > 0 && plateLayout.width > 0) {
      const key = `v2-${question.id}-${minuend}-${obj.emoji}-${cw}-${plateLayout.width}-${representation}`;
      if (initializedRef.current !== key) {
        reset();
        initializedRef.current = key;
      }
    }
  }, [cw, plateLayout.width, question.id, minuend, obj.emoji, representation, reset]);

  // ---- Item drag handlers ----
  const handleItemPointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlayMode) {
      handleToggleCross(id);
      return;
    }
    e.stopPropagation();
    sounds.playPop();
    setDraggedItemId(id);
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  // ---- Plate drag/resize handlers ----
  const handlePlateMoveDown = (e: React.PointerEvent) => {
    if (isPlayMode) return;
    e.stopPropagation();
    sounds.playPop();
    setPlateDrag('move');
    plateDragStart.current = { mx: e.clientX, my: e.clientY };
    plateDragStartLayout.current = { ...plateLayout };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePlateResizeDown = (e: React.PointerEvent) => {
    if (isPlayMode) return;
    e.stopPropagation();
    sounds.playPop();
    setPlateDrag('resize');
    plateDragStart.current = { mx: e.clientX, my: e.clientY };
    plateDragStartLayout.current = { ...plateLayout };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  // ---- Unified pointer move (relative to centerRef) ----
  const handleContainerPointerMove = (e: React.PointerEvent) => {
    const centerRect = centerRef.current?.getBoundingClientRect();
    if (!centerRect) return;

    if (!isPlayMode && draggedItemId) {
      const itemSize = minuend > 10 ? 52 : minuend > 7 ? 64 : 76;
      const margin = 8;
      let x = e.clientX - centerRect.left - dragOffset.current.x;
      let y = e.clientY - centerRect.top - dragOffset.current.y;
      // Clamp to plate boundary
      x = Math.max(plateLayout.x + margin, Math.min(plateLayout.x + plateLayout.width - itemSize - margin, x));
      y = Math.max(plateLayout.y + margin, Math.min(plateLayout.y + plateLayout.height - itemSize - margin, y));
      if (showGrid) {
        x = Math.round(x / GRID_STEP) * GRID_STEP;
        y = Math.round(y / GRID_STEP) * GRID_STEP;
      }
      setDragPos({ x: Math.round(x), y: Math.round(y) });
      setItems(prev =>
        prev.map(it => (it.id === draggedItemId ? { ...it, x: Math.round(x), y: Math.round(y) } : it))
      );
      return;
    }

    if (!isPlayMode && plateDrag) {
      const dx = e.clientX - plateDragStart.current.mx;
      const dy = e.clientY - plateDragStart.current.my;
      const orig = plateDragStartLayout.current;

      if (plateDrag === 'move') {
        let nextX = Math.max(0, Math.min(cw - orig.width, orig.x + dx));
        let nextY = Math.max(0, Math.min(ch - orig.height, orig.y + dy));
        if (showGrid) {
          nextX = Math.round(nextX / GRID_STEP) * GRID_STEP;
          nextY = Math.round(nextY / GRID_STEP) * GRID_STEP;
        }
        setPlateLayout(prev => ({ ...prev, x: nextX, y: nextY }));
      } else {
        let nextW = Math.max(80, Math.min(cw - orig.x, orig.width + dx));
        let nextH = Math.max(60, Math.min(ch - orig.y, orig.height + dy));
        if (showGrid) {
          nextW = Math.round(nextW / GRID_STEP) * GRID_STEP;
          nextH = Math.round(nextH / GRID_STEP) * GRID_STEP;
        }
        setPlateLayout(prev => ({ ...prev, width: nextW, height: nextH }));
      }
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!isPlayMode && draggedItemId) {
      const id = draggedItemId;
      setItems(prev => {
        const item = prev.find(it => it.id === id);
        if (!item) return prev;
        const updated = prev.map(it => (it.id === id ? { ...it, x: item.x, y: item.y } : it));
        onUpdateQuestionConfig?.({
          customPositions: updated.map(it => ({ id: it.id, x: it.x, y: it.y }))
        });
        return updated;
      });
      setDraggedItemId(null);
      setDragPos(null);
    }

    if (!isPlayMode && plateDrag) {
      onUpdateQuestionConfig?.({
        containerPositions: { plate: { x: plateLayout.x, y: plateLayout.y } },
        plateDimensions: { width: plateLayout.width, height: plateLayout.height }
      } as any);
      setPlateDrag(null);
    }

    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    setDraggedItemId(null);
    setDragPos(null);
    setPlateDrag(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleToggleCross = (id: string) => {
    reportActivity();
    const targetItem = items.find(it => it.id === id);
    if (!targetItem) return;
    targetItem.isCrossed ? sounds.playSlide() : sounds.playTick();

    const updated = items.map(it => it.id === id ? { ...it, isCrossed: !it.isCrossed } : it);
    setItems(updated);

    if (updated.filter(it => it.isCrossed).length === subtrahend) {
      sounds.playSuccess();
      onSuccess?.();
    }
  };

  const handleResetLayout = () => {
    sounds.playPop();
    setPlateLayout(getDefaultPlate(cw, ch));
    onUpdateQuestionConfig?.({
      customPositions: [],
      containerPositions: {},
      plateDimensions: undefined
    } as any);
    initializedRef.current = null;
  };

  const remainingCount = minuend - crossedCount;
  const subMetrics = getTenFrameMetrics(plateLayout);
  const abstractItemSize = minuend > 10 ? 44 : minuend > 6 ? 52 : 60;
  const dynamicItemSize = representation === "pictorial"
    ? subMetrics.itemSize
    : representation === "abstract"
      ? abstractItemSize
      : (minuend > 10 ? 52 : minuend > 7 ? 64 : 76);
  const draggedItem = draggedItemId ? items.find(it => it.id === draggedItemId) : null;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      accent="rose"
      headerIcon={<MinusCircle size={16} />}
      headerTitle="Subtraction Sandbox"
      headerSubtitle={
        <span className="font-mono tracking-tight">
          <span>{minuend}</span>
          <span className={isDark ? "text-slate-500" : "text-slate-400"}> − </span>
          <span className={crossedCount > 0 ? (isDark ? "text-rose-400" : "text-rose-600") : (isDark ? "text-slate-500" : "text-slate-400")}>{crossedCount}</span>
          <span className={isDark ? "text-slate-500" : "text-slate-400"}> = </span>
          <span className={isSolved ? (isDark ? "text-emerald-400" : "text-emerald-600") : undefined}>{remainingCount}</span>
        </span>
      }
      readAloudText={`Subtraction. ${minuend} minus ${subtrahend} equals ${targetRemaining}. Tap items to cross out ${subtrahend} ${obj.label}!`}
      headerActions={
        <CanvasChip
          accent={isSolved ? "emerald" : "rose"}
          isDark={isDark}
          aria-label={`Crossed out ${crossedCount} of ${subtrahend}`}
        >
          ✕ Cross out {crossedCount} / {subtrahend}
        </CanvasChip>
      }
      footerStatus={
        isSolved
          ? `Spot on! ${minuend} − ${subtrahend} = ${targetRemaining}`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag items to reposition · Drag plate to move · Resize corner ↘"
      }
      footerSolved={isSolved}
      designerHint="Drag the plate to reposition, or use handles to resize."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full h-full bg-transparent border-0 rounded-3xl p-1 flex flex-col justify-between overflow-hidden touch-none select-none gap-2 transition-colors duration-300"
      >

      {/* ── Design Mode pill ── */}
      {!isPlayMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30 pointer-events-none">
          <div className={`border text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5
            ${isDark ? 'bg-violet-900/40 border-violet-500/50 text-violet-300' : 'bg-violet-50 border-violet-200 text-violet-800'}
          `}>
            <Move size={10} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
            <span>Design Mode</span>
          </div>
          <button
            onClick={handleResetLayout}
            className={`pointer-events-auto border text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 transition-colors cursor-pointer
              ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}
            `}
          >
            <RotateCcw size={10} />
            Reset
          </button>
        </div>
      )}

      {/* ── Grid overlay ─────────────────────────────── */}
      {!isPlayMode && showGrid && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: "radial-gradient(#6b46c1 1.2px, transparent 1.2px)",
            backgroundSize: "20px 20px",
            opacity: 0.1
          }}
        />
      )}

      {/* ── Center interactive area (owns coordinate space) ─── */}
      <div
        ref={centerRef}
        className="relative flex-1 w-full overflow-hidden my-1.5 touch-none select-none overscroll-none"
        style={{ minHeight: 0 }}
      >
        <GhostGuideOverlay
          show={showGhostGuide && !isSolved}
          label={`Tap items to cross out ${subtrahend}!`}
          isDark={isDark}
          labelPlacement="top"
          style={{ top: plateLayout.y, left: plateLayout.x, width: plateLayout.width, height: plateLayout.height }}
        />
        {/* Plate / Donut Tray Workspace Container */}
        {plateLayout.width > 0 && (
          <div
            style={{
              position: "absolute",
              left: plateLayout.x,
              top: plateLayout.y,
              width: plateLayout.width,
              height: plateLayout.height,
              zIndex: 5
            }}
          >
            {/* Plate background following Move and Count stage container style */}
            <div className={`absolute inset-0 rounded-[2.4rem] flex items-center justify-center transition-colors duration-300 overflow-hidden ${surfaceClass(isDark)}
              ${!isPlayMode
                ? plateDrag === 'move'
                  ? 'border-2 border-solid border-indigo-500'
                  : plateDrag === 'resize'
                    ? 'border-2 border-solid border-violet-500'
                    : 'border-2 border-dashed border-indigo-400/50'
                : ''
              }
            `}>

              {representation === "pictorial" && (
                <TenFrameGrid isDark={isDark} metrics={getTenFrameMetrics(plateLayout)} />
              )}
            </div>

            {/* ── Grab-bar drag handle at the top of the plate ── */}
            {!isPlayMode && (
              <div
                onPointerDown={handlePlateMoveDown}
                className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                  flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md border cursor-grab active:cursor-grabbing z-20 select-none
                  transition-all duration-150
                  ${plateDrag === 'move'
                    ? 'bg-indigo-600 border-indigo-600 text-white scale-105 shadow-lg'
                    : isDark
                      ? 'bg-slate-800 border-violet-500/50 text-violet-300 hover:bg-slate-700'
                      : 'bg-white border-violet-300 text-violet-600 hover:bg-violet-50'
                  }
                `}
              >
                <Move size={11} />
                <span className="text-[9px] font-bold font-mono uppercase tracking-wider whitespace-nowrap">
                  {plateDrag === 'move' ? `X:${plateLayout.x} Y:${plateLayout.y}` : 'Drag to move'}
                </span>
              </div>
            )}

            {/* ── Resize handle — bottom-right ── */}
            {!isPlayMode && (
              <div
                onPointerDown={handlePlateResizeDown}
                style={{ touchAction: 'none' }}
                className={`absolute -bottom-2 -right-2 w-8 h-8 cursor-se-resize z-20 flex items-center justify-center rounded-full shadow-md border transition-all duration-150 select-none
                  ${plateDrag === 'resize'
                    ? 'bg-violet-600 border-violet-600 text-white scale-110 shadow-lg'
                    : isDark
                      ? 'bg-slate-700 border-slate-500 text-indigo-300 hover:bg-slate-600 hover:border-indigo-400'
                      : 'bg-white border-indigo-300 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-500'
                  }
                `}
              >
                <Maximize2 size={11} className="rotate-90" />
              </div>
            )}

            {/* ── "N Left" badge – bottom-center of the plate border (all modes) ── */}
            <div className={`absolute bottom-0 right-8 translate-y-1/2 z-30
              flex flex-col items-center justify-center pointer-events-none select-none
              px-4 py-1.5 rounded-full border ${accentChipClass(isSolved ? "emerald" : "rose", isDark)}`}
            >
              <span className="text-lg font-black font-mono leading-none">
                {minuend - items.filter(it => it.isCrossed).length}
              </span>
              <span className="text-[8px] font-mono font-bold uppercase tracking-widest opacity-60">Left</span>
            </div>

            {/* Size tooltip shown above plate while resizing */}
            {!isPlayMode && plateDrag === 'resize' && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[9px] px-2 py-0.5 rounded shadow z-50 pointer-events-none whitespace-nowrap">
                W: {plateLayout.width}px · H: {plateLayout.height}px
              </div>
            )}
          </div>
        )}

        {/* Crosshair guides while dragging items */}
        {!isPlayMode && draggedItem && dragPos && (
          <>
            <div className="absolute inset-x-0 border-t border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ top: dragPos.y + dynamicItemSize / 2 }} />
            <div className="absolute inset-y-0 border-l border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ left: dragPos.x + dynamicItemSize / 2 }} />
          </>
        )}

        {/* Items wrapper - pointer-events-none so plate drag falls through empty space */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {items.map(it => {
            const isDragging = draggedItemId === it.id;
            return (
              <button
                key={it.id}
                onPointerDown={e => handleItemPointerDown(e, it.id)}
                style={{
                  position: "absolute",
                  left: it.x,
                  top: it.y,
                  width: dynamicItemSize,
                  height: dynamicItemSize,
                  zIndex: isDragging ? 50 : 20,
                  touchAction: "none",
                  transition: isDragging ? "none" : "left 0.18s ease, top 0.18s ease, transform 0.1s ease"
                }}
                className={`pointer-events-auto flex items-center justify-center select-none rounded-xl
                  ${isPlayMode
                    ? 'cursor-pointer hover:scale-110 active:scale-95'
                    : 'cursor-grab active:cursor-grabbing'
                  }
                  ${isDragging ? 'drop-shadow-xl scale-110' : ''}
                `}
              >
                {/* Coordinate tooltip while dragging in design mode */}
                {!isPlayMode && isDragging && dragPos && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[8px] px-1.5 py-0.5 rounded shadow z-50 pointer-events-none whitespace-nowrap">
                    {it.x}, {it.y}
                  </div>
                )}
                <div className="relative flex items-center justify-center w-full h-full">
                  <div className={`transition-all duration-200 ${it.isCrossed ? "opacity-30 filter grayscale scale-90" : "opacity-100"}`}>
                    {representation === "concrete" ? (
                      <CountingAsset type={it.assetType as any} emoji={it.emoji} size={dynamicItemSize - 6} />
                    ) : representation === "pictorial" ? (
                      <div 
                        className="rounded-full shadow-sm transition-transform flex items-center justify-center bg-rose-500 hover:bg-rose-600"
                        style={{ width: `${dynamicItemSize - 6}px`, height: `${dynamicItemSize - 6}px` }}
                      >
                        <div className="w-2/5 h-2/5 rounded-full bg-rose-600/25" />
                      </div>
                    ) : (
                      // Abstract digits mode — clean numbered circles, no border
                      <div 
                        className="rounded-full font-mono font-black shadow-md transition-transform flex items-center justify-center select-none pointer-events-none bg-indigo-500 text-white"
                        style={{ width: `${dynamicItemSize}px`, height: `${dynamicItemSize}px`, fontSize: `${Math.round(dynamicItemSize * 0.38)}px` }}
                      >
                        {parseInt(it.id.split("-")[1] || "0", 10) + 1}
                      </div>
                    )}
                  </div>
                  {it.isCrossed && (
                    <div className="absolute inset-0 flex items-center justify-center font-black text-red-500 text-2xl select-none animate-scale-in drop-shadow z-10 pointer-events-none">
                      ✕
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CPA bridge — same 8 − 3, three ways: objects, ten-frame, digits */}
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

      {/* Grid snap indicator */}
      {!isPlayMode && showGrid && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1 text-indigo-300 text-[9px] font-mono z-30 pointer-events-none">
          <Grid size={9} />
          <span>Snap {GRID_STEP}px</span>
        </div>
      )}
      </div>
    </SharedCanvasLayout>
  );
};
