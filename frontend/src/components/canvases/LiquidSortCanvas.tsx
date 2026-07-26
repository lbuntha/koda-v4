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
  LIQUID_SORT_CURRICULUM_LEVELS,
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

/**
 * BFS Solver Algorithm to calculate the next optimal move
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
  const queue: StateNode[] = [{ bottles: initialBottles }];
  visited.add(stateKey(initialBottles));

  let iterations = 0;
  while (queue.length > 0 && iterations < 1500) {
    iterations++;
    const current = queue.shift()!;

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
            queue.push({ bottles: nextBottles, firstMove });
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
  } | null>(null);

  const [pourProgress, setPourProgress] = useState(0);
  const pourStartTimeRef = useRef<number | null>(null);

  // Bottle DOM element refs
  const bottleRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
          const newBubble: BuoyantBubble = {
            id: Math.random(),
            bottleId: pouringInfo.targetId,
            x: 50 + (Math.random() - 0.5) * 36,
            y: 215,
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
            x: pouringInfo.streamX + (Math.random() - 0.5) * 16,
            y: pouringInfo.streamY + 140,
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
        onAttempt("correct", {
          expected: selectedLevelId,
          selected: selectedLevelId,
          details: {
            levelId: selectedLevelId,
            moveCount,
            seconds,
            stars: calculateStars(),
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

        if (sourceEl && targetEl) {
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();
          const stageRect = stageRef.current?.getBoundingClientRect();

          isRight = tRect.left >= sRect.left;
          const scale = sRect.width / 100;

          // Un-rotated pivot of source bottle in Stage space
          const sourcePivotX = sRect.left + sRect.width / 2;
          const sourcePivotY = sRect.top + 15 * scale;

          // Target mouth entry point: hover 28px ABOVE and slightly to side of target mouth rim
          const targetMouthX = tRect.left + (isRight ? -8 * scale : tRect.width + 8 * scale);
          const targetMouthY = tRect.top - 28 * scale;

          // Rotated 2D offset of source mouth rim lip when tilted by 72deg
          const tiltAngle = 72;
          const rad = (isRight ? tiltAngle : -tiltAngle) * (Math.PI / 180);
          const localLipX = isRight ? 65 : 35;
          const localLipY = 10;
          const dx = (localLipX - 50) * scale;
          const dy = (localLipY - 15) * scale;

          const lipRotatedOffsetX = dx * Math.cos(rad) - dy * Math.sin(rad);
          const lipRotatedOffsetY = dx * Math.sin(rad) + dy * Math.cos(rad);

          // Exact deltaX & deltaY so tilted bottle mouth lip hovers gracefully above target bottle
          deltaX = targetMouthX - sourcePivotX - lipRotatedOffsetX;
          deltaY = targetMouthY - sourcePivotY - lipRotatedOffsetY;

          streamX = targetMouthX - (stageRect?.left || 0);
          streamY = targetMouthY - (stageRect?.top || 0);
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
        if (onAttempt) {
          onAttempt("incorrect", {
            expected: topSourceColor,
            selected: topTargetColor,
            details: {
              levelId: selectedLevelId,
              reason: target.layers.length >= target.capacity ? "bottle_full" : "mismatched_color",
            },
          });
        }
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
            layers: b.layers.map((l) => ({ ...l })),
          }))
        : loadLevelBottles(lvl);

    setBottles(freshBottles);
    setHistory([]);
    setSelectedId(null);
    setIsWon(false);
    setMoveCount(0);
    setSeconds(0);
    setHintMove(null);
    setPouringInfo(null);
    sounds.playPop();
  };

  const handleAddBottle = () => {
    if (bottles.length >= 10 || isWon || pouringInfo) return;
    setBottles((prev) => [
      ...prev,
      { id: `b_extra_${Date.now()}`, layers: [], capacity: 4 },
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

    const isSourcePouring = pouringInfo?.sourceId === bottle.id;
    const isTargetPouring = pouringInfo?.targetId === bottle.id;

    const segmentHeight = 160 / bottle.capacity;
    const yBottom = 235 - index * segmentHeight;

    // Fluid height recession for source bottle & rising height for target bottle
    let effectiveYTop = 235 - (index + 1) * segmentHeight;

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
            fill={color.fill}
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
          fill={color.fill}
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
    `flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-40 ${
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
    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
      <div className={btnPill("neutral")}>
        <span className={isDark ? "text-slate-400" : "text-slate-500"}>Moves:</span>
        <span className={isDark ? "text-indigo-400 font-extrabold" : "text-indigo-600 font-extrabold"}>
          {moveCount}
        </span>
      </div>

      <div className={btnPill("cyan")}>
        <Timer size={14} className={isDark ? "text-cyan-400" : "text-slate-500"} />
        <span>{formatTime(seconds)}</span>
      </div>

      <button
        type="button"
        onClick={handleGetHint}
        disabled={pouringInfo !== null || isWon}
        className={btnPill("indigo")}
      >
        <Lightbulb size={14} className={isDark ? "text-indigo-300" : "text-indigo-600"} /> Hint
      </button>

      <button
        type="button"
        onClick={handleUndo}
        disabled={history.length === 0 || pouringInfo !== null}
        className={btnPill("neutral")}
      >
        <RotateCcw size={14} /> Undo
      </button>

      <button
        type="button"
        onClick={handleReset}
        disabled={pouringInfo !== null}
        className={btnPill("neutral")}
      >
        <RotateCw size={14} /> Reset
      </button>

      <button
        type="button"
        onClick={handleAddBottle}
        disabled={bottles.length >= 10 || pouringInfo !== null}
        className={btnPill("indigo")}
      >
        <Plus size={14} /> Tube
      </button>
    </div>
  );

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      headerTitle={question.title || "Liquid Color Sort"}
      headerSubtitle={(question as any).subtitle || `${currentLevel.name} (${currentLevel.targetCount} Tubes)`}
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
    >
      <div
        ref={stageRef}
        className={`flex min-h-[580px] w-full flex-col items-center justify-between p-3 sm:p-6 select-none rounded-3xl relative overflow-hidden transition-colors duration-300 ${
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
          const target = bottles.find((b) => b.id === pouringInfo.targetId);
          const targetCapacity = target ? target.capacity : 4;
          const initialFillCount = target ? target.layers.length : 0;
          const currentFillCount = initialFillCount + pouringInfo.transferCount * pourProgress;

          const targetEl = bottleRefs.current[pouringInfo.targetId];
          const stageRect = stageRef.current?.getBoundingClientRect();
          const tRect = targetEl ? targetEl.getBoundingClientRect() : null;

          const isRight = pouringInfo.isRight;
          const scale = tRect ? tRect.width / 100 : 0.96;

          const tLeft = tRect && stageRect ? tRect.left - stageRect.left : 0;
          const tTop = tRect && stageRect ? tRect.top - stageRect.top : 0;
          const targetCenterX = tLeft + (tRect ? tRect.width / 2 : 48);

          const segmentHeight = 160 / targetCapacity;
          const landingY = tTop + (235 - currentFillCount * segmentHeight) * scale;

          const startX = pouringInfo.streamX;
          const startY = pouringInfo.streamY;
          const endX = targetCenterX;
          const endY = landingY;

          // Parabolic jet flow arc control point
          const arcControlX = (startX + endX) / 2 + (isRight ? 14 : -14);
          const arcControlY = startY + Math.max(20, (endY - startY) * 0.4);
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
          className={`z-10 my-auto grid w-full gap-3 sm:gap-6 py-6 justify-items-center ${getGridColsClass(
            bottles.length
          )}`}
        >
          {bottles.map((bottle) => {
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
                    ? { x: 0, y: -26, rotate: 0 }
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
                <svg viewBox="0 0 100 240" className="h-44 sm:h-56 w-16 sm:w-24 drop-shadow-xl">
                  <defs>
                    <clipPath id={`clip-${bottle.id}`}>
                      <path d="M 35 10 H 65 V 35 L 85 70 V 220 C 85 230 75 235 50 235 C 25 235 15 230 15 220 V 70 L 35 35 Z" />
                    </clipPath>
                  </defs>

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
                  </g>

                  {/* Glass Highlights */}
                  <path
                    d="M 22 75 V 215 C 22 222 28 227 34 227"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity={isDark ? "0.3" : "0.55"}
                  />

                  {/* Outer Contour */}
                  <path
                    d="M 35 10 H 65 V 35 L 85 70 V 220 C 85 230 75 235 50 235 C 25 235 15 230 15 220 V 70 L 35 35 Z"
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
