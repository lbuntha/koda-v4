/**
 * Subtraction Sandbox — Component Schema
 *
 * Single source of truth for what the AI knows about the Subtraction canvas.
 * Replicated from moveAndCount.schema.ts following the README recipe.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, clampInt, assetTypeField } from "./assets";

const SUBTRACTION_PRESETS: AiPreset[] = [
  {
    id: "sub-donut-shop",
    label: "Donut Shop",
    prompt: "Start with 8 donuts and eat 3 of them, count the leftovers",
    emoji: "🍩",
    technique: CountingTechnique.SUBTRACTION_SANDBOX,
    theme: "bakery"
  },
  {
    id: "sub-balloons-pop",
    label: "Balloons Pop",
    prompt: "6 balloons at the party and 2 pop, how many are left?",
    emoji: "🎈",
    technique: CountingTechnique.SUBTRACTION_SANDBOX,
    theme: "party"
  },
  {
    id: "sub-fish-swim",
    label: "Fish Swim Away",
    prompt: "7 fish in the pond and 4 swim away",
    emoji: "🐟",
    technique: CountingTechnique.SUBTRACTION_SANDBOX,
    theme: "aquatic"
  },
  {
    id: "sub-cookies-eaten",
    label: "Cookie Jar",
    prompt: "Take away 5 cookies from a jar of 9 cookies",
    emoji: "🍪",
    technique: CountingTechnique.SUBTRACTION_SANDBOX,
    theme: "kitchen"
  },
];

export const subtractionSchema: ComponentSchema = {
  technique: CountingTechnique.SUBTRACTION_SANDBOX,
  name: "Subtraction Sandbox",

  description: `Students see a plate of items and tap to cross out a given number of them, then count what remains.
Supports three CPA representations: concrete objects, a ten-frame, and numbered digit counters.
The header shows the live equation (minuend − crossed = remaining).`,

  promptSummary:
    "Child sees `minuend` items on a plate and crosses out `subtrahend` of them, then counts the leftovers (minuend − subtrahend).",

  topLevelFields: {
    // targetCount mirrors minuend so the slide list previews read correctly.
    targetCount: { min: 2, max: 10, default: 8 }
  },

  configFields: [
    {
      key: "minuend",
      label: "Starting Amount",
      type: "number",
      defaultValue: 8,
      description: "How many items the child starts with (2-10).",
      promptHint: "integer 2-10, items at the start",
      required: true,
    },
    {
      key: "subtrahend",
      label: "Amount to Cross Out",
      type: "number",
      defaultValue: 3,
      description: "How many items get crossed out (1 to minuend).",
      promptHint: "integer 1 to minuend, items removed",
      required: true,
    },
    {
      key: "assetType",
      label: "Asset Type",
      type: "enum",
      enumValues: [...VALID_ASSET_IDS],
      defaultValue: "cookie",
      description: "The visual asset to render. Derived automatically from objectId by validate().",
      exposeToAI: false,
    },
    {
      key: "defaultRepresentation",
      label: "CPA Representation",
      type: "enum",
      enumValues: ["concrete", "pictorial", "abstract"],
      defaultValue: "concrete",
      description: "Teacher-facing pedagogy toggle; the child can switch in-canvas.",
      exposeToAI: false,
    },
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "subtract", "subtraction", "minus", "take away", "takeaway",
    "cross out", "eat", "eaten", "pop", "swim away", "fly away",
    "remove", "left over", "leftover", "leftovers", "how many are left",
    "remain", "remaining", "fewer",
  ],

  exampleOutput: {
    id: "q-ai-donut-shop",
    technique: "SUBTRACTION_SANDBOX",
    title: "Koda's Donut Shop",
    instruction: "Start with 8 donuts. Tap 3 of them to eat them, then count the leftovers!",
    objectId: "cookie",
    targetCount: 8,
    config: {
      minuend: 8,
      subtrahend: 3,
    }
  },

  presets: SUBTRACTION_PRESETS,

  // No rule-based parser for subtraction yet — API key required.

  tip: "Mention a starting amount, how many go away, and a theme. Try: \"9 balloons at the fair and 4 fly away\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "cookie";
    const { min, max } = this.topLevelFields.targetCount;

    const minuend = clampInt(raw.config?.minuend, min, max, 8);
    // Subtrahend must leave a valid subtraction: at least 1, at most minuend.
    const subtrahend = Math.min(minuend, clampInt(raw.config?.subtrahend, 1, max, 3));
    const assetType = resolveAssetType(objectId);

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.SUBTRACTION_SANDBOX,
      title: String(raw.title || `Subtraction Story ${index + 1}`),
      instruction: String(
        raw.instruction || `Start with ${minuend}. Cross out ${subtrahend} and count what's left!`
      ),
      objectId,
      targetCount: minuend,
      config: {
        minuend,
        subtrahend,
        assetType,
        defaultRepresentation: "concrete",
      }
    };
  }
};
