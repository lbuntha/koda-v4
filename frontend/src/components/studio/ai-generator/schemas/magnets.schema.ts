/**
 * Count Magnets — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, resolveFrameColor, clampInt, assetTypeField, frameColorField } from "./assets";

const CONTAINER_SHAPES = ["mystery", "basket", "box", "chest"] as const;

const PRESETS: AiPreset[] = [
  { id: "mag-bugs-jar", label: "Bugs in a Jar", prompt: "Drag 6 bugs into the collecting jar", emoji: "🐞", technique: CountingTechnique.COUNT_MAGNETS, theme: "nature" },
  { id: "mag-fruit-basket", label: "Fruit into Basket", prompt: "Drag 5 pieces of fruit into the basket", emoji: "🍎", technique: CountingTechnique.COUNT_MAGNETS, theme: "kitchen" },
  { id: "mag-gems-chest", label: "Gems into Chest", prompt: "Drag 7 gems into the treasure chest", emoji: "💎", technique: CountingTechnique.COUNT_MAGNETS, theme: "adventure" },
];

export const magnetsSchema: ComponentSchema = {
  technique: CountingTechnique.COUNT_MAGNETS,
  name: "Count Magnets",

  description: `Students drag "targetCount" items into a single kawaii-faced container (jar, basket, box, or mystery box) anywhere on the canvas — free-form placement, no slots or order required.
The container's face animates happily as items go in. Simpler than Move & Count: one container, no source/destination split.`,

  promptSummary: "Child drags `targetCount` items anywhere into a single friendly container (jar/basket/box) — free placement, no order.",

  topLevelFields: { targetCount: { min: 1, max: 12, default: 6 } },

  configFields: [
    {
      key: "containerShape", label: "Container Shape", type: "enum",
      enumValues: [...CONTAINER_SHAPES], defaultValue: "mystery",
      description: "Visual shape of the container.",
      promptHint: "match theme: basket for fruit, box for toys, chest for treasure, mystery otherwise",
    },
    frameColorField("indigo"),
    assetTypeField("apple"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "drag into", "put into the jar", "collect", "gather", "into the basket",
    "into the box", "magnet", "into the jar", "into the chest",
  ],

  exampleOutput: {
    id: "q-ai-bugs-jar",
    technique: "COUNT_MAGNETS",
    title: "Collect the Bugs",
    instruction: "Drag all 6 bugs into the jar!",
    objectId: "ladybug",
    targetCount: 6,
    config: { containerShape: "mystery", frameColor: "emerald" }
  },

  presets: PRESETS,

  tip: "Mention a count, object, and a container. Try: \"Drag 8 seashells into the basket\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const { min, max, default: def } = this.topLevelFields.targetCount;
    const targetCount = clampInt(raw.targetCount, min, max, def);
    const containerShape = CONTAINER_SHAPES.includes(raw.config?.containerShape) ? raw.config.containerShape : "mystery";

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.COUNT_MAGNETS,
      title: String(raw.title || `Collect ${targetCount}`),
      instruction: String(raw.instruction || `Drag all ${targetCount} items into the container!`),
      objectId,
      targetCount,
      config: {
        containerShape,
        frameColor: resolveFrameColor(raw.config?.frameColor),
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
