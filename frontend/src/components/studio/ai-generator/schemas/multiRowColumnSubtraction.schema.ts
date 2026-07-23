import { CountingTechnique, EMOJI_OBJECTS, SVG_OBJECTS } from "../../../../types";
import {
  buildColumnSubtractionModel,
  normalizeMultiRowSubtractionOperands,
  SUBTRACTION_MAX,
} from "../../../canvases/columnSubtractionModel";
import { MULTI_ROW_COLUMN_SUBTRACTION_PRESETS } from "../presets";
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

export const multiRowColumnSubtractionSchema: ComponentSchema = {
  technique: CountingTechnique.SUBTRACTION_COLUMN_MULTI,
  name: "Multi-Row Column Subtraction",
  description: `Written three-row subtraction in the form top minus row two minus row three.
Values support up to five digits and remain non-negative. Students combine the two lower digits in each place, with borrowing of one or two supported by targeted guidance.`,
  promptSummary: "Three-row vertical subtraction through five digits, combining two lower rows with borrow values up to two.",
  topLevelFields: {
    targetCount: { min: 0, max: SUBTRACTION_MAX, default: 198 },
  },
  configFields: [
    {
      key: "minuend",
      label: "Top Row",
      type: "number",
      defaultValue: 432,
      description: "The starting value, from 0 to 99,999.",
      required: true,
    },
    {
      key: "subtrahend",
      label: "Subtract Row 2",
      type: "number",
      defaultValue: 178,
      description: "The first amount subtracted.",
      required: true,
    },
    {
      key: "subtrahend2",
      label: "Subtract Row 3",
      type: "number",
      defaultValue: 56,
      description: "The second amount subtracted. Both lower rows together cannot exceed the top row.",
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
      description: "Accent colour for borrow marks, active columns, and answers.",
    },
  ],
  assets: ALL_ASSETS,
  triggerKeywords: [
    "three row column subtraction", "3 row column subtraction",
    "multi row subtraction", "subtract two numbers from one",
    "three stacked subtraction rows", "column subtraction with three numbers",
    "multi-subtrahend subtraction", "borrow two", "borrow 2",
  ],
  exampleOutput: {
    id: "q-ai-three-row-subtraction-432-178-56",
    technique: "SUBTRACTION_COLUMN_MULTI",
    title: "Three-Row Subtraction: 432 − 178 − 56",
    instruction: "Subtract 178 and 56 from 432 one column at a time.",
    objectId: "apple",
    targetCount: 198,
    config: {
      minuend: 432,
      subtrahend: 178,
      subtrahend2: 56,
      frameColor: "indigo",
    },
  },
  presets: MULTI_ROW_COLUMN_SUBTRACTION_PRESETS,
  tip: "Mention a top value and two amounts to subtract. Example: “Use three-row column subtraction for 432 minus 178 minus 56.”",
  validate(raw: any, index: number): ParsedSlideConfig {
    const operands = normalizeMultiRowSubtractionOperands(
      raw.config?.minuend ?? 432,
      raw.config?.subtrahend ?? 178,
      raw.config?.subtrahend2 ?? 56,
    );
    const model = buildColumnSubtractionModel(
      operands.minuend,
      operands.subtrahend,
      operands.subtrahend2,
    );
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const frameColor = VALID_COLORS.includes(raw.config?.frameColor) ? raw.config.frameColor : "indigo";
    return {
      id: raw.id || `q-ai-three-row-subtraction-${Date.now()}-${index}`,
      technique: CountingTechnique.SUBTRACTION_COLUMN_MULTI,
      title: String(raw.title || `Three-Row Subtraction: ${operands.minuend} − ${operands.subtrahend} − ${operands.subtrahend2}`),
      instruction: String(raw.instruction || `Subtract ${operands.subtrahend} and ${operands.subtrahend2} from ${operands.minuend}, one column at a time.`),
      objectId,
      targetCount: model.difference,
      config: {
        ...operands,
        assetType: objectId,
        frameColor,
      },
    };
  },
};
