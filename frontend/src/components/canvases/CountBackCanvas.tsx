import React, { useState, useEffect, useRef, useCallback } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Sparkles, MinusCircle } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";

interface CountBackItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  crossed: boolean;
}

// Layout constants
const GRID_STEP = 20;

export const CountBackCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const totalCount = question.config.totalCount || 8;
  const removeCount = question.config.removeCount || 3;

  const [items, setItems] = useState<CountBackItem[]>([]);
  const [crossOrder, setCrossOrder] = useState<string[]>([]); // holds ids of items as they are crossed out

  const solvedForGuide = removeCount > 0 && crossOrder.length === removeCount;
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [dimensions, setDimensions] = useState({ width: 480, height: 320 });

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
    const centerX = w / 2;
    const centerY = isMobile ? (h - 100) / 2 - 10 : (h - 80) / 2 + 10;

    // Grid layout for count back
    const columns = Math.min(totalCount, Math.ceil(Math.sqrt(totalCount)) + 1);
    const spacingX = isMobile ? Math.min(56, Math.floor((w - margin * 2) / columns)) : totalCount > 8 ? 60 : 72;
    const spacingY = isMobile ? 54 : totalCount > 8 ? 56 : 68;
    const col = index % columns;
    const row = Math.floor(index / columns);
    const totalRows = Math.ceil(totalCount / columns);

    return {
      x: Math.round(centerX - ((columns - 1) * spacingX) / 2 + col * spacingX - itemSize / 2),
      y: Math.round(centerY - ((totalRows - 1) * spacingY) / 2 + row * spacingY - itemSize / 2)
    };
  }, [totalCount]);

  // Initialize items
  useEffect(() => {
    const isMobile = dimensions.width < 640;
    const customPositions = (isMobile && isPlayMode) ? [] : (question.config.customPositions || []);
    setItems(prev => {
      return Array.from({ length: totalCount }).map((_, idx) => {
        const savedPos = customPositions.find(p => p.id === `back-item-${idx}`);
        const defaultPos = getCoordinates(idx, dimensions.width, dimensions.height);
        const existing = prev.find(i => i.id === `back-item-${idx}`);

        if (existing) {
          if (savedPos) return { ...existing, x: savedPos.x, y: savedPos.y };
          const prevDefault = getCoordinates(idx, dimensions.width, dimensions.height);
          return { ...existing, x: prevDefault.x, y: prevDefault.y };
        }

        return {
          id: `back-item-${idx}`,
          emoji: obj.emoji,
          x: savedPos ? savedPos.x : defaultPos.x,
          y: savedPos ? savedPos.y : defaultPos.y,
          crossed: false
        };
      });
    });
  }, [question, totalCount, dimensions, getCoordinates, obj.emoji, isPlayMode]);

  const reset = () => {
    setCrossOrder([]);
    setItems(prev =>
      prev.map((item, idx) => {
        const defaultPos = getCoordinates(idx, dimensions.width, dimensions.height);
        return {
          ...item,
          crossed: false,
          x: defaultPos.x,
          y: defaultPos.y
        };
      })
    );
  };

  const handleItemClick = (id: string) => {
    if (!isPlayMode) return;
    reportActivity();
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1 || items[idx].crossed) return;

    // Enforce right-to-left crossing out (or index totalCount - 1 down)
    const currentIdx = parseInt(id.split("-").pop() || "0");
    const expectedIndex = totalCount - 1 - crossOrder.length;

    if (currentIdx !== expectedIndex) {
      sounds.playFailure();
      return;
    }

    sounds.playTick(totalCount - crossOrder.length);
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, crossed: true } : item))
    );
    setCrossOrder(prev => [...prev, id]);
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlayMode) {
      handleItemClick(id);
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

    // Boundary constraints
    x = Math.max(5, Math.min(parentRect.width - itemSize - 5, x));
    y = Math.max(5, Math.min(parentRect.height - itemSize - 5, y));

    // Grid snap in design mode
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

    // Save design positions
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

  useEffect(() => {
    if (crossOrder.length === removeCount && removeCount > 0) {
      sounds.playSuccess();
      if (onSuccess) onSuccess();
    }
  }, [crossOrder.length, removeCount]);

  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;

  const frameColor = question.config.frameColor || "indigo";
  let itemBg = isDark ? "bg-slate-800/80 border-violet-500/40 text-violet-200 hover:border-cyan-400" : "bg-white border-slate-200 hover:border-violet-300";
  let nextRing = isDark ? "border-cyan-400 ring-4 ring-cyan-400/30 scale-105" : "border-indigo-400 ring-4 ring-indigo-400/20 scale-105";
  let crossedBg = isDark ? "bg-slate-900/60 border-rose-500/60 opacity-60 scale-95" : "bg-slate-200 border-rose-400 opacity-60 scale-95";
  let countdownBg = isDark ? "bg-slate-900/80 border-slate-700/80 text-slate-200 shadow-black/40" : "bg-white/90 border-slate-200 text-slate-700 shadow-sm";

  if (frameColor === "emerald") {
    itemBg = isDark ? "bg-slate-800/80 border-emerald-500/40 text-emerald-200 hover:border-teal-400" : "bg-white border-slate-200 hover:border-emerald-300";
    nextRing = isDark ? "border-teal-400 ring-4 ring-teal-400/30 scale-105" : "border-teal-500 ring-4 ring-teal-400/20 scale-105";
  } else if (frameColor === "purple") {
    itemBg = isDark ? "bg-slate-800/80 border-purple-500/40 text-purple-200 hover:border-fuchsia-400" : "bg-white border-slate-200 hover:border-purple-300";
    nextRing = isDark ? "border-fuchsia-400 ring-4 ring-fuchsia-400/30 scale-105" : "border-fuchsia-500 ring-4 ring-fuchsia-400/20 scale-105";
  } else if (frameColor === "pink" || frameColor === "rose" as any) {
    itemBg = isDark ? "bg-slate-800/80 border-rose-500/40 text-rose-200 hover:border-pink-400" : "bg-white border-slate-200 hover:border-rose-300";
    nextRing = isDark ? "border-pink-400 ring-4 ring-pink-400/30 scale-105" : "border-pink-500 ring-4 ring-pink-400/20 scale-105";
  }

  const seqSeq = [];
  for (let i = 0; i <= removeCount; i++) {
    seqSeq.push(totalCount - i);
  }
  const dynamicInstruction = `Start at ${totalCount} and tap/cross out items to count backward: ${seqSeq.join(", ")}!`;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      accent="rose"
      headerIcon={<MinusCircle size={16} />}
      headerTitle="Count Back"
      readAloudText={dynamicInstruction}
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
        label={`Start at ${totalCount} — tap items to count backward!`}
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
              <pattern id="back-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#back-grid)" />
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

      {/* Arena Stage */}
      <div className="relative flex-1 w-full mt-4">
        {items.map((item, idx) => {
          const expectedIndex = totalCount - 1 - crossOrder.length;
          const isExpectedNext = expectedIndex === idx;
          const assetType = question.config?.assetType || "emoji";
          const hasFrame = question.config.showItemFrame ?? true;
          const isDragging = draggedItemId === item.id;

          let itemClassName = "flex flex-col items-center justify-center select-none touch-none rounded-xl";
          if (isPlayMode) {
            itemClassName += item.crossed ? " cursor-default" : " cursor-pointer active:scale-95";
          } else {
            itemClassName += " cursor-grab active:cursor-grabbing";
          }

          if (hasFrame) {
            itemClassName += item.crossed
              ? ` ${crossedBg}`
              : isExpectedNext
                ? ` bg-white ${nextRing}`
                : ` ${itemBg} shadow-sm`;
            if (isDragging) itemClassName += " shadow-xl ring-2 ring-indigo-400/20 scale-110 z-50";
          } else {
            itemClassName += item.crossed
              ? " opacity-40 scale-95"
              : isExpectedNext
                ? " ring-2 ring-rose-400/40 scale-105 drop-shadow-md"
                : " hover:scale-105 drop-shadow-sm hover:drop-shadow-md";
            if (isDragging) itemClassName += " scale-125 drop-shadow-xl z-50";
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
                zIndex: isDragging ? 50 : 20,
                transition: transitionStyle
              }}
              className={itemClassName}
            >
              {/* Count Back indicators */}
              {item.crossed && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-rose-500 text-white font-bold text-[9px] font-mono w-5 h-5 flex items-center justify-center rounded-full shadow z-10 animate-scale-in">
                  {totalCount - crossOrder.indexOf(item.id)}
                </div>
              )}

              {/* X cross overlay */}
              {item.crossed && (() => {
                const crossStyle = question.config.crossOutStyle || "red_x";
                if (crossStyle === "slash") {
                  return (
                    <div className="absolute inset-0 rounded-2xl flex items-center justify-center font-black text-slate-500 text-3xl pointer-events-none select-none">
                      ╱
                    </div>
                  );
                }
                if (crossStyle === "fade") {
                  return (
                    <div className="absolute inset-0 bg-slate-400/25 rounded-2xl pointer-events-none select-none" />
                  );
                }
                return (
                  <div className="absolute inset-0 bg-rose-500/10 rounded-2xl flex items-center justify-center font-black text-rose-500 text-3xl pointer-events-none select-none">
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

              <CountingAsset type={assetType as any} emoji={obj.emoji} size={isMobile ? 36 : 44} />
            </div>
          );
        })}
      </div>

      {/* Dynamic Countdown Text */}
      <div className={`py-3 px-8 rounded-3xl border shadow-md text-center font-mono inline-block mx-auto mb-3 transition-all min-w-[140px] ${
        isDark 
          ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-black/40" 
          : "bg-white border-slate-200/85 text-slate-800 shadow-sm"
      }`}>
        <span className={`text-[10px] font-extrabold uppercase block tracking-widest mb-1.5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>Countdown</span>
        <div className={`flex flex-wrap items-center gap-2.5 justify-center text-4xl font-black`}>
          <span className={`font-black ${isDark ? "text-slate-100" : "text-slate-800"}`}>{totalCount}</span>
          {crossOrder.map((id, idx) => (
            <React.Fragment key={idx}>
              <span className="text-rose-450 text-rose-400 text-2xl font-normal">→</span>
              <span className="text-rose-500 font-extrabold">{totalCount - idx - 1}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      </div>
    </SharedCanvasLayout>
  );
};
