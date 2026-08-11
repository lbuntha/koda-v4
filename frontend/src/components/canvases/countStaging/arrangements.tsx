/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Different Arrangements" — the same objects, laid out a different way each
 * slide, and still the same number of them.
 *
 * Physically this is `tap`: the objects lie where they are and the child touches
 * each once. It is a separate staging because it is a different *lesson* — One
 * to One teaches "one number per object, none missed, none twice", and this
 * teaches "moving them around does not change how many". Same act, and the
 * chrome is what says which lesson a child is in:
 *
 *   - the arena is named for its arrangement ("Ring Arrangement"), so the thing
 *     that varies between slides is the thing with a label on it
 *   - a number track fills 1..n as they count, which is the running total said
 *     out loud — the evidence that the answer is the same whatever the shape
 *
 * Neither needed anything new from the engine. The arena is an ordinary `home`
 * zone and the track is a `readout`, the role Count Back's countdown introduced.
 *
 * Teacher-authored positions are the engine's to replay (`customPositions`), not
 * this file's — a teacher moving an object is a fact about the slide, not about
 * what counting physically is.
 */

import React from "react";
import { contentZone, OBJECT_SIZE, type Rect } from "../objectLayout";
import { oneToOneLayout, type OneToOnePattern, type Point } from "../oneToOneLayout";
import { accentChipClass, emptySlotClass } from "../canvasTheme";
import {
  allCounted,
  type CountStaging,
  type LayoutInput,
  type LayoutResult,
  type StagingConfig,
  type ZoneContentProps
} from "./types";

export const ARENA: string = "arena";
export const TRACK: string = "track";

/** Every arrangement a slide may ask for, and how a child hears it named. */
const PATTERN_LABELS: Record<OneToOnePattern, string> = {
  grid: "Grid Arrangement",
  columns: "Column Arrangement",
  pairs: "Paired Arrangement",
  line: "Line Arrangement",
  circle: "Curved Arrangement",
  ring: "Ring Arrangement",
  wave: "Wave Arrangement",
  dice: "Dice Arrangement",
  scatter: "Scattered Arrangement"
};

const patternOf = (config: StagingConfig): OneToOnePattern => {
  const named = config.pattern as OneToOnePattern;
  return PATTERN_LABELS[named] ? named : "scatter";
};

/**
 * The running total, as chips that fill in.
 *
 * Every number is drawn from the start, not just the ones reached: seeing the
 * whole track is what makes "there are still three to go" readable, and it is
 * the same track whatever arrangement the objects are in — which is the lesson.
 */
const NumberTrack: React.FC<ZoneContentProps> = ({ count, done, isDark, config }) => {
  const accent = (config.frameColor as string) || "violet";
  return (
    <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1.5 overflow-hidden px-2">
      {Array.from({ length: count }, (_, index) => {
        const reached = index < done;
        return (
          <div
            key={index}
            className={`h-[22px] w-[22px] sm:h-[26px] sm:w-[26px] rounded-lg border-2 text-[11px]
              flex items-center justify-center font-mono font-bold transition-all duration-300 ${
                reached
                ? `${accentChipClass(accent, isDark)} animate-drop-pop`
                : `border-dashed ${emptySlotClass(isDark)}`
              }`}
          >
            {index + 1}
          </div>
        );
      })}
    </div>
  );
};

export const arrangementsStaging: CountStaging = {
  id: "arrangements",
  // Counting happens where the objects already are.
  movesOnCount: false,
  // Arena above, number track below — read top to bottom.
  orientation: "column",

  zones: config => [
    {
      id: ARENA,
      // The arrangement is what changes between slides, so it is what is named.
      label: (config.sourceBinLabel as string) || PATTERN_LABELS[patternOf(config)],
      learnerLabel: (config.sourceBinLabel as string) || "Tap every one",
      role: "home"
      // No empty hint: nothing leaves this bin, so it never empties.
    },
    {
      id: TRACK,
      label: "Counted so far",
      learnerLabel: "Count with me",
      role: "readout",
      /*
        Enough for a couple of rows of chips and no more. The arena is what the
        child is looking at, and a track that grew with the count would take the
        arrangement's room away exactly when there is most to arrange.
      */
      flex: "0 0 4.5rem",
      Content: NumberTrack
    }
  ],

  layout({ count, stage, zones, config }: LayoutInput): LayoutResult {
    const arenaRect = zones[ARENA];

    /*
      `oneToOneLayout` owns the patterns, and decides the object size from the
      tightest gap between any two centres — so no arrangement can overlap itself
      at any count. It works in its own box, so the result is lifted into stage
      coordinates afterwards.
    */
    const area: Rect = arenaRect
      ? contentZone(arenaRect, OBJECT_SIZE.min)
      : { left: 0, top: 0, width: stage.width, height: stage.height * 0.7 };

    const laid = oneToOneLayout({
      count,
      width: area.width,
      height: area.height,
      pattern: patternOf(config),
      gridColumns: config.gridColumns as number | undefined,
      padding: stage.width < 640 ? 8 : 14
    });

    const positions: Record<string, Point> = {};
    laid.positions.forEach((centre, index) => {
      positions[`count-item-${index}`] = { x: centre.x + area.left, y: centre.y + area.top };
    });

    return { size: laid.size, positions };
  },

  /*
    Only a tap counts, and only once. Tapping a counted object again does
    nothing: "uncount by tapping" would let a child undo their own count by
    resting a finger on the board.
  */
  resolve({ item, tapped }) {
    if (!tapped || item.counted) return null;
    return { counted: true };
  },

  isComplete: allCounted,

  guidance: ctx =>
    ctx.remaining === 0
      ? `Enter how many you counted (${ctx.count})!`
      : `Tap each ${ctx.objectLabel} once — the arrangement changed, but the number did not!`
};
