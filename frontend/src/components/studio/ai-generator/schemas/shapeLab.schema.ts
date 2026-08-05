import { CountingTechnique } from "../../../../types";
import { normalizeShapeConfig, shapeAnswer, shapePrompt } from "../../../canvases/ShapeLabCanvas";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "shape-sides", label: "Triangle sides", prompt: "Ask how many sides a triangle has", emoji: "🔺", technique: CountingTechnique.SHAPE_LAB, theme: "geometry" },
  { id: "shape-halves", label: "Halves", prompt: "Cut a circle into halves and ask how many equal parts", emoji: "◑", technique: CountingTechnique.SHAPE_LAB, theme: "geometry" },
];

export const shapeLabSchema: ComponentSchema = {
  technique: CountingTechnique.SHAPE_LAB,
  name: "Shape Lab",
  description: "Shapes drawn from their real vertex counts, asked for sides, corners, which shapes compose them, or how many equal shares they are cut into.",
  promptSummary: "Choose a shape and whether to ask about sides, corners, composing, or equal shares.",
  topLevelFields: { targetCount: { min: 0, max: 8, default: 3 } },
  configFields: [
    { key: "shapeTask", label: "Task", type: "enum", enumValues: ["sides", "corners", "compose", "shares"], defaultValue: "sides", description: "Which geometry idea the question asks about.", promptHint: "sides, corners, compose, or shares" },
    { key: "shapeName", label: "Shape", type: "enum", enumValues: ["triangle", "square", "rectangle", "pentagon", "hexagon", "circle"], defaultValue: "triangle", description: "The shape shown." },
    { key: "shapeShares", label: "Equal Parts", type: "enum", enumValues: ["2", "4"], defaultValue: "2", description: "Halves or fourths, used by the shares task." },
    assetTypeField("star"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["shape", "sides", "corners", "vertices", "halves", "fourths", "equal shares", "compose shapes", "partition"],
  exampleOutput: {
    id: "q-shape-triangle-sides", technique: "SHAPE_LAB", title: "How many sides does the triangle have?",
    instruction: "How many sides does the triangle have?", objectId: "star", targetCount: 3,
    config: { shapeTask: "sides", shapeName: "triangle", shapeShares: 2, assetType: "star" },
  },
  presets: PRESETS,
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizeShapeConfig({
      task: raw.config?.shapeTask, shape: raw.config?.shapeName, shares: Number(raw.config?.shapeShares),
    });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "star";
    return {
      id: raw.id || `q-ai-shape-${Date.now()}-${index}`,
      technique: CountingTechnique.SHAPE_LAB,
      title: String(raw.title || shapePrompt(config)),
      instruction: shapePrompt(config),
      objectId,
      targetCount: shapeAnswer(config),
      config: { shapeTask: config.task, shapeName: config.shape, shapeShares: config.shares, assetType: resolveAssetType(objectId) },
    };
  },
};
