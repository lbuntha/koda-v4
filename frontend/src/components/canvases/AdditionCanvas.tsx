import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CanvasProps } from "./types";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { Button } from "../ui";
import { sounds } from "../../sound";
import { Sparkles, RotateCcw, Package, PlusCircle, Move, Maximize2, Check, Calculator, AlertCircle, Delete } from "lucide-react";
import { SpeechReadAloudButton, GhostGuideOverlay, useGhostGuide, useCPASwitcher, FactFamilyCelebrationCard } from "../../pedagogy";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasChip, surfaceClass, captionClass, accentChipClass } from "./canvasTheme";

const getTenFrameMetrics = (zone: LayoutRect) => {
  const availW = Math.max(80, zone.width - 24);
  const availH = Math.max(40, zone.height - 46);
  
  const frameW = Math.min(availW, availH * 2.5);
  const frameH = frameW / 2.5;
  
  const frameLeft = (zone.width - frameW) / 2;
  const frameTop = 36 + (availH - frameH) / 2;
  
  const cellW = frameW / 5;
  const cellH = frameH / 2;
  
  return {
    left: frameLeft,
    top: frameTop,
    width: frameW,
    height: frameH,
    cellWidth: cellW,
    cellHeight: cellH,
    itemSize: Math.max(16, cellH * 0.85)
  };
};

const TenFrameGrid: React.FC<{ isDark?: boolean; zone: LayoutRect }> = ({
  isDark = false,
  zone
}) => {
  const metrics = getTenFrameMetrics(zone);
  const cellBorder = isDark ? "border-white/10 bg-black/20" : "border-slate-900/10 bg-slate-900/[0.04]";
  return (
    <div 
      style={{
        position: "absolute",
        left: `${zone.left + metrics.left}px`,
        top: `${zone.top + metrics.top}px`,
        width: `${metrics.width}px`,
        height: `${metrics.height}px`,
        zIndex: 5,
      }}
      className="grid grid-cols-5 grid-rows-2 gap-0.5 p-0.5 rounded-lg border border-slate-350 dark:border-slate-700 bg-slate-500/5 pointer-events-none transition-all duration-300"
    >
      {Array.from({ length: 10 }).map((_, i) => (
        <div 
          key={i} 
          className={`border border-dashed rounded flex items-center justify-center relative overflow-hidden transition-all duration-300 ${cellBorder}`}
        />
      ))}
    </div>
  );
};

interface VisualItem {
  id: string;
  emoji: string;
  assetType: string;
  groupId: 1 | 2 | "basket";
  x: number;
  y: number;
  origX: number;
  origY: number;
}

const ITEM_SIZE = 48;

interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const getRelativeElementRect = (container: HTMLElement, element: HTMLElement): LayoutRect => {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const scaleX = containerRect.width > 0 ? container.clientWidth / containerRect.width : 1;
  const scaleY = containerRect.height > 0 ? container.clientHeight / containerRect.height : 1;
  return {
    left: (elementRect.left - containerRect.left) * scaleX,
    top: (elementRect.top - containerRect.top) * scaleY,
    width: elementRect.width * scaleX,
    height: elementRect.height * scaleY
  };
};

