import React, { useState, useEffect, useRef } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, ArrowRightLeft } from "lucide-react";
import { CanvasProps } from "./types";
import { Button } from "../ui";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentChipClass } from "./canvasTheme";
import {
  GhostGuideOverlay,
  useGhostGuide,
  useCPASwitcher,
  FactFamilyCelebrationCard
} from "../../pedagogy";

interface DraggableItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  counted: boolean;
  countedOrder: number | null;
}

const ITEM_SIZE = 64; // w-16 h-16

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

/**
 * A zone's box in stage coordinates.
 *
 * Items are absolutely positioned against the stage, which carries no CSS
 * transform, so this is a plain rect difference. (It previously scaled by
 * `offsetParent.offsetWidth / stageRect.width`, which silently distorted every
 * zone once the stage stopped being the offset parent.)
 */
const getRelativeRect = (element: HTMLElement, stageRect: DOMRect) => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - stageRect.left,
    top: rect.top - stageRect.top,
    width: rect.width,
    height: rect.height
  };
};

const getSlotPosition = (
  order: number,
  total: number,
  zone: { left: number; top: number; width: number; height: number },
  itemSize: number = 64
) => {
  const padding = 18;
  const usableWidth = Math.max(itemSize, zone.width - padding * 2);
  const usableHeight = Math.max(itemSize, zone.height - padding * 2);
  const maxColumns = Math.max(1, Math.floor((usableWidth + 10) / (itemSize + 10)));
  const columns = Math.max(1, Math.min(total, maxColumns, Math.ceil(Math.sqrt(total))));
  const rows = Math.ceil(total / columns);
  const column = (order - 1) % columns;
  const row = Math.floor((order - 1) / columns);

  // Step from one item to the next. Clamped so objects always keep a visible
  // gap, and never spread so far apart that the group stops reading as a group.
  const minStep = itemSize + 12;
  const maxStep = itemSize + 32;
  const stepFor = (available: number, cellCount: number) =>
    cellCount > 1
      ? Math.max(minStep, Math.min(maxStep, (available - itemSize) / (cellCount - 1)))
      : 0;

  const gapX = stepFor(usableWidth, columns);
  const gapY = stepFor(usableHeight, rows);
  const contentWidth = itemSize + (columns - 1) * gapX;
  const contentHeight = itemSize + (rows - 1) * gapY;

  return {
    x: Math.round(zone.left + (zone.width - contentWidth) / 2 + column * gapX),
    y: Math.round(zone.top + (zone.height - contentHeight) / 2 + row * gapY)
  };
};

/**
 * The area inside a zone that items may occupy — the zone minus its caption.
 * The inset matches the caption row only; it used to reserve 54px for a header
 * bar that no longer exists, which pushed every group off-centre.
 */
const CAPTION_INSET = 26;

const getContentZone = (zone: { left: number; top: number; width: number; height: number }, itemSize: number = 64) => ({
  left: zone.left,
  top: zone.top + CAPTION_INSET,
  width: zone.width,
  height: Math.max(itemSize, zone.height - CAPTION_INSET - 12)
});

