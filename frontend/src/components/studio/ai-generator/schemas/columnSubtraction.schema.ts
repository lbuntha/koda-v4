import { CountingTechnique, EMOJI_OBJECTS, SVG_OBJECTS } from "../../../../types";
import {
  buildColumnSubtractionModel,
  normalizeSubtractionOperands,
  SUBTRACTION_MAX,
} from "../../../canvases/columnSubtractionModel";
import { COLUMN_SUBTRACTION_PRESETS } from "../presets";
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

export const columnSubtractionSchema: ComponentSchema = {
  technique: CountingTechnique.SUBTRACTION_COLUMN,
  name: "Column Subtraction",
  description: `Written column subtraction for non-negative problems from one through five digits.
Borrowing/regrouping can cascade through zeroes. Students solve from ones to ten-thousands, retain correct columns after mistakes, and can request a targeted or full narrated walkthrough.`,
  promptSummary: "Vertical subtraction through five digits with place-value labels, cascading borrowing, progressive hints, and an optional controlled walkthrough.",
  topLevelFields: {
    targetCount: { min: 0, max: SUBTRACTION_MAX, default: 254 },
  },
  configFields: [
    {
      key: "minuend",
      label: "Top Number",
      type: "number",
      defaultValue: 432,
      description: `The starting value, from 0 to ${SUBTRACTION_MAX}.`,
      required: true,
    },
    {
      key: "subtrahend",
      label: "Number to Subtract",
      type: "number",
      defaultValue: 178,
      description: "The amount removed. It must be no greater than the top number.",
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
      description: "Accent colour for borrowing marks, active columns, and answers.",
    },
  ],
  assets: ALL_ASSETS,
  triggerKeywords: [
    "column subtraction", "vertical subtraction", "subtraction with borrowing",
    "borrowing subtraction", "regrouping subtraction", "subtract in columns",
    "long subtraction", "stacked subtraction", "five digit subtraction",
    "multi digit subtraction", "standard subtraction algorithm",
  ],
  exampleOutput: {
    id: "q-ai-column-subtraction-432-178",
    technique: "SUBTRACTION_COLUMN",
    title: "Column Subtraction: 432 − 178",
    instruction: "Subtract 178 from 432 one column at a time, borrowing when needed.",
    objectId: "apple",
    targetCount: 254,
    config: {
      minuend: 432,
      subtrahend: 178,
      frameColor: "indigo",
    },
  },
  presets: COLUMN_SUBTRACTION_PRESETS,
  tip: "Mention both numbers and say column subtraction or borrowing. Example: “Use column subtraction for 10,000 minus 1.”",
  validate(raw: any, index: number): ParsedSlideConfig {
    const operands = normalizeSubtractionOperands(
      raw.config?.minuend ?? 432,
      raw.config?.subtrahend ?? 178,
    );
    const model = buildColumnSubtractionModel(operands.minuend, operands.subtrahend);
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const frameColor = VALID_COLORS.includes(raw.config?.frameColor) ? raw.config.frameColor : "indigo";
    return {
      id: raw.id || `q-ai-column-subtraction-${Date.now()}-${index}`,
      technique: CountingTechnique.SUBTRACTION_COLUMN,
      title: String(raw.title || `Column Subtraction: ${model.minuend} − ${model.subtrahend}`),
      instruction: String(raw.instruction || `Subtract ${model.subtrahend} from ${model.minuend}, one column at a time.`),
      objectId,
      targetCount: model.difference,
      config: {
        minuend: model.minuend,
        subtrahend: model.subtrahend,
        assetType: objectId,
        frameColor,
      },
    };
  },
};
