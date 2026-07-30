import { CountingTechnique } from "../../../../types";
import { normalizeNumberPathConfig, numberPathInstruction } from "../../../canvases/numberPathModel";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ComponentSchema } from "./types";

const VIEWS = ["path", "circle", "stepping_stones", "maze", "chart"] as const;
const TASKS = ["count_forward", "find_number", "ten_more", "ten_less"] as const;
const DIFFICULTIES = ["guided", "independent", "challenge"] as const;

const PRESETS: AiPreset[] = [
  { id: "number-path-36-42", label: "Count 36 to 42", prompt: "Count forward from 36 to 42 on a number path", emoji: "🔢", technique: CountingTechnique.NUMBER_PATH, theme: "numbers" },
  { id: "number-chart-find-87", label: "Find 87", prompt: "Find number 87 on a 120 chart", emoji: "🎯", technique: CountingTechnique.NUMBER_PATH, theme: "numbers" },
  { id: "number-chart-ten-more", label: "10 More Than 46", prompt: "Use a 120 chart to find 10 more than 46", emoji: "⬇️", technique: CountingTechnique.NUMBER_PATH, theme: "numbers" },
  { id: "number-circle-challenge", label: "Number Circle Challenge", prompt: "Count forward from 52 to 58 in a mixed number circle", emoji: "⭕", technique: CountingTechnique.NUMBER_PATH, theme: "numbers" },
  { id: "number-maze-1-10", label: "1–10 Number Maze", prompt: "Find the connected number route from 1 to 10 through a maze", emoji: "🧩", technique: CountingTechnique.NUMBER_PATH, theme: "numbers" },
];

export const numberPathSchema: ComponentSchema = {
  technique: CountingTechnique.NUMBER_PATH,
  name: "Number Path & 120 Chart",
  description: "Students navigate a number path or 120 chart to count forward, identify written numerals, and find 10 more or 10 less.",
  promptSummary: "Choose a number path or 120 chart, a task, and numbers from 1 through 120.",
  topLevelFields: { targetCount: { min: 1, max: 120, default: 42 } },
  configFields: [
    {
      key: "numberChartView", label: "Display", type: "enum", enumValues: [...VIEWS], defaultValue: "path",
      description: "Use a straight path, number circle, stepping stones, connected number maze, or the complete 1–120 chart.", promptHint: "path, circle, stepping_stones, maze, or chart",
    },
    {
      key: "numberChartTask", label: "Learning Task", type: "enum", enumValues: [...TASKS], defaultValue: "count_forward",
      description: "The number relationship the learner practices.", promptHint: "count_forward, find_number, ten_more, or ten_less",
    },
    {
      key: "numberChartDifficulty", label: "Difficulty", type: "enum", enumValues: [...DIFFICULTIES], defaultValue: "independent",
      description: "Guided highlights the next counting step; challenge rearranges short-path choices without changing the mathematics.", promptHint: "guided, independent, or challenge",
    },
    {
      key: "numberChartStart", label: "Starting Number", type: "number", defaultValue: 36,
      description: "Starting or anchor number. Validated for the selected task.", promptHint: "whole number from 1 through 120",
    },
    {
      key: "numberChartEnd", label: "Ending or Target Number", type: "number", defaultValue: 42,
      description: "Ending number for counting or the numeral to locate.", promptHint: "whole number from 1 through 120",
    },
  ],
  assets: [],
  triggerKeywords: ["120 chart", "hundred chart", "number path", "number line", "count to 120", "number circle", "stepping stones", "number maze", "hidden number path", "10 more", "ten more", "10 less", "ten less", "find the number"],
  exampleOutput: {
    id: "q-number-path-count",
    technique: "NUMBER_PATH",
    title: "Count Forward",
    instruction: "Start at 36. Tap each number in order until 42.",
    objectId: "blue_dot",
    targetCount: 42,
    config: { numberChartView: "path", numberChartTask: "count_forward", numberChartDifficulty: "independent", numberChartStart: 36, numberChartEnd: 42 },
  },
  presets: PRESETS,
  tip: "Try: ‘Use a 120 chart to find 10 less than 73.’",
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizeNumberPathConfig({
      view: raw.config?.numberChartView,
      task: raw.config?.numberChartTask,
      difficulty: raw.config?.numberChartDifficulty,
      start: raw.config?.numberChartStart,
      target: raw.config?.numberChartEnd ?? raw.targetCount,
    });
    return {
      id: raw.id || `q-ai-number-path-${Date.now()}-${index}`,
      technique: CountingTechnique.NUMBER_PATH,
      title: String(raw.title || "Number Explorer"),
      instruction: numberPathInstruction(config),
      objectId: "blue_dot",
      targetCount: config.target,
      config: {
        numberChartView: config.view,
        numberChartTask: config.task,
        numberChartDifficulty: config.difficulty,
        numberChartStart: config.start,
        numberChartEnd: config.target,
      },
    };
  },
};
