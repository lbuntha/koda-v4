/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Harvest Crop Sort Game Canvas Component for Koda Platform.
 * Features 3D Pixar Farm visual design, Interactive Mascot Guide (Koda Reactions & Speech),
 * Multi-Stage Progressive Levels (Levels 1 to 5), 3-Star Level Completion Rewards,
 * GPU CSS Compositor Motion Engine (100% Smooth 60-120 FPS Motion), Dotted Arc Trajectory,
 * Matter.js 2D Rigid Body Physics & 100% Fluid Responsive Layout across all screen sizes.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import Matter from "matter-js";
import { CanvasProps } from "./types";
import { sounds } from "../../sound";
import {
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  HelpCircle,
  X,
  Flame,
  Sprout,
  Lightbulb,
  ChevronRight,
  Star,
  Award,
  Check,
} from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { Celebration } from "./Celebration";
import {
  HARVEST_CURRICULUM_LEVELS,
  PRODUCE_DICTIONARY,
  CRATE_DEFINITIONS,
  ProduceItem,
  ProduceCategory,
  CurriculumLevel,
} from "./harvestSortLevels";

interface ConveyorCrop {
  id: string;
  item: ProduceItem;
  delaySec: number;
}

interface FlyingCrop {
  id: string;
  emoji: string;
  name: string;
  category: ProduceCategory;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  arcHeight: number;
  rotation: number;
  vRot: number;
  color: string;
  xp: number;
  cropId: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  emoji?: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vRot: number;
}

interface FloatingPopup {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  type: "score" | "combo" | "error" | "missed";
}

interface DraggingCrop {
  crop: ConveyorCrop;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

type MascotMood = "idle" | "happy" | "oops" | "victory";

/**
 * Global Memory Cache for Processed Transparent Images.
 */
const transparentImageCache = new Map<string, string>();

/**
 * High-Performance 3D Image Component with Runtime Canvas White Background Stripping.
 */
const Transparent3DImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [cleanSrc, setCleanSrc] = useState<string | null>(transparentImageCache.get(src) || null);

