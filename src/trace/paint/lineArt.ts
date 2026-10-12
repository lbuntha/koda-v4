/**
 * Drawing a colouring page's line art from its strokes, over the paint. With
 * a solid shape (a wheel in front of the car's body) the strokes go back to
 * front on a layer of their own, each solid one first rubbing out the lines
 * behind it — so the lines a child sees are the walls the paint stops at.
 */

import { strokePolyline } from "../geometry/bezier";
import { isSolid, stackOrder } from "../geometry/layers";
import type { Stroke } from "../geometry/types";
import { lineOf } from "./areas";

export const INK = "#1f2544";

/** Draw the strokes in the canvas's current transform. `layer` is a spare canvas, needed only when a stroke is solid. */
export function drawLineArt(ctx: CanvasRenderingContext2D, strokes: Stroke[], layer: HTMLCanvasElement | null, color = INK) {
  const solid = layer !== null && strokes.some(isSolid);
  let c = ctx;
  if (solid) {
    if (layer.width !== ctx.canvas.width || layer.height !== ctx.canvas.height) {
      layer.width = ctx.canvas.width;
      layer.height = ctx.canvas.height;
    }
    const l = layer.getContext("2d");
    if (!l) return;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, layer.width, layer.height);
    l.setTransform(ctx.getTransform());
    c = l;
  }
  c.strokeStyle = c.fillStyle = color;
  c.lineCap = c.lineJoin = "round";
  for (const i of solid ? stackOrder(strokes) : strokes.map((_, k) => k)) {
    const s = strokes[i];
    if (s.shape === "dot" || s.nodes.length === 1) {
      if (!s.nodes[0]) continue;
      c.beginPath();
      c.arc(s.nodes[0].x, s.nodes[0].y, (s.radius ?? 20) + lineOf(s) / 2, 0, Math.PI * 2);
      c.fill();
      continue;
    }
    const path = new Path2D();
    strokePolyline(s).forEach((p, k) => (k ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
    if (s.closed) path.closePath();
    // Each line as thick as it was designed (see lineOf).
    c.lineWidth = lineOf(s);
    if (solid && isSolid(s)) {
      c.globalCompositeOperation = "destination-out";
      c.fill(path);
      c.globalCompositeOperation = "source-over";
    }
    c.stroke(path);
  }
  if (solid) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  }
}
