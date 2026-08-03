import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CanvasProps } from "./types";
import { sounds } from "../../sound";
import {
  RotateCcw,
  RotateCw,
  Trophy,
  Check,
  Plus,
  Lightbulb,
  Sparkles,
  Timer,
  Star,
  Layers,
} from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { Celebration } from "./Celebration";
import { surfaceClass } from "./canvasTheme";
import {
  getCurriculumLevel,
  BottleState,
  LiquidLayer,
  CurriculumLevel,
} from "./liquidSortLevels";

/** Curated vibrant color palette for liquid layers */
const COLOR_PALETTE: Record<
  string,
  { fill: string; stroke: string; glow: string; label: string }
> = {
  cyan: { fill: "#06B6D4", stroke: "#0891B2", glow: "#22D3EE", label: "Cyan" },
  magenta: { fill: "#EC4899", stroke: "#DB2777", glow: "#F472B6", label: "Magenta" },
  gold: { fill: "#F59E0B", stroke: "#D97706", glow: "#FBBF24", label: "Gold" },
  emerald: { fill: "#10B981", stroke: "#059669", glow: "#34D399", label: "Emerald" },
  violet: { fill: "#8B5CF6", stroke: "#7C3AED", glow: "#A78BFA", label: "Violet" },
  orange: { fill: "#F97316", stroke: "#EA580C", glow: "#FB923C", label: "Orange" },
  tan: { fill: "#D97706", stroke: "#B45309", glow: "#F59E0B", label: "Tan" },
  blue: { fill: "#3B82F6", stroke: "#2563EB", glow: "#60A5FA", label: "Blue" },
};

interface BuoyantBubble {
  id: number;
  bottleId: string;
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
}

interface SplashDroplet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

type ClientRectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** Map a point in this bottle's 100x240 viewBox to its real screen position. */
export const bottleViewBoxPoint = (
  rect: ClientRectLike,
  x: number,
  y: number,
  viewBoxHeight = 240
) => {
  // SVG's default preserveAspectRatio is xMidYMid meet. The mobile bottle is a
  // slightly different aspect ratio, so width / 100 alone is not sufficient.
  const scale = Math.min(rect.width / 100, rect.height / viewBoxHeight);
  const insetX = (rect.width - 100 * scale) / 2;
  const insetY = (rect.height - viewBoxHeight * scale) / 2;
  return {
    x: rect.left + insetX + x * scale,
    y: rect.top + insetY + y * scale,
    scale,
  };
};

export interface CssTransform2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/** Parse the computed 2D portion of either `matrix()` or Safari's `matrix3d()`. */
export const parseCssTransform = (transform: string): CssTransform2D => {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  if (!transform || transform === "none") return identity;
  const body = transform.slice(transform.indexOf("(") + 1, transform.lastIndexOf(")"));
  const values = body.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
  if (transform.startsWith("matrix3d(") && values.length === 16) {
    return { a: values[0], b: values[1], c: values[4], d: values[5], e: values[12], f: values[13] };
  }
  if (transform.startsWith("matrix(") && values.length === 6) {
    return { a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] };
  }
  return identity;
};

/** Apply an element's CSS transform around its transform-origin to a local point. */
export const transformedLayoutPoint = (
  baseLeft: number,
  baseTop: number,
  pointX: number,
  pointY: number,
  originX: number,
  originY: number,
  matrix: CssTransform2D
) => {
  const x = pointX - originX;
  const y = pointY - originY;
  return {
    x: baseLeft + originX + matrix.a * x + matrix.c * y + matrix.e,
    y: baseTop + originY + matrix.b * x + matrix.d * y + matrix.f,
  };
};

/**
 * Solver behind the hint button: returns a first move that leads to a solved board.
 *
 * Depth-first with a visited set, not breadth-first. A real board takes 20-32 pours to
 * finish, and BFS at this branching factor exhausts any sane budget around depth 3 — the
 * previous 1500-iteration BFS returned null (no hint at all) on 7 of the 20 curated
 * levels, every one of them solvable. DFS reaches a solved state in 22-38 explored
 * states on those same levels.
 *
 * The trade is that the move is *a* route to a win rather than the shortest one, which
 * is what a hint needs. Returns null only when the board genuinely cannot be finished.
 */
export function solveLiquidSort(
  bottles: BottleState[]
): { from: string; to: string } | null {
  interface StateNode {
    bottles: { id: string; layers: string[]; capacity: number }[];
    firstMove?: { from: string; to: string };
  }

  const initialBottles = bottles.map((b) => ({
    id: b.id,
    layers: b.layers.map((l) => l.colorKey),
    capacity: b.capacity,
  }));

  const stateKey = (state: { layers: string[] }[]) =>
    state
      .map((b) => b.layers.join(","))
      .sort()
      .join("|");

  const isSolved = (state: { layers: string[]; capacity: number }[]) =>
    state.every(
      (b) =>
        b.layers.length === 0 ||
        (b.layers.length === b.capacity && b.layers.every((l) => l === b.layers[0]))
    );

  if (isSolved(initialBottles)) return null;

  const visited = new Set<string>();
  const stack: StateNode[] = [{ bottles: initialBottles }];
  visited.add(stateKey(initialBottles));

  let iterations = 0;
  while (stack.length > 0 && iterations < 200000) {
    iterations++;
    const current = stack.pop()!;

    for (let i = 0; i < current.bottles.length; i++) {
      const src = current.bottles[i];
      if (src.layers.length === 0) continue;

      if (
        src.layers.length === src.capacity &&
        src.layers.every((l) => l === src.layers[0])
      ) {
        continue;
      }

      const topColor = src.layers[src.layers.length - 1];

      for (let j = 0; j < current.bottles.length; j++) {
        if (i === j) continue;
        const tgt = current.bottles[j];
        if (tgt.layers.length >= tgt.capacity) continue;

        const isTgtEmpty = tgt.layers.length === 0;
        const tgtTopColor = isTgtEmpty ? null : tgt.layers[tgt.layers.length - 1];

        if (isTgtEmpty || tgtTopColor === topColor) {
          const nextBottles = current.bottles.map((b) => ({
            ...b,
            layers: [...b.layers],
          }));
          const nSrc = nextBottles[i];
          const nTgt = nextBottles[j];

          while (
            nSrc.layers.length > 0 &&
            nSrc.layers[nSrc.layers.length - 1] === topColor &&
            nTgt.layers.length < nTgt.capacity
          ) {
            nSrc.layers.pop();
            nTgt.layers.push(topColor);
          }

          const key = stateKey(nextBottles);
          if (!visited.has(key)) {
            visited.add(key);
            const firstMove = current.firstMove || { from: src.id, to: tgt.id };
            if (isSolved(nextBottles)) {
              return firstMove;
            }
            stack.push({ bottles: nextBottles, firstMove });
          }
        }
      }
    }
  }

  return null;
}

