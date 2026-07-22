/**
 * One-to-One Correspondence — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, clampInt, assetTypeField } from "./assets";

const PATTERNS = ["line", "circle", "wave", "grid", "columns", "pairs", "scatter"] as const;

const PRESETS: AiPreset[] = [
  { id: "o2o-apples-line", label: "Apples in a Row", prompt: "Tap and count 6 apples lined up in a row", emoji: "🍎", technique: CountingTechnique.ONE_TO_ONE, theme: "kitchen" },
  { id: "o2o-stars-circle", label: "Stars in a Circle", prompt: "Count 8 stars arranged in a circle", emoji: "⭐", technique: CountingTechnique.ONE_TO_ONE, theme: "space" },
  { id: "o2o-ducks-scatter", label: "Scattered Ducks", prompt: "Count 5 ducks scattered around the pond", emoji: "🦆", technique: CountingTechnique.ONE_TO_ONE, theme: "nature" },
  { id: "o2o-balloons-pairs", label: "Balloon Pairs", prompt: "Count 6 balloons arranged in pairs", emoji: "🎈", technique: CountingTechnique.ONE_TO_ONE, theme: "party" },
];

export const oneToOneSchema: ComponentSchema = {
  technique: CountingTechnique.ONE_TO_ONE,
  name: "One-to-One Correspondence",

  description: `Students tap each object exactly once to count it, in any order. A number bubble appears on tap.
Items can be arranged in a line, circle, wave, grid, columns, pairs, or scattered — this is purely visual layout, doesn't affect the math.`,

  promptSummary: "Child taps each of `targetCount` items exactly once, in any order, to count them.",

  topLevelFields: { targetCount: { min: 1, max: 12, default: 6 } },

  configFields: [
    {
      key: "pattern", label: "Layout Pattern", type: "enum",
      enumValues: [...PATTERNS], defaultValue: "grid",
      description: "Visual arrangement of the items.",
      promptHint: "pick to match theme: circle for stars/wreaths, line for a row, scatter for a pond/meadow",
    },
    assetTypeField("apple"),
    {
      key: "showNumbersOnTap", label: "Show Count Bubble", type: "boolean", defaultValue: true,
      description: "Teacher-facing display toggle.", exposeToAI: false,
    },
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "tap and count", "touch and count", "one by one", "one at a time",
    "count each", "count the", "how many are there", "tap each",
  ],

  exampleOutput: {
    id: "q-ai-apples-row",
    technique: "ONE_TO_ONE",
    title: "Count the Apples",
    instruction: "Tap each apple one by one: 1, 2, 3, 4, 5, 6!",
    objectId: "apple",
    targetCount: 6,
    config: { pattern: "line" }
  },

  presets: PRESETS,

  tip: "Mention a count, an object, and optionally an arrangement. Try: \"Count 7 stars in a circle\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const { min, max, default: def } = this.topLevelFields.targetCount;
    const targetCount = clampInt(raw.targetCount, min, max, def);
    const pattern = PATTERNS.includes(raw.config?.pattern) ? raw.config.pattern : "grid";

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.ONE_TO_ONE,
      title: String(raw.title || `Counting Activity ${index + 1}`),
      instruction: String(raw.instruction || `Tap each item to count: up to ${targetCount}!`),
      objectId,
      targetCount,
      config: {
        pattern,
        assetType: resolveAssetType(objectId),
        showNumbersOnTap: true,
      }
    };
  }
};
