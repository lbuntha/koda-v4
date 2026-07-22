/**
 * Count in Different Arrangements — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, resolveFrameColor, clampInt, assetTypeField, frameColorField } from "./assets";

const PATTERNS = ["line", "circle", "grid", "scatter"] as const;

const PRESETS: AiPreset[] = [
  { id: "arr-frogs-circle", label: "7 Frogs in a Circle", prompt: "Count 7 frogs arranged in a circle, then scattered", emoji: "🐸", technique: CountingTechnique.DIFFERENT_ARRANGEMENTS, theme: "pond" },
  { id: "arr-cars-grid", label: "8 Cars in a Grid", prompt: "Count 8 toy cars arranged in a grid pattern", emoji: "🚗", technique: CountingTechnique.DIFFERENT_ARRANGEMENTS, theme: "toys" },
  { id: "arr-leaves-scatter", label: "6 Leaves Scattered", prompt: "Count 6 leaves scattered randomly on the ground", emoji: "🍂", technique: CountingTechnique.DIFFERENT_ARRANGEMENTS, theme: "nature" },
];

export const arrangementsSchema: ComponentSchema = {
  technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
  name: "Count in Different Arrangements",

  description: `Students tap and count "targetCount" items arranged in a non-standard layout (circle, scatter, etc), reinforcing that count is invariant regardless of arrangement.
Conceptually similar to One-to-One, but the pedagogical point is specifically that rearranging items doesn't change the total.`,

  promptSummary: "Child taps and counts `targetCount` items in a deliberately non-linear arrangement (circle/scatter/grid), reinforcing count conservation.",

  topLevelFields: { targetCount: { min: 3, max: 12, default: 7 } },

  configFields: [
    {
      key: "pattern", label: "Arrangement Pattern", type: "enum",
      enumValues: [...PATTERNS], defaultValue: "scatter",
      description: "Visual arrangement of items — prefer circle or scatter over line/grid to make the pedagogical point (count stays the same however it's arranged).",
      promptHint: "prefer circle or scatter to teach count conservation",
    },
    frameColorField("indigo"),
    assetTypeField("apple"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "different arrangements", "arranged in a circle", "scattered", "circle arrangement",
    "no matter how they", "rearrange", "same count", "however arranged",
  ],

  exampleOutput: {
    id: "q-ai-frogs-circle",
    technique: "DIFFERENT_ARRANGEMENTS",
    title: "Frogs in a Circle",
    instruction: "Count the 7 frogs — no matter how they're arranged, the total is still 7!",
    objectId: "frog",
    targetCount: 7,
    config: { pattern: "circle", frameColor: "emerald" }
  },

  presets: PRESETS,

  tip: "Mention a count, object, and a scattered/circular layout. Try: \"Count 9 fireflies scattered in the night sky\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const { min, max, default: def } = this.topLevelFields.targetCount;
    const targetCount = clampInt(raw.targetCount, min, max, def);
    const pattern = PATTERNS.includes(raw.config?.pattern) ? raw.config.pattern : "scatter";

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
      title: String(raw.title || `Count the Arrangement ${index + 1}`),
      instruction: String(
        raw.instruction || `Tap and count. No matter how they're arranged, the total is still ${targetCount}!`
      ),
      objectId,
      targetCount,
      config: {
        pattern,
        frameColor: resolveFrameColor(raw.config?.frameColor),
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
