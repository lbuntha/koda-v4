/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Count — one schema for the whole counting family.
 *
 * Replaces four schemas (`moveAndCount`, `oneToOne`, `lineUp`, `magnets`) that
 * described the same activity four times and differed in one field: what
 * counting physically is. That field is now `staging`, and it is the only thing
 * the AI picks between them.
 *
 * The technique stays `MOVE_AND_COUNT` deliberately. 160 published questions
 * carry that id, the backend grader already accepts it, and a new id would need
 * a grader before anything authored on it could be published. What changes is
 * that a new slide says which staging it wants; an old one still resolves
 * through `STAGING_BY_TECHNIQUE` in `countStaging/index.ts`.
 */

import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig, AiPreset } from "../types";
import {
  ALL_ASSETS,
  VALID_ASSET_IDS,
  resolveAssetType,
  resolveFrameColor,
  clampInt,
  assetTypeField,
  frameColorField,
  hiddenToggleField,
} from "./assets";
import { CONTAINER_SHAPES } from "../../../canvases/ContainerArt";
import { parsePromptToSlide, generateMultipleSlides } from "../promptParser";

/**
 * Kept in sync with `CountStagingId` by construction: the canvas refuses an
 * unknown id and falls back to `move`, so an invalid value here degrades rather
 * than breaks. `tens` is absent because its staging is not folded in yet.
 */
const STAGINGS = ["move", "tap", "lineup", "container"] as const;
type Staging = (typeof STAGINGS)[number];

const resolveStaging = (value: unknown): Staging =>
  STAGINGS.includes(value as Staging) ? (value as Staging) : "move";

/** Zone labels only mean something where that staging has that zone. */
const DEFAULT_LABELS: Record<Staging, { source: string; destination: string }> = {
  move: { source: "Uncounted", destination: "Counted" },
  tap: { source: "", destination: "" },
  lineup: { source: "Tray", destination: "Line-up" },
  container: { source: "Shelf", destination: "Collecting Jar" },
};

const PRESETS: AiPreset[] = [
  { id: "count-fish-aquarium", label: "Fish into Aquarium", prompt: "Move 5 goldfish from the fish bowl into the big aquarium", emoji: "🐠", technique: CountingTechnique.MOVE_AND_COUNT, theme: "ocean" },
  { id: "count-butterflies-garden", label: "Butterflies to Garden", prompt: "Move 6 butterflies from the meadow into the flower garden", emoji: "🦋", technique: CountingTechnique.MOVE_AND_COUNT, theme: "nature" },
  { id: "count-apples-line", label: "Tap the Apples", prompt: "Tap and count 6 apples lined up in a row", emoji: "🍎", technique: CountingTechnique.MOVE_AND_COUNT, theme: "kitchen" },
  { id: "count-stars-circle", label: "Stars in a Circle", prompt: "Tap to count 8 stars arranged in a circle", emoji: "⭐", technique: CountingTechnique.MOVE_AND_COUNT, theme: "space" },
  { id: "count-ducks-scatter", label: "Scattered Ducks", prompt: "Tap to count 5 ducks scattered around the pond", emoji: "🦆", technique: CountingTechnique.MOVE_AND_COUNT, theme: "nature" },
  { id: "count-cars-race", label: "Race Car Lineup", prompt: "Line up 6 race cars at the starting line in order, numbered 1 to 6", emoji: "🚗", technique: CountingTechnique.MOVE_AND_COUNT, theme: "race" },
  { id: "count-cookies-tray", label: "Cookie Tray", prompt: "Arrange 8 cookies in numbered order on a baking tray", emoji: "🍪", technique: CountingTechnique.MOVE_AND_COUNT, theme: "bakery" },
  { id: "count-bugs-jar", label: "Bugs in a Jar", prompt: "Drag 6 bugs into the collecting jar", emoji: "🐞", technique: CountingTechnique.MOVE_AND_COUNT, theme: "nature" },
  { id: "count-fruit-basket", label: "Fruit into Basket", prompt: "Drag 5 pieces of fruit into the basket", emoji: "🍎", technique: CountingTechnique.MOVE_AND_COUNT, theme: "kitchen" },
  { id: "count-toys-box", label: "Toys into the Box", prompt: "Drag 7 toys into the toy box", emoji: "🧸", technique: CountingTechnique.MOVE_AND_COUNT, theme: "playroom" },
];

