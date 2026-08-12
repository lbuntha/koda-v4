/**
 * Where One-to-One's objects sit, and how big they can be.
 *
 * The patterns a teacher can pick (line, circle, wave, grid, pairs, scatter)
 * used to be written as position formulas with a hardcoded object size beside
 * them — 50px on a small screen, 74px otherwise — which meant the objects were
 * lost on a large screen and touching each other on a crowded one, and each
 * pattern had its own idea of spacing.
 *
 * Here the two are derived in the right order: place the objects first, as
 * centres in the space available, then let the tightest gap between any two of
 * them decide how big an object may be. One rule covers every pattern, and it
 * scales with the stage rather than with a breakpoint.
 */

import { OBJECT_SIZE, bestGrid } from "./objectLayout";

export type OneToOnePattern =
  | "grid"
  | "columns"
  | "pairs"
  | "line"
  | "circle"
  | "wave"
  | "scatter"
  | "ring"
  | "dice";

export interface Point {
  x: number;
  y: number;
}

/** Kept clear between the objects and the stage edge. */
export const STAGE_PADDING = 20;

/** Share of the gap to its nearest neighbour an object may take up. */
const SPACING_FILL = 0.84;

/** The closest any two of these points come. `Infinity` for fewer than two. */
export const minSpacing = (points: Point[]): number => {
  let closest = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      closest = Math.min(closest, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return closest;
};

/** The largest object these centres can carry without the objects touching. */
export const sizeForCentres = (centres: Point[], area: { width: number; height: number }) => {
  const gap = minSpacing(centres);
  const roomy = Math.min(area.width, area.height);
  const fit = Number.isFinite(gap) ? Math.min(gap * SPACING_FILL, roomy) : roomy;
  return Math.round(Math.max(OBJECT_SIZE.min, Math.min(OBJECT_SIZE.max, fit)));
};

/**
 * A stable pseudo-random offset in -1..1 for object `index`.
 *
 * Scatter used to read from two fixed arrays of percentages, which put objects
 * 3 and 8 almost on top of each other whenever a slide asked for nine or more —
 * and, since spacing now sets the size, that would have shrunk every object on
 * the slide. Jittering a grid keeps the scattered look, stays identical between
 * renders, and cannot collide.
 */
const jitter = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

/**
 * The dot positions of a dice face, in a unit square.
 *
 * Only 1–6 have a face; above that the caller falls back to a grid. These are
 * the arrangement a child has already met on a die, which is the whole point of
 * offering it: the same quantity in a shape they can read without counting.
 */
const DICE_FACES: Record<number, Point[]> = {
  1: [{ x: 0.5, y: 0.5 }],
  2: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }],
  3: [{ x: 0.22, y: 0.22 }, { x: 0.5, y: 0.5 }, { x: 0.78, y: 0.78 }],
  4: [{ x: 0.27, y: 0.27 }, { x: 0.73, y: 0.27 }, { x: 0.27, y: 0.73 }, { x: 0.73, y: 0.73 }],
  5: [
    { x: 0.25, y: 0.25 }, { x: 0.75, y: 0.25 }, { x: 0.5, y: 0.5 },
    { x: 0.25, y: 0.75 }, { x: 0.75, y: 0.75 }
  ],
  6: [
    { x: 0.27, y: 0.2 }, { x: 0.73, y: 0.2 }, { x: 0.27, y: 0.5 },
    { x: 0.73, y: 0.5 }, { x: 0.27, y: 0.8 }, { x: 0.73, y: 0.8 }
  ]
};

const gridColumnsFor = (
  pattern: OneToOnePattern,
  count: number,
  area: { width: number; height: number },
  configured?: number
) => {
  if (configured && configured > 0) return Math.max(1, Math.min(count, configured));
  if (pattern === "pairs") return Math.min(count, 2);
  if (pattern === "line") {
    // A line stays a line, and wraps only when a row of them would not fit.
    const perRow = Math.max(1, Math.floor(area.width / (OBJECT_SIZE.min * 1.15)));
    return Math.max(1, Math.min(count, perRow));
  }

  const best = bestGrid(count, area.width, area.height);

  /*
    Scatter needs more than one row, or it is not scatter.

    Every other pattern wants `bestGrid`, which picks whatever arrangement makes
    each object biggest — and in a bin that is wide and short, that is always a
    single row. For a grid that is the right answer. For scatter it destroys the
    thing: jitter along one row is a wobbly line, and "count the scattered ones"
    becomes "count the ones already laid out in order", which is the easier
    exercise the teacher deliberately did not pick.

    So scatter takes a second row as soon as one will fit — two rows of the
    smallest object we would ever draw — and only falls back to the biggest-fit
    grid when the bin is genuinely too short to hold two. Objects come out
    smaller than `bestGrid` would have made them; that is the trade, and it is
    the right way round, because a scatter that reads as a line is not a smaller
    version of the exercise, it is a different one.
  */
  if (pattern === "scatter" && best.rows === 1 && count >= 4) {
    const twoRowsFit = area.height >= OBJECT_SIZE.min * 2 * 1.15;
    if (twoRowsFit) return Math.ceil(count / 2);
  }

  return best.columns;
};

