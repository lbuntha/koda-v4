import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig } from "../types";

export const goodsSortSchema: ComponentSchema = {
  technique: CountingTechnique.GOODS_SORT,
  name: "Goods Shelf Sort",
  description: "A goods shelf sorting puzzle: gather every kind of goods into a compartment of its own.",
  promptSummary: "Goods shelf sorting puzzle. Player moves goods between wooden shelf compartments until each compartment holds a single kind.",
  topLevelFields: { targetCount: { min: 3, max: 8, default: 3 } },
  configFields: [
    {
      key: "levelId",
      label: "Curriculum Level",
      type: "string",
      defaultValue: "level_1",
      description: "Selected curriculum level (level_1 to level_30, a preset_ theme, or custom)",
    },
    {
      key: "gridRows",
      label: "Grid Rows",
      type: "number",
      defaultValue: 3,
      description: "Number of rows in cabinet (2-6), used for custom boards",
    },
    {
      key: "gridCols",
      label: "Grid Columns",
      type: "number",
      defaultValue: 3,
      description: "Number of columns in cabinet (2-6), used for custom boards",
    },
    {
      key: "compartmentCapacity",
      label: "Shelf Capacity",
      type: "number",
      defaultValue: 3,
      description: "Items per shelf (3 for triplets, 4 for quads)",
    },
  ],
  assets: [],
  triggerKeywords: ["goods sort", "shelf sort", "triple match", "goods match", "shelf match", "custom goods"],
  exampleOutput: {
    id: "q-ai-goods-sort",
    technique: "GOODS_SORT",
    title: "Goods Shelf Sort",
    instruction: "Sort the shelves until every kind of goods has a compartment of its own!",
    targetCount: 3,
    config: {
      levelId: "custom",
      gridRows: 3,
      gridCols: 3,
      compartmentCapacity: 3,
      goodsTypes: ["chips", "cola", "milk"],
    },
  },
  presets: [
    {
      id: "preset-goods-beginner",
      label: "Supermarket Starter (Level 1)",
      prompt: "Create a Level 1 goods shelf sort game",
      emoji: "📦",
      technique: CountingTechnique.GOODS_SORT,
      theme: "classic",
    },
    {
      id: "preset-goods-custom-bakery",
      label: "Custom Bakery & Sweets (Donuts & Popsicles)",
      prompt: "Create a custom 3x3 shelf puzzle with donuts and popsicles",
      emoji: "🍩",
      technique: CountingTechnique.GOODS_SORT,
      theme: "playful",
    },
  ],
  validate(raw: any, index: number): ParsedSlideConfig {
    return {
      id: raw.id || `q-goods-sort-${index}`,
      technique: CountingTechnique.GOODS_SORT,
      title: raw.title || "Goods Shelf Sort",
      instruction: raw.instruction || "Sort the shelves until every kind of goods has a compartment of its own!",
      targetCount: typeof raw.targetCount === "number" ? raw.targetCount : 3,
      objectId: raw.objectId || "chips",
      config: {
        levelId: raw.config?.levelId || "level_1",
        gridRows: typeof raw.config?.gridRows === "number" ? raw.config.gridRows : 3,
        gridCols: typeof raw.config?.gridCols === "number" ? raw.config.gridCols : 3,
        compartmentCapacity: typeof raw.config?.compartmentCapacity === "number" ? raw.config.compartmentCapacity : 3,
        goodsTypes: Array.isArray(raw.config?.goodsTypes) ? raw.config.goodsTypes : undefined,
        customGoods: Array.isArray(raw.config?.customGoods) ? raw.config.customGoods : undefined,
      },
    };
  },
};