  useEffect(() => {
    if (transparentImageCache.has(src)) {
      setCleanSrc(transparentImageCache.get(src)!);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Key out all white/light-gray background pixels
          if (r > 200 && g > 200 && b > 200) {
            const avg = (r + g + b) / 3.0;
            const alpha = Math.max(0, Math.floor(255 - (avg - 200) * 7.5));
            data[i + 3] = alpha;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const transparentDataUrl = canvas.toDataURL("image/png");
        transparentImageCache.set(src, transparentDataUrl);
        if (isMounted) setCleanSrc(transparentDataUrl);
      } catch (err) {
        console.warn("Image background keying fallback", err);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [src]);

  return <img src={cleanSrc || src} alt={alt} className={className} />;
};

/**
 * 100% Transparent 3D Vector Farm Bin SVG Component
 */
/**
 * /**
 * Master 3D Isometric SVG Farm Bin Component based on Master 3D Crate Specification.
 * Renders fruits/produce INSIDE the 3D crate cavity between interior back wall and front slats.
 */
const Vector3DFarmBin: React.FC<{
  category: ProduceCategory;
  label: string;
  isTarget: boolean;
  contents: string[];
}> = ({ category, label, isTarget, contents }) => {
  // Category-specific 3D Wood Palette Configurations
  const palettes: Record<ProduceCategory, {
    topStart: string; topEnd: string;
    frontStart: string; frontMid: string; frontEnd: string;
    sideStart: string; sideEnd: string;
    innerStart: string; innerEnd: string;
    floorStart: string; floorEnd: string;
    badgeBg: string; badgeBorder: string; badgeText: string;
    badgeLabel: string;
  }> = {
    fruits: {
      topStart: "#FECACA", topEnd: "#FCA5A5",
      frontStart: "#EF4444", frontMid: "#DC2626", frontEnd: "#991B1B",
      sideStart: "#991B1B", sideEnd: "#7F1D1D",
      innerStart: "#581C1C", innerEnd: "#360A0A",
      floorStart: "#450A0A", floorEnd: "#230303",
      badgeBg: "#FEE2E2", badgeBorder: "#EF4444", badgeText: "#991B1B",
      badgeLabel: "FRUIT 🍎",
    },
    vegetables: {
      topStart: "#BBF7D0", topEnd: "#86EFAC",
      frontStart: "#22C55E", frontMid: "#16A34A", frontEnd: "#15803D",
      sideStart: "#15803D", sideEnd: "#14532D",
      innerStart: "#14532D", innerEnd: "#0A2916",
      floorStart: "#052E16", floorEnd: "#02170B",
      badgeBg: "#DCFCE7", badgeBorder: "#22C55E", badgeText: "#14532D",
      badgeLabel: "VEGGIES 🥕",
    },
    compost: {
      topStart: "#FDE68A", topEnd: "#FCD34D",
      frontStart: "#D97706", frontMid: "#B45309", frontEnd: "#78350F",
      sideStart: "#78350F", sideEnd: "#451A03",
      innerStart: "#451A03", innerEnd: "#270B02",
      floorStart: "#270B02", floorEnd: "#120401",
      badgeBg: "#FEF3C7", badgeBorder: "#D97706", badgeText: "#78350F",
      badgeLabel: "COMPOST ♻️",
    },
    berries: {
      topStart: "#F5D0FE", topEnd: "#E9D5FF",
      frontStart: "#C084FC", frontMid: "#A855F7", frontEnd: "#7E22CE",
      sideStart: "#7E22CE", sideEnd: "#581C87",
      innerStart: "#3B0764", innerEnd: "#1E0336",
      floorStart: "#2E1065", floorEnd: "#13052B",
      badgeBg: "#F3E8FF", badgeBorder: "#A855F7", badgeText: "#581C87",
      badgeLabel: "BERRIES 🫐",
    },
    nuts: {
      topStart: "#FEF08A", topEnd: "#FDE047",
      frontStart: "#EAB308", frontMid: "#CA8A04", frontEnd: "#854D0E",
      sideStart: "#854D0E", sideEnd: "#543007",
      innerStart: "#543007", innerEnd: "#331C03",
      floorStart: "#422006", floorEnd: "#1F0F02",
      badgeBg: "#FEF9C3", badgeBorder: "#EAB308", badgeText: "#713F12",
      badgeLabel: "GRAINS 🌾",
    },
  };

  const p = palettes[category] || palettes.fruits;
  const uid = category;

  // Master 3D Isometric Fruit Slot Positions (Matching User's Master SVG Specification)
  const slotPositions = [
    { x: 200, y: 240, r: 42, scale: 0.9 },  // Front Left Slot
    { x: 280, y: 260, r: 44, scale: 0.95 }, // Front Center Slot
    { x: 370, y: 250, r: 42, scale: 0.9 },  // Front Right Slot
    { x: 250, y: 210, r: 38, scale: 0.82 }, // Back Left Slot
    { x: 340, y: 200, r: 40, scale: 0.85 }, // Back Right Slot
    { x: 290, y: 180, r: 40, scale: 0.8 },  // Back Center Slot
    { x: 360, y: 210, r: 38, scale: 0.8 },  // Back Edge Slot
  ];

  return (
    <svg viewBox="0 0 600 500" className="w-full h-full pointer-events-none overflow-visible">
      <defs>
        {/* Drop Shadow & Soft Glow Filters */}
        <filter id={`drop-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="12" floodColor="#2D1B0E" floodOpacity="0.3" />
        </filter>

        <filter id={`soft-shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" />
          <feOffset dx="0" dy="10" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Dynamic 3D Wood Gradients */}
        <linearGradient id={`wood-top-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.topStart} />
          <stop offset="100%" stopColor={p.topEnd} />
        </linearGradient>

        <linearGradient id={`wood-front-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.frontStart} />
          <stop offset="50%" stopColor={p.frontMid} />
          <stop offset="100%" stopColor={p.frontEnd} />
        </linearGradient>

        <linearGradient id={`wood-side-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.sideStart} />
          <stop offset="100%" stopColor={p.sideEnd} />
        </linearGradient>

        <linearGradient id={`wood-inner-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.innerStart} />
          <stop offset="100%" stopColor={p.innerEnd} />
        </linearGradient>

        <linearGradient id={`wood-floor-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.floorStart} />
          <stop offset="100%" stopColor={p.floorEnd} />
        </linearGradient>

        {/* Metallic Brass Fasteners */}
        <linearGradient id={`metal-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#CA8A04" />
          <stop offset="100%" stopColor="#854D0E" />
        </linearGradient>
      </defs>

      {/* Ground Shadow */}
      <ellipse cx="300" cy="420" rx="210" ry="45" fill="#000000" opacity="0.25" filter="blur(10px)" />

      <g filter={`url(#drop-shadow-${uid})`}>
        {/* 1. BIN INTERIOR (BACK WALLS) */}
        <polygon points="120,220 300,130 480,220 480,260 300,170 120,260" fill={`url(#wood-inner-${uid})`} />

        {/* INTERIOR SLAT SEPARATORS */}
        <line x1="120" y1="233" x2="300" y2="143" stroke="#120602" strokeWidth="3" opacity="0.6" />
        <line x1="120" y1="246" x2="300" y2="156" stroke="#120602" strokeWidth="3" opacity="0.6" />
        <line x1="300" y1="143" x2="480" y2="233" stroke="#120602" strokeWidth="3" opacity="0.6" />
        <line x1="300" y1="156" x2="480" y2="246" stroke="#120602" strokeWidth="3" opacity="0.6" />

        {/* INTERIOR FLOOR BASE */}
        <polygon points="120,260 300,170 480,260 300,350" fill={`url(#wood-floor-${uid})`} />

        {/* FLOOR SLAT LINES */}
        <line x1="165" y1="282.5" x2="345" y2="192.5" stroke="#000000" strokeWidth="2" opacity="0.8" />
        <line x1="210" y1="305" x2="390" y2="215" stroke="#000000" strokeWidth="2" opacity="0.8" />
        <line x1="255" y1="327.5" x2="435" y2="237.5" stroke="#000000" strokeWidth="2" opacity="0.8" />

        {/* 2. PRODUCE ITEMS STORED INSIDE CRATE CAVITY (LAYERED BEHIND FRONT SLATS!) */}
        <g id={`stored-produce-${uid}`}>
          {contents.slice(-7).map((itemEmoji, idx) => {
            const slot = slotPositions[idx % slotPositions.length];
            return (
              <g key={idx} transform={`translate(${slot.x}, ${slot.y}) scale(${slot.scale})`}>
                {/* Produce Shadow on Crate Floor */}
                <ellipse cx="0" cy="22" rx={slot.r} ry={slot.r * 0.35} fill="#000000" opacity="0.4" filter={`url(#soft-shadow-${uid})`} />
                {/* Produce 3D Emoji Icon */}
                <text
                  x="0"
                  y="12"
                  fontSize="68"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="filter drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)] select-none"
                >
                  {itemEmoji}
                </text>
              </g>
            );
          })}
        </g>

        {/* 3. BIN STRUCTURE (FRONT & SIDES - SLATTED CRATE DESIGN DRAWN ON TOP OF PRODUCE!) */}

        {/* CORNER POST - LEFT */}
        <polygon points="105,230 120,220 120,340 105,350" fill={`url(#wood-side-${uid})`} />
        <polygon points="120,220 135,230 135,350 120,340" fill={`url(#wood-front-${uid})`} />
        <polygon points="105,230 120,220 135,230 120,240" fill={`url(#wood-top-${uid})`} />

        {/* CORNER POST - RIGHT */}
        <polygon points="465,230 480,220 480,340 465,350" fill={`url(#wood-side-${uid})`} />
        <polygon points="480,220 495,230 495,350 480,340" fill={`url(#wood-front-${uid})`} />
        <polygon points="465,230 480,220 495,230 480,240" fill={`url(#wood-top-${uid})`} />

        {/* CORNER POST - CENTER FRONT */}
        <polygon points="285,320 300,310 300,430 285,440" fill={`url(#wood-side-${uid})`} />
        <polygon points="300,310 315,320 315,440 300,430" fill={`url(#wood-front-${uid})`} />
        <polygon points="285,320 300,310 315,320 300,330" fill={`url(#wood-top-${uid})`} />

        {/* SLAT 1 (TOP) - LEFT SIDE */}
        <polygon points="115,240 292,328 292,353 115,265" fill={`url(#wood-side-${uid})`} />
        <polygon points="115,235 292,323 292,328 115,240" fill={`url(#wood-top-${uid})`} />

        {/* SLAT 1 (TOP) - RIGHT SIDE */}
        <polygon points="308,328 485,240 485,265 308,353" fill={`url(#wood-front-${uid})`} />
        <polygon points="308,323 485,235 485,240 308,328" fill={`url(#wood-top-${uid})`} />

        {/* SLAT 2 (MIDDLE) - LEFT SIDE */}
        <polygon points="115,275 292,363 292,388 115,300" fill={`url(#wood-side-${uid})`} />
        <polygon points="115,270 292,358 292,363 115,275" fill={`url(#wood-top-${uid})`} />

        {/* SLAT 2 (MIDDLE) - RIGHT SIDE */}
        <polygon points="308,363 485,275 485,300 308,388" fill={`url(#wood-front-${uid})`} />
        <polygon points="308,358 485,270 485,275 308,363" fill={`url(#wood-top-${uid})`} />

        {/* SLAT 3 (BOTTOM) - LEFT SIDE */}
        <polygon points="115,310 292,398 292,423 115,335" fill={`url(#wood-side-${uid})`} />
        <polygon points="115,305 292,393 292,398 115,310" fill={`url(#wood-top-${uid})`} />

        {/* SLAT 3 (BOTTOM) - RIGHT SIDE */}
        <polygon points="308,398 485,310 485,335 308,423" fill={`url(#wood-front-${uid})`} />
        <polygon points="308,393 485,305 485,310 308,398" fill={`url(#wood-top-${uid})`} />

        {/* METAL CORNER BRACKETS / RIVETS */}
        <circle cx="125" cy="252" r="3.5" fill={`url(#metal-${uid})`} />
        <circle cx="125" cy="322" r="3.5" fill={`url(#metal-${uid})`} />

        <circle cx="296" cy="338" r="3.5" fill={`url(#metal-${uid})`} />
        <circle cx="304" cy="338" r="3.5" fill={`url(#metal-${uid})`} />
        <circle cx="296" cy="412" r="3.5" fill={`url(#metal-${uid})`} />
        <circle cx="304" cy="412" r="3.5" fill={`url(#metal-${uid})`} />

        <circle cx="475" cy="252" r="3.5" fill={`url(#metal-${uid})`} />
        <circle cx="475" cy="322" r="3.5" fill={`url(#metal-${uid})`} />

        {/* FRONT 3D ISOMETRIC BADGE */}
        <g transform="translate(380, 340) rotate(-26)">
          <rect
            x="-45"
            y="-14"
            width="90"
            height="28"
            rx="6"
            fill={p.badgeBg}
            stroke={p.badgeBorder}
            strokeWidth="2.5"
            filter={`url(#soft-shadow-${uid})`}
          />
          <text
            x="0"
            y="5"
            fontFamily="system-ui, sans-serif"
            fontSize="11"
            fontWeight="900"
            fill={p.badgeText}
            textAnchor="middle"
          >
            {p.badgeLabel}
          </text>
        </g>
      </g>
    </svg>
  );
};

export const HarvestSortCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  showGrid = false,
  isDark = false,
  compact = false,
  onCountUpdate,
  onSuccess,
  onAttempt,
}) => {
  const [levelIndex, setLevelIndex] = useState(0);
  const currentLevel: CurriculumLevel = HARVEST_CURRICULUM_LEVELS[levelIndex] || HARVEST_CURRICULUM_LEVELS[0];

  const targetCount = question?.targetCount || currentLevel.targetCount;
  const allowDrag = (question?.config as any)?.allowDrag ?? true;

  const [sortedCount, setSortedCount] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showLevelCompleteModal, setShowLevelCompleteModal] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);

