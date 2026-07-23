/**
 * Column Addition — Component Schema
 *
 * Defines parameters for the multi-digit vertical column-addition tutor with
 * struggle-triggered guidance. Distinct from the Addition Tutor (base-10 blocks
 * / make-a-ten): this one is the standard written algorithm and scales to
 * 3-digit + 3-digit with carries cascading across columns.
 */

import { CountingTechnique, SVG_OBJECTS, EMOJI_OBJECTS } from "../../../../types";
import { ComponentSchema, SchemaAsset } from "./types";
import { ParsedSlideConfig } from "../types";
import { COLUMN_ADDITION_PRESETS } from "../presets";
import {
  buildColumnAdditionModel,
  clampAddend,
  normaliseChallenges,
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
Handles 1-digit + 1-digit through 3-digit + 3-digit, with carries cascading across the ones, tens and hundreds columns.
The student fills one answer box per column (right to left); after two wrong checks an animated walkthrough carries the "1" up between columns, narrated by a caption strip. A "Show me how" guide is always available.`,

  promptSummary: "Vertical column addition (up to 3-digit + 3-digit) with per-column answer boxes and a struggle-triggered carrying animation.",

  topLevelFields: {
    targetCount: { min: 2, max: 1998, default: 31 },
  },

  configFields: [
    {
      key: "num1",
      label: "First Number",
      type: "number",
      defaultValue: 268,
      description: `The first addend, ${ADDEND_MIN}-${ADDEND_MAX}. 1-, 2- and 3-digit are all supported.`,
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
      key: "columnChallenges",
      label: "Practice Problems",
      type: "json",
      jsonShape: '[{"num1":257,"num2":168}]',
      defaultValue: [],
      description: "Optional extra practice problems, as [{num1, num2}]. Omit to auto-derive problems matching the first problem's digit shape and carrying.",
      exposeToAI: false,
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
    "3 digit", "three digit", "268 + 175", "hundreds", "stacked addition",
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
    const columnChallenges = normaliseChallenges(raw.config?.columnChallenges);
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
        ...(columnChallenges.length > 0 ? { columnChallenges } : {}),
      },
    };
  },
};
