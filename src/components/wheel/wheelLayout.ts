/**
 * Where everything sits on the ring.
 *
 * One coordinate system for the whole component: a 420 × 400 box, scaled to
 * whatever width the parent gives it. Everything a child touches is sized in
 * this box, so "is a tile big enough to tap?" is arithmetic on one number — the
 * container's width — rather than something to discover on a phone.
 *
 * Pure: no React, no DOM. That is what lets the geometry be tested properly,
 * including the one that matters most and is easiest to get wrong — that no two
 * tiles ever overlap, at any tile count the game can ask for.
 */

export type Script = "latin" | "khmer";

/** The drawing box — square, just holding the outer ring. `cx`/`cy` is its centre. */
export const VIEW = { width: 420, height: 400, cx: 210, cy: 200 } as const;

/** Circle radii in the box: the tile track, and the two rings drawn around it. */
export const RING = { radius: 118, outer: 180, dashed: 162 } as const;

/** The smallest a tap target may be, in screen pixels. */
export const MIN_TOUCH_PX = 44;

/**
 * Khmer tiles are larger: a cluster carries a subscript that hangs below the
 * baseline, and at the Latin size it fell outside the circle.
 */
export const tileRadiusFor = (script: Script): number => (script === "khmer" ? 37 : 33);

/** How near a pointer has to come to a tile's centre to capture it. */
export const captureRadiusFor = (tileRadius: number): number => tileRadius * 1.24;

export interface Placed {
  x: number;
  y: number;
  /** Radians, clockwise from the +x axis; the first tile sits at the top. */
  angle: number;
}

/** The angle of the nth of `count` tiles: evenly spaced, first at 12 o'clock. */
export const angleOf = (index: number, count: number): number => -Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;

/** A point on the tile track, `offset` further out (or in, if negative). */
export function pointAt(angle: number, offset = 0): { x: number; y: number } {
  const r = RING.radius + offset;
  return { x: VIEW.cx + Math.cos(angle) * r, y: VIEW.cy + Math.sin(angle) * r };
}

export function layoutRing(count: number): Placed[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = angleOf(i, count);
    return { ...pointAt(angle), angle };
  });
}

/** Distance between the centres of two neighbouring tiles. */
export const neighbourGap = (count: number): number => 2 * RING.radius * Math.sin(Math.PI / Math.max(2, count));

/** The most tiles the ring can hold before neighbours touch, with a 4-unit margin. */
export function maxRingTiles(script: Script): number {
  let n = 2;
  while (neighbourGap(n + 1) >= 2 * tileRadiusFor(script) + 4) n++;
  return n;
}

/** How wide a tile looks on screen when the ring is drawn `containerWidth` pixels wide. */
export const tileScreenDiameter = (script: Script, containerWidth: number): number =>
  (2 * tileRadiusFor(script) * containerWidth) / VIEW.width;

/** The narrowest container in which a tile is still a 44px target. */
export const minContainerWidth = (script: Script): number =>
  Math.ceil((MIN_TOUCH_PX * VIEW.width) / (2 * tileRadiusFor(script)));
