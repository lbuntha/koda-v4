/**
 * Pattern Completion Detective — Component Schema
 *
 * Like Sudoku, the AI doesn't construct the sequence + answer directly —
 * an LLM asked to "make sure the last item is the pattern's missing piece"
 * can and does contradict itself. Instead the AI picks two themed emoji and
 * validate() deterministically builds a correct alternating AB-pattern with
 * a matching answer and distractor options.
 *
 * See README.md for the general replication recipe.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { clampInt } from "./assets";

const FALLBACK_A = "🎈";
const FALLBACK_B = "🍪";
const FALLBACK_DISTRACTORS = ["🚗", "🦆"];
const EMOJI_RE = /^\p{Extended_Pictographic}/u;

const PRESETS: AiPreset[] = [
  { id: "pat-balloon-cookie", label: "Balloon, Cookie...", prompt: "Alternating pattern of balloons and cookies", emoji: "🎈", technique: CountingTechnique.KODA_PATTERN, theme: "party" },
  { id: "pat-star-moon", label: "Star, Moon...", prompt: "Alternating pattern of stars and moons for a space theme", emoji: "⭐", technique: CountingTechnique.KODA_PATTERN, theme: "space" },
  { id: "pat-flower-leaf", label: "Flower, Leaf...", prompt: "Alternating pattern of flowers and leaves", emoji: "🌸", technique: CountingTechnique.KODA_PATTERN, theme: "nature" },
];

export const kodaPatternSchema: ComponentSchema = {
  technique: CountingTechnique.KODA_PATTERN,
  name: "Pattern Completion Detective",

  description: `A short AB-repeating emoji sequence is shown with the last slot empty; the child picks the emoji that continues the pattern from multiple-choice options.
The AI supplies two themed emoji (A and B); validate() builds the actual alternating sequence and its answer to guarantee they're always consistent.`,

  promptSummary: "An alternating two-emoji pattern (A, B, A, B, A, ?) — the child picks the emoji that continues it.",

  topLevelFields: { targetCount: { min: 4, max: 8, default: 6 } },

  configFields: [
    {
      key: "emojiA", label: "First Pattern Emoji", type: "string", defaultValue: "🎈",
      description: "The first emoji in the alternating pattern.",
      promptHint: "single emoji matching the theme",
      required: true,
    },
    {
      key: "emojiB", label: "Second Pattern Emoji", type: "string", defaultValue: "🍪",
      description: "The second emoji in the alternating pattern (must differ from emojiA).",
      promptHint: "single emoji matching the theme, different from emojiA",
      required: true,
    },
    {
      key: "distractor1", label: "Distractor Emoji 1", type: "string", defaultValue: "🚗",
      description: "A wrong-answer option shown alongside the correct one.",
      promptHint: "any unrelated single emoji",
    },
    {
      key: "distractor2", label: "Distractor Emoji 2", type: "string", defaultValue: "🦆",
      description: "A second wrong-answer option.",
      promptHint: "any unrelated single emoji, different from distractor1",
    },
    {
      key: "sequenceLength", label: "Sequence Length", type: "number", defaultValue: 6,
      description: "Total visible slots including the blank one (4-8).",
      promptHint: "integer 4-8, even numbers read most naturally",
    },
  ],

  assets: [],

  triggerKeywords: [
    "pattern", "what comes next", "alternating", "repeating pattern",
    "complete the pattern", "pattern detective",
  ],

  exampleOutput: {
    id: "q-ai-balloon-pattern",
    technique: "KODA_PATTERN",
    title: "Party Pattern",
    instruction: "Look at the pattern — what comes next?",
    objectId: "balloon",
    targetCount: 6,
    config: { emojiA: "🎈", emojiB: "🍪", distractor1: "🚗", distractor2: "🦆", sequenceLength: 6 }
  },

  presets: PRESETS,

  tip: "Mention two themed things that alternate. Try: \"Pattern of suns and clouds\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const isEmoji = (v: unknown): v is string => typeof v === "string" && EMOJI_RE.test(v);

    const emojiA = isEmoji(raw.config?.emojiA) ? raw.config.emojiA : FALLBACK_A;
    let emojiB = isEmoji(raw.config?.emojiB) && raw.config.emojiB !== emojiA ? raw.config.emojiB : FALLBACK_B;
    if (emojiB === emojiA) emojiB = emojiA === FALLBACK_A ? FALLBACK_B : FALLBACK_A;

    const usedByPattern = new Set([emojiA, emojiB]);
    const distractors = [raw.config?.distractor1, raw.config?.distractor2]
      .filter((v: unknown) => isEmoji(v) && !usedByPattern.has(v as string));
    while (distractors.length < 2) {
      const fallback = FALLBACK_DISTRACTORS.find(d => !usedByPattern.has(d) && !distractors.includes(d));
      distractors.push(fallback || "🌟");
    }

    const length = clampInt(raw.config?.sequenceLength, 4, 8, 6);
    // AB-repeating sequence with the final slot blank — the answer is always
    // the value that continues the alternation, never inferred from the AI.
    const sequence: string[] = Array.from({ length }, (_, i) => (i % 2 === 0 ? emojiA : emojiB));
    const answer = sequence[length - 1];
    sequence[length - 1] = "";

    // Deterministic option order (varies by slide index, not random) keeps
    // batches from all showing the answer in the same slot.
    const options = [answer, ...distractors];
    const rotate = index % options.length;
    const orderedOptions = [...options.slice(rotate), ...options.slice(0, rotate)];

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.KODA_PATTERN,
      title: String(raw.title || `Pattern Detective ${index + 1}`),
      instruction: String(raw.instruction || "Look at the pattern — what comes next?"),
      objectId: "apple",
      targetCount: length,
      config: {
        patternSequence: sequence,
        // One answer per blank slot (single blank here); the canvas reads this
        // list so a sequence with several gaps can each be filled in order.
        patternAnswers: [answer],
        sudokuOptions: orderedOptions,
      }
    };
  }
};
