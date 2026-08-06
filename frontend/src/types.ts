/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum CountingTechnique {
  ONE_TO_ONE = "ONE_TO_ONE",
  MOVE_AND_COUNT = "MOVE_AND_COUNT",
  LINE_UP_AND_COUNT = "LINE_UP_AND_COUNT",
  GROUP_IN_TENS = "GROUP_IN_TENS",
  COUNT_ON = "COUNT_ON",
  COUNT_BACK = "COUNT_BACK",
  DIFFERENT_ARRANGEMENTS = "DIFFERENT_ARRANGEMENTS",
  COUNT_MAGNETS = "COUNT_MAGNETS",
  SUBITIZE = "SUBITIZE",
  ADDITION_SANDBOX = "ADDITION_SANDBOX",
  SUBTRACTION_SANDBOX = "SUBTRACTION_SANDBOX",
  MULTIPLICATION_ARRAY = "MULTIPLICATION_ARRAY",
  KODA_SUDOKU = "KODA_SUDOKU",
  KODA_PATTERN = "KODA_PATTERN",
  FLEXIBLE_CANVAS = "FLEXIBLE_CANVAS",
  ADDITION_TUTOR = "ADDITION_TUTOR",
  ADDITION_COLUMN = "ADDITION_COLUMN",
  SUBTRACTION_COLUMN = "SUBTRACTION_COLUMN",
  ADDITION_COLUMN_MULTI = "ADDITION_COLUMN_MULTI",
  SUBTRACTION_COLUMN_MULTI = "SUBTRACTION_COLUMN_MULTI",
  MULTIPLICATION_COLUMN = "MULTIPLICATION_COLUMN",
  LIQUID_SORT = "LIQUID_SORT",
  GOODS_SORT = "GOODS_SORT",
  NUMBER_PATH = "NUMBER_PATH",
  STORY_PROBLEM_MAT = "STORY_PROBLEM_MAT",
  PLACE_VALUE_LAB = "PLACE_VALUE_LAB",
  EQUATION_MAT = "EQUATION_MAT",
  COMPARE_NUMBERS = "COMPARE_NUMBERS",
  CLOCK_READ = "CLOCK_READ",
  MEASURE_LENGTH = "MEASURE_LENGTH",
  DATA_CHART = "DATA_CHART",
  SHAPE_LAB = "SHAPE_LAB",
  COUNT_CRATES = "COUNT_CRATES",
  XTRA_MATH = "XTRA_MATH"
}

export interface CountableObject {
  id: string;
  emoji: string;
  label: string;
  colorClass: string;
  assetType?: string;
  scale?: number;
}

