/**
 * Move and Count — Component Schema
 *
 * This is the single source of truth for what the AI knows about
 * the Move and Count canvas. When you add a new asset, config field,
 * or change a constraint, update THIS file and the AI automatically adapts.
 */

import { CountingTechnique, SVG_OBJECTS, EMOJI_OBJECTS } from "../../../../types";
import { ComponentSchema, SchemaAsset } from "./types";
import { ParsedSlideConfig } from "../types";
import { MOVE_AND_COUNT_PRESETS } from "../presets";
import { parsePromptToSlide, generateMultipleSlides } from "../promptParser";

// ── Auto-derive assets from the actual source code ──────────────────────────

const VECTOR_ASSETS: SchemaAsset[] = SVG_OBJECTS.map(obj => ({
  id: obj.id,
  emoji: obj.emoji,
  label: obj.label,
  renderType: "vector" as const,
}));

const EMOJI_ASSETS: SchemaAsset[] = EMOJI_OBJECTS.map(obj => ({
  id: obj.id,
  emoji: obj.emoji,
  label: obj.label,
  renderType: "emoji" as const,
}));

const ALL_ASSETS = [...VECTOR_ASSETS, ...EMOJI_ASSETS];
const VALID_ASSET_IDS = ALL_ASSETS.map(a => a.id);
const VALID_COLORS = ["indigo", "emerald", "purple", "pink", "rose"];

// ── Schema Definition ───────────────────────────────────────────────────────

export const moveAndCountSchema: ComponentSchema = {
  technique: CountingTechnique.MOVE_AND_COUNT,
  name: "Move and Count",

  description: `Students drag items one-by-one from a left-side source container to a right-side destination container.
Each successful drop snaps the item into a grid slot, plays a rising musical tone, and stamps a sequential number badge (1, 2, 3...) on the item.
When all items are moved, a celebration animation plays.
The canvas has two labeled zones: the Source Bin (left) and Destination Bin (right).`,

  promptSummary: "Child drags N themed items from a source container into a destination container, counting each drop.",

  topLevelFields: {
    targetCount: { min: 1, max: 10, default: 5 }
  },

  configFields: [
    {
      key: "assetType",
      label: "Asset Type",
      type: "enum",
      enumValues: [...VALID_ASSET_IDS],
      defaultValue: "apple",
      description: "The visual asset to render. Derived automatically from objectId by validate().",
      exposeToAI: false,
    },
    {
      key: "frameColor",
      label: "Frame Color Theme",
      type: "enum",
      enumValues: VALID_COLORS,
      defaultValue: "indigo",
      description: "Canvas accent color theme. Use 'emerald' for nature themes, 'purple' for space, 'pink' for cute/girly, 'rose' for love/hearts.",
      promptHint: "match theme (emerald=nature, purple=space, rose=love)",
    },
    {
      key: "sourceBinLabel",
      label: "Source Bin Label",
      type: "string",
      defaultValue: "Uncounted",
      description: "Label for the left container where items start. Should match the theme (e.g. 'Fish Bowl', 'Toy Shelf', 'Hangar').",
      promptHint: "themed start container, e.g. 'Fish Bowl'",
    },
    {
      key: "destinationBinLabel",
      label: "Destination Bin Label",
      type: "string",
      defaultValue: "Counted",
      description: "Label for the right container where items are dragged to. Should match the theme (e.g. 'Aquarium', 'Forest', 'Launch Pad').",
      promptHint: "themed destination, e.g. 'Aquarium'",
    },
    {
      key: "defaultRepresentation",
      label: "CPA Representation",
      type: "enum",
      enumValues: ["concrete", "pictorial", "abstract"],
      defaultValue: "concrete",
      description: "Pedagogical mode: 'concrete' shows framed cards, 'pictorial' shows flat images, 'abstract' shows numbers only.",
      exposeToAI: false,
    },
    {
      key: "showItemFrame",
      label: "Show Item Frame",
      type: "boolean",
      defaultValue: true,
      description: "Whether to show a white circle frame behind each draggable item.",
      exposeToAI: false,
    },
    {
      key: "requireAnswerInput",
      label: "Answer Input Box",
      type: "boolean",
      defaultValue: true,
      description: "Require typing/selecting answer after moving all items.",
      exposeToAI: false,
    },
    {
      key: "showLayoutRulers",
      label: "Show Layout Rulers",
      type: "boolean",
      defaultValue: true,
      description: "Whether to show pixel rulers on the grid in design mode.",
      exposeToAI: false,
    },
  ],

  assets: ALL_ASSETS,

  triggerKeywords: [
    "move", "drag", "put", "place", "park", "pick", "guide",
    "help", "arrange", "walk", "transfer", "carry", "bring",
    "take", "slide", "push", "pull", "send", "deliver",
    "move and count", "count and move",
  ],

  exampleOutput: {
    id: "q-ai-fish-aquarium",
    technique: "MOVE_AND_COUNT",
    title: "Count the Goldfish",
    instruction: "Move the 5 goldfish from the fish bowl into the big aquarium: 1, 2, 3, 4, 5!",
    objectId: "fish",
    targetCount: 5,
    config: {
      assetType: "fish",
      frameColor: "emerald",
      sourceBinLabel: "Fish Bowl",
      destinationBinLabel: "Aquarium",
      defaultRepresentation: "concrete",
      showItemFrame: true,
      showLayoutRulers: true,
    }
  },

  presets: MOVE_AND_COUNT_PRESETS,

  offlineFallback: (prompt, count) =>
    count > 1 ? generateMultipleSlides(prompt, count) : [parsePromptToSlide(prompt)],

  tip: "Mention an animal, object, count, and destination. Try: \"Move 6 butterflies from the meadow into the flower garden\"",

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const targetCount = Math.min(
      this.topLevelFields.targetCount.max,
      Math.max(this.topLevelFields.targetCount.min, parseInt(raw.targetCount) || this.topLevelFields.targetCount.default)
    );
    const frameColor = VALID_COLORS.includes(raw.config?.frameColor)
      ? raw.config.frameColor : "indigo";

    // Auto-resolve assetType: if objectId is a vector asset, use it; otherwise "emoji"
    const isVectorAsset = VECTOR_ASSETS.some(a => a.id === objectId);
    const assetType = raw.config?.assetType || (isVectorAsset ? objectId : "emoji");

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.MOVE_AND_COUNT,
      title: String(raw.title || `Counting Activity ${index + 1}`),
      instruction: String(raw.instruction || `Move and count ${targetCount} items!`),
      objectId,
      targetCount,
      config: {
        assetType,
        frameColor,
        sourceBinLabel: String(raw.config?.sourceBinLabel || "Uncounted"),
        destinationBinLabel: String(raw.config?.destinationBinLabel || "Counted"),
        defaultRepresentation: raw.config?.defaultRepresentation || "concrete",
        showItemFrame: raw.config?.showItemFrame ?? true,
        showLayoutRulers: raw.config?.showLayoutRulers ?? true,
      }
    };
  }
};
