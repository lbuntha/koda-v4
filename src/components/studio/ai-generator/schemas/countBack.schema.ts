/**
 * Count Back — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, resolveFrameColor, clampInt, assetTypeField, frameColorField } from "./assets";

const CROSS_STYLES = ["red_x", "slash", "fade"] as const;

const PRESETS: AiPreset[] = [
  { id: "cb-balloons-8", label: "8 Balloons Pop Back", prompt: "Start at 8 balloons and count back by crossing out 3", emoji: "🎈", technique: CountingTechnique.COUNT_BACK, theme: "party" },
  { id: "cb-cookies-10", label: "10 Cookies Eaten", prompt: "Count back from 10 cookies, eating 4", emoji: "🍪", technique: CountingTechnique.COUNT_BACK, theme: "bakery" },
  { id: "cb-stars-7", label: "7 Stars Fade", prompt: "Count back from 7 stars as 2 fade away in the sky", emoji: "⭐", technique: CountingTechnique.COUNT_BACK, theme: "space" },
];

export const countBackSchema: ComponentSchema = {
  technique: CountingTechnique.COUNT_BACK,
  name: "Count Back",

  description: `Students start at "totalCount" and tap/cross out items right-to-left, counting backward as they go, removing exactly "removeCount" items.
Enforces strict right-to-left order — the next item to cross out is always highlighted. Ends when removeCount items are crossed.`,

  promptSummary: "Child starts at `totalCount` items and crosses them out right-to-left, counting backward, removing exactly `removeCount` of them.",

  topLevelFields: { targetCount: { min: 3, max: 15, default: 8 } },

  configFields: [
    {
      key: "totalCount", label: "Starting Total", type: "number", defaultValue: 8,
      description: "How many items the child starts with.",
      promptHint: "integer 3-15, items at the start",
      required: true,
    },
    {
      key: "removeCount", label: "Amount to Count Back", type: "number", defaultValue: 3,
      description: "How many items get crossed out counting backward (1 to totalCount-1).",
      promptHint: "integer 1 to totalCount-1, items removed while counting back",
      required: true,
    },
    {
      key: "crossOutStyle", label: "Cross-out Visual Style", type: "enum",
      enumValues: [...CROSS_STYLES], defaultValue: "red_x",
      description: "How crossed-out items are visually marked.",
      exposeToAI: false,
    },
    frameColorField("rose"),
    assetTypeField("balloon"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "count back", "counting back", "backward", "backwards", "countdown",
    "count down", "descending", "in reverse",
  ],

  exampleOutput: {
    id: "q-ai-balloons-back",
    technique: "COUNT_BACK",
    title: "Balloons Count Back",
    instruction: "Start at 8 balloons and count back as 3 pop: 8, 7, 6, 5!",
    objectId: "balloon",
    targetCount: 8,
    config: { totalCount: 8, removeCount: 3, frameColor: "rose" }
  },

  presets: PRESETS,

  tip: "Mention a starting total and how many to count back. Try: \"Count back from 9 fireflies, 4 fly off\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "balloon";
    const { min, max } = this.topLevelFields.targetCount;
    const totalCount = clampInt(raw.config?.totalCount, min, max, 8);
    // Must leave at least 1 item uncrossed, and cross at least 1.
    const removeCount = Math.min(totalCount - 1, clampInt(raw.config?.removeCount, 1, max, 3));

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.COUNT_BACK,
      title: String(raw.title || `Count Back ${index + 1}`),
      instruction: String(
        raw.instruction || `Start at ${totalCount} and count back ${removeCount}: down to ${totalCount - removeCount}!`
      ),
      objectId,
      targetCount: totalCount,
      config: {
        totalCount,
        removeCount,
        crossOutStyle: "red_x",
        frameColor: resolveFrameColor(raw.config?.frameColor, "rose"),
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
