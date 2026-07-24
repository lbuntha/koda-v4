/**
 * Equal Groups (Multiplication) — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, clampInt, assetTypeField } from "./assets";

const PRESETS: AiPreset[] = [
  { id: "mul-3x4", label: "3 Rows of 4", prompt: "Build an array of 3 rows and 4 columns of apples", emoji: "🍎", technique: CountingTechnique.MULTIPLICATION_ARRAY, theme: "kitchen" },
  { id: "mul-2x5", label: "2 Rows of 5", prompt: "Make equal groups: 2 rows of 5 stars", emoji: "⭐", technique: CountingTechnique.MULTIPLICATION_ARRAY, theme: "space" },
  { id: "mul-4x3", label: "4 Rows of 3", prompt: "Fill an array of 4 rows and 3 columns of flowers", emoji: "🌸", technique: CountingTechnique.MULTIPLICATION_ARRAY, theme: "nature" },
];

export const multiplicationSchema: ComponentSchema = {
  technique: CountingTechnique.MULTIPLICATION_ARRAY,
  name: "Equal Groups (Multiplication)",

  description: `Students tap placeholders to fill a "rows" x "cols" array grid, building the concept of multiplication as equal groups (rows x cols = total).
The header shows the live equation (rows × cols = filled count).`,

  promptSummary: "Child taps placeholders to fill a `rows` × `cols` grid array, building rows × cols as repeated equal groups.",

  topLevelFields: { targetCount: { min: 2, max: 30, default: 12 } },

  configFields: [
    {
      key: "rows", label: "Rows", type: "number", defaultValue: 3,
      description: "Number of rows in the array (1-6).",
      promptHint: "integer 1-6",
      required: true,
    },
    {
      key: "cols", label: "Columns", type: "number", defaultValue: 4,
      description: "Number of columns in the array (1-6).",
      promptHint: "integer 1-6",
      required: true,
    },
    {
      key: "requireAnswerInput", label: "Answer Input Box", type: "boolean", defaultValue: true,
      description: "Require typing/selecting answer after filling the array.", exposeToAI: false,
    },
    assetTypeField("apple"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "multiply", "multiplication", "times", "equal groups", "array",
    "rows of", "rows and columns", "groups of",
  ],

  exampleOutput: {
    id: "q-ai-apples-array",
    technique: "MULTIPLICATION_ARRAY",
    title: "Apple Array",
    instruction: "Tap all the placeholders to build 3 rows of 4 apples!",
    objectId: "apple",
    targetCount: 12,
    config: { rows: 3, cols: 4 }
  },

  presets: PRESETS,

  tip: "Mention rows and columns, or 'N groups of M'. Try: \"Make an array of 5 rows and 2 columns of ducks\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const rows = clampInt(raw.config?.rows, 1, 6, 3);
    const cols = clampInt(raw.config?.cols, 1, 6, 4);
    const total = rows * cols;

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.MULTIPLICATION_ARRAY,
      title: String(raw.title || `Equal Groups ${index + 1}`),
      instruction: String(
        raw.instruction || `Tap all the placeholders to build ${rows} rows of ${cols}!`
      ),
      objectId,
      targetCount: total,
      config: {
        rows,
        cols,
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
