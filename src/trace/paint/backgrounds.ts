/**
 * Finished-picture backgrounds: when a child finishes colouring, the paper they
 * left white fades into a soft wash, like a picture-book page. Calm and light,
 * so the child's own colours stay the brightest thing on the page.
 */

export type Background = "sky" | "field" | "paper";
export const BACKGROUNDS: Background[] = ["sky", "field", "paper"];

/** Top and bottom colour of each wash, plus soft light spots (centre and radius in units). */
const WASH: Record<Background, { top: string; bottom: string; glow?: { x: number; y: number; r: number }[] }> = {
  // Light blue fading to cream, with a couple of soft light spots.
  sky: { top: "#d9ecfb", bottom: "#fbf4ea", glow: [{ x: 230, y: 180, r: 260 }, { x: 820, y: 320, r: 180 }] },
  // Cream fading to warm sand.
  field: { top: "#fbf6ee", bottom: "#efdcc4", glow: [{ x: 700, y: 220, r: 240 }] },
  // Flat, warm paper.
  paper: { top: "#faf6ef", bottom: "#f6f0e6" },
};

/** Paint a wash over the 1000-unit square, in the canvas's current transform, at `alpha`. */
export function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, alpha = 1) {
  const w = WASH[bg];
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, w.top);
  g.addColorStop(1, w.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1000, 1000);
  for (const s of w.glow ?? []) {
    const r = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    r.addColorStop(0, "rgba(255,255,255,0.55)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  }
  ctx.restore();
}
