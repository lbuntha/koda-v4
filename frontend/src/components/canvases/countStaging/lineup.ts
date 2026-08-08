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

import { contentZone, OBJECT_SIZE } from "../objectLayout";
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

/** Row geometry, shared by layout, slot markers and the drop test. */
const geometry = (count: number, size: number, area: { left: number; top: number; width: number; height: number }) => {
  const gap = Math.max(
    size * 0.16,
    Math.min(size * 0.45, (area.width - count * size) / Math.max(1, count - 1))
  );
  const rowWidth = count * size + gap * Math.max(0, count - 1);
  return {
    gap,
    startX: area.left + (area.width - rowWidth) / 2,
    y: area.top + (area.height - size) / 2
  };
};

const slotAt = (index: number, count: number, size: number, area: ReturnType<typeof contentZone>): Point => {
  const g = geometry(count, size, area);
  return { x: Math.floor(g.startX + index * (size + g.gap)), y: Math.floor(g.y) };
};

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
        if (line) positions[item.id] = slotAt(item.order - 1, count, size, line);
      } else {
        // The tray compacts as objects leave, so what is left reads as "four left".
        if (tray) positions[item.id] = slotAt(waiting, count, size, tray);
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
      ...slotAt(index, count, size, line),
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
      const slot = slotAt(index, count, size, line);
      const centre = { x: slot.x + size / 2, y: slot.y + size / 2 };
      const distance = Math.hypot(point.x - centre.x, point.y - centre.y);
      if (distance > snapRadius) continue;
      if (!best || distance < best.distance) best = { index, distance };
    }
    if (!best) return null;

    const occupied = items.some(
      other => other.id !== item.id && other.counted && other.order === best!.index + 1
    );
    if (occupied) return null;

    return { counted: true, at: best.index + 1 };
  },

  isComplete: allCounted,

  guidance: ctx =>
    ctx.remaining === 0
      ? `Enter how many you lined up (${ctx.count})!`
      : `Drag each ${ctx.objectLabel} onto a numbered slot!`
};
