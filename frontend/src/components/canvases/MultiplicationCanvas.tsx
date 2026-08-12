import React, { useState, useEffect, useRef } from "react";
import { CanvasProps } from "./types";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { Grid, RotateCcw } from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, surfaceClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { CanvasAnswerPanel, useCanvasAnswer } from "./CanvasAnswerPanel";
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

  const activeCount = items.filter(it => it.isActive).length;
  const isArrayComplete = activeCount === targetCount;
  const answerPanelOpen = isPlayMode && requireAnswerInput && isArrayComplete;

  // Typing, checking and the success hand-off all live in the shared panel.
  const answer = useCanvasAnswer({
    expected: targetCount,
    resetKey: `${question.id}:${rows}x${cols}`,
    wrongMessage: `Not quite! ${rows} rows of ${cols} makes ${targetCount} ${obj.label}${targetCount === 1 ? "" : "s"}. Enter ${targetCount}!`,
    onSuccess,
    open: answerPanelOpen
  });

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

  /* The answer clears itself from its `resetKey`; all this has to drop is a
     pending hand-off from the no-answer-needed path below. */
  useEffect(() => {
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

    // With an answer required, the panel takes over — including focusing itself.
    if (updated.filter(it => it.isActive).length === targetCount && !requireAnswerInput) {
      successTimeoutRef.current = setTimeout(() => {
        sounds.playSuccess();
        onSuccessRef.current?.();
        successTimeoutRef.current = null;
      }, 300);
    }
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
    answer.reset();

    sounds.playPop();
    if (onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        arrayLayout: undefined
      });
    }
    setBoxState({ x: 0, y: 0, width: 0, height: 0 });
  };

  const solvedForGuide = isArrayComplete && (requireAnswerInput ? answer.solved : true);
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
      headerTitle="Equal Groups"
      /*
        The question leads — see `CountCanvas` for the standard.
      */
      questionText={question.instruction?.trim() || `How many altogether in ${rows} rows of ${cols}?`}
      /* The four moments, cast from Mascot Studio — see `casting.ts`. */
      guideRole={answer.status === "error" ? "oops" : isSolved ? "celebrating" : "waiting"}
      {...guidePropsFor(question)}
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
              className={`rounded-[2.4rem] flex flex-col items-center justify-center p-4 z-10 transition-colors duration-200 overflow-hidden ${surfaceClass(isDark, "panel")}
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

        <CanvasAnswerPanel
          answer={answer}
          open={answerPanelOpen}
          isDark={isDark}
          placeholder="Product…"
          prompt={`What is ${rows} × ${cols}? Enter the total number of ${obj.label}${targetCount === 1 ? "" : "s"}!`}
        />

      </div>
    </SharedCanvasLayout>
  );
};
