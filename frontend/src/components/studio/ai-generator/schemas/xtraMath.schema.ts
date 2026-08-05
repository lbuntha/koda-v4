/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig } from "../types";

export const xtraMathSchema: ComponentSchema = {
  technique: CountingTechnique.XTRA_MATH,
  name: "XtraMath Speed Fluency",
  description: "Comprehensive math facts fluency (Addition, Subtraction, Multiplication, Division) with Koda mascot guide and play vs computer rival mode.",
  promptSummary: "XtraMath speed fluency practice across all operations with customizable time limits and computer rival.",
  topLevelFields: { targetCount: { min: 3, max: 30, default: 10 } },
  configFields: [
    {
      key: "levelId",
      label: "Curriculum Level",
      type: "string",
      defaultValue: "xm_level_1",
      description: "Selected XtraMath level preset (xm_level_1 to xm_level_9)",
    },
    {
      key: "themeId",
      label: "Visual Theme",
      type: "string",
      defaultValue: "classic",
      description: "classic | cyber | candy | galaxy | forest",
    },
    {
      key: "timeLimitSec",
      label: "Time Limit per Question",
      type: "number",
      defaultValue: 6,
      description: "Seconds per question (2 to 15)",
    },
    {
      key: "defaultVsComputer",
      label: "Play vs Computer",
      type: "boolean",
      defaultValue: false,
      description: "Default state for Computer Rival KodaBot (ON / OFF)",
    },
  ],
  assets: [],
  triggerKeywords: [
    "xtramath", "xtra math", "speed math", "math facts", "addition fluency",
    "multiplication tables", "play vs computer", "math speed drill",
  ],
  exampleOutput: {
    id: "q-ai-xtramath",
    technique: "XTRA_MATH",
    title: "XtraMath Speed Challenge",
    instruction: "Solve the math facts quickly and accurately to earn fluency stars!",
    targetCount: 10,
    config: {
      levelId: "xm_level_3",
      themeId: "classic",
      timeLimitSec: 6,
      defaultVsComputer: false,
    },
  },
  presets: [
    {
      id: "preset-xm-addition",
      label: "Addition Facts (Sums to 10)",
      prompt: "Create an XtraMath addition facts fluency drill for sums up to 10",
      emoji: "➕",
      technique: CountingTechnique.XTRA_MATH,
      theme: "classic",
    },
    {
      id: "preset-xm-multiplication",
      label: "Times Tables (1–12)",
      prompt: "Create an XtraMath multiplication table speed drill for 1 through 12",
      emoji: "✖️",
      technique: CountingTechnique.XTRA_MATH,
      theme: "cyber",
    },
  ],
  validate(raw: any, index: number): ParsedSlideConfig {
    const rawConfig = (raw.config as any) || {};
    const targetCount = typeof raw.targetCount === "number" ? Math.max(3, raw.targetCount) : 10;

    return {
      id: raw.id || `q-xtramath-${index}-${Date.now()}`,
      technique: CountingTechnique.XTRA_MATH,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "XtraMath Fluency Challenge",
      instruction: typeof raw.instruction === "string" && raw.instruction.trim()
        ? raw.instruction
        : "Solve the math facts quickly and accurately!",
      objectId: raw.objectId || "star",
      targetCount,
      config: {
        levelId: rawConfig.levelId || "xm_level_1",
        themeId: rawConfig.themeId || "classic",
        timeLimitSec: typeof rawConfig.timeLimitSec === "number" ? rawConfig.timeLimitSec : 6,
        defaultVsComputer: Boolean(rawConfig.defaultVsComputer),
      },
    };
  },
};
