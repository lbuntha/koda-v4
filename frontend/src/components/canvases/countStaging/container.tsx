/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Count Magnets" — a shelf of objects and a vessel to collect them into.
 *
 * The staging that proves an object's size is not a board-wide constant. An
 * apple on the shelf is the shared counting size — the same apple a child just
 * saw in Move & Count — and it shrinks *as it goes in*, which is where a child
 * reads the shrink as "it went in". Sizing everything to the jar's mouth made
 * the loose apples half the size they should be; sizing nothing to it made five
 * of them taller than the basket.
 *
 * The vessel is a drawing, not a drop target. The bin is what a release is
 * tested against and the drawing sits centred inside it, sized from it; objects
 * that land in it are piled into an interior expressed as fractions of the
 * drawing's own box, so every shape and every stage size holds its objects in
 * the right place.
 */

import {
  contentZone,
  countingObjectSize,
  fitObjectSize,
  pilePosition,
  slotPosition,
  type Rect
} from "../objectLayout";
import type { Point } from "../oneToOneLayout";
import {
  CONTAINER_INTERIOR,
  CONTAINER_NAMES,
  CONTAINER_SHAPES,
  ContainerArt,
  type ContainerShape
} from "../ContainerArt";
import { allCounted, type CountStaging, type LayoutInput, type LayoutResult } from "./types";

export const SHELF: string = "shelf";
export const VESSEL: string = "vessel";

const shapeOf = (config: Record<string, unknown>): ContainerShape =>
  CONTAINER_SHAPES.includes(config.containerShape as ContainerShape)
    ? (config.containerShape as ContainerShape)
    : "jar";

/** The vessel drawing's box inside its bin, and the interior it can actually hold. */
const vesselBox = (bin: Rect, shape: ContainerShape) => {
  const captionH = 26;
  const pad = 16;
  // The drawings are all 100 × 120, so the vessel keeps that aspect.
  const height = Math.max(96, Math.min(bin.height - captionH - pad * 2, (bin.width - pad * 2) * 1.2));
  const width = height / 1.2;
  const zone = contentZone(bin, height, captionH);
  const box: Rect = {
    left: Math.floor(zone.left + (zone.width - width) / 2),
    top: Math.floor(zone.top + (zone.height - height) / 2),
    width,
    height
  };
  const fractions = CONTAINER_INTERIOR[shape];
  return {
    box,
    interior: {
      left: box.left + fractions.left * box.width,
      top: box.top + fractions.top * box.height,
      width: fractions.width * box.width,
      height: fractions.height * box.height
    } as Rect
  };
};

export const containerStaging: CountStaging = {
  id: "container",
  movesOnCount: true,

  zones: config => {
    const shape = shapeOf(config);
    return [
      {
        id: SHELF,
        label: (config.sourceBinLabel as string) || "Magnets",
        learnerLabel: (config.sourceBinLabel as string) || "Collect these",
        role: "home",
        emptyHint: ctx => (ctx.remaining === 0 ? "All collected!" : undefined)
      },
      {
        id: VESSEL,
        label:
          (config.jarLabel as string) ||
          (config.destinationBinLabel as string) ||
          CONTAINER_NAMES[shape].bin,
        learnerLabel:
          (config.jarLabel as string) ||
          (config.destinationBinLabel as string) ||
          "Drop them in here",
        role: "target"
        // No empty hint: the vessel is a picture of an invitation already.
      }
    ];
  },

  layout({ count, stage, stacked, zones, items, config }: LayoutInput): LayoutResult {
    const shape = shapeOf(config);
    const loose = countingObjectSize({
      stageWidth: stage.width,
      stageHeight: stage.height,
      count,
      stacked
    });

    const shelfRect = zones[SHELF];
    const vesselRect = zones[VESSEL];
    const vessel = vesselRect ? vesselBox(vesselRect, shape) : null;

    const inside = vessel
      ? Math.min(
          loose,
          fitObjectSize({
            width: vessel.interior.width,
            height: vessel.interior.height,
            count,
            padding: 4,
            captionInset: 0
          })
        )
      : loose;

    const shelf = shelfRect ? contentZone(shelfRect, loose) : null;
    const positions: Record<string, Point> = {};
    const sizes: Record<string, number> = {};

    let waiting = 0;
    for (const item of items) {
      if (item.counted) {
        sizes[item.id] = inside;
        if (vessel) {
          positions[item.id] = pilePosition(item.order ?? 1, count, vessel.interior, inside);
        }
      } else {
        waiting += 1;
        if (shelf) positions[item.id] = slotPosition(waiting, count, shelf, loose);
      }
    }

    return { size: loose, positions, sizes };
  },

  resolve({ item, zone }) {
    if (zone === null) return null;
    const counted = zone === VESSEL;
    return counted === item.counted ? null : { counted };
  },

  isComplete: allCounted,

  guidance: ctx =>
    ctx.remaining === 0
      ? `Enter how many you collected (${ctx.count})!`
      : `Drag each ${ctx.objectLabel} into the container!`,

  Decoration: ({ zone, config }) => {
    const { box } = vesselBox(zone, shapeOf(config as Record<string, unknown>));
    return (
      <ContainerArt
        shape={shapeOf(config as Record<string, unknown>)}
        style={{
          position: "absolute",
          left: `${box.left}px`,
          top: `${box.top}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          zIndex: 5
        }}
      />
    );
  }
};
