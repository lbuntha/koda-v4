import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ArrowRightLeft, Check, Calculator, AlertCircle, Delete, MoveRight, PartyPopper } from "lucide-react";
import { CanvasProps } from "./types";
import { Button } from "../ui";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { useCanvasAudience } from "./presentation";
import { objectStyle } from "./objectMotion";
import {
  binSizeForStage,
  contentZone,
  fitObjectSize,
  relativeRect,
  slotPosition
} from "./objectLayout";
import { GhostGuideOverlay, useGhostGuide, useCPASwitcher } from "../../pedagogy";

interface DraggableItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  counted: boolean;
  countedOrder: number | null;
}

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

interface DragStart {
  id: string;
  x: number;
  y: number;
  counted: boolean;
  countedOrder: number | null;
}

export const MoveAndCountCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;

  const [items, setItems] = useState<DraggableItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<"source" | "destination" | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const latestDragPosition = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<DragStart | null>(null);
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const customPositionKey = JSON.stringify(question.config.customPositions || []);
  const gridSize = question.config.layoutGridSize || 20;

  // Answer Input State
  const [answerInput, setAnswerInput] = useState<string>("");
  const [answerStatus, setAnswerStatus] = useState<"idle" | "error" | "correct">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showNumberPad, setShowNumberPad] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const isAllMoved = items.length > 0 && items.every(i => i.counted);
  const solvedForGuide = isAllMoved && (requireAnswerInput ? answerStatus === "correct" : true);
  
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved: solvedForGuide,
    idleThresholdMs: 10000
  });
  const { representation, setRepresentation } = useCPASwitcher(question.config.defaultRepresentation || "concrete");
  const { learnerMode } = useCanvasAudience();

  useEffect(() => {
    if (question.config.defaultRepresentation) {
      setRepresentation(question.config.defaultRepresentation);
    }
  }, [question.config.defaultRepresentation, setRepresentation]);

  /**
   * `null` until the stage has actually been measured.
   *
   * Objects are positioned in stage pixels, so laying them out against a guessed
   * size and correcting later throws them into the wrong bin. Nothing is placed
   * until there is a real measurement.
   */
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const stageWidth = dimensions?.width ?? 480;
  const stageHeight = dimensions?.height ?? 320;
  const isMobile = stageWidth < 640;

  /** Objects grow with the bin they have to fill — see `objectLayout`. */
  const itemSize = useMemo(() => {
    const bin = binSizeForStage(stageWidth, stageHeight, { stacked: isMobile });
    return fitObjectSize({ width: bin.width, height: bin.height, count });
  }, [stageWidth, stageHeight, isMobile, count]);

  /*
    Framed objects sit on a tile and need the tile to read as a tile; unframed
    artwork IS the object, so it fills nearly the whole slot — the difference
    between an apple that looks small in a big bin and one that fills it.
  */
  const hasFrame = question.config.showItemFrame ?? true;
  const assetSize = Math.round(itemSize * (hasFrame ? 0.7 : 0.92));
  const badgeSize = Math.round(Math.max(18, Math.min(32, itemSize * 0.3)));

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // Measure before paint so the first layout is the real one.
    const seed = stage.getBoundingClientRect();
    setDimensions({
      width: seed.width || 480,
      height: seed.height || 320
    });
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 320
        });
      }
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  const prevQuestionId = useRef(question.id);
  const prevObjectId = useRef(question.objectId);
  const prevCount = useRef(count);

  /** Stage the current item coordinates were laid out against. */
  const laidOutAt = useRef<{ width: number; height: number; stacked: boolean } | null>(null);

  useEffect(() => {
    if (!dimensions) return;

    const stageRect = stageRef.current?.getBoundingClientRect();
    const sourceZone = stageRect && sourceRef.current
      ? contentZone(relativeRect(sourceRef.current, stageRect), itemSize)
      : null;
    const destinationZone = stageRect && destinationRef.current
      ? contentZone(relativeRect(destinationRef.current, stageRect), itemSize)
      : null;
    const fallbackZone = sourceZone || {
      left: 18,
      top: 18,
      width: Math.max(itemSize, dimensions.width / 2 - 36),
      height: Math.max(itemSize, dimensions.height - 36)
    };

    const previous = laidOutAt.current;
    laidOutAt.current = { width: dimensions.width, height: dimensions.height, stacked: isMobile };

    // Bins that flip from side-by-side to stacked have moved somewhere a
    // proportional nudge cannot follow, so those objects are re-slotted into
    // whichever bin they belong to. An ordinary resize only scales them.
    const flipped = previous ? previous.stacked !== isMobile : false;
    const resizeX = previous?.width ? dimensions.width / previous.width : 1;
    const resizeY = previous?.height ? dimensions.height / previous.height : 1;
    const resized = !flipped && (resizeX !== 1 || resizeY !== 1);

    setItems(prev => {
      const customPositions = (isMobile && isPlayMode) ? [] : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? dimensions.width / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? dimensions.height / layoutReference.height : 1;

      const questionChanged = prevQuestionId.current !== question.id || prevObjectId.current !== question.objectId || prevCount.current !== count;

      // Re-slotting reads the child's progress, not the item index: an object
      // already in the counted bin goes back to its numbered slot there.
      let uncountedSeen = 0;
      const reslot = (item: DraggableItem) => {
        if (item.counted) {
          const order = item.countedOrder ?? 1;
          return slotPosition(order, count, destinationZone || fallbackZone, itemSize);
        }
        uncountedSeen += 1;
        return slotPosition(uncountedSeen, count, sourceZone || fallbackZone, itemSize);
      };

      const newItems: DraggableItem[] = Array.from({ length: count }).map((_, idx) => {
        const itemId = `move-item-${idx}`;
        const existing = prev.find(i => i.id === itemId);

        if (existing && !questionChanged) {
          if (flipped) return { ...existing, ...reslot(existing) };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(dimensions.width - itemSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(dimensions.height - itemSize, existing.y * resizeY)))
          };
        }

        const savedPos = customPositions.find(p => p.id === itemId);
        const defaultPosition = slotPosition(idx + 1, count, fallbackZone, itemSize);
        return {
          id: itemId,
          emoji: obj.emoji,
          x: savedPos ? Math.round(savedPos.x * scaleX) : defaultPosition.x,
          y: savedPos ? Math.round(savedPos.y * scaleY) : defaultPosition.y,
          counted: false,
          countedOrder: null
        };
      });

      if (questionChanged) {
        prevQuestionId.current = question.id;
        prevObjectId.current = question.objectId;
        prevCount.current = count;
      }

      return newItems;
    });
  }, [question.id, question.objectId, count, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isMobile, itemSize]);

  // Reset progress on question change
  useEffect(() => {
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [question.id, count]);

  const reset = () => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    setAnswerInput("");
    setAnswerStatus("idle");
    setErrorMessage("");
    setShowNumberPad(false);

    const stageRect = stageRef.current?.getBoundingClientRect();
    const measuredSource = stageRect && sourceRef.current
      ? contentZone(relativeRect(sourceRef.current, stageRect), itemSize)
      : null;
    const fallbackZone = measuredSource || {
        left: 18,
        top: 18,
        width: Math.max(itemSize, stageWidth / 2 - 36),
        height: Math.max(itemSize, stageHeight - 36)
      };
    const updated = items.map((item, idx) => {
      const position = slotPosition(idx + 1, count, fallbackZone, itemSize);
      return { ...item, ...position, counted: false, countedOrder: null };
    });
    setItems(updated);

    if (!isPlayMode && onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: updated.map(item => ({ id: item.id, x: item.x, y: item.y })),
        layoutReference: {
          width: stageRef.current?.clientWidth || stageWidth,
          height: stageRef.current?.clientHeight || stageHeight
        }
      });
    }
  };

  const getStagePointer = (e: React.PointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    reportActivity();
    const item = items.find(i => i.id === id);
    if (!item) return;

    sounds.playPop();
    setDraggedItemId(id);
    dragStart.current = {
      id: item.id,
      x: item.x,
      y: item.y,
      counted: item.counted,
      countedOrder: item.countedOrder
    };

    const pointer = getStagePointer(e);
    if (!pointer) return;

    dragOffset.current = {
      x: pointer.x - item.x,
      y: pointer.y - item.y
    };
    latestDragPosition.current = { x: item.x, y: item.y };
    setDragPos({ x: item.x, y: item.y });

    if (stageRef.current) {
      stageBox.current = stageRef.current.getBoundingClientRect();
      stageRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId || !stageRef.current) return;
    const pointer = getStagePointer(e);
    if (!pointer) return;

    const nextX = Math.max(0, Math.min(stageRef.current.clientWidth - itemSize, pointer.x - dragOffset.current.x));
    const nextY = Math.max(0, Math.min(stageRef.current.clientHeight - itemSize, pointer.y - dragOffset.current.y));

    latestDragPosition.current = { x: nextX, y: nextY };
    setDragPos({ x: nextX, y: nextY });

    if (isPlayMode) {
      const stageRect = stageBox.current || stageRef.current.getBoundingClientRect();
      const itemRect = {
        left: pointer.x - dragOffset.current.x,
        top: pointer.y - dragOffset.current.y,
        width: itemSize,
        height: itemSize
      };

      const sourceZone = sourceRef.current ? relativeRect(sourceRef.current, stageRect) : null;
      const destinationZone = destinationRef.current ? relativeRect(destinationRef.current, stageRect) : null;

      const intersects = (zone: { left: number; top: number; width: number; height: number } | null) => {
        if (!zone) return false;
        const centerX = itemRect.left + itemRect.width / 2;
        const centerY = itemRect.top + itemRect.height / 2;
        return (
          centerX >= zone.left &&
          centerX <= zone.left + zone.width &&
          centerY >= zone.top &&
          centerY <= zone.top + zone.height
        );
      };

      if (intersects(destinationZone)) {
        setActiveDropZone("destination");
      } else if (intersects(sourceZone)) {
        setActiveDropZone("source");
      } else {
        setActiveDropZone(null);
      }
    }

    setItems(prev => prev.map(item => item.id === draggedItemId ? { ...item, x: nextX, y: nextY } : item));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId || !stageRef.current) return;
    const id = draggedItemId;
    const item = items.find(i => i.id === id);

    setItems(prev => {
      const stageRect = stageRef.current?.getBoundingClientRect();
      if (!stageRect || !item) return prev;

      if (isPlayMode) {
        const source = sourceRef.current ? relativeRect(sourceRef.current, stageRect) : null;
        const destination = destinationRef.current ? relativeRect(destinationRef.current, stageRect) : null;
        const finalPos = latestDragPosition.current || { x: item.x, y: item.y };
        const centerX = finalPos.x + itemSize / 2;
        const centerY = finalPos.y + itemSize / 2;

        const inZone = (zone: { left: number; top: number; width: number; height: number } | null) => {
          if (!zone) return false;
          return (
            centerX >= zone.left &&
            centerX <= zone.left + zone.width &&
            centerY >= zone.top &&
            centerY <= zone.top + zone.height
          );
        };

        const inDestination = inZone(destination);
        const inSource = inZone(source);

        if (inDestination) {
          const destinationItems = prev.filter(candidate => candidate.counted && candidate.id !== id);
          const nextOrder = destinationItems.length + 1;
          const destinationZone = contentZone(destination!, itemSize);
          const slotPos = slotPosition(nextOrder, count, destinationZone, itemSize);

          sounds.playTick(nextOrder);

          return prev.map(candidate => {
            if (candidate.id !== id) return candidate;
            return {
              ...candidate,
              x: slotPos.x,
              y: slotPos.y,
              counted: true,
              countedOrder: nextOrder
            };
          });
        }

        if (inSource) {
          sounds.playPop();
          const uncountedCount = prev.filter(candidate => !candidate.counted && candidate.id !== id).length + 1;
          const sourceZone = contentZone(source!, itemSize);
          const slotPos = slotPosition(uncountedCount, count, sourceZone, itemSize);

          return prev.map(candidate => {
            if (candidate.id !== id) return candidate;
            return {
              ...candidate,
              x: slotPos.x,
              y: slotPos.y,
              counted: false,
              countedOrder: null
            };
          });
        }

        if (dragStart.current?.counted) {
          const destinationItems = prev.filter(candidate => candidate.counted && candidate.id !== id);
          const order = dragStart.current.countedOrder || destinationItems.length + 1;
          return prev.map(candidate => {
            if (candidate.id !== id) return candidate;
            return { ...candidate, ...slotPosition(order, count, contentZone(destination!, itemSize), itemSize), countedOrder: order };
          });
        }

        const start = dragStart.current;
        return start
          ? prev.map(candidate => candidate.id === id ? { ...candidate, x: start.x, y: start.y } : candidate)
          : prev;
      } else {
        const snappedX = showGrid ? Math.round(item.x / gridSize) * gridSize : item.x;
        const snappedY = showGrid ? Math.round(item.y / gridSize) * gridSize : item.y;
        const updated = prev.map(i => i.id === id ? { ...i, x: snappedX, y: snappedY } : i);
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: updated.map(updatedItem => ({ id: updatedItem.id, x: updatedItem.x, y: updatedItem.y })),
            layoutReference: {
              width: stageRef.current?.clientWidth || stageWidth,
              height: stageRef.current?.clientHeight || stageHeight
            }
          });
        }
        return updated;
      }
    });

    setDraggedItemId(null);
    setDragPos(null);
    setActiveDropZone(null);
    dragStart.current = null;
    latestDragPosition.current = null;
    stageBox.current = null;
    if (stageRef.current.hasPointerCapture(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId);
    }
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const start = dragStart.current;
    if (start) {
      setItems(prev => prev.map(item => item.id === start.id ? { ...item, x: start.x, y: start.y } : item));
    }
    if (stageRef.current?.hasPointerCapture(e.pointerId)) {
      stageRef.current.releasePointerCapture(e.pointerId);
    }
    setDraggedItemId(null);
    setDragPos(null);
    setActiveDropZone(null);
    dragStart.current = null;
    latestDragPosition.current = null;
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
      setErrorMessage(`Not quite! You moved ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`);
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

  // Check success condition after state update
  useEffect(() => {
    const questionChanged = prevQuestionId.current !== question.id || prevObjectId.current !== question.objectId || prevCount.current !== count;
    if (questionChanged) {
      hasTriggeredSuccess.current = false;
    }

    if (isAllMoved) {
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
  }, [items.map(i => i.counted).join(","), question.id, question.objectId, count, requireAnswerInput, isAllMoved]);

  const currentlyCounted = items.filter(i => i.counted).length;
  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const remaining = count - currentlyCounted;

  /**
   * The object that just landed in the counted bin, for one bounce.
   *
   * Derived from the tally rather than set at drop time: a child dragging fast
   * gets one clear "that one is in" per object, and nothing to clean up if the
   * drop is undone.
   */
  const [poppedId, setPoppedId] = useState<string | null>(null);
  useEffect(() => {
    if (!isPlayMode || currentlyCounted === 0) {
      setPoppedId(null);
      return;
    }
    const newest = items.reduce<DraggableItem | null>(
      (best, item) =>
        item.counted && (!best || (item.countedOrder ?? 0) > (best.countedOrder ?? 0)) ? item : best,
      null
    );
    if (!newest) return;
    setPoppedId(newest.id);
    const timer = setTimeout(() => setPoppedId(null), 340);
    return () => clearTimeout(timer);
    // Deliberately keyed on the tally, not on `items`: a drag frame must not restart the pop.
  }, [currentlyCounted, isPlayMode]);

  // Bin names come from the slide when a teacher set them; the fallbacks are
  // the instruction itself, so a child who cannot yet read "uncounted" still
  // knows which side is which.
  const sourceLabel = question.config.sourceBinLabel || (learnerMode ? "Move these" : "Uncounted");
  const destinationLabel = question.config.destinationBinLabel || (learnerMode ? "Counted here" : "Counted");

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      showGrid={showGrid}
      isDark={isDark}
      gridSize={gridSize}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<ArrowRightLeft size={16} />}
      headerTitle="Move & Count"
      headerSubtitle={
        isAllMoved && requireAnswerInput
          ? `Moving complete! Enter the total answer below.`
          : `${currentlyCounted} of ${count} moved`
      }
      readAloudText={`Move and count ${count} ${obj.label}. Drag each object into the ${question.config.destinationBinLabel || "counted pond"}.`}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={isPlayMode ? (
        <CanvasChip accent={solvedForGuide ? "emerald" : accent} isDark={isDark}>
          {solvedForGuide ? "All counted" : `${remaining} to move`}
        </CanvasChip>
      ) : (
        <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset object positions">
          <RotateCcw size={12} />
          Reset
        </Button>
      )}
      footerStatus={
        solvedForGuide
          ? `All ${count} moved and counted!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag objects to set their starting positions"
      }
      footerSolved={solvedForGuide}
    >
      {/* Left/Right Split Layout */}
      <div
        ref={stageRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        /*
          `flex-1` is what makes this fill a launcher, so the floors below stay
          modest on purpose: a taller floor than the window can give overflows
          the layout's `min-h-0` parent and pushes the bins over the hint line.
        */
        className="relative flex-1 w-full flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4 my-2 min-h-[260px] sm:min-h-[300px] md:min-h-[340px] touch-none select-none overscroll-none"
      >
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

        {/* Left/Top bin — objects still to move */}
        <CanvasBin
          ref={sourceRef}
          label={sourceLabel}
          tally={isPlayMode ? remaining : undefined}
          accent={accent}
          isDark={isDark}
          active={activeDropZone === "source"}
          complete={isPlayMode && remaining === 0}
          isEmpty={isPlayMode && remaining === 0}
          emptyIcon={<PartyPopper size={22} />}
          // Suppressed once the answer panel docks here, or the two would stack up.
          emptyHint={isPlayMode && !(requireAnswerInput && isAllMoved) ? "All moved!" : undefined}
        />

        {/* Right/Bottom bin — objects already counted */}
        <CanvasBin
          ref={destinationRef}
          label={destinationLabel}
          tally={isPlayMode ? `${currentlyCounted} / ${count}` : undefined}
          accent={accent}
          isDark={isDark}
          active={activeDropZone === "destination"}
          complete={isAllMoved}
          isEmpty={isPlayMode && currentlyCounted === 0}
          emptyIcon={<MoveRight size={26} className="animate-pulse" />}
          emptyHint={isPlayMode ? `Drop each ${obj.label} here and count` : undefined}
        >
          <GhostGuideOverlay
            show={showGhostGuide && !solvedForGuide}
            label={
              isAllMoved && requireAnswerInput
                ? `Enter how many items you moved (${count}) in the box!`
                : `Drag each ${obj.label} into the ${destinationLabel}!`
            }
            isDark={isDark}
            labelPlacement="top"
          />
        </CanvasBin>

        {/* Draggable Items */}
        {items.map((item, idx) => {
          const assetType = question.config?.assetType || "emoji";
          const isDragging = draggedItemId === item.id;

          let itemClassName = `flex flex-col items-center justify-center select-none touch-none outline-none ${itemSize > 88 ? "rounded-2xl" : "rounded-xl"}`;
          itemClassName += " cursor-grab active:cursor-grabbing transition-[box-shadow,transform,border-color] focus-visible:ring-4 focus-visible:ring-indigo-400/40";

          if (hasFrame) {
            itemClassName += item.counted
              ? ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
            if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
          } else {
            itemClassName += item.counted
              ? " scale-105 drop-shadow-md"
              : " drop-shadow-sm hover:drop-shadow-md hover:scale-105";
            if (isDragging) itemClassName += " scale-125 drop-shadow-2xl z-50";
          }

          if (poppedId === item.id && !isDragging) itemClassName += " animate-drop-pop";

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${item.counted ? "Counted" : "Uncounted"} ${obj.label} ${idx + 1}. Drag to move.`}
              onPointerDown={(e) => handlePointerDown(e, item.id)}
              style={objectStyle({ x: item.x, y: item.y, size: itemSize, dragging: isDragging })}
              className={itemClassName}
            >
              {item.counted && item.countedOrder !== null && (
                <div
                  className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold font-mono flex items-center justify-center rounded-full z-10 animate-scale-in ${accentChipClass(accent, isDark)}`}
                  style={{
                    width: `${badgeSize}px`,
                    height: `${badgeSize}px`,
                    fontSize: `${Math.round(badgeSize * 0.52)}px`
                  }}
                >
                  {item.countedOrder}
                </div>
              )}

              {/* Coordinate tooltip when dragging in design mode */}
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {item.x}, {item.y}
                </div>
              )}

              <CountingAsset type={assetType as any} emoji={obj.emoji} size={assetSize} />
            </div>
          );
        })}

        {/* ── Answer Input Box Overlay after moving all items ── */}
        <AnimatePresence>
          {isPlayMode && requireAnswerInput && isAllMoved && (
            /*
              Docked over the bin the objects just left, never over the ones
              being counted: the question is "how many did you move in total",
              so covering the objects with the answer box is the one thing this
              panel must not do. That bin is empty by the time it appears — the
              top half when the bins are stacked, the left half when they are
              side by side. Positioning lives on this wrapper because the panel
              itself animates with transforms, which would fight a centring one.
            */
            <div className="absolute z-50 pointer-events-none inset-x-2 top-2 sm:inset-x-auto sm:left-3 sm:top-0 sm:bottom-0 sm:w-[calc(50%-1.5rem)] sm:flex sm:items-center">
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="w-full pointer-events-auto flex flex-col items-center justify-center p-3 sm:p-4 md:p-5
                  rounded-2xl md:rounded-3xl backdrop-blur-md border shadow-2xl sm:max-w-md md:max-w-lg mx-auto"
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
                    How many {obj.label}{count === 1 ? "" : "s"} did you move in total?
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
