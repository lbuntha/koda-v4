/**
 * Classroom Sorting Detective (Flexible Canvas) — Component Schema
 *
 * Supports 4 modes (multichoice, textinput, dragmatch, tapcount) in one
 * schema — the AI picks the mode and supplies only CONTENT (items, bins,
 * answer text). Item/bin pixel positions are never requested: like Sudoku's
 * grid and Pattern's sequence, layout is a constraint problem the model
 * would solve inconsistently, so validate() lays everything out on the
 * canvas's fixed design grid deterministically.
 *
 * See README.md for the general replication recipe.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";

type FlexibleMode = "multichoice" | "textinput" | "dragmatch" | "tapcount";
const MODES: FlexibleMode[] = ["multichoice", "textinput", "dragmatch", "tapcount"];
const BG_STYLES = ["clean", "board", "grid", "stars", "meadow"] as const;

// Matches FlexibleCanvas's authoring grid (STAGE_W x STAGE_H in FlexibleCanvas.tsx).
const STAGE_W = 480;
const STAGE_H = 320;
const ITEM_SIZE = 44;
const BIN_W = 150;
const BIN_H = 105;

const DEFAULT_ITEMS = [{ emoji: "🍎" }, { emoji: "🍎" }, { emoji: "🎈" }, { emoji: "🎈" }, { emoji: "🎈" }];

const PRESETS: AiPreset[] = [
  { id: "flex-fruit-veg", label: "Sort Fruit vs Veg", prompt: "Sort fruit and vegetables into two bins", emoji: "🥕", technique: CountingTechnique.FLEXIBLE_CANVAS, theme: "kitchen" },
  { id: "flex-pick-number", label: "Pick the Total", prompt: "Show a group of 5 apples and 4 answer options to choose the total", emoji: "🍎", technique: CountingTechnique.FLEXIBLE_CANVAS, theme: "kitchen" },
  { id: "flex-tap-bugs", label: "Tap to Count Bugs", prompt: "Tap each bug to count how many there are", emoji: "🐞", technique: CountingTechnique.FLEXIBLE_CANVAS, theme: "nature" },
  { id: "flex-type-answer", label: "Type the Answer", prompt: "Type in how many balloons you count", emoji: "🎈", technique: CountingTechnique.FLEXIBLE_CANVAS, theme: "party" },
];

export const flexibleCanvasSchema: ComponentSchema = {
  technique: CountingTechnique.FLEXIBLE_CANVAS,
  name: "Classroom Sorting Detective",

  description: `The most general activity type, with 4 modes:
- multichoice: pick the correct answer from options
- textinput: type in the correct answer
- dragmatch: sort items by dragging each into its labeled bin
- tapcount: tap each item to count it
The AI supplies content (items, bin labels, answer, options); positions on the canvas are computed automatically, never by the AI.`,

  promptSummary: "One of 4 sub-activities — multiple choice, typed answer, drag-to-sort bins, or tap-to-count — chosen by mode.",

  topLevelFields: { targetCount: { min: 1, max: 12, default: 5 } },

  configFields: [
    {
      key: "flexibleMode", label: "Activity Mode", type: "enum",
      enumValues: [...MODES], defaultValue: "multichoice",
      description: "Which of the 4 sub-activities to generate.",
      promptHint: "pick based on the request: sorting→dragmatch, 'pick the answer'→multichoice, 'type'→textinput, else tapcount",
      required: true,
    },
    {
      key: "flexibleBgStyle", label: "Background Scene", type: "enum",
      enumValues: [...BG_STYLES], defaultValue: "clean",
      description: "Decorative canvas backdrop.",
      promptHint: "match theme: grid=classroom, stars=night/space, meadow=nature, board=chalkboard, else clean",
    },
    {
      key: "items", label: "Items", type: "json",
      defaultValue: DEFAULT_ITEMS, jsonShape: '[{"emoji":"🍎","bin":"Fruit"}, ...]',
      description: "The items shown on the canvas. 'bin' names a target bin and is required for dragmatch mode, ignored otherwise.",
      promptHint: "3-8 items; include \"bin\" per item only in dragmatch mode",
    },
    {
      key: "bins", label: "Sort Bins", type: "json",
      defaultValue: [], jsonShape: '["Fruit Basket","Veggie Bin"]',
      description: "Bin labels for dragmatch mode. Every item's \"bin\" value must match one of these exactly. Ignored for other modes.",
      promptHint: "2-3 bin labels, only for dragmatch; must match items[].bin exactly",
    },
    {
      key: "flexibleCorrectAnswer", label: "Correct Answer", type: "string", defaultValue: "",
      description: "The correct answer text, for multichoice/textinput modes. If omitted, defaults to the item count.",
      promptHint: "only for multichoice/textinput; omit to default to the item count",
    },
    {
      key: "flexibleOptions", label: "Answer Options", type: "json",
      defaultValue: [], jsonShape: '["3","4","5","6"]',
      description: "3-4 answer choices for multichoice mode, must include the correct answer.",
      promptHint: "only for multichoice; 3-4 choices including the correct answer",
    },
  ],

  assets: [],

  triggerKeywords: [
    "sort", "sorting", "bin", "bins", "classify", "multiple choice",
    "type the answer", "type in", "tap to count",
    "which bin", "pick the correct", "sorting detective",
  ],

  exampleOutput: {
    id: "q-ai-sort-fruit",
    technique: "FLEXIBLE_CANVAS",
    title: "Sort the Fruit",
    instruction: "Drag each item into the bin it belongs in!",
    objectId: "apple",
    targetCount: 5,
    config: {
      flexibleMode: "dragmatch",
      flexibleBgStyle: "clean",
      items: [{ emoji: "🍎", bin: "Fruit" }, { emoji: "🥕", bin: "Veggies" }],
      bins: ["Fruit", "Veggies"]
    }
  },

  presets: PRESETS,

  tip: "Say the mode explicitly if you want to control it: 'sort', 'multiple choice', 'type the answer', or 'tap to count'.",

  validate(raw: any, index: number): ParsedSlideConfig {
    const mode: FlexibleMode = MODES.includes(raw.config?.flexibleMode) ? raw.config.flexibleMode : "multichoice";
    const bgStyle = BG_STYLES.includes(raw.config?.flexibleBgStyle) ? raw.config.flexibleBgStyle : "clean";

    const rawItems: any[] = Array.isArray(raw.config?.items) && raw.config.items.length > 0
      ? raw.config.items.slice(0, 8)
      : DEFAULT_ITEMS;
    const itemEmojis = rawItems.map(it => (typeof it?.emoji === "string" && it.emoji.trim()) || "🍎");

    const config: Record<string, any> = { flexibleMode: mode, flexibleBgStyle: bgStyle };

    if (mode === "dragmatch") {
      const binLabels: string[] = Array.isArray(raw.config?.bins) && raw.config.bins.length > 0
        ? raw.config.bins.slice(0, 4).map((b: any) => String(b))
        : ["Bin A", "Bin B"];

      // Bin layout: evenly spaced along the bottom of the design stage.
      const bins = binLabels.map((label, i) => {
        const gap = (STAGE_W - binLabels.length * BIN_W) / (binLabels.length + 1);
        return {
          id: `bin-${i}`,
          label,
          x: Math.round(gap + i * (BIN_W + gap)),
          y: STAGE_H - BIN_H - 16,
          width: BIN_W,
          height: BIN_H
        };
      });

      // Items: grid above the bins. targetBin resolved by matching the AI's
      // free-text bin name to the closest bin label, defaulting to the first
      // bin — never left dangling on an id that doesn't exist.
      const cols = Math.min(5, itemEmojis.length);
      const items = itemEmojis.map((emoji, i) => {
        const requestedBin = String(rawItems[i]?.bin || "").toLowerCase();
        const matchedBin = bins.find(b => b.label.toLowerCase() === requestedBin) || bins[i % bins.length];
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          id: `item-${i}`,
          emoji,
          x: 20 + col * (ITEM_SIZE + 20),
          y: 20 + row * (ITEM_SIZE + 20),
          targetBin: matchedBin.id
        };
      });

      config.flexibleItems = items;
      config.flexibleTargets = bins;
    } else if (mode === "tapcount") {
      const cols = Math.min(5, itemEmojis.length);
      config.flexibleItems = itemEmojis.map((emoji, i) => ({
        id: `item-${i}`,
        emoji,
        x: 20 + (i % cols) * (ITEM_SIZE + 20),
        y: 20 + Math.floor(i / cols) * (ITEM_SIZE + 20)
      }));
    } else {
      // multichoice / textinput: no items on the canvas, just the question.
      const answer = String(raw.config?.flexibleCorrectAnswer || itemEmojis.length);
      config.flexibleCorrectAnswer = answer;
      if (mode === "multichoice") {
        const opts = Array.isArray(raw.config?.flexibleOptions) ? raw.config.flexibleOptions.map(String) : [];
        const withAnswer = opts.includes(answer) ? opts : [...opts, answer];
        config.flexibleOptions = Array.from(new Set(withAnswer)).slice(0, 4);
        if (config.flexibleOptions.length < 2) {
          const n = parseInt(answer, 10) || itemEmojis.length;
          config.flexibleOptions = [n - 1, n, n + 1, n + 2].map(String);
        }
      }
    }

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.FLEXIBLE_CANVAS,
      title: String(raw.title || `Sorting Detective ${index + 1}`),
      instruction: String(raw.instruction || "Complete the activity!"),
      objectId: "apple",
      targetCount: itemEmojis.length || 1,
      config
    };
  }
};
