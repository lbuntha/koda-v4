import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Package, Check, Calculator, AlertCircle, Delete, PartyPopper } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, accentChipClass } from "./canvasTheme";
import { CanvasBin } from "./CanvasBin";
import { useCanvasAudience } from "./presentation";
import { Button } from "../ui";

import {
  Rect,
  binSizeForStage,
  contentZone,
  countingObjectSize,
  fitObjectSize,
  pilePosition,
  slotPosition
} from "./objectLayout";
import { OBJECT_SETTLE, objectStyle } from "./objectMotion";

interface MagnetItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  inside: boolean;
  /** Order it went in, so it keeps its place in the container. */
  insideOrder: number | null;
}

type ContainerShape = "jar" | "basket" | "box";

/**
 * The part of each illustration an object may actually sit in, as a fraction of
 * the drawing's box.
 *
 * Taken from the SVG paths below: the jar's glass runs x 22–78 of 100 and y 30–104
 * of 120, and so on. Objects used to be clamped by four hand-tuned pixel insets
 * that only matched the jar at exactly 130 × 160, so a basket held its apples
 * half way up its handle.
 */
const CONTAINER_INTERIOR: Record<ContainerShape, Rect> = {
  jar: { left: 0.24, top: 0.28, width: 0.52, height: 0.55 },
  basket: { left: 0.20, top: 0.36, width: 0.60, height: 0.48 },
  box: { left: 0.18, top: 0.30, width: 0.64, height: 0.55 }
};

const CONTAINER_NAMES: Record<ContainerShape, { bin: string; inside: string }> = {
  jar: { bin: "Collecting Jar", inside: "Inside Jar" },
  basket: { bin: "Basket", inside: "Inside Basket" },
  box: { bin: "Box", inside: "Inside Box" }
};

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
 * The panel's own colour names.
 *
 * `jarColorAccent` was offered to teachers and then never read by anything, so
 * picking a theme did nothing at all. `amber` is honoured as violet: warm yellow
 * on a canvas is the one thing the palette rules out.
 */
const JAR_ACCENTS: Record<string, CanvasAccent> = {
  blue: "indigo",
  indigo: "indigo",
  violet: "violet",
  amber: "violet",
  rose: "rose",
  emerald: "emerald"
};

const GRID_STEP = 20;

