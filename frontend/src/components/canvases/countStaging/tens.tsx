/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Group in Tens" — a pile of ones above ten-frames to sort them into.
 *
 * The staging that proves position can carry place value. A ten-frame is not
 * decoration: the cell a child drops into *is* the number, and the frame that
 * cell belongs to is the ten it lives in. So this sets `ordersByPlacement` for
 * the same reason Line Up does — arrival ranking would renumber a deliberate
 * choice — and lays cells out 5 across by 2 down, because that is the shape a
 * child learns to read "seven" from without recounting.
 *
 * Everything physical is the engine's: the drag, the tap, the pointer capture,
 * the badges, the re-rank, the answer panel. This file owns four decisions and
 * one piece of artwork, and knows nothing about how an object gets picked up.
 *
 * Frames come from the count, not from configuration — 24 ones is three frames
 * whatever a slide says, and the last one is deliberately left part-empty,
 * because "two full tens and four over" is the thing being taught.
 */

import React from "react";
import { contentZone, slotPosition, OBJECT_SIZE, type Rect } from "../objectLayout";
import type { Point } from "../oneToOneLayout";
import {
  allCounted,
  type CountItem,
  type CountStaging,
  type LayoutInput,
  type LayoutResult,
  type SlotMarker
} from "./types";

export const PILE: string = "pile";
export const FRAMES: string = "frames";

/** A ten-frame is 5 across and 2 down. That shape is the whole point. */
const COLS = 5;
const ROWS = 2;
const PER_FRAME = COLS * ROWS;

const frameCount = (count: number) => Math.max(1, Math.ceil(count / PER_FRAME));

/**
 * What the frames come to, in the words the answer is built from.
 *
 * "1 ten and 3 ones", "2 tens", "7 ones" — never "1 ten and 0 ones", which is a
 * sentence nobody says and which teaches a child that the empty place has to be
 * mentioned. The zero shows up soon enough, in a column; it is not this board's
 * lesson.
 */
const placeValue = (count: number) => {
  const tens = Math.floor(count / 10);
  const ones = count % 10;
  const tensPart = `${tens} ten${tens === 1 ? "" : "s"}`;
  const onesPart = `${ones} one${ones === 1 ? "" : "s"}`;
  if (tens === 0) return onesPart;
  if (ones === 0) return tensPart;
  return `${tensPart} and ${onesPart}`;
};

/**
 * How many frames sit side by side.
 *
 * Two at most, and one once the zones have stacked: three ten-frames across a
 * phone makes every one a row of specks. Kept as one rule so `layout`, `slots`,
 * `resolve` and the artwork all place cells in exactly the same spot — the bug
 * this shape invites is a drop test that disagrees with what was drawn.
 */
const framesAcross = (count: number, stacked: boolean) =>
  stacked ? 1 : Math.min(frameCount(count), 2);

/** Cell pitch, frame box, and where the block of frames starts. */
const grid = (count: number, size: number, area: Rect, across: number) => {
  const gap = Math.max(2, Math.round(size * 0.12));
  const pitch = size + gap;
  const frameW = COLS * pitch - gap;
  const frameH = ROWS * pitch - gap;
  const frameGap = Math.max(gap * 2, Math.round(size * 0.45));
  const rows = Math.ceil(frameCount(count) / across);
  const blockW = across * frameW + (across - 1) * frameGap;
  const blockH = rows * frameH + (rows - 1) * frameGap;
  return {
    pitch,
    frameW,
    frameH,
    frameGap,
    across,
    rows,
    startX: area.left + (area.width - blockW) / 2,
    startY: area.top + (area.height - blockH) / 2
  };
};

/** Top-left of one frame's box, for the artwork and for cell maths. */
const frameBox = (frame: number, g: ReturnType<typeof grid>) => ({
  x: g.startX + (frame % g.across) * (g.frameW + g.frameGap),
  y: g.startY + Math.floor(frame / g.across) * (g.frameH + g.frameGap)
});