  // Mascot Interactive State
  const [mascotMood, setMascotMood] = useState<MascotMood>("idle");
  const [mascotText, setMascotText] = useState("Where does it belong?");

  // Matter.js Physics Engine Ref
  const matterEngineRef = useRef<Matter.Engine | null>(null);

  // Crate contents storage
  const [crateContents, setCrateContents] = useState<Record<ProduceCategory, string[]>>({
    fruits: ["🍎", "🍊"],
    vegetables: ["🥕", "🥦"],
    nuts: [],
    berries: [],
    compost: ["🍂", "🍌"],
  });

  const getRandomProduce = useCallback(() => {
    const freshCandidates = PRODUCE_DICTIONARY.filter((p) =>
      currentLevel.activeCategories.includes(p.category)
    );
    return freshCandidates[Math.floor(Math.random() * freshCandidates.length)] || PRODUCE_DICTIONARY[0];
  }, [currentLevel.activeCategories]);

  // Conveyor Items
  const [conveyorItems, setConveyorItems] = useState<ConveyorCrop[]>([
    { id: "item-0", item: getRandomProduce(), delaySec: 0 },
    { id: "item-1", item: getRandomProduce(), delaySec: 2.2 },
    { id: "item-2", item: getRandomProduce(), delaySec: 4.4 },
    { id: "item-3", item: getRandomProduce(), delaySec: 6.6 },
  ]);

