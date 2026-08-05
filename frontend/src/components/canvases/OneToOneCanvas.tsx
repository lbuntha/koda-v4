import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Sparkles, Hand, RotateCcw, Check, Calculator, AlertCircle, Delete } from "lucide-react";
import { CanvasProps, Sparkle } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, accentChipClass, surfaceClass } from "./canvasTheme";
import { oneToOneLayout, sizeForCentres, STAGE_PADDING, type OneToOnePattern } from "./oneToOneLayout";
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

  /**
   * `null` until the stage has been measured.
   *
   * Objects are placed in stage pixels, so laying them out against a guessed
   * size and correcting afterwards puts them somewhere they never belonged.
   */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  /** Height the answer panel takes off the bottom of the stage, once it is open. */
  const [panelHeight, setPanelHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Measure the stage before paint, then keep following it.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const seed = stage.getBoundingClientRect();
    setDimensions({ width: seed.width || 480, height: seed.height || 260 });
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 260
        });
      }
    });
    resizeObserver.observe(stage);
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

  const width = dimensions?.width ?? 480;
  const height = dimensions?.height ?? 260;
  const pattern = (question.config.pattern || "grid") as OneToOnePattern;

  /**
   * The answer box takes the bottom of the stage, so the objects are laid out in
   * what is left of it. Reserving the space rather than floating the box over it
   * means the child can still see and count what they are being asked about.
   */
  const answerPanelOpen = isPlayMode && requireAnswerInput && isCountComplete;
  const layoutHeight = Math.max(120, height - (answerPanelOpen ? panelHeight + 12 : 0));

  /**
   * Positions and object size, derived together — see `oneToOneLayout`.
   *
   * A layout the teacher arranged by hand wins on positions, but still sets the
   * size from how close together they put things, so hand-placed objects grow on
   * a big screen too instead of staying at their authoring size.
   */
  const { items: laidOut, itemSize } = useMemo(() => {
    const auto = oneToOneLayout({
      count,
      width,
      height: layoutHeight,
      pattern,
      gridColumns: question.config.gridColumns
    });

    const customPositions = question.config.customPositions || [];
    const authored = Array.from({ length: count }).map((_, idx) =>
      customPositions.find(position => position.id === `item-1to1-${idx}`)
    );
    const hasCompleteCustomLayout = count > 0 && authored.every(Boolean);

    if (!hasCompleteCustomLayout) {
      return {
        itemSize: auto.size,
        items: auto.positions.map((position, idx) => ({ id: `item-1to1-${idx}`, ...position }))
      };
    }

    const reference = question.config.layoutReference;
    const scaleX = reference?.width ? width / reference.width : 1;
    const scaleY = reference?.height ? layoutHeight / reference.height : 1;
    const centres = authored.map(position => ({
      x: position!.x * scaleX,
      y: position!.y * scaleY
    }));
    const size = Math.min(
      auto.size,
      sizeForCentres(centres, { width: width - STAGE_PADDING * 2, height: layoutHeight - STAGE_PADDING * 2 })
    );

    return {
      itemSize: size,
      items: centres.map((centre, idx) => ({
        id: `item-1to1-${idx}`,
        x: Math.round(Math.max(0, Math.min(width - size, centre.x))),
        y: Math.round(Math.max(0, Math.min(layoutHeight - size, centre.y)))
      }))
    };
  }, [
    count,
    width,
    layoutHeight,
    pattern,
    question.config.gridColumns,
    question.config.layoutReference?.width,
    question.config.layoutReference?.height,
    customPositionKey
  ]);

  const assetSize = Math.round(itemSize * 0.7);
  const badgeSize = Math.round(Math.max(18, Math.min(32, itemSize * 0.3)));
  const offsetValue = itemSize / 2;
  // The counting trail is drawn between objects, so it is measured in objects too.
  const linkRadius = Math.round(Math.max(9, Math.min(20, itemSize * 0.17)));
  const linkStroke = Math.max(2, Math.round(itemSize * 0.035));

  // A drag in Design Mode moves an item from under the computed layout; the
  // layout takes over again whenever the question, the stage or the saved
  // positions change.
  useEffect(() => {
    setItems(laidOut);
  }, [laidOut]);

  /**
   * Measure the answer panel rather than guessing at its height — it grows by
   * about half again when the child opens the number pad, and the objects above
   * it have to move out of the way by exactly that much.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!answerPanelOpen || !panel) {
      setPanelHeight(0);
      return;
    }
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setPanelHeight(entry.contentRect.height);
    });
    observer.observe(panel);
    setPanelHeight(panel.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [answerPanelOpen, showNumberPad]);

  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * Hand the layout back to the chosen pattern.
   *
   * Dropping the authored positions is the whole reset: with nothing saved, the
   * pattern computes positions and size for whatever stage it lands on, which is
   * what a teacher wants after dragging objects into a corner.
   */
  const resetLayout = () => {
    onUpdateQuestionConfig?.({ customPositions: undefined, layoutReference: undefined });
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
      const maxX = Math.max(safePadding, (currentStage?.clientWidth || width) - itemSize - safePadding);
      const maxY = Math.max(safePadding, (currentStage?.clientHeight || height) - itemSize - safePadding);
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
          width: currentStage?.clientWidth || width,
          height: currentStage?.clientHeight || height
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
      headerActions={isPlayMode ? (
        <CanvasChip accent="emerald" isDark={isDark}>
          {solvedForGuide ? "All counted" : countedText}
        </CanvasChip>
      ) : (
        <>
          <CanvasChip accent="emerald" isDark={isDark}>{countedText}</CanvasChip>
          <Button type="button" variant="outline" size="xs" onClick={resetLayout} title="Reset to the chosen pattern">
            <RotateCcw size={12} />
            Reset
          </Button>
        </>
      )}
      footerSolved={solvedForGuide}
      footerStatus={
        solvedForGuide
          ? `All ${count} counted!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag objects to place them, or Reset to the pattern"
      }
      designerHint="Drag objects smoothly, then release to align to the grid."
    >
      <div 
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        /*
          One stage, sized like the bins in Move & Count: `flex-1` fills the
          launcher, and the floors stay modest so a short window cannot push the
          stage past the hint line. Elevation, not a border, marks the surface —
          the rule the rest of the canvases follow.
        */
        className={`relative flex-1 w-full min-h-[260px] sm:min-h-[300px] md:min-h-[340px] rounded-3xl overflow-hidden select-none ${surfaceClass(isDark)}`}
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

            // Perpendicular curved offset upward, scaled to the objects it links.
            const offset = Math.min(itemSize * 0.5, dist * 0.35);
            const controlX = midX - (dy / (dist || 1)) * offset;
            const controlY = midY + (dx / (dist || 1)) * offset - Math.min(itemSize * 0.2, dist * 0.1);

            return (
              <g key={idx} className="animate-fade-in">
                <path
                  d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
                  fill="none"
                  strokeWidth={linkStroke}
                  strokeDasharray={`${linkStroke * 1.8} ${linkStroke * 1.3}`}
                  strokeLinecap="round"
                  className="stroke-indigo-400"
                />
                <circle
                  cx={controlX}
                  cy={controlY}
                  r={linkRadius}
                  className="fill-indigo-500 stroke-white stroke-2"
                />
                <text
                  x={controlX}
                  y={controlY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: `${Math.round(linkRadius * 1.1)}px` }}
                  className="fill-white font-mono font-bold"
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
            <button
              key={item.id}
              id={item.id}
              type="button"
              onPointerDown={(e) => {
                if (isPlayMode) {
                  e.preventDefault();
                  handleTap(idx);
                  return;
                }
                handlePointerDown(e, item.id);
              }}
              onClick={(e) => {
                if (e.detail === 0) handleTap(idx);
              }}
              disabled={isPlayMode && isTapped}
              aria-pressed={isTapped}
              aria-label={`${obj.label} ${idx + 1}${isTapped ? `, counted ${tapSeq + 1}` : ", not counted yet"}`}
              /*
                Positioned with left/top and a CSS transition, the way the other
                counting canvases do it. A motion `animate` target was silently
                dropped when the layout was recomputed during mount — the state
                held the new position and the element stayed at the old one.
              */
              style={{
                position: "absolute",
                left: `${item.x}px`,
                top: `${item.y}px`,
                width: `${itemSize}px`,
                height: `${itemSize}px`,
                zIndex: draggedItemId === item.id ? 50 : 10,
                transition: draggedItemId === item.id
                  ? "none"
                  : "left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.15s ease"
              }}
              /* Untapped objects are raised surfaces, tapped ones take the accent —
                 the same two states, and the same theme tokens, as the other canvases. */
              className={`flex flex-col items-center justify-center select-none touch-manipulation pointer-events-auto
                will-change-transform transition-[border-color,background-color,box-shadow] duration-150
                ${itemSize > 88 ? "rounded-3xl" : "rounded-2xl"}
                ${isPlayMode ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}
                ${draggedItemId === item.id ? "scale-105 shadow-xl ring-2 ring-indigo-400/40" : ""}
                ${isTapped
                  ? `${accentChipClass("emerald", isDark)} border-2 shadow-md`
                  : `${surfaceClass(isDark, "raised")} border-0 shadow-sm hover:shadow-md`
                }
              `}
            >
              {/* Ordinal number indicator */}
              {isTapped && (question.config.showNumbersOnTap ?? true) && (
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-bold font-mono
                    rounded-full shadow-sm animate-scale-in flex items-center justify-center"
                  style={{
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                    fontSize: `${Math.round(badgeSize * 0.52)}px`
                  }}
                >
                  {tapSeq + 1}
                </div>
              )}

              {/* Object Asset */}
              <CountingAsset type={assetType as any} emoji={obj.emoji} size={assetSize} />

              {/* Hand icon invitation */}
              {isPlayMode && !isTapped && tapSeq === -1 && tapOrder.length === 0 && idx === 0 && (
                <div
                  className="absolute -bottom-2 -right-2 bg-indigo-500 text-white rounded-full animate-bounce flex items-center justify-center"
                  style={{ width: `${badgeSize}px`, height: `${badgeSize}px` }}
                >
                  <Hand size={Math.round(badgeSize * 0.6)} className="rotate-12" />
                </div>
              )}
            </button>
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
              ref={panelRef}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-x-2 bottom-2 z-50 flex flex-col items-center justify-center p-3 sm:p-4 md:p-5
                rounded-2xl md:rounded-3xl backdrop-blur-md border shadow-2xl max-w-lg md:max-w-xl mx-auto"
              style={{
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)",
                borderColor: answerStatus === "error" 
                  ? "#ef4444" 
                  : answerStatus === "correct" 
                  ? "#10b981" 
                  : isDark ? "#334155" : "#cbd5e1"
              }}
            >
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <span className="text-xl md:text-2xl">🎉</span>
                <span className={`text-xs sm:text-sm md:text-base lg:text-lg font-extrabold tracking-tight ${
                  isDark ? "text-slate-100" : "text-slate-800"
                }`}>
                  How many {obj.label}{count === 1 ? "" : "s"} did you count in total?
                </span>
              </div>

              {/* Answer Input Controls */}
              <div className="flex items-center gap-2 md:gap-3 w-full justify-center max-w-xs md:max-w-sm">
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
                    className={`w-full h-11 md:h-14 px-3 text-center text-lg sm:text-xl md:text-2xl font-bold font-mono rounded-xl border-2 transition-all outline-none ${
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
                  className={`h-11 md:h-14 px-4 md:px-6 text-sm md:text-base font-bold flex items-center gap-1.5 rounded-xl shadow-md transition-all active:scale-95 ${
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
                  className={`h-11 w-11 md:h-14 md:w-14 flex-shrink-0 flex items-center justify-center rounded-xl border transition-all ${
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
                    <div className="grid grid-cols-5 gap-1.5 md:gap-2 w-full max-w-xs md:max-w-sm">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleDigitPress(String(num))}
                          className={`h-9 md:h-12 font-mono text-base md:text-xl font-extrabold rounded-lg md:rounded-xl border shadow-sm transition-all active:scale-95 ${
                            isDark
                              ? "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 w-full max-w-xs md:max-w-sm">
                      <button
                        type="button"
                        onClick={handleBackspacePress}
                        className={`flex-1 h-8 md:h-10 text-xs md:text-sm font-extrabold rounded-lg border flex items-center justify-center gap-1 transition-all ${
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
                        className={`px-3 md:px-5 h-8 md:h-10 text-xs md:text-sm font-extrabold rounded-lg border transition-all ${
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
