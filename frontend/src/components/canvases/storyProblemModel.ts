export type StoryProblemType = "add_to" | "take_from" | "put_together" | "take_apart" | "compare" | "three_addends";
export type StoryUnknown = "result" | "change" | "start" | "part";
export type StoryScene = "park" | "picnic" | "pond" | "space" | "classroom";

export interface StoryProblemConfig {
  type: StoryProblemType;
  unknown: StoryUnknown;
  first: number;
  second: number;
  third: number;
  scene: StoryScene;
  characterName: string;
}

const TYPES: StoryProblemType[] = ["add_to", "take_from", "put_together", "take_apart", "compare", "three_addends"];
const SCENES: StoryScene[] = ["park", "picnic", "pond", "space", "classroom"];

const whole = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
};

export function allowedUnknowns(type: StoryProblemType): StoryUnknown[] {
  if (type === "add_to" || type === "take_from") return ["result", "change", "start"];
  if (type === "put_together") return ["result", "part"];
  if (type === "take_apart") return ["part"];
  return ["result"];
}

export function normalizeStoryProblemConfig(input: Partial<StoryProblemConfig>): StoryProblemConfig {
  const type = TYPES.includes(input.type as StoryProblemType) ? input.type as StoryProblemType : "add_to";
  const scene = SCENES.includes(input.scene as StoryScene) ? input.scene as StoryScene : "park";
  const permitted = allowedUnknowns(type);
  const unknown = permitted.includes(input.unknown as StoryUnknown) ? input.unknown as StoryUnknown : permitted[0];
  const characterName = String(input.characterName || "Koda").trim().slice(0, 24) || "Koda";

  let first = whole(input.first, 1, 19, type === "take_apart" ? 8 : 5);
  let second = whole(input.second, 1, 19, 3);
  let third = whole(input.third, 1, 18, 2);

  if (type === "add_to" || type === "put_together") second = Math.min(second, 20 - first);
  if (type === "take_from" || type === "take_apart") second = Math.min(second, first);
  if (type === "compare") {
    const larger = Math.max(first, second);
    const smaller = Math.min(first, second);
    first = larger;
    second = smaller;
  }
  if (type === "three_addends") {
    first = Math.min(first, 18);
    second = Math.min(second, 19 - first);
    third = Math.min(third, 20 - first - second);
  }

  return { type, unknown, first, second, third, scene, characterName };
}

export function storyAnswer(config: StoryProblemConfig): number {
  if (config.type === "add_to") return config.unknown === "start" ? config.first : config.unknown === "change" ? config.second : config.first + config.second;
  if (config.type === "take_from") return config.unknown === "start" ? config.first : config.unknown === "change" ? config.second : config.first - config.second;
  if (config.type === "put_together") return config.unknown === "part" ? config.second : config.first + config.second;
  if (config.type === "take_apart") return config.first - config.second;
  if (config.type === "compare") return config.first - config.second;
  return config.first + config.second + config.third;
}

export function storyEquation(config: StoryProblemConfig): string {
  const q = "?";
  if (config.type === "add_to") return `${config.unknown === "start" ? q : config.first} + ${config.unknown === "change" ? q : config.second} = ${config.unknown === "result" ? q : config.first + config.second}`;
  if (config.type === "take_from") return `${config.unknown === "start" ? q : config.first} − ${config.unknown === "change" ? q : config.second} = ${config.unknown === "result" ? q : config.first - config.second}`;
  if (config.type === "put_together") return `${config.first} + ${config.unknown === "part" ? q : config.second} = ${config.unknown === "result" ? q : config.first + config.second}`;
  if (config.type === "take_apart") return `${config.first} − ${config.second} = ?`;
  if (config.type === "compare") return `${config.first} − ${config.second} = ?`;
  return `${config.first} + ${config.second} + ${config.third} = ?`;
}

export function storyText(config: StoryProblemConfig, objectLabel = "apples"): string {
  const name = config.characterName;
  const lowerLabel = objectLabel.toLowerCase();
  const item = lowerLabel === "fish" || lowerLabel.endsWith("s") ? lowerLabel : `${lowerLabel}s`;
  if (config.type === "add_to") {
    if (config.unknown === "start") return `${name} had some ${item}. ${config.second} more arrived. Now there are ${config.first + config.second}. How many were there at the start?`;
    if (config.unknown === "change") return `${name} had ${config.first} ${item}. Some more arrived. Now there are ${config.first + config.second}. How many arrived?`;
    return `${name} had ${config.first} ${item}. ${config.second} more arrived. How many are there now?`;
  }
  if (config.type === "take_from") {
    if (config.unknown === "start") return `${name} had some ${item}. ${config.second} went away. ${config.first - config.second} remain. How many were there at the start?`;
    if (config.unknown === "change") return `${name} had ${config.first} ${item}. Some went away. ${config.first - config.second} remain. How many went away?`;
    return `${name} had ${config.first} ${item}. ${config.second} went away. How many remain?`;
  }
  if (config.type === "put_together") return config.unknown === "part"
    ? `${name} has ${config.first + config.second} ${item}. ${config.first} are in one group. How many are in the other group?`
    : `${name} has ${config.first} ${item} in one group and ${config.second} in another. How many altogether?`;
  if (config.type === "take_apart") return `${name} has ${config.first} ${item}. ${config.second} are in one group. How many are in the other group?`;
  if (config.type === "compare") return `${name} has ${config.first} ${item}. A friend has ${config.second}. How many more does ${name} have?`;
  return `${name} found ${config.first}, then ${config.second}, then ${config.third} ${item}. How many altogether?`;
}

export function answerChoices(answer: number, authored?: number[]): number[] {
  const validAuthored = (authored || [])
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 20)
    .map(value => Math.round(value))
    .filter((value, index, all) => all.indexOf(value) === index);
  const candidates = [answer, ...validAuthored, answer - 1, answer + 1, answer + 2, answer - 2, answer + 3]
    .filter(value => value >= 0 && value <= 20)
    .filter((value, index, all) => all.indexOf(value) === index);
  return candidates.slice(0, 4).sort((a, b) => a - b);
}
