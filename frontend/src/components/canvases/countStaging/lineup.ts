/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Line Up & Count" — a tray of objects above a row of numbered slots.
 *
 * The staging that proves order can belong to the child rather than to arrival:
 * a slot *is* a number, so an object dropped into slot 5 is the fifth whatever
 * went before it. That is why this sets `ordersByPlacement` — the engine's
 * arrival ranking would quietly renumber a child's deliberate choice.
 *
 * One object per slot, and a drop that reaches no free slot is refused rather
 * than nudged somewhere convenient: being able to put a thing down in the wrong
 * place, and be told so, is the point of lining up.
 */

import { contentZone, rowSlotPosition, OBJECT_SIZE } from "../objectLayout";
import type { Point } from "../oneToOneLayout";
import {
  allCounted,
  type CountStaging,
  type LayoutInput,
  type LayoutResult,
  type SlotMarker
} from "./types";

export const TRAY: string = "tray";
export const LINE: string = "line";

export const lineupStaging: CountStaging = {
  id: "lineup",
  movesOnCount: true,
  ordersByPlacement: true,
  // The tray is read above the line, always — this is a top-to-bottom activity.
  orientation: "column",

  zones: config => [
    {
      id: TRAY,
      label: (config.sourceBinLabel as string) || "Tray",
      learnerLabel: (config.sourceBinLabel as string) || "Take from here",
      role: "home",
      emptyHint: ctx => (ctx.remaining === 0 ? "All lined up!" : undefined)
      // No hint on the line itself: the numbered slots already say "put one here".
    },
    {
      id: LINE,
      label: (config.destinationBinLabel as string) || "Line",
      learnerLabel: (config.destinationBinLabel as string) || "Line them up",
      role: "target"
    }
  ],

  layout({ count, stage, zones, items }: LayoutInput): LayoutResult {
    /*
      One row of `count` across, and two bands of one object tall — the object is
      whichever of those allows less. A flat cap left a classroom display showing
      a thin line of tiny objects across an empty band.
    */
    const trayRect = zones[TRAY];
    const lineRect = zones[LINE];
    const widthCap = (stage.width - 40) / Math.max(1, count) / 1.16;
    const heightCap = Math.min(
      trayRect?.height ?? stage.height / 2,
      lineRect?.height ?? stage.height / 2
    ) * 0.62;
    const size = Math.floor(
      Math.max(OBJECT_SIZE.min, Math.min(OBJECT_SIZE.max, Math.min(widthCap, heightCap)))
    );

    const tray = trayRect ? contentZone(trayRect, size) : null;
    const line = lineRect ? contentZone(lineRect, size) : null;
    const positions: Record<string, Point> = {};

    let waiting = 0;
    for (const item of items) {
      if (item.counted && item.order !== null) {
        if (line) positions[item.id] = rowSlotPosition(item.order - 1, count, line, size);
      } else {
        // The tray compacts as objects leave, so what is left reads as "four left".
        if (tray) positions[item.id] = rowSlotPosition(waiting, count, tray, size);
        waiting += 1;
      }
    }

    return { size, positions };
  },

  slots({ count, zones, size }): SlotMarker[] {
    const lineRect = zones[LINE];
    if (!lineRect) return [];
    const line = contentZone(lineRect, size);
    return Array.from({ length: count }, (_, index) => ({
      index,
      ...rowSlotPosition(index, count, line, size),
      label: String(index + 1)
    }));
  },

  resolve({ item, zone, point, items, count, size, zones }) {
    if (zone === TRAY) {
      return item.counted ? { counted: false } : null;
    }
    if (zone !== LINE || !point) return null;

    const lineRect = zones[LINE];
    if (!lineRect) return null;
    const line = contentZone(lineRect, size);

    // Nearest slot the child plausibly aimed at, and only if it is free.
    const snapRadius = Math.max(48, size * 1.15);
    let best: { index: number; distance: number } | null = null;
    for (let index = 0; index < count; index++) {
      const slot = rowSlotPosition(index, count, line, size);
      const centre = { x: slot.x + size / 2, y: slot.y + size / 2 };
      const distance = Math.hypot(point.x - centre.x, point.y - centre.y);
      if (distance > snapRadius) continue;
      if (!best || distance < best.distance) best = { index, distance };
    }
    if (!best) return "refused";

    const occupied = items.some(
      other => other.id !== item.id && other.counted && other.order === best!.index + 1
    );
    // A slot that already holds one is a rule, and the child should see it.
    if (occupied) return "refused";

    return { counted: true, at: best.index + 1 };
  },

  isComplete: allCounted,

  guidance: ctx =>
    ctx.remaining === 0
      ? `Enter how many you lined up (${ctx.count})!`
      : `Drag each ${ctx.objectLabel} onto a numbered slot!`
};
