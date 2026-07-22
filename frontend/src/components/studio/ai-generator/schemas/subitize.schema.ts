/**
 * Subitize Flash — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, clampInt, assetTypeField } from "./assets";

const PATTERNS = ["dice", "scatter", "pairs"] as const;

const PRESETS: AiPreset[] = [
  { id: "sub-dice-5", label: "5 Dots (Dice)", prompt: "Flash 5 dots in a dice pattern for 1.5 seconds", emoji: "⚫", technique: CountingTechnique.SUBITIZE, theme: "classic" },
  { id: "sub-stars-4", label: "4 Stars Flash", prompt: "Flash 4 stars scattered on screen for a second", emoji: "⭐", technique: CountingTechnique.SUBITIZE, theme: "space" },
  { id: "sub-hearts-6", label: "6 Hearts in Pairs", prompt: "Flash 6 hearts arranged in pairs briefly", emoji: "❤️", technique: CountingTechnique.SUBITIZE, theme: "love" },
];

export const subitizeSchema: ComponentSchema = {
  technique: CountingTechnique.SUBITIZE,
  name: "Subitize Flash",

  description: `A pattern of "targetCount" items flashes on screen for a short duration, then hides. The child picks the count they saw from multiple-choice number options — no counting one-by-one, this trains instant quantity recognition.
Best kept small (3-6) since subitizing beyond ~6 defeats the purpose (it becomes counting, not instant recognition).`,

  promptSummary: "A pattern of `targetCount` items flashes briefly, then hides; the child picks the number they instantly recognized from options — no counting allowed.",

  topLevelFields: { targetCount: { min: 2, max: 6, default: 4 } },

  configFields: [
    {
      key: "pattern", label: "Flash Pattern", type: "enum",
      enumValues: [...PATTERNS], defaultValue: "dice",
      description: "Visual arrangement during the flash. 'dice' = classic dice-face dot layout, best for counts 1-6.",
      promptHint: "dice for classic dot layouts, scatter or pairs otherwise",
    },
    {
      key: "flashDurationMs", label: "Flash Duration (ms)", type: "number", defaultValue: 1500,
      description: "How long the pattern stays visible before hiding, in milliseconds (800-2500).",
      promptHint: "800-2500ms; shorter for older/confident learners",
    },
    assetTypeField("star"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "subitize", "flash", "quick glance", "instantly", "at a glance",
    "how many did you see", "briefly show", "flash card",
  ],

  exampleOutput: {
    id: "q-ai-dice-dots",
    technique: "SUBITIZE",
    title: "Quick Dot Flash",
    instruction: "Watch carefully — the dots will flash for a moment. How many did you see?",
    objectId: "blue_dot",
    targetCount: 5,
    config: { pattern: "dice", flashDurationMs: 1500 }
  },

  presets: PRESETS,

  tip: "Keep counts small (2-6) and mention a duration if you want it faster/slower. Try: \"Flash 3 ladybugs quickly\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "star";
    const { min, max, default: def } = this.topLevelFields.targetCount;
    const targetCount = clampInt(raw.targetCount, min, max, def);
    const pattern = PATTERNS.includes(raw.config?.pattern) ? raw.config.pattern : "dice";
    const flashDurationMs = clampInt(raw.config?.flashDurationMs, 800, 2500, 1500);

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.SUBITIZE,
      title: String(raw.title || `Flash ${targetCount}`),
      instruction: String(raw.instruction || "Watch carefully — how many do you see?"),
      objectId,
      targetCount,
      config: {
        pattern,
        flashDurationMs,
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