export const MoveAndCountCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onSuccess, onUpdateQuestionConfig }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;

  const [items, setItems] = useState<DraggableItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<"source" | "destination" | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const latestDragPosition = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<DragStart | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLDivElement>(null);
  const customPositionKey = JSON.stringify(question.config.customPositions || []);
  const gridSize = question.config.layoutGridSize || 20;

  const isSolved = items.length > 0 && items.every(i => i.counted);
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });
  const { representation, setRepresentation } = useCPASwitcher(question.config.defaultRepresentation || "concrete");

  useEffect(() => {
    if (question.config.defaultRepresentation) {
      setRepresentation(question.config.defaultRepresentation);
    }
  }, [question.config.defaultRepresentation, setRepresentation]);

  const [dimensions, setDimensions] = useState({ width: 480, height: 320 });
  const isMobile = dimensions.width < 640;
  const itemSize = isMobile ? 52 : 64;

  // Measure the exact coordinate space used by the draggable objects.
  useEffect(() => {
    if (!stageRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 480,
          height: entry.contentRect.height || 320
        });
      }
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  const prevQuestionId = useRef(question.id);
  const prevObjectId = useRef(question.objectId);
  const prevCount = useRef(count);

  useEffect(() => {
    setItems(prev => {
      const isMobile = dimensions.width < 640;
      const itemSize = isMobile ? 52 : 64;
      const customPositions = (isMobile && isPlayMode) ? [] : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? dimensions.width / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? dimensions.height / layoutReference.height : 1;
      const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
      const rows = Math.max(1, Math.ceil(count / columns));
      const stageRect = stageRef.current?.getBoundingClientRect();
      const measuredSource = stageRect && sourceRef.current
        ? getContentZone(getRelativeRect(sourceRef.current, stageRect), itemSize)
        : null;
      const fallbackZone = measuredSource || {
        left: 18,
        top: 18,
        width: Math.max(itemSize, dimensions.width / 2 - 36),
        height: Math.max(itemSize, dimensions.height - 36)
      };

      const questionChanged = prevQuestionId.current !== question.id || prevObjectId.current !== question.objectId || prevCount.current !== count;

      const newItems: DraggableItem[] = Array.from({ length: count }).map((_, idx) => {
        const itemId = `move-item-${idx}`;
        const existing = prev.find(i => i.id === itemId);
        
        if (existing && !questionChanged) {
          return existing;
        }

        const savedPos = customPositions.find(p => p.id === itemId);
        const defaultPosition = getSlotPosition(idx + 1, Math.max(count, columns * rows), fallbackZone, itemSize);
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
  }, [question.id, question.objectId, count, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions.width, dimensions.height, isPlayMode]);

  const reset = () => {
    const stageRect = stageRef.current?.getBoundingClientRect();
    const measuredSource = stageRect && sourceRef.current
      ? getContentZone(getRelativeRect(sourceRef.current, stageRect))
      : null;
    const fallbackZone = measuredSource || {
        left: 18,
        top: 18,
        width: Math.max(ITEM_SIZE, dimensions.width / 2 - 36),
        height: Math.max(ITEM_SIZE, dimensions.height - 36)
      };
    const updated = items.map((item, idx) => {
      const position = getSlotPosition(idx + 1, count, fallbackZone);
      return { ...item, ...position, counted: false, countedOrder: null };
    });
    setItems(updated);

    if (!isPlayMode && onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: updated.map(item => ({ id: item.id, x: item.x, y: item.y })),
        layoutReference: {
          width: stageRef.current?.clientWidth || dimensions.width,
          height: stageRef.current?.clientHeight || dimensions.height
        }
      });
    }
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
    if (e.button !== 0 || !stageRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const pointer = getStagePointer(e);
    const item = items.find(candidate => candidate.id === id);
    if (!pointer || !item) return;

    sounds.playPop();
    setDraggedItemId(id);
    dragOffset.current = {
      x: pointer.x - item.x,
      y: pointer.y - item.y
    };
    dragStart.current = { ...item };
    latestDragPosition.current = { x: item.x, y: item.y };

    reportActivity();
    stageRef.current.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId || !stageRef.current) return;
    e.preventDefault();
    const pointer = getStagePointer(e);
    if (!pointer) return;

    let x = pointer.x - dragOffset.current.x;
    let y = pointer.y - dragOffset.current.y;

    // Boundary constraints
    x = Math.max(4, Math.min(stageRef.current.clientWidth - ITEM_SIZE - 4, x));
    y = Math.max(4, Math.min(stageRef.current.clientHeight - ITEM_SIZE - 4, y));

    const nextPosition = { x: Math.round(x), y: Math.round(y) };
    latestDragPosition.current = nextPosition;
    setDragPos(nextPosition);

    const stageRect = stageRef.current.getBoundingClientRect();
    const centerX = nextPosition.x + ITEM_SIZE / 2;
    const centerY = nextPosition.y + ITEM_SIZE / 2;
    const containsCenter = (element: HTMLDivElement | null) => {
      if (!element) return false;
      const zone = getRelativeRect(element, stageRect);
      return centerX >= zone.left - 12
        && centerX <= zone.left + zone.width + 12
        && centerY >= zone.top - 12
        && centerY <= zone.top + zone.height + 12;
    };
    setActiveDropZone(containsCenter(destinationRef.current)
      ? "destination"
      : containsCenter(sourceRef.current)
        ? "source"
        : null);

    setItems(prev =>
      prev.map(item => (item.id === draggedItemId ? { ...item, ...nextPosition } : item))
    );
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId || !stageRef.current) return;
    e.preventDefault();
    const id = draggedItemId;
    const stageRect = stageRef.current.getBoundingClientRect();
    const destination = destinationRef.current
      ? getRelativeRect(destinationRef.current, stageRect)
      : null;
    const source = sourceRef.current
      ? getRelativeRect(sourceRef.current, stageRect)
      : null;

    setItems(prev => {
      const storedItem = prev.find(i => i.id === id);
      if (!storedItem) return prev;
      const item = latestDragPosition.current
        ? { ...storedItem, ...latestDragPosition.current }
        : storedItem;

      if (isPlayMode) {
        const centerX = item.x + ITEM_SIZE / 2;
        const centerY = item.y + ITEM_SIZE / 2;
        const isInZone = (zone: typeof destination) => Boolean(zone
          && centerX >= zone.left - 12
          && centerX <= zone.left + zone.width + 12
          && centerY >= zone.top - 12
          && centerY <= zone.top + zone.height + 12);
        const isInDestination = isInZone(destination);
        const isInSource = isInZone(source);
        const alreadyCountedCount = prev.filter(i => i.counted && i.id !== id).length;

        if (isInDestination && destination) {
          const order = item.countedOrder || alreadyCountedCount + 1;
          if (!item.counted && order !== count) sounds.playTick(order);
          const position = getSlotPosition(order, count, getContentZone(destination));
          return prev.map(candidate => candidate.id === id
            ? { ...candidate, ...position, counted: true, countedOrder: order }
            : candidate);
        }

        if (isInSource && item.counted) {
          sounds.playSlide();
          const remaining = prev
            .filter(candidate => candidate.counted && candidate.id !== id)
            .sort((a, b) => (a.countedOrder || 0) - (b.countedOrder || 0));
          const sourcePosition = dragStart.current && !dragStart.current.counted
            ? { x: dragStart.current.x, y: dragStart.current.y }
            : getSlotPosition(prev.findIndex(candidate => candidate.id === id) + 1, count, source ? getContentZone(source) : {
                left: 0,
                top: 0,
                width: stageRef.current?.clientWidth || dimensions.width,
                height: stageRef.current?.clientHeight || dimensions.height
              });

          return prev.map(candidate => {
            if (candidate.id === id) {
              return { ...candidate, ...sourcePosition, counted: false, countedOrder: null };
            }
            const remainingIndex = remaining.findIndex(countedItem => countedItem.id === candidate.id);
            if (remainingIndex === -1 || !destination) return candidate;
            const order = remainingIndex + 1;
            return { ...candidate, ...getSlotPosition(order, count, getContentZone(destination)), countedOrder: order };
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
              width: stageRef.current?.clientWidth || dimensions.width,
              height: stageRef.current?.clientHeight || dimensions.height
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

  const hasTriggeredSuccess = useRef(false);

  // Check success condition after state update
  useEffect(() => {
    const questionChanged = prevQuestionId.current !== question.id || prevObjectId.current !== question.objectId || prevCount.current !== count;
    if (questionChanged) {
      hasTriggeredSuccess.current = false;
    }

    if (items.length > 0 && items.every(i => i.counted)) {
      if (!hasTriggeredSuccess.current) {
        hasTriggeredSuccess.current = true;
        sounds.playSuccess();
        if (onSuccess) onSuccess();
      }
    } else {
      hasTriggeredSuccess.current = false;
    }
  }, [items.map(i => i.counted).join(","), question.id, question.objectId, count]);

  const currentlyCounted = items.filter(i => i.counted).length;
  const draggedItem = draggedItemId ? items.find(i => i.id === draggedItemId) : null;

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const remaining = count - currentlyCounted;

  // Zones read as elevation, not colour; the accent appears only on the live drop zone.
  const zoneClass = `w-full sm:w-1/2 rounded-3xl p-3 sm:p-4 relative flex flex-col transition-colors duration-200 ${surfaceClass(isDark)}`;
  const zoneLabelClass = `font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${captionClass(isDark)}`;

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
      headerSubtitle={`${currentlyCounted} of ${count} moved`}
      readAloudText={`Move and count ${count} ${obj.label}. Drag each object into the ${question.config.destinationBinLabel || "counted pond"}.`}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={isPlayMode ? (
        <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
          {isSolved ? "All counted" : `${remaining} to move`}
        </CanvasChip>
      ) : (
        <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset object positions">
          <RotateCcw size={12} />
          Reset
        </Button>
      )}
      footerStatus={
        isSolved
          ? `All ${count} moved and counted!`
          : isPlayMode
            ? undefined
            : "Design Mode · Drag objects to set their starting positions"
      }
      footerSolved={isSolved}
    >
      {/* Left/Right Split Layout (Responsive vertical stack on mobile, side-by-side on tablet/desktop) */}
      <div
        ref={stageRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4 my-2 min-h-[280px] touch-none select-none overscroll-none"
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

        {/* Left/Top zone — uncounted source */}
        <div
          ref={sourceRef}
          className={`${zoneClass} ${activeDropZone === "source" ? accentChipClass(accent, isDark) : ""}`}
        >
          <span className={zoneLabelClass}>
            {question.config.sourceBinLabel || "Uncounted"}
          </span>
          <div className="flex-1 min-h-[120px] pointer-events-none" />
        </div>

        {/* Right/Bottom zone — counted destination */}
        <div
          ref={destinationRef}
          className={`${zoneClass} ${activeDropZone === "destination" ? accentChipClass(accent, isDark) : ""}`}
        >
          <span className={zoneLabelClass}>
            {question.config.destinationBinLabel || "Counted"}
          </span>
          <div className="flex-1 min-h-[120px] pointer-events-none relative">
            <GhostGuideOverlay
              show={showGhostGuide && !isSolved}
              label={`Drag each ${obj.label} into the ${question.config.destinationBinLabel || "counted pond"}!`}
              isDark={isDark}
              labelPlacement="top"
            />
          </div>
        </div>

        {/* Draggable Items */}
        {items.map((item, idx) => {
          const assetType = question.config?.assetType || "emoji";
          const hasFrame = question.config.showItemFrame ?? true;
          const isDragging = draggedItemId === item.id;

          let itemClassName = "flex flex-col items-center justify-center select-none touch-none rounded-xl outline-none";
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

          const transitionStyle = isDragging
            ? "none"
            : "left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.15s ease";

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${item.counted ? "Counted" : "Uncounted"} ${obj.label} ${idx + 1}. Drag to move.`}
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
              {item.counted && item.countedOrder !== null && (
                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 font-bold text-[9px] font-mono w-5 h-5 flex items-center justify-center rounded-full z-10 animate-scale-in ${accentChipClass(accent, isDark)}`}>
                  {item.countedOrder}
                </div>
              )}

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

      <FactFamilyCelebrationCard
        isSolved={isSolved}
        numberBond={{ part1: currentlyCounted, part2: 0, total: count }}
        factFamilyText={`Brilliant! You moved across and counted all ${count} ${obj.label}!`}
        isDark={isDark}
      />
    </SharedCanvasLayout>
  );
};
