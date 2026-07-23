import { CountingTechnique, EMOJI_OBJECTS, SVG_OBJECTS } from "../../../../types";
import {
  ADDEND_MAX,
  buildColumnAdditionModel,
  clampAddend,
} from "../../../canvases/columnAdditionModel";
import { MULTI_ROW_COLUMN_ADDITION_PRESETS } from "../presets";
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

export const multiRowColumnAdditionSchema: ComponentSchema = {
  technique: CountingTechnique.ADDITION_COLUMN_MULTI,
  name: "Multi-Row Column Addition",
  description: `Written column addition with exactly three addend rows.
Each addend supports up to five digits. Column totals may reach 29, so students learn to carry either 1 or 2 into the next place with optional targeted guidance.`,
  promptSummary: "Three-row vertical column addition through five digits, including carries of one or two and a controlled narrated walkthrough.",
  topLevelFields: {
    targetCount: { min: 0, max: ADDEND_MAX * 3, default: 792 },
  },
  configFields: [
    {
      key: "num1",
      label: "First Row",
      type: "number",
      defaultValue: 268,
      description: "The first addend, from 0 to 99,999.",
      required: true,
    },
    {
      key: "num2",
      label: "Second Row",
      type: "number",
      defaultValue: 175,
      description: "The second addend, from 0 to 99,999.",
      required: true,
    },
    {
      key: "num3",
      label: "Third Row",
      type: "number",
      defaultValue: 349,
      description: "The third addend, from 0 to 99,999.",
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
      description: "Accent colour for carries, active columns, and answers.",
    },
  ],
  assets: ALL_ASSETS,
  triggerKeywords: [
    "three row column addition", "3 row column addition", "three addends",
    "three number column addition", "add three numbers vertically",
    "multi row addition", "multi-addend addition", "three stacked numbers",
    "column addition with three numbers", "carry 2", "carry two",
  ],
  exampleOutput: {
    id: "q-ai-three-row-addition-268-175-349",
    technique: "ADDITION_COLUMN_MULTI",
    title: "Three-Row Addition: 268 + 175 + 349",
    instruction: "Add 268, 175, and 349 one column at a time.",
    objectId: "apple",
    targetCount: 792,
    config: {
      num1: 268,
      num2: 175,
      num3: 349,
      frameColor: "indigo",
    },
  },
  presets: MULTI_ROW_COLUMN_ADDITION_PRESETS,
  tip: "Mention three numbers and say three-row column addition. Example: “Add 999, 999, and 999 vertically.”",
  validate(raw: any, index: number): ParsedSlideConfig {
    const num1 = clampAddend(raw.config?.num1 ?? 268);
    const num2 = clampAddend(raw.config?.num2 ?? 175);
    const num3 = clampAddend(raw.config?.num3 ?? 349);
    const model = buildColumnAdditionModel(num1, num2, num3);
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const frameColor = VALID_COLORS.includes(raw.config?.frameColor) ? raw.config.frameColor : "indigo";
    return {
      id: raw.id || `q-ai-three-row-addition-${Date.now()}-${index}`,
      technique: CountingTechnique.ADDITION_COLUMN_MULTI,
      title: String(raw.title || `Three-Row Addition: ${num1} + ${num2} + ${num3}`),
      instruction: String(raw.instruction || `Add ${num1}, ${num2}, and ${num3} one column at a time.`),
      objectId,
      targetCount: model.sum,
      config: {
        num1,
        num2,
        num3,
        assetType: objectId,
        frameColor,
      },
    };
  },
};
