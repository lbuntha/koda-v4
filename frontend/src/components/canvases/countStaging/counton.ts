/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Count On" — a box that already holds some, and a tray of more to add.
 *
 * The staging that proves counting need not start at one. Five sit in the box
 * before the child touches anything, wearing 1..5; the tray holds three more,
 * and the empty slots are numbered 6, 7, 8. The child counts *on* — says "six"
 * for the first one they place — which is the whole skill, and the reason the
 * starting group must never be re-counted or re-numbered.
 *
 * Two things follow from that, and they are the only reasons this staging needs
 * anything the others don't:
 *
 *   - `objectCount` — the board is `baseCount + extraCount`. These slides carry
 *     no `targetCount`, so the engine cannot work it out from the question.
 *   - `seedCounted` — the first `baseCount` objects begin counted and ranked.
 *
 * The row itself is `rowSlotPosition`, the same primitive Line Up places its
 * slots with, so the numbers a child aims at and the numbers drawn are one
 * calculation. Everything physical — drag, tap, capture, badges, the answer
 * panel — is the engine's, exactly as in every other staging.
 */

import { contentZone, rowSlotPosition, OBJECT_SIZE } from "../objectLayout";
import type { Point } from "../oneToOneLayout";
import { boardTotals } from "./boardTotals";
import {
  allCounted,
  type CountStaging,
  type LayoutInput,
  type LayoutResult,
  type SlotMarker,
  type StagingConfig
} from "./types";

export const TRAY: string = "tray";
export const BOX: string = "box";

const baseOf = (config: StagingConfig) => Math.max(0, Number(config.baseCount ?? 5) || 0);
const extraOf = (config: StagingConfig) => Math.max(0, Number(config.extraCount ?? 3) || 0);

export const countOnStaging: CountStaging = {
  id: "counton",
  movesOnCount: true,
  // The slot a child drops into IS the number they said out loud.
  ordersByPlacement: true,
  // Tray above box: the objects come down into the group, not across into it.
  orientation: "column",

  /** The board is what is already there plus what is being added. */
  objectCount: (config, targetCount) => boardTotals(config, targetCount).objects,

  /** The group we start from — counted, numbered, and not the child's to redo. */
  seedCounted: config => baseOf(config),

  zones: config => [
    {
      id: TRAY,
      label: (config.sourceBinLabel as string) || "More",
      learnerLabel: (config.sourceBinLabel as string) || "Add these",
      role: "home",
      emptyHint: ctx => (ctx.remaining === 0 ? "All counted on!" : undefined)
    },
    {
      id: BOX,
      label: (config.destinationBinLabel as string) || "Already counted",
      learnerLabel: (config.destinationBinLabel as string) || "Count on from here",
      role: "target"
    }
  ],

  layout({ count, stage, zones, items, config }: LayoutInput): LayoutResult {
    const trayRect = zones[TRAY];
    const boxRect = zones[BOX];

    /*
      The box holds the whole row — the starting group and the places still to
      fill — so it is `count` across that has to fit, not `extraCount`. Sizing to
      the tray's few objects made the box's row overflow its own bin.
    */
    const widthCap = (stage.width - 40) / Math.max(1, count) / 1.16;
    const heightCap =
      Math.min(trayRect?.height ?? stage.height / 2, boxRect?.height ?? stage.height / 2) * 0.62;
    const size = Math.floor(
      Math.max(OBJECT_SIZE.min, Math.min(OBJECT_SIZE.max, Math.min(widthCap, heightCap)))
    );

    const tray = trayRect ? contentZone(trayRect, size) : null;
    const box = boxRect ? contentZone(boxRect, size) : null;
    const positions: Record<string, Point> = {};

    const extra = Math.max(1, extraOf(config));
    let waiting = 0;
    for (const item of items) {
      if (item.counted && item.order !== null) {
        if (box) positions[item.id] = rowSlotPosition(item.order - 1, count, box, size);
      } else {
        // The tray is only ever the objects still to add, so it holds `extra`
        // places rather than `count` — otherwise three objects sit hard left
        // under a row of eight empty ones.
        if (tray) positions[item.id] = rowSlotPosition(waiting, extra, tray, size);
        waiting += 1;
      }
    }

    return { size, positions };
  },

  /**
   * Only the places still to fill are marked.
   *
   * Drawing all `count` puts a dashed outline with a "3" on it under an object
   * already sitting there wearing a 3 badge, which reads as two different
   * threes. The starting group is shown by the objects themselves.
   */
  slots({ count, zones, size, config }): SlotMarker[] {
    const boxRect = zones[BOX];
    if (!boxRect) return [];
    const box = contentZone(boxRect, size);
    const base = baseOf(config);
    return Array.from({ length: Math.max(0, count - base) }, (_, offset) => {
      const index = base + offset;
      return {
        index,
        ...rowSlotPosition(index, count, box, size),
        label: String(index + 1)
      };
    });
  },

  resolve({ item, zone, point, items, count, size, zones, config }) {
    const base = baseOf(config);

    if (zone === TRAY) {
      /*
        The starting group cannot be taken back out. It is the premise of the
        question — pulling the 5 out of "5 and 3 more" leaves a different sum,
        and the child would be counting on from nothing.
      */
      if (item.index < base) return "refused";
      return item.counted ? { counted: false } : null;
    }
    if (zone !== BOX || !point) return null;

    const boxRect = zones[BOX];
    if (!boxRect) return null;
    const box = contentZone(boxRect, size);

    /*
      Only the next number accepts.

      This is where Count On differs from Line Up, which lets a child drop into
      any free slot and be told when it was the wrong one. Counting on *is* the
      sequence — you say "six" and then "seven" — so a board that took eight
      first would be teaching the opposite of the skill. The original canvas
      enforced it at the tray, letting only the front object be picked up; doing
      it at the target is the same discipline without taking away the child's
      choice of which object to move.
    */
    let next = base;
    while (
      next < count &&
      items.some(other => other.id !== item.id && other.counted && other.order === next + 1)
    ) {
      next += 1;
    }
    if (next >= count) return "refused";

    const slot = rowSlotPosition(next, count, box, size);
    const centre = { x: slot.x + size / 2, y: slot.y + size / 2 };
    const snapRadius = Math.max(48, size * 1.15);
    // Aimed at anything but the next number: the sequence is the skill.
    if (Math.hypot(point.x - centre.x, point.y - centre.y) > snapRadius) return "refused";

    return { counted: true, at: next + 1 };
  },

  isComplete: allCounted,

  guidance: ctx =>
    ctx.remaining === 0
      ? `Enter how many there are altogether (${ctx.count})!`
      : `Drag each ${ctx.objectLabel} into the next numbered place and count on!`
};
