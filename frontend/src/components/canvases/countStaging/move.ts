/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Move & Count" — two bins, drag every object from one to the other.
 *
 * The reference staging: a child moves an object, and the act of moving it is
 * the act of counting it. Everything positional comes from the shared object
 * layout, so an apple here is the same size as the same apple in every other
 * counting activity.
 */

import { contentZone, countingObjectSize, slotPosition } from "../objectLayout";
import type { Point } from "../oneToOneLayout";
import { allCounted, type CountStaging, type LayoutInput, type LayoutResult } from "./types";

export const WAITING: string = "waiting";
export const COUNTED: string = "counted";

export const moveStaging: CountStaging = {
  id: "move",
  movesOnCount: true,

  zones: config => [
    {
      id: WAITING,
      label: (config.sourceBinLabel as string) || "Uncounted",
      learnerLabel: (config.sourceBinLabel as string) || "Move these",
      role: "home",
      emptyHint: ctx => (ctx.remaining === 0 ? "All moved!" : undefined)
    },
    {
      id: COUNTED,
      label: (config.destinationBinLabel as string) || "Counted",
      learnerLabel: (config.destinationBinLabel as string) || "Counted here",
      role: "target",
      emptyHint: ctx => (ctx.counted === 0 ? `Drop each ${ctx.objectLabel} here and count` : undefined)
    }
  ],

  layout({ count, stage, stacked, zones, items }: LayoutInput): LayoutResult {
    const size = countingObjectSize({
      stageWidth: stage.width,
      stageHeight: stage.height,
      count,
      stacked
    });

    const home = zones[WAITING] ? contentZone(zones[WAITING]!, size) : null;
    const target = zones[COUNTED] ? contentZone(zones[COUNTED]!, size) : null;
    const positions: Record<string, Point> = {};

    /*
      Rank within the bin, not index in the array. Slotting by index leaves a
      hole where a moved object used to be, which a child reads as "one is
      missing" rather than as "four left".
    */
    let waiting = 0;
    for (const item of items) {
      if (item.counted) {
        if (target) positions[item.id] = slotPosition(item.order ?? 1, count, target, size);
      } else {
        waiting += 1;
        if (home) positions[item.id] = slotPosition(waiting, count, home, size);
      }
    }

    return { size, positions };
  },

  resolve({ item, zone }) {
    // Dropped on neither bin: the engine returns it to the bin it came from.
    if (zone === null) return null;
    const counted = zone === COUNTED;
    return counted === item.counted ? null : { counted };
  },

  isComplete: allCounted,

  guidance: ctx =>
    ctx.remaining === 0
      ? `Enter how many you moved (${ctx.count})!`
      : `Drag each ${ctx.objectLabel} into the counted box!`
};
