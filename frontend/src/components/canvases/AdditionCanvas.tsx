import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CanvasProps } from "./types";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { Button } from "../ui";
import { sounds } from "../../sound";
import { RotateCcw, PlusCircle, Check, Calculator, AlertCircle, Delete, PartyPopper } from "lucide-react";
import { GhostGuideOverlay, useGhostGuide, useCPASwitcher, FactFamilyCelebrationCard } from "../../pedagogy";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass, emptySlotClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { useCanvasAudience } from "./presentation";
import { objectStyle } from "./objectMotion";
import { OBJECT_SIZE, Rect, contentZone, slotPosition } from "./objectLayout";

interface VisualItem {
  id: string;
  /** Which addend it belongs to — that never changes — and where it is now. */
  group: 1 | 2;
  inBasket: boolean;
  /** Order it was added to the basket, so it keeps its place. */
  basketOrder: number | null;
  x: number;
  y: number;
}

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  violet: "violet",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

/**
 * The two addends are told apart by colour in pictorial mode.
 *
 * Group 2 used to be amber, which is the one hue the canvas palette rules out —
 * it is the hardest colour to hold against a light background for long.
 */
const GROUP_TONE: Record<1 | 2, CanvasAccent> = { 1: "rose", 2: "indigo" };

const GRID_STEP = 20;

