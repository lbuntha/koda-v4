import React, { useState, useEffect, useRef, useCallback } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Grid2X2, Move, Maximize2 } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { Button } from "../ui";

interface TenFrameDot {
  id: string;
  emoji: string;
  x: number;
  y: number;
  snappedCell: { frameIdx: number; cellIdx: number } | null;
}

interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// Layout constants
const CELL_SIZE = 40; // w-10 h-10

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};
const TRAY_HEIGHT = 110;
const GRID_STEP = 20;

export const GroupTensCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;

  const [dots, setDots] = useState<TenFrameDot[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const [dimensions, setDimensions] = useState({ width: 480, height: 320 });
  const solvedForGuide = dots.length > 0 && dots.every(d => d.snappedCell !== null);
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });
  const [shelfLayout, setShelfLayout] = useState<LayoutRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [shelfDrag, setShelfDrag] = useState<'move' | 'resize' | null>(null);
  const shelfDragStart = useRef({ mx: 0, my: 0 });
  const shelfDragStartLayout = useRef<LayoutRect>({ left: 0, top: 0, width: 0, height: 0 });

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

  // Measure shelf layout in play mode on mobile to place dots correctly
  useEffect(() => {
    const isMobile = dimensions.width < 640;
    if (!isPlayMode || !isMobile || !shelfRef.current || !containerRef.current) return;
    const measure = () => {
      const parentRect = containerRef.current!.getBoundingClientRect();
      const shelfRect = shelfRef.current!.getBoundingClientRect();
      if (shelfRect.width > 0 && parentRect.width > 0) {
        setShelfLayout({
          left: Math.round(shelfRect.left - parentRect.left),
          top: Math.round(shelfRect.top - parentRect.top),
          width: Math.round(shelfRect.width),
          height: Math.round(shelfRect.height)
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shelfRef.current);
    return () => ro.disconnect();
  }, [dimensions.width, isPlayMode]);

  const dotSize = w < 640 ? 38 : 48; // responsive dot size

  // Sync or initialize shelf layout
  useEffect(() => {
    if (w > 0 && h > 0) {
      const isMobile = w < 640;
      const framesStacked = isMobile && count > 10;
      const minFramesHeight = framesStacked ? 328 : 160;

      // Ignore saved coordinates in play mode to enforce standard, responsive, centered layouts
      const useSaved = !isPlayMode;
      const saved = useSaved ? question.config.containerPositions?.['shelf'] : null;
      const savedDim = useSaved ? (question.config as any).shelfDimensions : null;
      if (saved && savedDim) {
        const effectiveW = Math.min(savedDim.width, Math.max(160, w - 16));
        const effectiveH = Math.min(savedDim.height, Math.max(80, h - 36 - 16));
        const effectiveX = Math.min(saved.x, Math.max(8, w - effectiveW - 8));
        const effectiveY = Math.min(saved.y, Math.max(8, h - effectiveH - 8));
        setShelfLayout({ left: effectiveX, top: effectiveY, width: effectiveW, height: effectiveH });
      } else {
        const defaultW = isMobile ? (w - 24) : Math.round(w * 0.5);
        const gapX = isMobile ? 36 : (count > 16 ? 38 : count > 10 ? 44 : 48);
        const maxItemsFit = Math.floor((defaultW - 16) / gapX);
        const itemsPerRow = Math.max(4, Math.min(maxItemsFit, count));
        const totalRows = Math.ceil(count / itemsPerRow);
        const defaultH = isMobile && totalRows > 2 ? 140 : TRAY_HEIGHT;

        const defaultX = isMobile ? 12 : Math.round((w - defaultW) / 2);
        const defaultY = Math.max(minFramesHeight + 16, h - 12 - defaultH);
        setShelfLayout({ left: defaultX, top: defaultY, width: defaultW, height: defaultH });
      }
    }
  }, [w, h, question.id, count, isPlayMode]);

  // Helper: get default tray position for an item index (vertically centered inside bottom shelf)
  const getTrayPos = useCallback((idx: number, w: number, h: number) => {
    const isMobile = w < 640;
    const sLeft = shelfLayout.width > 0 ? shelfLayout.left : 12;
    const sTop = shelfLayout.width > 0 ? shelfLayout.top : Math.max(180, h - 12 - TRAY_HEIGHT);
    const sWidth = shelfLayout.width > 0 ? shelfLayout.width : w - 24;
    const sHeight = shelfLayout.width > 0 ? shelfLayout.height : TRAY_HEIGHT;

    const availableHeight = sHeight - 36;
    
    // Choose columns per row dynamically based on the width of the shelf!
    const gapX = isMobile ? 36 : (count > 16 ? 38 : count > 10 ? 44 : 48);
    const maxItemsFit = Math.floor((sWidth - 16) / gapX);
    const itemsPerRow = Math.max(4, Math.min(maxItemsFit, count));
    const totalRows = Math.ceil(count / itemsPerRow);
    
    // Vertical layout calculations
    const spacingY = totalRows > 1 ? Math.min(24, (availableHeight - dotSize) / (totalRows - 1)) : 0;
    const totalHeight = dotSize + (totalRows - 1) * spacingY;
    const yOffset = (availableHeight - totalHeight) / 2;
    
    // Horizontal layout calculations
    const row = Math.floor(idx / itemsPerRow);
    const col = idx % itemsPerRow;
    
    // Center the columns inside the container width
    const itemsInThisRow = Math.min(itemsPerRow, count - row * itemsPerRow);
    const rowWidth = itemsInThisRow * gapX;
    const startX = (sWidth - rowWidth) / 2;
    
    return {
      x: Math.round(sLeft + startX + col * gapX + (gapX - dotSize) / 2),
      y: Math.round(sTop + 36 + yOffset + row * spacingY)
    };
  }, [count, shelfLayout, dotSize]);

  // Reset or update positions based on questions or dimensions
  useEffect(() => {
    const isMobile = dimensions.width < 640;
    // Ignore custom absolute positions in play mode on mobile to maintain responsiveness
    const customPositions = (isMobile && isPlayMode) ? [] : (question.config.customPositions || []);
    setDots(prev => {
      return Array.from({ length: count }).map((_, idx) => {
        const savedPos = customPositions.find(p => p.id === `tenframe-dot-${idx}`);
        const defaultPos = getTrayPos(idx, dimensions.width, dimensions.height);
        const existing = prev.find(d => d.id === `tenframe-dot-${idx}`);

        if (existing) {
          // If snapped, update to the actual cell location (recalculated for new parent dimensions)
          if (existing.snappedCell !== null) {
            const key = `${existing.snappedCell.frameIdx}-${existing.snappedCell.cellIdx}`;
            const cell = cellRefs.current[key];
            const parentRect = containerRef.current?.getBoundingClientRect();
            if (cell && parentRect) {
              const cellRect = cell.getBoundingClientRect();
              const cellCenterX = cellRect.left - parentRect.left + cellRect.width / 2;
              const cellCenterY = cellRect.top - parentRect.top + cellRect.height / 2;
              return {
                ...existing,
                x: Math.round(cellCenterX - dotSize / 2),
                y: Math.round(cellCenterY - dotSize / 2)
              };
            }
          }
          if (savedPos) {
            return { ...existing, x: savedPos.x, y: savedPos.y, snappedCell: null };
          }
          return { ...existing, x: defaultPos.x, y: defaultPos.y };
        }

        return {
          id: `tenframe-dot-${idx}`,
          emoji: obj.emoji,
          x: savedPos ? savedPos.x : defaultPos.x,
          y: savedPos ? savedPos.y : defaultPos.y,
          snappedCell: null
        };
      });
    });
  }, [question, count, dimensions, getTrayPos, obj.emoji, dotSize, isPlayMode]);

  const handleResetLayout = () => {
    sounds.playPop();
    const isMobile = w < 640;
    const framesStacked = isMobile && count > 10;
    const minFramesHeight = framesStacked ? 328 : 160;

    const defaultW = isMobile ? (w - 24) : Math.round(w * 0.5);
    const gapX = isMobile ? 36 : (count > 16 ? 38 : count > 10 ? 44 : 48);
    const maxItemsFit = Math.floor((defaultW - 16) / gapX);
    const itemsPerRow = Math.max(4, Math.min(maxItemsFit, count));
    const totalRows = Math.ceil(count / itemsPerRow);
    const defaultH = isMobile && totalRows > 2 ? 140 : TRAY_HEIGHT;

    const defaultX = isMobile ? 12 : Math.round((w - defaultW) / 2);
    const defaultY = Math.max(minFramesHeight + 16, h - 12 - defaultH);
    
    const tempLayout = { left: defaultX, top: defaultY, width: defaultW, height: defaultH };
    setShelfLayout(tempLayout);

    onUpdateQuestionConfig?.({
      customPositions: [],
      containerPositions: {},
      shelfDimensions: undefined
    } as any);

    const availableHeight = defaultH - 36;
    const spacingY = totalRows > 1 ? Math.min(24, (availableHeight - dotSize) / (totalRows - 1)) : 0;
    const totalHeight = dotSize + (totalRows - 1) * spacingY;
    const yOffset = (availableHeight - totalHeight) / 2;

    setDots(Array.from({ length: count }).map((_, idx) => {
      const row = Math.floor(idx / itemsPerRow);
      const col = idx % itemsPerRow;
      const itemsInThisRow = Math.min(itemsPerRow, count - row * itemsPerRow);
      const rowWidth = itemsInThisRow * gapX;
      const startX = (defaultW - rowWidth) / 2;
      return {
        id: `tenframe-dot-${idx}`,
        emoji: obj.emoji,
        x: Math.round(defaultX + startX + col * gapX + (gapX - dotSize) / 2),
        y: Math.round(defaultY + 36 + yOffset + row * spacingY),
        snappedCell: null
      };
    }));
  };

  const handleAutoLayout = () => {
    sounds.playPop();
    const autoPositions = Array.from({ length: count }).map((_, idx) => {
      const pos = getTrayPos(idx, w, h);
      return {
        id: `tenframe-dot-${idx}`,
        x: pos.x,
        y: pos.y
      };
    });
    setDots(prev => prev.map((d, idx) => ({ ...d, x: autoPositions[idx].x, y: autoPositions[idx].y, snappedCell: null })));
    onUpdateQuestionConfig?.({
      customPositions: autoPositions
    });
  };

  const handleShelfMoveDown = (e: React.PointerEvent) => {
    if (isPlayMode) return;
    e.stopPropagation();
    sounds.playPop();
    setShelfDrag('move');
    shelfDragStart.current = { mx: e.clientX, my: e.clientY };
    shelfDragStartLayout.current = { ...shelfLayout };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handleShelfResizeDown = (e: React.PointerEvent) => {
    if (isPlayMode) return;
    e.stopPropagation();
    sounds.playPop();
    setShelfDrag('resize');
    shelfDragStart.current = { mx: e.clientX, my: e.clientY };
    shelfDragStartLayout.current = { ...shelfLayout };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    reportActivity();
    sounds.playPop();
    setActiveDragId(id);

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
    if (!containerRef.current) return;

    if (!isPlayMode && shelfDrag) {
      const dx = e.clientX - shelfDragStart.current.mx;
      const dy = e.clientY - shelfDragStart.current.my;
      const orig = shelfDragStartLayout.current;

      if (shelfDrag === 'move') {
        let nextX = Math.max(0, Math.min(w - orig.width, orig.left + dx));
        let nextY = Math.max(0, Math.min(h - orig.height, orig.top + dy));
        if (showGrid) {
          nextX = Math.round(nextX / GRID_STEP) * GRID_STEP;
          nextY = Math.round(nextY / GRID_STEP) * GRID_STEP;
        }
        setShelfLayout(prev => ({ ...prev, left: nextX, top: nextY }));
      } else {
        let nextW = Math.max(160, Math.min(w - orig.left, orig.width + dx));
        let nextH = Math.max(80, Math.min(h - orig.top, orig.height + dy));
        if (showGrid) {
          nextW = Math.round(nextW / GRID_STEP) * GRID_STEP;
          nextH = Math.round(nextH / GRID_STEP) * GRID_STEP;
        }
        setShelfLayout(prev => ({ ...prev, width: nextW, height: nextH }));
      }
      return;
    }

    if (!activeDragId) return;
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    let x = e.clientX - parentRect.left - dragOffset.current.x;
    let y = e.clientY - parentRect.top - dragOffset.current.y;

    // Boundary constraints
    x = Math.max(5, Math.min(parentRect.width - dotSize - 5, x));
    y = Math.max(5, Math.min(parentRect.height - dotSize - 5, y));

    // Grid snap in design mode
    if (!isPlayMode && showGrid) {
       x = Math.round(x / GRID_STEP) * GRID_STEP;
       y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    setDragPos({ x: Math.round(x), y: Math.round(y) });

    setDots(prev =>
      prev.map(d => (d.id === activeDragId ? { ...d, x: Math.round(x), y: Math.round(y), snappedCell: null } : d))
    );
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!isPlayMode && shelfDrag) {
      if (onUpdateQuestionConfig) {
        onUpdateQuestionConfig({
          containerPositions: {
            ...question.config.containerPositions,
            shelf: { x: shelfLayout.left, y: shelfLayout.top }
          },
          shelfDimensions: { width: shelfLayout.width, height: shelfLayout.height }
        } as any);
      }
      setShelfDrag(null);
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (!activeDragId) return;
    const dragId = activeDragId;
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;

    if (isPlayMode) {
      setDots(prev => {
        const item = prev.find(d => d.id === dragId);
        if (!item) return prev;

        const dotCenterX = item.x + dotSize / 2;
        const dotCenterY = item.y + dotSize / 2;

        let closestCell: { frameIdx: number; cellIdx: number } | null = null;
        let minDistance = 40; // generous snap tolerance

        for (const key in cellRefs.current) {
          const cell = cellRefs.current[key];
          if (!cell) continue;

          const cellRect = cell.getBoundingClientRect();
          const cellCenterX = cellRect.left - parentRect.left + cellRect.width / 2;
          const cellCenterY = cellRect.top - parentRect.top + cellRect.height / 2;

          const dist = Math.hypot(dotCenterX - cellCenterX, dotCenterY - cellCenterY);

          if (dist < minDistance) {
            const [fIdxStr, cIdxStr] = key.split("-");
            const fIdx = parseInt(fIdxStr);
            const cIdx = parseInt(cIdxStr);

            const isOccupied = prev.some(
              d => d.id !== dragId && d.snappedCell?.frameIdx === fIdx && d.snappedCell?.cellIdx === cIdx
            );

            if (!isOccupied) {
              minDistance = dist;
              closestCell = { frameIdx: fIdx, cellIdx: cIdx };
            }
          }
        }

        return prev.map(d => {
          if (d.id !== dragId) return d;
          if (closestCell !== null) {
            const key = `${closestCell.frameIdx}-${closestCell.cellIdx}`;
            const cell = cellRefs.current[key];
            if (cell) {
              const cellRect = cell.getBoundingClientRect();
              const cellCenterX = cellRect.left - parentRect.left + cellRect.width / 2;
              const cellCenterY = cellRect.top - parentRect.top + cellRect.height / 2;

              sounds.playTick(closestCell.frameIdx * 10 + closestCell.cellIdx + 1);
              return {
                ...d,
                snappedCell: closestCell,
                x: Math.round(cellCenterX - dotSize / 2),
                y: Math.round(cellCenterY - dotSize / 2)
              };
            }
          }
          if (d.snappedCell !== null) {
            sounds.playSlide();
          }
          const itemIdx = parseInt(dragId.split("-").pop() || "0");
          const defaultPos = getTrayPos(itemIdx, dimensions.width, dimensions.height);
          return {
            ...d,
            snappedCell: null,
            x: defaultPos.x,
            y: defaultPos.y
          };
        });
      });
    } else {
      // Design Mode: save custom positions
      setDots(prev => {
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: prev.map(item => ({ id: item.id, x: item.x, y: item.y }))
          });
        }
        return prev;
      });
    }

    setActiveDragId(null);
    setDragPos(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!isPlayMode && shelfDrag) {
      setShelfDrag(null);
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (!activeDragId) return;
    containerRef.current?.releasePointerCapture(e.pointerId);
    setActiveDragId(null);
    setDragPos(null);
  };

  // Compute stats
  const snappedList = dots.filter(d => d.snappedCell !== null);
  const frame1Count = snappedList.filter(d => d.snappedCell!.frameIdx === 0).length;
  const frame2Count = snappedList.filter(d => d.snappedCell!.frameIdx === 1).length;

  useEffect(() => {
    if (snappedList.length === count && count > 0) {
      sounds.playSuccess();
      if (onSuccess) onSuccess();
    }
  }, [snappedList.length]);

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";

  // Get currently dragged dot for alignment lines
  const draggedDot = activeDragId ? dots.find(d => d.id === activeDragId) : null;

  const isSolved = snappedList.length === count && count > 0;
  const remaining = count - snappedList.length;
  const tens = frame1Count === 10 ? 1 : 0;
  const ones = snappedList.length - tens * 10;

  const zoneClass = `rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 flex flex-col justify-between transition-colors duration-300 ${surfaceClass(isDark)}`;
  const zoneLabelClass = `font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${captionClass(isDark)}`;
  const renderFrame = (frameIdx: number, label: string, filled: number, numberBase: number) => (
    <div className={zoneClass}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className={zoneLabelClass}>{label}</span>
        <span className={`font-mono text-[10px] font-bold ${captionClass(isDark)}`}>{filled} / 10</span>
      </div>

      <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
        {Array.from({ length: 10 }).map((_, cellIdx) => {
          const key = `${frameIdx}-${cellIdx}`;
          const isCellFilled = dots.some(d => d.snappedCell?.frameIdx === frameIdx && d.snappedCell?.cellIdx === cellIdx);
          return (
            <div
              key={key}
              ref={el => { cellRefs.current[key] = el; }}
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl border-2 flex items-center justify-center transition-all duration-200 relative
                ${isCellFilled ? "border-transparent" : `border-dashed ${emptySlotClass(isDark)}`}`}
            >
              {!isCellFilled && (question.config.showNumbersInSlots ?? true) && (
                <span className="font-mono text-[9px] font-bold select-none opacity-60">{numberBase + cellIdx}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      accent={accent}
      headerIcon={<Grid2X2 size={16} />}
      headerTitle="Group Tens"
      headerSubtitle={`${tens} ten + ${ones} ${ones === 1 ? "one" : "ones"} = ${snappedList.length}`}
      readAloudText={question.instruction || `Group ${count} ${obj.label} into tens. Fill the ten-frame first, then place the extra ones.`}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? "All grouped" : `${remaining} to group`}
          </CanvasChip>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="xs" onClick={handleAutoLayout} title="Auto-arrange the shelf">
              <Grid2X2 size={12} />
              Auto Layout
            </Button>
            <Button type="button" variant="outline" size="xs" onClick={handleResetLayout} title="Reset layout">
              <RotateCcw size={12} />
              Reset
            </Button>
          </div>
        )
      }
      footerStatus={
        isSolved
          ? `${tens} ten and ${ones} ${ones === 1 ? "one" : "ones"} makes ${count}!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag the shelf to move · Resize corner \u2198"
      }
      footerSolved={isSolved}
      designerHint="Drag the shelf to reposition, or use the handles to resize."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full min-h-[300px] flex flex-col justify-between overflow-hidden touch-none select-none overscroll-none"
      >
        {/* Grid overlay in design mode */}
        {!isPlayMode && showGrid && (
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.15]">
            <svg width="100%" height="100%">
              <defs>
                <pattern id="gtens-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gtens-grid)" />
            </svg>
          </div>
        )}

        {/* Crosshair alignment guides on active drag */}
        {!isPlayMode && draggedDot && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ top: `${draggedDot.y + dotSize / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/40 pointer-events-none z-40"
              style={{ left: `${draggedDot.x + dotSize / 2}px` }}
            />
          </>
        )}

        {/* Ten-frames — stacked on mobile, side-by-side above */}
        <div className="relative flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch z-0">
          <GhostGuideOverlay
            show={showGhostGuide && !isSolved}
            label={"Drag items up into the ten-frame!"}
            isDark={isDark}
            labelPlacement="top"
          />
          {renderFrame(0, "Tens", frame1Count, 1)}
          {count > 10 && renderFrame(1, "Ones", frame2Count, 11)}
        </div>

        {/* Spacer so the flex column never overlaps the absolutely positioned shelf */}
        {(!isPlayMode || w >= 640) && (
          <div style={{ height: `${shelfLayout.height || 110}px` }} className="w-full shrink-0 pointer-events-none" />
        )}

        {/* Shelf — uncounted items */}
        <div
          ref={shelfRef}
          className={`rounded-3xl p-3.5 transition-colors duration-300 flex flex-col ${surfaceClass(isDark)}`}
          style={(isPlayMode && w < 640) ? {
            position: "relative",
            width: "100%",
            minHeight: `${count > 16 ? 140 : 110}px`,
            zIndex: 10
          } : {
            position: "absolute",
            left: `${shelfLayout.left}px`,
            top: `${shelfLayout.top}px`,
            width: `${shelfLayout.width}px`,
            height: `${shelfLayout.height}px`,
            zIndex: 10
          }}
        >
          {/* Grab-bar drag handle */}
          {!isPlayMode && (
            <div
              onPointerDown={handleShelfMoveDown}
              className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md border cursor-grab active:cursor-grabbing z-20 select-none
                transition-all duration-150
                ${shelfDrag === 'move'
                  ? 'bg-indigo-600 border-indigo-600 text-white scale-105 shadow-lg'
                  : isDark
                    ? 'bg-slate-800 border-violet-500/50 text-violet-300 hover:bg-slate-700'
                    : 'bg-white border-violet-300 text-violet-600 hover:bg-violet-50'
                }
              `}
            >
              <Move size={11} />
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider whitespace-nowrap">
                {shelfDrag === 'move' ? `X:${shelfLayout.left} Y:${shelfLayout.top}` : 'Drag to move'}
              </span>
            </div>
          )}

          {/* Resize handle */}
          {!isPlayMode && (
            <div
              onPointerDown={handleShelfResizeDown}
              style={{ touchAction: 'none' }}
              className={`absolute -bottom-2 -right-2 w-8 h-8 cursor-se-resize z-20 flex items-center justify-center rounded-full shadow-md border transition-all duration-150 select-none
                ${shelfDrag === 'resize'
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

          {/* Size tooltip on resize */}
          {!isPlayMode && shelfDrag === 'resize' && (
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[9px] px-2 py-0.5 rounded shadow z-50 pointer-events-none whitespace-nowrap">
              W: {shelfLayout.width}px · H: {shelfLayout.height}px
            </div>
          )}

          <span className={`${zoneLabelClass} pointer-events-none`}>
            {question.config.sourceBinLabel || "Shelf"}
          </span>
        </div>

        {/* Draggable dots */}
        {dots.map(dot => {
          const assetType = question.config?.assetType || "emoji";
          const isDragging = activeDragId === dot.id;
          const hasFrame = question.config.showItemFrame ?? true;
          const isSnapped = dot.snappedCell !== null;

          const transitionStyle = isDragging
            ? "none"
            : "left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.15s ease";

          let dotClassName = "flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing select-none touch-none transition-transform";
          if (hasFrame) {
            dotClassName += isSnapped
              ? ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
          }
          dotClassName += isDragging ? " scale-125 drop-shadow-xl z-50" : " drop-shadow-sm";

          return (
            <div
              key={dot.id}
              onPointerDown={(e) => handlePointerDown(e, dot.id)}
              style={{
                position: "absolute",
                left: `${dot.x}px`,
                top: `${dot.y}px`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                zIndex: isDragging ? 50 : 20,
                transition: transitionStyle
              }}
              className={dotClassName}
            >
              {/* Coordinate tooltip when dragging in design mode */}
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {dot.x}, {dot.y}
                </div>
              )}
              <CountingAsset type={assetType as any} emoji={dot.emoji} size={w < 640 ? 26 : 32} />
            </div>
          );
        })}
      </div>
    </SharedCanvasLayout>
  );
};
