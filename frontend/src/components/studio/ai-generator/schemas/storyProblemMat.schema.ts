import { CountingTechnique } from "../../../../types";
import { normalizeStoryProblemConfig, storyAnswer, storyText } from "../../../canvases/storyProblemModel";
import { AiPreset, ParsedSlideConfig } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, assetTypeField, resolveAssetType } from "./assets";
import { ComponentSchema } from "./types";

const PRESETS: AiPreset[] = [
  { id: "story-join", label: "More arrive", prompt: "Create an add-to story with 6 apples and 4 more arriving", emoji: "🍎", technique: CountingTechnique.STORY_PROBLEM_MAT, theme: "nature" },
  { id: "story-leave", label: "Some leave", prompt: "Create a take-from story within 10 where some ducks leave a pond", emoji: "🦆", technique: CountingTechnique.STORY_PROBLEM_MAT, theme: "nature" },
  { id: "story-parts", label: "Find a part", prompt: "Create a take-apart story with a missing part and a whole within 20", emoji: "🧩", technique: CountingTechnique.STORY_PROBLEM_MAT, theme: "numbers" },
  { id: "story-compare", label: "How many more?", prompt: "Create a compare story asking how many more one child has", emoji: "⚖️", technique: CountingTechnique.STORY_PROBLEM_MAT, theme: "numbers" },
  { id: "story-three", label: "Three groups", prompt: "Create a three-addend story with a total no greater than 20", emoji: "⭐", technique: CountingTechnique.STORY_PROBLEM_MAT, theme: "space" },
];

export const storyProblemMatSchema: ComponentSchema = {
  technique: CountingTechnique.STORY_PROBLEM_MAT,
  name: "Story Problem Mat",
  description: "Students model and solve Grade 1 joining, separating, part-whole, comparison, and three-addend stories with concrete visual groups.",
  promptSummary: "Create one coherent Grade 1 story problem within 20. Choose its mathematical structure and which quantity is unknown; the validator derives the answer.",
  topLevelFields: { targetCount: { min: 0, max: 20, default: 9 } },
  configFields: [
    { key: "storyProblemType", label: "Problem Type", type: "enum", enumValues: ["add_to", "take_from", "put_together", "take_apart", "compare", "three_addends"], defaultValue: "add_to", description: "The mathematical action or relationship in the story.", promptHint: "add_to, take_from, put_together, take_apart, compare, or three_addends" },
    { key: "storyUnknown", label: "Unknown", type: "enum", enumValues: ["result", "change", "start", "part"], defaultValue: "result", description: "The quantity the child must find. Unsupported combinations are normalized safely.", promptHint: "result, change, start, or part" },
    { key: "storyStart", label: "First Quantity", type: "number", defaultValue: 5, description: "Starting quantity, whole, larger comparison group, or first addend. Use 1–19." },
    { key: "storyPart2", label: "Second Quantity", type: "number", defaultValue: 4, description: "Change, known part, smaller group, or second addend. Values are constrained to keep the story valid and within 20." },
    { key: "storyPart3", label: "Third Quantity", type: "number", defaultValue: 2, description: "Third addend, used only by three-addend stories." },
    { key: "storyScene", label: "Scene", type: "enum", enumValues: ["park", "picnic", "pond", "space", "classroom"], defaultValue: "park", description: "A light visual context that does not change the mathematics." },
    { key: "storyCharacterName", label: "Character", type: "string", defaultValue: "Koda", description: "A short, child-friendly character name." },
    { key: "storySceneEmoji", label: "Story Icon", type: "string", defaultValue: "", description: "One emoji shown in front of the story sentence. Leave empty to use the scene's own icon. A teacher can swap this for artwork from their SVG library in the Studio." },
    assetTypeField("apple"),
  ],
  assets: ALL_ASSETS,
  triggerKeywords: ["story problem", "word problem", "problem mat", "how many altogether", "how many remain", "how many left", "how many more", "missing part", "take apart story", "put together story", "add-to story", "take-from story", "three addends story"],
  exampleOutput: {
    id: "q-story-join",
    technique: "STORY_PROBLEM_MAT",
    title: "More Apples Arrive",
    instruction: "Koda had 5 apples. 4 more arrived. How many are there now?",
    objectId: "apple",
    targetCount: 9,
    config: { storyProblemType: "add_to", storyUnknown: "result", storyStart: 5, storyPart2: 4, storyPart3: 2, storyScene: "park", storyCharacterName: "Koda", assetType: "apple" },
  },
  presets: PRESETS,
  tip: "Try: ‘Make a take-from pond story with the change unknown.’",
  validate(raw: any, index: number): ParsedSlideConfig {
    const sceneEmoji = String(raw.config?.storySceneEmoji || "").trim().slice(0, 4);
    const config = normalizeStoryProblemConfig({
      type: raw.config?.storyProblemType,
      unknown: raw.config?.storyUnknown,
      first: raw.config?.storyStart,
      second: raw.config?.storyPart2 ?? raw.config?.storyChange,
      third: raw.config?.storyPart3,
      scene: raw.config?.storyScene,
      characterName: raw.config?.storyCharacterName,
    });
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const object = ALL_ASSETS.find(asset => asset.id === objectId) || ALL_ASSETS[0];
    return {
      id: raw.id || `q-ai-story-mat-${Date.now()}-${index}`,
      technique: CountingTechnique.STORY_PROBLEM_MAT,
      title: String(raw.title || "Solve the Story"),
      instruction: storyText(config, object.label),
      objectId,
      targetCount: storyAnswer(config),
      config: {
        storyProblemType: config.type,
        storyUnknown: config.unknown,
        storyStart: config.first,
        storyChange: config.second,
        storyPart2: config.second,
        storyPart3: config.third,
        storyScene: config.scene,
        storyCharacterName: config.characterName,
        // One emoji, or nothing — never a sentence in the icon slot.
        ...(sceneEmoji ? { storySceneEmoji: sceneEmoji } : {}),
        assetType: resolveAssetType(objectId),
      },
    };
  },
};