export const MagnetsCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onUpdateQuestionConfig, onSuccess }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;
  const requireAnswerInput = question.config.requireAnswerInput ?? true;
  const shape: ContainerShape = (["jar", "basket", "box"] as const).includes(question.config.containerShape as ContainerShape)
    ? (question.config.containerShape as ContainerShape)
    : "jar";

  const [magnets, setMagnets] = useState<MagnetItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<"shelf" | "container" | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  /** The stage box, taken once per drag: measuring it every move forces a reflow. */
  const stageBox = useRef<DOMRect | null>(null);
  /** Where the pointer went down, and whether it has travelled far enough to be a drag. */
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldAnimateJar, setShouldAnimateJar] = useState(false);
  const lastInsideRef = useRef(0);

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

  const insideCount = magnets.filter(m => m.inside).length;
  const isMagnetsComplete = count > 0 && insideCount === count;
  const solvedForGuide = count > 0 && isMagnetsComplete && (requireAnswerInput ? answerStatus === "correct" : true);

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
   * The object has two masters: the shelf it waits on and the container it has
   * to fit inside, so it takes whichever allows less. The container itself is
   * sized to the bin that holds it — it used to be a fixed 130 × 160 box parked
   * at 58% of the stage, with its label panel drawn somewhere else entirely.
   */
  const geometry = useMemo(() => {
    const gap = isCompact ? 10 : 16;
    const captionH = isCompact ? 26 : 32;
    const pad = isCompact ? 12 : 18;

    const bin = binSizeForStage(stageWidth, stageHeight, { stacked: isCompact, gap });
    /*
      Both bins are flex halves of the stage, so their boxes are arithmetic
      rather than measured — no reading layout during render, and the drawing,
      the objects inside it and the drop test all sit in one coordinate space.
    */
    const shelfBin: Rect = { left: 0, top: 0, width: bin.width, height: bin.height };
    const vesselBin: Rect = isCompact
      ? { left: 0, top: bin.height + gap, width: bin.width, height: bin.height }
      : { left: bin.width + gap, top: 0, width: bin.width, height: bin.height };
    // The drawings are all 100 × 120, so the vessel keeps that aspect.
    const vesselHeight = Math.max(
      96,
      Math.min(bin.height - captionH - pad * 2, (bin.width - pad * 2) * 1.2)
    );
    const vesselWidth = vesselHeight / 1.2;

    const interior = CONTAINER_INTERIOR[shape];
    /*
      An object waiting on the shelf is the shared size — the same apple a child
      just saw in Move & Count — and it settles smaller as it goes in. Letting the
      container set the size everywhere made the loose apples half the size they
      should be; keeping it everywhere made five of them taller than the basket.
      A jar that size genuinely cannot hold them at full size, so the shrink
      happens exactly where a child reads it as "it went in".
    */
    const magnetSize = countingObjectSize({ stageWidth, stageHeight, count, stacked: isCompact });

    const insideSize = Math.min(
      magnetSize,
      fitObjectSize({
        width: interior.width * vesselWidth,
        height: interior.height * vesselHeight,
        count,
        padding: 4,
        captionInset: 0
      })
    );

    const vesselZone = contentZone(vesselBin, vesselHeight, captionH);
    const vessel: Rect = {
      left: Math.round(vesselZone.left + (vesselZone.width - vesselWidth) / 2),
      top: Math.round(vesselZone.top + (vesselZone.height - vesselHeight) / 2),
      width: vesselWidth,
      height: vesselHeight
    };

    return {
      gap,
      captionH,
      magnetSize,
      insideSize,
      shelfBin,
      vesselBin,
      vessel,
      interior: {
        left: vessel.left + interior.left * vessel.width,
        top: vessel.top + interior.top * vessel.height,
        width: interior.width * vessel.width,
        height: interior.height * vessel.height
      } as Rect
    };
  }, [stageWidth, stageHeight, isCompact, count, shape]);

  const { magnetSize, insideSize, captionH } = geometry;
  const hasFrame = question.config.showItemFrame ?? true;
  /** An object's edge length depends on which bin it is in. */
  const sizeOf = (inside: boolean) => (inside ? insideSize : magnetSize);
  const assetFor = (size: number) => Math.round(size * (hasFrame ? 0.7 : 0.92));
  const customPositionKey = JSON.stringify(question.config.customPositions || []);

  /** Where the `order`-th collected object sits in the pile inside the container. */
  const insideSlot = useCallback(
    (order: number) => pilePosition(order, count, geometry.interior, insideSize),
    [count, geometry.interior, insideSize]
  );

  /** Where the `order`-th waiting object sits on the shelf. */
  const shelfSlot = useCallback(
    (order: number) => slotPosition(order, count, contentZone(geometry.shelfBin, magnetSize, captionH), magnetSize),
    [count, geometry.shelfBin, magnetSize, captionH]
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
  }, [question.id, count]);

  const prevQuestionId = useRef(question.id);
  const prevObjectId = useRef(question.objectId);
  const prevCount = useRef(count);

  /** Stage the current coordinates were laid out against. */
  const laidOutAt = useRef<{ width: number; height: number; stacked: boolean } | null>(null);

  // Responsive placement & rescaling on resize / orientation change
  useEffect(() => {
    if (!dimensions) return;

    const previous = laidOutAt.current;
    laidOutAt.current = { width: stageWidth, height: stageHeight, stacked: isCompact };

    const flipped = previous ? previous.stacked !== isCompact : false;
    const resizeX = previous?.width ? stageWidth / previous.width : 1;
    const resizeY = previous?.height ? stageHeight / previous.height : 1;
    const resized = !flipped && (resizeX !== 1 || resizeY !== 1);

    setMagnets(prev => {
      const customPositions = (isCompact && isPlayMode) ? [] : (question.config.customPositions || []);
      const layoutReference = question.config.layoutReference;
      const scaleX = layoutReference?.width ? stageWidth / layoutReference.width : 1;
      const scaleY = layoutReference?.height ? stageHeight / layoutReference.height : 1;

      const questionChanged = prevQuestionId.current !== question.id
        || prevObjectId.current !== question.objectId
        || prevCount.current !== count;

      // Re-slotting reads the child's progress, not the item index: what is in
      // the container goes back to its own place in the container.
      let waitingSeen = 0;

      const next: MagnetItem[] = Array.from({ length: count }).map((_, idx) => {
        const itemId = `mag-item-${idx}`;
        const existing = prev.find(m => m.id === itemId);

        if (existing && !questionChanged) {
          if (existing.inside) return { ...existing, ...insideSlot(existing.insideOrder ?? 1) };

          waitingSeen += 1;
          if (flipped) return { ...existing, ...shelfSlot(waitingSeen) };
          if (!resized) return existing;
          return {
            ...existing,
            x: Math.round(Math.max(0, Math.min(stageWidth - magnetSize, existing.x * resizeX))),
            y: Math.round(Math.max(0, Math.min(stageHeight - magnetSize, existing.y * resizeY)))
          };
        }

        const saved = customPositions.find(p => p.id === itemId);
        waitingSeen += 1;
        const defaultPos = shelfSlot(waitingSeen);

        return {
          id: itemId,
          emoji: obj.emoji,
          x: saved ? Math.round(saved.x * scaleX) : defaultPos.x,
          y: saved ? Math.round(saved.y * scaleY) : defaultPos.y,
          inside: false,
          insideOrder: null
        };
      });

      if (questionChanged) {
        prevQuestionId.current = question.id;
        prevObjectId.current = question.objectId;
        prevCount.current = count;
      }

      return next;
    });
  }, [question.id, question.objectId, count, customPositionKey, question.config.layoutReference?.width, question.config.layoutReference?.height, dimensions, isPlayMode, isCompact, magnetSize, shelfSlot, insideSlot, obj.emoji, stageWidth, stageHeight]);

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

    const updated = magnets.map((magnet, idx) => ({
      ...magnet,
      ...shelfSlot(idx + 1),
      inside: false,
      insideOrder: null
    }));
    setMagnets(updated);

    if (!isPlayMode && onUpdateQuestionConfig) {
      onUpdateQuestionConfig({
        customPositions: updated.map(m => ({ id: m.id, x: m.x, y: m.y })),
        layoutReference: {
          width: containerRef.current?.clientWidth || stageWidth,
          height: containerRef.current?.clientHeight || stageHeight
        }
      });
    }
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
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

  /** Which bin a point sits in — the whole bin, not a magic radius round the drawing. */
  const zoneAt = useCallback((centerX: number, centerY: number): "shelf" | "container" | null => {
    const within = (zone: Rect) =>
      centerX >= zone.left && centerX <= zone.left + zone.width
      && centerY >= zone.top && centerY <= zone.top + zone.height;
    if (within(geometry.vesselBin)) return "container";
    if (within(geometry.shelfBin)) return "shelf";
    return null;
  }, [geometry.vesselBin, geometry.shelfBin]);

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

    x = Math.max(0, Math.min(stageRect.width - magnetSize, x));
    y = Math.max(0, Math.min(stageRect.height - magnetSize, y));

    if (!isPlayMode && showGrid) {
      x = Math.round(x / GRID_STEP) * GRID_STEP;
      y = Math.round(y / GRID_STEP) * GRID_STEP;
    }

    x = Math.round(x);
    y = Math.round(y);
    setDragPos({ x, y });

    if (isPlayMode) {
      setActiveDropZone(zoneAt(x + magnetSize / 2, y + magnetSize / 2));
    }

    setMagnets(prev => prev.map(m => m.id === draggedItemId ? { ...m, x, y } : m));
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const id = draggedItemId;

    if (isPlayMode) {
      setMagnets(prev => {
        const item = prev.find(m => m.id === id);
        if (!item) return prev;

        const zone = zoneAt(item.x + magnetSize / 2, item.y + magnetSize / 2);
        const goesIn = zone === "container";

        if (goesIn && !item.inside) {
          sounds.playTick(prev.filter(m => m.inside).length + 1);
        } else if (!goesIn && item.inside && dragMoved.current) {
          sounds.playSlide();
        }

        const settled = prev.map(m => {
          if (m.id !== id) return m;
          if (!goesIn) return { ...m, inside: false, insideOrder: null };
          const order = m.inside
            ? (m.insideOrder ?? 1)
            : prev.filter(other => other.inside && other.id !== id).length + 1;
          return { ...m, inside: true, insideOrder: order };
        });

        // Both bins re-flow, so nothing can land on top of a sibling and the
        // objects still to collect stay a tidy group a child can count.
        let waiting = 0;
        let inside = 0;
        return settled.map(m => {
          if (m.inside) {
            inside += 1;
            return { ...m, insideOrder: inside, ...insideSlot(inside) };
          }
          waiting += 1;
          return { ...m, ...shelfSlot(waiting) };
        });
      });
    } else {
      setMagnets(prev => {
        if (onUpdateQuestionConfig) {
          onUpdateQuestionConfig({
            customPositions: prev.map(m => ({ id: m.id, x: m.x, y: m.y })),
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
  };

  /** One happy bounce per object that goes in. */
  useEffect(() => {
    if (!isPlayMode) return;
    if (insideCount > lastInsideRef.current) {
      setShouldAnimateJar(true);
      const timer = setTimeout(() => setShouldAnimateJar(false), 320);
      lastInsideRef.current = insideCount;
      return () => clearTimeout(timer);
    }
    lastInsideRef.current = insideCount;
  }, [insideCount, isPlayMode]);

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
      setErrorMessage(`Not quite! You collected ${count} ${obj.label}${count === 1 ? "" : "s"}. Enter ${count}!`);
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

  useEffect(() => {
    hasTriggeredSuccess.current = false;
  }, [question.id]);

  useEffect(() => {
    if (isPlayMode && count > 0 && isMagnetsComplete) {
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
  }, [insideCount, count, isPlayMode, onSuccess, requireAnswerInput, isMagnetsComplete]);

  const accent: CanvasAccent =
    FRAME_ACCENTS[question.config.frameColor || ""]
    || JAR_ACCENTS[(question.config as any).jarColorAccent || ""]
    || "indigo";
  const isSolved = solvedForGuide;
  const remaining = count - insideCount;
  const answerPanelOpen = isPlayMode && requireAnswerInput && isMagnetsComplete;

  const draggedItem = draggedItemId ? magnets.find(m => m.id === draggedItemId) : null;
  const names = CONTAINER_NAMES[shape];

  const shelfLabel = question.config.sourceBinLabel || (learnerMode ? "Collect these" : "Magnets");
  const containerLabel = question.config.jarLabel || question.config.destinationBinLabel
    || (learnerMode ? "Drop them in here" : names.bin);

  const renderKawaiiFace = (type: ContainerShape) => {
    const isHappy = shouldAnimateJar;
    const blushColor = type === "basket" ? "url(#basketBlush)" : type === "box" ? "url(#boxBlush)" : "url(#jarBlush)";
    const inkColor = type === "basket" ? "#3e2723" : type === "box" ? "#5d4037" : "#37474f";
    const tongueColor = "#ff769b";

    const cX1 = type === "jar" ? 41 : 39;
    const cX2 = type === "jar" ? 59 : 61;
    const cY = type === "jar" ? 58 : 56;

    const blushX1 = type === "jar" ? 35 : 33;
    const blushX2 = type === "jar" ? 65 : 67;
    const cheekY = type === "jar" ? 65 : 62;

    const smileY = type === "jar" ? 63 : 60;

    return (
      <g>
        <circle cx={blushX1} cy={cheekY} r={5} fill={blushColor} />
        <circle cx={blushX2} cy={cheekY} r={5} fill={blushColor} />

        {isHappy ? (
          <>
            <path d={`M ${cX1 - 4} ${cY + 1} Q ${cX1} ${cY - 3} ${cX1 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M ${cX2 - 4} ${cY + 1} Q ${cX2} ${cY - 3} ${cX2 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M 46,${smileY} C 46,${smileY + 7} 54,${smileY + 7} 54,${smileY} Z`} fill={tongueColor} stroke={inkColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <g>
              <circle cx={cX1} cy={cY} r="4" fill={inkColor} />
              <circle cx={cX1 - 1.5} cy={cY - 2} r="1.5" fill="#ffffff" />
              <circle cx={cX1 + 1.5} cy={cY + 2} r="0.6" fill="#ffffff" />
            </g>
            <g>
              <circle cx={cX2} cy={cY} r="4" fill={inkColor} />
              <circle cx={cX2 - 1.5} cy={cY - 2} r="1.5" fill="#ffffff" />
              <circle cx={cX2 + 1.5} cy={cY + 2} r="0.6" fill="#ffffff" />
            </g>
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY} Z`} fill={tongueColor} />
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY}`} fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </g>
    );
  };

  const vessel = geometry.vessel;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      gridSize={GRID_STEP}
      showRulers={question.config.showLayoutRulers ?? true}
      accent={accent}
      headerIcon={<Package size={16} />}
      headerTitle="Magnets"
      headerSubtitle={
        isMagnetsComplete && requireAnswerInput
          ? "Collecting complete! Enter the total answer below."
          : `${insideCount} of ${count} inside`
      }
      readAloudText={question.instruction || `Drag all ${count} ${obj.label} into the ${names.bin.toLowerCase()}.`}
      designerHint="Drag objects freely. Grid snapping is applied when you release."
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? "All inside" : `${remaining} left`}
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
          ? `All ${count} tucked inside!`
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
        className="relative flex-1 w-full flex flex-col sm:flex-row items-stretch min-h-[280px] sm:min-h-[320px] md:min-h-[360px] touch-none select-none overscroll-none"
        style={{ gap: `${geometry.gap}px` }}
      >
        {/* Crosshair alignment guides in design mode */}
        {!isPlayMode && draggedItem && dragPos && (
          <>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ top: `${draggedItem.y + magnetSize / 2}px` }}
            />
            <div
              className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/50 pointer-events-none z-40"
              style={{ left: `${draggedItem.x + magnetSize / 2}px` }}
            />
          </>
        )}

        {/* The shelf — objects still to collect */}
        <CanvasBin
          label={shelfLabel}
          tally={isPlayMode ? remaining : undefined}
          accent={accent}
          isDark={isDark}
          active={activeDropZone === "shelf"}
          complete={isPlayMode && remaining === 0}
          isEmpty={isPlayMode && remaining === 0}
          emptyIcon={<PartyPopper size={22} />}
          // Suppressed once the answer panel docks here, or the two would stack up.
          emptyHint={isPlayMode && !answerPanelOpen ? "All collected!" : undefined}
        />

        {/* The container — the drop target, and the drawing that names it */}
        <CanvasBin
          label={containerLabel}
          tally={isPlayMode ? `${insideCount} / ${count}` : undefined}
          accent={accent}
          isDark={isDark}
          active={activeDropZone === "container"}
          complete={isMagnetsComplete}
          /* No empty hint: the drawing in the middle of this bin is already the
             clearest "put them in here" a child could be given. */
        >
          <GhostGuideOverlay
            show={showGhostGuide && !isSolved}
            label={
              isMagnetsComplete && requireAnswerInput
                ? `Enter how many items you collected (${count}) in the box!`
                : `Drag all ${count} ${obj.label} into the ${names.bin.toLowerCase()}!`
            }
            isDark={isDark}
            labelPlacement="top"
          />
        </CanvasBin>

        {/*
          The drawing sits in the stage rather than inside the bin's DOM, at the
          box the bin was measured as: the collected objects are stage-positioned
          too, so both have to be in the same coordinate space to line up.
        */}
        <div
          style={{
            position: "absolute",
            left: `${vessel.left}px`,
            top: `${vessel.top}px`,
            width: `${vessel.width}px`,
            height: `${vessel.height}px`,
            zIndex: 5
          }}
          className={`pointer-events-none select-none transition-transform duration-200 ${
            shouldAnimateJar ? "scale-105" : "scale-100"
          }`}
        >
          {shape === "basket" ? (
            <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
              <defs>
                <linearGradient id="basketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#d7ccc8" />
                  <stop offset="100%" stopColor="#a1887f" />
                </linearGradient>
                <radialGradient id="basketBlush" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffab91" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ffab91" stopOpacity="0" />
                </radialGradient>
                <pattern id="weave" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="#8d6e63" strokeWidth="1" opacity="0.4" />
                </pattern>
              </defs>
              <path d="M 25 35 C 25 15, 75 15, 75 35" fill="none" stroke="#8d6e63" strokeWidth="5" strokeLinecap="round" />
              <path d="M 15 38 L 22 105 C 23 112, 77 112, 78 105 L 85 38 Z" fill="url(#basketGrad)" stroke="#5d4037" strokeWidth="3" />
              <path d="M 15 38 L 22 105 C 23 112, 77 112, 78 105 L 85 38 Z" fill="url(#weave)" />
              <ellipse cx="50" cy="38" rx="35" ry="8" fill="#a1887f" stroke="#5d4037" strokeWidth="3" />
              <ellipse cx="50" cy="38" rx="31" ry="5" fill="#6d4c41" opacity="0.6" />
              {renderKawaiiFace("basket")}
            </svg>
          ) : shape === "box" ? (
            <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
              <defs>
                <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffe0b2" />
                  <stop offset="100%" stopColor="#ffcc80" />
                </linearGradient>
                <radialGradient id="boxBlush" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffab91" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ffab91" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path d="M 10 30 L 90 30 L 85 105 Q 85 112 78 112 L 22 112 Q 15 112 15 105 Z" fill="url(#boxGrad)" stroke="#8d6e63" strokeWidth="3" />
              <path d="M 10 30 L 30 15 L 50 30 Z" fill="#ffb74d" stroke="#8d6e63" strokeWidth="2" />
              <path d="M 90 30 L 70 15 L 50 30 Z" fill="#ffa726" stroke="#8d6e63" strokeWidth="2" />
              <line x1="50" y1="30" x2="50" y2="112" stroke="#bcaaa4" strokeWidth="2" strokeDasharray="4 3" />
              {renderKawaiiFace("box")}
            </svg>
          ) : (
            <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-xl overflow-visible">
              <defs>
                <linearGradient id="jarBody" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#e0f7fa" stopOpacity="0.7" />
                  <stop offset="30%" stopColor="#b2ebf2" stopOpacity="0.4" />
                  <stop offset="70%" stopColor="#80deea" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#4dd0e1" stopOpacity="0.75" />
                </linearGradient>
                <radialGradient id="jarBlush" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ff80ab" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ff80ab" stopOpacity="0" />
                </radialGradient>
              </defs>

              <path d="M 22 28 C 12 36, 12 96, 22 106 C 28 112, 72 112, 78 106 C 88 96, 88 36, 78 28 Z" fill="url(#jarBody)" stroke="#00838f" strokeWidth="3" />
              <rect x="26" y="16" width="48" height="12" rx="4" fill="#e0f7fa" stroke="#00838f" strokeWidth="2.5" />
              <ellipse cx="50" cy="16" rx="22" ry="5" fill="#b2ebf2" stroke="#00838f" strokeWidth="2" />
              <path d="M 28 20 C 35 23, 65 23, 72 20" fill="none" stroke="#00838f" strokeWidth="1.5" opacity="0.6" />
              <path d="M 24 35 Q 20 65 25 100" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
              <circle cx="28" cy="101" r="2" fill="#ffffff" opacity="0.6" />
              {renderKawaiiFace("jar")}
            </svg>
          )}
        </div>

        {/* How many are in there — on the container, where a child is looking */}
        <div
          style={{
            position: "absolute",
            left: `${vessel.left + vessel.width / 2}px`,
            top: `${vessel.top + vessel.height * 0.86}px`,
            zIndex: 35
          }}
          className={`-translate-x-1/2 -translate-y-1/2 pointer-events-none select-none text-center px-3 py-1 rounded-xl shadow-sm
            transition-all duration-300 ${isMagnetsComplete ? accentChipClass("emerald", isDark) : accentChipClass(accent, isDark)}`}
        >
          <span className="font-mono text-[7px] font-black uppercase tracking-wider block leading-none opacity-80">
            {names.inside}
          </span>
          <span
            className="font-black font-mono leading-none"
            style={{ fontSize: `${Math.round(Math.max(16, Math.min(30, vessel.height * 0.13)))}px` }}
          >
            {insideCount}
          </span>
        </div>

        {/* The objects themselves */}
        {magnets.map((item, idx) => {
          const assetType = question.config?.assetType || "emoji";
          const isDragging = draggedItemId === item.id;

          let itemClassName = "flex items-center justify-center select-none touch-none rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40";
          itemClassName += " cursor-grab active:cursor-grabbing transition-[box-shadow,transform]";

          if (hasFrame) {
            itemClassName += item.inside
              ? ` ${accentChipClass(accent, isDark)} border-2`
              : ` ${surfaceClass(isDark, "raised")} border-0`;
            if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
          } else {
            itemClassName += item.inside
              ? " drop-shadow-md"
              : " drop-shadow hover:drop-shadow-md hover:scale-105";
            if (isDragging) itemClassName += " scale-125 drop-shadow-2xl z-50";
          }

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`${item.inside ? "Collected" : "Not collected"} ${obj.label} ${idx + 1}. Drag into the ${names.bin.toLowerCase()}.`}
              onPointerDown={(e) => handlePointerDown(e, item.id)}
              style={{
                ...objectStyle({
                  x: item.x,
                  y: item.y,
                  size: sizeOf(item.inside),
                  dragging: isDragging,
                  z: item.inside ? 20 : 30
                }),
                // Shrinking as it lands in the container is part of the motion.
                transition: isDragging ? "none" : `${OBJECT_SETTLE}, width 0.2s ease, height 0.2s ease`
              }}
              className={itemClassName}
            >
              {!isPlayMode && isDragging && dragPos && (
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                  {item.x}, {item.y}
                </div>
              )}
              <CountingAsset type={assetType as any} emoji={item.emoji} size={assetFor(sizeOf(item.inside))} />
            </div>
          );
        })}

        {/* ── Answer Input Box Overlay after collecting all items ── */}
        <AnimatePresence>
          {answerPanelOpen && (
            /*
              Docked over the shelf the objects just left, never over the
              container: the question is "how many did you collect", so what is
              in the container has to stay in view while the child answers.
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
                    How many {obj.label}{count === 1 ? "" : "s"} did you collect in total?
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
