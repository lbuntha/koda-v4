import { CountingTechnique } from "../../../../types";
import { dataAnswer, dataPrompt, normalizeDataConfig } from "../../../canvases/DataChartCanvas";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "data-count", label: "How many apples", prompt: "Chart with 6 apples, 2 flowers, 4 hearts and ask how many apples", emoji: "📊", technique: CountingTechnique.DATA_CHART, theme: "data" },
  { id: "data-more", label: "How many more", prompt: "Ask how many more apples than flowers on the chart", emoji: "📈", technique: CountingTechnique.DATA_CHART, theme: "data" },
];

export const dataChartSchema: ComponentSchema = {
  technique: CountingTechnique.DATA_CHART,
  name: "Data Chart",
  description: "Up to three categories drawn as counted objects with tallies, asked as how many, how many altogether, how many more, or which has the most.",
  promptSummary: "Choose category counts and which question to ask about them.",
  topLevelFields: { targetCount: { min: 0, max: 30, default: 6 } },
  configFields: [
    { key: "dataKind", label: "Question", type: "enum", enumValues: ["count", "total", "more", "most"], defaultValue: "count", description: "What the child is asked to read from the chart.", promptHint: "count, total, more, or most" },
    { key: "dataCounts", label: "Counts", type: "json", defaultValue: [6, 2, 4], description: "Two or three category counts, each 0 to 10." },
    { key: "dataCategories", label: "Category Names", type: "json", defaultValue: ["Apples", "Flowers", "Hearts"], description: "One label per count. Each label must name the artwork beside it — a column of flowers labelled \"Pears\" asks a child to count something that is not there." },
    { key: "dataAssets", label: "Category Artwork", type: "json", defaultValue: ["apple", "flower", "heart"], description: "One catalog asset id per count (e.g. [\"apple\", \"butterfly\", \"fish\"]) — any shape, sprite or SVG library id. An empty entry is drawn from the category label instead, so the picture always matches the word." },
    { key: "dataFocus", label: "Asked About", type: "number", defaultValue: 0, description: "Index of the category the question is about." },
    { key: "dataAgainst", label: "Compared With", type: "number", defaultValue: 1, description: "Index of the category compared against, for 'how many more'." },
    assetTypeField("star"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["chart", "graph", "tally", "how many more", "categories", "data", "sort into groups"],
  exampleOutput: {
    id: "q-data-apples", technique: "DATA_CHART", title: "Read the chart",
    instruction: "How many Apples?", objectId: "star", targetCount: 6,
    config: { dataKind: "count", dataCounts: [6, 2, 4], dataCategories: ["Apples", "Flowers", "Hearts"], dataAssets: ["apple", "flower", "heart"], dataFocus: 0, dataAgainst: 1, assetType: "star" },
  },
  presets: PRESETS,
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizeDataConfig({
      kind: raw.config?.dataKind, counts: raw.config?.dataCounts, categories: raw.config?.dataCategories,
      focus: raw.config?.dataFocus, against: raw.config?.dataAgainst, assets: raw.config?.dataAssets,
    });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "star";
    return {
      id: raw.id || `q-ai-data-${Date.now()}-${index}`,
      technique: CountingTechnique.DATA_CHART,
      title: String(raw.title || dataPrompt(config)),
      instruction: dataPrompt(config),
      objectId,
      targetCount: dataAnswer(config),
      config: {
        dataKind: config.kind, dataCounts: config.counts, dataCategories: config.categories,
        dataFocus: config.focus, dataAgainst: config.against, dataAssets: config.assets,
        assetType: resolveAssetType(objectId),
      },
    };
  },
};