/** Object centres for a pattern, independent of how big the objects end up. */
export const patternCentres = (
  pattern: OneToOnePattern,
  count: number,
  area: { left: number; top: number; width: number; height: number },
  configuredColumns?: number
): Point[] => {
  const total = Math.max(0, count);
  const centreX = area.left + area.width / 2;
  const centreY = area.top + area.height / 2;

  if (total === 0) return [];
  if (total === 1) return [{ x: centreX, y: centreY }];

  switch (pattern) {
    case "circle": {
      // An arc from upper-left round to upper-right, read left to right.
      const radiusX = area.width * 0.44;
      const radiusY = area.height * 0.4;
      const start = Math.PI * 0.85;
      const end = Math.PI * 0.15;
      const step = (start - end) / (total - 1);
      return Array.from({ length: total }, (_, i) => {
        const angle = start - i * step;
        return { x: centreX + radiusX * Math.cos(angle), y: centreY - radiusY * Math.sin(angle) };
      });
    }

    case "ring": {
      // A closed ring, unlike `circle`'s open arc: the same quantity with no
      // beginning and no end, which is the harder conservation case.
      const radiusX = area.width * 0.44;
      const radiusY = area.height * 0.44;
      return Array.from({ length: total }, (_, i) => {
        // Starts at the top and runs clockwise, the way a child traces a circle.
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
        return { x: centreX + radiusX * Math.cos(angle), y: centreY + radiusY * Math.sin(angle) };
      });
    }

    case "dice": {
      const face = DICE_FACES[total];
      if (face) {
        // Square, so the face is a face and not a stretched one.
        const side = Math.min(area.width, area.height);
        const left = centreX - side / 2;
        const top = centreY - side / 2;
        return face.map(dot => ({ x: left + dot.x * side, y: top + dot.y * side }));
      }
      return patternCentres("grid", total, area, configuredColumns);
    }

    case "wave": {
      const step = area.width / (total - 1);
      const amplitude = area.height * 0.22;
      return Array.from({ length: total }, (_, i) => ({
        x: area.left + i * step,
        y: centreY + amplitude * Math.sin((i / total) * Math.PI * 2)
      }));
    }

    default: {
      const columns = gridColumnsFor(pattern, total, area, configuredColumns);
      const rows = Math.ceil(total / columns);
      const cellWidth = area.width / columns;
      const cellHeight = area.height / rows;

      return Array.from({ length: total }, (_, i) => {
        const row = Math.floor(i / columns);
        const column = i % columns;
        // Each row centred on its own width, so a short last row is not left-hung.
        const inRow = Math.min(columns, total - row * columns);
        const rowLeft = centreX - (inRow * cellWidth) / 2;
        const centre = {
          x: rowLeft + (column + 0.5) * cellWidth,
          y: area.top + (row + 0.5) * cellHeight
        };
        if (pattern !== "scatter") return centre;
        return {
          x: centre.x + jitter(i, 1) * cellWidth * 0.22,
          y: centre.y + jitter(i, 2) * cellHeight * 0.22
        };
      });
    }
  }
};

export interface OneToOneLayoutOptions {
  count: number;
  /** Stage size in pixels. */
  width: number;
  height: number;
  pattern: OneToOnePattern;
  gridColumns?: number;
  padding?: number;
}

export interface OneToOneLayout {
  /** Object edge length in pixels. */
  size: number;
  /** Top-left positions, in stage pixels. */
  positions: Point[];
}

/** Positions and object size for a pattern on a stage of this size. */
export const oneToOneLayout = ({
  count,
  width,
  height,
  pattern,
  gridColumns,
  padding = STAGE_PADDING
}: OneToOneLayoutOptions): OneToOneLayout => {
  const area = {
    left: padding,
    top: padding,
    width: Math.max(OBJECT_SIZE.min, width - padding * 2),
    height: Math.max(OBJECT_SIZE.min, height - padding * 2)
  };

  /*
    Two passes, because the size and the space available are circular: a pattern
    lays out CENTRES, but an object hangs half its width past its centre, so the
    centres have to keep half an object clear of the edge. Sizing a first pass
    gives that inset; the second pass places the centres inside it. Without this
    the edge objects get pushed back in to fit and end up touching their
    neighbours — which is exactly what the overlap test caught.
  */
  const firstPass = patternCentres(pattern, count, area, gridColumns);
  const roughSize = sizeForCentres(firstPass, area);
  const inner = {
    left: area.left + roughSize / 2,
    top: area.top + roughSize / 2,
    width: Math.max(1, area.width - roughSize),
    height: Math.max(1, area.height - roughSize)
  };

  const centres = patternCentres(pattern, count, inner, gridColumns);
  const size = Math.min(roughSize, sizeForCentres(centres, area));
  const half = size / 2;

  return {
    size,
    positions: centres.map(centre => ({
      x: Math.round(Math.max(0, Math.min(width - size, centre.x - half))),
      y: Math.round(Math.max(0, Math.min(height - size, centre.y - half)))
    }))
  };
};
