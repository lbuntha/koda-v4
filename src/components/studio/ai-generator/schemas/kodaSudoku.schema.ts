/**
 * Koda Sudoku — Component Schema
 *
 * Deliberately does NOT ask the AI to invent the actual 4x4 grid: solving a
 * Latin square with box constraints is exactly the kind of constraint problem
 * LLMs get wrong, and a broken puzzle is a broken slide. Instead the AI picks
 * a theme (emoji set) and difficulty; validate() builds a certified-valid
 * puzzle from a hardcoded solved grid by relabeling symbols and removing
 * cells. Cheaper (no grid in the prompt or response) AND always correct.
 *
 * See README.md for the general replication recipe.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { clampInt } from "./assets";

/**
 * A certified-valid 4x4 sudoku solution, expressed as symbol INDICES (0-3).
 * Verified: every row, column, and 2x2 box contains each index exactly once.
 * Relabeling indices → symbols (any bijection) preserves validity, so this
 * one grid produces unlimited valid puzzles for any 4-symbol theme.
 */
const SOLUTION_INDEX_GRID: number[][] = [
  [0, 1, 2, 3],
  [2, 3, 0, 1],
  [3, 0, 1, 2],
  [1, 2, 3, 0],
];

/** Deterministic clue pattern per difficulty — same difficulty always removes the same cells, only the symbols change. */
const CLUE_PATTERNS: Record<"easy" | "medium" | "hard", boolean[]> = {
  // true = pre-filled clue, false = blank for the child to solve
  easy:   [true, true, false, true,  true, false, true, true,  false, true, true, false,  true, false, true, true],
  medium: [true, false, true, false,  false, true, false, true,  true, false, true, false,  false, true, false, true],
  hard:   [true, false, false, false,  false, true, false, false,  false, false, true, false,  false, false, false, true],
};

const DEFAULT_EMOJIS = ["🍎", "🧁", "🦆", "⭐"];

const PRESETS: AiPreset[] = [
  { id: "sdk-fruit-easy", label: "Fruit Sudoku (Easy)", prompt: "Easy 4x4 sudoku with apple, banana, grape, and orange emojis", emoji: "🍎", technique: CountingTechnique.KODA_SUDOKU, theme: "kitchen" },
  { id: "sdk-space-medium", label: "Space Sudoku (Medium)", prompt: "Medium difficulty 4x4 sudoku with rocket, star, moon, and planet", emoji: "🚀", technique: CountingTechnique.KODA_SUDOKU, theme: "space" },
  { id: "sdk-numbers-hard", label: "Numbers Sudoku (Hard)", prompt: "Hard 4x4 sudoku using numbers 1 to 4", emoji: "🔢", technique: CountingTechnique.KODA_SUDOKU, theme: "classic" },
];

export const kodaSudokuSchema: ComponentSchema = {
  technique: CountingTechnique.KODA_SUDOKU,
  name: "Koda Sudoku",

  description: `A 4x4 logic grid: no repeated symbol in any row, column, or 2x2 box. Students drag symbols (numbers or 4 themed emoji) from a tray into empty cells.
The AI only picks the theme and difficulty — the actual puzzle grid is generated deterministically to guarantee it's always solvable and valid.`,

  promptSummary: "A 4x4 Koda Sudoku logic grid using either numbers or 4 themed emoji symbols, at a chosen difficulty.",

  topLevelFields: { targetCount: { min: 4, max: 16, default: 8 } },

  configFields: [
    {
      key: "sudokuSymbolType", label: "Symbol Type", type: "enum",
      enumValues: ["numbers", "emojis"], defaultValue: "numbers",
      description: "Whether the grid uses digits 1-4 or 4 themed emoji.",
      promptHint: "'emojis' if the teacher named a theme, else 'numbers'",
    },
    {
      key: "sudokuOptions", label: "Theme Emojis", type: "string", defaultValue: "🍎,🧁,🦆,⭐",
      description: "Exactly 4 distinct emoji matching the theme, comma-separated. Only used when sudokuSymbolType is 'emojis'.",
      promptHint: "exactly 4 distinct emoji matching the theme, comma-separated",
    },
    {
      key: "difficulty", label: "Difficulty", type: "enum",
      enumValues: ["easy", "medium", "hard"], defaultValue: "easy",
      description: "How many cells are pre-filled: easy=more clues, hard=fewer clues.",
      promptHint: "easy/medium/hard based on the teacher's request",
    },
    {
      key: "rows", label: "Grid Rows", type: "number", defaultValue: 4,
      description: "Fixed at 4 — the only size with a verified puzzle generator.",
      exposeToAI: false,
    },
    {
      key: "cols", label: "Grid Columns", type: "number", defaultValue: 4,
      description: "Fixed at 4.", exposeToAI: false,
    },
  ],

  assets: [],

  triggerKeywords: [
    "sudoku", "logic grid", "no repeats", "4x4 grid", "puzzle grid",
    "logic puzzle", "row column box",
  ],

  exampleOutput: {
    id: "q-ai-fruit-sudoku",
    technique: "KODA_SUDOKU",
    title: "Fruit Sudoku",
    instruction: "Drag the fruit emojis so no row, column, or box repeats!",
    objectId: "apple",
    targetCount: 8,
    config: { sudokuSymbolType: "emojis", sudokuOptions: "🍎,🧁,🦆,⭐", difficulty: "easy" }
  },

  presets: PRESETS,

  tip: "Mention a theme (for emoji) or 'numbers', and a difficulty. Try: \"Hard sudoku with dinosaur, car, bear, duck\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const symbolType: "numbers" | "emojis" = raw.config?.sudokuSymbolType === "emojis" ? "emojis" : "numbers";

    let symbols: string[];
    if (symbolType === "emojis") {
      const parsed = String(raw.config?.sudokuOptions || "")
        .split(",").map((s: string) => s.trim()).filter(Boolean);
      // Must be exactly 4 distinct symbols or the puzzle has no valid solution.
      const distinct = Array.from(new Set(parsed));
      symbols = distinct.length === 4 ? distinct : DEFAULT_EMOJIS;
    } else {
      symbols = ["1", "2", "3", "4"];
    }

    const difficulty: "easy" | "medium" | "hard" =
      ["easy", "medium", "hard"].includes(raw.config?.difficulty) ? raw.config.difficulty : "easy";
    const clueMask = CLUE_PATTERNS[difficulty];

    const solutionGrid = SOLUTION_INDEX_GRID.map(row => row.map(i => symbols[i]));
    const startingGrid = SOLUTION_INDEX_GRID.map((row, r) =>
      row.map((i, c) => (clueMask[r * 4 + c] ? symbols[i] : ""))
    );
    const clueCount = clueMask.filter(Boolean).length;

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.KODA_SUDOKU,
      title: String(raw.title || `Sudoku Challenge ${index + 1}`),
      instruction: String(raw.instruction || "Drag symbols so no row, column, or box repeats!"),
      objectId: "apple",
      targetCount: clampInt(this.topLevelFields.targetCount.default, this.topLevelFields.targetCount.min, this.topLevelFields.targetCount.max, 16 - clueCount),
      config: {
        rows: 4,
        cols: 4,
        sudokuSymbolType: symbolType,
        sudokuOptions: symbols,
        sudokuStartingGrid: startingGrid,
        sudokuSolution: solutionGrid,
      }
    };
  }
};
