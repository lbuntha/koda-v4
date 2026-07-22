import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Sparkles, Hand, RotateCcw } from "lucide-react";
import { CanvasProps, Sparkle } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip } from "./canvasTheme";
import { Button } from "../ui";

interface OneToOneItem {
  id: string;
  x: number;
  y: number;
}

export const advanceOneToOneTapOrder = (currentOrder: number[], index: number, total: number) => {
  if (index < 0 || index >= total || currentOrder.includes(index)) return currentOrder;
  return [...currentOrder, index];
};

export const OneToOneCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const gridSize = question.config.layoutGridSize || 20;

  const [tapOrder, setTapOrder] = useState<number[]>([]); // holds indices of tapped items in order
  const tapOrderRef = useRef<number[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [items, setItems] = useState<OneToOneItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const [dimensions, setDimensions] = useState({ width: 480, height: 160 });

  const solvedForGuide = count > 0 && tapOrder.length === count;
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const customPositionKey = JSON.stringify(question.config.customPositions || []);
  onSuccessRef.current = onSuccess;

  // Measure container dimensions dynamically
  useEffect(() => {
    if (!stageRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 160
        });
      }
    });
    resizeObserver.observe(stageRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Reset game progress on question or count change
  useEffect(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    tapOrderRef.current = [];
    setTapOrder([]);
    setSparkles([]);
  }, [question.id, count, isPlayMode]);

  useEffect(() => () => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
  }, []);

  // Compute item layout positions dynamically whenever dimensions or layout config changes
  useEffect(() => {
    const customPositions = question.config.customPositions || [];
    const layoutReference = question.config.layoutReference;
    const pattern = question.config.pattern || "grid";
    const width = dimensions.width;
    const height = dimensions.height;
    const scaleX = layoutReference?.width ? width / layoutReference.width : 1;
    const scaleY = layoutReference?.height ? height / layoutReference.height : 1;

    // Responsive card size
    const isSmall = width < 450;
    const itemWidth = isSmall ? 64 : 80;
    const itemHeight = isSmall ? 64 : 80;
    const safePadding = Math.max(16, Math.min(gridSize, 28));

    const minX = Math.min(safePadding, Math.max(0, (width - itemWidth) / 2));
    const minY = Math.min(safePadding, Math.max(0, (height - itemHeight) / 2));
    const maxX = Math.max(minX, width - itemWidth - safePadding);
    const maxY = Math.max(minY, height - itemHeight - safePadding);
    const usableWidth = Math.max(0, maxX - minX);
    const usableHeight = Math.max(0, maxY - minY);
    const centerX = width / 2;
    const centerY = height / 2;
    const hasCompleteCustomLayout = customPositions.length === count
      && Array.from({ length: count }).every((_, idx) =>
        customPositions.some(position => position.id === `item-1to1-${idx}`)
      );
    const clampX = (value: number) => Math.max(minX, Math.min(maxX, value));
    const clampY = (value: number) => Math.max(minY, Math.min(maxY, value));

    const newItems = Array.from({ length: count }).map((_, idx) => {
      const savedPos = customPositions.find(p => p.id === `item-1to1-${idx}`);
      
      let defaultX = 0;
      let defaultY = 0;

      if (pattern === "circle") {
        const startAngle = Math.PI * 0.85;
        const endAngle = Math.PI * 0.15;
        const deltaAngle = count > 1 ? (startAngle - endAngle) / (count - 1) : 0;
        const angle = startAngle - idx * deltaAngle;
        
        const rx = width > 200 ? Math.min(140, usableWidth * 0.45) : 0;
        const ry = height > 120 ? Math.min(80, usableHeight * 0.5) : 0;
        
        defaultX = (width - itemWidth) / 2 + rx * Math.cos(angle);
        defaultY = (height - itemHeight) / 2 + (height > 150 ? 20 : 0) - ry * Math.sin(angle);
      } else if (pattern === "wave") {
        const rx = usableWidth;
        const spacingX = count > 1 ? rx / (count - 1) : 0;
        defaultX = minX + idx * spacingX;
        defaultY = (height - itemHeight) / 2 + 25 * Math.sin((idx / Math.max(1, count)) * Math.PI * 2);
      } else if (pattern === "scatter") {
        const xPercent = [0.05, 0.4, 0.75, 0.15, 0.5, 0.8, 0.25, 0.6, 0.1, 0.45];
        const yPercent = [0.1, 0.5, 0.15, 0.45, 0.1, 0.5, 0.2, 0.4, 0.5, 0.2];
        defaultX = minX + xPercent[idx % xPercent.length] * usableWidth;
        defaultY = minY + yPercent[idx % yPercent.length] * usableHeight;
      } else if (pattern === "grid" || pattern === "columns" || pattern === "pairs") {
        const configuredCols = question.config.gridColumns || (pattern === "pairs" ? 2 : 0);
        const cols = Math.max(1, Math.min(count, configuredCols || Math.ceil(Math.sqrt(count))));
        const rows = Math.ceil(count / cols);
        const colIdx = idx % cols;
        const rowIdx = Math.floor(idx / cols);
        
        const colSpacing = cols > 1 ? Math.min(itemWidth + 24, usableWidth / (cols - 1)) : 0;
        const rowSpacing = rows > 1 ? Math.min(itemHeight + 20, usableHeight / (rows - 1)) : 0;
        
        const gridW = (cols - 1) * colSpacing;
        const gridH = (rows - 1) * rowSpacing;
        
        defaultX = (width - itemWidth) / 2 - gridW / 2 + colIdx * colSpacing;
        defaultY = (height - itemHeight) / 2 - gridH / 2 + rowIdx * rowSpacing;
      } else {
        // Line layout: use itemWidth + 16 for cleaner spacing (no overlap if there's space)
        const spacingX = count > 1 ? Math.min(itemWidth + 24, usableWidth / (count - 1)) : 0;
        const totalW = (count - 1) * spacingX;
        defaultX = Math.max(minX, (width - itemWidth) / 2 - totalW / 2 + idx * spacingX);
        defaultY = Math.max(0, (height - itemHeight) / 2);
      }

      const scaledSavedX = savedPos ? savedPos.x * scaleX : defaultX;
      const scaledSavedY = savedPos ? savedPos.y * scaleY : defaultY;

      return {
        id: `item-1to1-${idx}`,
        x: Math.round(clampX(hasCompleteCustomLayout ? scaledSavedX : defaultX)),
        y: Math.round(clampY(hasCompleteCustomLayout ? scaledSavedY : defaultY))
      };
    });
    setItems(newItems);
  }, [question.id, count, question.config.pattern, question.config.gridColumns, question.config.layoutReference?.width, question.config.layoutReference?.height, customPositionKey, gridSize, dimensions.width, dimensions.height]);

  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    tapOrderRef.current = [];
    setTapOrder([]);
    setSparkles([]);
  };

  const getStagePointer = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    const scaleX = rect.width > 0 ? stage.clientWidth / rect.width : 1;
    const scaleY = rect.height > 0 ? stage.clientHeight / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlayMode) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!stageRef.current) return;
    
    const item = items.find((i) => i.id === id);
    if (!item) return;

    sounds.playPop();
    setDraggedItemId(id);

    const pointer = getStagePointer(e);
    if (!pointer) return;

    dragOffset.current = {
      x: pointer.x - item.x,
      y: pointer.y - item.y
    };

    stageRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId || !stageRef.current || isPlayMode) return;
    e.preventDefault();
    e.stopPropagation();

    const pointer = getStagePointer(e);
    if (!pointer) return;
    const isSmall = dimensions.width < 450;
    const itemSize = isSmall ? 64 : 80;
    const safePadding = Math.max(16, Math.min(gridSize, 28));

    let newX = pointer.x - dragOffset.current.x;
    let newY = pointer.y - dragOffset.current.y;

    newX = Math.max(safePadding, Math.min(stageRef.current.clientWidth - itemSize - safePadding, newX));
    newY = Math.max(safePadding, Math.min(stageRef.current.clientHeight - itemSize - safePadding, newY));

    setItems((prev) =>
      prev.map((item) => (item.id === draggedItemId ? { ...item, x: Math.round(newX), y: Math.round(newY) } : item))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId || isPlayMode) return;
    e.stopPropagation();
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const releasedId = draggedItemId;
    setDraggedItemId(null);

    setItems(prev => {
      const currentStage = stageRef.current;
      const currentItemSize = dimensions.width < 450 ? 64 : 80;
      const safePadding = Math.max(16, Math.min(gridSize, 28));
      const maxX = Math.max(safePadding, (currentStage?.clientWidth || dimensions.width) - currentItemSize - safePadding);
      const maxY = Math.max(safePadding, (currentStage?.clientHeight || dimensions.height) - currentItemSize - safePadding);
      const updated = prev.map(item => {
        if (item.id !== releasedId) return item;
        const snappedX = showGrid ? Math.round(item.x / gridSize) * gridSize : item.x;
        const snappedY = showGrid ? Math.round(item.y / gridSize) * gridSize : item.y;
        const nextX = Math.max(safePadding, Math.min(maxX, snappedX));
        const nextY = Math.max(safePadding, Math.min(maxY, snappedY));
        return { ...item, x: nextX, y: nextY };
      });

      onUpdateQuestionConfig?.({
        customPositions: updated.map(item => ({ id: item.id, x: item.x, y: item.y })),
        layoutReference: {
          width: currentStage?.clientWidth || dimensions.width,
          height: currentStage?.clientHeight || dimensions.height
        }
      });

      return updated;
    });
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setDraggedItemId(null);
  };

  const handleTap = (index: number) => {
    if (!isPlayMode) return;
    reportActivity();
    const newOrder = advanceOneToOneTapOrder(tapOrderRef.current, index, count);
    if (newOrder === tapOrderRef.current) return;

    tapOrderRef.current = newOrder;
    setTapOrder(newOrder);

    const nextNumber = newOrder.length;
    sounds.playTick(nextNumber);

    // Add sparkle at the item center
    const item = items[index];
    if (item) {
      const newSparkle: Sparkle = {
        id: Date.now(),
        x: item.x + 40,
        y: item.y + 40,
        color: ["text-violet-500", "text-pink-400", "text-emerald-400", "text-sky-400"][Math.floor(Math.random() * 4)]
      };
      setSparkles(prev => [...prev, newSparkle]);
    }

    if (newOrder.length === count) {
      successTimeoutRef.current = setTimeout(() => {
        sounds.playSuccess();
        onSuccessRef.current?.();
        successTimeoutRef.current = null;
      }, 500);
    }
  };

  const isSmall = dimensions.width < 450;
  const itemSize = isSmall ? 64 : 80;
  const offsetValue = itemSize / 2;
  const draggedItem = draggedItemId ? items.find(item => item.id === draggedItemId) : null;
  const countedText = `${tapOrder.length}/${count}`;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      showGrid={showGrid}
      isDark={isDark}
      gridSize={gridSize}
      showRulers={question.config.showLayoutRulers ?? true}
      accent="emerald"
      headerIcon={<Sparkles size={15} />}
      headerTitle="One-to-One Correspondence"
      headerSubtitle={`${count} ${obj.label}${count === 1 ? "" : "s"} • tap each object once`}
      readAloudText={question.instruction || `Count ${count} ${obj.label}${count === 1 ? "" : "s"} one by one.`}
      headerActions={
        <CanvasChip accent="emerald" isDark={isDark}>
          {countedText}
        </CanvasChip>
      }
      designerHint="Drag objects smoothly, then release to align to the grid."
    >
      <div 
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`relative flex-1 w-full min-h-[260px] rounded-[2rem] border-2 shadow-inner overflow-hidden touch-none select-none ${
          isDark ? "bg-slate-950/40 border-slate-700/80" : "bg-white/70 border-slate-200/80"
        }`}
      >
        <GhostGuideOverlay
          show={showGhostGuide && !solvedForGuide}
          label={`Tap each ${obj.label} once to count them!`}
          isDark={isDark}
          labelPlacement="top"
        />
        <div className="absolute inset-0 bg-radial from-slate-100/50 via-transparent to-transparent pointer-events-none" />

        {!isPlayMode && draggedItem && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-indigo-400/50 pointer-events-none z-40"
              style={{ top: `${draggedItem.y + offsetValue}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-indigo-400/50 pointer-events-none z-40"
              style={{ left: `${draggedItem.x + offsetValue}px` }}
            />
          </>
        )}

        {/* SVG Curve Arrows for Counting */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {tapOrder.map((currIndex, idx) => {
            if (idx === 0) return null;
            const prevIndex = tapOrder[idx - 1];
            
            const p1 = items[prevIndex];
            const p2 = items[currIndex];
            if (!p1 || !p2) return null;

            const startX = p1.x + offsetValue;
            const startY = p1.y + offsetValue;
            const endX = p2.x + offsetValue;
            const endY = p2.y + offsetValue;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const dx = endX - startX;
            const dy = endY - startY;
            const dist = Math.hypot(dx, dy);

            // Perpendicular curved offset upward
            const offset = Math.min(35, dist * 0.35);
            const controlX = midX - (dy / (dist || 1)) * offset;
            const controlY = midY + (dx / (dist || 1)) * offset - Math.min(15, dist * 0.1);

            return (
              <g key={idx} className="animate-fade-in">
                <path
                  d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  className="stroke-indigo-400"
                />
                <circle
                  cx={controlX}
                  cy={controlY}
                  r="10"
                  className="fill-indigo-500 stroke-white stroke-2"
                />
                <text
                  x={controlX}
                  y={controlY + 3.5}
                  textAnchor="middle"
                  className="fill-white font-mono text-[10px] font-bold"
                >
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Render Countable Objects */}
        {items.map((item, idx) => {
          const isTapped = tapOrder.includes(idx);
          const tapSeq = tapOrder.indexOf(idx);
          const assetType = question.config?.assetType || "emoji";
          
          return (
            <motion.button
              key={item.id}
              id={item.id}
              onPointerDown={(e) => {
                if (isPlayMode) {
                  e.preventDefault();
                  handleTap(idx);
                  return;
                }
                handlePointerDown(e, item.id);
              }}
              initial={false}
              animate={{
                x: item.x,
                y: item.y,
                scale: draggedItemId === item.id ? 1.06 : 1
              }}
              transition={{
                x: isPlayMode ? { type: "spring", stiffness: 650, damping: 38 } : { type: "tween", duration: 0.12 },
                y: isPlayMode ? { type: "spring", stiffness: 650, damping: 38 } : { type: "tween", duration: 0.12 },
                scale: { type: "tween", duration: 0.12 }
              }}
              onClick={(e) => {
                // Pointer input is handled immediately on pointer-down; detail 0 is keyboard activation.
                if (e.detail === 0) handleTap(idx);
              }}
              disabled={isPlayMode && isTapped}
              aria-pressed={isTapped}
              style={{
                position: "absolute",
              }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 select-none touch-none pointer-events-auto will-change-transform transition-[border-color,background-color,box-shadow] duration-150
                ${isSmall ? "w-16 h-16" : "w-20 h-20"}
                ${isPlayMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}
                ${draggedItemId === item.id ? "z-50 shadow-xl ring-2 ring-indigo-400/40" : "z-10"}
                ${isTapped 
                  ? "border-emerald-400 bg-emerald-50/50 shadow-md" 
                  : "border-slate-200 bg-white shadow-sm hover:border-indigo-400 hover:shadow-md active:border-indigo-500"
                }
              `}
            >
              {/* Ordinal number indicator */}
              {isTapped && (question.config.showNumbersOnTap ?? true) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-bold text-xs font-mono px-2 py-0.5 rounded-full shadow-sm animate-scale-in">
                  {tapSeq + 1}
                </div>
              )}
              
              {/* Object Asset */}
              <CountingAsset type={assetType as any} emoji={obj.emoji} size={isSmall ? 48 : 60} />

              {/* Hand icon invitation */}
              {isPlayMode && !isTapped && tapSeq === -1 && tapOrder.length === 0 && idx === 0 && (
                <div className="absolute -bottom-2 -right-2 bg-indigo-500 text-white p-1 rounded-full animate-bounce">
                  <Hand size={12} className="rotate-12" />
                </div>
              )}
            </motion.button>
          );
        })}

        {/* Sparkle FX Overlay */}
        {sparkles.map(sp => (
          <span
            key={sp.id}
            className={`absolute ${sp.color} text-xl animate-ping z-40`}
            style={{ left: sp.x, top: sp.y }}
          >
            ✦
          </span>
        ))}
      </div>
    </SharedCanvasLayout>
  );
};
