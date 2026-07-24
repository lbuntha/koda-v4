import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CanvasProps } from "./types";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Grid, RotateCcw, Check, Calculator, AlertCircle, Delete } from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, surfaceClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { Button } from "../ui";

interface ArrayItem {
  id: string;
  row: number;
  col: number;
  isActive: boolean;
}

const GRID_STEP = 20;

export const MultiplicationCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  onSuccess,
  onUpdateQuestionConfig
}) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const assetType = question.config?.assetType || obj.assetType || "emoji";
  const rows = question.config.rows ?? 3;
  const cols = question.config.cols ?? 4;
  const targetCount = rows * cols;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [items, setItems] = useState<ArrayItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  // Answer Input State
  const [answerInput, setAnswerInput] = useState<string>("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "error" | "correct">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showNumberPad, setShowNumberPad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const [centerDimensions, setCenterDimensions] = useState({ width: 0, height: 0 });
  const [boxState, setBoxState] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [draggedPart, setDraggedPart] = useState<'move' | 'resize' | null>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const dragStartBox = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Measure the available center section dimensions
  useEffect(() => {
    if (!centerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCenterDimensions({
          width: entry.contentRect.width || 440,
          height: entry.contentRect.height || 200
        });
      }
    });
    ro.observe(centerRef.current);
    return () => ro.disconnect();
  }, []);

  const w = centerDimensions.width || 440;
  const h = centerDimensions.height || 200;

  // Reset answer state on question change
  useEffect(() => {
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [question.id, targetCount]);

  // Initialize boxState from saved config layout
  useEffect(() => {
    if (w > 0 && h > 0) {
      const isMobile = w < 640;
      const savedLayout = (isMobile && isPlayMode) ? null : question.config.arrayLayout;
      if (savedLayout) {
        setBoxState({
          x: savedLayout.x,
          y: savedLayout.y,
          width: savedLayout.width,
          height: savedLayout.height
        });
      }
    }
  }, [w, h, question.id, rows, cols, question.config.arrayLayout, isPlayMode]);

  // Initialize/reset array items
  useEffect(() => {
    const list: ArrayItem[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        list.push({
          id: `mult-${r}-${c}`,
          row: r,
          col: c,
          isActive: false
        });
      }
    }
    setItems(list);
  }, [rows, cols, question.id]);

  const handleToggleActive = (id: string) => {
    if (!isPlayMode) return;

    const target = items.find(it => it.id === id);
    if (!target) return;

    if (!target.isActive) {
      sounds.playTick();
    } else {
      sounds.playSlide();
    }

    const updated = items.map(it =>
      it.id === id ? { ...it, isActive: !it.isActive } : it
    );
    setItems(updated);

    const activeCount = updated.filter(it => it.isActive).length;
    if (activeCount === targetCount) {
      if (!requireAnswerInput) {
        successTimeoutRef.current = setTimeout(() => {
          sounds.playSuccess();
          onSuccessRef.current?.();
          successTimeoutRef.current = null;
        }, 300);
      } else {
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

    if (parsed === targetCount) {
      setAnswerStatus("correct");
      setErrorMessage("");
      sounds.playSuccess();
      successTimeoutRef.current = setTimeout(() => {
        onSuccessRef.current?.();
        successTimeoutRef.current = null;
      }, 500);
    } else {
      setAnswerStatus("error");
      setErrorMessage(`Not quite! ${rows} rows of ${cols} makes ${targetCount} ${obj.label}${targetCount === 1 ? "" : "s"}. Enter ${targetCount}!`);
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

  const handleBoxPointerDown = (e: React.PointerEvent) => {
    if (isPlayMode) return;
    e.stopPropagation();
    sounds.playPop();
    setDraggedPart('move');

    const parentRect = centerRef.current?.getBoundingClientRect();
    const boxRect = e.currentTarget.getBoundingClientRect();

    let startX = boxState.x;
    let startY = boxState.y;
    let startW = boxState.width;
    let startH = boxState.height;

    if (!question.config.arrayLayout && parentRect) {
      startX = boxRect.left - parentRect.left;
      startY = boxRect.top - parentRect.top;
      startW = boxRect.width;
      startH = boxRect.height;
      setBoxState({ x: startX, y: startY, width: startW, height: startH });
    }

    dragStartOffset.current = {
      x: e.clientX,
      y: e.clientY
    };
    dragStartBox.current = { x: startX, y: startY, width: startW, height: startH };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    sounds.playPop();
    setDraggedPart('resize');

    const parentRect = centerRef.current?.getBoundingClientRect();
    const boxEl = e.currentTarget.parentElement;
    const boxRect = boxEl?.getBoundingClientRect();

    let startX = boxState.x;
    let startY = boxState.y;
    let startW = boxState.width;
    let startH = boxState.height;

    if (!question.config.arrayLayout && parentRect && boxRect) {
      startX = boxRect.left - parentRect.left;
      startY = boxRect.top - parentRect.top;
      startW = boxRect.width;
      startH = boxRect.height;
      setBoxState({ x: startX, y: startY, width: startW, height: startH });
    }

    dragStartOffset.current = {
      x: e.clientX,
      y: e.clientY
    };
    dragStartBox.current = { x: startX, y: startY, width: startW, height: startH };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedPart) return;
    const dx = e.clientX - dragStartOffset.current.x;
    const dy = e.clientY - dragStartOffset.current.y;

    if (draggedPart === 'move') {
      let nextX = dragStartBox.current.x + dx;
      let nextY = dragStartBox.current.y + dy;

      nextX = Math.max(5, Math.min(w - boxState.width - 5, nextX));
      nextY = Math.max(5, Math.min(h - boxState.height - 5, nextY));

      if (showGrid) {
        nextX = Math.round(nextX / GRID_STEP) * GRID_STEP;
        nextY = Math.round(nextY / GRID_STEP) * GRID_STEP;
      }

      setBoxState(prev => ({ ...prev, x: nextX, y: nextY }));
    } else if (draggedPart === 'resize') {
      let nextW = dragStartBox.current.width + dx;
      let nextH = dragStartBox.current.height + dy;

      const minW = cols * 32 + 36;
      const minH = rows * 32 + 36;
      nextW = Math.max(minW, Math.min(w - boxState.x - 5, nextW));
      nextH = Math.max(minH, Math.min(h - boxState.y - 5, nextH));

      if (showGrid) {
        nextW = Math.round(nextW / GRID_STEP) * GRID_STEP;
        nextH = Math.round(nextH / GRID_STEP) * GRID_STEP;
      }

      setBoxState(prev => ({ ...prev, width: nextW, height: nextH }));
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedPart) return;

    if (onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        arrayLayout: {
          x: boxState.x,
          y: boxState.y,
          width: boxState.width,
          height: boxState.height
        }
      });
    }

    setDraggedPart(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!draggedPart) return;
    setBoxState({ ...dragStartBox.current });
    setDraggedPart(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleResetLayout = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);

    sounds.playPop();
    if (onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        arrayLayout: undefined
      });
    }
    setBoxState({ x: 0, y: 0, width: 0, height: 0 });
  };

  const activeCount = items.filter(it => it.isActive).length;
  const isArrayComplete = activeCount === targetCount;
  const solvedForGuide = isArrayComplete && (requireAnswerInput ? answerStatus === "correct" : true);
  const isSolved = solvedForGuide;

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });

  const isMobile = w < 640;
  const hasCustomLayout = isPlayMode ? false : (!!question.config.arrayLayout || draggedPart !== null);

  const paddingX = 32;
  const paddingY = 32;
  const gap = isMobile && cols > 6 ? 4 : cols > 5 ? 8 : 12;

  const currentW = hasCustomLayout ? boxState.width : Math.round(w * 0.9);
  const currentH = hasCustomLayout ? boxState.height : Math.round(h * 0.9);

  const availableW = currentW - paddingX - (cols - 1) * gap;
  const availableH = currentH - paddingY - (rows - 1) * gap;
  const itemSize = Math.max(isMobile ? 20 : 26, Math.min(96, Math.floor(availableW / cols), Math.floor(availableH / rows)));

  const boxStyle: React.CSSProperties = hasCustomLayout
    ? {
        position: "absolute",
        left: `${boxState.x}px`,
        top: `${boxState.y}px`,
        width: `${boxState.width}px`,
        height: `${boxState.height}px`
      }
    : {
        width: `${cols * itemSize + paddingX + (cols - 1) * gap}px`,
        height: `${rows * itemSize + paddingY + (rows - 1) * gap}px`,
        maxWidth: "95%",
        maxHeight: "95%"
      };

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      accent="emerald"
      headerIcon={<Grid size={16} />}
      headerTitle="Equal Groups"
      headerSubtitle={
        isArrayComplete && requireAnswerInput
          ? "Array complete! Enter the total product answer below."
          : `${rows} × ${cols} = ${activeCount}`
      }
      readAloudText={question.instruction || `Equal groups. ${rows} rows of ${cols} makes ${targetCount}. Tap each placeholder to build the array.`}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent="emerald" isDark={isDark}>
            {isSolved ? "Array complete" : `${rows} rows × ${cols} cols`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={handleResetLayout} title="Reset layout">
            <RotateCcw size={12} />
            Reset
          </Button>
        )
      }
      designerHint="Drag the array box to move it, or use the corner handle to resize."
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
                <pattern id="mult-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#10b981" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mult-grid)" />
            </svg>
          </div>
        )}

        {/* Array workspace */}
        <div ref={centerRef} className="flex-1 w-full flex items-center justify-center p-2 relative overflow-hidden z-0">
          {w > 0 && h > 0 && (
            <div
              onPointerDown={handleBoxPointerDown}
              style={boxStyle}
              className={`rounded-[2.4rem] flex flex-col items-center justify-center p-4 z-10 transition-colors duration-200 overflow-hidden ${surfaceClass(isDark)}
                ${!hasCustomLayout ? "m-auto" : ""}
                ${!isPlayMode ? "border-2 border-dashed border-indigo-400/60 cursor-grab" : ""}
                ${draggedPart === 'move' ? "border-solid border-indigo-500 cursor-grabbing" : ""}
              `}
            >
              <GhostGuideOverlay
                show={showGhostGuide && !isSolved}
                label={
                  isArrayComplete && requireAnswerInput
                    ? `Enter what ${rows} × ${cols} equals (${targetCount}) in the box!`
                    : `Tap the circles to build ${rows} rows of ${cols}!`
                }
                isDark={isDark}
                labelPlacement="top"
              />

              {/* Array grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                  width: `${cols * itemSize + (cols - 1) * gap}px`,
                  height: `${rows * itemSize + (rows - 1) * gap}px`
                }}
                className="m-auto"
              >
                {items.map(it => (
                  <button
                    key={it.id}
                    onClick={() => { reportActivity(); handleToggleActive(it.id); }}
                    style={{
                      width: `${itemSize}px`,
                      height: `${itemSize}px`
                    }}
                    className={`rounded-2xl flex items-center justify-center transition-all duration-150 cursor-pointer p-0.5
                      ${it.isActive
                        ? `${accentChipClass("emerald", isDark)} border-2 scale-105`
                        : `border-2 border-dashed ${emptySlotClass(isDark)} hover:scale-105`
                      }
                    `}
                  >
                    <div className={it.isActive ? "scale-110 filter drop-shadow-sm" : "opacity-25 filter grayscale scale-90"}>
                      <CountingAsset type={assetType as any} emoji={obj.emoji} size={itemSize - 10} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Resize corner handle in design mode */}
              {!isPlayMode && (
                <div
                  onPointerDown={handleResizePointerDown}
                  className="absolute bottom-2 right-2 w-6 h-6 cursor-se-resize flex items-end justify-end p-0.5 z-20 group"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="text-indigo-400 group-hover:text-indigo-650 transition-colors"
                  >
                    <path d="M12 20L20 12 M16 20L20 16 M8 20L20 8" />
                  </svg>
                </div>
              )}

              {/* Coordinate tooltip while dragging in design mode */}
              {!isPlayMode && draggedPart && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[9px] px-2 py-0.5 rounded shadow z-50 pointer-events-none whitespace-nowrap">
                  {draggedPart === 'move' ? `X: ${boxState.x}, Y: ${boxState.y}` : `W: ${boxState.width}px, H: ${boxState.height}px`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Answer Input Box Overlay after filling array ── */}
        <AnimatePresence>
          {isPlayMode && requireAnswerInput && isArrayComplete && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute inset-x-2 bottom-2 z-50 flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl backdrop-blur-md border shadow-2xl transition-all max-w-lg mx-auto"
              style={{
                backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
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
                  What is {rows} × {cols}? Enter the total number of {obj.label}{targetCount === 1 ? "" : "s"}!
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
                    placeholder="Product..."
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
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  }`}
                >
                  {answerStatus === "correct" ? <Check size={18} /> : "Check"}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowNumberPad(prev => !prev)}
                  className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
                    showNumberPad
                      ? "bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-600 dark:text-emerald-300"
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
