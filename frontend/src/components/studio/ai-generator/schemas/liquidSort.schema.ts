import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig } from "../types";

export const liquidSortSchema: ComponentSchema = {
  technique: CountingTechnique.LIQUID_SORT,
  name: "Liquid Color Sort",
  description: "A liquid color sorting bottle puzzle with glass pouring animation and curated curriculum levels.",
  promptSummary: "Liquid color sorting puzzle. The child pours colors between bottles to sort each color into its own bottle.",
  topLevelFields: { targetCount: { min: 3, max: 10, default: 3 } },
  configFields: [
    {
      key: "levelId",
      label: "Curriculum Level",
      type: "string",
      defaultValue: "level_1",
      description: "Selected system curriculum level (level_1 through level_15)",
    },
    {
      key: "difficultyTier",
      label: "Difficulty Tier",
      type: "string",
      defaultValue: "beginner",
      description: "Difficulty tier: beginner, apprentice, advanced, master, grandmaster",
    }
  ],
  assets: [],
  triggerKeywords: ["liquid sort", "color sort", "pour", "bottle sort", "liquid color sort", "water sort"],
  exampleOutput: {
    id: "q-ai-liquid-sort",
    technique: "LIQUID_SORT",
    title: "Liquid Color Sort",
    instruction: "Pour the colored liquids between bottles until each bottle has only one color!",
    targetCount: 3,
    config: { levelId: "level_1", difficultyTier: "beginner" }
  },
  presets: [
    {
      id: "preset-liquid-beginner",
      label: "Beginner Level 1",
      prompt: "Create a Level 1 beginner liquid sort game",
      emoji: "🧪",
      technique: CountingTechnique.LIQUID_SORT,
      theme: "classic",
    }
  ],
  tip: "Select a level from Level 1 (2 Colors) to Level 10 (8 Colors + Mystery Layers)",
  validate(raw: any, index: number): ParsedSlideConfig {
    const levelId = String(raw.config?.levelId || "level_1");
    const difficultyTier = String(raw.config?.difficultyTier || "beginner");
    return {
      id: raw.id || `q-ai-liquid-sort-${Date.now()}-${index}`,
      technique: CountingTechnique.LIQUID_SORT,
      title: String(raw.title || "Liquid Color Sort"),
      instruction: String(raw.instruction || "Sort all the colored liquids into their own bottles!"),
      objectId: "star",
      targetCount: Number(raw.targetCount || 3),
      config: {
        levelId,
        difficultyTier
      }
    };
  }
};

