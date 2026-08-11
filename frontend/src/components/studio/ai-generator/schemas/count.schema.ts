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
import { COUNT_STAGING_IDS } from "../../../canvases/countStaging/types";
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
/*
  The list comes from the staging contract, not a copy of it. When Group in Tens,
  Count On, Count Back and Arrangements were absorbed into Count, this array was
  left at the original four — and `resolveStaging` silently rewrote every one of
  them to "move", so an authored or generated slide lost the very thing that made
  it that activity.
*/
const STAGINGS = COUNT_STAGING_IDS;
type Staging = (typeof STAGINGS)[number];

const resolveStaging = (value: unknown): Staging =>
  STAGINGS.includes(value as Staging) ? (value as Staging) : "move";

/** Zone labels only mean something where that staging has that zone. */
const DEFAULT_LABELS: Record<Staging, { source: string; destination: string }> = {
  move: { source: "Uncounted", destination: "Counted" },
  tap: { source: "", destination: "" },
  lineup: { source: "Tray", destination: "Line-up" },
  container: { source: "Shelf", destination: "Collecting Jar" },
  // The arena is named for its arrangement, so a blank source keeps that name.
  arrangements: { source: "", destination: "" },
  tens: { source: "Ones", destination: "Tens" },
  counton: { source: "More", destination: "Already counted" },
  // Count Back and Skip Count label their own bands; neither has a second bin.
  countback: { source: "", destination: "" },
  skipcount: { source: "", destination: "" },
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
  { id: "count-beads-tens", label: "Make a Ten", prompt: "Group 13 beads into ten-frames to make a ten and three ones", emoji: "🔵", technique: CountingTechnique.MOVE_AND_COUNT, theme: "classroom" },
  { id: "count-on-cupcakes", label: "Count On From Five", prompt: "Five cupcakes are already counted — add 3 more and count on from five", emoji: "🧁", technique: CountingTechnique.MOVE_AND_COUNT, theme: "bakery" },
  { id: "count-back-balloons", label: "Count Back", prompt: "Eight balloons — pop 3 of them counting backwards, then say how many are left", emoji: "🎈", technique: CountingTechnique.MOVE_AND_COUNT, theme: "party" },
  { id: "count-skip-socks", label: "Count by Twos", prompt: "Count 12 socks in pairs — say 2, 4, 6, 8, 10, 12", emoji: "🧦", technique: CountingTechnique.MOVE_AND_COUNT, theme: "home" },
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
- "arrangements": objects in a named shape (ring, wave, pairs...); the child taps each once and learns the shape does not change the count.
- "tens": drag ones into ten-frames; a full frame is a ten, so position carries place value.
- "counton": "baseCount" are already counted; the child adds "extraCount" more, counting on rather than restarting at one.
- "countback": "totalCount" objects, of which the child crosses out "removeCount" from the end; the answer is what is left.
- "skipcount": objects come in bundles of "skipStep"; each act counts a whole bundle, so the child says 5, 10, 15.
Every staging shares the same sizing, motion, badges, sounds, CPA switch, keyboard path and answer panel.
Counting in tens has a second form: pick the "tenrod" asset and each object is a base-ten rod worth ten, so "skipcount" with totalCount 60 puts six rods on the board and the answer is 60. Only "skipcount" should go above 20 — every other staging is one object per act, and forty things to tap is not a counting lesson.`,

  promptSummary:
    "Child counts N themed objects. `staging` picks the physical act: move between bins, tap in place, line up into numbered slots, or drop into one container.",

  /*
    Twenty is the ceiling for counting one thing at a time — two full ten-frames,
    where the ladder's tens work ends. Skip counting is not that: a board of six
    base-ten rods is six acts and the answer is sixty, so the honest limit there
    is a hundred. One field serves both, so the range is the wider one and the
    description says which staging may use it.
  */
  topLevelFields: { targetCount: { min: 1, max: 100, default: 5 } },

  configFields: [
    {
      key: "staging",
      label: "Counting Action",
      type: "enum",
      enumValues: [...STAGINGS],
      defaultValue: "move",
      description:
        "What counting physically is on this slide. See the technique description for what each one does.",
      promptHint:
        "move=two bins, tap=touch in place, lineup=numbered slots, container=one jar, arrangements=named shape, tens=ten-frames, counton=start from a group, countback=cross out from the end, skipcount=bundles",
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
      enumValues: ["grid", "line", "ring", "scatter", "wave", "pairs", "columns", "circle", "dice"],
      defaultValue: "grid",
      description: "How loose objects are arranged. Used by the 'tap' and 'arrangements' stagings — visual only, and it never changes the answer.",
      promptHint: "tap/arrangements only: ring for stars, line for a row, scatter for a pond",
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
    {
      key: "baseCount",
      label: "Start With",
      type: "number",
      defaultValue: 5,
      description: "'counton' only: how many are already counted before the child adds more.",
      promptHint: "counton only: the group already in the box",
    },
    {
      key: "extraCount",
      label: "Count On",
      type: "number",
      defaultValue: 3,
      description: "'counton' only: how many more the child adds, counting on from baseCount.",
      promptHint: "counton only: how many more to add",
    },
    {
      key: "totalCount",
      label: "Set Size",
      type: "number",
      defaultValue: 8,
      description: "'countback' and 'skipcount': how many objects the board holds in total.",
      promptHint: "countback/skipcount only: the whole set",
    },
    {
      key: "removeCount",
      label: "Cross Out",
      type: "number",
      defaultValue: 3,
      description: "'countback' only: how many are crossed out from the end. The answer is what is left.",
      promptHint: "countback only: how many come off",
    },
    {
      key: "skipStep",
      label: "Bundle Size",
      type: "number",
      defaultValue: 5,
      description:
        "'skipcount' only: how many objects a bundle holds, so the child counts 5, 10, 15. Ignored when the asset is itself a group — a 'tenrod' is ten whatever this says.",
      promptHint: "skipcount only: 2, 5 or 10",
    },
    {
      key: "mascotStyles",
      label: "Cast By Moment",
      type: "json",
      defaultValue: {},
      description:
        "Which character plays each moment of the question, keyed by role: talking, waiting, oops, celebrating. Each value is a Mascot Studio style name or a built-in preset id. Chosen by the author; a role left out finds its own character.",
      exposeToAI: false,
    },
    {
      key: "mascotStyle",
      label: "Actor (legacy)",
      type: "string",
      defaultValue: "",
      description:
        "One character for every moment, from before the cast was per-moment. Still honoured wherever `mascotStyles` leaves a role out, but no longer authored — the panel only offers to clear it.",
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
    "arrangement", "rearrange", "same number", "different shape",
    "group in tens", "ten frame", "make a ten", "bundle",
    "count on", "count on from", "one more", "add more to",
    "count back", "count down", "take away", "cross out", "how many left",
    "skip count", "count by twos", "count by fives", "count by tens", "in twos", "in fives",
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
