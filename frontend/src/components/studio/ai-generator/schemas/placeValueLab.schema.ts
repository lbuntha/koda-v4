import { CountingTechnique } from "../../../../types";
import { normalizePlaceValueConfig, placeValueInstruction } from "../../../canvases/placeValueModel";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "pv-build-34", label: "Build 34", prompt: "Use Place Value Lab to build 34 with tens and ones", emoji: "🧱", technique: CountingTechnique.PLACE_VALUE_LAB, theme: "numbers" },
  { id: "pv-read-62", label: "Read 62", prompt: "Show 6 tens and 2 ones and ask the child to read the number", emoji: "🔢", technique: CountingTechnique.PLACE_VALUE_LAB, theme: "numbers" },
  { id: "pv-regroup-27", label: "Regroup 27", prompt: "Show 1 ten and 17 ones, then trade 10 ones to make 27", emoji: "✨", technique: CountingTechnique.PLACE_VALUE_LAB, theme: "numbers" },
  { id: "pv-multiple-ten", label: "Build 80", prompt: "Build the multiple of ten 80 with base-ten blocks", emoji: "8️⃣", technique: CountingTechnique.PLACE_VALUE_LAB, theme: "numbers" },
];

export const placeValueLabSchema: ComponentSchema = {
  technique: CountingTechnique.PLACE_VALUE_LAB,
  name: "Place Value Lab",
  description: "Students build, read, and regroup two-digit numbers with proportional base-ten rods and one units in labeled Tens and Ones zones.",
  promptSummary: "Choose a two-digit number and whether the child builds it, reads shown blocks, or trades 10 ones for 1 ten.",
  topLevelFields: { targetCount: { min: 10, max: 99, default: 34 } },
  configFields: [
    { key: "placeValueTask", label: "Learning Task", type: "enum", enumValues: ["build_number", "read_number", "regroup_ones"], defaultValue: "build_number", description: "How the child works with the base-ten representation.", promptHint: "build_number, read_number, or regroup_ones" },
    { key: "placeValueDifficulty", label: "Guidance", type: "enum", enumValues: ["guided", "independent"], defaultValue: "guided", description: "Guided shows counts above each place; independent asks the child to count the blocks." },
    { key: "placeValueTarget", label: "Two-digit Number", type: "number", defaultValue: 34, description: "The number to represent, from 10 through 99." },
    { key: "placeValueShowExpanded", label: "Expanded Form", type: "boolean", defaultValue: true, description: "Show the live tens + ones representation beneath the mat.", exposeToAI: false },
    assetTypeField("star"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["place value lab", "base ten blocks", "base-ten blocks", "build a two digit number", "build a two-digit number", "read tens and ones", "trade 10 ones", "regroup ones", "tens rods", "place value mat"],
  exampleOutput: {
    id: "q-place-value-34",
    technique: "PLACE_VALUE_LAB",
    title: "Build 34",
    instruction: "Build 34 with tens and ones.",
    objectId: "star",
    targetCount: 34,
    config: { placeValueTask: "build_number", placeValueDifficulty: "guided", placeValueTarget: 34, placeValueShowExpanded: true, assetType: "star" },
  },
  presets: PRESETS,
  tip: "Try: ‘Show 4 tens and 7 ones, then ask the learner to read the number.’",
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizePlaceValueConfig({
      task: raw.config?.placeValueTask,
      difficulty: raw.config?.placeValueDifficulty,
      target: raw.config?.placeValueTarget ?? raw.targetCount,
      showExpanded: raw.config?.placeValueShowExpanded,
    });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "star";
    return {
      id: raw.id || `q-ai-place-value-${Date.now()}-${index}`,
      technique: CountingTechnique.PLACE_VALUE_LAB,
      title: String(raw.title || `${config.task === "read_number" ? "Read" : config.task === "regroup_ones" ? "Regroup" : "Build"} ${config.target}`),
      instruction: placeValueInstruction(config),
      objectId,
      targetCount: config.target,
      config: {
        placeValueTask: config.task,
        placeValueDifficulty: config.difficulty,
        placeValueTarget: config.target,
        placeValueShowExpanded: config.showExpanded,
        assetType: resolveAssetType(objectId),
      },
    };
  },
};
