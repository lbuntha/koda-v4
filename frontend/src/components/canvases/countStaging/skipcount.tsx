/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Skip Count" — bundles of the same size, counted a bundle at a time.
 *
 * Six pairs of socks is twelve socks, and a child who has to say "one, two,
 * three…" to know that has not learned the thing this teaches. Here one act
 * counts a whole bundle, so the numbers said out loud are 2, 4, 6, 8, 10, 12.
 *
 * That makes it the only staging where an *object* is not a thing. It is a
 * group, and two consequences follow — both of which are the point rather than
 * an inconvenience:
 *
 *   - `ItemArt` draws the bundle as `skipStep` real objects, laid out so their
 *     quantity is visible. A bundle drawn as one apple wearing a "10" teaches
 *     multiplying by ten; the ten has to be on the screen for the child to
 *     count it once and then trust it.
 *   - `badgeFor` badges the running total, not the ordinal. Over the third
 *     bundle a child says "fifteen", and a badge reading "3" would be arguing
 *     with them.
 *
 * Everything physical is the engine's, and the arrangement is the shared
 * `slotPosition` grid — a bundle is just an object as far as dragging, tapping
 * and the answer panel are concerned.
 */

import React from "react";
import { bestGrid, contentZone, slotPosition, type Rect } from "../objectLayout";
import type { Point } from "../oneToOneLayout";
import { accentChipClass, emptySlotClass } from "../canvasTheme";
import { assetGroup } from "../../../assets/assetGroups";
import { boardTotals, skipStepOf } from "./boardTotals";
import {
  allCounted,
  type CountStaging,
  type LayoutInput,
  type LayoutResult,
  type StagingConfig,
  type StagingLabelContext,
  type ZoneContentProps
} from "./types";

export const BUNDLES: string = "bundles";
export const TRACK: string = "track";

const stepOf = (config: StagingConfig) => {
  const step = skipStepOf(config);
  return Number.isFinite(step) && step > 1 ? Math.floor(step) : 5;
};

/**
 * What the answer is counted in.
 *
 * Six pairs of socks are counted in socks, and `objectLabel` — the slide's own
 * word for its artwork — is already that. A board of base-ten rods is not: the
 * artwork is called a ten rod and the answer is sixty *blocks*, so asking "how
 * many ten rods altogether?" and expecting 60 is the canvas arguing with itself.
 * A grouped asset therefore names its own unit, and everything that speaks here
 * asks for it rather than for the object.
 */
const unitOf = (ctx: StagingLabelContext) => assetGroup(ctx.config.assetType)?.unit ?? ctx.objectLabel;
const unitsOf = (ctx: StagingLabelContext) => `${unitOf(ctx)}s`;

/**
 * How many groups there are, in the words this board's groups go by.
 *
 * "4 groups of 10" and "4 tens" are the same fact, and only one of them is the
 * sentence a child is being taught to say. Artwork that is already a group knows
 * what it is called; everything else is loose things someone bundled, and there
 * "groups of" is exactly right.
 */
const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** Agrees with `groupsPhrase` — "one ten makes 10", "four tens make 40". */
const makes = (ctx: { count: number }) => (ctx.count === 1 ? "makes" : "make");

const groupsPhrase = (ctx: StagingLabelContext & { count: number }) => {
  const group = assetGroup(ctx.config.assetType);
  if (!group) return `${ctx.count} groups of ${stepOf(ctx.config)}`;
  return `${ctx.count} ${group.groupName}${ctx.count === 1 ? "" : "s"}`;
};

/** How the objects inside one bundle are stacked: near-square, wider than tall. */
const bundleGrid = (step: number) => {
  const columns = step <= 3 ? step : Math.ceil(Math.sqrt(step * 1.6));
  return { columns, rows: Math.ceil(step / columns) };
};

/**
 * One bundle, drawn as the objects it actually contains.
 *
 * Sized from the bundle's own box so the group reads as a group at any board
 * size — the same rule the base-ten blocks follow, where quantity is size and
 * a rod is really ten units wide.
 */