/**
 * The next cell to fill: the lowest one still empty.
 *
 * Grouping into tens is counting, not sorting. A frame filled 1, 4, 9, 2 holds
 * four ones and shows nothing — the whole reason a ten-frame teaches is that a
 * *partly filled* one can be read at a glance, and that only works if it fills
 * in order.
 */
const nextCell = (items: CountItem[], count: number) => {
  const taken = new Set(items.filter(i => i.counted && i.order !== null).map(i => i.order! - 1));
  for (let index = 0; index < count; index += 1) if (!taken.has(index)) return index;
  return null;
};

/** Where the `index`-th cell sits, counting left-to-right then down, frame by frame. */
const cellAt = (index: number, count: number, size: number, area: Rect, across: number): Point => {
  const g = grid(count, size, area, across);
  const box = frameBox(Math.floor(index / PER_FRAME), g);
  const within = index % PER_FRAME;
  return {
    x: Math.floor(box.x + (within % COLS) * g.pitch),
    y: Math.floor(box.y + Math.floor(within / COLS) * g.pitch)
  };
};

export const tensStaging: CountStaging = {
  id: "tens",
  movesOnCount: true,
  ordersByPlacement: true,
  // Ones above, tens below: this is read top-to-bottom, like Line Up.
  orientation: "column",

  zones: config => [
    {
      id: PILE,
      label: (config.sourceBinLabel as string) || "Ones",
      learnerLabel: (config.sourceBinLabel as string) || "Take from here",
      role: "home",
      emptyHint: ctx => (ctx.remaining === 0 ? "All grouped!" : undefined)
      // No hint on the frames: the empty cells already say "put one here".
    },
    {
      id: FRAMES,
      label: (config.destinationBinLabel as string) || "Tens",
      learnerLabel: (config.destinationBinLabel as string) || "Fill each ten",
      role: "target"
    }
  ],

  layout({ count, stage, stacked, zones, items }: LayoutInput): LayoutResult {
    const pileRect = zones[PILE];
    const framesRect = zones[FRAMES];
    const across = framesAcross(count, stacked);
    const rows = Math.ceil(frameCount(count) / across);

    /*
      Sized so the frames fit both ways at once — across, and down. Taking only
      the width cap put three rows of frames off the bottom of a short stage.
    */
    const area = framesRect ? contentZone(framesRect, OBJECT_SIZE.min) : null;
    const areaW = area?.width ?? stage.width;
    const areaH = area?.height ?? stage.height / 2;
    const widthCap = (areaW - (across - 1) * 24) / (across * COLS) / 1.12;
    const heightCap = (areaH - (rows - 1) * 24) / (rows * ROWS) / 1.25;
    const size = Math.floor(
      Math.max(OBJECT_SIZE.min, Math.min(OBJECT_SIZE.max, Math.min(widthCap, heightCap)))
    );

    const pile = pileRect ? contentZone(pileRect, size) : null;
    const frames = framesRect ? contentZone(framesRect, size) : null;
    const positions: Record<string, Point> = {};

    let waiting = 0;
    for (const item of items) {
      if (item.counted && item.order !== null) {
        if (frames) positions[item.id] = cellAt(item.order - 1, count, size, frames, across);
      } else {
        /*
          The pile keeps the shared wrapped-grid arrangement and is addressed by
          `count`, not by how many are left, so the ones that stay put do not
          shuffle sideways every time one is taken.
        */
        if (pile) positions[item.id] = slotPosition(waiting + 1, count, pile, size);
        waiting += 1;
      }
    }

    return { size, positions };
  },

  slots({ count, stacked, zones, size, config, items }): SlotMarker[] {
    const framesRect = zones[FRAMES];
    if (!framesRect) return [];
    const frames = contentZone(framesRect, size);
    const across = framesAcross(count, stacked);
    /*
      Numbered cells are training wheels. The ladder takes them off at seventeen,
      because reading "two full frames and seven" off the shape is the skill —
      and a cell wearing its own number lets a child count the cells instead.
    */
    const numbered = config.showNumbersInSlots !== false;
    const next = nextCell(items, count);
    return Array.from({ length: count }, (_, index) => ({
      index,
      ...cellAt(index, count, size, frames, across),
      label: numbered ? String(index + 1) : undefined,
      next: index === next
    }));
  },

  resolve({ item, zone, point, items, count, size, zones, stacked }) {
    if (zone === PILE) {
      return item.counted ? { counted: false } : null;
    }
    if (zone !== FRAMES || !point) return null;

    const framesRect = zones[FRAMES];
    if (!framesRect) return null;
    const frames = contentZone(framesRect, size);
    const across = framesAcross(count, stacked);

    /*
      Only the next cell accepts.

      Line Up lets a child drop into any free slot and be told when it was the
      wrong one, because there the slot *is* the number and choosing is the
      exercise. Here it is the opposite: the cells have no meaning apart from the
      order they fill in, and a ten-frame with holes in it cannot be read as
      "seven". So this behaves like Count On — one place at a time, and the
      engine draws which one.
    */
    const next = nextCell(items, count);
    if (next === null) return "refused";

    const cell = cellAt(next, count, size, frames, across);
    const centre = { x: cell.x + size / 2, y: cell.y + size / 2 };
    const snapRadius = Math.max(44, size * 1.1);
    if (Math.hypot(point.x - centre.x, point.y - centre.y) > snapRadius) return "refused";

    return { counted: true, at: next + 1 };
  },

  /**
   * The frames themselves.
   *
   * Drawn, never a drop target — the *zone* is what a release is tested against
   * and this sits inside it, on the same geometry the cells use. An outline per
   * ten is what makes "two full frames and four over" legible at a glance; the
   * cells alone are just a spaced grid.
   */
  Decoration: ({ zone, count, size, stacked, isDark }) => {
    const area = contentZone(zone, size);
    const across = framesAcross(count, stacked);
    const g = grid(count, size, area, across);
    const pad = Math.round(size * 0.14);

    return (
      <>
        {Array.from({ length: frameCount(count) }, (_, frame) => {
          const box = frameBox(frame, g);
          /* The last frame is short whenever the count is not a whole ten. */
          const cells = Math.min(PER_FRAME, count - frame * PER_FRAME);
          const cols = Math.min(COLS, cells);
          const rows = Math.ceil(cells / COLS);
          return (
            <div
              key={`frame-${frame}`}
              aria-hidden="true"
              className={`absolute rounded-2xl border-2 pointer-events-none ${
                isDark ? "border-white/15" : "border-slate-900/15"
              }`}
              style={{
                left: `${box.x - pad}px`,
                top: `${box.y - pad}px`,
                width: `${cols * g.pitch - (g.pitch - size) + pad * 2}px`,
                height: `${rows * g.pitch - (g.pitch - size) + pad * 2}px`
              }}
            />
          );
        })}
      </>
    );
  },

  isComplete: allCounted,

  /**
   * The frames, said out loud.
   *
   * Every other staging ends at "All 13 counted!", and for every other staging
   * that is the whole truth. Here it throws the lesson away: the child has just
   * built one full frame and three left over, and being told they counted
   * thirteen things describes the board they started with, not the one they
   * made. A ten-frame that reports a plain total is a ten-frame for decoration.
   */
  copy: {
    finished: ctx => placeValue(ctx.count),
    statusFinished: ctx => `${placeValue(ctx.count)} — that makes ${ctx.count}!`,
    wrong: ctx =>
      `Not quite! Look at the frames: ${placeValue(ctx.expected)}. That makes ${ctx.expected} — enter ${ctx.expected}!`
  },

  guidance: ctx =>
    ctx.remaining === 0
      ? // Not "(13)" — this used to print the answer directly above the box asking for it.
        "Now read the frames — how many is that altogether?"
      : `Drag each ${ctx.objectLabel} into the next empty box — fill the frame in order to make a ten!`
};
