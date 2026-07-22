/**
 * Addition Sandbox — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, clampInt, assetTypeField } from "./assets";

const PRESETS: AiPreset[] = [
  { id: "add-apples-3plus2", label: "3 + 2 Apples", prompt: "Add 3 apples and 2 more apples into the basket", emoji: "🍎", technique: CountingTechnique.ADDITION_SANDBOX, theme: "kitchen" },
  { id: "add-balloons-4plus3", label: "4 + 3 Balloons", prompt: "Combine 4 red balloons and 3 blue balloons", emoji: "🎈", technique: CountingTechnique.ADDITION_SANDBOX, theme: "party" },
  { id: "add-stars-5plus4", label: "5 + 4 Stars", prompt: "Add 5 stars and 4 more stars together", emoji: "⭐", technique: CountingTechnique.ADDITION_SANDBOX, theme: "space" },
];

export const additionSchema: ComponentSchema = {
  technique: CountingTechnique.ADDITION_SANDBOX,
  name: "Addition Sandbox",

  description: `Students see two labeled groups (Group 1: addend1 items, Group 2: addend2 items) and drag both into a basket, watching the live sum. Supports three CPA representations.
The header shows the live equation (addend1 + addend2 = basketCount).`,

  promptSummary: "Child drags items from two groups (`addend1` and `addend2`) into a shared basket, building the sum addend1 + addend2.",

  topLevelFields: { targetCount: { min: 2, max: 18, default: 5 } },

  configFields: [
    {
      key: "addend1", label: "First Group Size", type: "number", defaultValue: 3,
      description: "How many items are in the first group (1-9).",
      promptHint: "integer 1-9",
      required: true,
    },
    {
      key: "addend2", label: "Second Group Size", type: "number", defaultValue: 2,
      description: "How many items are in the second group (1-9).",
      promptHint: "integer 1-9",
      required: true,
    },
    assetTypeField("apple"),
    {
      key: "defaultRepresentation", label: "CPA Representation", type: "enum",
      enumValues: ["concrete", "pictorial", "abstract"], defaultValue: "concrete",
      description: "Teacher-facing pedagogy toggle.", exposeToAI: false,
    },
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "add", "addition", "plus", "combine", "put together", "altogether",
    "and more", "sum", "total of", "join together",
  ],

  exampleOutput: {
    id: "q-ai-apples-add",
    technique: "ADDITION_SANDBOX",
    title: "Apple Addition",
    instruction: "Add 3 apples and 2 more apples into the basket. How many altogether?",
    objectId: "apple",
    targetCount: 5,
    config: { addend1: 3, addend2: 2 }
  },

  presets: PRESETS,

  tip: "Mention two group sizes and a theme. Try: \"Add 4 fish and 3 more fish into the tank\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const addend1 = clampInt(raw.config?.addend1, 1, 9, 3);
    const addend2 = clampInt(raw.config?.addend2, 1, 9, 2);
    const sum = addend1 + addend2;

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.ADDITION_SANDBOX,
      title: String(raw.title || `Addition Story ${index + 1}`),
      instruction: String(
        raw.instruction || `Add ${addend1} and ${addend2} together. What's the total?`
      ),
      objectId,
      targetCount: sum,
      config: {
        addend1,
        addend2,
        assetType: resolveAssetType(objectId),
        defaultRepresentation: "concrete",
      }
    };
  }
};
