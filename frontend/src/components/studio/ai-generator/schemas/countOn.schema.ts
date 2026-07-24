/**
 * Count On — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, resolveFrameColor, clampInt, assetTypeField, frameColorField } from "./assets";

const CONTAINER_SHAPES = ["box", "chest", "basket", "mystery"] as const;

const PRESETS: AiPreset[] = [
  { id: "co-box-5plus3", label: "Box of 5, +3 More", prompt: "A closed box already has 5 apples, count on 3 more", emoji: "🍎", technique: CountingTechnique.COUNT_ON, theme: "kitchen" },
  { id: "co-chest-8plus4", label: "Treasure Chest +4", prompt: "A treasure chest has 8 gems hidden inside, count on 4 more", emoji: "⭐", technique: CountingTechnique.COUNT_ON, theme: "adventure" },
  { id: "co-mystery-6plus2", label: "Mystery Box +2", prompt: "A mystery box holds 6 items, count on 2 more to find the total", emoji: "🎁", technique: CountingTechnique.COUNT_ON, theme: "surprise" },
];

export const countOnSchema: ComponentSchema = {
  technique: CountingTechnique.COUNT_ON,
  name: "Count On",

  description: `Students see a closed container holding a hidden "baseCount" of items, and drag "extraCount" more items into numbered slots continuing the sequence (baseCount+1, baseCount+2, ...).
Teaches counting on from a known quantity instead of always starting at 1. Tapping the container reveals/re-hides the base count.`,

  promptSummary: "Child starts from a hidden `baseCount` in a container and drags `extraCount` more items into slots, counting on: baseCount+1, baseCount+2, ...",

  topLevelFields: { targetCount: { min: 2, max: 15, default: 8 } },

  configFields: [
    {
      key: "baseCount", label: "Hidden Starting Count", type: "number", defaultValue: 5,
      description: "How many items are already inside the closed container (1-10).",
      promptHint: "integer 1-10, the hidden starting number",
      required: true,
    },
    {
      key: "extraCount", label: "Items to Count On", type: "number", defaultValue: 3,
      description: "How many more items the child drags in and counts on (1-8).",
      promptHint: "integer 1-8, items added on top of baseCount",
      required: true,
    },
    {
      key: "containerShape", label: "Container Shape", type: "enum",
      enumValues: [...CONTAINER_SHAPES], defaultValue: "box",
      description: "Visual shape of the closed starting container.",
      promptHint: "match theme: chest for treasure, basket for fruit, mystery for surprise, box otherwise",
    },
    {
      key: "requireAnswerInput", label: "Answer Input Box", type: "boolean", defaultValue: true,
      description: "Require typing/selecting answer after completing counting on.", exposeToAI: false,
    },
    frameColorField("indigo"),
    assetTypeField("apple"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    // "more" alone is deliberately excluded — too generic, it was outscoring
    // Addition's "add" on nearly every addition-flavored prompt.
    "count on", "counting on", "already has", "hidden inside",
    "starting from", "continue counting", "add more to",
  ],

  exampleOutput: {
    id: "q-ai-treasure-chest",
    technique: "COUNT_ON",
    title: "Treasure Chest Count-On",
    instruction: "The chest already has 8 gems hidden inside. Count on 4 more: 9, 10, 11, 12!",
    objectId: "star",
    targetCount: 12,
    config: { baseCount: 8, extraCount: 4, containerShape: "chest", frameColor: "purple" }
  },

  presets: PRESETS,

  tip: "Mention a hidden starting count and how many more to add. Try: \"A basket has 6 eggs, count on 3 more\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const baseCount = clampInt(raw.config?.baseCount, 1, 10, 5);
    const extraCount = clampInt(raw.config?.extraCount, 1, 8, 3);
    const containerShape = CONTAINER_SHAPES.includes(raw.config?.containerShape) ? raw.config.containerShape : "box";
    const total = baseCount + extraCount;

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.COUNT_ON,
      title: String(raw.title || `Count On ${index + 1}`),
      instruction: String(
        raw.instruction || `Start from ${baseCount} in the ${containerShape}. Count on ${extraCount} more: up to ${total}!`
      ),
      objectId,
      targetCount: total,
      config: {
        baseCount,
        extraCount,
        containerShape,
        frameColor: resolveFrameColor(raw.config?.frameColor),
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
