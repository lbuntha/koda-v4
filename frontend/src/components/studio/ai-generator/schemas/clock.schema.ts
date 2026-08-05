import { CountingTechnique } from "../../../../types";
import { clockLabel, normalizeClockConfig } from "../../../canvases/ClockCanvas";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "clock-3", label: "3 o'clock", prompt: "Show 3 o'clock on the clock", emoji: "🕐", technique: CountingTechnique.CLOCK_READ, theme: "time" },
  { id: "clock-half-2", label: "Half past 2", prompt: "Show half past 2 on the clock", emoji: "🕑", technique: CountingTechnique.CLOCK_READ, theme: "time" },
];

export const clockSchema: ComponentSchema = {
  technique: CountingTechnique.CLOCK_READ,
  name: "Clock",
  description: "An analog clock face read at the hour or the half-hour, with the hour hand correctly placed between numbers at half past.",
  promptSummary: "Choose an hour from 1 to 12 and whether it is on the hour or half past.",
  topLevelFields: { targetCount: { min: 1, max: 12, default: 3 } },
  configFields: [
    { key: "clockHour", label: "Hour", type: "number", defaultValue: 3, description: "The hour shown, 1 through 12." },
    { key: "clockMinute", label: "Minutes", type: "enum", enumValues: ["0", "30"], defaultValue: "0", description: "0 for o'clock, 30 for half past.", promptHint: "0 or 30" },
    assetTypeField("star"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["tell time", "clock", "o'clock", "half past", "hour hand", "read the clock"],
  exampleOutput: {
    id: "q-clock-3", technique: "CLOCK_READ", title: "3 o'clock",
    instruction: "What time is it? The short hand is the hour.",
    objectId: "star", targetCount: 3,
    config: { clockHour: 3, clockMinute: 0, assetType: "star" },
  },
  presets: PRESETS,
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizeClockConfig({ hour: raw.config?.clockHour, minute: Number(raw.config?.clockMinute) as 0 | 30 });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "star";
    return {
      id: raw.id || `q-ai-clock-${Date.now()}-${index}`,
      technique: CountingTechnique.CLOCK_READ,
      title: String(raw.title || (config.minute === 30 ? `Half past ${config.hour}` : `${config.hour} o'clock`)),
      instruction: "What time is it? The short hand is the hour.",
      objectId,
      targetCount: config.hour,
      config: { clockHour: config.hour, clockMinute: config.minute, clockLabel: clockLabel(config), assetType: resolveAssetType(objectId) },
    };
  },
};
