import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ListOrdered } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentChipClass, emptySlotClass } from "./canvasTheme";
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

  const [items, setItems] = useState<LineUpItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const [dimensions, setDimensions] = useState({ width: 480, height: 280 });

  const solvedForGuide = items.length > 0 && items.every(i => i.snappedSlotIndex !== null);
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
          height: entry.contentRect.height || 280
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  /**
   * One geometry source of truth, derived from the measured container.
   *
   * Item and slot share a single `unit` size so a dropped item lands exactly in
   * its slot at any screen width, and the row always fits without scrolling —
   * that is what makes the phone layout hold together.
   */
  const geometry = useMemo(() => {
    const w = dimensions.width;
    const h = dimensions.height;
    const isCompact = w < 640;
    const sideInset = isCompact ? 8 : 16;
    const minGap = isCompact ? 6 : 10;

    const widthPerItem = (w - sideInset * 2 - minGap * Math.max(0, count - 1)) / Math.max(1, count);
    const unit = Math.max(34, Math.min(isCompact ? 56 : 64, Math.floor(widthPerItem)));

    const captionH = isCompact ? 18 : 22;
    const trayHeight = Math.round(unit + captionH + (isCompact ? 20 : 28));
    const stageTop = trayHeight + (isCompact ? 10 : 16);
    const stageHeight = Math.max(unit + captionH + 28, h - stageTop);

    const rowWidth = (gap: number) => count * unit + gap * Math.max(0, count - 1);
    const gapFor = (maxGap: number) => {
      const available = w - sideInset * 2 - count * unit;
      return Math.max(minGap, Math.min(maxGap, available / Math.max(1, count - 1)));
    };

    const trayGap = gapFor(isCompact ? 10 : 16);
    const slotGap = gapFor(isCompact ? 12 : 24);

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
      /** Snap radius scales with the objects so it stays thumb-friendly. */
      snapRadius: Math.max(48, unit * 1.15)
    };
  }, [dimensions.width, dimensions.height, count]);

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
    sounds.playPop();
    setItems(Array.from({ length: count }).map((_, idx) => ({
      id: `lineup-item-${idx}`,
      emoji: obj.emoji,
      x: getShelfX(idx),
      y: geometry.trayItemY,
      snappedSlotIndex: null
    })));
  };

  // ── Pointer-event based drag (no Framer Motion drag) ──

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

    // Boundary constraints
    x = Math.max(0, Math.min(parentRect.width - geometry.unit, x));
    y = Math.max(0, Math.min(parentRect.height - geometry.unit, y));

    // Grid snap in design mode
    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    // Smart drop zone detection in real-time
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
      // Check snap to slot
      setItems(prev => {
        const item = prev.find(i => i.id === id);
        if (!item) return prev;

        const itemCenterX = item.x + geometry.unit / 2;
        const itemCenterY = item.y + geometry.unit / 2;

        let snappedIndex: number | null = null;
        let minDistance = geometry.snapRadius; // matches the live drag detection

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
          // Return to shelf
          if (i.snappedSlotIndex !== null) sounds.playSlide();
          const itemIdx = parseInt(id.split("-").pop() || "0");
          return { ...i, snappedSlotIndex: null, x: getShelfX(itemIdx), y: geometry.trayItemY };
        });
      });
    } else {
      // Design Mode: persist positions
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

  // Success trigger
  useEffect(() => {
    if (items.length > 0 && items.every(i => i.snappedSlotIndex !== null)) {
      sounds.playSuccess();
      if (onSuccess) onSuccess();
    }
  }, [items.map(i => i.snappedSlotIndex).join(",")]);

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const borderStyle = question.config.slotBorderStyle === "solid"
    ? "border-solid"
    : question.config.slotBorderStyle === "dotted"
      ? "border-dotted"
      : "border-dashed";

  const linedUp = items.filter(i => i.snappedSlotIndex !== null).length;
  const remaining = count - linedUp;
  const isSolved = count > 0 && linedUp === count;
  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;

  // Zones are separated by elevation only; colour is reserved for live state.
  const zoneClass = `absolute rounded-3xl transition-colors duration-300 ${surfaceClass(isDark)}`;
  const zoneLabelClass = `absolute left-4 top-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] pointer-events-none ${captionClass(isDark)}`;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      accent={accent}
      headerIcon={<ListOrdered size={16} />}
      headerTitle="Line Up"
      headerSubtitle={`${linedUp} of ${count} lined up`}
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
        className="relative flex-1 w-full min-h-[240px] touch-none select-none overscroll-none"
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

        {/* Zone 1 — unordered tray */}
        <div
          className={`${zoneClass} left-0 right-0 pointer-events-none`}
          style={{ top: 0, height: `${geometry.trayHeight}px` }}
        >
          <span className={zoneLabelClass}>
            {question.config.sourceBinLabel || "Tray"}
          </span>
        </div>

        {/* Idle hint — highlights the slot row after 10s of inactivity */}
        <GhostGuideOverlay
          show={showGhostGuide && !isSolved}
          label={`Drag each ${obj.label} into the numbered slots!`}
          isDark={isDark}
          labelPlacement="top"
          style={{ top: geometry.stageTop, left: 0, right: 0, height: geometry.stageHeight }}
        />

        {/* Zone 2 — ordered line-up stage */}
        <div
          className={`${zoneClass} left-0 right-0 pointer-events-none`}
          style={{ top: `${geometry.stageTop}px`, height: `${geometry.stageHeight}px` }}
        >
          <span className={zoneLabelClass}>
            {question.config.destinationBinLabel || "Line-up"}
          </span>
        </div>

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
              className={`rounded-2xl border-2 ${borderStyle} flex items-center justify-center transition-all duration-200 font-mono font-bold
                ${isHovered
                  ? `${accentChipClass(accent, isDark)} border-solid scale-110`
                  : isFilled
                    ? "border-transparent"
                    : emptySlotClass(isDark)
                }`}
            >
              {(question.config.showNumbersInSlots ?? true) && (
                <span className={`text-xs ${isFilled ? "opacity-0" : ""}`}>{idx + 1}</span>
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

          let itemClassName = "flex items-center justify-center rounded-2xl select-none touch-none cursor-grab active:cursor-grabbing transition-transform";
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
                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 font-mono font-bold text-[9px] w-5 h-5 flex items-center justify-center rounded-full animate-scale-in z-10 ${accentChipClass(accent, isDark)}`}>
                  {(item.snappedSlotIndex ?? 0) + 1}
                </div>
              )}

              {/* Coordinate tooltip while dragging in design mode */}
              {!isPlayMode && isDragging && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {item.x}, {item.y}
                </div>
              )}

              <CountingAsset type={assetType as any} emoji={item.emoji} size={Math.round(geometry.unit * 0.7)} />
            </div>
          );
        })}
      </div>
    </SharedCanvasLayout>
  );
};
