/**
 * Addition Tutor — Component Schema
 *
 * Defines parameters for the guided base-10 addition tutor.
 */

import { CountingTechnique, SVG_OBJECTS, EMOJI_OBJECTS } from "../../../../types";
import { ComponentSchema, SchemaAsset } from "./types";
import { ParsedSlideConfig } from "../types";
import { ADDITION_TUTOR_PRESETS } from "../presets";
import {
  clampAddend,
  normaliseChallenges,
  ADDEND_MIN,
  ADDEND_MAX,
} from "../../../canvases/additionTutorModel";

const VECTOR_ASSETS: SchemaAsset[] = SVG_OBJECTS.map(obj => ({
  id: obj.id,
  emoji: obj.emoji,
  label: obj.label,
  renderType: "vector" as const,
}));

const EMOJI_ASSETS: SchemaAsset[] = EMOJI_OBJECTS.map(obj => ({
  id: obj.id,
  emoji: obj.emoji,
  label: obj.label,
  renderType: "emoji" as const,
}));

const ALL_ASSETS = [...VECTOR_ASSETS, ...EMOJI_ASSETS];
const VALID_ASSET_IDS = ALL_ASSETS.map(a => a.id);
const VALID_COLORS = ["indigo", "emerald", "purple", "pink", "rose"];

export const additionTutorSchema: ComponentSchema = {
  technique: CountingTechnique.ADDITION_TUTOR,
  name: "Addition Tutor",

  description: `Guided interactive step-by-step tutorial board demonstrating carrying and 'make ten' grouping strategies for addition.
Adapts to the numbers given: supports 1-digit + 1-digit, 2-digit + 1-digit, 1-digit + 2-digit and 2-digit + 2-digit, and automatically skips the make-a-ten steps when the ones column does not overflow.
Moves through CPA phases — build both numbers from tens rods and one units, bundle ten ones into a new rod, deconstruct into symbols, read the vertical standard algorithm, then practise.`,

  topLevelFields: {
    targetCount: { min: 2, max: 198, default: 25 }
  },

  configFields: [
    {
      key: "num1",
      label: "First Number",
      type: "number",
      defaultValue: 18,
      description: `The first addend, ${ADDEND_MIN}-${ADDEND_MAX}. Single- and double-digit are both supported (1+1, 2+1, 1+2 and 2+2 digit problems all work).`,
      required: true,
    },
    {
      key: "num2",
      label: "Second Number",
      type: "number",
      defaultValue: 7,
      description: `The second addend, ${ADDEND_MIN}-${ADDEND_MAX}. If the two ones digits sum to 10 or more the tutor teaches carrying; otherwise it automatically skips the make-a-ten steps.`,
      required: true,
    },
    {
      key: "tutorChallenges",
      label: "Practice Challenges",
      type: "json",
      defaultValue: [],
      description: "Optional fluency problems for the final phase, as [{num1, num2}]. Omit or leave empty to auto-derive three problems matching the lesson's digit shape and regrouping.",
    },
    {
      key: "assetType",
      label: "Asset Type",
      type: "enum",
      enumValues: [...VALID_ASSET_IDS],
      defaultValue: "apple",
      description: "Draggable item representation asset (e.g. apple or red_dot).",
    },
    {
      key: "frameColor",
      label: "Frame Color Theme",
      type: "enum",
      enumValues: VALID_COLORS,
      defaultValue: "indigo",
      description: "Color theme for background accents and visual boxes.",
    }
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "add", "plus", "sum", "tutor", "addition", "guided addition", "carry",
    "making ten", "make ten", "regroup", "regrouping", "base 10", "base ten",
    "base-10", "double digit", "two digit", "2 digit", "18+7", "addition tutorial"
  ],

  exampleOutput: {
    id: "q-ai-addition-18-7",
    technique: "ADDITION_TUTOR",
    title: "Orchard Math: 18 + 7",
    instruction: "Help Koda gather 18 red apples and 7 green apples, then group them into tens to find the sum!",
    objectId: "apple",
    targetCount: 25,
    config: {
      num1: 18,
      num2: 7,
      assetType: "apple",
      frameColor: "indigo"
    }
  },

  presets: ADDITION_TUTOR_PRESETS,

  validate(raw: any, index: number): ParsedSlideConfig {
    const num1 = clampAddend(raw.config?.num1 ?? 18);
    const num2 = clampAddend(raw.config?.num2 ?? 7);
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const frameColor = VALID_COLORS.includes(raw.config?.frameColor) ? raw.config.frameColor : "indigo";
    // Empty means "derive them" — the canvas fills in shape-matched problems.
    const tutorChallenges = normaliseChallenges(raw.config?.tutorChallenges);

    return {
      id: raw.id || `q-ai-tutor-${Date.now()}-${index}`,
      technique: CountingTechnique.ADDITION_TUTOR,
      title: String(raw.title || `Addition Tutor: ${num1} + ${num2}`),
      instruction: String(raw.instruction || `Learn how to add ${num1} and ${num2} together!`),
      objectId,
      targetCount: num1 + num2,
      config: {
        num1,
        num2,
        assetType: objectId,
        frameColor,
        ...(tutorChallenges.length > 0 ? { tutorChallenges } : {}),
      }
    };
  }
};