export const countSchema: ComponentSchema = {
  technique: CountingTechnique.MOVE_AND_COUNT,
  name: "Count",

  description: `Students count "targetCount" themed objects. How they count is set by "staging":
 - "move": drag each object from a source container into a destination container. Each drop stamps a sequential badge (1, 2, 3...).
 - "tap": objects lie loose on the stage in a chosen arrangement; the child taps each exactly once, in any order.
 - "lineup": drag each object from an unordered tray into numbered slots 1..N, in order.
 - "container": drag each object into a single kawaii-faced vessel (jar, basket or toy box) — free placement, no order.
Every staging shares the same sizing, motion, badges, sounds, CPA switch, keyboard path and answer panel.`,

  promptSummary:
    "Child counts N themed objects. `staging` picks the physical act: move between bins, tap in place, line up into numbered slots, or drop into one container.",

  topLevelFields: { targetCount: { min: 1, max: 12, default: 5 } },

  configFields: [
    {
      key: "staging",
      label: "Counting Action",
      type: "enum",
      enumValues: [...STAGINGS],
      defaultValue: "move",
      description:
        "What counting physically is on this slide. 'move' = drag between two containers; 'tap' = tap objects where they lie; 'lineup' = drag into numbered slots in order; 'container' = drop into one jar/basket/box.",
      promptHint:
        "move=two bins, tap=touch in place, lineup=numbered slots in order, container=one jar/basket/box",
    },
    frameColorField("indigo"),
    {
      key: "sourceBinLabel",
      label: "Source Container Label",
      type: "string",
      defaultValue: "Uncounted",
      description: "Label for where objects start. Ignored by the 'tap' staging, which has no containers.",
      promptHint: "themed start container, e.g. 'Fish Bowl' — omit for tap",
    },
    {
      key: "destinationBinLabel",
      label: "Destination Container Label",
      type: "string",
      defaultValue: "Counted",
      description: "Label for where counted objects end up. Ignored by the 'tap' staging.",
      promptHint: "themed destination, e.g. 'Aquarium' — omit for tap",
    },
    {
      key: "pattern",
      label: "Arrangement",
      type: "enum",
      enumValues: ["grid", "line", "ring", "scatter", "wave", "pairs"],
      defaultValue: "grid",
      description: "How loose objects are arranged. Only the 'tap' staging uses it — purely visual, never changes the answer.",
      promptHint: "tap only: ring for stars, line for a row, scatter for a pond",
    },
    {
      key: "containerShape",
      label: "Container Shape",
      type: "enum",
      enumValues: [...CONTAINER_SHAPES],
      defaultValue: "jar",
      description: "Which vessel the 'container' staging draws. Ignored by every other staging.",
      promptHint: "container only: basket for fruit, box for toys, jar otherwise",
    },
    assetTypeField("apple"),
    {
      key: "defaultRepresentation",
      label: "CPA Representation",
      type: "enum",
      enumValues: ["concrete", "pictorial", "abstract"],
      defaultValue: "concrete",
      description: "Pedagogical mode: 'concrete' shows framed cards, 'pictorial' flat images, 'abstract' numbers only.",
      exposeToAI: false,
    },
    hiddenToggleField("showItemFrame", "Show Item Frame", true, "White circle frame behind each object."),
    hiddenToggleField("showNumbersOnTap", "Show Count Bubble", true, "Number bubble on each counted object."),
    hiddenToggleField("showNumbersInSlots", "Show Slot Numbers", true, "Slot numbers for the lineup staging."),
    hiddenToggleField("requireAnswerInput", "Answer Input Box", true, "Require an answer once every object is counted."),
  ],

  assets: ALL_ASSETS,

  /**
   * The union of the four retired keyword sets. They no longer compete with one
   * another for routing — a prompt that once had to pick between four schemas
   * now lands here and only has to pick a `staging`.
   */
  triggerKeywords: [
    "count", "counting", "how many",
    "move", "drag", "put", "place", "transfer", "carry", "bring", "deliver",
    "tap", "touch", "point to", "one-to-one", "one to one",
    "line up", "lineup", "in order", "numbered slots", "put in order", "starting line", "sequence",
    "into the jar", "into the basket", "into the box", "collect", "gather",
  ],

  exampleOutput: {
    id: "q-ai-fish-aquarium",
    technique: "MOVE_AND_COUNT",
    title: "Count the Goldfish",
    instruction: "Move the 5 goldfish from the fish bowl into the big aquarium: 1, 2, 3, 4, 5!",
    objectId: "fish",
    targetCount: 5,
    config: {
      staging: "move",
      assetType: "fish",
      frameColor: "emerald",
      sourceBinLabel: "Fish Bowl",
      destinationBinLabel: "Aquarium",
    },
  },

  presets: PRESETS,

  offlineFallback: (prompt, count) =>
    count > 1 ? generateMultipleSlides(prompt, count) : [parsePromptToSlide(prompt)],

  tip: 'Say what the child does and it picks the action for you. Try: "Move 6 butterflies into the flower garden", "Tap and count 8 stars in a circle", "Line up 5 ducklings in order", or "Drag 7 gems into the treasure chest".',

  validate(raw: any, index: number): ParsedSlideConfig {
    const objectId = VALID_ASSET_IDS.includes(raw.objectId) ? raw.objectId : "apple";
    const { min, max, default: def } = this.topLevelFields.targetCount;
    const targetCount = clampInt(raw.targetCount, min, max, def);
    const staging = resolveStaging(raw.config?.staging);
    const labels = DEFAULT_LABELS[staging];

    const containerShape = CONTAINER_SHAPES.includes(raw.config?.containerShape)
      ? raw.config.containerShape
      : "jar";

    return {
      id: raw.id || `q-ai-${Date.now()}-${index}`,
      technique: CountingTechnique.MOVE_AND_COUNT,
      title: String(raw.title || `Counting Activity ${index + 1}`),
      instruction: String(raw.instruction || `Count all ${targetCount} of them!`),
      objectId,
      targetCount,
      config: {
        staging,
        assetType: resolveAssetType(objectId),
        frameColor: resolveFrameColor(raw.config?.frameColor),
        sourceBinLabel: String(raw.config?.sourceBinLabel || labels.source),
        destinationBinLabel: String(raw.config?.destinationBinLabel || labels.destination),
        pattern: String(raw.config?.pattern || "grid"),
        containerShape,
        defaultRepresentation: raw.config?.defaultRepresentation || "concrete",
        showItemFrame: raw.config?.showItemFrame ?? true,
        showNumbersOnTap: raw.config?.showNumbersOnTap ?? true,
        showNumbersInSlots: raw.config?.showNumbersInSlots ?? true,
        requireAnswerInput: raw.config?.requireAnswerInput ?? true,
      },
    };
  },
};
