/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * XtraMath Level Presets, Curated Curriculum Ladder, Dynamic Fact Generator, and Auto-Guide Helper.
 * Replaces emojis with clean SVG icons in glass design architecture.
 */

export type XtraMathDifficultyTier = "beginner" | "apprentice" | "advanced" | "master" | "grandmaster";
export type XtraMathOperation = "add" | "subtract" | "multiply" | "divide" | "mixed";

export interface XtraMathTheme {
  id: string;
  name: string;
  iconName: "pencil" | "zap" | "sparkles" | "compass" | "shield";
  bgGradient: string;
  cardBg: string;
  cardBorder: string;
  accentColor: string;
  btnGradient: string;
}

export interface XtraMathLevel {
  id: string;
  name: string;
  description: string;
  difficultyTier: XtraMathDifficultyTier;
  operation: XtraMathOperation;
  targetCount: number;
  timeLimitSec: number;
  num1Range: [number, number];
  num2Range: [number, number];
  themeId: string;
}

export interface DynamicMathFact {
  id: string;
  num1: number;
  num2: number;
  operator: "+" | "-" | "×" | "÷";
  answer: number;
  options: number[];
  autoGuideHint: string;
}

export const XTRAMATH_THEMES: XtraMathTheme[] = [
  {
    id: "classic",
    name: "Classic XtraMath",
    iconName: "pencil",
    bgGradient: "from-slate-100 via-white to-indigo-100 dark:from-slate-950 dark:via-[#0B0F19] dark:to-indigo-950",
    cardBg: "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl",
    cardBorder: "border-indigo-500/20 dark:border-indigo-500/30",
    accentColor: "text-indigo-600 dark:text-indigo-400",
    btnGradient: "from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white",
  },
  {
    id: "cyber",
    name: "Neon Cyber Arcade",
    iconName: "zap",
    bgGradient: "from-cyan-50 via-white to-violet-100 dark:from-slate-900 dark:via-[#080214] dark:to-[#1E0842]",
    cardBg: "bg-white/80 dark:bg-[#140632]/80 backdrop-blur-xl",
    cardBorder: "border-cyan-500/30 dark:border-cyan-500/40",
    accentColor: "text-cyan-600 dark:text-cyan-400",
    btnGradient: "from-cyan-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white",
  },
  {
    id: "candy",
    name: "Pastel Glass Store",
    iconName: "sparkles",
    bgGradient: "from-pink-50 via-white to-purple-100 dark:from-pink-950 dark:via-slate-900 dark:to-purple-950",
    cardBg: "bg-white/80 dark:bg-[#250C33]/80 backdrop-blur-xl",
    cardBorder: "border-pink-500/30 dark:border-pink-500/40",
    accentColor: "text-pink-600 dark:text-pink-400",
    btnGradient: "from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white",
  },
  {
    id: "galaxy",
    name: "Cosmic Space Galaxy",
    iconName: "compass",
    bgGradient: "from-blue-50 via-white to-indigo-100 dark:from-[#030712] dark:via-[#0B132B] dark:to-[#1C2541]",
    cardBg: "bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl",
    cardBorder: "border-blue-500/30 dark:border-blue-500/40",
    accentColor: "text-blue-600 dark:text-blue-400",
    btnGradient: "from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white",
  },
  {
    id: "forest",
    name: "Emerald Glass Meadow",
    iconName: "shield",
    bgGradient: "from-emerald-50 via-white to-teal-100 dark:from-[#021A12] dark:via-[#052E20] dark:to-[#0A4732]",
    cardBg: "bg-white/80 dark:bg-[#042419]/80 backdrop-blur-xl",
    cardBorder: "border-emerald-500/30 dark:border-emerald-500/40",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    btnGradient: "from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white",
  },
];

