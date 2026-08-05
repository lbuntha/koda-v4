import { CountingTechnique } from "../../../../types";
import { measureAnswer, normalizeMeasureConfig } from "../../../canvases/MeasureLengthCanvas";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "measure-5", label: "5 units", prompt: "Measure a bar that is 5 units long", emoji: "📏", technique: CountingTechnique.MEASURE_LENGTH, theme: "measurement" },
  { id: "measure-longest", label: "Longest bar", prompt: "Show three bars and ask which is longest", emoji: "📐", technique: CountingTechnique.MEASURE_LENGTH, theme: "measurement" },
];

export const measureLengthSchema: ComponentSchema = {
  technique: CountingTechnique.MEASURE_LENGTH,
  name: "Measure Length",
  description: "Equal units laid end to end with no gaps to measure a bar, or two to three bars drawn to scale to order by length.",
  promptSummary: "Choose whether the child measures one bar in units or finds the longest or shortest of several.",
  topLevelFields: { targetCount: { min: 1, max: 12, default: 5 } },
  configFields: [
    { key: "measureTask", label: "Task", type: "enum", enumValues: ["measure", "longest", "shortest"], defaultValue: "measure", description: "Measure one bar in units, or compare several bars.", promptHint: "measure, longest, or shortest" },
    { key: "measureLengths", label: "Lengths", type: "json", defaultValue: [5], description: "Unit lengths from 1 to 12. One value for measure, two or three to compare." },
    assetTypeField("star"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["measure length", "how long", "units end to end", "longest", "shortest", "order by length", "ruler"],
  exampleOutput: {
    id: "q-measure-5", technique: "MEASURE_LENGTH", title: "Measure 5 units",
    instruction: "Count the units under the bar. How long is it?",
    objectId: "star", targetCount: 5,
    config: { measureTask: "measure", measureLengths: [5], assetType: "star" },
  },
  presets: PRESETS,
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizeMeasureConfig({
      task: raw.config?.measureTask, lengths: raw.config?.measureLengths, labels: raw.config?.measureLabels,
    });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "star";
    return {
      id: raw.id || `q-ai-measure-${Date.now()}-${index}`,
      technique: CountingTechnique.MEASURE_LENGTH,
      title: String(raw.title || (config.task === "measure" ? `Measure ${config.lengths[0]} units` : `Find the ${config.task}`)),
      instruction: config.task === "measure" ? "Count the units under the bar. How long is it?" : `Tap the ${config.task} bar.`,
      objectId,
      targetCount: measureAnswer(config),
      config: { measureTask: config.task, measureLengths: config.lengths, measureLabels: config.labels, assetType: resolveAssetType(objectId) },
    };
  },
};
