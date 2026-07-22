import React, { useState, useEffect, useRef, useCallback } from "react";
import { COUNT_OBJECTS } from "../../types";
import { CountingAsset } from "../Assets";
import { sounds } from "../../sound";
import { RotateCcw, Package } from "lucide-react";
import { CanvasProps } from "./types";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { GhostGuideOverlay, useGhostGuide } from "../../pedagogy";
import { CanvasChip, CanvasAccent, surfaceClass, captionClass, accentChipClass } from "./canvasTheme";
import { Button } from "../ui";

/** Teacher-facing frameColor values map onto the shared accent palette. */
const FRAME_ACCENTS: Record<string, CanvasAccent> = {
  indigo: "indigo",
  emerald: "emerald",
  purple: "purple",
  pink: "rose",
  rose: "rose"
};

interface MagnetItem {
  id: string;
  emoji: string;
  x: number;
  y: number;
  inside: boolean;
}

const JAR_WIDTH = 210;
const JAR_HEIGHT = 250;
const GRID_STEP = 20;

export const MagnetsCanvas: React.FC<CanvasProps> = ({ question, isPlayMode, showGrid, isDark = false, onUpdateQuestionConfig, onSuccess }) => {
  const obj = COUNT_OBJECTS.find(o => o.id === question.objectId) || COUNT_OBJECTS[0];
  const count = question.targetCount;

  const [magnets, setMagnets] = useState<MagnetItem[]>([]);
  const [jarPosition, setJarPosition] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [dimensions, setDimensions] = useState({ width: 600, height: 340 });
  const [shouldAnimateJar, setShouldAnimateJar] = useState(false);
  const lastCountsRef = useRef<string>("");
  const initializedRef = useRef<{ questionId: string; count: number; objectId: string } | null>(null);

  const isMobile = dimensions.width < 640;
  const magnetSize = isMobile ? 46 : 56;

  // Resolve responsive Jar coordinates
  const currentJarPosition = {
    x: isMobile ? Math.round((dimensions.width - JAR_WIDTH) / 2) : jarPosition.x,
    y: isMobile ? 12 : jarPosition.y
  };

  // Measure container dimensions responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: Math.round(entry.contentRect.width),
            height: Math.round(entry.contentRect.height)
          });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Helper: check if coordinates intersect the jar's inner boundary
  const checkInsideJar = useCallback((mX: number, mY: number, jarPos: { x: number; y: number }): boolean => {
    const jarCenterX = jarPos.x + JAR_WIDTH / 2;
    const jarCenterY = jarPos.y + JAR_HEIGHT / 2 + 15;

    const magnetCenterX = mX + magnetSize / 2;
    const magnetCenterY = mY + magnetSize / 2;

    const dx = magnetCenterX - jarCenterX;
    const dy = magnetCenterY - jarCenterY;
    
    // Ellipse boundary limits (inset to keep magnets inside the glass wall and below lid)
    const radiusX = JAR_WIDTH / 2 - 14;
    const radiusY = JAR_HEIGHT / 2 - 24;

    return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1.0;
  }, [magnetSize]);

  // Helper: clamp coordinates safely within the jar glass walls
  const clampInsideJar = useCallback((mX: number, mY: number, jarPos: { x: number; y: number }) => {
    const minX = jarPos.x + 22;
    const maxX = jarPos.x + JAR_WIDTH - 22 - magnetSize;
    const minY = jarPos.y + 52; // below lid
    const maxY = jarPos.y + JAR_HEIGHT - 24 - magnetSize; // above base rim

    return {
      x: Math.round(Math.max(minX, Math.min(maxX, mX))),
      y: Math.round(Math.max(minY, Math.min(maxY, mY))),
      inside: true
    };
  }, [magnetSize]);

  // Dynamic, perfectly centered grid coordinate generator for items inside the Magnet Dock box
  const getDockPos = useCallback((idx: number, total: number, w: number, h: number) => {
    const isMob = w < 640;
    const dW = isMob ? Math.min(320, w - 32) : Math.min(260, Math.max(220, Math.round(w * 0.32)));
    const dH = isMob ? 95 : Math.min(280, Math.max(230, h - 48));
    const dX = isMob ? Math.round((w - dW) / 2) : Math.max(240, w - dW - 24);
    const dY = isMob ? h - dH - 12 : 24;

    if (isMob) {
      // Horizontal row inside the mobile dock
      const cols = total;
      const usableW = dW - 24;
      const stepX = Math.min(50, usableW / cols);
      const gridTotalW = (cols - 1) * stepX + magnetSize * 0.7;
      const startX = dX + (dW - gridTotalW) / 2;
      const startY = dY + 32;
      return {
        x: Math.round(startX + idx * stepX),
        y: Math.round(startY)
      };
    } else {
      // 2 columns grid on desktop
      const cols = total <= 4 ? 2 : Math.ceil(Math.sqrt(total));
      const rows = Math.ceil(total / cols);
      const usableW = dW - 36;
      const usableH = dH - 68;
      const stepX = Math.min(68, usableW / cols);
      const stepY = Math.min(68, usableH / rows);
      const gridTotalW = (cols - 1) * stepX + magnetSize;
      const gridTotalH = (rows - 1) * stepY + magnetSize;
      const startX = dX + (dW - gridTotalW) / 2;
      const startY = dY + 44 + (dH - 44 - gridTotalH) / 2;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return {
        x: Math.round(startX + col * stepX),
        y: Math.round(startY + row * stepY)
      };
    }
  }, [magnetSize]);

  // Initialize layout positions when question or targetCount changes
  useEffect(() => {
    const isNew = !initializedRef.current ||
      initializedRef.current.questionId !== question.id ||
      initializedRef.current.count !== count ||
      initializedRef.current.objectId !== question.objectId;

    if (!isNew) return;

    const customPositions = question.config.customPositions || [];
    const savedJar = customPositions.find(p => p.id === "target-jar");
    const initialJarPos = savedJar ? { x: savedJar.x, y: savedJar.y } : { x: 24, y: 24 };
    setJarPosition(initialJarPos);

    const resolvedJar = {
      x: isMobile ? Math.round((dimensions.width - JAR_WIDTH) / 2) : initialJarPos.x,
      y: isMobile ? 12 : initialJarPos.y
    };

    setMagnets(Array.from({ length: count }).map((_, idx) => {
      const savedPos = customPositions.find(p => p.id === `magnet-item-${idx}`);
      const defaultDockPos = getDockPos(idx, count, dimensions.width, dimensions.height);

      const isInsideJar = savedPos ? checkInsideJar(savedPos.x, savedPos.y, resolvedJar) : false;

      if (isInsideJar && savedPos) {
        return {
          id: `magnet-item-${idx}`,
          emoji: obj.emoji,
          ...clampInsideJar(savedPos.x, savedPos.y, resolvedJar)
        };
      }

      return {
        id: `magnet-item-${idx}`,
        emoji: obj.emoji,
        x: defaultDockPos.x,
        y: defaultDockPos.y,
        inside: false
      };
    }));

    if (dimensions.width > 0) {
      initializedRef.current = { questionId: question.id, count, objectId: question.objectId };
    }
  }, [question, count, dimensions.width, dimensions.height, getDockPos, checkInsideJar, clampInsideJar, obj.emoji, isMobile]);

  // Responsive re-alignment: whenever container resizes or changes width, unplaced items instantly align into the Magnet Dock
  useEffect(() => {
    if (dimensions.width <= 0) return;
    setMagnets(prev => prev.map((m, idx) => {
      if (m.id === draggedItemId) return m;
      if (!m.inside) {
        const dockPos = getDockPos(idx, count, dimensions.width, dimensions.height);
        return { ...m, x: dockPos.x, y: dockPos.y };
      } else {
        return { ...m, ...clampInsideJar(m.x, m.y, currentJarPosition) };
      }
    }));
  }, [dimensions.width, dimensions.height, count, getDockPos, clampInsideJar, draggedItemId]);

  const reset = () => {
    const defaultJar = { x: 24, y: 24 };
    setJarPosition(defaultJar);
    setMagnets(Array.from({ length: count }).map((_, idx) => {
      const defaultDockPos = getDockPos(idx, count, dimensions.width, dimensions.height);
      return {
        id: `magnet-item-${idx}`,
        emoji: obj.emoji,
        x: defaultDockPos.x,
        y: defaultDockPos.y,
        inside: false
      };
    }));
  };

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    reportActivity();
    sounds.playPop();
    setDraggedItemId(id);
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const parentRect = containerRef.current?.getBoundingClientRect();
    if (!parentRect) return;
    let x = e.clientX - parentRect.left - dragOffset.current.x;
    let y = e.clientY - parentRect.top - dragOffset.current.y;
    
    if (draggedItemId === "jar") {
      if (isPlayMode) return;
      x = Math.max(0, Math.min(parentRect.width - JAR_WIDTH, x));
      y = Math.max(0, Math.min(parentRect.height - JAR_HEIGHT, y));
      if (showGrid && !isPlayMode) {
        x = Math.round(x / GRID_STEP) * GRID_STEP;
        y = Math.round(y / GRID_STEP) * GRID_STEP;
      }
      setDragPos({ x: Math.round(x), y: Math.round(y) });
      setJarPosition({ x: Math.round(x), y: Math.round(y) });
      setMagnets(prev => prev.map(m => m.inside ? { ...m, ...clampInsideJar(m.x, m.y, { x, y }) } : m));
    } else {
      setDragPos({ x: Math.round(x), y: Math.round(y) });
      setMagnets(prev => prev.map(m => m.id === draggedItemId ? { ...m, x: Math.round(x), y: Math.round(y) } : m));
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    const id = draggedItemId;
    setMagnets(prev => {
      let finalMagnets = prev;
      if (id !== "jar") {
        finalMagnets = prev.map((m, idx) => {
          if (m.id !== id) return m;
          const isOverJar = checkInsideJar(m.x, m.y, currentJarPosition) ||
                            Math.hypot((m.x + magnetSize / 2) - (currentJarPosition.x + JAR_WIDTH / 2), (m.y + magnetSize / 2) - (currentJarPosition.y + JAR_HEIGHT / 2 + 15)) < 110;

          if (isOverJar) {
            return { ...m, ...clampInsideJar(m.x, m.y, currentJarPosition) };
          } else {
            const dockPos = getDockPos(idx, count, dimensions.width, dimensions.height);
            return { ...m, x: dockPos.x, y: dockPos.y, inside: false };
          }
        });
      }
      if (!isPlayMode && onUpdateQuestionConfig) {
        onUpdateQuestionConfig({
          customPositions: [
            { id: "target-jar", x: jarPosition.x, y: jarPosition.y },
            ...finalMagnets.map(item => ({ id: item.id, x: item.x, y: item.y }))
          ]
        });
      }
      return finalMagnets;
    });
    setDraggedItemId(null);
    setDragPos(null);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleContainerPointerCancel = (e: React.PointerEvent) => {
    if (!draggedItemId) return;
    containerRef.current?.releasePointerCapture(e.pointerId);
    setDraggedItemId(null);
    setDragPos(null);
  };

  const insideCount = magnets.filter(m => m.inside).length;

  useEffect(() => {
    const key = magnets.map(m => m.id + ":" + m.inside).join("|");
    if (key !== lastCountsRef.current) {
      const prevInsideCount = lastCountsRef.current.split("|").filter(s => s.endsWith("true")).length;
      lastCountsRef.current = key;
      if (insideCount > 0 && isPlayMode && insideCount !== count) {
        sounds.playTick(insideCount);
        if (insideCount > prevInsideCount) {
          setShouldAnimateJar(true);
          const t = setTimeout(() => setShouldAnimateJar(false), 300);
          return () => clearTimeout(t);
        }
      }
    }
  }, [magnets, insideCount, isPlayMode, count]);

  const hasTriggeredSuccess = useRef(false);

  useEffect(() => {
    hasTriggeredSuccess.current = false;
  }, [question.id]);

  useEffect(() => {
    if (isPlayMode && count > 0 && insideCount === count) {
      if (!hasTriggeredSuccess.current) {
        hasTriggeredSuccess.current = true;
        sounds.playSuccess();
        if (onSuccess) onSuccess();
      }
    } else {
      hasTriggeredSuccess.current = false;
    }
  }, [insideCount, count, isPlayMode, onSuccess]);

  const accent: CanvasAccent = FRAME_ACCENTS[question.config.frameColor || "indigo"] || "indigo";
  const isSolved = count > 0 && insideCount === count;
  const { showGhostGuide, reportActivity } = useGhostGuide({
    isPlayMode,
    isSolved,
    idleThresholdMs: 10000
  });

  const draggedItem = draggedItemId ? (draggedItemId === "jar" ? { x: jarPosition.x, y: jarPosition.y } : magnets.find(i => i.id === draggedItemId)) : null;
  const isDraggingJar = draggedItemId === "jar";

  const renderKawaiiFace = (type: "jar" | "basket" | "box") => {
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
        {/* Blushing cheeks */}
        <circle cx={blushX1} cy={cheekY} r={5} fill={blushColor} />
        <circle cx={blushX2} cy={cheekY} r={5} fill={blushColor} />

        {isHappy ? (
          <>
            {/* Happy Closed Blink Eyes (Curves up: ^^ ) */}
            <path d={`M ${cX1 - 4} ${cY + 1} Q ${cX1} ${cY - 3} ${cX1 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />
            <path d={`M ${cX2 - 4} ${cY + 1} Q ${cX2} ${cY - 3} ${cX2 + 4} ${cY + 1}`} fill="none" stroke={inkColor} strokeWidth="2.2" strokeLinecap="round" />

            {/* Big Open Happy Mouth */}
            <path d={`M 46,${smileY} C 46,${smileY + 7} 54,${smileY + 7} 54,${smileY} Z`} fill={tongueColor} stroke={inkColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            {/* Regular Wide-Open Kawaii Twinkle Eyes */}
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

            {/* Shy/Happy Smile */}
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY} Z`} fill={tongueColor} />
            <path d={`M 47,${smileY} C 47,${smileY + 3.5} 53,${smileY + 3.5} 53,${smileY}`} fill="none" stroke={inkColor} strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </g>
    );
  };

  const dockWidth = isMobile ? Math.min(320, dimensions.width - 32) : Math.min(260, Math.max(220, Math.round(dimensions.width * 0.32)));
  const dockHeight = isMobile ? 95 : Math.min(280, Math.max(230, dimensions.height - 48));
  const dockLeft = isMobile ? Math.round((dimensions.width - dockWidth) / 2) : Math.max(240, dimensions.width - dockWidth - 24);
  const dockTop = isMobile ? dimensions.height - dockHeight - 12 : 24;

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={question.instruction}
      isDark={isDark}
      showGrid={showGrid}
      accent={accent}
      headerIcon={<Package size={16} />}
      headerTitle="Magnets"
      headerSubtitle={`${insideCount} of ${count} inside`}
      readAloudText={question.instruction || `Drag all ${count} ${obj.label} into the container.`}
      headerActions={
        isPlayMode ? (
          <CanvasChip accent={isSolved ? "emerald" : accent} isDark={isDark}>
            {isSolved ? "All inside" : `${count - insideCount} left`}
          </CanvasChip>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={reset} title="Reset positions">
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
            : "Design Mode · Drag the container and items to place them"
      }
      footerSolved={isSolved}
      designerHint="Drag the container or the items to reposition them."
    >
      <div
        ref={containerRef}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        className="relative flex-1 w-full min-h-[400px] md:min-h-[320px] flex flex-col overflow-hidden touch-none select-none overscroll-none"
      >
      {!isPlayMode && showGrid && (
        <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.15]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="magnets-grid" width={GRID_STEP} height={GRID_STEP} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_STEP} 0 L 0 0 0 ${GRID_STEP}`} fill="none" stroke="#6366f1" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#magnets-grid)" />
          </svg>
        </div>
      )}

      {!isPlayMode && draggedItem && dragPos && (
        <>
          <div
            className="absolute left-0 right-0 border-t border-dashed border-rose-400/40 pointer-events-none z-40"
            style={{ top: `${draggedItem.y + (isDraggingJar ? JAR_HEIGHT : magnetSize) / 2}px` }}
          />
          <div
            className="absolute top-0 bottom-0 border-l border-dashed border-rose-400/40 pointer-events-none z-40"
            style={{ left: `${draggedItem.x + (isDraggingJar ? JAR_WIDTH : magnetSize) / 2}px` }}
          />
        </>
      )}

      <div
        className={`absolute rounded-3xl p-4 transition-colors duration-300 pointer-events-none z-0 flex flex-col justify-between ${surfaceClass(isDark)}`}
        style={{
          left: `${dockLeft}px`,
          top: `${dockTop}px`,
          width: `${dockWidth}px`,
          height: `${dockHeight}px`
        }}
      >
        <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.18em] shrink-0 ${captionClass(isDark)}`}>
          Dock
        </span>
      </div>

      {/* Idle hint — highlights the container after 10s of inactivity */}
      <GhostGuideOverlay
        show={showGhostGuide && !isSolved}
        label={`Drag each ${obj.label} into the container!`}
        isDark={isDark}
        labelPlacement="top"
        style={{
          left: currentJarPosition.x - 16,
          top: currentJarPosition.y - 16,
          width: JAR_WIDTH + 32,
          height: JAR_HEIGHT + 32
        }}
      />

      {/* Kawaii Container (Jar, Basket, or Box) */}
      <div
        onPointerDown={(e) => {
          if (isPlayMode) return; // Restrict jar dragging in play mode!
          handlePointerDown(e, "jar");
        }}
        style={{
          position: "absolute",
          left: `${currentJarPosition.x}px`,
          top: `${currentJarPosition.y}px`,
          width: `${JAR_WIDTH}px`,
          height: `${JAR_HEIGHT}px`,
          zIndex: draggedItemId === "jar" ? 40 : 10
        }}
        className={`relative flex flex-col select-none transition-all duration-300 ${
          shouldAnimateJar ? "scale-[1.05] -rotate-2" : ""
        } ${isPlayMode ? "" : "cursor-grab active:cursor-grabbing hover:scale-[1.01]"}`}
      >


        {/* 1. Dynamic SVG Kawaii Container */}
        {(question.config.containerShape === "basket") ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="basketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#d7ccc8"/>
                <stop offset="40%" stop-color="#b0bec5"/>
                <stop offset="100%" stop-color="#8d6e63"/>
              </linearGradient>
              <linearGradient id="basketHandle" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#a1887f"/>
                <stop offset="50%" stop-color="#d7ccc8"/>
                <stop offset="100%" stop-color="#8d6e63"/>
              </linearGradient>
              <radialGradient id="basketBlush" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#ff8da1" stop-opacity="0.85"/>
                <stop offset="100%" stop-color="#ff8da1" stop-opacity="0"/>
              </radialGradient>
              <radialGradient id="basketShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(141, 110, 99, 0.25)"/>
                <stop offset="100%" stop-color="rgba(0, 0, 0, 0)"/>
              </radialGradient>
            </defs>
            <ellipse cx="50" cy="90" rx="26" ry="4.5" fill="url(#basketShadow)"/>
            <path d="M 22,40 C 22,10 78,10 78,40" fill="none" stroke="url(#basketHandle)" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M 22,40 C 22,12 78,12 78,40" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 3" stroke-linecap="round" opacity="0.6"/>
            <path d="M 20,38 L 80,38 C 80,38 78,78 70,84 C 62,90 38,90 30,84 C 22,78 20,38 20,38 Z" fill="url(#basketGrad)" stroke="#6d4c41" stroke-width="2.5" stroke-linejoin="round"/>
            <path d="M 24,48 L 76,48 M 27,58 L 73,58 M 29,68 L 71,68 M 31,78 L 69,78" fill="none" stroke="#6d4c41" stroke-width="1.5" opacity="0.3"/>
            <path d="M 32,38 L 36,88 M 41,38 L 43,89 M 50,38 L 50,90 M 59,38 L 57,89 M 68,38 L 64,88" fill="none" stroke="#6d4c41" stroke-width="1.5" opacity="0.3"/>
            <rect x="17" y="34" width="66" height="6" rx="3" fill="#8d6e63" stroke="#6d4c41" stroke-width="2"/>
            <rect x="20" y="36" width="60" height="2" rx="1" fill="#d7ccc8" opacity="0.5"/>
            {renderKawaiiFace("basket")}
            <path d="M 23,45 C 22,55 24,70 27,76" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>
          </svg>
        ) : (question.config.containerShape === "box") ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="boxMain" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#E5BA8D" />
                <stop offset="100%" stop-color="#C69565" />
              </linearGradient>
              <linearGradient id="boxInner" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#A57548" />
                <stop offset="100%" stop-color="#875A32" />
              </linearGradient>
              <linearGradient id="boxFlapLight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#F2CFA7" />
                <stop offset="100%" stop-color="#D8A878" />
              </linearGradient>
              <linearGradient id="panelHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#FFF" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#FFF" stop-opacity="0"/>
              </linearGradient>
              <radialGradient id="groundShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#4B3728" stop-opacity="0.3" />
                <stop offset="100%" stop-color="#4B3728" stop-opacity="0" />
              </radialGradient>
            </defs>

            <ellipse cx="200" cy="340" rx="110" ry="18" fill="url(#groundShadow)" />

            <g transform="rotate(2, 200, 220)">
              {/* Inside of the box */}
              <path d="M 110,170 L 290,170 L 290,220 L 110,220 Z" fill="url(#boxInner)" stroke="#5C3D24" strokeWidth="6" strokeLinejoin="round" />
              
              {/* Back Flap */}
              <path d="M 110,170 L 140,120 L 260,120 L 290,170 Z" fill="#B58556" stroke="#5C3D24" strokeWidth="6" strokeLinejoin="round" />

              {/* Main Box Body Front */}
              <rect x="105" y="170" width="190" height="150" rx="14" fill="url(#boxMain)" stroke="#5C3D24" strokeWidth="6" strokeLinejoin="round" />
              
              {/* Box Tape/Label */}
              <path d="M 180,170 L 220,170 L 220,200 L 180,200 Z" fill="#FFF" opacity="0.9" />
              <path d="M 185,180 L 215,180 M 185,190 L 205,190" stroke="#E5BA8D" strokeWidth="3" strokeLinecap="round" />

              {/* Side Flap Left */}
              <path d="M 105,174 L 45,140 L 45,210 L 105,174 Z" fill="url(#boxFlapLight)" stroke="#5C3D24" strokeWidth="6" strokeLinejoin="round" />
              
              {/* Side Flap Right */}
              <path d="M 295,174 L 355,140 L 355,210 L 295,174 Z" fill="url(#boxFlapLight)" stroke="#5C3D24" strokeWidth="6" strokeLinejoin="round" />

              {/* Front Flap */}
              <path d="M 105,172 L 125,230 L 275,230 L 295,172 Z" fill="url(#boxFlapLight)" stroke="#5C3D24" strokeWidth="6" strokeLinejoin="round" />
              
              {/* Front Flap Crease Line */}
              <line x1="125" y1="172" x2="275" y2="172" stroke="#B58556" strokeWidth="3" strokeLinecap="round" />

              {/* Dynamic Winking Face */}
              {shouldAnimateJar ? (
                <g id="face-happy">
                  {/* Left Blink Eye */}
                  <path d="M 148,258 Q 160,248 172,258" fill="none" stroke="#2D1E15" strokeWidth="6.5" strokeLinecap="round" />
                  {/* Right Blink Eye */}
                  <path d="M 228,258 Q 240,248 252,258" fill="none" stroke="#2D1E15" strokeWidth="6.5" strokeLinecap="round" />
                  {/* Rosy Cheeks */}
                  <ellipse cx="140" cy="266" rx="9" ry="6" fill="#FF8A8A" opacity="0.8" />
                  <ellipse cx="260" cy="266" rx="9" ry="6" fill="#FF8A8A" opacity="0.8" />
                  {/* Big Open Happy Mouth */}
                  <path d="M 190,254 C 190,270 210,270 210,254 Z" fill="#ff769b" stroke="#2D1E15" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              ) : (
                <g id="face-normal">
                  {/* Left Eye */}
                  <circle cx="160" cy="255" r="11" fill="#2D1E15" />
                  <circle cx="157" cy="251" r="4" fill="#FFF" />
                  <circle cx="163" cy="258" r="1.5" fill="#FFF" />
                  {/* Right Eye */}
                  <circle cx="240" cy="255" r="11" fill="#2D1E15" />
                  <circle cx="237" cy="251" r="4" fill="#FFF" />
                  <circle cx="243" cy="258" r="1.5" fill="#FFF" />
                  {/* Rosy Cheeks */}
                  <ellipse cx="140" cy="266" rx="9" ry="6" fill="#FF8A8A" opacity="0.8" />
                  <ellipse cx="260" cy="266" rx="9" ry="6" fill="#FF8A8A" opacity="0.8" />
                  {/* Happy W-shaped Mouth */}
                  <path d="M 193,256 C 193,262 200,262 200,256 C 200,262 207,262 207,256" fill="none" stroke="#2D1E15" strokeWidth="3.5" strokeLinecap="round" />
                </g>
              )}

              {/* Little Box Hands/Paws */}
              <path d="M 100,260 C 90,260 85,270 95,275 C 105,280 115,270 115,270" fill="url(#boxFlapLight)" stroke="#5C3D24" strokeWidth="5" strokeLinecap="round" />
              <path d="M 300,260 C 310,260 315,270 305,275 C 295,280 285,270 285,270" fill="url(#boxFlapLight)" stroke="#5C3D24" strokeWidth="5" strokeLinecap="round" />

              {/* Subtle Body Highlights */}
              <rect x="112" y="176" width="6" height="136" fill="url(#panelHighlight)" rx="3" />
            </g>

            {/* Decorative Sparkles & Hearts */}
            <g id="sparkles" opacity="0.85">
              {/* Left Heart */}
              <path d="M 75,120 C 70,110 55,110 55,125 C 55,140 75,155 75,155 C 75,155 95,140 95,125 C 95,110 80,110 75,120 Z" fill="#FF6B8B" transform="translate(45, 10) scale(0.4)" />
              {/* Right Sparkles */}
              <path d="M 330,110 L 333,118 L 341,121 L 333,124 L 330,132 L 327,124 L 319,121 L 327,118 Z" fill="#FFD166" />
              <path d="M 350,135 L 351,139 L 355,140 L 351,141 L 350,145 L 349,141 L 345,140 L 349,139 Z" fill="#FFD166" />
            </g>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#e0f7fa"/>
                <stop offset="20%" stop-color="#b2ebf2"/>
                <stop offset="50%" stop-color="#e0f7fa" stop-opacity="0.6"/>
                <stop offset="80%" stop-color="#80deea"/>
                <stop offset="100%" stop-color="#4dd0e1"/>
              </linearGradient>
              <linearGradient id="lidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ffb3ba"/>
                <stop offset="40%" stop-color="#ffdfba"/>
                <stop offset="100%" stop-color="#ff8da1"/>
              </linearGradient>
              <radialGradient id="honeyGrad" cx="40%" cy="40%" r="70%">
                <stop offset="0%" stop-color="#fff9c4"/>
                <stop offset="40%" stop-color="#ffeb3b"/>
                <stop offset="85%" stop-color="#fbc02d"/>
                <stop offset="100%" stop-color="#f57f17"/>
              </radialGradient>
              <radialGradient id="jarBlush" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#ff8da1" stop-opacity="0.85"/>
                <stop offset="100%" stop-color="#ff8da1" stop-opacity="0"/>
              </radialGradient>
              <radialGradient id="floorShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="rgba(77, 208, 225, 0.25)"/>
                <stop offset="100%" stop-color="rgba(0, 0, 0, 0)"/>
              </radialGradient>
            </defs>
            <ellipse cx="50" cy="90" rx="24" ry="4.5" fill="url(#floorShadow)"/>
            <g>
              <path d="M 32,32 C 32,28 68,28 68,32 L 70,38 C 74,40 76,46 76,54 L 74,80 C 74,86 68,88 50,88 C 32,88 26,86 26,80 L 24,54 C 24,46 26,40 30,38 Z" fill="#ffffff" opacity="0.9"/>
              <path d="M 25.5,56 C 25.5,52 28,50 32,52 Q 41,56 50,52 Q 59,48 68,52 C 72,50 74.5,52 74.5,56 L 73,78 C 72,83 66,85 50,85 C 34,85 28,83 27,78 Z" fill="url(#honeyGrad)"/>
              <path d="M 50,60 L 51,62 L 53,62.5 L 51.5,64 L 52,66 L 50,65 L 48,66 L 48.5,64 L 47,62.5 L 49,62 Z" fill="#ffffff" opacity="0.9"/>
              <path d="M 32,32 C 32,28 68,28 68,32 L 70,38 C 74,40 76,46 76,54 L 74,80 C 74,86 68,88 50,88 C 32,88 26,86 26,80 L 24,54 C 24,46 26,40 30,38 Z" fill="url(#glassGrad)" opacity="0.85"/>
              <rect x="29" y="24" width="42" height="7" rx="3.5" fill="url(#lidGrad)"/>
              <rect x="32" y="19" width="36" height="6" rx="2.5" fill="url(#lidGrad)"/>
              <line x1="36" y1="24" x2="36" y2="31" stroke="#ffffff" stroke-width="1" opacity="0.4"/>
              <line x1="43" y1="24" x2="43" y2="31" stroke="#ffffff" stroke-width="1" opacity="0.4"/>
              <line x1="50" y1="24" x2="50" y2="31" stroke="#ffffff" stroke-width="1" opacity="0.4"/>
              <line x1="57" y1="24" x2="57" y2="31" stroke="#ffffff" stroke-width="1" opacity="0.4"/>
              <line x1="64" y1="24" x2="64" y2="31" stroke="#ffffff" stroke-width="1" opacity="0.4"/>
              {renderKawaiiFace("jar")}
              <path d="M 28,50 C 27,60 28,72 31,80" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
              <path d="M 33,39 C 30,41 29,45 29,48" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
              <path d="M 64,84 C 70,82 71,78 71,75" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
            </g>
            <g transform="translate(76, 34)">
              <ellipse cx="0" cy="0" rx="4" ry="3" fill="#ffeb3b"/>
              <ellipse cx="-1" cy="-3" rx="1.5" ry="2.5" fill="#e0f7fa" opacity="0.8" transform="rotate(-20)"/>
              <ellipse cx="2" cy="-3" rx="1.5" ry="2.5" fill="#e0f7fa" opacity="0.8" transform="rotate(20)"/>
              <line x1="-1" y1="-3" x2="-1" y2="3" stroke="#37474f" stroke-width="0.8"/>
              <line x1="1" y1="-3" x2="1" y2="3" stroke="#37474f" stroke-width="0.8"/>
              <circle cx="3" cy="0" r="0.5" fill="#37474f"/>
            </g>
            <path d="M 18,44 Q 18,46 16,46 Q 18,46 18,48 Q 18,46 20,46 Q 18,46 18,44 Z" fill="#fff59d"/>
            <circle cx="22" cy="38" r="1" fill="#fff59d"/>
          </svg>
        )}

        {/* 2. Hanging Vintage Tag Overlay */}
        <div className={`absolute bottom-[8%] left-1/2 -translate-x-1/2 z-10 pointer-events-none text-center select-none py-1 px-3.5 rounded-xl border border-dashed transition-all duration-300 shadow-sm ${
          isDark 
            ? "bg-slate-950/95 border-slate-700 text-slate-200" 
            : "bg-white/95 border-amber-300 text-slate-800"
        }`}>
          <span className="font-mono text-[7px] font-black uppercase tracking-wider block mb-0.5 text-amber-600">
            {question.config.containerShape === "basket" 
              ? "INSIDE BASKET" 
              : question.config.containerShape === "box" 
              ? "INSIDE BOX" 
              : "INSIDE JAR"}
          </span>
          <span className={`text-2xl font-black font-mono transition-all duration-300 ${
            insideCount === count 
              ? "text-emerald-500 scale-105" 
              : "text-slate-800"
          }`}>
            {insideCount}
          </span>
        </div>

        {/* Jar coordinate tooltip in design mode */}
        {!isPlayMode && draggedItemId === "jar" && dragPos && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
            {jarPosition.x}, {jarPosition.y}
          </div>
        )}
      </div>

      {magnets.map(item => {
        const assetType = question.config?.assetType || "emoji";
        const hasFrame = question.config.showItemFrame ?? true;
        const isDragging = draggedItemId === item.id;

        let itemClassName = "flex items-center justify-center select-none touch-none rounded-2xl transition-all duration-250 ease-out";
        itemClassName += " cursor-grab active:cursor-grabbing";

        if (hasFrame) {
          itemClassName += item.inside
            ? ` ${accentChipClass(accent, isDark)} border-2`
            : ` ${surfaceClass(isDark, "raised")} border-0`;
          if (isDragging) itemClassName += " scale-110 drop-shadow-xl z-50";
        } else {
          itemClassName += item.inside
            ? " scale-98 drop-shadow-md"
            : " drop-shadow hover:drop-shadow-md hover:scale-105";
          if (isDragging) itemClassName += " scale-125 drop-shadow-2xl z-50";
        }

        const transitionStyle = isDragging
          ? "none"
          : "left 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";

        return (
          <div
            key={item.id}
            onPointerDown={(e) => handlePointerDown(e, item.id)}
            style={{
              position: "absolute",
              left: `${item.x}px`,
              top: `${item.y}px`,
              width: `${magnetSize}px`,
              height: `${magnetSize}px`,
              zIndex: isDragging ? 50 : item.inside ? 20 : 30,
              transition: transitionStyle
            }}
            className={itemClassName}
          >
            {!isPlayMode && isDragging && dragPos && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shadow z-50">
                {item.x}, {item.y}
              </div>
            )}
            <CountingAsset type={assetType as any} emoji={item.emoji} size={isMobile ? 32 : 42} />
          </div>
        );
      })}
      </div>
    </SharedCanvasLayout>
  );
};
