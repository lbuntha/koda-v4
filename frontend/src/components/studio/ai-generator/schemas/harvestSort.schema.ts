/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Harvest Crop Sort AI Generator Schema definition.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig } from "../types";

export const harvestSortSchema: ComponentSchema = {
  technique: CountingTechnique.HARVEST_SORT,
  name: "Harvest Crop Sort",
  description: "A fast-paced farm crop sorting game with animated conveyor belt, drag & drop, quick tap, fling physics, and dynamic weather canvas.",
  promptSummary: "Sort incoming farm produce (fruits, veggies, berries, nuts, spoiled crops) from a moving conveyor belt into categorized harvest crates.",
  topLevelFields: { targetCount: { min: 5, max: 35, default: 15 } },
  configFields: [
    {
      key: "levelId",
      label: "Curriculum Level",
      type: "number",
      defaultValue: 1,
      description: "Level ID (1 to 5)",
    },
    {
      key: "weather",
      label: "Weather Mode",
      type: "string",
      defaultValue: "sunny",
      description: "Weather mode: sunny, rainy, snowy",
    },
  ],
  assets: [],
  triggerKeywords: ["harvest sort", "crop sort", "farm sort", "conveyor sort", "fruit sort", "veggie sort", "produce sort"],
  exampleOutput: {
    id: "q-ai-harvest-sort",
    technique: "HARVEST_SORT",
    title: "Harvest Crop Sort",
    instruction: "Sort all incoming produce into the correct farm crates!",
    targetCount: 15,
    config: { levelId: 1, weather: "sunny" },
  },
  presets: [
    {
      id: "preset-harvest-sunny",
      label: "Sunny Farm Harvest",
      prompt: "Create a Level 1 sunny farm crop sorting game",
      emoji: "🌾",
      technique: CountingTechnique.HARVEST_SORT,
      theme: "classic",
    },
  ],
  tip: "Sort crops continuously from the conveyor belt into Fruit, Veggie, Berry, Grain, or Compost crates!",
  validate(raw: any, index: number): ParsedSlideConfig {
    const levelId = Number(raw.config?.levelId || 1);
    const weather = String(raw.config?.weather || "sunny");
    return {
      id: raw.id || `q-ai-harvest-sort-${Date.now()}-${index}`,
      technique: CountingTechnique.HARVEST_SORT,
      title: String(raw.title || "Harvest Crop Sort"),
      instruction: String(raw.instruction || "Sort the farm produce into matching harvest crates!"),
      objectId: "apple",
      targetCount: Number(raw.targetCount || 15),
      config: {
        levelId,
        weather,
      },
    };
  },
};
