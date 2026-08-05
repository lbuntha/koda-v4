import { CountingTechnique } from "../../../../types";
import { compareAnswer, normalizeCompareConfig } from "../../../canvases/CompareNumbersCanvas";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "cmp-42-24", label: "42 vs 24", prompt: "Compare 42 and 24 with base ten blocks", emoji: "⚖️", technique: CountingTechnique.COMPARE_NUMBERS, theme: "numbers" },
  { id: "cmp-equal", label: "45 vs 45", prompt: "Compare two equal numbers 45 and 45", emoji: "〓", technique: CountingTechnique.COMPARE_NUMBERS, theme: "numbers" },
];

export const compareNumbersSchema: ComponentSchema = {
  technique: CountingTechnique.COMPARE_NUMBERS,
  name: "Compare Numbers",
  description: "Two numbers drawn as base-ten rods and unit cubes, compared with a greater-than, less-than or equal sign.",
  promptSummary: "Choose two numbers from 0 through 99 to compare.",
  topLevelFields: { targetCount: { min: 0, max: 99, default: 42 } },
  configFields: [
    { key: "compareFirst", label: "First Number", type: "number", defaultValue: 42, description: "The number on the left, 0 through 99." },
    { key: "compareSecond", label: "Second Number", type: "number", defaultValue: 24, description: "The number on the right, 0 through 99." },
    assetTypeField("star"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["compare numbers", "greater than", "less than", "equal to", "which is bigger", "compare two-digit"],
  exampleOutput: {
    id: "q-compare-42-24", technique: "COMPARE_NUMBERS", title: "42 ? 24",
    instruction: "Which sign belongs between them? Compare the tens first.",
    objectId: "star", targetCount: 42,
    config: { compareFirst: 42, compareSecond: 24, assetType: "star" },
  },
  presets: PRESETS,
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizeCompareConfig({ first: raw.config?.compareFirst, second: raw.config?.compareSecond });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "star";
    return {
      id: raw.id || `q-ai-compare-${Date.now()}-${index}`,
      technique: CountingTechnique.COMPARE_NUMBERS,
      title: String(raw.title || `${config.first} ? ${config.second}`),
      instruction: "Which sign belongs between them? Compare the tens first.",
      objectId,
      targetCount: Math.max(config.first, config.second),
      config: { compareFirst: config.first, compareSecond: config.second, compareAnswer: compareAnswer(config), assetType: resolveAssetType(objectId) },
    };
  },
};
