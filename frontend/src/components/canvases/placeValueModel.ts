export type PlaceValueTask = "build_number" | "read_number" | "regroup_ones";
export type PlaceValueDifficulty = "guided" | "independent";

export interface PlaceValueConfig {
  task: PlaceValueTask;
  difficulty: PlaceValueDifficulty;
  target: number;
  showExpanded: boolean;
}

export interface PlaceValueState {
  tens: number;
  ones: number;
}

const TASKS: PlaceValueTask[] = ["build_number", "read_number", "regroup_ones"];
const DIFFICULTIES: PlaceValueDifficulty[] = ["guided", "independent"];

const whole = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
};

export function normalizePlaceValueConfig(input: Partial<PlaceValueConfig>): PlaceValueConfig {
  const task = TASKS.includes(input.task as PlaceValueTask) ? input.task as PlaceValueTask : "build_number";
  const difficulty = DIFFICULTIES.includes(input.difficulty as PlaceValueDifficulty) ? input.difficulty as PlaceValueDifficulty : "guided";
  return {
    task,
    difficulty,
    target: whole(input.target, 10, 99, 34),
    showExpanded: input.showExpanded !== false,
  };
}

export const targetPlaces = (target: number): PlaceValueState => ({ tens: Math.floor(target / 10), ones: target % 10 });

export function initialPlaceValueState(config: PlaceValueConfig): PlaceValueState {
  const target = targetPlaces(config.target);
  if (config.task === "build_number") return { tens: 0, ones: 0 };
  if (config.task === "regroup_ones") return { tens: Math.max(0, target.tens - 1), ones: target.ones + 10 };
  return target;
}

export const representedNumber = (state: PlaceValueState): number => state.tens * 10 + state.ones;

export const placeValueInstruction = (config: PlaceValueConfig): string => {
  if (config.task === "read_number") return "Look at the tens and ones. Choose the number they represent.";
  if (config.task === "regroup_ones") return `Trade 10 ones for 1 ten to make ${config.target}.`;
  return `Build ${config.target} with tens and ones.`;
};

export function placeValueChoices(target: number): number[] {
  const { tens, ones } = targetPlaces(target);
  const candidates = [target, tens + ones * 10, target - 10, target + 10, target - 1, target + 1]
    .filter(value => value >= 10 && value <= 99)
    .filter((value, index, all) => all.indexOf(value) === index);
  let candidate = 10;
  while (candidates.length < 4) {
    if (!candidates.includes(candidate)) candidates.push(candidate);
    candidate += 1;
  }
  return candidates.slice(0, 4).sort((a, b) => a - b);
}
