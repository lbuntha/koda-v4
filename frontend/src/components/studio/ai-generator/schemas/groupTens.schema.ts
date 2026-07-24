/**
 * Group in Tens — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, resolveFrameColor, clampInt, assetTypeField, frameColorField } from "./assets";

const PRESETS: AiPreset[] = [
  { id: "gt-apples-13", label: "13 Apples", prompt: "Group 13 apples into a ten and some extra ones", emoji: "🍎", technique: CountingTechnique.GROUP_IN_TENS, theme: "kitchen" },
  { id: "gt-stars-17", label: "17 Stars", prompt: "Sort 17 stars into a full ten-frame plus leftovers", emoji: "⭐", technique: CountingTechnique.GROUP_IN_TENS, theme: "space" },
  { id: "gt-bears-12", label: "12 Bears", prompt: "Group 12 teddy bears into tens and ones", emoji: "🧸", technique: CountingTechnique.GROUP_IN_TENS, theme: "toys" },
];

export const groupTensSchema: ComponentSchema = {
  technique: CountingTechnique.GROUP_IN_TENS,
  name: "Group in Tens",

  description: `Students drag items from a shelf up into ten-frames: the first ten-frame fills to exactly 10 (a "ten"), any remainder goes in a second frame (the "ones").
Only useful for counts > 10 — a count of 10 or less has no "ones" to group, so this activity teaches place value.`,

  promptSummary: "Child drags `targetCount` (>10) items from a shelf into ten-frames — first frame fills to a full ten, the rest are the ones.",

  topLevelFields: { targetCount: { min: 11, max: 20, default: 13 } },

  configFields: [
    frameColorField("indigo"),
    {
      key: "sourceBinLabel", label: "Shelf Label", type: "string", defaultValue: "Shelf",
      description: "Label for the uncounted shelf items start on.",
      promptHint: "themed shelf name, e.g. 'Toy Shelf'",
    },
    {
      key: "showNumbersInSlots", label: "Show Slot Numbers", type: "boolean", defaultValue: true,
      description: "Teacher-facing display toggle.", exposeToAI: false,
    },
    {
      key: "requireAnswerInput", label: "Answer Input Box", type: "boolean", defaultValue: true,
      description: "Require typing/selecting answer after grouping items in ten-frames.", exposeToAI: false,
    },
    assetTypeField("apple"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "group in tens", "tens and ones", "ten frame", "ten-frame",
    "make a ten", "place value", "group into ten", "sort into tens",
  ],

  exampleOutput: {
    id: "q-ai-apples-tens",
    technique: "GROUP_IN_TENS",
    title: "Group the Apples",
    instruction: "Drag the 13 apples up into the ten-frames: make one full ten, then 3 more!",
    objectId: "apple",
    targetCount: 13,
    config: { frameColor: "emerald", sourceBinLabel: "Apple Basket" }
  },

  presets: PRESETS,

  tip: "Always pick a count above 10 — try: \"Group 16 fireflies into tens and ones\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const { min, max, default: def } = this.topLevelFields.targetCount;
    // Must stay > 10 or the "ones" frame never appears — clamp floor is the schema min (11).
    const targetCount = clampInt(raw.targetCount, min, max, def);

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.GROUP_IN_TENS,
      title: String(raw.title || `Group ${targetCount} in Tens`),
      instruction: String(raw.instruction || `Drag the ${targetCount} items into the ten-frames: make a ten, then group the rest!`),
      objectId,
      targetCount,
      config: {
        frameColor: resolveFrameColor(raw.config?.frameColor),
        sourceBinLabel: String(raw.config?.sourceBinLabel || "Shelf"),
        showNumbersInSlots: true,
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