export const XTRAMATH_CURRICULUM_LEVELS: XtraMathLevel[] = [
  // Stage 1: Addition Path
  {
    id: "xm_level_1",
    name: "Level 1: Addition Path (1–5)",
    description: "Gentle single-digit addition fluency within 5.",
    difficultyTier: "beginner",
    operation: "add",
    targetCount: 5,
    timeLimitSec: 10,
    num1Range: [1, 3],
    num2Range: [1, 2],
    themeId: "classic",
  },
  {
    id: "xm_level_2",
    name: "Level 2: Addition Path (Sums to 10)",
    description: "Addition facts up to 10 with visual dot helpers.",
    difficultyTier: "beginner",
    operation: "add",
    targetCount: 8,
    timeLimitSec: 8,
    num1Range: [1, 5],
    num2Range: [1, 5],
    themeId: "candy",
  },
  {
    id: "xm_level_3",
    name: "Level 3: Addition Path (Sums to 20)",
    description: "Master single-digit addition facts up to 20.",
    difficultyTier: "apprentice",
    operation: "add",
    targetCount: 10,
    timeLimitSec: 6,
    num1Range: [3, 9],
    num2Range: [2, 9],
    themeId: "cyber",
  },

  // Stage 2: Subtraction Path
  {
    id: "xm_level_4",
    name: "Level 4: Subtraction Path (Within 10)",
    description: "Basic subtraction facts within 10.",
    difficultyTier: "apprentice",
    operation: "subtract",
    targetCount: 10,
    timeLimitSec: 6,
    num1Range: [5, 10],
    num2Range: [1, 5],
    themeId: "forest",
  },
  {
    id: "xm_level_5",
    name: "Level 5: Subtraction Path (Within 20)",
    description: "Subtraction facts from 11 to 20.",
    difficultyTier: "advanced",
    operation: "subtract",
    targetCount: 10,
    timeLimitSec: 5,
    num1Range: [11, 20],
    num2Range: [2, 9],
    themeId: "galaxy",
  },

  // Stage 3: Multiplication Path
  {
    id: "xm_level_6",
    name: "Level 6: Multiplication Path (2s, 5s, 10s)",
    description: "Introductory multiplication fluency for 2s, 5s, and 10s.",
    difficultyTier: "advanced",
    operation: "multiply",
    targetCount: 12,
    timeLimitSec: 4,
    num1Range: [2, 5],
    num2Range: [1, 10],
    themeId: "candy",
  },
  {
    id: "xm_level_7",
    name: "Level 7: Multiplication Path (Full 1–12)",
    description: "Complete multiplication table mastery (1x1 through 12x12).",
    difficultyTier: "master",
    operation: "multiply",
    targetCount: 15,
    timeLimitSec: 3,
    num1Range: [2, 12],
    num2Range: [2, 12],
    themeId: "cyber",
  },

  // Stage 4: Division Path & Mixed Mastery
  {
    id: "xm_level_8",
    name: "Level 8: Division Path (1–12)",
    description: "Inverse multiplication & division facts.",
    difficultyTier: "master",
    operation: "divide",
    targetCount: 15,
    timeLimitSec: 3,
    num1Range: [1, 12],
    num2Range: [1, 12],
    themeId: "forest",
  },
  {
    id: "xm_level_9",
    name: "Level 9: Speed Arithmetic Grandmaster",
    description: "Rapid-fire mental math across all 4 operations at 2s per question.",
    difficultyTier: "grandmaster",
    operation: "mixed",
    targetCount: 20,
    timeLimitSec: 2,
    num1Range: [5, 20],
    num2Range: [2, 15],
    themeId: "galaxy",
  },
];

/** Dynamic Fact Generator: Creates non-repeating random math facts per level */
export function generateDynamicMathFact(level: XtraMathLevel, index: number): DynamicMathFact {
  const op: XtraMathOperation = level.operation === "mixed"
    ? (["add", "subtract", "multiply", "divide"][index % 4] as XtraMathOperation)
    : level.operation;

  let n1 = Math.floor(Math.random() * (level.num1Range[1] - level.num1Range[0] + 1)) + level.num1Range[0];
  let n2 = Math.floor(Math.random() * (level.num2Range[1] - level.num2Range[0] + 1)) + level.num2Range[0];
  let symbol: "+" | "-" | "×" | "÷" = "+";
  let ans = 0;
  let autoGuideHint = "";

  if (op === "add") {
    symbol = "+";
    ans = n1 + n2;
    autoGuideHint = `Count on from ${n1}. Add ${n2} more to get ${ans}.`;
  } else if (op === "subtract") {
    symbol = "-";
    if (n1 < n2) [n1, n2] = [n2, n1];
    ans = n1 - n2;
    autoGuideHint = `Take away ${n2} from ${n1}. The amount left is ${ans}.`;
  } else if (op === "multiply") {
    symbol = "×";
    ans = n1 * n2;
    autoGuideHint = `Think of ${n1} groups of ${n2}. That makes ${ans}.`;
  } else {
    symbol = "÷";
    ans = n1;
    n1 = ans * n2;
    autoGuideHint = `How many groups of ${n2} fit into ${n1}? The answer is ${ans}.`;
  }

  // Generate 4 plausible choice options including the correct answer
  const optionsSet = new Set<number>([ans]);
  const offsets = [-2, -1, 1, 2, 3, -3];
  for (const offset of offsets) {
    if (optionsSet.size >= 4) break;
    const cand = ans + offset;
    if (cand >= 0) optionsSet.add(cand);
  }

  const options = Array.from(optionsSet).sort((a, b) => a - b);

  return {
    id: `fact_${op}_${n1}_${n2}_${index}`,
    num1: n1,
    num2: n2,
    operator: symbol,
    answer: ans,
    options,
    autoGuideHint,
  };
}

export function getXtraMathLevel(levelId: string): XtraMathLevel {
  const found = XTRAMATH_CURRICULUM_LEVELS.find((l) => l.id === levelId);
  return found || XTRAMATH_CURRICULUM_LEVELS[0];
}

export function getXtraMathTheme(themeId: string): XtraMathTheme {
  const found = XTRAMATH_THEMES.find((t) => t.id === themeId);
  return found || XTRAMATH_THEMES[0];
}
