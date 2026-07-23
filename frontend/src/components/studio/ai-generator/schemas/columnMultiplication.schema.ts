import { CountingTechnique, EMOJI_OBJECTS, SVG_OBJECTS } from "../../../../types";
import {
  MULTIPLICAND_MAX,
  MULTIPLIER_MAX,
  buildColumnMultiplicationModel,
  clampMultiplicand,
  clampMultiplier,
} from "../../../canvases/columnMultiplicationModel";
import { COLUMN_MULTIPLICATION_PRESETS } from "../presets";
import { ParsedSlideConfig } from "../types";
import { ComponentSchema, SchemaAsset } from "./types";

const ALL_ASSETS: SchemaAsset[] = [...SVG_OBJECTS, ...EMOJI_OBJECTS].map(asset => ({
  id: asset.id,
  emoji: asset.emoji,
  label: asset.label,
  renderType: SVG_OBJECTS.some(vector => vector.id === asset.id) ? "vector" as const : "emoji" as const,
}));
const VALID_ASSET_IDS = ALL_ASSETS.map(asset => asset.id);
const VALID_COLORS = ["indigo", "emerald", "purple", "pink", "rose"];

export const columnMultiplicationSchema: ComponentSchema = {
  technique: CountingTechnique.MULTIPLICATION_COLUMN,
  name: "Column Multiplication",
  description: `Standard written multiplication using per-digit partial products.
Supports a five-digit multiplicand and a three-digit multiplier. Students complete each shifted partial-product row, carry within that row, and then add the rows for the final product.`,
  promptSummary: "Written column multiplication with carries, shifted partial products, and a final partial-product sum.",
  topLevelFields: {
    targetCount: { min: 0, max: MULTIPLICAND_MAX * MULTIPLIER_MAX, default: 13_104 },
  },
  configFields: [
    {
      key: "multiplicand",
      label: "Top Number",
      type: "number",
      defaultValue: 234,
      description: `The multiplicand, from 0 to ${MULTIPLICAND_MAX}.`,
      required: true,
    },
    {
      key: "multiplier",
      label: "Multiplier",
      type: "number",
      defaultValue: 56,
      description: `The multiplier, from 0 to ${MULTIPLIER_MAX}. Each digit creates one partial-product row.`,
      required: true,
    },
    {
      key: "assetType",
      label: "Asset Type",
      type: "enum",
      enumValues: [...VALID_ASSET_IDS],
      defaultValue: "apple",
      description: "Reserved for worksheet theme compatibility.",
      exposeToAI: false,
    },
    {
      key: "frameColor",
      label: "Frame Color Theme",
      type: "enum",
      enumValues: VALID_COLORS,
      defaultValue: "indigo",
      description: "Accent colour for active digits, carries, and controls.",
    },
  ],
  assets: ALL_ASSETS,
  triggerKeywords: [
    "column multiplication", "vertical multiplication", "long multiplication",
    "standard multiplication algorithm", "partial products", "multiply in columns",
    "stacked multiplication", "multiplication with carrying", "multi digit multiplication",
    "five digit multiplication", "three digit multiplier",
  ],
  exampleOutput: {
    id: "q-ai-column-multiplication-234-56",
    technique: "MULTIPLICATION_COLUMN",
    title: "Column Multiplication: 234 × 56",
    instruction: "Multiply 234 by 56 using shifted partial products.",
    objectId: "apple",
    targetCount: 13_104,
    config: {
      multiplicand: 234,
      multiplier: 56,
      frameColor: "indigo",
    },
  },
  presets: COLUMN_MULTIPLICATION_PRESETS,
  tip: "Mention two factors and say column or long multiplication. Example: “Use column multiplication for 234 times 56.”",
  validate(raw: any, index: number): ParsedSlideConfig {
    const multiplicand = clampMultiplicand(raw.config?.multiplicand ?? 234);
    const multiplier = clampMultiplier(raw.config?.multiplier ?? 56);
    const model = buildColumnMultiplicationModel(multiplicand, multiplier);
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const frameColor = VALID_COLORS.includes(raw.config?.frameColor) ? raw.config.frameColor : "indigo";
    return {
      id: raw.id || `q-ai-column-multiplication-${Date.now()}-${index}`,
      technique: CountingTechnique.MULTIPLICATION_COLUMN,
      title: String(raw.title || `Column Multiplication: ${multiplicand} × ${multiplier}`),
      instruction: String(raw.instruction || `Multiply ${multiplicand} by ${multiplier} using partial products.`),
      objectId,
      targetCount: model.product,
      config: {
        multiplicand,
        multiplier,
        assetType: objectId,
        frameColor,
      },
    };
  },
};
