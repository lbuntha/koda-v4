/**
 * Line Up and Count — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, resolveFrameColor, clampInt, assetTypeField, frameColorField } from "./assets";

const PRESETS: AiPreset[] = [
  { id: "lu-ducks-pond", label: "Ducklings in Order", prompt: "Line up 5 ducklings in order behind mother duck", emoji: "🦆", technique: CountingTechnique.LINE_UP_AND_COUNT, theme: "nature" },
  { id: "lu-cars-race", label: "Race Cars", prompt: "Line up 6 race cars at the starting line, numbered 1 to 6", emoji: "🚗", technique: CountingTechnique.LINE_UP_AND_COUNT, theme: "race" },
  { id: "lu-cookies-tray", label: "Cookie Tray", prompt: "Arrange 8 cookies in numbered order on a baking tray", emoji: "🍪", technique: CountingTechnique.LINE_UP_AND_COUNT, theme: "bakery" },
];

export const lineUpSchema: ComponentSchema = {
  technique: CountingTechnique.LINE_UP_AND_COUNT,
  name: "Line Up and Count",

  description: `Students drag items from an unordered tray into numbered slots (1..N), in order.
The canvas has two zones: an unordered tray and a slots stage. Dropping near a slot snaps the item in and stamps its position number.`,

  promptSummary: "Child drags `targetCount` items from an unordered tray into numbered slots, placing them in order 1..N.",

  topLevelFields: { targetCount: { min: 2, max: 10, default: 5 } },

  configFields: [
    frameColorField("indigo"),
    {
      key: "sourceBinLabel", label: "Tray Label", type: "string", defaultValue: "Tray",
      description: "Label for the unordered starting tray.",
      promptHint: "themed tray name, e.g. 'Toy Box'",
    },
    {
      key: "destinationBinLabel", label: "Line-up Label", type: "string", defaultValue: "Line-up",
      description: "Label for the ordered slots area.",
      promptHint: "themed lineup name, e.g. 'Starting Line'",
    },
    {
      key: "showNumbersInSlots", label: "Show Slot Numbers", type: "boolean", defaultValue: true,
      description: "Teacher-facing display toggle.", exposeToAI: false,
    },
    assetTypeField("apple"),
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "line up", "lineup", "in order", "numbered slots", "put in order",
    "arrange in order", "starting line", "row order", "sequence",
  ],

  exampleOutput: {
    id: "q-ai-race-cars",
    technique: "LINE_UP_AND_COUNT",
    title: "Race Car Lineup",
    instruction: "Line up all 6 race cars at the starting line, in order: 1, 2, 3, 4, 5, 6!",
    objectId: "car",
    targetCount: 6,
    config: { frameColor: "rose", sourceBinLabel: "Garage", destinationBinLabel: "Starting Line" }
  },

  presets: PRESETS,

  tip: "Mention a count, object, and a themed starting/ending spot. Try: \"Line up 7 penguins on the ice in order\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const { min, max, default: def } = this.topLevelFields.targetCount;
    const targetCount = clampInt(raw.targetCount, min, max, def);

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.LINE_UP_AND_COUNT,
      title: String(raw.title || `Line Up ${index + 1}`),
      instruction: String(raw.instruction || `Line up all ${targetCount} items in order: 1 to ${targetCount}!`),
      objectId,
      targetCount,
      config: {
        frameColor: resolveFrameColor(raw.config?.frameColor),
        sourceBinLabel: String(raw.config?.sourceBinLabel || "Tray"),
        destinationBinLabel: String(raw.config?.destinationBinLabel || "Line-up"),
        showNumbersInSlots: true,
        assetType: resolveAssetType(objectId),
      }
    };
  }
};
