/**
 * Column Addition — Component Schema
 *
 * Defines parameters for the multi-digit vertical column-addition tutor with
 * struggle-triggered guidance. Distinct from the Addition Tutor (base-10 blocks
 * / make-a-ten): this one is the standard written algorithm and scales to
 * 5-digit + 5-digit with carries cascading across columns.
 */

import { CountingTechnique, SVG_OBJECTS, EMOJI_OBJECTS } from "../../../../types";
import { ComponentSchema, SchemaAsset } from "./types";
import { ParsedSlideConfig } from "../types";
import { COLUMN_ADDITION_PRESETS } from "../presets";
import {
  buildColumnAdditionModel,
  clampAddend,
  ADDEND_MIN,
  ADDEND_MAX,
} from "../../../canvases/columnAdditionModel";

const VECTOR_ASSETS: SchemaAsset[] = SVG_OBJECTS.map(obj => ({
  id: obj.id, emoji: obj.emoji, label: obj.label, renderType: "vector" as const,
}));
const EMOJI_ASSETS: SchemaAsset[] = EMOJI_OBJECTS.map(obj => ({
  id: obj.id, emoji: obj.emoji, label: obj.label, renderType: "emoji" as const,
}));
const ALL_ASSETS = [...VECTOR_ASSETS, ...EMOJI_ASSETS];
const VALID_ASSET_IDS = ALL_ASSETS.map(a => a.id);
const VALID_COLORS = ["indigo", "emerald", "purple", "pink", "rose"];

export const columnAdditionSchema: ComponentSchema = {
  technique: CountingTechnique.ADDITION_COLUMN,
  name: "Column Addition",

  description: `Multi-digit vertical column-addition tutor using the standard written algorithm.
Handles 1-digit + 1-digit through 5-digit + 5-digit, with carries cascading through the ten-thousands column and into a six-digit answer.
The student fills one answer box per column (right to left); after two wrong checks an animated walkthrough carries the "1" up between columns, narrated by a caption strip. A "Show me how" guide is always available.`,

  promptSummary: "Vertical column addition (up to 5-digit + 5-digit) with place-value labels, per-column answer boxes, and a struggle-triggered carrying animation.",

  topLevelFields: {
    targetCount: { min: 0, max: ADDEND_MAX * 2, default: 443 },
  },

  configFields: [
    {
      key: "num1",
      label: "First Number",
      type: "number",
      defaultValue: 268,
      description: `The first addend, ${ADDEND_MIN}-${ADDEND_MAX}. One- through five-digit numbers are supported.`,
      required: true,
    },
    {
      key: "num2",
      label: "Second Number",
      type: "number",
      defaultValue: 175,
      description: `The second addend, ${ADDEND_MIN}-${ADDEND_MAX}. Carries are computed per column automatically.`,
      required: true,
    },
    {
      key: "assetType",
      label: "Asset Type",
      type: "enum",
      enumValues: [...VALID_ASSET_IDS],
      defaultValue: "apple",
      description: "Themed item (unused on the board today; kept for parity with other components).",
      exposeToAI: false,
    },
    {
      key: "frameColor",
      label: "Frame Color Theme",
      type: "enum",
      enumValues: VALID_COLORS,
      defaultValue: "indigo",
      description: "Accent color for the carry badge, active column and answer digits.",
    },
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "column addition", "vertical addition", "standard algorithm", "carrying",
    "carry", "regroup", "regrouping", "add in columns", "long addition",
    "3 digit", "three digit", "5 digit", "five digit", "ten-thousands",
    "268 + 175", "hundreds", "stacked addition",
  ],

  exampleOutput: {
    id: "q-ai-column-268-175",
    technique: "ADDITION_COLUMN",
    title: "Column Addition: 268 + 175",
    instruction: "Add 268 and 175 one column at a time, carrying when a column reaches ten.",
    objectId: "apple",
    targetCount: 443,
    config: {
      num1: 268,
      num2: 175,
      frameColor: "indigo",
    },
  },

  presets: COLUMN_ADDITION_PRESETS,

  validate(raw: any, index: number): ParsedSlideConfig {
    const num1 = clampAddend(raw.config?.num1 ?? 268);
    const num2 = clampAddend(raw.config?.num2 ?? 175);
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const frameColor = VALID_COLORS.includes(raw.config?.frameColor) ? raw.config.frameColor : "indigo";
    const model = buildColumnAdditionModel(num1, num2);

    return {
      id: raw.id || `q-ai-column-${Date.now()}-${index}`,
      technique: CountingTechnique.ADDITION_COLUMN,
      title: String(raw.title || `Column Addition: ${num1} + ${num2}`),
      instruction: String(raw.instruction || `Add ${num1} and ${num2} one column at a time.`),
      objectId,
      targetCount: model.sum,
      config: {
        num1,
        num2,
        assetType: objectId,
        frameColor,
      },
    };
  },
};
