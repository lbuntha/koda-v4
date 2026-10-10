/** The paint grid: cells across the 1000-unit square. Areas, paint and picture masks all use it. */
export const GRID = 500;
export const CELL = 1000 / GRID;
/** A part smaller than this many cells is a speck (a gap in a line, a highlight in an eye): never a step, never scored. */
export const SPECK = 30;
