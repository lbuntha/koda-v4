import { CountingTechnique } from "../../../../types";
import { equationAnswer, equationText, normalizeEquationConfig } from "../../../canvases/EquationMatCanvas";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "eq-missing-addend", label: "8 + ? = 11", prompt: "Use the Equation Mat to hide the second addend in 8 + 3 = 11", emoji: "❓", technique: CountingTechnique.EQUATION_MAT, theme: "numbers" },
  { id: "eq-missing-start", label: "? + 4 = 9", prompt: "Hide the first number in 5 + 4 = 9 on the equation mat", emoji: "🧩", technique: CountingTechnique.EQUATION_MAT, theme: "numbers" },
  { id: "eq-total", label: "6 + 5 = ?", prompt: "Ask for the total of 6 + 5 on the equation mat", emoji: "➕", technique: CountingTechnique.EQUATION_MAT, theme: "numbers" },
  { id: "eq-subtract", label: "13 − ? = 8", prompt: "Hide how many were taken away in 13 − 5 = 8", emoji: "➖", technique: CountingTechnique.EQUATION_MAT, theme: "numbers" },
  { id: "eq-judge", label: "5 + 2 = 3 + 4?", prompt: "Ask whether 5 + 2 = 3 + 4 is true or false on the equation mat", emoji: "⚖️", technique: CountingTechnique.EQUATION_MAT, theme: "numbers" },
];

export const equationMatSchema: ComponentSchema = {
  technique: CountingTechnique.EQUATION_MAT,
  name: "Equation Mat",
  description: "An addition or subtraction equation with one quantity hidden. The child reads the two groups that are shown and works out the missing one, which may be the total, the second number, or the first. It can also show a complete equation — including one with a sum on each side, like 5 + 2 = 3 + 4 — and ask whether it is true.",
  promptSummary: "Choose an operation, two numbers, and which quantity to hide — or 'judge' to show the whole equation and ask true or false.",
  // The answer, not the total: hiding the second number in 8 + 3 = 11 asks for 3.
  topLevelFields: { targetCount: { min: 0, max: 20, default: 3 } },
  configFields: [
    { key: "equationOperation", label: "Operation", type: "enum", enumValues: ["add", "subtract"], defaultValue: "add", description: "Whether the groups are joined or taken away.", promptHint: "add or subtract" },
    { key: "equationFirst", label: "First Number", type: "number", defaultValue: 8, description: "The first quantity, 0 through 20." },
    { key: "equationSecond", label: "Second Number", type: "number", defaultValue: 3, description: "The second quantity. Never more than the first when subtracting, and never taking the total past 20 when adding." },
    { key: "equationUnknown", label: "Hidden Quantity", type: "enum", enumValues: ["result", "second", "first", "judge"], defaultValue: "second", description: "Which quantity the child must find. 'second' and 'first' are the missing-addend cases that make this an equation rather than a sum. 'judge' hides nothing and asks whether the equation is true — its answer is 1 for true, 0 for false.", promptHint: "result, second, first, or judge" },
    { key: "equationClaimFirst", label: "Right-Hand Side", type: "number", defaultValue: 0, description: "Only for 'judge': what the right of the equals sign says. Ignored otherwise." },
    { key: "equationClaimSecond", label: "Right-Hand Side, Second Number", type: "number", defaultValue: 0, description: "Only for 'judge': set it to make the right side a sum too, as in 5 + 2 = 3 + 4. Use 0 for a plain number." },
    assetTypeField("apple"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["equation mat", "missing number", "missing addend", "unknown number", "find the unknown", "balance the equation", "what makes this true", "equal sign", "fill in the blank equation"],
  exampleOutput: {
    id: "q-equation-8-plus-blank",
    technique: "EQUATION_MAT",
    title: "8 + ? = 11",
    instruction: "One group is hidden. Tap the number that makes the equation true.",
    objectId: "apple",
    targetCount: 3,
    config: { equationOperation: "add", equationFirst: 8, equationSecond: 3, equationUnknown: "second", assetType: "apple" },
  },
  presets: PRESETS,
  tip: "Try: ‘Hide the first number in 6 + 7 = 13 so the child has to work backwards’, or ‘Ask whether 5 + 2 = 3 + 4 is true.’",
  validate(raw: any, index: number): ParsedSlideConfig {
    const config = normalizeEquationConfig({
      operation: raw.config?.equationOperation,
      first: raw.config?.equationFirst,
      second: raw.config?.equationSecond,
      unknown: raw.config?.equationUnknown,
      claimFirst: raw.config?.equationClaimFirst,
      claimSecond: raw.config?.equationClaimSecond,
    });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    return {
      id: raw.id || `q-ai-equation-${Date.now()}-${index}`,
      technique: CountingTechnique.EQUATION_MAT,
      title: String(raw.title || equationText(config)),
      instruction: config.unknown === "judge"
        ? "Count both sides. Is this true or false?"
        : config.unknown === "result"
          ? "How many altogether? Tap the number."
          : "One group is hidden. Tap the number that makes the equation true.",
      objectId,
      // The answer the child supplies — what both the canvas and the server grade against.
      targetCount: equationAnswer(config),
      config: {
        equationOperation: config.operation,
        equationFirst: config.first,
        equationSecond: config.second,
        equationUnknown: config.unknown,
        equationClaimFirst: config.claimFirst,
        equationClaimSecond: config.claimSecond,
        assetType: resolveAssetType(objectId),
      },
    };
  },
};