const Bundle: CountStaging["ItemArt"] = ({ size, Art, config }) => {
  /*
    Artwork that is already a group is drawn once, whole.

    Ten of a base-ten rod is a hundred, so the rule below — "draw the bundle as
    the objects it contains" — would draw exactly the wrong number and undo the
    reason a rod exists. The quantity is still on the screen; it is on the rod,
    in its ten divisions, which is where a child counts it.
  */
  if (assetGroup(config.assetType)) {
    return (
      <div className="flex items-center justify-center" style={{ width: `${size}px`, height: `${size}px` }}>
        <Art size={Math.round(size * 0.96)} />
      </div>
    );
  }

  const step = stepOf(config);
  const { columns, rows } = bundleGrid(step);
  const gap = Math.max(2, Math.round(size * 0.04));
  /*
    Fill the bundle's box rather than sitting politely inside it. The objects are
    what a child counts — five of them at 34px each is texture, not a group of
    five — so they take the room the box has, less a hairline of air.
  */
  const cell = Math.floor((size * 0.94 - gap * (columns - 1)) / columns);
  const unit = Math.max(10, Math.min(cell, Math.floor((size * 0.94 - gap * (rows - 1)) / rows)));

  return (
    <div
      className="flex flex-wrap items-center justify-center content-center"
      style={{ width: `${size * 0.96}px`, height: `${size * 0.96}px`, gap: `${gap}px` }}
    >
      {Array.from({ length: step }, (_, index) => (
        <Art key={index} size={unit} />
      ))}
    </div>
  );
};

/**
 * The sequence being said out loud: 5, 10, 15, 20.
 *
 * Drawn in full from the start, so the child can see where the count is going —
 * which is what makes the next number predictable rather than recalculated.
 */
const SkipTrack: React.FC<ZoneContentProps> = ({ count, done, config, isDark }) => {
  const step = stepOf(config);
  const accent = (config.frameColor as string) || "indigo";
  return (
    <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1.5 overflow-hidden px-2">
      {Array.from({ length: count }, (_, index) => {
        const reached = index < done;
        return (
          <div
            key={index}
            className={`h-[26px] min-w-[30px] px-1.5 sm:h-[30px] sm:min-w-[36px] rounded-lg border-2
              flex items-center justify-center font-mono text-xs sm:text-sm font-bold
              transition-all duration-300 ${
                reached
                  ? `${accentChipClass(accent, isDark)} animate-drop-pop`
                  : `border-dashed ${emptySlotClass(isDark)}`
              }`}
          >
            {(index + 1) * step}
          </div>
        );
      })}
    </div>
  );
};

