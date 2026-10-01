/**
 * The shapes letters are made of, ready to drop on the canvas and adjust:
 * line, arc, hook, loop, dot — and zigzag and wave for pre-writing pages.
 */

import { blendAll, setNodeType } from "../geometry/edit";
import type { Stroke, StrokeShape, TraceNode } from "../geometry/types";

export const PRIMITIVES = ["line", "arc", "hook", "loop", "dot", "zigzag", "wave", "rectangle", "square", "triangle", "circle", "polygon"] as const;

/** Corners of a regular polygon, the first at the top, going clockwise. */
function regular(sides: number, r: number, cx = 500, cy = 500): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return [Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))];
  });
}

/** Handle length that makes four symmetric points a true circle. */
const KAPPA = 0.5523;
export type Primitive = (typeof PRIMITIVES)[number];

const corner = (pts: [number, number][]): TraceNode[] => pts.map(([x, y]) => ({ x, y, type: "corner" }));

export function makePrimitive(kind: Primitive, id: string, order: number): Stroke {
  const base = { id, order, closed: false, join: "lift" as const, width: 60, checkpoints: [] };
  const shape = (s: StrokeShape, nodes: TraceNode[], extra: Partial<Stroke> = {}): Stroke => ({ ...base, shape: s, nodes, ...extra });
  switch (kind) {
    case "line":
      return shape("line", corner([[500, 250], [500, 750]]));
    case "arc":
      return blendAll(shape("curve", corner([[300, 600], [500, 380], [700, 600]])));
    case "hook":
      // Straight down, then a smooth curl at the end.
      return setNodeType(shape("hook", corner([[450, 250], [450, 640], [530, 760], [650, 700]])), 2, "smooth");
    case "loop":
      return blendAll(shape("loop", corner([[500, 350], [350, 500], [500, 650], [650, 500]]), { closed: true }));
    case "dot":
      return shape("dot", corner([[500, 500]]), { radius: 20 });
    case "zigzag":
      return shape("free", corner([[250, 600], [375, 400], [500, 600], [625, 400], [750, 600]]));
    case "wave":
      return blendAll(shape("curve", corner([[250, 500], [375, 400], [500, 500], [625, 600], [750, 500]])));
    // Closed shapes: one stroke that ends where it starts, from the top-left
    // corner (or the top), going round the way a child is taught.
    case "rectangle":
      return shape("free", corner([[250, 330], [250, 670], [750, 670], [750, 330]]), { closed: true });
    case "square":
      return shape("free", corner([[300, 300], [300, 700], [700, 700], [700, 300]]), { closed: true });
    case "triangle":
      return shape("free", corner(regular(3, 260, 500, 540)).reverse(), { closed: true });
    case "polygon":
      return shape("free", corner(regular(6, 240)).reverse(), { closed: true });
    case "circle": {
      // Starts at the top and goes anticlockwise, like the letter c.
      const r = 220;
      const h = r * KAPPA;
      const nodes: TraceNode[] = [
        { x: 500, y: 500 - r, type: "symmetric", in: { dx: h, dy: 0 }, out: { dx: -h, dy: 0 } },
        { x: 500 - r, y: 500, type: "symmetric", in: { dx: 0, dy: -h }, out: { dx: 0, dy: h } },
        { x: 500, y: 500 + r, type: "symmetric", in: { dx: -h, dy: 0 }, out: { dx: h, dy: 0 } },
        { x: 500 + r, y: 500, type: "symmetric", in: { dx: 0, dy: h }, out: { dx: 0, dy: -h } },
      ];
      return shape("loop", nodes, { closed: true });
    }
  }
}
