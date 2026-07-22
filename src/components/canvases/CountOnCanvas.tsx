import React, { useState, useEffect, useRef, useCallback } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ArrowRightCircle } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { Button } from "../ui";

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

/** Tailwind needs literal class names, so the counting path has its own map. */
const PATH_COLORS: Record<CanvasAccent, { stroke: string; fill: string }> = {
  indigo: { stroke: "stroke-indigo-400", fill: "fill-indigo-500" },
  violet: { stroke: "stroke-violet-400", fill: "fill-violet-500" },
  emerald: { stroke: "stroke-emerald-400", fill: "fill-emerald-500" },
  purple: { stroke: "stroke-purple-400", fill: "fill-purple-500" },
  rose: { stroke: "stroke-rose-400", fill: "fill-rose-500" },
  amber: { stroke: "stroke-amber-400", fill: "fill-amber-500" },
  slate: { stroke: "stroke-slate-400", fill: "fill-slate-500" }
};

interface CountOnDot {
  id: string;
  emoji: string;
  x: number;
  y: number;
  snappedSlotIndex: number | null; // null if in tray
}

// Layout constants
const BOX_SIZE = 120; // cardboard box dimensions
const GRID_STEP = 20;

export const CountOnCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const baseCount = question.config.baseCount || 5;
  const extraCount = question.config.extraCount || 3;

  const [dots, setDots] = useState<CountOnDot[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState({ width: 480, height: 320 });

  const solvedForGuide = dots.length > 0 && dots.every(d => d.snappedSlotIndex !== null);
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
  const dotSize = isMobile ? 44 : 56;
  const slotSize = isMobile ? 40 : 48;

  // Helper: get coordinates for the starting shelf/tray (bottom right or bottom center on mobile)
  const getTrayPos = useCallback((idx: number, w: number, h: number) => {
    const isMobile = w < 640;
    const trayWidth = 220;
    const trayStartX = isMobile ? (w - trayWidth) / 2 : w - trayWidth - 24;
    const trayY = isMobile ? h - 74 : h - 68; // vertically centered in tray
    const gapX = isMobile 
      ? Math.min(50, Math.floor(185 / Math.max(1, extraCount))) 
      : Math.min(56, Math.floor(200 / Math.max(1, extraCount)));
    
    // Center dots horizontally inside the tray container width
    const totalRowWidth = extraCount * gapX;
    const offsetInsideTray = (trayWidth - totalRowWidth) / 2;

    return {
      x: Math.round(trayStartX + offsetInsideTray + idx * gapX + (gapX - dotSize) / 2),
      y: Math.round(trayY)
    };
  }, [extraCount, dotSize]);

  // Helper: get coordinates for slots (middle right)
  const getSlotCenter = useCallback((idx: number, w: number, h: number) => {
    const isMobile = w < 640;
    const dynamicSlotSize = isMobile ? 40 : 48;
    const slotsStartX = isMobile ? 135 : w - 240;
    const slotsY = (h - dynamicSlotSize) / 2 - 10;
    const gapX = isMobile
      ? Math.max(36, Math.min(48, Math.floor((w - 150) / Math.max(1, extraCount))))
      : 64;
    return {
      x: Math.round(slotsStartX + idx * gapX + dynamicSlotSize / 2),
      y: Math.round(slotsY + dynamicSlotSize / 2)
    };
  }, [extraCount]);

  // Box positions (middle left)
  const boxX = w < 640 ? 12 : 40;
  const boxY = (h - BOX_SIZE) / 2 - 10;
  const boxCenterX = boxX + BOX_SIZE / 2;
  const boxCenterY = boxY + BOX_SIZE / 2;

  // Initialize dots
  useEffect(() => {
    const isMobile = dimensions.width < 640;
    const customPositions = (isMobile && isPlayMode) ? [] : (question.config.customPositions || []);
    setDots(prev => {
      return Array.from({ length: extraCount }).map((_, idx) => {
        const savedPos = customPositions.find(p => p.id === `counton-dot-${idx}`);
        const defaultTrayPos = getTrayPos(idx, dimensions.width, dimensions.height);
        const existing = prev.find(d => d.id === `counton-dot-${idx}`);

        if (existing) {
          if (existing.snappedSlotIndex !== null) {
            const center = getSlotCenter(existing.snappedSlotIndex, dimensions.width, dimensions.height);
            return {
              ...existing,
              x: Math.round(center.x - dotSize / 2),
              y: Math.round(center.y - dotSize / 2)
            };
          }
          if (savedPos) return { ...existing, x: savedPos.x, y: savedPos.y, snappedSlotIndex: null };
          return { ...existing, x: defaultTrayPos.x, y: defaultTrayPos.y };
        }

        return {
          id: `counton-dot-${idx}`,
          emoji: obj.emoji,
          x: savedPos ? savedPos.x : defaultTrayPos.x,
          y: savedPos ? savedPos.y : defaultTrayPos.y,
          snappedSlotIndex: null
        };
      });
    });
  }, [question, extraCount, dimensions, getTrayPos, getSlotCenter, obj.emoji, dotSize, isPlayMode]);

  const reset = () => {
    setDots(Array.from({ length: extraCount }).map((_, idx) => {
      const defaultTrayPos = getTrayPos(idx, dimensions.width, dimensions.height);
      return {
        id: `counton-dot-${idx}`,
        emoji: obj.emoji,
        x: defaultTrayPos.x,
        y: defaultTrayPos.y,
        snappedSlotIndex: null
      };
    }));
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, isClickable: boolean) => {
    if (!isClickable) return;
    reportActivity();
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

    // Boundary constraints
    x = Math.max(5, Math.min(parentRect.width - dotSize - 5, x));
    y = Math.max(5, Math.min(parentRect.height - dotSize - 5, y));

    // Grid snap in design mode
    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    if (isPlayMode) {
      const itemCenterX = x + dotSize / 2;
      const itemCenterY = y + dotSize / 2;
      const currentIdx = parseInt(draggedItemId.split("-").pop() || "0");

      let snapIdx: number | null = null;
      let minDistance = 75; // generous snap radius

      // Can only snap to its exact sequential slot index
      const c = getSlotCenter(currentIdx, dimensions.width, dimensions.height);
      const dist = Math.hypot(itemCenterX - c.x, itemCenterY - c.y);
      if (dist < minDistance) {
        snapIdx = currentIdx;
      }
      setHoveredSlotIndex(snapIdx);
    }

    setDots(prev => prev.map(d =>
      d.id === draggedItemId ? { ...d, x: Math.round(x), y: Math.round(y), snappedSlotIndex: null } : d
    ));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const id = draggedItemId;
    const currentIdx = parseInt(id.split("-").pop() || "0");

    if (isPlayMode) {
      setDots(prev => {
        const item = prev.find(d => d.id === id);
        if (!item) return prev;

        const itemCenterX = item.x + dotSize / 2;
        const itemCenterY = item.y + dotSize / 2;

        let snapped = false;
        const c = getSlotCenter(currentIdx, dimensions.width, dimensions.height);
        const dist = Math.hypot(itemCenterX - c.x, itemCenterY - c.y);

        if (dist < 75) {
          snapped = true;
        }

        return prev.map(d => {
          if (d.id !== id) return d;
          if (snapped) {
            sounds.playTick(baseCount + currentIdx + 1);
            return {
              ...d,
              snappedSlotIndex: currentIdx,
              x: Math.round(c.x - dotSize / 2),
              y: Math.round(c.y - dotSize / 2)
            };
          }
          if (d.snappedSlotIndex !== null) {
            sounds.playSlide();
          }
          const defaultTrayPos = getTrayPos(currentIdx, dimensions.width, dimensions.height);
          return {
            ...d,
            snappedSlotIndex: null,
            x: defaultTrayPos.x,
            y: defaultTrayPos.y
          };
        });
      });
    } else {
      // Design Mode: save custom positions
      setDots(prev => {
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: prev.map(d => ({ id: d.id, x: d.x, y: d.y }))
          });
        }
        return prev;
      });
    }

    setHoveredSlotIndex(null);
    setDraggedItemId(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    containerRef.current?.releasePointerCapture(e.pointerId);
    setDraggedItemId(null);
    setHoveredSlotIndex(null);
  };

  const handleBaseTap = () => {
    reportActivity();
    sounds.playTick(baseCount);
  };

  // Success trigger
  useEffect(() => {
    if (dots.length > 0 && dots.every(d => d.snappedSlotIndex !== null)) {
      sounds.playSuccess();
      if (onSuccess) onSuccess();
    }
  }, [dots.map(d => d.snappedSlotIndex !== null).join(",")]);

  const draggedItem = draggedItemId ? dots.find(d => d.id === draggedItemId) : null;

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const path = PATH_COLORS[accent];

  const placed = dots.filter(d => d.snappedSlotIndex !== null).length;
  const isSolved = extraCount > 0 && placed === extraCount;
  const total = baseCount + placed;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      accent={accent}
      headerIcon={<ArrowRightCircle size={16} />}
      headerTitle="Count On"
      headerSubtitle={`${baseCount} + ${placed} = ${total}`}
      readAloudText={question.instruction || `Start at ${baseCount}, then count on ${extraCount} more.`}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? `Counted on to ${total}` : `${extraCount - placed} more`}
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
          ? `${baseCount} and ${extraCount} more makes ${total}!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag items to set their starting positions"
      }
      footerSolved={isSolved}
      designerHint="Drag items to set where they start."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full flex flex-col overflow-hidden touch-none select-none overscroll-none"
      >
      {/* Grid overlay in design mode */}
      {!isPlayMode && showGrid && (
        <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.15]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="counton-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#counton-grid)" />
          </svg>
        </div>
      )}

      {/* Crosshair alignment guides in design mode */}
      {!isPlayMode && draggedItem && (
        <>
          <div
            className="absolute left-0 right-0 border-t border-dashed border-rose-400/40 pointer-events-none z-40"
            style={{ top: `${draggedItem.y + dotSize / 2}px` }}
          />
          <div
            className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/40 pointer-events-none z-40"
            style={{ left: `${draggedItem.x + dotSize / 2}px` }}
          />
        </>
      )}

      {/* Play Area */}
      <div className="relative flex-1 w-full mt-4">
        {/* Closed starting box with baseCount */}
        {(() => {
          const shape = question.config.containerShape || "box";
          let subtitle = "📦 Cardboard Box";
          let label = "Closed Container";

          if (shape === "chest") {
            subtitle = "🪙 Treasure Chest";
            label = "Treasure Chest";
          } else if (shape === "basket") {
            subtitle = "🧺 Fruit Basket";
            label = "Fruit Basket";
          } else if (shape === "mystery") {
            subtitle = "🔮 Mystery Chest";
            label = "Mystery Container";
          }

          return (
            <button
              onClick={handleBaseTap}
              style={{
                position: "absolute",
                left: `${boxX}px`,
                top: `${boxY}px`,
                width: `${BOX_SIZE}px`,
                height: `${BOX_SIZE}px`
              }}
              className={`rounded-3xl flex flex-col items-center justify-center p-3 transition-all active:scale-95 cursor-pointer z-10 group ${surfaceClass(isDark, "raised")}`}
            >
              <div className={`absolute -top-2.5 text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-[0.18em] ${captionClass(isDark)}`}>
                {label}
              </div>
              <span className={`text-4xl font-mono font-black transition-transform group-hover:scale-110 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                {baseCount}
              </span>
              <span className={`text-[9px] font-bold mt-1 truncate max-w-full ${captionClass(isDark)}`}>{subtitle}</span>
            </button>
          );
        })()}

        {/* Dynamic Curved Dotted Path (linked to actual cell centers) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {/* Subtle background guides connecting box to slots */}
          {Array.from({ length: extraCount }).map((_, idx) => {
            const center = getSlotCenter(idx, dimensions.width, dimensions.height);
            const startX = boxCenterX;
            const startY = boxCenterY;
            const endX = center.x;
            const endY = center.y;
            const controlY = Math.min(startY, endY) - 50;

            return (
              <path
                key={`bg-path-${idx}`}
                d={`M ${startX} ${startY} Q ${(startX + endX) / 2} ${controlY} ${endX} ${endY}`}
                fill="none"
                stroke={isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(99, 102, 241, 0.15)"}
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            );
          })}

          {dots.map((dot, idx) => {
            if (dot.snappedSlotIndex === null) return null;
            const center = getSlotCenter(dot.snappedSlotIndex, dimensions.width, dimensions.height);
            const startX = boxCenterX;
            const startY = boxCenterY;
            const endX = center.x;
            const endY = center.y;
            const controlY = Math.min(startY, endY) - 50;

            return (
              <g key={`path-${idx}`}>
                <path
                  d={`M ${startX} ${startY} Q ${(startX + endX) / 2} ${controlY} ${endX} ${endY}`}
                  fill="none"
                  strokeWidth="2.5"
                  strokeDasharray="5"
                  className={`${path.stroke} animate-pulse`}
                />
                <circle
                  cx={(startX + endX) / 2}
                  cy={controlY}
                  r="10"
                  className={`${path.fill} stroke-white stroke-2`}
                />
                <text
                  x={(startX + endX) / 2}
                  y={controlY + 3.5}
                  textAnchor="middle"
                  className="fill-white font-mono text-[9px] font-extrabold"
                >
                  {baseCount + idx + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Idle hint — highlights the numbered slots after 10s of inactivity */}
        {extraCount > 0 && (() => {
          const first = getSlotCenter(0, dimensions.width, dimensions.height);
          const last = getSlotCenter(extraCount - 1, dimensions.width, dimensions.height);
          const pad = slotSize;
          return (
            <GhostGuideOverlay
              show={showGhostGuide && !isSolved}
              label={`Count on from ${baseCount} — drag into the slots!`}
              isDark={isDark}
              labelPlacement="top"
              style={{
                left: first.x - pad,
                top: first.y - pad - 14,
                width: last.x - first.x + pad * 2,
                height: pad * 2 + 28
              }}
            />
          );
        })()}

        {/* Snapping Target Slots (middle right) */}
        {Array.from({ length: extraCount }).map((_, idx) => {
          const center = getSlotCenter(idx, dimensions.width, dimensions.height);
          const isFilled = dots.some(d => d.snappedSlotIndex === idx);
          const isHovered = hoveredSlotIndex === idx;

          let slotClass = "rounded-full border-2 flex items-center justify-center transition-all duration-200";
          if (isHovered) {
            slotClass += ` ${accentChipClass(accent, isDark)} border-solid scale-110`;
          } else if (isFilled) {
            slotClass += " border-transparent";
          } else {
            slotClass += ` border-dashed ${emptySlotClass(isDark)}`;
          }

          return (
            <div
              key={`slot-${idx}`}
              style={{
                position: "absolute",
                left: `${center.x - slotSize / 2}px`,
                top: `${center.y - slotSize / 2}px`,
                width: `${slotSize}px`,
                height: `${slotSize}px`,
                zIndex: 0
              }}
              className={slotClass}
            >
              <span className={`font-mono text-xs font-bold ${isFilled ? "opacity-0" : ""}`}>
                {baseCount + idx + 1}
              </span>
            </div>
          );
        })}

        {/* Shelf Tray (bottom center on mobile, bottom right on desktop) */}
        <div
          className={`absolute rounded-2xl pointer-events-none z-0 p-3 transition-colors duration-300 ${surfaceClass(isDark)}`}
          style={{
            left: `${isMobile ? Math.round((w - 220) / 2) : w - 240 - 24}px`,
            width: "220px",
            height: "80px",
            bottom: isMobile ? "12px" : "0px"
          }}
        >
          <span className={`absolute top-2 left-3 text-[9px] font-bold font-mono uppercase tracking-[0.18em] ${captionClass(isDark)}`}>
            Up next
          </span>
          {dots.filter(d => d.snappedSlotIndex === null).length === 0 && (
            <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-semibold ${captionClass(isDark)}`}>
              All counted
            </span>
          )}
        </div>

        {/* Draggable Objects */}
        {dots.map((dot, idx) => {
          const isDragging = draggedItemId === dot.id;
          const isClickable = idx === 0 || dots[idx - 1].snappedSlotIndex !== null;
          const assetType = question.config?.assetType || "emoji";
          const hasFrame = question.config.showItemFrame ?? true;

          let itemClassName = "flex flex-col items-center justify-center select-none touch-none rounded-xl";
          if (isClickable) {
            itemClassName += " cursor-grab active:cursor-grabbing";
          } else {
            itemClassName += " opacity-40 cursor-not-allowed";
          }

          if (hasFrame && isClickable) {
            itemClassName += dot.snappedSlotIndex !== null
              ? ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
            if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
          } else if (isClickable) {
            itemClassName += dot.snappedSlotIndex !== null ? " drop-shadow-md" : " drop-shadow-sm hover:drop-shadow-md";
            if (isDragging) itemClassName += " scale-125 drop-shadow-xl z-50";
          }

          const transitionStyle = isDragging
            ? "none"
            : "left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.15s ease";

          return (
            <div
              key={dot.id}
              onPointerDown={(e) => handlePointerDown(e, dot.id, isClickable)}
              style={{
                position: "absolute",
                left: `${dot.x}px`,
                top: `${dot.y}px`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                zIndex: isDragging ? 50 : 20,
                transition: transitionStyle
              }}
              className={itemClassName}
            >
              {dot.snappedSlotIndex !== null && (
                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold text-[9px] font-mono w-5 h-5 flex items-center justify-center rounded-full animate-scale-in ${accentChipClass(accent, isDark)}`}>
                  {baseCount + idx + 1}
                </div>
              )}

              {/* Coordinate tooltip when dragging in design mode */}
              {!isPlayMode && isDragging && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {dot.x}, {dot.y}
                </div>
              )}

              <CountingAsset type={assetType as any} emoji={dot.emoji} size={isMobile ? 28 : 36} />
            </div>
          );
        })}
      </div>
      </div>
    </SharedCanvasLayout>
  );
};