const containsItemCenter = (zone: LayoutRect, x: number, y: number, size: number) => {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  return centerX >= zone.left
    && centerX <= zone.left + zone.width
    && centerY >= zone.top
    && centerY <= zone.top + zone.height;
};

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
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const group1Ref = useRef<HTMLDivElement>(null);
  const group2Ref = useRef<HTMLDivElement>(null);
  const basketRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ id: string; x: number; y: number } | null>(null);
  const latestDragPosition = useRef<{ x: number; y: number } | null>(null);
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

  const basketCount = items.filter(it => it.groupId === "basket").length;
  const isAdditionComplete = basketCount === targetSum;
  const solvedForGuide = isAdditionComplete && (requireAnswerInput ? answerStatus === "correct" : true);
  const isSolved = solvedForGuide;

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

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [basketLayout, setBasketLayout] = useState<LayoutRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [basketDrag, setBasketDrag] = useState<'move' | 'resize' | null>(null);
  const basketDragStart = useRef({ mx: 0, my: 0 });
  const basketDragStartLayout = useRef<LayoutRect>({ left: 0, top: 0, width: 0, height: 0 });

  const customPositionKey = JSON.stringify(question.config.customPositions || []);
  const gridSize = question.config.layoutGridSize || 20;

  // Measure container and boxes dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current) {
          setDimensions({
            width: entry.contentRect.width || 480,
            height: entry.contentRect.height || 320
          });
        }
      }
    });
    ro.observe(containerRef.current);
    if (group1Ref.current) ro.observe(group1Ref.current);
    if (group2Ref.current) ro.observe(group2Ref.current);
    if (basketRef.current) ro.observe(basketRef.current);
    return () => ro.disconnect();
  }, [isPlayMode]);

  // Compute box dimensions and layout regions dynamically
  const padding = 16;
  const boxHeight = 110;
  const w = dimensions.width || 480;
  const h = dimensions.height || 320;
  const isMobile = w < 640;
  const boxWidth = isMobile ? Math.min(280, w - 24) : Math.max(140, Math.min(200, (w - 32 - 40) / 2));
  const boxY = 44;

  const box1X = padding;
  const box2X = w - padding - boxWidth;

  const basketWidth = Math.max(240, Math.min(360, w - 32));
  const basketHeight = Math.max(100, Math.min(130, h - boxY - boxHeight - 28));
  const basketX = (w - basketWidth) / 2;
  const basketY = h - basketHeight - 14;

  const getGroupZone = useCallback((groupId: 1 | 2): LayoutRect => {
    const container = containerRef.current;
    const group = groupId === 1 ? group1Ref.current : group2Ref.current;
    if (container && group) return getRelativeElementRect(container, group);
    return {
      left: groupId === 1 ? box1X : box2X,
      top: boxY,
      width: boxWidth,
      height: boxHeight
    };
  }, [box1X, box2X, boxWidth, boxY, boxHeight]);

  // Sync or initialize basket layout positions
  useEffect(() => {
    if (w > 0 && h > 0) {
      const saved = question.config.containerPositions?.['basket'];
      const savedDim = (question.config as any).basketDimensions;
      if (saved && savedDim) {
        const effectiveW = Math.min(savedDim.width, Math.max(160, w - 16));
        const effectiveH = Math.min(savedDim.height, Math.max(80, h - boxY - boxHeight - 16));
        const effectiveX = Math.min(saved.x, Math.max(8, w - effectiveW - 8));
        const effectiveY = Math.min(saved.y, Math.max(8, h - effectiveH - 8));
        setBasketLayout({ left: effectiveX, top: effectiveY, width: effectiveW, height: effectiveH });
      } else {
        setBasketLayout({ left: basketX, top: basketY, width: basketWidth, height: basketHeight });
      }
    }
  }, [w, h, question.id, basketX, basketY, basketWidth, basketHeight, boxY, boxHeight]);

  const getBasketZone = useCallback((): LayoutRect => {
    if (basketLayout.width > 0) return basketLayout;
    return { left: basketX, top: basketY, width: basketWidth, height: basketHeight };
  }, [basketLayout, basketX, basketY, basketWidth, basketHeight]);

  // Grid layout helper inside group boxes
  const getGroupItemPos = useCallback((groupId: 1 | 2, index: number, count: number) => {
    const zone = getGroupZone(groupId);

    if (representation === "pictorial" || representation === "abstract") {
      const metrics = getTenFrameMetrics(zone);
      const row = Math.floor(index / 5);
      const col = index % 5;
      return {
        x: Math.round(zone.left + metrics.left + col * metrics.cellWidth + (metrics.cellWidth - metrics.itemSize) / 2),
        y: Math.round(zone.top + metrics.top + row * metrics.cellHeight + (metrics.cellHeight - metrics.itemSize) / 2),
        size: metrics.itemSize
      };
    }

    const areaLeft = zone.left + 12;
    const areaTop = zone.top + 34;
    const areaW = Math.max(ITEM_SIZE, zone.width - 24);
    const areaH = Math.max(ITEM_SIZE, zone.height - 42);

    const dynamicSize = count > 6 ? 34 : count > 4 ? 40 : 44;

    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const gapX = cols > 1 ? (areaW - cols * dynamicSize) / (cols - 1) : 0;
    const gapY = rows > 1 ? (areaH - rows * dynamicSize) / (rows - 1) : 0;

    const r = Math.floor(index / cols);
    const c = index % cols;

    return {
      x: Math.round(areaLeft + c * (dynamicSize + gapX)),
      y: Math.round(areaTop + r * (dynamicSize + gapY)),
      size: dynamicSize
    };
  }, [getGroupZone, representation]);

  // Grid layout helper inside bottom basket
  const getBasketItemPos = useCallback((index: number, total: number) => {
    const zone = getBasketZone();

    if (representation === "pictorial" || representation === "abstract") {
      const metrics = getTenFrameMetrics(zone);
      const row = Math.floor(index / 5);
      const col = index % 5;
      return {
        x: Math.round(zone.left + metrics.left + col * metrics.cellWidth + (metrics.cellWidth - metrics.itemSize) / 2),
        y: Math.round(zone.top + metrics.top + row * metrics.cellHeight + (metrics.cellHeight - metrics.itemSize) / 2),
        size: metrics.itemSize
      };
    }

    const areaLeft = zone.left + 16;
    const areaTop = zone.top + 36;
    const areaW = Math.max(ITEM_SIZE, zone.width - 32);
    const areaH = Math.max(ITEM_SIZE, zone.height - 48);

    const dynamicSize = total > 8 ? 32 : total > 6 ? 36 : 40;

    const cols = Math.min(8, Math.max(3, Math.ceil(total / 2)));
    const rows = Math.ceil(total / cols);

    const stepX = cols > 1 ? (areaW - dynamicSize) / (cols - 1) : 0;
    const stepY = rows > 1 ? (areaH - dynamicSize) / (rows - 1) : 0;

    const r = Math.floor(index / cols);
    const c = index % cols;

    return {
      x: Math.round(areaLeft + c * stepX),
      y: Math.round(areaTop + r * stepY),
      size: dynamicSize
    };
  }, [getBasketZone, representation]);

  // Initialize or update visual items
  useEffect(() => {
    if (w === 0 || h === 0) return;

    const customPositions = question.config.customPositions || [];
    const layoutRef = question.config.layoutReference;

    const computeInitialItems = (): VisualItem[] => {
      const g1Items: VisualItem[] = Array.from({ length: a1 }).map((_, i) => {
        const id = `g1-${i}`;
        const saved = customPositions.find(p => p.id === id);
        let x: number, y: number;
        if (!isPlayMode && saved) {
          if (layoutRef && layoutRef.width > 0 && layoutRef.height > 0) {
            x = Math.round(saved.x * (w / layoutRef.width));
            y = Math.round(saved.y * (h / layoutRef.height));
          } else {
            x = saved.x;
            y = saved.y;
          }
        } else {
          const defaultPos = getGroupItemPos(1, i, a1);
          x = defaultPos.x;
          y = defaultPos.y;
        }
        return {
          id,
          emoji: obj.emoji,
          assetType,
          groupId: 1,
          x,
          y,
          origX: x,
          origY: y
        };
      });

      const g2Items: VisualItem[] = Array.from({ length: a2 }).map((_, i) => {
        const id = `g2-${i}`;
        const saved = customPositions.find(p => p.id === id);
        let x: number, y: number;
        if (!isPlayMode && saved) {
          if (layoutRef && layoutRef.width > 0 && layoutRef.height > 0) {
            x = Math.round(saved.x * (w / layoutRef.width));
            y = Math.round(saved.y * (h / layoutRef.height));
          } else {
            x = saved.x;
            y = saved.y;
          }
        } else {
          const defaultPos = getGroupItemPos(2, i, a2);
          x = defaultPos.x;
          y = defaultPos.y;
        }
        return {
          id,
          emoji: obj.emoji,
          assetType,
          groupId: 2,
          x,
          y,
          origX: x,
          origY: y
        };
      });

      return [...g1Items, ...g2Items];
    };

    setItems(prev => {
      if (prev.length === 0 || !isPlayMode) return computeInitialItems();

      return prev.map(it => {
        if (it.groupId === "basket") return it;
        const groupId = it.id.startsWith("g1-") ? 1 : 2;
        const index = parseInt(it.id.split("-")[1], 10);
        const groupCount = groupId === 1 ? a1 : a2;
        const pos = getGroupItemPos(groupId, index, groupCount);
        return {
          ...it,
          x: pos.x,
          y: pos.y,
          origX: pos.x,
          origY: pos.y
        };
      });
    });
  }, [w, h, a1, a2, obj.emoji, assetType, isPlayMode, customPositionKey, getGroupItemPos, question.config.layoutReference]);

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
    setBasketLayout({ left: basketX, top: basketY, width: basketWidth, height: basketHeight });
    setItems(prev => prev.map(it => {
      const groupId = it.id.startsWith("g1-") ? 1 : 2;
      const index = parseInt(it.id.split("-")[1], 10);
      const groupCount = groupId === 1 ? a1 : a2;
      const pos = getGroupItemPos(groupId, index, groupCount);
      return {
        ...it,
        groupId,
        x: pos.x,
        y: pos.y,
        origX: pos.x,
        origY: pos.y
      };
    }));

    if (updateConfigRef.current) {
      updateConfigRef.current({
        customPositions: [],
        containerPositions: { basket: { x: basketX, y: basketY } },
        basketDimensions: { width: basketWidth, height: basketHeight }
      } as any);
    }
  };

  const getCanvasPointer = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const scaleX = container.clientWidth / (rect.width || 1);
    const scaleY = container.clientHeight / (rect.height || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleBasketMoveDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setBasketDrag('move');
    basketDragStart.current = { mx: e.clientX, my: e.clientY };
    basketDragStartLayout.current = { ...basketLayout };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handleBasketResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setBasketDrag('resize');
    basketDragStart.current = { mx: e.clientX, my: e.clientY };
    basketDragStartLayout.current = { ...basketLayout };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    reportActivity();
    e.stopPropagation();
    sounds.playPop();
    setDraggedItemId(id);

    const pointer = getCanvasPointer(e);
    const item = items.find(it => it.id === id);
    if (pointer && item) {
      dragOffset.current = {
        x: pointer.x - item.x,
        y: pointer.y - item.y
      };
      dragStart.current = { id, x: item.x, y: item.y };
      latestDragPosition.current = { x: item.x, y: item.y };
    }

    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;

    if (!isPlayMode && basketDrag) {
      e.preventDefault();
      const dx = e.clientX - basketDragStart.current.mx;
      const dy = e.clientY - basketDragStart.current.my;
      const initial = basketDragStartLayout.current;

      if (basketDrag === 'move') {
        let newX = Math.max(8, Math.min(w - initial.width - 8, initial.left + dx));
        let newY = Math.max(8, Math.min(h - initial.height - 8, initial.top + dy));
        if (showGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }
        setBasketLayout(prev => ({ ...prev, left: newX, top: newY }));
      } else if (basketDrag === 'resize') {
        let newW = Math.max(160, Math.min(w - initial.left - 8, initial.width + dx));
        let newH = Math.max(80, Math.min(h - initial.top - 8, initial.height + dy));
        if (showGrid) {
          newW = Math.round(newW / gridSize) * gridSize;
          newH = Math.round(newH / gridSize) * gridSize;
        }
        setBasketLayout(prev => ({ ...prev, width: newW, height: newH }));
      }
      return;
    }

    if (!draggedItemId) return;
    e.preventDefault();
    const pointer = getCanvasPointer(e);
    if (!pointer) return;

    let x = pointer.x - dragOffset.current.x;
    let y = pointer.y - dragOffset.current.y;

    x = Math.max(5, Math.min(containerRef.current.clientWidth - ITEM_SIZE - 5, x));
    y = Math.max(5, Math.min(containerRef.current.clientHeight - ITEM_SIZE - 5, y));

    const nextPosition = { x: Math.round(x), y: Math.round(y) };
    latestDragPosition.current = nextPosition;

    setItems(prev =>
      prev.map(it => (it.id === draggedItemId ? { ...it, ...nextPosition } : it))
    );
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!isPlayMode && basketDrag) {
      if (updateConfigRef.current) {
        updateConfigRef.current({
          containerPositions: {
            ...question.config.containerPositions,
            basket: { x: basketLayout.left, y: basketLayout.top }
          },
          basketDimensions: { width: basketLayout.width, height: basketLayout.height }
        } as any);
      }
      setBasketDrag(null);
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (!draggedItemId) return;
    const id = draggedItemId;

    setItems(prev => {
      const storedItem = prev.find(it => it.id === id);
      if (!storedItem) return prev;
      const item = latestDragPosition.current
        ? { ...storedItem, ...latestDragPosition.current }
        : storedItem;

      if (!isPlayMode) {
        const snappedX = showGrid ? Math.round(item.x / gridSize) * gridSize : item.x;
        const snappedY = showGrid ? Math.round(item.y / gridSize) * gridSize : item.y;
        const maxX = Math.max(5, (containerRef.current?.clientWidth || w) - ITEM_SIZE - 5);
        const maxY = Math.max(5, (containerRef.current?.clientHeight || h) - ITEM_SIZE - 5);
        const finalX = Math.max(5, Math.min(maxX, snappedX));
        const finalY = Math.max(5, Math.min(maxY, snappedY));
        const updated = prev.map(it =>
          it.id === id ? { ...it, x: finalX, y: finalY, origX: finalX, origY: finalY } : it
        );
        if (updateConfigRef.current) {
          updateConfigRef.current({
            customPositions: updated.map(updatedItem => ({ id: updatedItem.id, x: updatedItem.x, y: updatedItem.y })),
            layoutReference: {
              width: containerRef.current?.clientWidth || w,
              height: containerRef.current?.clientHeight || h
            }
          });
        }
        return updated;
      }

      // Play Mode: Bounding Box drop check
      const groupCount = item.id.startsWith("g1-") ? a1 : a2;
      const currentSize = groupCount > 6 ? 34 : groupCount > 4 ? 40 : 44;
      const inBasket = containsItemCenter(getBasketZone(), item.x, item.y, currentSize);

      let nextGroupId: 1 | 2 | "basket" = item.groupId;

      if (inBasket) {
        if (item.groupId !== "basket") {
          sounds.playTick();
        }
        nextGroupId = "basket";
      } else {
        sounds.playSlide();
        nextGroupId = item.id.startsWith("g1-") ? 1 : 2;
      }

      const nextItems = prev.map(it => {
        if (it.id !== id) return it;
        if (nextGroupId === "basket") {
          const existingBasketCount = prev.filter(p => p.groupId === "basket" && p.id !== id).length;
          const snappedPos = getBasketItemPos(existingBasketCount, prev.filter(p => p.groupId === "basket" || p.id === id).length);
          return {
            ...it,
            groupId: nextGroupId,
            x: snappedPos.x,
            y: snappedPos.y
          };
        } else {
          return {
            ...it,
            groupId: nextGroupId,
            x: it.origX,
            y: it.origY
          };
        }
      });

      const basketItems = nextItems.filter(it => it.groupId === "basket");

      if (basketItems.length === targetSum) {
        if (!requireAnswerInput) {
          sounds.playSuccess();
          onSuccessRef.current?.();
        } else {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 350);
        }
      }

      return nextItems;
    });

    setDraggedItemId(null);
    dragStart.current = null;
    latestDragPosition.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
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

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!isPlayMode && basketDrag) {
      setBasketDrag(null);
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }
    if (!draggedItemId) return;
    const start = dragStart.current;
    setItems(prev =>
      prev.map(it =>
        it.id === draggedItemId
          ? { ...it, x: start?.x ?? it.origX, y: start?.y ?? it.origY }
          : it
      )
    );
    setDraggedItemId(null);
    dragStart.current = null;
    latestDragPosition.current = null;
    if (containerRef.current?.hasPointerCapture(e.pointerId)) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  // Theme styles following Move and Count standard
  const groupBoxBg = surfaceClass(isDark);
  const zoneLabelClass = `font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${captionClass(isDark)}`;
  const basketBg = basketCount === targetSum
    ? (isDark ? "bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/20" : "bg-emerald-50/80 border-emerald-400 shadow-md")
    : (isDark ? "bg-slate-900/80 border-violet-500/50 shadow-lg shadow-black/50" : "bg-violet-50/80 border-violet-300/90 shadow-md");

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      accent="violet"
      headerIcon={<PlusCircle size={16} />}
      headerTitle="Addition Tree"
      headerSubtitle={
        isAdditionComplete && requireAnswerInput
          ? "All objects added! Enter the sum answer below."
          : `${a1} + ${a2} = ${basketCount}`
      }
      readAloudText={`Addition. ${a1} plus ${a2} equals ${targetSum}. Drag the objects into the basket!`}
      headerActions={
        <CanvasChip accent="violet" isDark={isDark} aria-label={`Target sum: ${targetSum}`}>
          ∑ Sum {targetSum}
        </CanvasChip>
      }
      designerHint="Resize or reposition the group boxes and basket using drag handles."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full h-full bg-transparent border-0 rounded-3xl p-1 flex flex-col justify-between overflow-hidden touch-none select-none overscroll-none"
      >
        {!isPlayMode && (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center gap-2 z-40">
            <div className="bg-violet-500/10 border border-violet-500/30 text-violet-500 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5">
              <Sparkles size={11} className="text-violet-500" />
              <span>Designer Mode</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleResetLayout}
            >
              <RotateCcw size={10} />
              Reset
            </Button>
          </div>
        )}

        {/* Top Section: Move and Count Group Containers */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between items-center w-full relative z-10 mt-1 px-1">
        {/* Left Addend Container */}
        <div
          ref={group1Ref}
          style={{ width: `${boxWidth}px`, height: `${boxHeight}px` }}
          className={`rounded-[1.8rem] p-3 flex flex-col justify-between transition-colors duration-300 ${groupBoxBg}`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={zoneLabelClass}>Group 1</span>
            <span className={`font-mono text-xs font-black ${captionClass(isDark)}`}>{a1}</span>
          </div>
          <div className="flex-1 flex items-center justify-center relative">
            {representation === "abstract" && (
              <div className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-black font-mono select-none animate-in zoom-in-75 duration-200 ${accentChipClass("violet", isDark)}`}>
                {a1}
              </div>
            )}
            {representation === "concrete" && items.filter(it => it.id.startsWith("g1-") && it.groupId !== "basket").length === 0 && (
              <span className="text-[10px] opacity-50 italic font-bold">Moved!</span>
            )}
          </div>
        </div>

        {/* Plus Symbol */}
        <div className="flex-1 flex flex-col items-center justify-center text-3xl font-black transition-colors z-10">
          <PlusCircle size={26} className={isDark ? "text-violet-400" : "text-violet-500"} />
        </div>

        {/* Right Addend Container */}
        <div
          ref={group2Ref}
          style={{ width: `${boxWidth}px`, height: `${boxHeight}px` }}
          className={`rounded-[1.8rem] p-3 flex flex-col justify-between transition-colors duration-300 ${groupBoxBg}`}
        >
          <div className="flex items-center justify-between w-full">
            <span className={zoneLabelClass}>Group 2</span>
            <span className={`font-mono text-xs font-black ${captionClass(isDark)}`}>{a2}</span>
          </div>
          <div className="flex-1 flex items-center justify-center relative">
            {representation === "abstract" && (
              <div className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-black font-mono select-none animate-in zoom-in-75 duration-200 ${accentChipClass("violet", isDark)}`}>
                {a2}
              </div>
            )}
            {representation === "concrete" && items.filter(it => it.id.startsWith("g2-") && it.groupId !== "basket").length === 0 && (
              <span className="text-[10px] opacity-50 italic font-bold">Moved!</span>
            )}
          </div>
        </div>
      </div>

      {/* Grid Overlay inside Design Mode */}
      {!isPlayMode && showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.15]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="add-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#add-grid)" />
          </svg>
        </div>
      )}

      {/* Ten-Frame Grid Overlays */}
      {representation === "pictorial" && (
        <>
          <TenFrameGrid isDark={isDark} zone={getGroupZone(1)} />
          <TenFrameGrid isDark={isDark} zone={getGroupZone(2)} />
          <TenFrameGrid isDark={isDark} zone={getBasketZone()} />
        </>
      )}

      {/* Floating Draggable Items */}
      {items.map(it => {
        const isDragging = draggedItemId === it.id;
        
        let currentSize = ITEM_SIZE;
        if (representation === "pictorial") {
          const zone = it.groupId === "basket" ? getBasketZone() : getGroupZone(it.groupId);
          currentSize = getTenFrameMetrics(zone).itemSize;
        } else {
          if (it.groupId === "basket") {
            currentSize = basketCount > 8 ? 32 : basketCount > 6 ? 36 : 40;
          } else {
            const groupCount = it.groupId === 1 ? a1 : a2;
            currentSize = groupCount > 6 ? 34 : groupCount > 4 ? 40 : 44;
          }
        }

        const transitionStyle = isDragging
          ? "none"
          : "left 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.15s ease";

        return (
          <div
            key={it.id}
            onPointerDown={e => handlePointerDown(e, it.id)}
            style={{
              position: "absolute",
              left: `${it.x}px`,
              top: `${it.y}px`,
              width: `${currentSize}px`,
              height: `${currentSize}px`,
              zIndex: isDragging ? 50 : 20,
              transition: transitionStyle
            }}
            className={`flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none rounded-xl drop-shadow-sm transition-[filter,box-shadow] duration-150 hover:drop-shadow-md
              ${isDragging ? "drop-shadow-xl z-50 ring-2 ring-indigo-400/40" : ""}
            `}
          >
            {!isPlayMode && isDragging && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[9px] px-1.5 py-0.5 rounded shadow z-50 pointer-events-none whitespace-nowrap">
                X: {it.x}, Y: {it.y}
              </div>
            )}

            {representation === "concrete" ? (
              <CountingAsset type={it.assetType as any} emoji={it.emoji} size={currentSize - 6} />
            ) : representation === "pictorial" ? (
              <div 
                className={`w-full h-full rounded-full border border-white dark:border-slate-800 shadow-sm transition-transform flex items-center justify-center ${
                  it.id.startsWith("g1-") 
                    ? "bg-rose-500 hover:bg-rose-600 ring-1 ring-rose-450/40" 
                    : "bg-amber-400 hover:bg-amber-500 ring-1 ring-amber-300/40"
                }`}
                style={{ width: `${currentSize}px`, height: `${currentSize}px` }}
              >
                <div className={`w-3/5 h-3/5 rounded-full border border-white/20 ${
                  it.id.startsWith("g1-") ? "bg-rose-600/30" : "bg-amber-500/30"
                }`} />
              </div>
            ) : (
              <div 
                className="w-full h-full rounded-full border border-white dark:border-slate-800 bg-indigo-650 text-white font-mono font-black text-[10px] shadow-sm transition-transform flex items-center justify-center hover:bg-indigo-700 ring-1 ring-indigo-400/40 select-none pointer-events-none"
                style={{ width: `${currentSize}px`, height: `${currentSize}px` }}
              >
                1
              </div>
            )}
          </div>
        );
      })}

      {/* Sum Tree / Sum Basket Container */}
      {basketLayout.width > 0 && (
        <div
          ref={basketRef}
          style={{
            position: "absolute",
            left: `${basketLayout.left}px`,
            top: `${basketLayout.top}px`,
            width: `${basketLayout.width}px`,
            height: `${basketLayout.height}px`,
            zIndex: 10
          }}
          className={`rounded-[2rem] p-4 relative flex flex-col justify-between transition-colors duration-300 ${basketBg}`}
        >
          <GhostGuideOverlay show={showGhostGuide && !isSolved} label={"Drag items into the basket!"} isDark={isDark} labelPlacement="top" />
          
          {/* Grab-bar drag handle at top of basket */}
          {!isPlayMode && (
            <div
              onPointerDown={handleBasketMoveDown}
              className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md border cursor-grab active:cursor-grabbing z-20 select-none
                transition-all duration-150
                ${basketDrag === 'move'
                  ? 'bg-indigo-600 border-indigo-600 text-white scale-105 shadow-lg'
                  : isDark
                    ? 'bg-slate-800 border-violet-500/50 text-violet-300 hover:bg-slate-700'
                    : 'bg-white border-violet-300 text-violet-600 hover:bg-violet-50'
                }
              `}
            >
              <Move size={11} />
              <span className="text-[9px] font-bold font-mono uppercase tracking-wider whitespace-nowrap">
                {basketDrag === 'move' ? `X:${basketLayout.left} Y:${basketLayout.top}` : 'Drag to move'}
              </span>
            </div>
          )}

          {/* Resize handle — bottom-right */}
          {!isPlayMode && (
            <div
              onPointerDown={handleBasketResizeDown}
              style={{ touchAction: 'none' }}
              className={`absolute -bottom-2 -right-2 w-8 h-8 cursor-se-resize z-20 flex items-center justify-center rounded-full shadow-md border transition-all duration-150 select-none
                ${basketDrag === 'resize'
                  ? 'bg-violet-600 border-violet-600 text-white scale-110 shadow-lg'
                  : isDark
                    ? 'bg-slate-700 border-slate-500 text-indigo-300 hover:bg-slate-600 hover:border-indigo-400'
                    : 'bg-white border-indigo-300 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-500'
                }
              `}
            >
              <Maximize2 size={11} className="rotate-90" />
            </div>
          )}

          {/* Size tooltip on resize */}
          {!isPlayMode && basketDrag === 'resize' && (
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[9px] px-2 py-0.5 rounded shadow z-50 pointer-events-none whitespace-nowrap">
              W: {basketLayout.width}px · H: {basketLayout.height}px
            </div>
          )}

          <div className="flex items-center justify-between w-full z-10 pointer-events-none">
            <span className={zoneLabelClass}>Basket</span>
            <span className={`font-mono text-xs font-black ${captionClass(isDark)}`}>
              {basketCount} / {targetSum}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center relative my-1 select-none pointer-events-none">
            {representation === "abstract" && (
              <div className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-black font-mono select-none animate-in zoom-in-75 duration-200 ${accentChipClass("violet", isDark)}`}>
                {basketCount}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Answer Input Box Overlay after completing addition ── */}
      <AnimatePresence>
        {isPlayMode && requireAnswerInput && isAdditionComplete && (
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
                What is {a1} + {a2}? Enter the sum of {obj.label}{targetSum === 1 ? "" : "s"}!
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
                  placeholder="Sum..."
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
                    : "bg-violet-600 hover:bg-violet-700 text-white"
                }`}
              >
                {answerStatus === "correct" ? <Check size={18} /> : "Check"}
              </Button>

              <button
                type="button"
                onClick={() => setShowNumberPad(prev => !prev)}
                className={`h-11 w-11 flex items-center justify-center rounded-xl border transition-all ${
                  showNumberPad
                    ? "bg-violet-100 border-violet-400 text-violet-700 dark:bg-violet-950 dark:border-violet-600 dark:text-violet-300"
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
