/**
 * Addition Sandbox — Component Schema
 * See README.md for the replication recipe this follows.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import { ALL_ASSETS, VALID_ASSET_IDS, resolveAssetType, clampInt, assetTypeField } from "./assets";

const PRESETS: AiPreset[] = [
  { id: "add-apples-3plus2", label: "3 + 2 Apples", prompt: "Add 3 apples and 2 more apples into the basket", emoji: "🍎", technique: CountingTechnique.ADDITION_SANDBOX, theme: "kitchen" },
  { id: "add-balloons-4plus3", label: "4 + 3 Balloons", prompt: "Combine 4 red balloons and 3 blue balloons", emoji: "🎈", technique: CountingTechnique.ADDITION_SANDBOX, theme: "party" },
  { id: "add-stars-5plus4", label: "5 + 4 Stars", prompt: "Add 5 stars and 4 more stars together", emoji: "⭐", technique: CountingTechnique.ADDITION_SANDBOX, theme: "space" },
  /*
    The subtraction half, carried over from the schema merged in here. They are
    the same list now because they are the same component — an author browsing
    presets should see both operations offered, not have to know that the entry
    they want lives under a game that no longer exists.
  */
  { id: "sub-donut-shop", label: "Donut Shop", prompt: "Start with 8 donuts and eat 3 of them, count the leftovers", emoji: "🍩", technique: CountingTechnique.ADDITION_SANDBOX, theme: "bakery" },
  { id: "sub-balloons-pop", label: "Balloons Pop", prompt: "6 balloons at the party and 2 pop, how many are left?", emoji: "🎈", technique: CountingTechnique.ADDITION_SANDBOX, theme: "party" },
  { id: "sub-fish-swim", label: "Fish Swim Away", prompt: "7 fish in the pond and 4 swim away", emoji: "🐟", technique: CountingTechnique.ADDITION_SANDBOX, theme: "aquatic" },
  { id: "sub-cookies-eaten", label: "Cookie Jar", prompt: "Take away 5 cookies from a jar of 9 cookies", emoji: "🍪", technique: CountingTechnique.ADDITION_SANDBOX, theme: "kitchen" },
];

export const additionSchema: ComponentSchema = {
  technique: CountingTechnique.ADDITION_SANDBOX,
  name: "Koda Add & Subtract",

  description: `Koda Add & Subtract — one component, two operations, chosen by \`operation\`.

\`add\` (the default): two labelled groups (Group 1: addend1 items, Group 2: addend2 items) which the child drags into a shared basket, watching the live sum.
\`subtract\`: one plate of \`minuend\` items, of which the child crosses out \`subtrahend\`, and the answer is what is left.

Supports three CPA representations either way. Formerly two components; SUBTRACTION_SANDBOX is absorbed here.`,

  promptSummary: "Child either drags two groups (`addend1`, `addend2`) together into a basket, or crosses `subtrahend` items off a plate of `minuend` — set `operation` to say which.",

  topLevelFields: { targetCount: { min: 2, max: 18, default: 5 } },

  configFields: [
    {
      key: "operation", label: "Operation", type: "enum",
      enumValues: ["add", "subtract"], defaultValue: "add",
      description:
        "Which mechanic to run. 'add' uses addend1 + addend2 and a basket; 'subtract' uses minuend and subtrahend and a plate to cross out from. The addend fields are ignored when subtracting, and the minuend/subtrahend fields when adding.",
      promptHint: "'add' or 'subtract'",
      required: true,
    },
    {
      key: "minuend", label: "Start With", type: "number", defaultValue: 8,
      description: "'subtract' only: how many objects are on the plate to begin with (1-20).",
      promptHint: "subtract only: integer 1-20",
    },
    {
      key: "subtrahend", label: "Take Away", type: "number", defaultValue: 3,
      description: "'subtract' only: how many are crossed out. The answer is minuend minus this.",
      promptHint: "subtract only: integer 1-20",
    },
    {
      key: "addend1", label: "First Group Size", type: "number", defaultValue: 3,
      description: "How many items are in the first group (1-9).",
      promptHint: "integer 1-9",
      required: true,
    },
    {
      key: "addend2", label: "Second Group Size", type: "number", defaultValue: 2,
      description: "How many items are in the second group (1-9).",
      promptHint: "integer 1-9",
      required: true,
    },
    assetTypeField("apple"),
    {
      key: "requireAnswerInput", label: "Answer Input Box", type: "boolean", defaultValue: true,
      description: "Require typing/selecting answer after adding all items into basket.", exposeToAI: false,
    },
    {
      key: "defaultRepresentation", label: "CPA Representation", type: "enum",
      enumValues: ["concrete", "pictorial", "abstract"], defaultValue: "concrete",
      description: "Teacher-facing pedagogy toggle.", exposeToAI: false,
    },
  ],

  assets: ALL_ASSETS,

  /*
    Both operations route here, because both are this component now. The
    subtraction half came from the schema that was merged in: a prompt about
    donuts being eaten has to land somewhere, and after the merge the only place
    it can land is here — with `operation: "subtract"` telling the canvas which
    mechanic the child gets.
  */
  triggerKeywords: [
    "add", "addition", "plus", "combine", "put together", "altogether",
    "and more", "sum", "total of", "join together",
    "subtract", "subtraction", "minus", "take away", "takeaway",
    "cross out", "eat", "eaten", "pop", "swim away", "fly away",
    "remove", "left over", "leftover", "leftovers", "how many are left",
    "remain", "remaining", "fewer",
  ],

  exampleOutput: {
    id: "q-ai-apples-add",
    technique: "ADDITION_SANDBOX",
    title: "Apple Addition",
    instruction: "Add 3 apples and 2 more apples into the basket. How many altogether?",
    objectId: "apple",
    targetCount: 5,
    config: { operation: "add", addend1: 3, addend2: 2 }
  },

  presets: PRESETS,

  tip: "Mention two group sizes and a theme. Try: \"Add 4 fish and 3 more fish into the tank\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const addend1 = clampInt(raw.config?.addend1, 1, 9, 3);
    const addend2 = clampInt(raw.config?.addend2, 1, 9, 2);
    const sum = addend1 + addend2;

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.ADDITION_SANDBOX,
      title: String(raw.title || `Addition Story ${index + 1}`),
      instruction: String(
        raw.instruction || `Add ${addend1} and ${addend2} together. What's the total?`
      ),
      objectId,
      targetCount: sum,
      config: {
        addend1,
        addend2,
        assetType: resolveAssetType(objectId),
        defaultRepresentation: "concrete",
      }
    };
  }
};