export const SVG_OBJECTS: CountableObject[] = [
  { id: "apple", emoji: "🍎", label: "Apple", colorClass: "bg-red-50 hover:bg-red-100 border-red-200 text-red-600", assetType: "apple" },
  { id: "star", emoji: "⭐", label: "Star", colorClass: "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-amber-700", assetType: "star" },
  { id: "dino", emoji: "🦕", label: "Dinosaur", colorClass: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-600", assetType: "dino" },
  { id: "car", emoji: "🚗", label: "Toy Car", colorClass: "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600", assetType: "car" },
  { id: "bear", emoji: "🧸", label: "Bear", colorClass: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-600", assetType: "bear" },
  { id: "fish", emoji: "🐟", label: "Fish", colorClass: "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600", assetType: "fish" },
  { id: "rocket", emoji: "🚀", label: "Rocket", colorClass: "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600", assetType: "rocket" },
  { id: "butterfly", emoji: "🦋", label: "Butterfly", colorClass: "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-600", assetType: "butterfly" },
  { id: "sun", emoji: "☀️", label: "Sun", colorClass: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-600", assetType: "sun" },
  { id: "flower", emoji: "🌸", label: "Flower", colorClass: "bg-pink-50 hover:bg-pink-100 border-pink-200 text-pink-600", assetType: "flower" },
  { id: "heart", emoji: "❤️", label: "Heart", colorClass: "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600", assetType: "heart" }
];

export const EMOJI_OBJECTS: CountableObject[] = [
  { id: "duck", emoji: "🦆", label: "Duck", colorClass: "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-600", assetType: "emoji" },
  { id: "cupcake", emoji: "🧁", label: "Cupcake", colorClass: "bg-pink-50 hover:bg-pink-100 border-pink-200 text-pink-600", assetType: "emoji" },
  { id: "balloon", emoji: "🎈", label: "Balloon", colorClass: "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-600", assetType: "emoji" },
  { id: "cookie", emoji: "🍪", label: "Cookie", colorClass: "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800", assetType: "emoji" },
  { id: "blue_dot", emoji: "🔵", label: "Blue Dot", colorClass: "bg-blue-50 hover:bg-blue-100 border-blue-200", assetType: "emoji" },
  { id: "red_dot", emoji: "🔴", label: "Red Dot", colorClass: "bg-red-50 hover:bg-red-100 border-red-200", assetType: "emoji" }
];

export const CUSTOM_SVG_OBJECT_PLACEHOLDER: CountableObject = {
  id: "custom_svg",
  emoji: "",
  label: "Custom SVG",
  colorClass: "bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-600",
  assetType: "custom_svg"
};

export const COUNT_OBJECTS: CountableObject[] = [...SVG_OBJECTS, ...EMOJI_OBJECTS, CUSTOM_SVG_OBJECT_PLACEHOLDER];

export interface CustomSvgAsset {
  id: string;
  label: string;
  markup: string;
  scale: number;
}

export interface CountingQuestion {
  id: string;
  /** Stable owner curriculum. Keeps the shared question deck scoped in Studio. */
  curriculumId?: string;
  technique: CountingTechnique;
  title: string;
  instruction: string;
  objectId: string;
  targetCount: number;
  /**
   * Optional FK into the curriculum tree (curriculum/types.ts) — which Skill
   * this question belongs to. A question with no skillId simply isn't part
   * of a curriculum yet; every canvas and existing worksheet is unaffected.
   */
  skillId?: string;
  /**
   * Standard authored difficulty band. Drives the placement generator's
   * hard-band sampling and the scoring engine's hard-question gate. The release
   * publisher (backend release.py `normalize_difficulty`) reads this first, then
   * falls back to `config.difficulty`, then "medium".
   */
  difficulty?: "easy" | "medium" | "hard";
  config: {
    /**
     * Why the answer is the answer, in one sentence a six-year-old can follow.
     * Shown only after the child has solved the card, so it teaches rather than
     * gives away — see the success panel in `GameLauncher`.
    */
    explanation?: string;
    /** Preferred zero-based slot for the correct option; distractors fill the other slots. */
    answerChoiceSlot?: number;
    /** Authored curriculum level used by multi-level game canvases such as Liquid Sort. */
    levelId?: string;
    weather?: string;
    showItemCardBox?: boolean;
    allowDrag?: boolean;
    assetType?: string;
    /**
     * The library asset this question draws. A reference, not a copy, so editing the asset
     * updates every question pointing at it — see `assets/assetRef.ts`.
     */
    customSvgAssetId?: string;
    /** @deprecated Inlined snapshot from before `customSvgAssetId`. Read, never written. */
    customSvgMarkup?: string;
    /** @deprecated Snapshot of the asset's label. See `customSvgMarkup`. */
    customSvgLabel?: string;
    /** @deprecated Snapshot of the asset's scale. See `customSvgMarkup`. */
    customSvgScale?: number;
    baseCount?: number;
    extraCount?: number;
    totalCount?: number;
    removeCount?: number;
    pattern?: "grid" | "circle" | "scatter" | "line" | "dice" | "pairs" | "columns" | "wave" | "ring";
    flashDurationMs?: number;
    customPositions?: { id: string; x: number; y: number }[];
    layoutReference?: { width: number; height: number };
    layoutGridSize?: number;
    showLayoutRulers?: boolean;
    containerPositions?: { [key: string]: { x: number; y: number } };
    workspaceHeight?: number;
    workspaceWidth?: number;
    showNumbersOnTap?: boolean;
    requireAnswerInput?: boolean;
    sourceBinLabel?: string;
    destinationBinLabel?: string;
    slotBorderStyle?: "dashed" | "solid" | "dotted";
    showNumbersInSlots?: boolean;
    showItemFrame?: boolean;
    // "rose" is distinct from "pink" in the type though every canvas's own
    // FRAME_ACCENTS map treats them as aliases of the same accent today —
    // kept as two legal values since that's what canvases already accept at
    // runtime (found via curriculum/seedExample.ts triggering a strict check
    // this loosely-typed field never got before).
    frameColor?: "indigo" | "slate" | "emerald" | "purple" | "pink" | "rose";
    containerShape?: "mystery" | "basket" | "box" | "chest";
    crossOutStyle?: "red_x" | "slash" | "fade";
    gridColumns?: number;
    jarLabel?: string;
    jarColorAccent?: "blue" | "amber" | "emerald" | "rose";
    subitizePatternStyle?: "dice" | "scatter" | "pairs";
    // Scale features (Addition, Subtraction, Multiplication, Sudoku, Patterns)
    addend1?: number;
    addend2?: number;
    subtrahend?: number;
    subtrahend2?: number;
    multiplicand?: number;
    multiplier?: number;
    minuend?: number;
    // Equation Mat — the true terms plus which one is hidden from the child.
    equationOperation?: "add" | "subtract";
    equationFirst?: number;
    equationSecond?: number;
    /**
     * Which quantity the child supplies. `judge` is the odd one out: nothing is
     * hidden, and the child decides whether the whole equation is true — the
     * "the equal sign means the same as" half of 1.OA.D.7.
     */
    equationUnknown?: "result" | "first" | "second" | "judge";
    /**
     * `judge` only: what the right-hand side claims. One value states a total
     * (`8 − 2 = 5`); two state a second sum (`5 + 2 = 3 + 4`).
     */
    equationClaimFirst?: number;
    equationClaimSecond?: number;
    // Compare Numbers
    compareFirst?: number;
    compareSecond?: number;
    compareAnswer?: string;
    // Clock
    clockHour?: number;
    clockMinute?: number;
    clockLabel?: string;
    // Measure Length
    measureTask?: "measure" | "longest" | "shortest";
    measureLengths?: number[];
    measureLabels?: string[];
    // Data Chart
    dataKind?: "count" | "total" | "more" | "most";
    dataCounts?: number[];
    dataCategories?: string[];
    /** Artwork per chart category — an asset type id, or empty for the built-in fruit. */
    dataAssets?: string[];
    dataFocus?: number;
    dataAgainst?: number;
    // Shape Lab
    shapeTask?: "sides" | "corners" | "compose" | "shares";
    shapeName?: "triangle" | "square" | "rectangle" | "pentagon" | "hexagon" | "circle";
    shapeShares?: number;
    rows?: number;
    cols?: number;
    patternSequence?: string[]; // E.g. ["🍎", "🧁", "🍎", "🧁", ""] — every blank slot ("", "?" or "_") is a fillable gap
    patternAnswer?: string;     // Legacy single-blank answer (still supported)
    patternAnswers?: string[];  // One answer per blank slot, in left-to-right order (supersedes patternAnswer)
    sudokuStartingGrid?: string[][]; // 4x4 matrix, "" means empty
    sudokuSolution?: string[][];     // 4x4 correct matrix
    sudokuOptions?: string[];        // emojis to select from
    sudokuSymbolType?: "numbers" | "emojis"; // Mode selector for rules tab
    defaultRepresentation?: "concrete" | "pictorial" | "abstract"; // Default CPA representation
    arrayLayout?: { x: number; y: number; width: number; height: number };
    num1?: number;
    num2?: number;
    num3?: number;
    tier?: string;
    defaultVsComputer?: boolean;
    timeLimitSec?: number;
    themeId?: string;
    /**
     * Addition Tutor: author-defined fluency problems for the final phase.
     * When omitted the canvas derives three problems that match the taught
     * problem's digit shape and regrouping behaviour.
     */
    tutorChallenges?: { num1: number; num2: number }[];
    /**
     * Column Addition: optional extra practice problems for the standard
     * vertical algorithm. When omitted the canvas derives problems that match
     * the authored problem's digit shape and carrying behaviour.
     */
    columnChallenges?: { num1: number; num2: number }[];
    // Number Path & 120 Chart
    numberChartView?: "path" | "circle" | "stepping_stones" | "maze" | "chart";
    numberChartTask?: "count_forward" | "find_number" | "ten_more" | "ten_less";
    numberChartDifficulty?: "guided" | "independent" | "challenge";
    numberChartStart?: number;
    numberChartEnd?: number;
    storyProblemType?: "add_to" | "take_from" | "put_together" | "take_apart" | "compare" | "three_addends";
    storyUnknown?: "result" | "change" | "start" | "part";
    storyStart?: number;
    storyChange?: number;
    storyPart2?: number;
    storyPart3?: number;
    storyScene?: "park" | "picnic" | "pond" | "space" | "classroom";
    storyCharacterName?: string;
    storyChoices?: number[];
    /**
     * The picture in front of the story sentence.
     *
     * The scene used to pick it, and only from five hardcoded emoji. These three
     * let it be anything: an emoji typed by a teacher or an AI, one of the built-in
     * vector assets, or a drawing from the account's own SVG library. Unset, the
     * scene's emoji is still the default, so existing slides are unchanged.
     */
    storySceneEmoji?: string;
    storySceneAssetType?: string;
    storySceneAssetId?: string;
    placeValueTask?: "build_number" | "read_number" | "regroup_ones";
    placeValueDifficulty?: "guided" | "independent";
    placeValueTarget?: number;
    placeValueShowExpanded?: boolean;
    // Flexible Canvas features
    flexibleMode?: "multichoice" | "textinput" | "dragmatch" | "tapcount";
    flexibleBgStyle?: "clean" | "board" | "grid" | "stars" | "meadow";
    flexibleOptions?: string[];
    flexibleCorrectAnswer?: string;
    flexibleItems?: { id: string; emoji: string; x: number; y: number; targetBin?: string; type?: string }[];
    flexibleTargets?: { id: string; label: string; x: number; y: number; width: number; height: number; acceptEmoji?: string }[];
  };
}

export interface SoundEffectOptions {
  frequency: number;
  type: OscillatorType;
  duration: number;
  volume?: number;
}

// Learning-event log types (LearningEvent, SkillMasterySnapshot, etc.) now
// live in services/logSchema.ts — see that file for the standardized,
// DB-ready analytics schema.