export const AdditionCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid,
  isDark = false,
  onSuccess,
  onUpdateQuestionConfig
}) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const assetType = question.config?.assetType || obj.assetType || "emoji";
  const a1 = question.config.addend1 ?? 3;
  const a2 = question.config.addend2 ?? 2;
  const targetSum = a1 + a2;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [items, setItems] = useState<VisualItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<"basket" | 1 | 2 | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  /** Where the pointer went down, and whether it has travelled far enough to be a drag. */
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateConfigRef = useRef(onUpdateQuestionConfig);
  updateConfigRef.current = onUpdateQuestionConfig;

  // Answer Input State
  const [answerInput, setAnswerInput] = useState<string>("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "error" | "correct">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showNumberPad, setShowNumberPad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  /** `null` until the stage has actually been measured. */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const isCompact = stageWidth < 640;

  const basketCount = items.filter(it => it.inBasket).length;
  const isAdditionComplete = targetSum > 0 && basketCount === targetSum;
  const solvedForGuide = isAdditionComplete && (requireAnswerInput ? answerStatus === "correct" : true);
  const isSolved = solvedForGuide;

  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });
  const { representation, setRepresentation } = useCPASwitcher(question.config.defaultRepresentation || "concrete");
  const { learnerMode } = useCanvasAudience();

  useEffect(() => {
    if (question.config.defaultRepresentation) {
      setRepresentation(question.config.defaultRepresentation);
    }
  }, [question.config.defaultRepresentation, setRepresentation]);

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
   * Three bins, and the biggest object that fits all of them.
   *
   * The other canvases size an object against one bin and derive one band from
   * it; here an object has to sit in an addend group *and* in the basket, and the
   * two bands share one stage. So the size is solved directly: walk down from the
   * largest object the palette allows and take the first one whose group rows and
   * basket rows both still fit the stage. Everything else — band heights, zones —
   * falls out of that answer, rather than being guessed at 110px and 48px the way
   * this canvas used to.
   */
  const geometry = useMemo(() => {
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;
    /** What a bin spends on its own caption and padding before an object fits. */
    const chrome = captionH + pad * 2;
    /** The `+` between the two addend groups. */
    const plusLane = isCompact ? 30 : 46;

    const groupWidth = Math.max(OBJECT_SIZE.min + pad * 2, (stageWidth - plusLane - gap * 2) / 2);
    const biggestAddend = Math.max(1, a1, a2);

    const columnsIn = (width: number, unit: number) =>
      Math.max(1, Math.floor((width - pad * 2 + unit * 0.16) / (unit * 1.16)));
    const bandFor = (rows: number, unit: number) => Math.round(rows * unit * 1.2 + chrome);

    let unit: number = OBJECT_SIZE.min;
    let groupRows = 1;
    let basketRows = 1;
    for (let candidate = OBJECT_SIZE.max; candidate >= OBJECT_SIZE.min; candidate -= 2) {
      const gRows = Math.ceil(biggestAddend / columnsIn(groupWidth, candidate));
      const bRows = Math.ceil(targetSum / columnsIn(stageWidth, candidate));
      if (bandFor(gRows, candidate) + gap + bandFor(bRows, candidate) <= stageHeight) {
        unit = candidate;
        groupRows = gRows;
        basketRows = bRows;
        break;
      }
      // Nothing fits even at the floor: keep the floor and let the bands share out.
      groupRows = gRows;
      basketRows = bRows;
    }

    const basketHeight = Math.min(
      Math.round(stageHeight * 0.46),
      Math.max(chrome + unit, bandFor(basketRows, unit))
    );
    const groupHeight = Math.max(chrome + unit, stageHeight - basketHeight - gap);

    const group1: Rect = { left: 0, top: 0, width: groupWidth, height: groupHeight };
    const group2: Rect = { left: groupWidth + plusLane + gap * 2, top: 0, width: groupWidth, height: groupHeight };
    const basket: Rect = { left: 0, top: groupHeight + gap, width: stageWidth, height: basketHeight };

    return {
      gap,
      captionH,
      plusLane,
      unit,
      groupRows,
      basketHeight,
      groupHeight,
      group1,
      group2,
      basket,
      group1Zone: contentZone(group1, unit, captionH),
      group2Zone: contentZone(group2, unit, captionH),
      basketZone: contentZone(basket, unit, captionH)
    };
  }, [stageWidth, stageHeight, isCompact, a1, a2, targetSum]);

  const itemSize = geometry.unit;
  const assetSize = Math.round(itemSize * 0.88);
  const customPositionKey = JSON.stringify(question.config.customPositions || []);

  /** Where the `order`-th object of an addend group sits at home. */
  const groupSlot = useCallback((group: 1 | 2, order: number) => {
    const zone = group === 1 ? geometry.group1Zone : geometry.group2Zone;
    return slotPosition(order, group === 1 ? a1 : a2, zone, itemSize);
  }, [geometry.group1Zone, geometry.group2Zone, a1, a2, itemSize]);

  /** Where the `order`-th object added sits in the basket. */
  const basketSlot = useCallback(
    (order: number) => slotPosition(order, targetSum, geometry.basketZone, itemSize),
    [geometry.basketZone, targetSum, itemSize]
  );

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
  }, [question.id, targetSum]);

  const prevQuestionId = useRef(question.id);
  const prevAddends = useRef(`${a1}+${a2}`);

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

    setItems(prev => {
      const customPositions = (isCompact && isPlayMode) ? [] : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? stageWidth / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? stageHeight / layoutReference.height : 1;

      const questionChanged = prevQuestionId.current !== question.id || prevAddends.current !== `${a1}+${a2}`;

      // Re-slotting reads the child's progress: what is in the basket goes back
      // to its own place in the basket, the rest to their place at home.
      const build = (group: 1 | 2, index: number): VisualItem => {
        const id = `g${group}-${index}`;
        const existing = prev.find(it => it.id === id);
        const home = groupSlot(group, index + 1);

        if (existing && !questionChanged) {
          if (existing.inBasket) {
            return { ...existing, ...basketSlot(existing.basketOrder ?? 1) };
          }
          if (flipped) return { ...existing, ...home };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(stageWidth - itemSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(stageHeight - itemSize, existing.y * resizeY)))
          };
        }

        const saved = customPositions.find(p => p.id === id);
        return {
          id,
          group,
          inBasket: false,
          basketOrder: null,
          x: saved ? Math.round(saved.x * scaleX) : home.x,
          y: saved ? Math.round(saved.y * scaleY) : home.y
        };
      };

      const next = [
        ...Array.from({ length: a1 }).map((_, i) => build(1, i)),
        ...Array.from({ length: a2 }).map((_, i) => build(2, i))
      ];

      if (questionChanged) {
        prevQuestionId.current = question.id;
        prevAddends.current = `${a1}+${a2}`;
      }

      return next;
    });
  }, [question.id, a1, a2, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isCompact, itemSize, groupSlot, basketSlot, stageWidth, stageHeight]);

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

    let seen1 = 0;
    let seen2 = 0;
    const updated = items.map(it => {
      const order = it.group === 1 ? ++seen1 : ++seen2;
      return { ...it, ...groupSlot(it.group, order), inBasket: false, basketOrder: null };
    });
    setItems(updated);

    if (!isPlayMode && updateConfigRef.current) {
      updateConfigRef.current({
        customPositions: updated.map(it => ({ id: it.id, x: it.x, y: it.y })),
        layoutReference: {
          width: containerRef.current?.clientWidth || stageWidth,
          height: containerRef.current?.clientHeight || stageHeight
        }
      });
    }
  };

  /** Which bin a point sits in. */
  const zoneAt = useCallback((centerX: number, centerY: number): "basket" | 1 | 2 | null => {
    const within = (zone: Rect) =>
      centerX >= zone.left && centerX <= zone.left + zone.width
      && centerY >= zone.top && centerY <= zone.top + zone.height;
    if (within(geometry.basket)) return "basket";
    if (within(geometry.group1)) return 1;
    if (within(geometry.group2)) return 2;
    return null;
  }, [geometry.basket, geometry.group1, geometry.group2]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    reportActivity();
    e.stopPropagation();
    sounds.playPop();
    setDraggedItemId(id);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!containerRef.current) return;

    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    stageBox.current = containerRef.current.getBoundingClientRect();
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;

    containerRef.current.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const stageRect = stageBox.current;
    if (!stageRect) return;

    // A tap is not a drag: a child pressing an object should not have it move.
    if (!dragMoved.current && pressOrigin.current) {
      const travelled = Math.hypot(e.clientX - pressOrigin.current.x, e.clientY - pressOrigin.current.y);
      if (travelled > 4) dragMoved.current = true;
    }

    let x = e.clientX - stageRect.left - dragOffset.current.x;
    let y = e.clientY - stageRect.top - dragOffset.current.y;

    x = Math.max(0, Math.min(stageRect.width - itemSize, x));
    y = Math.max(0, Math.min(stageRect.height - itemSize, y));

    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    x = Math.round(x);
    y = Math.round(y);
    setDragPos({ x, y });

    if (isPlayMode) {
      setActiveDropZone(zoneAt(x + itemSize / 2, y + itemSize / 2));
    }

    setItems(prev => prev.map(it => (it.id === draggedItemId ? { ...it, x, y } : it)));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const id = draggedItemId;

    if (isPlayMode) {
      setItems(prev => {
        const item = prev.find(it => it.id === id);
        if (!item) return prev;

        const goesIn = zoneAt(item.x + itemSize / 2, item.y + itemSize / 2) === "basket";

        if (goesIn && !item.inBasket) {
          sounds.playTick(prev.filter(it => it.inBasket).length + 1);
        } else if (!goesIn && item.inBasket && dragMoved.current) {
          sounds.playSlide();
        }

        const settled = prev.map(it =>
          it.id === id
            ? {
              ...it,
              inBasket: goesIn,
              basketOrder: goesIn
                ? (it.inBasket ? it.basketOrder : prev.filter(other => other.inBasket && other.id !== id).length + 1)
                : null
            }
            : it
        );

        // Every bin re-flows, so nothing lands on top of a sibling and each group
        // closes up round the gap the object left.
        let inBasket = 0;
        let home1 = 0;
        let home2 = 0;
        const placed = settled.map(it => {
          if (it.inBasket) {
            inBasket += 1;
            return { ...it, basketOrder: inBasket, ...basketSlot(inBasket) };
          }
          const order = it.group === 1 ? ++home1 : ++home2;
          return { ...it, ...groupSlot(it.group, order) };
        });

        if (placed.filter(it => it.inBasket).length === targetSum && targetSum > 0) {
          if (!requireAnswerInput) {
            sounds.playSuccess();
            onSuccessRef.current?.();
          } else {
            setTimeout(() => inputRef.current?.focus(), 350);
          }
        }

        return placed;
      });
    } else {
      setItems(prev => {
        if (updateConfigRef.current) {
          updateConfigRef.current({
            customPositions: prev.map(it => ({ id: it.id, x: it.x, y: it.y })),
            layoutReference: {
              width: containerRef.current?.clientWidth || stageWidth,
              height: containerRef.current?.clientHeight || stageHeight
            }
          });
        }
        return prev;
      });
    }

    setDraggedItemId(null);
    setDragPos(null);
    setActiveDropZone(null);
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
    setActiveDropZone(null);
    pressOrigin.current = null;
    dragMoved.current = false;
    stageBox.current = null;
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

    if (parsed === targetSum) {
      setAnswerStatus("correct");
      setErrorMessage("");
      sounds.playSuccess();
      successTimeoutRef.current = setTimeout(() => {
        onSuccessRef.current?.();
        successTimeoutRef.current = null;
      }, 500);
    } else {
      setAnswerStatus("error");
      setErrorMessage(`Not quite! ${a1} and ${a2} makes ${targetSum} ${obj.label}${targetSum === 1 ? "" : "s"}. Enter ${targetSum}!`);
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

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "violet"] || "violet";
  const draggedItem = draggedItemId ? items.find(it => it.id === draggedItemId) : null;
  const remaining = targetSum - basketCount;
  const answerPanelOpen = isPlayMode && requireAnswerInput && isAdditionComplete;

  const leftHome = items.filter(it => it.group === 1 && !it.inBasket).length;
  const rightHome = items.filter(it => it.group === 2 && !it.inBasket).length;

  /** A ten-frame drawn over a bin, for the pictorial representation. */
  const TenFrame: React.FC<{ zone: Rect }> = ({ zone }) => {
    const cell = Math.min((zone.width - 16) / 5, (zone.height - 8) / 2, itemSize * 1.16);
    return (
      <div
        style={{
          position: "absolute",
          left: `${zone.left + (zone.width - cell * 5) / 2}px`,
          top: `${zone.top + (zone.height - cell * 2) / 2}px`,
          width: `${cell * 5}px`,
          height: `${cell * 2}px`,
          zIndex: 5
        }}
        className="grid grid-cols-5 grid-rows-2 gap-0.5 pointer-events-none"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`border-2 border-dashed rounded-lg ${emptySlotClass(isDark)}`} />
        ))}
      </div>
    );
  };

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      gridSize={GRID_STEP}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<PlusCircle size={16} />}
      headerTitle="Koda Addition"
      headerSubtitle={
        isAdditionComplete && requireAnswerInput
          ? "All objects added! Enter the sum answer below."
          : `${a1} + ${a2} = ${basketCount}`
      }
      readAloudText={`Addition. ${a1} plus ${a2} equals ${targetSum}. Drag the objects into the basket!`}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark} aria-label={`Target sum: ${targetSum}`}>
            {isSolved ? `∑ ${targetSum}` : `${remaining} to add`}
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
          ? `${a1} and ${a2} makes ${targetSum}!`
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
        className="relative flex-1 w-full flex flex-col items-stretch min-h-[280px] sm:min-h-[320px] md:min-h-[360px] touch-none select-none overscroll-none"
        style={{ gap: `${geometry.gap}px` }}
      >
        {/* Crosshair alignment guides in design mode */}
        {!isPlayMode && draggedItem && dragPos && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ top: `${draggedItem.y + itemSize / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ left: `${draggedItem.x + itemSize / 2}px` }}
            />
          </>
        )}

        {/* The two addends, with the `+` between them */}
        <div className="flex items-stretch" style={{ height: `${geometry.groupHeight}px`, gap: `${geometry.gap}px` }}>
          <CanvasBin
            label={question.config.sourceBinLabel || (learnerMode ? "First group" : "Group 1")}
            tally={isPlayMode ? leftHome : a1}
            accent={GROUP_TONE[1]}
            isDark={isDark}
            active={activeDropZone === 1}
            complete={isPlayMode && leftHome === 0}
            isEmpty={isPlayMode && leftHome === 0}
            emptyIcon={<Check size={20} />}
            emptyHint={isPlayMode && leftHome === 0 ? "All moved!" : undefined}
            className="pointer-events-none"
          >
            {representation === "abstract" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`px-4 py-2 rounded-2xl text-3xl font-black font-mono ${accentChipClass(GROUP_TONE[1], isDark)}`}>
                  {a1}
                </div>
              </div>
            )}
          </CanvasBin>

          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: `${geometry.plusLane}px` }}
          >
            <PlusCircle size={isCompact ? 22 : 30} className={isDark ? "text-violet-400" : "text-violet-500"} />
          </div>

          <CanvasBin
            label={question.config.destinationBinLabel || (learnerMode ? "Second group" : "Group 2")}
            tally={isPlayMode ? rightHome : a2}
            accent={GROUP_TONE[2]}
            isDark={isDark}
            active={activeDropZone === 2}
            complete={isPlayMode && rightHome === 0}
            isEmpty={isPlayMode && rightHome === 0}
            emptyIcon={<Check size={20} />}
            emptyHint={isPlayMode && rightHome === 0 ? "All moved!" : undefined}
            className="pointer-events-none"
          >
            {representation === "abstract" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`px-4 py-2 rounded-2xl text-3xl font-black font-mono ${accentChipClass(GROUP_TONE[2], isDark)}`}>
                  {a2}
                </div>
              </div>
            )}
          </CanvasBin>
        </div>

        {/* The basket — where the sum is made */}
        <CanvasBin
          label={question.config.jarLabel || (learnerMode ? "Put them together here" : "Basket")}
          tally={isPlayMode ? `${basketCount} / ${targetSum}` : undefined}
          accent={accent}
          isDark={isDark}
          active={activeDropZone === "basket"}
          complete={isAdditionComplete}
          isEmpty={isPlayMode && basketCount === 0}
          emptyIcon={<PartyPopper size={22} />}
          emptyHint={isPlayMode && basketCount === 0 ? `Drag every ${obj.label} in here` : undefined}
          style={{ flex: `0 0 ${geometry.basketHeight}px` }}
        >
          <GhostGuideOverlay
            show={showGhostGuide && !isSolved}
            label={
              isAdditionComplete && requireAnswerInput
                ? `Enter the sum (${targetSum}) in the box!`
                : "Drag items into the basket!"
            }
            isDark={isDark}
            labelPlacement="top"
          />
          {representation === "abstract" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`px-4 py-2 rounded-2xl text-3xl font-black font-mono ${accentChipClass(accent, isDark)}`}>
                {basketCount}
              </div>
            </div>
          )}
        </CanvasBin>

        {/* Ten-frames, for the pictorial representation */}
        {representation === "pictorial" && (
          <>
            <TenFrame zone={geometry.group1Zone} />
            <TenFrame zone={geometry.group2Zone} />
            <TenFrame zone={geometry.basketZone} />
          </>
        )}

        {/* The objects themselves */}
        {items.map(it => {
          const isDragging = draggedItemId === it.id;
          const tone = GROUP_TONE[it.group];

          return (
            <div
              key={it.id}
              role="button"
              tabIndex={0}
              aria-label={`${obj.label} from group ${it.group}, ${it.inBasket ? "in the basket" : "not yet added"}. Drag into the basket.`}
              onPointerDown={e => handlePointerDown(e, it.id)}
              style={objectStyle({ x: it.x, y: it.y, size: itemSize, dragging: isDragging })}
              className={`flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none rounded-2xl
                outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40
                transition-[filter,box-shadow] duration-150 drop-shadow-sm hover:drop-shadow-md
                ${isDragging ? "drop-shadow-xl scale-110" : ""}
                ${representation === "concrete" && it.inBasket ? accentChipClass(accent, isDark) : ""}`}
            >
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {it.x}, {it.y}
                </div>
              )}

              {representation === "concrete" ? (
                <CountingAsset type={assetType as any} emoji={obj.emoji} size={assetSize} />
              ) : representation === "pictorial" ? (
                /* A counter, coloured by the addend it came from — that is what makes
                   the number bond readable once both groups are in one basket. */
                <div className={`w-full h-full rounded-full border-2 flex items-center justify-center ${accentChipClass(tone, isDark)}`}>
                  <div className="w-2/5 h-2/5 rounded-full bg-current opacity-30" />
                </div>
              ) : (
                <div className={`w-full h-full rounded-full border-2 font-mono font-black flex items-center justify-center ${accentChipClass(tone, isDark)}`}
                  style={{ fontSize: `${Math.round(itemSize * 0.34)}px` }}
                >
                  1
                </div>
              )}
            </div>
          );
        })}

        {/* ── Answer Input Box Overlay after completing addition ── */}
        <AnimatePresence>
          {answerPanelOpen && (
            /*
              Docked over the addend groups, which are empty by now — never over
              the basket, because the sum the child is being asked for is sitting
              in it.
            */
            <div className="absolute z-50 inset-x-2 top-2 pointer-events-none flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.95 }}
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
                    What is {a1} + {a2}?
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
                      placeholder="Sum..."
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

        <FactFamilyCelebrationCard
          isSolved={isSolved}
          numberBond={{ part1: a1, part2: a2, total: targetSum }}
          factFamilyText={`Fantastic! ${a1} plus ${a2} sums to ${targetSum} ${obj.label}!`}
          isDark={isDark}
        />
      </div>
    </SharedCanvasLayout>
  );
};
