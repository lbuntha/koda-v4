export type NumberChartView = "path" | "circle" | "stepping_stones" | "maze" | "chart";
export type NumberChartTask = "count_forward" | "find_number" | "ten_more" | "ten_less";
export type NumberChartDifficulty = "guided" | "independent" | "challenge";

export interface NumberPathConfig {
  view: NumberChartView;
  task: NumberChartTask;
  difficulty: NumberChartDifficulty;
  start: number;
  target: number;
}

export const NUMBER_MIN = 1;
export const NUMBER_MAX = 120;

export const clampWhole = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
};

export function normalizeNumberPathConfig(input: Partial<NumberPathConfig>): NumberPathConfig {
  const view: NumberChartView = ["path", "circle", "stepping_stones", "maze", "chart"].includes(input.view || "")
    ? input.view as NumberChartView
    : "path";
  const task: NumberChartTask = ["count_forward", "find_number", "ten_more", "ten_less"].includes(input.task || "")
    ? input.task as NumberChartTask
    : "count_forward";
  const difficulty: NumberChartDifficulty = ["guided", "independent", "challenge"].includes(input.difficulty || "")
    ? input.difficulty as NumberChartDifficulty
    : "independent";

  if (task === "ten_more") {
    const start = clampWhole(input.start, NUMBER_MIN, 110, 34);
    return { view, task, difficulty, start, target: start + 10 };
  }
  if (task === "ten_less") {
    const start = clampWhole(input.start, 11, NUMBER_MAX, 64);
    return { view, task, difficulty, start, target: start - 10 };
  }
  if (task === "find_number") {
    const target = clampWhole(input.target, NUMBER_MIN, NUMBER_MAX, 47);
    return { view, task, difficulty, start: target, target };
  }

  const start = clampWhole(input.start, NUMBER_MIN, 119, 36);
  const target = clampWhole(input.target, start + 1, Math.min(NUMBER_MAX, start + 9), Math.min(NUMBER_MAX, start + 5));
  return { view, task, difficulty, start, target };
}

export function requiredNumbers(config: NumberPathConfig): number[] {
  if (config.task !== "count_forward") return [config.target];
  return Array.from({ length: config.target - config.start }, (_, index) => config.start + index + 1);
}

export function pathNumbers(config: NumberPathConfig): number[] {
  if (config.task === "count_forward") {
    const first = Math.max(NUMBER_MIN, Math.min(111, config.start));
    return Array.from({ length: 10 }, (_, index) => first + index);
  }
  if (config.task === "find_number") {
    const first = Math.max(NUMBER_MIN, Math.min(111, config.target - 4));
    return Array.from({ length: 10 }, (_, index) => first + index);
  }
  const first = Math.min(config.start, config.target);
  return Array.from({ length: Math.abs(config.target - config.start) + 1 }, (_, index) => first + index);
}

/** Challenge mode changes only the search arrangement; the required answer sequence stays untouched. */
export function arrangedPathNumbers(config: NumberPathConfig): number[] {
  const values = pathNumbers(config);
  if (config.difficulty !== "challenge" || config.view === "chart") return values;
  const anchor = config.task === "find_number" ? null : config.start;
  const remaining = anchor === null ? values : values.filter(value => value !== anchor);
  const scrambled = remaining.filter((_, index) => index % 2 === 1).concat(remaining.filter((_, index) => index % 2 === 0));
  return anchor === null ? scrambled : [anchor, ...scrambled];
}

export const MAZE_ROUTE_INDICES = [20, 16, 12, 8, 4, 3, 7, 11, 15, 21] as const;

/** Build a stable 5×5 maze with the real route embedded among unique distractors. */
export function mazeNumbers(config: NumberPathConfig): number[] {
  const route = config.task === "count_forward" ? [config.start, ...requiredNumbers(config)] : config.task === "find_number" ? [config.target] : [config.start, config.target];
  const reserved = new Set(route);
  const values: number[] = [];
  let candidate = ((config.start + config.target) * 7) % NUMBER_MAX + 1;
  while (values.length < 25) {
    if (!reserved.has(candidate) && !values.includes(candidate)) values.push(candidate);
    candidate = candidate % NUMBER_MAX + 1;
  }
  route.forEach((value, index) => {
    const cellIndex = config.task === "find_number" ? MAZE_ROUTE_INDICES[2] : MAZE_ROUTE_INDICES[index];
    if (cellIndex !== undefined) values[cellIndex] = value;
  });
  return values;
}

export function numberPathInstruction(config: NumberPathConfig): string {
  if (config.task === "find_number") return `Find and tap ${config.target}.`;
  if (config.task === "ten_more") return `Start at ${config.start}. Find the number that is 10 more.`;
  if (config.task === "ten_less") return `Start at ${config.start}. Find the number that is 10 less.`;
  return `Start at ${config.start}. Tap each number in order until ${config.target}.`;
}