export const LiquidSortCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode = true,
  isDark = false,
  compact = false,
  onSuccess,
  onAttempt,
  onHint,
}) => {
  const initialLevelId = (question.config as any)?.levelId || "level_1";
  const [selectedLevelId, setSelectedLevelId] = useState<string>(initialLevelId);
  const currentLevel = getCurriculumLevel(selectedLevelId);

  const stageRef = useRef<HTMLDivElement>(null);

  // Helper to clone initial level bottle configuration
  const loadLevelBottles = (level: CurriculumLevel): BottleState[] => {
    return level.bottles.map((b) => ({
      id: b.id,
      capacity: b.capacity,
      isTower: b.isTower,
      layers: b.layers.map((l) => ({ ...l })),
    }));
  };

  const [bottles, setBottles] = useState<BottleState[]>(() =>
    loadLevelBottles(currentLevel)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<BottleState[][]>([]);
  const [isWon, setIsWon] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  // Pours the puzzle refused (full bottle, mismatched colour). Trying one is how the
  // game is played, not a wrong answer, so it is reported as detail on the solve rather
  // than as an attempt — see the note where the solve is reported.
  const invalidPours = useRef(0);
  const [seconds, setSeconds] = useState(0);

  // Hint state
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);

  // Pouring animation state & real-time progress clock
  const [pouringInfo, setPouringInfo] = useState<{
    sourceId: string;
    targetId: string;
    colorKey: string;
    transferCount: number;
    deltaX: number;
    deltaY: number;
    isRight: boolean;
    streamX: number;
    streamY: number;
    targetMouthX: number;
    targetMouthY: number;
    sourceBaseX: number;
    sourceBaseY: number;
    sourceLipX: number;
    sourceLipY: number;
    sourceOriginX: number;
    sourceOriginY: number;
  } | null>(null);

  const [pourProgress, setPourProgress] = useState(0);
  const pourStartTimeRef = useRef<number | null>(null);

  // Bottle DOM element refs
  const bottleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bottleSvgRefs = useRef<Record<string, SVGSVGElement | null>>({});

  // Physics animation clock & slosh states (damped harmonic oscillator)
  const [animTime, setAnimTime] = useState(0);
  const animTimeRef = useRef<number>(0);
  const [sloshAngles, setSloshAngles] = useState<Record<string, number>>({});
  const sloshRef = useRef<Record<string, number>>({});

  // Physics particle systems
  const [bubbles, setBubbles] = useState<BuoyantBubble[]>([]);
  const [splashes, setSplashes] = useState<SplashDroplet[]>([]);

  const pourTimeoutsRef = useRef<number[]>([]);

  const safeTimeout = (fn: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      fn();
      pourTimeoutsRef.current = pourTimeoutsRef.current.filter((t) => t !== timer);
    }, delay);
    pourTimeoutsRef.current.push(timer);
    return timer;
  };

  const clearPourTimeouts = () => {
    pourTimeoutsRef.current.forEach((t) => window.clearTimeout(t));
    pourTimeoutsRef.current = [];
  };

  const initialBottlesRef = useRef<BottleState[]>([]);

  // Sync level selection when question config changes
  useEffect(() => {
    const qLevelId = (question.config as any)?.levelId || "level_1";
    setSelectedLevelId(qLevelId);
  }, [(question.config as any)?.levelId, question.id]);

  // Load level bottles when selectedLevelId or question changes
  useEffect(() => {
    clearPourTimeouts();
    const lvl = getCurriculumLevel(selectedLevelId);
    const initial = loadLevelBottles(lvl);
    initialBottlesRef.current = initial;
    setBottles(loadLevelBottles(lvl));
    setHistory([]);
    setSelectedId(null);
    setIsWon(false);
    setMoveCount(0);
    invalidPours.current = 0;
    setSeconds(0);
    setHintMove(null);
    setPouringInfo(null);

    return () => clearPourTimeouts();
  }, [selectedLevelId, question.id]);

  // Timer interval
  useEffect(() => {
    if (isWon) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isWon]);

  // Keyboard Shortcuts (H = Hint, U = Undo, R = Reset, Escape = Deselect)
  useEffect(() => {
    if (!isPlayMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === "Escape") {
        setSelectedId(null);
      } else if (e.key.toLowerCase() === "h") {
        handleGetHint();
      } else if (e.key.toLowerCase() === "u") {
        handleUndo();
      } else if (e.key.toLowerCase() === "r") {
        handleReset();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlayMode, bottles, isWon, history, pouringInfo]);

  // Trigger liquid surface slosh impulse
  const triggerSlosh = (id: string, impulse: number) => {
    sloshRef.current[id] = (sloshRef.current[id] || 0) + impulse;
    setSloshAngles({ ...sloshRef.current });
  };

  // 60 FPS Real-time Fluid Physics Loop
  useEffect(() => {
    let animationFrameId: number;

    const tick = () => {
      animTimeRef.current += 0.05;
      setAnimTime(animTimeRef.current);

      // Track pour progress (0 to 1 over 600ms transfer interval)
      if (pouringInfo) {
        if (!pourStartTimeRef.current) pourStartTimeRef.current = Date.now();
        const elapsed = Date.now() - pourStartTimeRef.current;
        const progress = Math.min(1, Math.max(0, (elapsed - 120) / 480));
        setPourProgress(progress);
      } else {
        pourStartTimeRef.current = null;
        setPourProgress(0);
      }

      // Update slosh physics decay
      let needsSloshUpdate = false;
      const nextSlosh: Record<string, number> = { ...sloshRef.current };
      for (const id in nextSlosh) {
        if (Math.abs(nextSlosh[id]) > 0.04) {
          nextSlosh[id] *= 0.91;
          needsSloshUpdate = true;
        } else {
          nextSlosh[id] = 0;
        }
      }
      if (needsSloshUpdate) {
        sloshRef.current = nextSlosh;
        setSloshAngles({ ...nextSlosh });
      }

      // Update particles
      if (pouringInfo) {
        sloshRef.current[pouringInfo.targetId] =
          Math.sin(animTimeRef.current * 14) * 8;
        setSloshAngles({ ...sloshRef.current });

        if (Math.random() < 0.7) {
          const targetBottle = bottles.find((b) => b.id === pouringInfo.targetId);
          const newBubble: BuoyantBubble = {
            id: Math.random(),
            bottleId: pouringInfo.targetId,
            x: 50 + (Math.random() - 0.5) * 36,
            y: targetBottle?.isTower ? 415 : 215,
            size: Math.random() * 3 + 2,
            alpha: 0.85,
            speed: Math.random() * 2 + 3,
          };
          setBubbles((prev) => [...prev.slice(-14), newBubble]);
        }

        if (Math.random() < 0.6) {
          const color = COLOR_PALETTE[pouringInfo.colorKey]?.glow || "#06B6D4";
          const newSplash: SplashDroplet = {
            id: Math.random(),
            x: pouringInfo.targetMouthX + (Math.random() - 0.5) * 10,
            y: pouringInfo.targetMouthY + 3,
            vx: (Math.random() - 0.5) * 5,
            vy: -(Math.random() * 5 + 3),
            color,
            life: 1.0,
          };
          setSplashes((prev) => [...prev.slice(-12), newSplash]);
        }
      } else {
        if (bubbles.length > 0) setBubbles([]);
      }

      setBubbles((prev) =>
        prev
          .map((b) => ({
            ...b,
            y: b.y - b.speed,
            x: b.x + Math.sin(b.y * 0.12 + animTimeRef.current * 5) * 0.8,
            alpha: b.y < 120 ? b.alpha - 0.07 : b.alpha,
          }))
          .filter((b) => b.alpha > 0 && b.y > 65)
      );

      setSplashes((prev) =>
        prev
          .map((s) => ({
            ...s,
            x: s.x + s.vx,
            y: s.y + s.vy,
            vy: s.vy + 0.45,
            life: s.life - 0.07,
          }))
          .filter((s) => s.life > 0)
      );

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [pouringInfo]);

  // Check victory condition
  useEffect(() => {
    const allSorted = bottles.every((b) => {
      if (b.layers.length === 0) return true;
      if (b.layers.length !== b.capacity) return false;
      const firstColor = b.layers[0].colorKey;
      return b.layers.every((l) => l.colorKey === firstColor && !l.hidden);
    });

    if (allSorted && !isWon && bottles.length > 0) {
      setIsWon(true);
      sounds.playWin();
      if (onSuccess) onSuccess();
      if (onAttempt) {
        // Report the bottles themselves, not just "I solved level_1": the server
        // re-checks that every bottle is single-coloured and still holds the level's
        // liquid, so a claim of success is worth nothing without the board behind it.
        onAttempt("correct", {
          selected: bottles.map(bottle => bottle.layers.map(layer => layer.colorKey)),
          details: {
            levelId: selectedLevelId,
            moveCount,
            seconds,
            stars: calculateStars(),
            // How much probing it took — the difficulty signal the discarded
            // "incorrect" attempts used to carry, without distorting mastery.
            invalidPours: invalidPours.current,
          },
        });
      }
    }
  }, [bottles]);

  // Handle Smart Hint Solver request
  const handleGetHint = () => {
    if (isWon || pouringInfo) return;

    // Second tap on Hint auto-executes the recommended pour!
    if (hintMove) {
      const srcId = hintMove.from;
      const tgtId = hintMove.to;
      setSelectedId(null);
      setHintMove(null);

      // Execute tap source then target
      const source = bottles.find((b) => b.id === srcId);
      const target = bottles.find((b) => b.id === tgtId);
      if (source && target && source.layers.length > 0) {
        setSelectedId(srcId);
        setTimeout(() => {
          handleBottleClick(tgtId);
        }, 150);
      }
      return;
    }

    const move = solveLiquidSort(bottles);
    if (move) {
      setHintMove(move);
      setSelectedId(move.from); // Auto-select source bottle!
      sounds.playPop();
      setTimeout(() => setHintMove(null), 8000); // 8-second guidance duration
      if (onHint) {
        onHint({
          levelId: selectedLevelId,
          hintFrom: move.from,
          hintTo: move.to,
        });
      }
    }
  };

  // Handle bottle tap to select or pour into target
  const handleBottleClick = (clickedId: string) => {
    if (isWon || pouringInfo) return;
    setHintMove(null);

    if (selectedId === null) {
      const source = bottles.find((b) => b.id === clickedId);
      if (source && source.layers.length > 0) {
        setSelectedId(clickedId);
        triggerSlosh(clickedId, 16);
        sounds.playPop();
      }
    } else if (selectedId === clickedId) {
      triggerSlosh(clickedId, -14);
      setSelectedId(null);
    } else {
      const source = bottles.find((b) => b.id === selectedId);
      const target = bottles.find((b) => b.id === clickedId);

      if (!source || !target || source.layers.length === 0) {
        setSelectedId(null);
        return;
      }

      const topSourceLayer = source.layers[source.layers.length - 1];
      const topSourceColor = topSourceLayer.colorKey;
      const isTargetEmpty = target.layers.length === 0;
      const topTargetColor = isTargetEmpty
        ? null
        : target.layers[target.layers.length - 1].colorKey;

      if (
        target.layers.length < target.capacity &&
        (isTargetEmpty || topTargetColor === topSourceColor)
      ) {
        const sourceEl = bottleRefs.current[selectedId];
        const targetEl = bottleRefs.current[clickedId];

        let deltaX = 0;
        let deltaY = 0;
        let isRight = true;
        let streamX = 0;
        let streamY = 0;
        let targetMouthX = 0;
        let targetMouthY = 0;
        let sourceBaseX = 0;
        let sourceBaseY = 0;
        let sourceLipX = 0;
        let sourceLipY = 0;
        let sourceOriginX = 0;
        const sourceOriginY = 15;

        if (sourceEl && targetEl) {
          const sourceSvg = bottleSvgRefs.current[selectedId];
          const targetSvg = bottleSvgRefs.current[clickedId];
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();
          const stageRect = stageRef.current?.getBoundingClientRect();

          isRight = tRect.left >= sRect.left;
          if (sourceSvg && targetSvg && stageRect) {
            const sourceSvgRect = sourceSvg.getBoundingClientRect();
            const targetSvgRect = targetSvg.getBoundingClientRect();
            const sourceLip = bottleViewBoxPoint(
              sourceSvgRect,
              isRight ? 65 : 35,
              10,
              source.isTower ? 440 : 240
            );
            const targetMouth = bottleViewBoxPoint(
              targetSvgRect,
              50,
              10,
              target.isTower ? 440 : 240
            );

            // Framer Motion's y value replaces the selected lift; it is not added to
            // it. Read the transform that is actually on screen so even a very quick
            // second tap produces the same final alignment.
            const transform = window.getComputedStyle(sourceEl).transform;
            const matrix = parseCssTransform(transform);
            const currentTranslateX = matrix.e;
            const currentTranslateY = matrix.f;

            // The CSS rotation pivots 15 rendered pixels below the wrapper's top.
            const sourcePivotX = sRect.left + sRect.width / 2;
            const sourcePivotY = sRect.top + sourceOriginY;
            const lipOffsetX = sourceLip.x - sourcePivotX;
            const lipOffsetY = sourceLip.y - sourcePivotY;
            const angle = (isRight ? 72 : -72) * (Math.PI / 180);
            const rotatedLipX =
              sourcePivotX + lipOffsetX * Math.cos(angle) - lipOffsetY * Math.sin(angle);
            const rotatedLipY =
              sourcePivotY + lipOffsetX * Math.sin(angle) + lipOffsetY * Math.cos(angle);

            // Keep a short visible air gap, then terminate the jet at the exact centre
            // of the receiving mouth. This remains accurate at every responsive size.
            const pourGap = Math.max(14, targetMouth.scale * 28);
            const desiredLipX = targetMouth.x + (isRight ? -3 : 3) * targetMouth.scale;
            const desiredLipY = targetMouth.y - pourGap;
            deltaX = currentTranslateX + desiredLipX - rotatedLipX;
            deltaY = currentTranslateY + desiredLipY - rotatedLipY;

            streamX = desiredLipX - stageRect.left;
            streamY = desiredLipY - stageRect.top;
            targetMouthX = targetMouth.x - stageRect.left;
            targetMouthY = targetMouth.y - stageRect.top;
            sourceBaseX = sRect.left - stageRect.left - currentTranslateX;
            sourceBaseY = sRect.top - stageRect.top - currentTranslateY;
            sourceLipX = sourceLip.x - sRect.left;
            sourceLipY = sourceLip.y - sRect.top;
            sourceOriginX = sRect.width / 2;
          }
        }

        let transferCount = 0;
        for (let i = source.layers.length - 1; i >= 0; i--) {
          if (source.layers[i].colorKey === topSourceColor) {
            transferCount++;
          } else {
            break;
          }
        }
        const availableSpace = target.capacity - target.layers.length;
        const actualTransfer = Math.min(transferCount, availableSpace);

        triggerSlosh(selectedId, isRight ? 24 : -24);
        triggerSlosh(clickedId, -18);

        // Save history for Undo
        setHistory((prev) =>
          prev.concat([
            bottles.map((b) => ({
              ...b,
              layers: b.layers.map((l) => ({ ...l })),
            })),
          ])
        );

        setPouringInfo({
          sourceId: selectedId,
          targetId: clickedId,
          colorKey: topSourceColor,
          transferCount: actualTransfer,
          deltaX,
          deltaY,
          isRight,
          streamX,
          streamY,
          targetMouthX,
          targetMouthY,
          sourceBaseX,
          sourceBaseY,
          sourceLipX,
          sourceLipY,
          sourceOriginX,
          sourceOriginY,
        });

        sounds.playPop();
        safeTimeout(() => {
          sounds.playPour(actualTransfer);
        }, 180);

        const newSourceLayers = source.layers.slice(
          0,
          source.layers.length - actualTransfer
        );

        // Reveal Mystery Layer if now on top!
        let revealedMystery = false;
        if (
          newSourceLayers.length > 0 &&
          newSourceLayers[newSourceLayers.length - 1].hidden
        ) {
          newSourceLayers[newSourceLayers.length - 1].hidden = false;
          revealedMystery = true;
        }

        const newTargetLayers = [
          ...target.layers,
          ...Array(actualTransfer)
            .fill(null)
            .map(() => ({ colorKey: topSourceColor, hidden: false })),
        ];

        safeTimeout(() => {
          setBottles((prev) =>
            prev.map((b) => {
              if (b.id === selectedId) return { ...b, layers: newSourceLayers };
              if (b.id === clickedId) return { ...b, layers: newTargetLayers };
              return b;
            })
          );
          setMoveCount((prev) => {
            const nextCount = prev + 1;
            sounds.playTick(nextCount);
            return nextCount;
          });
          if (revealedMystery) {
            triggerSlosh(selectedId, 18);
            sounds.playSparkle();
          }
        }, 300);

        safeTimeout(() => {
          triggerSlosh(clickedId, 16);
          setPouringInfo(null);
          setSelectedId(null);
        }, 750);
      } else {
        triggerSlosh(selectedId, -10);
        setSelectedId(null);
        sounds.playFailure();
        // Deliberately not an `onAttempt("incorrect")`. Probing a bottle is ordinary play
        // in a sort puzzle, but the scoring engine reads every attempt as an answer:
        // firstTry and accuracy carry 0.65 of the mastery score, so a handful of probes
        // dropped a perfect solve from 1.00 to ~0.26 and pinned the skill at `beginner`
        // for good. The count still reaches analytics, on the solve below.
        invalidPours.current += 1;
      }
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || isWon || pouringInfo) return;
    const last = history[history.length - 1];
    setBottles(last);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setSelectedId(null);
    setHintMove(null);
    sounds.playPop();
  };

  const handleReset = () => {
    if (pouringInfo) return;
    clearPourTimeouts();
    const lvl = getCurriculumLevel(selectedLevelId);
    const freshBottles =
      initialBottlesRef.current.length > 0
        ? initialBottlesRef.current.map((b) => ({
            id: b.id,
            capacity: b.capacity,
            isTower: b.isTower,
            layers: b.layers.map((l) => ({ ...l })),
          }))
        : loadLevelBottles(lvl);

    setBottles(freshBottles);
    setHistory([]);
    setSelectedId(null);
    setIsWon(false);
    setMoveCount(0);
    invalidPours.current = 0;
    setSeconds(0);
    setHintMove(null);
    setPouringInfo(null);
    sounds.playPop();
  };

  const handleAddBottle = () => {
    if (bottles.length >= 12 || isWon || pouringInfo) return;
    setBottles((prev) => [
      ...prev,
      {
        id: `b_extra_${Date.now()}`,
        layers: [],
        // Match the board. Levels 1 and 2 hold three layers, and a hardcoded 4 made the
        // spare tube unfillable: winning needs every bottle full or empty, so a colour
        // poured into an oversized tube could never complete it — one tap turned the two
        // easiest levels into dead ends.
        capacity: prev[0]?.capacity ?? 4,
      },
    ]);
    sounds.playPop();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder
      .toString()
      .padStart(2, "0")}`;
  };

  const calculateStars = () => {
    if (moveCount <= 10) return 3;
    if (moveCount <= 18) return 2;
    return 1;
  };

  const getGridColsClass = (count: number) => {
    if (count <= 3) return "grid-cols-3 max-w-xl";
    if (count <= 4) return "grid-cols-2 sm:grid-cols-4 max-w-2xl";
    if (count <= 6) return "grid-cols-3 sm:grid-cols-6 max-w-4xl";
    if (count <= 8) return "grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 max-w-5xl";
    return "grid-cols-5 sm:grid-cols-5 lg:grid-cols-10 max-w-6xl";
  };

  /**
   * Physics SVG Liquid Layer Wave Path Generator
   */
  const renderLiquidLayerPath = (
    bottle: BottleState,
    layer: LiquidLayer,
    index: number,
    isTopLayer: boolean
  ) => {
    const isMystery = layer.hidden;
    const color = isMystery
      ? {
          fill: isDark ? "#334155" : "#CBD5E1",
          stroke: isDark ? "#1E293B" : "#94A3B8",
          glow: isDark ? "#64748B" : "#94A3B8",
          label: "Mystery",
        }
      : COLOR_PALETTE[layer.colorKey] || COLOR_PALETTE.cyan;
    const liquidGradientId = `liquid-${bottle.id}-${isMystery ? "mystery" : layer.colorKey}`;

    const isSourcePouring = pouringInfo?.sourceId === bottle.id;
    const isTargetPouring = pouringInfo?.targetId === bottle.id;

    const bottleBottom = bottle.isTower ? 435 : 235;
    const liquidHeight = bottle.isTower ? 360 : 160;
    const segmentHeight = liquidHeight / bottle.capacity;
    const yBottom = bottleBottom - index * segmentHeight;

    // Fluid height recession for source bottle & rising height for target bottle
    let effectiveYTop = bottleBottom - (index + 1) * segmentHeight;

    if (isSourcePouring && isTopLayer && pourProgress > 0) {
      // Top layer recedes downward as it pours out
      const drainAmount = segmentHeight * pourProgress;
      effectiveYTop = Math.min(yBottom - 2, effectiveYTop + drainAmount);
    } else if (isTargetPouring && isTopLayer && pourProgress > 0) {
      // Top layer rises upward as liquid streams in
      const fillAmount = segmentHeight * pourProgress;
      effectiveYTop = Math.max(75, effectiveYTop - fillAmount);
    }

    if (!isTopLayer) {
      return (
        <g key={`${index}-${layer.colorKey}`}>
          <motion.rect
            initial={{ height: 0 }}
            animate={{ height: segmentHeight + 3 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            x="0"
            y={effectiveYTop - 1}
            width="100"
            height={segmentHeight + 3}
            fill={`url(#${liquidGradientId})`}
            stroke={color.stroke}
            strokeWidth="0.8"
          />
          {isMystery && (
            <text
              x="50"
              y={effectiveYTop + segmentHeight / 2 + 5}
              textAnchor="middle"
              fill={isDark ? "#94A3B8" : "#475569"}
              fontSize="16"
              fontWeight="900"
            >
              ❓
            </text>
          )}
        </g>
      );
    }

    // Top-most fluid wave
    const theta = sloshAngles[bottle.id] || 0;
    const waveOffset = Math.sin(animTime * 6 + index) * 2.5;
    const sloshOffset = Math.sin((theta * Math.PI) / 180) * 32;

    // Liquid shifts into bottleneck (35..65, 10..35) when source bottle tilts to pour
    const yLeft = isSourcePouring
      ? Math.max(12, effectiveYTop - 18)
      : effectiveYTop - sloshOffset + waveOffset;
    const yRight = isSourcePouring
      ? Math.max(12, effectiveYTop - 18)
      : effectiveYTop + sloshOffset - waveOffset;
    const yMid = (yLeft + yRight) / 2 + Math.sin(animTime * 8) * 2;

    const wavePath = `M 0 ${yBottom} L 0 ${yLeft} Q 50 ${yMid} 100 ${yRight} L 100 ${yBottom} Z`;

    return (
      <g key={`${index}-${layer.colorKey}`}>
        <motion.path
          initial={{ d: `M 0 ${yBottom} L 0 ${yBottom} L 100 ${yBottom} L 100 ${yBottom} Z` }}
          animate={{ d: wavePath }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          fill={`url(#${liquidGradientId})`}
          stroke={color.stroke}
          strokeWidth="1"
        />
        <motion.path
          d={`M 0 ${yLeft} Q 50 ${yMid} 100 ${yRight}`}
          fill="none"
          stroke={color.glow}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.9"
        />
        {isMystery && (
          <text
            x="50"
            y={effectiveYTop + segmentHeight / 2 + 5}
            textAnchor="middle"
            fill={isDark ? "#94A3B8" : "#475569"}
            fontSize="16"
            fontWeight="900"
          >
            ❓
          </text>
        )}
      </g>
    );
  };

  const btnPill = (variant: "neutral" | "indigo" | "cyan" = "neutral") =>
    `flex items-center gap-1 rounded-full border font-bold transition-colors disabled:opacity-40 ${
      compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
    } ${
      isDark
        ? variant === "indigo"
          ? "border-indigo-500/40 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
          : variant === "cyan"
          ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-300"
          : "border-white/10 bg-white/[0.08] text-slate-300 hover:bg-white/[0.16]"
        : variant === "indigo"
        ? "border-indigo-200 bg-indigo-50/90 text-indigo-700 hover:bg-indigo-100 shadow-sm"
        : variant === "cyan"
        ? "border-slate-200 bg-slate-100/90 text-slate-700 shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-sm"
    }`;

  const headerControls = (
    <div className={`flex items-center flex-wrap ${compact ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
      <div className={btnPill("neutral")}>
        <span className={isDark ? "text-slate-400" : "text-slate-500"}>Moves:</span>
        <span className={isDark ? "text-indigo-400 font-extrabold" : "text-indigo-600 font-extrabold"}>
          {moveCount}
        </span>
      </div>

      {!compact && (
        <div className={btnPill("cyan")}>
          <Timer size={14} className={isDark ? "text-cyan-400" : "text-slate-500"} />
          <span>{formatTime(seconds)}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleGetHint}
        disabled={pouringInfo !== null || isWon}
        className={btnPill("indigo")}
      >
        <Lightbulb size={compact ? 11 : 14} className={isDark ? "text-indigo-300" : "text-indigo-600"} /> Hint
      </button>

      <button
        type="button"
        onClick={handleUndo}
        disabled={history.length === 0 || pouringInfo !== null}
        className={btnPill("neutral")}
      >
        <RotateCcw size={compact ? 11 : 14} /> Undo
      </button>

      {!compact && (
        <button
          type="button"
          onClick={handleReset}
          disabled={pouringInfo !== null}
          className={btnPill("neutral")}
        >
          <RotateCw size={14} /> Reset
        </button>
      )}

      {!compact && (
        <button
          type="button"
          onClick={handleAddBottle}
          disabled={bottles.length >= 12 || pouringInfo !== null}
          className={btnPill("indigo")}
        >
          <Plus size={14} /> Tube
        </button>
      )}
    </div>
  );

  const hasTower = bottles.some((bottle) => bottle.isTower);

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      headerTitle={compact ? undefined : question.title || "Liquid Color Sort"}
      headerSubtitle={
        (question as any).subtitle ||
        `${compact ? currentLevel.name.replace(/^Level \d+:\s*/, "") : currentLevel.name} (${currentLevel.targetCount} Tubes)`
      }
      playHint="Sort all liquid colors so each tube contains a single solid color."
      designerHint="Tap a tube to pick up its top liquid color, then tap a destination tube to pour."
      headerActions={headerControls}
      footerStatus={
        isWon
          ? `Brilliant! You sorted all liquid colors in ${moveCount} moves and ${formatTime(seconds)}!`
          : hintMove
          ? "💡 Tap highlighted target tube to pour (or tap Hint again to auto-pour)"
          : selectedId
          ? "Select a destination tube to pour liquid into"
          : undefined
      }
      footerSolved={isWon}
      isDark={isDark}
      compact={compact}
      hintDurationMs={compact ? 1800 : undefined}
      className={
        compact
          ? "!h-full !min-h-0 gap-1 p-0"
          : hasTower
          ? "!h-full !min-h-0"
          : undefined
      }
    >
      <div
        ref={stageRef}
        className={`flex w-full flex-col items-center justify-between select-none rounded-3xl relative overflow-hidden transition-colors duration-300 ${
          compact
            ? "h-full min-h-0 px-2 py-1"
            : hasTower
            ? "h-full min-h-0 p-2 sm:p-4"
            : "min-h-[580px] p-3 sm:p-6"
        } ${
          isDark
            ? `${surfaceClass(isDark)} text-white`
            : "bg-transparent text-slate-900 border-none shadow-none"
        }`}
      >
        {/* Ambient Glow Orbs (Dark Mode Only) */}
        {isDark && (
          <>
            <div className="pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-indigo-600/15 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-purple-600/15 blur-[100px]" />
          </>
        )}

        {/* Interactive SVG Hint Trajectory Curved Motion Arrow */}
        {hintMove && !pouringInfo && (() => {
          const srcEl = bottleRefs.current[hintMove.from];
          const tgtEl = bottleRefs.current[hintMove.to];
          const stageRect = stageRef.current?.getBoundingClientRect();

          if (srcEl && tgtEl && stageRect) {
            const sRect = srcEl.getBoundingClientRect();
            const tRect = tgtEl.getBoundingClientRect();

            const startX = sRect.left + sRect.width / 2 - stageRect.left;
            const startY = sRect.top + 20 - stageRect.top;
            const endX = tRect.left + tRect.width / 2 - stageRect.left;
            const endY = tRect.top + 20 - stageRect.top;

            const isRight = endX >= startX;
            const controlX = (startX + endX) / 2 + (isRight ? 18 : -18);
            const controlY = Math.min(startY, endY) - 50;
            const path = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

            return (
              <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="liquid-hint-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#34D399" />
                  </linearGradient>
                </defs>

                {/* Outer Glow Line */}
                <motion.path
                  d={path}
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="10"
                  strokeLinecap="round"
                  style={{ filter: "blur(5px)" }}
                  opacity="0.6"
                />

                {/* Animated Dashed Trajectory Line */}
                <motion.path
                  d={path}
                  fill="none"
                  stroke="url(#liquid-hint-grad)"
                  strokeWidth="4"
                  strokeDasharray="8 6"
                  animate={{ strokeDashoffset: [-28, 0] }}
                  transition={{ repeat: Infinity, duration: 0.35, ease: "linear" }}
                />

                {/* Source Tube Start Bulb */}
                <circle cx={startX} cy={startY} r="6" fill="#818CF8" className="animate-pulse" />

                {/* Destination Target Pulsing Ring */}
                <g transform={`translate(${endX}, ${endY})`}>
                  <motion.circle
                    r="22"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="3.5"
                    initial={{ scale: 0.8, opacity: 0.9 }}
                    animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.9, 0.3, 0.9] }}
                    transition={{ repeat: Infinity, duration: 0.7 }}
                  />
                  <circle r="7" fill="#34D399" />
                </g>
              </svg>
            );
          }
          return null;
        })()}

        {/* Parabolic Liquid Pour Stream & Spout Meniscus SVG Overlay */}
        {pouringInfo && (() => {
          const sourceEl = bottleRefs.current[pouringInfo.sourceId];
          const targetSvg = bottleSvgRefs.current[pouringInfo.targetId];
          const stageRect = stageRef.current?.getBoundingClientRect();
          const isRight = pouringInfo.isRight;

          // Safari does not consistently include an HTML ancestor's animated CSS transform
          // in SVG getScreenCTM(). Apply the wrapper's computed CSS matrix ourselves so the
          // stream follows the lip identically in Safari, Chrome and installed PWA mode.
          const sourceMatrix = sourceEl
            ? parseCssTransform(window.getComputedStyle(sourceEl).transform)
            : null;
          const liveSourceLip = sourceMatrix && stageRect
            ? transformedLayoutPoint(
                stageRect.left + pouringInfo.sourceBaseX,
                stageRect.top + pouringInfo.sourceBaseY,
                pouringInfo.sourceLipX,
                pouringInfo.sourceLipY,
                pouringInfo.sourceOriginX,
                pouringInfo.sourceOriginY,
                sourceMatrix
              )
            : null;
          const targetViewBoxHeight = targetSvg?.viewBox.baseVal.height || 240;
          const liveTargetMouth = targetSvg && stageRect
            ? bottleViewBoxPoint(targetSvg.getBoundingClientRect(), 50, 10, targetViewBoxHeight)
            : null;
          const liveTargetMouthLeft = targetSvg && stageRect
            ? bottleViewBoxPoint(targetSvg.getBoundingClientRect(), 35, 10, targetViewBoxHeight)
            : null;
          const liveTargetMouthRight = targetSvg && stageRect
            ? bottleViewBoxPoint(targetSvg.getBoundingClientRect(), 65, 10, targetViewBoxHeight)
            : null;
          const startX = liveSourceLip
            ? liveSourceLip.x - stageRect!.left
            : pouringInfo.streamX;
          const startY = liveSourceLip
            ? liveSourceLip.y - stageRect!.top
            : pouringInfo.streamY;
          const endX = liveTargetMouth
            ? liveTargetMouth.x - stageRect!.left
            : pouringInfo.targetMouthX;
          const endY = liveTargetMouth
            ? liveTargetMouth.y - stageRect!.top
            : pouringInfo.targetMouthY;

          // A compact gravity arc connects the pouring lip directly to the receiving lip.
          const arcControlX = (startX + endX) / 2 + (isRight ? 2 : -2);
          const arcControlY = startY + Math.max(7, (endY - startY) * 0.58);
          const parabolicPath = `M ${startX} ${startY} Q ${arcControlX} ${arcControlY} ${endX} ${endY}`;

          const color = COLOR_PALETTE[pouringInfo.colorKey] || COLOR_PALETTE.cyan;

          return (
            <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
              <defs>
                <linearGradient id="stream-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={color.glow} stopOpacity="1" />
                  <stop offset="100%" stopColor={color.fill} stopOpacity="0.95" />
                </linearGradient>
              </defs>

              {/* Ambient Glow Stream Underlay */}
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                d={parabolicPath}
                fill="none"
                stroke={color.glow}
                strokeWidth="14"
                strokeLinecap="round"
                style={{ filter: "blur(6px)" }}
              />

              {/* Tapered Accelerating Liquid Core Jet Stream */}
              <motion.path
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                d={parabolicPath}
                fill="none"
                stroke="url(#stream-gradient)"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Liquid Spout Lip Meniscus Bulb */}
              <circle
                cx={startX}
                cy={startY}
                r="5.5"
                fill={color.glow}
                className="animate-pulse"
              />

              {/* Flow Velocity Ripples */}
              <motion.path
                d={parabolicPath}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeDasharray="8 12"
                animate={{ strokeDashoffset: [-30, 0] }}
                transition={{ repeat: Infinity, duration: 0.2, ease: "linear" }}
                opacity="0.8"
              />

              {/* Foreground mouth rim: the jet passes behind this near glass edge. */}
              {liveTargetMouthLeft && liveTargetMouthRight && stageRect && (
                <line
                  x1={liveTargetMouthLeft.x - stageRect.left}
                  y1={liveTargetMouthLeft.y - stageRect.top}
                  x2={liveTargetMouthRight.x - stageRect.left}
                  y2={liveTargetMouthRight.y - stageRect.top}
                  stroke={isDark ? "#475569" : "#64748B"}
                  strokeWidth={Math.max(
                    1.5,
                    (Math.hypot(
                      liveTargetMouthRight.x - liveTargetMouthLeft.x,
                      liveTargetMouthRight.y - liveTargetMouthLeft.y
                    ) / 30) * 2.5
                  )}
                  strokeLinecap="round"
                />
              )}

              {/* Target Water Splash Ellipse Ring */}
              <motion.ellipse
                initial={{ rx: 3, ry: 1.5, opacity: 0 }}
                animate={{ rx: [3, 14, 18], ry: [1.5, 5, 7], opacity: [0.9, 0.6, 0] }}
                transition={{ repeat: Infinity, duration: 0.35, ease: "easeOut" }}
                cx={endX}
                cy={endY}
                fill="none"
                stroke={color.glow}
                strokeWidth="2.5"
              />

              {/* Dynamic Impact Splash Droplets */}
              {splashes.map((s) => (
                <circle
                  key={s.id}
                  cx={s.x}
                  cy={s.y}
                  r={Math.max(1, s.life * 3)}
                  fill={s.color}
                  opacity={s.life}
                />
              ))}
            </svg>
          );
        })()}

        {/* Responsive Bottles Grid Stage */}
        <div
          className={`z-10 my-auto grid w-full justify-items-center ${
            compact ? "translate-y-4 gap-3 py-1" : "gap-3 py-6 sm:gap-6"
          } ${hasTower ? "h-full min-h-0 grid-rows-2" : ""} ${
            hasTower
              ? compact
                ? "grid-cols-6 max-w-md"
                : "grid-cols-6 max-w-4xl"
              : compact
              ? bottles.length <= 5
                ? "grid-cols-5 max-w-sm"
                : "grid-cols-6 max-w-md"
              : getGridColsClass(bottles.length)
          }`}
        >
          {bottles.map((bottle) => {
            const isTower = bottle.isTower === true;
            const isSelected = selectedId === bottle.id;
            const isPouring = pouringInfo?.sourceId === bottle.id;
            const isHintSrc = hintMove?.from === bottle.id;
            const isHintTgt = hintMove?.to === bottle.id;
            const isComplete =
              bottle.layers.length === bottle.capacity &&
              bottle.layers.every(
                (l) => l.colorKey === bottle.layers[0].colorKey && !l.hidden
              );

            const rotationAngle = isPouring ? (pouringInfo.isRight ? 72 : -72) : 0;
            const bodyEnd = isTower ? 420 : 220;
            const bottleBottom = isTower ? 435 : 235;
            const viewBoxHeight = isTower ? 440 : 240;
            const bottlePath = `M 35 10 H 65 V 35 L 85 70 V ${bodyEnd} C 85 ${bodyEnd + 10} 75 ${bottleBottom} 50 ${bottleBottom} C 25 ${bottleBottom} 15 ${bodyEnd + 10} 15 ${bodyEnd} V 70 L 35 35 Z`;

            return (
              <motion.div
                key={bottle.id}
                ref={(el) => {
                  bottleRefs.current[bottle.id] = el;
                }}
                onClick={() => handleBottleClick(bottle.id)}
                animate={
                  isPouring
                    ? {
                        x: pouringInfo.deltaX,
                        y: pouringInfo.deltaY,
                        rotate: rotationAngle,
                      }
                    : isSelected
                    ? { x: 0, y: compact ? -10 : -26, rotate: 0 }
                    : isHintSrc || isHintTgt
                    ? { y: [-4, 4, -4] }
                    : { x: 0, y: 0, rotate: 0 }
                }
                style={{
                  transformOrigin: "50% 15px",
                }}
                transition={
                  isHintSrc || isHintTgt
                    ? { repeat: Infinity, duration: 0.6 }
                    : { type: "spring", stiffness: 320, damping: 22 }
                }
                className={`relative flex flex-col items-center cursor-pointer ${
                  isSelected || isPouring ? "z-20" : "z-10"
                } ${
                  hasTower
                    ? isTower
                      ? "col-start-3 row-start-1 row-span-2 h-full min-h-0 w-full self-center"
                      : "h-full min-h-0 w-full self-center"
                    : ""
                }`}
              >
                {/* Target Bottle 'POUR HERE 🎯' Floating Badge */}
                {isHintTgt && (
                  <motion.div
                    initial={{ scale: 0, y: -10 }}
                    animate={{ scale: [0.9, 1.1, 0.9], y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6 }}
                    className="absolute -top-6 z-30 bg-emerald-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-emerald-300 flex items-center gap-1"
                  >
                    <span>POUR HERE 🎯</span>
                  </motion.div>
                )}
                {/* Hint Glowing Pulse Highlight */}
                {(isHintSrc || isHintTgt) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.08, 0.95] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className={`absolute -inset-2 rounded-3xl ${
                      isHintSrc
                        ? "bg-amber-400/30 ring-2 ring-amber-400"
                        : "bg-emerald-400/30 ring-2 ring-emerald-400"
                    }`}
                  />
                )}

                {/* SVG Glass Bottle Container */}
                <svg
                  ref={(el) => {
                    bottleSvgRefs.current[bottle.id] = el;
                  }}
                  viewBox={`0 0 100 ${viewBoxHeight}`}
                  className={
                    isTower
                      ? compact
                        ? "h-full max-h-[268px] w-full max-w-14 drop-shadow-xl"
                        : "h-full max-h-[472px] w-full max-w-16 drop-shadow-2xl sm:max-w-24"
                      : hasTower
                      ? compact
                        ? "h-full max-h-32 w-full max-w-14 drop-shadow-md"
                        : "h-full max-h-44 w-full max-w-16 drop-shadow-xl sm:max-h-56 sm:max-w-24"
                      : compact
                      ? "h-32 w-14 drop-shadow-md"
                      : "h-44 w-16 drop-shadow-xl sm:h-56 sm:w-24"
                  }
                >
                  <defs>
                    <clipPath id={`clip-${bottle.id}`}>
                      <path d={bottlePath} />
                    </clipPath>
                    <linearGradient id={`glass-${bottle.id}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={isDark ? "#94A3B8" : "#CBD5E1"} stopOpacity="0.34" />
                      <stop offset="18%" stopColor="#FFFFFF" stopOpacity="0.2" />
                      <stop offset="52%" stopColor="#FFFFFF" stopOpacity="0.04" />
                      <stop offset="82%" stopColor={isDark ? "#334155" : "#94A3B8"} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={isDark ? "#0F172A" : "#64748B"} stopOpacity="0.34" />
                    </linearGradient>
                    <linearGradient id={`sheen-${bottle.id}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
                      <stop offset="16%" stopColor="#FFFFFF" stopOpacity="0.12" />
                      <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0" />
                      <stop offset="78%" stopColor="#0F172A" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#0F172A" stopOpacity="0.2" />
                    </linearGradient>
                    {Object.entries(COLOR_PALETTE).map(([key, palette]) => (
                      <linearGradient key={key} id={`liquid-${bottle.id}-${key}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={palette.stroke} />
                        <stop offset="16%" stopColor={palette.fill} />
                        <stop offset="48%" stopColor={palette.glow} />
                        <stop offset="76%" stopColor={palette.fill} />
                        <stop offset="100%" stopColor={palette.stroke} />
                      </linearGradient>
                    ))}
                    <linearGradient id={`liquid-${bottle.id}-mystery`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={isDark ? "#1E293B" : "#94A3B8"} />
                      <stop offset="48%" stopColor={isDark ? "#64748B" : "#E2E8F0"} />
                      <stop offset="100%" stopColor={isDark ? "#1E293B" : "#94A3B8"} />
                    </linearGradient>
                  </defs>

                  {/* Ground and glass volume create the dimensional bottle silhouette. */}
                  <ellipse cx="51" cy={bottleBottom - 1} rx="31" ry="5" fill="#0F172A" opacity={isDark ? "0.28" : "0.13"} />
                  <path
                    d={bottlePath}
                    fill={`url(#glass-${bottle.id})`}
                  />

                  {/* Inner Stacked Liquid Layers */}
                  <g clipPath={`url(#clip-${bottle.id})`}>
                    <AnimatePresence>
                      {bottle.layers.map((layer, index) => {
                        const isTop = index === bottle.layers.length - 1;
                        return renderLiquidLayerPath(bottle, layer, index, isTop);
                      })}
                    </AnimatePresence>

                    {/* Buoyancy Air Bubbles */}
                    {bubbles
                      .filter((b) => b.bottleId === bottle.id)
                      .map((b) => (
                        <g key={b.id} opacity={b.alpha}>
                          <circle
                            cx={b.x}
                            cy={b.y}
                            r={b.size}
                            fill="rgba(255, 255, 255, 0.45)"
                            stroke="rgba(255, 255, 255, 0.8)"
                            strokeWidth="0.8"
                          />
                          <circle
                            cx={b.x - b.size * 0.3}
                            cy={b.y - b.size * 0.3}
                            r={b.size * 0.35}
                            fill="white"
                          />
                        </g>
                      ))}

                    {/* A translucent side-to-side sheen unifies glass and liquid. */}
                    <rect x="12" y="8" width="76" height={bottleBottom - 7} fill={`url(#sheen-${bottle.id})`} />
                  </g>

                  {/* Glass Highlights */}
                  <path
                    d={`M 22 75 V ${bodyEnd - 5} C 22 ${bodyEnd + 2} 28 ${bottleBottom - 8} 34 ${bottleBottom - 8}`}
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity={isDark ? "0.3" : "0.55"}
                  />
                  <path
                    d={`M 73 72 V ${bodyEnd - 4} C 73 ${bodyEnd + 4} 68 ${bottleBottom - 7} 61 ${bottleBottom - 5}`}
                    fill="none"
                    stroke={isDark ? "#0F172A" : "#475569"}
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity={isDark ? "0.32" : "0.18"}
                  />
                  <ellipse
                    cx="50"
                    cy={bodyEnd + 2}
                    rx="29"
                    ry="9"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    opacity={isDark ? "0.16" : "0.3"}
                  />

                  {/* Outer Contour */}
                  <path
                    d={bottlePath}
                    fill="none"
                    stroke={
                      isHintSrc
                        ? "#F59E0B"
                        : isHintTgt
                        ? "#10B981"
                        : isSelected || isPouring
                        ? "#818CF8"
                        : isDark
                        ? "#475569"
                        : "#64748B"
                    }
                    strokeWidth={isSelected || isPouring || isHintSrc || isHintTgt ? "4" : "2.5"}
                  />

                  {/* Cork for Solved Bottle */}
                  {isComplete && (
                    <path
                      d="M 38 2 H 62 V 12 H 38 Z"
                      fill="#B45309"
                      stroke="#78350F"
                      strokeWidth="2"
                    />
                  )}
                </svg>

                {/* Solved Star Check Badge */}
                {isComplete && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-900 shadow-lg"
                  >
                    <Check size={16} strokeWidth={3} />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

      </div>
      <Celebration show={isWon} />
    </SharedCanvasLayout>
  );
};
