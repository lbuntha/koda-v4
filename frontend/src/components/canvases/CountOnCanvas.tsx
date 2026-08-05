import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ArrowRightCircle, Check, Calculator, AlertCircle, Delete, PartyPopper } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { useCanvasAudience } from "./presentation";
import { Button } from "../ui";

import { OBJECT_SIZE, Rect, contentZone, slotPosition } from "./objectLayout";
import { objectStyle } from "./objectMotion";

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
  slate: { stroke: "stroke-slate-400", fill: "fill-slate-500" }
};

const CONTAINER_SHAPES: Record<string, { label: string; subtitle: string }> = {
  box: { label: "Closed Container", subtitle: "📦 Cardboard Box" },
  chest: { label: "Treasure Chest", subtitle: "🪙 Treasure Chest" },
  basket: { label: "Fruit Basket", subtitle: "🧺 Fruit Basket" },
  mystery: { label: "Mystery Container", subtitle: "🔮 Mystery Chest" }
};

interface CountOnDot {
  id: string;
  emoji: string;
  x: number;
  y: number;
  snappedSlotIndex: number | null; // null while still in the tray
}

const GRID_STEP = 20;

export const CountOnCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const baseCount = question.config.baseCount || 5;
  const extraCount = question.config.extraCount || 3;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;
  const expectedAnswer = baseCount + extraCount;

  const [dots, setDots] = useState<CountOnDot[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  /** Which bin the drag is over — `-1` is the tray, `1` the count-on band. */
  const [activeZone, setActiveZone] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  /** Where the pointer went down, and whether it has travelled far enough to be a drag. */
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Answer Input State
  const [answerInput, setAnswerInput] = useState<string>("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "error" | "correct">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showNumberPad, setShowNumberPad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /** `null` until the stage has actually been measured — nothing is placed against a guess. */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const isCompact = stageWidth < 640;

  const isCountOnComplete = dots.length > 0 && dots.every(d => d.snappedSlotIndex !== null);
  const solvedForGuide = extraCount > 0 && isCountOnComplete && (requireAnswerInput ? answerStatus === "correct" : true);

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });
  const { learnerMode } = useCanvasAudience();

  // Measure before paint so the first layout is the real one.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const seed = container.getBoundingClientRect();
    setDimensions({ width: seed.width || 480, height: seed.height || 320 });
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 320
        });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  /**
   * The two bands and everything inside them, derived from the stage.
   *
   * The bins fill the stage edge to edge, so their boxes are arithmetic rather
   * than measured — no round trip through the DOM before the first object can be
   * placed, and the counting path can be drawn on the same numbers the slots use.
   *
   * The object is sized *first*, from what both bands can afford, and the bands
   * are then sized to hold it. Handing the tray a flat share of the stage is what
   * produced a 90px tray whose content area was six pixels tall, so every object
   * came back at the minimum size while the counting band sat half empty.
   */
  const geometry = useMemo(() => {
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;
    /** What a band spends on its own caption and padding before an object fits. */
    const chrome = captionH + pad * 2;

    const usableWidth = Math.max(OBJECT_SIZE.min, stageWidth - pad * 2);

    // Two bands stacked, each holding a row of objects; the counting band also
    // carries the closed container, which is a little under two objects wide.
    const heightCap = (stageHeight - gap - chrome * 2) / 2;
    const widthCap = usableWidth / (extraCount * 1.28 + 2.1);
    // A narrow stage lets the tray run to two rows rather than shrinking every
    // object to fit one — `slotPosition` wraps them there anyway.
    const trayWidthCap = usableWidth / Math.ceil(extraCount / (isCompact ? 2 : 1)) / 1.28;
    const unit = Math.round(
      Math.max(OBJECT_SIZE.min, Math.min(OBJECT_SIZE.max, heightCap, widthCap, trayWidthCap))
    );

    // Below the floor a single row stops fitting, so the objects wrap — and the
    // tray has to be tall enough for the rows `slotPosition` will actually make.
    const columns = Math.max(1, Math.min(extraCount, Math.floor(usableWidth / (unit * 1.28))));
    const rows = Math.ceil(extraCount / columns);
    const trayHeight = Math.round(
      Math.min(stageHeight * 0.42, unit + (rows - 1) * unit * 1.28 + chrome)
    );
    const bandHeight = Math.max(unit + chrome, stageHeight - trayHeight - gap);

    const band: Rect = { left: 0, top: 0, width: stageWidth, height: bandHeight };
    const tray: Rect = { left: 0, top: bandHeight + gap, width: stageWidth, height: trayHeight };
    const bandZone = contentZone(band, unit, captionH);

    // The closed container is a fixture at the head of the band; the slots get
    // whatever is left of it.
    const boxSize = Math.round(
      Math.min(Math.max(72, Math.min(150, unit * 1.7)), Math.max(64, bandZone.height))
    );
    const boxLane = boxSize + gap * 1.5;

    const slotsZone: Rect = {
      left: bandZone.left + boxLane,
      top: bandZone.top,
      width: Math.max(unit, bandZone.width - boxLane - pad),
      height: bandZone.height
    };

    return {
      gap,
      band,
      tray,
      trayHeight,
      boxSize,
      boxX: Math.round(pad),
      boxY: Math.round(bandZone.top + (bandZone.height - boxSize) / 2),
      slotsZone,
      trayZone: contentZone(tray, unit, captionH),
      slotSize: unit,
      dotSize: Math.round(unit * 0.9),
      snapRadius: Math.max(48, unit * 1.2)
    };
  }, [stageWidth, stageHeight, isCompact, extraCount]);

  const { dotSize, slotSize } = geometry;
  const hasFrame = question.config.showItemFrame ?? true;
  const assetSize = Math.round(dotSize * (hasFrame ? 0.7 : 0.92));
  const customPositionKey = JSON.stringify(question.config.customPositions || []);

  /** Where the `order`-th loose object waits in the tray. */
  const trayPos = useCallback(
    (order: number) => slotPosition(order, extraCount, geometry.trayZone, dotSize),
    [extraCount, geometry.trayZone, dotSize]
  );

  /** Centre of the count-on slot for step `idx` (0-based). */
  const slotCenter = useCallback((idx: number) => {
    const pos = slotPosition(idx + 1, extraCount, geometry.slotsZone, slotSize);
    return { x: pos.x + slotSize / 2, y: pos.y + slotSize / 2 };
  }, [extraCount, geometry.slotsZone, slotSize]);

  const boxCenterX = geometry.boxX + geometry.boxSize / 2;
  const boxCenterY = geometry.boxY + geometry.boxSize / 2;

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
  }, [question.id, baseCount, extraCount]);

  const prevQuestionId = useRef(question.id);
  const prevObjectId = useRef(question.objectId);
  const prevExtra = useRef(extraCount);

  /** Stage the current coordinates were laid out against. */
  const laidOutAt = useRef<{ width: number; height: number; compact: boolean } | null>(null);

  // Responsive placement & rescaling on resize / orientation change
  useEffect(() => {
    if (!dimensions) return;

    const previous = laidOutAt.current;
    laidOutAt.current = { width: stageWidth, height: stageHeight, compact: isCompact };

    const flipped = previous ? previous.compact !== isCompact : false;
    const resizeX = previous?.width ? stageWidth / previous.width : 1;
    const resizeY = previous?.height ? stageHeight / previous.height : 1;
    const resized = !flipped && (resizeX !== 1 || resizeY !== 1);

    setDots(prev => {
      const customPositions = (isCompact && isPlayMode) ? [] : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? stageWidth / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? stageHeight / layoutReference.height : 1;

      const questionChanged = prevQuestionId.current !== question.id
        || prevObjectId.current !== question.objectId
        || prevExtra.current !== extraCount;

      // Loose objects close up at the head of the tray, so the one a child may
      // pick up next is always the one at the front.
      let looseSeen = 0;

      const next: CountOnDot[] = Array.from({ length: extraCount }).map((_, idx) => {
        const itemId = `counton-dot-${idx}`;
        const existing = prev.find(d => d.id === itemId);

        if (existing && !questionChanged) {
          if (existing.snappedSlotIndex !== null) {
            const center = slotCenter(existing.snappedSlotIndex);
            return {
              ...existing,
              x: Math.round(center.x - dotSize / 2),
              y: Math.round(center.y - dotSize / 2)
            };
          }

          looseSeen += 1;
          if (flipped) return { ...existing, ...trayPos(looseSeen) };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(stageWidth - dotSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(stageHeight - dotSize, existing.y * resizeY)))
          };
        }

        const savedPos = customPositions.find(p => p.id === itemId);
        looseSeen += 1;
        const defaultPos = trayPos(looseSeen);

        return {
          id: itemId,
          emoji: obj.emoji,
          x: savedPos ? Math.round(savedPos.x * scaleX) : defaultPos.x,
          y: savedPos ? Math.round(savedPos.y * scaleY) : defaultPos.y,
          snappedSlotIndex: null
        };
      });

      if (questionChanged) {
        prevQuestionId.current = question.id;
        prevObjectId.current = question.objectId;
        prevExtra.current = extraCount;
      }

      return next;
    });
  }, [question.id, question.objectId, extraCount, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isCompact, dotSize, trayPos, slotCenter, obj.emoji, stageWidth, stageHeight]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
    sounds.playPop();

    const updated = Array.from({ length: extraCount }).map((_, idx) => ({
      id: `counton-dot-${idx}`,
      emoji: obj.emoji,
      ...trayPos(idx + 1),
      snappedSlotIndex: null
    }));
    setDots(updated);

    if (!isPlayMode && onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: updated.map(dot => ({ id: dot.id, x: dot.x, y: dot.y })),
        layoutReference: {
          width: containerRef.current?.clientWidth || stageWidth,
          height: containerRef.current?.clientHeight || stageHeight
        }
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, isClickable: boolean) => {
    if (e.button !== 0 || !isClickable) return;
    reportActivity();
    sounds.playPop();
    setDraggedItemId(id);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!containerRef.current) return;

    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    stageBox.current = containerRef.current.getBoundingClientRect();
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;

    containerRef.current.setPointerCapture(e.pointerId);
  };

  /** Count-on is ordinal, so an object only ever fits its own step. */
  const slotForDrag = useCallback((id: string, x: number, y: number) => {
    const idx = parseInt(id.split("-").pop() || "0", 10);
    const center = slotCenter(idx);
    const dist = Math.hypot(x + dotSize / 2 - center.x, y + dotSize / 2 - center.y);
    return dist < geometry.snapRadius ? idx : null;
  }, [slotCenter, dotSize, geometry.snapRadius]);

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const stageRect = stageBox.current;
    if (!stageRect) return;

    // A tap is not a drag: a child pressing an object to hear it should not have
    // it slide anywhere, and 4px of hand tremor is a press.
    if (!dragMoved.current && pressOrigin.current) {
      const travelled = Math.hypot(e.clientX - pressOrigin.current.x, e.clientY - pressOrigin.current.y);
      if (travelled > 4) dragMoved.current = true;
    }

    let x = e.clientX - stageRect.left - dragOffset.current.x;
    let y = e.clientY - stageRect.top - dragOffset.current.y;

    x = Math.max(0, Math.min(stageRect.width - dotSize, x));
    y = Math.max(0, Math.min(stageRect.height - dotSize, y));

    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    x = Math.round(x);
    y = Math.round(y);
    setDragPos({ x, y });

    if (isPlayMode) {
      setHoveredSlotIndex(slotForDrag(draggedItemId, x, y));
      setActiveZone(y + dotSize / 2 >= geometry.tray.top ? -1 : 1);
    }

    setDots(prev => prev.map(d =>
      d.id === draggedItemId ? { ...d, x, y, snappedSlotIndex: null } : d
    ));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const id = draggedItemId;

    if (isPlayMode) {
      setDots(prev => {
        const item = prev.find(d => d.id === id);
        if (!item) return prev;

        const target = slotForDrag(id, item.x, item.y);
        if (target !== null) {
          sounds.playTick(baseCount + target + 1);
        } else if (dragMoved.current) {
          // Missed the slot. A tap that went nowhere gets no sound at all.
          sounds.playSlide();
        }

        const settled = prev.map(d => {
          if (d.id !== id) return d;
          if (target === null) return { ...d, snappedSlotIndex: null };
          const center = slotCenter(target);
          return {
            ...d,
            snappedSlotIndex: target,
            x: Math.round(center.x - dotSize / 2),
            y: Math.round(center.y - dotSize / 2)
          };
        });

        /*
          Re-flow the whole queue, not just the object that was released.

          Counting on is ordinal — only the front object may move — so the tray
          has to stay a gap-free queue in sequence order. Placing the released
          object on its own and leaving the rest put it on top of a sibling, and
          left a locked object at the front that a child could only read as the
          apple refusing to be dragged.
        */
        let rank = 0;
        return settled.map(d => {
          if (d.snappedSlotIndex !== null) return d;
          rank += 1;
          return { ...d, ...trayPos(rank) };
        });
      });
    } else {
      setDots(prev => {
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: prev.map(d => ({ id: d.id, x: d.x, y: d.y })),
            layoutReference: {
              width: containerRef.current?.clientWidth || stageWidth,
              height: containerRef.current?.clientHeight || stageHeight
            }
          });
        }
        return prev;
      });
    }

    setHoveredSlotIndex(null);
    setActiveZone(null);
    setDraggedItemId(null);
    setDragPos(null);
    pressOrigin.current = null;
    dragMoved.current = false;
    stageBox.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    setDraggedItemId(null);
    setDragPos(null);
    setHoveredSlotIndex(null);
    setActiveZone(null);
    pressOrigin.current = null;
    dragMoved.current = false;
    stageBox.current = null;
  };

  const handleBaseTap = () => {
    reportActivity();
    sounds.playTick(baseCount);
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

    if (parsed === expectedAnswer) {
      setAnswerStatus("correct");
      setErrorMessage("");
      sounds.playSuccess();
      successTimeoutRef.current = setTimeout(() => {
        onSuccessRef.current?.();
        successTimeoutRef.current = null;
      }, 500);
    } else {
      setAnswerStatus("error");
      setErrorMessage(`Not quite! ${baseCount} plus ${extraCount} more makes ${expectedAnswer} ${obj.label}${expectedAnswer === 1 ? "" : "s"}. Enter ${expectedAnswer}!`);
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

  const hasTriggeredSuccess = useRef(false);

  // Success trigger
  useEffect(() => {
    if (isCountOnComplete) {
      if (!requireAnswerInput) {
        if (!hasTriggeredSuccess.current) {
          hasTriggeredSuccess.current = true;
          sounds.playSuccess();
          if (onSuccess) onSuccess();
        }
      } else {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 350);
      }
    } else {
      hasTriggeredSuccess.current = false;
    }
  }, [dots.map(d => d.snappedSlotIndex !== null).join(","), requireAnswerInput, isCountOnComplete]);

  const draggedItem = draggedItemId ? dots.find(d => d.id === draggedItemId) : null;
  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const path = PATH_COLORS[accent];

  const placed = dots.filter(d => d.snappedSlotIndex !== null).length;
  const remaining = extraCount - placed;
  const isSolved = solvedForGuide;
  const total = baseCount + placed;
  const answerPanelOpen = isPlayMode && requireAnswerInput && isCountOnComplete;

  const shape = CONTAINER_SHAPES[question.config.containerShape || "box"] || CONTAINER_SHAPES.box;

  // Bin names come from the slide when a teacher set them; the fallbacks are the
  // instruction itself, for a child who cannot yet read "tray".
  const bandLabel = question.config.destinationBinLabel || (learnerMode ? `Count on from ${baseCount}` : "Count on");
  const trayLabel = question.config.sourceBinLabel || (learnerMode ? "Take one at a time" : "Up next");

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      gridSize={GRID_STEP}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<ArrowRightCircle size={16} />}
      headerTitle="Count On"
      headerSubtitle={
        isCountOnComplete && requireAnswerInput
          ? "Counting complete! Enter the total answer below."
          : `${baseCount} + ${placed} = ${total}`
      }
      readAloudText={question.instruction || `Start at ${baseCount}, then count on ${extraCount} more.`}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? `Counted on to ${total}` : `${remaining} more`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset object positions">
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
            : "Design Mode · Drag objects to set their starting positions"
      }
      footerSolved={isSolved}
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        /*
          `flex-1` is what makes this fill a launcher, so the tray below stays
          modest on purpose: a taller tray than the window can give overflows the
          layout's `min-h-0` parent and pushes the counting band off the stage.
        */
        className="relative flex-1 w-full flex flex-col items-stretch min-h-[280px] sm:min-h-[320px] md:min-h-[360px] touch-none select-none overscroll-none"
        style={{ gap: `${geometry.gap}px` }}
      >
        {/* Crosshair alignment guides in design mode */}
        {!isPlayMode && draggedItem && dragPos && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ top: `${draggedItem.y + dotSize / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ left: `${draggedItem.x + dotSize / 2}px` }}
            />
          </>
        )}

        {/* The counting band — the closed container, then the numbered steps */}
        <CanvasBin
          label={bandLabel}
          tally={isPlayMode ? `${placed} / ${extraCount}` : undefined}
          accent={accent}
          isDark={isDark}
          active={activeZone === 1}
          complete={isCountOnComplete}
          className="pointer-events-none"
          style={{ flex: "1 1 auto" }}
        >
          {/*
            The numbered slots are the invitation here, so the bin gets no empty
            hint — a dashed circle with "6" in it says it better than a caption.
          */}
          <GhostGuideOverlay
            show={showGhostGuide && !isSolved}
            label={
              isCountOnComplete && requireAnswerInput
                ? `Enter the total count (${expectedAnswer}) in the box!`
                : `Count on from ${baseCount} — drag into the slots!`
            }
            isDark={isDark}
            labelPlacement="top"
          />
        </CanvasBin>

        {/* The tray — objects still to count on */}
        <CanvasBin
          label={trayLabel}
          tally={isPlayMode ? remaining : undefined}
          accent={accent}
          isDark={isDark}
          active={activeZone === -1}
          complete={isPlayMode && remaining === 0}
          isEmpty={isPlayMode && remaining === 0}
          emptyIcon={<PartyPopper size={22} />}
          // Suppressed once the answer panel docks here, or the two would stack up.
          emptyHint={isPlayMode && !answerPanelOpen ? "All counted on!" : undefined}
          className="pointer-events-none"
          style={{ flex: `0 0 ${geometry.trayHeight}px` }}
        />

        {/* The closed starting container */}
        <button
          onClick={handleBaseTap}
          style={{
            position: "absolute",
            left: `${geometry.boxX}px`,
            top: `${geometry.boxY}px`,
            width: `${geometry.boxSize}px`,
            height: `${geometry.boxSize}px`
          }}
          className={`rounded-3xl flex flex-col items-center justify-center p-3 transition-all active:scale-95 cursor-pointer z-10 group ${surfaceClass(isDark, "raised")}`}
        >
          <div className={`absolute -top-2.5 text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase tracking-[0.18em] ${captionClass(isDark)}`}>
            {shape.label}
          </div>
          <span
            className={`font-mono font-black transition-transform group-hover:scale-110 ${isDark ? "text-slate-100" : "text-slate-800"}`}
            style={{ fontSize: `${Math.round(geometry.boxSize * 0.32)}px` }}
          >
            {baseCount}
          </span>
          <span className={`text-[9px] font-bold mt-1 truncate max-w-full ${captionClass(isDark)}`}>{shape.subtitle}</span>
        </button>

        {/* The counting path, box → each step */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {Array.from({ length: extraCount }).map((_, idx) => {
            const center = slotCenter(idx);
            const controlY = Math.min(boxCenterY, center.y) - Math.round(slotSize * 0.85);
            return (
              <path
                key={`bg-path-${idx}`}
                d={`M ${boxCenterX} ${boxCenterY} Q ${(boxCenterX + center.x) / 2} ${controlY} ${center.x} ${center.y}`}
                fill="none"
                stroke={isDark ? "rgba(139, 92, 246, 0.15)" : "rgba(99, 102, 241, 0.15)"}
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            );
          })}

          {dots.map((dot, idx) => {
            if (dot.snappedSlotIndex === null) return null;
            const center = slotCenter(dot.snappedSlotIndex);
            const midX = (boxCenterX + center.x) / 2;
            const controlY = Math.min(boxCenterY, center.y) - Math.round(slotSize * 0.85);

            return (
              <g key={`path-${idx}`}>
                <path
                  d={`M ${boxCenterX} ${boxCenterY} Q ${midX} ${controlY} ${center.x} ${center.y}`}
                  fill="none"
                  strokeWidth="2.5"
                  strokeDasharray="5"
                  className={`${path.stroke} animate-pulse`}
                />
                <circle cx={midX} cy={controlY} r="10" className={`${path.fill} stroke-white stroke-2`} />
                <text
                  x={midX}
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

        {/* Numbered target slots */}
        {Array.from({ length: extraCount }).map((_, idx) => {
          const center = slotCenter(idx);
          const isFilled = dots.some(d => d.snappedSlotIndex === idx);
          const isHovered = hoveredSlotIndex === idx;

          let slotClass = "rounded-full border-2 flex items-center justify-center transition-all duration-200 pointer-events-none";
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
                zIndex: 10
              }}
              className={slotClass}
            >
              <span className={`font-mono text-xs font-bold ${isFilled ? "opacity-0" : ""}`}>
                {baseCount + idx + 1}
              </span>
            </div>
          );
        })}

        {/* Draggable objects */}
        {dots.map((dot, idx) => {
          const isDragging = draggedItemId === dot.id;
          // Count-on is ordinal: only the next object in the sequence can move.
          const isClickable = !isPlayMode || idx === 0 || dots[idx - 1].snappedSlotIndex !== null;
          const assetType = question.config?.assetType || "emoji";

          let itemClassName = "flex flex-col items-center justify-center select-none touch-none rounded-xl transition-[box-shadow,transform] outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40";
          itemClassName += isClickable ? " cursor-grab active:cursor-grabbing" : " opacity-40 cursor-not-allowed";

          if (hasFrame) {
            itemClassName += dot.snappedSlotIndex !== null
              ? ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
            if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
          } else {
            itemClassName += dot.snappedSlotIndex !== null ? " drop-shadow-md" : " drop-shadow-sm hover:drop-shadow-md";
            if (isDragging) itemClassName += " scale-125 drop-shadow-xl z-50";
          }

          return (
            <div
              key={dot.id}
              role="button"
              tabIndex={0}
              aria-label={`${dot.snappedSlotIndex !== null ? `Counted as ${baseCount + idx + 1}` : "Not counted yet"} — ${obj.label}. Drag to the next slot.`}
              onPointerDown={(e) => handlePointerDown(e, dot.id, isClickable)}
              style={objectStyle({ x: dot.x, y: dot.y, size: dotSize, dragging: isDragging })}
              className={itemClassName}
            >
              {dot.snappedSlotIndex !== null && (
                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold text-[9px] font-mono w-5 h-5 flex items-center justify-center rounded-full animate-scale-in ${accentChipClass(accent, isDark)}`}>
                  {baseCount + idx + 1}
                </div>
              )}

              {/* Coordinate tooltip when dragging in design mode */}
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {dot.x}, {dot.y}
                </div>
              )}

              <CountingAsset type={assetType as any} emoji={dot.emoji} size={assetSize} />
            </div>
          );
        })}

        {/* ── Answer Input Box Overlay after counting on ── */}
        <AnimatePresence>
          {answerPanelOpen && (
            /*
              Docked over the tray the objects just left, never over the counting
              band: the question is "how many in total", so the steps the child
              counted have to stay in view while they answer.
            */
            <div className="absolute z-50 inset-x-2 bottom-2 pointer-events-none flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="w-full pointer-events-auto flex flex-col items-center justify-center p-3 sm:p-4 md:p-5
                  rounded-2xl md:rounded-3xl backdrop-blur-md border shadow-2xl sm:max-w-md md:max-w-lg"
                style={{
                  backgroundColor: isDark ? "rgba(15, 23, 42, 0.94)" : "rgba(255, 255, 255, 0.96)",
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
                    How many {obj.label}{expectedAnswer === 1 ? "" : "s"} are there in total?
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
            </div>
          )}
        </AnimatePresence>
      </div>
    </SharedCanvasLayout>
  );
};
