import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Sparkles, Hand, RotateCcw, Check, Calculator, AlertCircle, Delete } from "lucide-react";
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
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [tapOrder, setTapOrder] = useState<number[]>([]); // holds indices of tapped items in order
  const tapOrderRef = useRef<number[]>([]);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const [items, setItems] = useState<OneToOneItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // Answer Input State
  const [answerInput, setAnswerInput] = useState<string>("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "error" | "correct">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showNumberPad, setShowNumberPad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [dimensions, setDimensions] = useState({ width: 480, height: 260 });

  const isCountComplete = count > 0 && tapOrder.length === count;
  const solvedForGuide = count > 0 && (requireAnswerInput ? answerStatus === "correct" : isCountComplete);
  
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
          height: entry.contentRect.height || 260
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
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
  }, [question.id, count, isPlayMode]);

  useEffect(() => () => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
  }, []);

  // Responsive card size calculation based on container dimensions and object count
  const width = dimensions.width;
  const height = dimensions.height;
  const isMobile = width < 640;
  const isCompact = width < 460;

  let targetItemSize = isCompact ? 50 : isMobile ? 58 : 74;
  if (width < 540) {
    const usableW = Math.max(160, width - 32);
    if (count > 8) {
      targetItemSize = Math.max(36, Math.floor((usableW - 40) / 4));
    } else if (count > 5) {
      targetItemSize = Math.max(42, Math.floor((usableW - 32) / Math.min(count, 5)));
    }
  }
  const itemSize = Math.min(78, Math.max(34, targetItemSize));
  const assetSize = Math.max(20, Math.round(itemSize * 0.7));
  const offsetValue = itemSize / 2;

  // Compute item layout positions dynamically whenever dimensions or layout config changes
  useEffect(() => {
    const customPositions = question.config.customPositions || [];
    const layoutReference = question.config.layoutReference;
    const pattern = question.config.pattern || "grid";
    const scaleX = layoutReference?.width ? width / layoutReference.width : 1;
    const scaleY = layoutReference?.height ? height / layoutReference.height : 1;

    const safePadding = Math.max(12, Math.min(gridSize, 24));
    const minX = Math.min(safePadding, Math.max(0, (width - itemSize) / 2));
    const minY = Math.min(safePadding, Math.max(0, (height - itemSize) / 2));
    const maxX = Math.max(minX, width - itemSize - safePadding);
    const maxY = Math.max(minY, height - itemSize - safePadding);
    const usableWidth = Math.max(0, maxX - minX);
    const usableHeight = Math.max(0, maxY - minY);

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
        
        const rx = width > 200 ? Math.min(130, usableWidth * 0.44) : 0;
        const ry = height > 120 ? Math.min(75, usableHeight * 0.44) : 0;
        
        defaultX = (width - itemSize) / 2 + rx * Math.cos(angle);
        defaultY = (height - itemSize) / 2 + (height > 150 ? 16 : 0) - ry * Math.sin(angle);
      } else if (pattern === "wave") {
        const rx = usableWidth;
        const spacingX = count > 1 ? rx / (count - 1) : 0;
        defaultX = minX + idx * spacingX;
        defaultY = (height - itemSize) / 2 + Math.min(22, usableHeight * 0.25) * Math.sin((idx / Math.max(1, count)) * Math.PI * 2);
      } else if (pattern === "scatter") {
        const xPercent = [0.05, 0.4, 0.75, 0.15, 0.5, 0.8, 0.25, 0.6, 0.1, 0.45];
        const yPercent = [0.1, 0.5, 0.15, 0.45, 0.1, 0.5, 0.2, 0.4, 0.5, 0.2];
        defaultX = minX + xPercent[idx % xPercent.length] * usableWidth;
        defaultY = minY + yPercent[idx % yPercent.length] * usableHeight;
      } else if (pattern === "grid" || pattern === "columns" || pattern === "pairs") {
        const configuredCols = question.config.gridColumns || (pattern === "pairs" ? 2 : 0);
        const maxColsPossible = Math.max(1, Math.floor((usableWidth + 8) / (itemSize + 6)));
        const cols = Math.max(1, Math.min(count, configuredCols || Math.min(maxColsPossible, Math.ceil(Math.sqrt(count)))));
        const rows = Math.ceil(count / cols);
        const colIdx = idx % cols;
        const rowIdx = Math.floor(idx / cols);
        
        const colSpacing = cols > 1 ? Math.min(itemSize + 16, usableWidth / (cols - 1)) : 0;
        const rowSpacing = rows > 1 ? Math.min(itemSize + 14, usableHeight / (rows - 1)) : 0;
        
        const gridW = (cols - 1) * colSpacing;
        const gridH = (rows - 1) * rowSpacing;
        
        defaultX = (width - itemSize) / 2 - gridW / 2 + colIdx * colSpacing;
        defaultY = (height - itemSize) / 2 - gridH / 2 + rowIdx * rowSpacing;
      } else {
        // Line layout: Wrap into 2 rows if items exceed container width on mobile
        const maxItemsSingleRow = Math.max(1, Math.floor((usableWidth + 8) / (itemSize + 8)));
        if (count <= maxItemsSingleRow) {
          const spacingX = count > 1 ? Math.min(itemSize + 20, usableWidth / (count - 1)) : 0;
          const totalW = (count - 1) * spacingX;
          defaultX = Math.max(minX, (width - itemSize) / 2 - totalW / 2 + idx * spacingX);
          defaultY = Math.max(0, (height - itemSize) / 2);
        } else {
          const cols = Math.min(count, Math.max(2, Math.ceil(count / 2)));
          const rows = Math.ceil(count / cols);
          const colIdx = idx % cols;
          const rowIdx = Math.floor(idx / cols);
          const itemsInThisRow = rowIdx === rows - 1 ? count - rowIdx * cols : cols;
          const spacingX = itemsInThisRow > 1 ? Math.min(itemSize + 16, usableWidth / (itemsInThisRow - 1)) : 0;
          const spacingY = rows > 1 ? Math.min(itemSize + 14, usableHeight / (rows - 1)) : 0;
          const rowW = (itemsInThisRow - 1) * spacingX;
          const totalH = (rows - 1) * spacingY;
          defaultX = (width - itemSize) / 2 - rowW / 2 + colIdx * spacingX;
          defaultY = (height - itemSize) / 2 - totalH / 2 + rowIdx * spacingY;
        }
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
  }, [question.id, count, question.config.pattern, question.config.gridColumns, question.config.layoutReference?.width, question.config.layoutReference?.height, customPositionKey, gridSize, width, height, itemSize]);

  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    tapOrderRef.current = [];
    setTapOrder([]);
    setSparkles([]);
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
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
    const safePadding = Math.max(12, Math.min(gridSize, 24));

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
      const safePadding = Math.max(12, Math.min(gridSize, 24));
      const maxX = Math.max(safePadding, (currentStage?.clientWidth || dimensions.width) - itemSize - safePadding);
      const maxY = Math.max(safePadding, (currentStage?.clientHeight || dimensions.height) - itemSize - safePadding);
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
        x: item.x + offsetValue - 10,
        y: item.y + offsetValue - 10,
        color: ["text-violet-500", "text-pink-400", "text-emerald-400", "text-sky-400"][Math.floor(Math.random() * 4)]
      };
      setSparkles(prev => [...prev, newSparkle]);
    }

    if (newOrder.length === count) {
      if (!requireAnswerInput) {
        successTimeoutRef.current = setTimeout(() => {
          sounds.playSuccess();
          onSuccessRef.current?.();
          successTimeoutRef.current = null;
        }, 500);
      } else {
        // When counting is complete, focus input box after pop-up animation
        setTimeout(() => {
          inputRef.current?.focus();
        }, 350);
      }
    }
  };

  const handleCheckAnswer = (overrideValue?: string) => {
    const valueToTest = overrideValue !== undefined ? overrideValue : answerInput;
    const parsed = parseInt(valueToTest.trim(), 10);
    
    if (isNaN(parsed) || valueToTest.trim() === "") {
      setAnswerStatus("error");
      setErrorMessage("Please enter a number!");
      sounds.playFailure();
      return;
    }

    if (parsed === count) {
      setAnswerStatus("correct");
      setErrorMessage("");
      sounds.playSuccess();
      successTimeoutRef.current = setTimeout(() => {
        onSuccessRef.current?.();
        successTimeoutRef.current = null;
      }, 500);
    } else {
      setAnswerStatus("error");
      setErrorMessage(`Not quite! You counted ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`);
      sounds.playFailure();
    }
  };

  const handleDigitPress = (digit: string) => {
    if (answerStatus === "correct") return;
    if (answerStatus === "error") {
      setAnswerStatus("idle");
      setErrorMessage("");
    }
    setAnswerInput(prev => (prev.length < 3 ? prev + digit : prev));
  };

  const handleBackspacePress = () => {
    if (answerStatus === "correct") return;
    if (answerStatus === "error") {
      setAnswerStatus("idle");
      setErrorMessage("");
    }
    setAnswerInput(prev => prev.slice(0, -1));
  };

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
      headerSubtitle={
        isCountComplete && requireAnswerInput
          ? "Counting complete! Enter the total answer below."
          : `${count} ${obj.label}${count === 1 ? "" : "s"} • tap each object once`
      }
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
        className={`relative flex-1 w-full min-h-[260px] sm:min-h-[300px] rounded-[2rem] border-2 shadow-inner overflow-hidden select-none ${
          isDark ? "bg-slate-950/40 border-slate-700/80" : "bg-white/70 border-slate-200/80"
        }`}
      >
        <GhostGuideOverlay
          show={showGhostGuide && !solvedForGuide}
          label={
            isCountComplete && requireAnswerInput
              ? `Enter total count (${count}) in the answer box!`
              : `Tap each ${obj.label} once to count them!`
          }
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
            const offset = Math.min(30, dist * 0.35);
            const controlX = midX - (dy / (dist || 1)) * offset;
            const controlY = midY + (dx / (dist || 1)) * offset - Math.min(12, dist * 0.1);

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
                  r={itemSize < 48 ? 8 : 10}
                  className="fill-indigo-500 stroke-white stroke-2"
                />
                <text
                  x={controlX}
                  y={controlY + (itemSize < 48 ? 3 : 3.5)}
                  textAnchor="middle"
                  className={`fill-white font-mono font-bold ${itemSize < 48 ? "text-[8px]" : "text-[10px]"}`}
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
                if (e.detail === 0) handleTap(idx);
              }}
              disabled={isPlayMode && isTapped}
              aria-pressed={isTapped}
              style={{
                position: "absolute",
                width: `${itemSize}px`,
                height: `${itemSize}px`
              }}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 select-none touch-manipulation pointer-events-auto will-change-transform transition-[border-color,background-color,box-shadow] duration-150
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
                <div className={`absolute left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-bold font-mono rounded-full shadow-sm animate-scale-in ${
                  itemSize < 48 ? "-top-2 px-1.5 py-0 text-[9px]" : "-top-3 px-2 py-0.5 text-xs"
                }`}>
                  {tapSeq + 1}
                </div>
              )}
              
              {/* Object Asset */}
              <CountingAsset type={assetType as any} emoji={obj.emoji} size={assetSize} />

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
            className={`absolute ${sp.color} text-xl animate-ping z-40 pointer-events-none`}
            style={{ left: sp.x, top: sp.y }}
          >
            ✦
          </span>
        ))}

        {/* ── Answer Input Box Overlay after counting complete ── */}
        <AnimatePresence>
          {isPlayMode && requireAnswerInput && isCountComplete && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-x-2 bottom-2 z-50 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl backdrop-blur-md border shadow-2xl transition-all max-w-lg mx-auto"
              style={{
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)",
                borderColor: answerStatus === "error" 
                  ? "#ef4444" 
                  : answerStatus === "correct" 
                  ? "#10b981" 
                  : isDark ? "#334155" : "#cbd5e1"
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎉</span>
                <span className={`text-xs sm:text-sm font-extrabold tracking-tight ${
                  isDark ? "text-slate-100" : "text-slate-800"
                }`}>
                  How many {obj.label}{count === 1 ? "" : "s"} did you count in total?
                </span>
              </div>

              {/* Answer Input Controls */}
              <div className="flex items-center gap-2 w-full justify-center max-w-xs">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={answerInput}
                    onChange={(e) => {
                      setAnswerInput(e.target.value);
                      if (answerStatus === "error") {
                        setAnswerStatus("idle");
                        setErrorMessage("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCheckAnswer();
                    }}
                    placeholder="Total..."
                    disabled={answerStatus === "correct"}
                    className={`w-full h-11 px-3 text-center text-lg sm:text-xl font-bold font-mono rounded-xl border-2 transition-all outline-none ${
                      answerStatus === "error"
                        ? "border-red-500 bg-red-50/50 text-red-700 animate-shake dark:bg-red-950/40 dark:text-red-300"
                        : answerStatus === "correct"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : isDark
                        ? "bg-slate-900 border-slate-700 text-white focus:border-indigo-500"
                        : "bg-white border-slate-300 text-slate-900 focus:border-indigo-500"
                    }`}
                  />
                </div>

                <Button
                  onClick={() => handleCheckAnswer()}
                  disabled={answerStatus === "correct" || !answerInput.trim()}
                  className={`h-11 px-4 text-sm font-bold flex items-center gap-1.5 rounded-xl shadow-md transition-all active:scale-95 ${
                    answerStatus === "correct"
                      ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {answerStatus === "correct" ? <Check size={18} /> : "Check"}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowNumberPad(prev => !prev)}
                  className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
                    showNumberPad
                      ? "bg-indigo-100 border-indigo-400 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-600 dark:text-indigo-300"
                      : isDark
                      ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                      : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                  }`}
                  title="Toggle Number Pad"
                >
                  <Calculator size={18} />
                </button>
              </div>

              {/* Error feedback banner */}
              {answerStatus === "error" && errorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 font-bold mt-2 animate-fade-in text-center">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* On-screen Number Keypad for Kids / Mobile / Tablets */}
              <AnimatePresence>
                {showNumberPad && answerStatus !== "correct" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col items-center gap-2 overflow-hidden"
                  >
                    <div className="grid grid-cols-5 gap-1.5 w-full max-w-xs">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleDigitPress(String(num))}
                          className={`h-9 font-mono text-base font-extrabold rounded-lg border shadow-sm transition-all active:scale-95 ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 w-full max-w-xs">
                      <button
                        type="button"
                        onClick={handleBackspacePress}
                        className={`flex-1 h-8 text-xs font-extrabold rounded-lg border flex items-center justify-center gap-1 transition-all ${
                          isDark
                            ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                            : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <Delete size={14} /> Backspace
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnswerInput("")}
                        className={`px-3 h-8 text-xs font-extrabold rounded-lg border transition-all ${
                          isDark
                            ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                            : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Clear
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SharedCanvasLayout>
  );
};