  const [flyingCrops, setFlyingCrops] = useState<FlyingCrop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [pulsingCrate, setPulsingCrate] = useState<ProduceCategory | null>(null);
  const [floatingPopups, setFloatingPopups] = useState<FloatingPopup[]>([]);
  const [draggingCrop, setDraggingCrop] = useState<DraggingCrop | null>(null);
  const [hintActive, setHintActive] = useState<boolean>(false);

  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const crateRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardSlotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const particlesRef = useRef<Particle[]>([]);
  const landedCropIdsRef = useRef<Set<string>>(new Set());

  // Reset level state when level changes
  useEffect(() => {
    setSortedCount(0);
    setMascotMood("idle");
    setMascotText(currentLevel.description);
    setConveyorItems([
      { id: "item-0", item: getRandomProduce(), delaySec: 0 },
      { id: "item-1", item: getRandomProduce(), delaySec: 2.2 },
      { id: "item-2", item: getRandomProduce(), delaySec: 4.4 },
      { id: "item-3", item: getRandomProduce(), delaySec: 6.6 },
    ]);
  }, [levelIndex, getRandomProduce, currentLevel.description]);

  // Initialize Matter.js Physics Engine instance
  useEffect(() => {
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.2, scale: 0.001 },
    });
    matterEngineRef.current = engine;

    return () => {
      Matter.Engine.clear(engine);
    };
  }, []);

  useEffect(() => {
    sounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    onCountUpdate?.(sortedCount);
  }, [sortedCount, onCountUpdate]);

  const addPopup = useCallback((x: number, y: number, text: string, color: string, type: "score" | "combo" | "error" | "missed") => {
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingPopups((prev) => [...prev, { id, x, y, text, color, type }]);
    setTimeout(() => {
      setFloatingPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1250);
  }, []);

  const emitParticles = useCallback((x: number, y: number, count = 25, emoji?: string, color = "#F59E0B") => {
    const newParticles: Particle[] = [];
    const colors = [color, "#FBBF24", "#34D399", "#60A5FA", "#EC4899"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 9 + Math.random() * 14,
        color: colors[Math.floor(Math.random() * colors.length)],
        emoji: Math.random() > 0.5 ? emoji : Math.random() > 0.5 ? "✨" : "💨",
        alpha: 1,
        life: 0,
        maxLife: 35 + Math.random() * 30,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
      });
    }
    particlesRef.current.push(...newParticles);
  }, []);

  // ---------------------------------------------------------------------------
  // GPU CONVEYOR KEYFRAME ITERATION ("MISSED!" EVENT)
  // ---------------------------------------------------------------------------
  const handleItemMissed = useCallback((id: string) => {
    sounds.playPop();
    setCombo(1);

    const containerWidth = containerRef.current?.clientWidth || 900;
    const containerHeight = containerRef.current?.clientHeight || 500;
    const popupX = containerWidth - 140;
    const popupY = containerHeight - 80;

    emitParticles(popupX, popupY, 12, "💨", "#EF4444");
    addPopup(popupX, popupY, "Missed! 💨", "#EF4444", "missed");

    // Respawn new produce item
    setConveyorItems((prev) =>
      prev.map((crop) => {
        if (crop.id === id) {
          return {
            ...crop,
            item: getRandomProduce(),
          };
        }
        return crop;
      })
    );
  }, [getRandomProduce, emitParticles, addPopup]);

  // ---------------------------------------------------------------------------
  // STATIC BACKGROUND CANVAS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!canvas || !canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;

      const width = canvas.width;
      const height = canvas.height;

      // Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, "#38BDF8");
      skyGrad.addColorStop(0.6, "#BAE6FD");
      skyGrad.addColorStop(1, "#FEF08A");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Sun
      const sunX = width * 0.86;
      const sunY = height * 0.22;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 35);
      sunGrad.addColorStop(0, "#FEF08A");
      sunGrad.addColorStop(1, "#F59E0B");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
      ctx.fill();

      // Layered Parallax Rolling Hills
      ctx.fillStyle = "#15803D";
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width * 0.25, height * 0.52, width * 0.5, height * 0.65);
      ctx.quadraticCurveTo(width * 0.75, height * 0.78, width, height * 0.58);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Left Apple Tree
      const treeX = width * 0.08;
      const treeY = height * 0.45;
      ctx.fillStyle = "#78350F";
      ctx.fillRect(treeX - 12, treeY, 24, height * 0.4);
      ctx.fillStyle = "#16A34A";
      ctx.beginPath();
      ctx.arc(treeX, treeY - 20, 55, 0, Math.PI * 2);
      ctx.arc(treeX - 30, treeY - 10, 45, 0, Math.PI * 2);
      ctx.arc(treeX + 30, treeY - 10, 45, 0, Math.PI * 2);
      ctx.fill();

      // Foreground Green Hill
      ctx.fillStyle = "#22C55E";
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width * 0.3, height * 0.66, width * 0.6, height * 0.72);
      ctx.quadraticCurveTo(width * 0.85, height * 0.78, width, height * 0.7);
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      // Right Red Barn
      const barnX = width * 0.9;
      const barnY = height * 0.68;
      ctx.fillStyle = "#DC2626";
      ctx.fillRect(barnX - 24, barnY - 32, 48, 32);
      ctx.fillStyle = "#991B1B";
      ctx.beginPath();
      ctx.moveTo(barnX - 28, barnY - 32);
      ctx.lineTo(barnX, barnY - 50);
      ctx.lineTo(barnX + 28, barnY - 32);
      ctx.closePath();
      ctx.fill();
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }

    return () => resizeObserver.disconnect();
  }, []);

  // ---------------------------------------------------------------------------
  // MATTER.JS + BALLISTIC FLIGHT PHYSICS ANIMATION LOOP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (flyingCrops.length === 0) return;

    let frameId: number;

    const animateFlight = () => {
      // Step Matter.js physics engine
      if (matterEngineRef.current) {
        Matter.Engine.update(matterEngineRef.current, 1000 / 60);
      }

      setFlyingCrops((prev) => {
        const remaining: FlyingCrop[] = [];

        prev.forEach((f) => {
          const nextProgress = f.progress + 0.045;

          if (nextProgress >= 1) {
            // GUARANTEE EXACTLY ONCE EXECUTION PER UNIQUE FLIGHT ID
            if (!landedCropIdsRef.current.has(f.id)) {
              landedCropIdsRef.current.add(f.id);

              sounds.playSuccess();
              sounds.playPop();

              setPulsingCrate(f.category);
              setCrateContents((contents) => ({
                ...contents,
                [f.category]: [...(contents[f.category] || []), f.emoji],
              }));

              setTimeout(() => setPulsingCrate(null), 450);
              emitParticles(f.endX, f.endY, 35, f.emoji, f.color);

              const newCombo = combo + 1;
              setCombo(newCombo);
              if (newCombo > maxCombo) setMaxCombo(newCombo);

              const xpGained = f.xp * Math.min(newCombo, 5);
              setScore((s) => s + xpGained);

              // MASCOT KODA HAPPY REACTION!
              setMascotMood("happy");
              const happyQuotes = [
                `Awesome sort! 🌟`,
                `Great job! ${f.emoji}`,
                `Spot on! ✨`,
                `Super fast! ⚡`,
              ];
              setMascotText(happyQuotes[Math.floor(Math.random() * happyQuotes.length)]);
              setTimeout(() => {
                setMascotMood("idle");
                setMascotText("Where does it belong?");
              }, 1800);

              setSortedCount((sc) => {
                const nextSorted = sc + 1;
                if (nextSorted >= targetCount) {
                  sounds.playWin();
                  setMascotMood("victory");
                  setMascotText("Harvest Complete! 🏆🎉");
                  setShowLevelCompleteModal(true);
                  setShowCelebration(true);
                  onSuccess?.();
                }
                return nextSorted;
              });

              addPopup(f.endX, f.endY - 20, `+${xpGained} XP`, "#22C55E", "score");
              if (newCombo >= 2) {
                addPopup(f.endX, f.endY - 50, `${newCombo}x Combo! 🔥`, "#F59E0B", "combo");
              }

              // Replace sorted item with new produce
              setConveyorItems((prevItems) =>
                prevItems.map((crop) => {
                  if (crop.id === f.cropId) {
                    return {
                      ...crop,
                      item: getRandomProduce(),
                    };
                  }
                  return crop;
                })
              );
            }
          } else {
            remaining.push({
              ...f,
              progress: nextProgress,
              rotation: f.rotation + f.vRot,
            });
          }
        });

        return remaining;
      });

      frameId = requestAnimationFrame(animateFlight);
    };

    frameId = requestAnimationFrame(animateFlight);

    return () => cancelAnimationFrame(frameId);
  }, [flyingCrops.length, combo, maxCombo, targetCount, getRandomProduce, emitParticles, addPopup, onSuccess]);

  const handleSortItem = useCallback(
    (crop: ConveyorCrop, targetCategory: ProduceCategory, dropX: number, dropY: number) => {
      const isCorrect = crop.item.category === targetCategory;

      if (isCorrect) {
        setSelectedCropId(null);
        setHintActive(false);
        onAttempt?.("correct", { details: { item: crop.item.name, category: targetCategory } });

        const crateEl = crateRefs.current[targetCategory];
        const rect = crateEl?.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

        const targetX = rect ? rect.left + rect.width / 2 - containerRect.left : dropX;
        const targetY = rect ? rect.top + rect.height / 2 - containerRect.top : dropY;

        const newFlight: FlyingCrop = {
          id: `${crop.id}-${Date.now()}-${Math.random()}`,
          emoji: crop.item.emoji,
          name: crop.item.name,
          category: targetCategory,
          startX: dropX,
          startY: dropY,
          endX: targetX,
          endY: targetY,
          progress: 0,
          arcHeight: 140 + Math.random() * 30,
          rotation: 0,
          vRot: (Math.random() > 0.5 ? 1 : -1) * 22,
          color: crop.item.color,
          xp: crop.item.xp,
          cropId: crop.id,
        };

        setFlyingCrops((prev) => [...prev, newFlight]);
      } else {
        sounds.playFailure();
        onAttempt?.("incorrect", { details: { item: crop.item.name, targetCategory, expectedCategory: crop.item.category } });
        setCombo(1);
        setMistakes((m) => m + 1);

        // MASCOT KODA OOPS REACTION!
        setMascotMood("oops");
        const crateLabel = CRATE_DEFINITIONS[crop.item.category]?.label || "matching crate";
        setMascotText(`Oops! ${crop.item.name} belongs in ${crateLabel}!`);
        setTimeout(() => {
          setMascotMood("idle");
          setMascotText("Where does it belong?");
        }, 2200);

        emitParticles(dropX, dropY, 15, "❌", "#EF4444");
        addPopup(dropX, dropY - 20, "Wrong Crate! ❌", "#EF4444", "error");
      }
    },
    [emitParticles, addPopup, onAttempt]
  );

  const handleItemTap = (crop: ConveyorCrop) => {
    sounds.playPop();
    if (selectedCropId === crop.id) {
      setSelectedCropId(null);
    } else {
      setSelectedCropId(crop.id);
    }
  };

  const handleCrateTap = (category: ProduceCategory) => {
    if (!selectedCropId) return;
    const crop = conveyorItems.find((c) => c.id === selectedCropId);
    if (!crop) return;

    const slotEl = cardSlotRefs.current[crop.id];
    const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    const sRect = slotEl?.getBoundingClientRect();
    const startX = sRect ? sRect.left + sRect.width / 2 - containerRect.left : 400;
    const startY = sRect ? sRect.top + sRect.height / 2 - containerRect.top : 400;

    handleSortItem(crop, category, startX, startY);
  };

  const handlePointerDownCrop = (e: React.PointerEvent, crop: ConveyorCrop) => {
    if (!allowDrag) return;
    e.preventDefault();
    sounds.playPop();
    const startX = e.clientX;
    const startY = e.clientY;

    setDraggingCrop({
      crop,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  };

  useEffect(() => {
    if (!draggingCrop) return;

    const handlePointerMove = (e: PointerEvent) => {
      setDraggingCrop((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          currentX: e.clientX,
          currentY: e.clientY,
        };
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!draggingCrop) return;

      const dropX = e.clientX;
      const dropY = e.clientY;
      const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const relDropX = dropX - containerRect.left;
      const relDropY = dropY - containerRect.top;

      let matchedCategory: ProduceCategory | null = null;

      currentLevel.activeCategories.forEach((cat) => {
        const crateEl = crateRefs.current[cat];
        if (crateEl) {
          const rect = crateEl.getBoundingClientRect();
          if (
            dropX >= rect.left - 25 &&
            dropX <= rect.right + 25 &&
            dropY >= rect.top - 25 &&
            dropY <= rect.bottom + 25
          ) {
            matchedCategory = cat;
          }
        }
      });

      if (matchedCategory) {
        handleSortItem(draggingCrop.crop, matchedCategory, relDropX, relDropY);
      }

      setDraggingCrop(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingCrop, currentLevel.activeCategories, handleSortItem]);

  const handleHintClick = () => {
    sounds.playSparkle();

    if (selectedCropId) {
      // Auto-sort highlighted item (Adopted from GoodsSortCanvas)
      const crop = conveyorItems.find((c) => c.id === selectedCropId);
      if (crop) {
        handleCrateTap(crop.item.category);
        setHintActive(false);
        return;
      }
    }

    setHintActive(true);
    if (conveyorItems.length > 0) {
      setSelectedCropId(conveyorItems[0].id);
    }
  };

  const handleReset = () => {
    setSortedCount(0);
    setScore(0);
    setCombo(1);
    setMistakes(0);
    setFlyingCrops([]);
    setSelectedCropId(null);
    setHintActive(false);
    setShowCelebration(false);
    setShowLevelCompleteModal(false);
    setMascotMood("idle");
    setMascotText("Where does it belong?");
    setCrateContents({ fruits: ["🍎", "🍊"], vegetables: ["🥕", "🥦"], nuts: [], berries: [], compost: ["🍂", "🍌"] });
  };

  const handleNextLevel = () => {
    if (levelIndex < HARVEST_CURRICULUM_LEVELS.length - 1) {
      setLevelIndex((prev) => prev + 1);
    } else {
      setLevelIndex(0);
    }
    handleReset();
  };

  const selectedCrop = conveyorItems.find((c) => c.id === selectedCropId);

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      showGrid={showGrid}
      isDark={isDark}
      compact={compact}
      headerTitle={
        <div className="flex items-center gap-2">
          <Sprout className="text-emerald-400" size={18} />
          <span className="font-extrabold text-slate-800 dark:text-white text-sm sm:text-base">Harvest Crop Sort</span>
        </div>
      }
      headerActions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Stage Dropdown Selector List */}
          <select
            aria-label="Select Harvest Stage"
            value={levelIndex}
            onChange={(e) => {
              setLevelIndex(Number(e.target.value));
              handleReset();
            }}
            className="bg-amber-100/90 text-amber-900 font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-full border border-amber-300 shadow-sm cursor-pointer hover:bg-amber-200 outline-none backdrop-blur-md"
          >
            {HARVEST_CURRICULUM_LEVELS.map((lvl, idx) => (
              <option key={lvl.id} value={idx}>
                {lvl.title}
              </option>
            ))}
          </select>

          {/* Hint Button (Matching Sound Button Icon Style!) */}
          <button
            onClick={handleHintClick}
            className="p-1.5 sm:p-2 bg-slate-800 rounded-full text-slate-200 hover:bg-slate-700 shadow"
            title="Hint"
          >
            <Lightbulb size={14} className="text-yellow-400 fill-current sm:w-4 sm:h-4" />
          </button>

          {/* Sound Toggle Button */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-1.5 sm:p-2 bg-slate-800 rounded-full text-slate-200 hover:bg-slate-700 shadow"
            title="Toggle Sound"
          >
            {soundEnabled ? <Volume2 size={14} className="sm:w-4 sm:h-4" /> : <VolumeX size={14} className="sm:w-4 sm:h-4" />}
          </button>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="p-1.5 sm:p-2 bg-slate-700 rounded-full text-slate-200 hover:bg-slate-600 shadow"
          >
            <RotateCcw size={14} className="sm:w-4 sm:h-4" />
          </button>
        </div>
      }
      footerStatus={<span>Sorted: {sortedCount} / {targetCount} produce items ({currentLevel.title})</span>}
      footerSolved={sortedCount >= targetCount}
    >
      <style>{`
        @keyframes harvestConveyorSlide {
          0% {
            transform: translate3d(-140px, 0, 0);
          }
          100% {
            transform: translate3d(calc(100vw + 140px), 0, 0);
          }
        }

        .conveyor-crop-item {
          animation: harvestConveyorSlide 8.8s linear infinite;
          will-change: transform;
        }
      `}</style>

      <div
        ref={containerRef}
        className={`relative w-full h-full min-h-[440px] sm:min-h-[520px] flex-1 rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-900/30 select-none ${
          shakeScreen ? "animate-shake" : ""
        }`}
      >
        {/* FULL WIDTH STATIC BACKGROUND CANVAS */}
        <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Floating Popups Overlay */}
        {floatingPopups.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, y: p.y, scale: 0.8 }}
            animate={{ opacity: 0, y: p.y - 65, scale: 1.3 }}
            transition={{ duration: 1.25, ease: "easeOut" }}
            className={`absolute pointer-events-none font-black text-xs sm:text-sm md:text-base px-3 py-0.5 sm:py-1 rounded-full shadow-2xl border backdrop-blur-md z-30 ${
              p.type === "missed" ? "animate-bounce" : ""
            }`}
            style={{
              left: p.x,
              backgroundColor: p.type === "missed" ? "#EF444422" : `${p.color}33`,
              borderColor: p.color,
              color: p.color,
            }}
          >
            {p.text}
          </motion.div>
        ))}

        {/* Category Goals Progress Rail Bar (Adopted from GoodsSortCanvas) */}
        <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md border-2 border-amber-300 px-3 sm:px-4 py-1 rounded-full shadow-xl flex items-center gap-1.5 sm:gap-2 max-w-[95%] justify-center select-none">
          {currentLevel.activeCategories.map((cat) => {
            const crate = CRATE_DEFINITIONS[cat];
            const contents = crateContents[cat] || [];
            const crateTarget = Math.max(3, Math.ceil(targetCount / currentLevel.activeCategories.length));
            const isFull = contents.length >= crateTarget;

            return (
              <motion.span
                key={cat}
                layout
                animate={isFull ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black sm:text-[11px] backdrop-blur-md shadow-sm ${
                  isFull
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold"
                    : "border-slate-300 bg-amber-50/80 text-slate-700"
                }`}
              >
                <span className="text-xs">{crate.emoji}</span>
                {isFull ? (
                  <Check size={11} strokeWidth={3.5} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <span>
                    {contents.length}/{crateTarget}
                  </span>
                )}
              </motion.span>
            );
          })}
        </div>

        {/* DOTTED ARC TRAJECTORY ARROW */}
        {selectedCrop && (() => {
          const targetCat = selectedCrop.item.category;
          const slotEl = cardSlotRefs.current[selectedCrop.id];
          const crateEl = crateRefs.current[targetCat];
          const containerRect = containerRef.current?.getBoundingClientRect();

          if (slotEl && crateEl && containerRect) {
            const sRect = slotEl.getBoundingClientRect();
            const cRect = crateEl.getBoundingClientRect();

            const startX = sRect.left + sRect.width / 2 - containerRect.left;
            const startY = sRect.top - containerRect.top;
            const endX = cRect.left + cRect.width / 2 - containerRect.left;
            const endY = cRect.bottom - 20 - containerRect.top;

            const midX = (startX + endX) / 2;
            const midY = Math.min(startY, endY) - 50;

            const pathString = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;

            return (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
                <motion.path
                  d={pathString}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="5"
                  strokeDasharray="8 8"
                  animate={{ strokeDashoffset: [-32, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                  className="filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                />
                <circle cx={endX} cy={endY} r="8" fill="#F59E0B" className="animate-ping" />
              </svg>
            );
          }
          return null;
        })()}

        {/* REAL 3D HARVEST CRATES & BARREL */}
        <div className="absolute top-10 sm:top-12 md:top-14 left-0 right-0 z-20 px-2 sm:px-6 flex justify-center items-end gap-2 sm:gap-6 md:gap-10 flex-wrap">
          {currentLevel.activeCategories.map((cat) => {
            const crate = CRATE_DEFINITIONS[cat];
            const isPulsing = pulsingCrate === cat;
            const isTarget = selectedCrop?.item.category === cat || hintActive;
            const contents = crateContents[cat] || [];
            const crateTarget = Math.max(3, Math.ceil(targetCount / currentLevel.activeCategories.length));
            const isFull = contents.length >= crateTarget;

            return (
              <motion.div
                key={cat}
                ref={(el) => { crateRefs.current[cat] = el; }}
                onClick={() => handleCrateTap(cat)}
                animate={
                  isPulsing
                    ? {
                        scale: [1, 0.82, 1.25, 0.95, 1],
                        rotate: [0, -7, 7, -3, 0],
                        y: [0, 10, -12, 0],
                      }
                    : isTarget
                    ? { scale: [1, 1.06, 1] }
                    : { scale: 1, rotate: 0, y: 0 }
                }
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 25,
                }}
                className={`relative cursor-pointer w-[28vw] max-w-[170px] min-w-[100px] h-[30vw] max-h-[185px] min-h-[110px] transition-all flex flex-col items-center justify-between select-none overflow-visible ${
                  isFull
                    ? "filter drop-shadow-[0_0_35px_rgba(34,197,94,0.9)]"
                    : isTarget
                    ? "filter drop-shadow-[0_0_35px_rgba(251,191,36,1)]"
                    : "filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
                } hover:scale-105 active:scale-95`}
              >
                {/* 3D Floating Header Sign Board & Fill Goal Indicator */}
                <div className="relative -top-3 z-20 flex flex-col items-center gap-0.5 select-none">
                  <div
                    className={`px-2.5 sm:px-4 py-0.5 rounded-xl font-black text-[10px] sm:text-xs md:text-sm tracking-wider text-center shadow-2xl border-2 border-white/40 uppercase backdrop-blur-md ${crate.headerBg} ${crate.headerTextColor}`}
                  >
                    {crate.label}
                  </div>

                  {/* Visual Capacity Fill Pill with Stars */}
                  <div
                    className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black flex items-center gap-1 shadow-md border backdrop-blur-md ${
                      isFull
                        ? "bg-emerald-500 text-white border-emerald-300 shadow-emerald-500/50 animate-bounce"
                        : "bg-black/75 text-amber-300 border-white/20"
                    }`}
                  >
                    {isFull ? (
                      <span className="flex items-center gap-1">FULL! 🌟</span>
                    ) : (
                      <>
                        <span>{contents.length} / {crateTarget}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: crateTarget }).map((_, dotIdx) => (
                            <span key={dotIdx} className={dotIdx < contents.length ? "text-amber-300" : "text-slate-500 opacity-50"}>
                              ★
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Real 3D Vector SVG Farm Bin (Renders Fruits INSIDE Crate Cavity Behind Front Slats!) */}
                <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <Vector3DFarmBin category={cat} label={crate.label} isTarget={isTarget} contents={contents} />
                </div>

                {/* Crate Item Counter Badge */}
                <div className="relative bottom-1 z-20 px-2 sm:px-3 py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-black bg-black/70 text-amber-300 backdrop-blur-md border border-white/30 shadow-lg flex items-center gap-1">
                  <span>{crate.emoji}</span>
                  <span>{contents.length} Items</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* REALISTIC 3D BALLISTIC PARABOLIC FLIGHT PHYSICS OVERLAY */}
        {flyingCrops.map((f) => {
          const t = f.progress;
          const currentX = f.startX + (f.endX - f.startX) * t;
          const linearY = f.startY + (f.endY - f.startY) * t;
          const arcY = Math.sin(t * Math.PI) * f.arcHeight;
          const currentY = linearY - arcY;
          const currentScale = 1 + Math.sin(t * Math.PI) * 0.45;

          return (
            <div
              key={f.id}
              className="pointer-events-none absolute z-40 flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${currentX}px`,
                top: `${currentY}px`,
                transform: `translate(-50%, -50%) scale(${currentScale}) rotate(${f.rotation}deg)`,
              }}
            >
              <span className="text-4xl sm:text-6xl filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)]">
                {f.emoji}
              </span>
            </div>
          );
        })}

        {/* WOODEN COUNTER TABLE TRAY WITH GPU HARDWARE ACCELERATED CONVEYOR ITEMS */}
        <div className="absolute bottom-0 left-0 right-0 h-24 sm:h-28 md:h-32 bg-gradient-to-b from-[#D9A362] via-[#B88144] to-[#8C5827] border-t-4 border-[#F5D091] shadow-2xl z-20 flex flex-col items-center justify-between p-1.5 sm:p-2 px-3 sm:px-6 overflow-visible">

          {/* GPU Hardware Compositor Conveyor Items */}
          <div className="relative w-full h-full flex items-center overflow-visible">
            {conveyorItems.map((crop) => {
              const isSelected = selectedCropId === crop.id;
              const isBeingDragged = draggingCrop?.crop.id === crop.id;

              return (
                <div
                  key={crop.id}
                  ref={(el) => { cardSlotRefs.current[crop.id] = el; }}
                  onClick={() => handleItemTap(crop)}
                  onPointerDown={(e) => handlePointerDownCrop(e, crop)}
                  onAnimationIteration={() => handleItemMissed(crop.id)}
                  className={`conveyor-crop-item absolute top-1/2 -translate-y-1/2 cursor-pointer flex flex-col items-center justify-center select-none ${
                    isBeingDragged
                      ? "opacity-0 pointer-events-none"
                      : isSelected
                      ? "scale-125 filter drop-shadow-[0_0_25px_rgba(251,191,36,1)]"
                      : "filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
                  }`}
                  style={{ animationDelay: `${crop.delaySec}s` }}
                >
                  {/* Pure Floating 3D Produce Icon (No Label While Running) */}
                  <span className="text-4xl sm:text-5xl md:text-6xl filter drop-shadow-lg transition-transform hover:scale-125">
                    {crop.item.emoji}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dragged Crop Preview (Shows Item Name Label ONLY When Dragging Event Happens!) */}
        {draggingCrop && (
          <div
            className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none"
            style={{ left: draggingCrop.currentX, top: draggingCrop.currentY }}
          >
            <span className="text-6xl sm:text-7xl filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.7)] animate-pulse scale-125">
              {draggingCrop.crop.item.emoji}
            </span>
            <div className="mt-1.5 px-3 py-0.5 rounded-full text-xs font-black text-amber-200 bg-slate-950/90 border border-amber-300 shadow-2xl backdrop-blur-md flex items-center gap-1">
              <span>{draggingCrop.crop.item.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* Level Complete 3-Star Celebration Modal */}
      <AnimatePresence>
        {showLevelCompleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 select-none"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              className="bg-gradient-to-b from-slate-900 via-amber-950 to-slate-900 border-4 border-amber-400/60 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center text-white relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
              
              <div className="flex justify-center mb-3">
                <div className="p-4 rounded-full bg-amber-500/20 border-2 border-amber-400 shadow-inner">
                  <Award size={44} className="text-amber-400 animate-bounce" />
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-amber-300 tracking-wide uppercase mb-1">
                Harvest Complete!
              </h3>
              <p className="text-xs text-amber-200/80 mb-4 font-bold">
                {currentLevel.title} Passed
              </p>

              {/* 3 Star Rating Display */}
              <div className="flex justify-center items-center gap-2 mb-5">
                {[1, 2, 3].map((starIdx) => (
                  <motion.div
                    key={starIdx}
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: starIdx * 0.15, type: "spring", stiffness: 400 }}
                  >
                    <Star size={36} fill="#FBBF24" className="text-amber-400 filter drop-shadow-[0_4px_12px_rgba(251,191,36,0.8)]" />
                  </motion.div>
                ))}
              </div>

              <div className="bg-black/40 rounded-2xl p-3 border border-white/10 mb-5 space-y-1.5 text-xs font-bold text-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Score:</span>
                  <span className="text-emerald-400">{score} XP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Combo:</span>
                  <span className="text-amber-400">{maxCombo}x 🔥</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Produce Sorted:</span>
                  <span className="text-amber-200">{sortedCount} Items</span>
                </div>
              </div>

              <button
                onClick={handleNextLevel}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 border border-yellow-200 active:scale-95"
              >
                <span>Continue to Next Level</span>
                <ChevronRight size={18} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How To Play Modal */}
      <AnimatePresence>
        {showHowToPlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <HelpCircle className="text-amber-400" size={20} />
                  How to Play Harvest Crop Sort
                </h3>
                <button
                  onClick={() => setShowHowToPlay(false)}
                  className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl">🧺</span>
                  <p>
                    <strong>Drag & Drop:</strong> Drag moving produce items into matching destination crates.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-xl">💨</span>
                  <p>
                    <strong>Don't Miss!</strong> Catch moving items before they reach the right edge!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowHowToPlay(false)}
                className="mt-5 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl shadow-lg transition-colors"
              >
                Got It, Let's Play!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Celebration show={showCelebration} message="Harvest Complete!" />
    </SharedCanvasLayout>
  );
};

export default HarvestSortCanvas;
