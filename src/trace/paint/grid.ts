/**
 * The paint grid: cells across the 1000-unit square — one cell per unit, so
 * paint stays sharp when a child zooms in. Areas, paint and picture masks all
 * use it. Pictures made on the earlier 500-cell grid are scaled up on reading
 * (see `unpackMask`), so they keep working unchanged.
 */
export const GRID = 1000;
export const CELL = 1000 / GRID;
/** The grid pictures were made on before; their masks are read at this size and scaled up. */
export const OLD_GRID = 500;
/** Cells per old cell, for settings measured on the old grid (a picture's gap closing). */
export const GRID_SCALE = GRID / OLD_GRID;
/** A part smaller than this many cells (about 11 units across) is a speck — a gap in a line, a highlight in an eye: never a step, never scored. */
export const SPECK = 120;