export const skipCountStaging: CountStaging = {
  id: "skipcount",
  // A bundle is counted where it lies; nothing travels.
  movesOnCount: false,
  orientation: "column",

  /** The board holds bundles, not ones — `totalCount / skipStep` of them. */
  objectCount: (config, targetCount) => boardTotals(config, targetCount).objects,

  /** Every bundle counted, and the answer is what they come to. */
  expectedAnswer: (config, count) => boardTotals(config, count).expected,

  /** Over the third bundle of five a child says "fifteen". */
  badgeFor: (order, config) => String(order * stepOf(config)),

  ItemArt: Bundle,

  zones: config => [
    {
      id: BUNDLES,
      // "Bundles of 10" describes something someone gathered up. A rod is a ten.
      label: assetGroup(config.assetType)
        ? `${titleCase(assetGroup(config.assetType)!.groupName)}s`
        : `Bundles of ${stepOf(config)}`,
      learnerLabel: assetGroup(config.assetType)
        ? `Count in ${assetGroup(config.assetType)!.groupName}s`
        : `Count in ${stepOf(config)}s`,
      role: "home"
      // Nothing leaves this bin, so it never empties.
    },
    {
      id: TRACK,
      label: "Counting by",
      learnerLabel: "Say it out loud",
      role: "readout",
      flex: "0 0 4.5rem",
      Content: SkipTrack
    }
  ],

  layout({ count, stage, zones, config }: LayoutInput): LayoutResult {
    const binRect = zones[BUNDLES];

    /*
      A bundle is not an object, and sizing it like one is what made the objects
      inside it specks.

      `fitObjectSize` fits `count` *things* into the bin and clamps to
      `OBJECT_SIZE.max`, which is the right size for one apple. Two bundles of
      five were therefore capped at 136px each — five boba crammed into a third
      of that — while most of a 1700px-wide bin sat empty.

      So the unit is what gets fitted, and the bundle is however big the units it
      holds make it. `bestGrid` arranges the bundles; each bundle is a small grid
      of its own; multiply the two and the whole board is one grid of unit cells,
      which is the thing the available room actually has to divide by.
    */
    const width = binRect?.width ?? stage.width;
    const height = binRect?.height ?? stage.height * 0.7;
    const { columns: bundleCols, rows: bundleRows } = bestGrid(count, width, height);

    /*
      The box is sized from the grid of bundles, so it fits both ways by
      construction.

      Deriving it from the unit instead — `unit * max(cols, rows)` — squared the
      box up to the bundle's *widest* side. A bundle of five is three units
      across and two down, so that spent a third more height than it needed, and
      on a phone, where the bundles stack, two of them overflowed the bin and sat
      on top of its caption. Whatever the units come to, the bundles have to fit
      the room first.
    */
    const size = Math.round(
      Math.max(56, Math.min(300, Math.min(width / (bundleCols * 1.12), height / (bundleRows * 1.12))))
    );

    const area: Rect | null = binRect ? contentZone(binRect, size) : null;
    const positions: Record<string, Point> = {};
    if (area) {
      for (let index = 0; index < count; index += 1) {
        positions[`count-item-${index}`] = slotPosition(index + 1, count, area, size);
      }
    }

    return { size, positions };
  },

  /*
    Any bundle, in any order — the sequence a child says is fixed, but which
    bundle they say it over is not, and the running total is assigned by arrival
    so the numbers still come out 5, 10, 15.
  */
  resolve({ item, tapped }) {
    if (!tapped || item.counted) return null;
    return { counted: true };
  },

  isComplete: allCounted,

  copy: {
    // `count` is bundles here, so the plain "N to count" would name the wrong number.
    todo: ctx => `${ctx.remaining} more to count`,
    finished: ctx => `${ctx.expected} altogether`,
    status: ctx => `${ctx.done * stepOf(ctx.config)} counted so far`,
    statusFinished: ctx => `${groupsPhrase(ctx)} ${makes(ctx)} ${ctx.expected}!`,
    prompt: ctx => `How many ${unitsOf(ctx)} altogether?`,
    wrong: ctx => `Not quite! ${groupsPhrase(ctx)} ${makes(ctx)} ${ctx.expected}. Enter ${ctx.expected}!`,
    actedLabel: (ctx, order) => {
      const group = assetGroup(ctx.config.assetType);
      const named = group ? `a ${group.groupName}` : `a group of ${stepOf(ctx.config)}`;
      return `Counted ${named}${order === null ? "" : `, ${order * stepOf(ctx.config)} so far`}.`;
    }
  },

  guidance: ctx => {
    if (ctx.remaining === 0) return `Now enter how many ${unitsOf(ctx)} there are altogether!`;
    const group = assetGroup(ctx.config.assetType);
    const step = stepOf(ctx.config);
    /*
      The sequence is spelled out for a grouped board, and deliberately.
      "Count on by 10" is an instruction; "10, 20, 30" is the thing being
      practised, and a child who is still unsure what the rod is worth needs to
      hear where the counting goes before they start it.
    */
    return group
      ? `Each ${ctx.objectLabel.toLowerCase()} is one ${group.groupName}. Tap them and count in ${group.groupName}s — ${step}, ${step * 2}, ${step * 3}…`
      : `Tap each group and count on by ${step} — not one at a time!`;
  }
};
