/**
 * Colouring from a picture: a colouring page (black lines on white) or a
 * coloured example becomes line art and parts, with no tracing.
 *
 * The picture is fitted into the 1000×1000 square. Every grey pixel darker
 * than the line strength is a line (coloured pixels are paint, unless very dark). The lines are kept twice: a PNG for the child to
 * see (crisp, dark lines on transparent), and a bit mask on the paint grid for
 * finding parts (one bit per cell, a cell is a line if any of its pixels is).
 * From a coloured example, each part's colour is read back to make the steps.
 *
 * The pure half (masks, colours → steps) is tested; the canvas half runs in
 * the Studio only.
 */

import type { EraseMark, PaintPicture, PaintStep, Point, Stroke } from "../geometry/types";
import { pieces, readingOrder, strokesFromPlan } from "../geometry/vectorize";
import type { Areas } from "./areas";
import { GRID, GRID_SCALE, OLD_GRID, SPECK } from "./grid";
import { PALETTE, rgb, toHex } from "./palette";

/** Pixels across the fitted square: one per unit, the same as the grid. */
export const SIDE = 1000;
/** Pixels per grid cell. */
const PX = SIDE / GRID;
export const DEFAULT_STRENGTH = 200;
/** A line is grey: a pixel this colourful is paint, however dark, unless it is very dark. */
const GREY = 60;
const VERY_DARK = 90;
/** How much each line grows by (in old-grid cells, 2 units each), so the small breaks a scanned or shrunk page has close up. */
export const DEFAULT_GAP = 2;
export { SPECK } from "./grid";

/* ------------------------------------------------------------------ masks */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** GRID² cells (1 = line) → base64 of the packed bits. */
export function packMask(mask: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(mask.length / 8));
  for (let i = 0; i < mask.length; i++) if (mask[i]) bytes[i >> 3] |= 1 << (i & 7);
  return toBase64(bytes);
}

const RUNS = "rle1:";

function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    let n = 0;
    for (let k = 0; k < 4; k++) n = (n << 6) | Math.max(0, B64.indexOf(clean[i + k] ?? "A"));
    for (const byte of [(n >> 16) & 255, (n >> 8) & 255, n & 255]) if (o < out.length) out[o++] = byte;
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return out;
}

/**
 * A line mask as runs: alternate lengths of no-line and line cells, each a
 * varint. Line art is mostly paper, so this is a fraction of one bit per cell.
 */
export function packRuns(mask: Uint8Array): string {
  const bytes: number[] = [];
  const push = (n: number) => {
    while (n >= 128) {
      bytes.push((n & 127) | 128);
      n >>>= 7;
    }
    bytes.push(n);
  };
  let value = 0;
  let run = 0;
  for (let i = 0; i < mask.length; i++) {
    if ((mask[i] ? 1 : 0) === value) run++;
    else {
      push(run);
      value ^= 1;
      run = 1;
    }
  }
  push(run);
  return RUNS + toBase64(Uint8Array.from(bytes));
}

function unpackRuns(text: string): Uint8Array {
  const bytes = fromBase64(text.slice(RUNS.length));
  const runs: number[] = [];
  let n = 0;
  let shift = 0;
  for (const b of bytes) {
    n |= (b & 127) << shift;
    if (b & 128) shift += 7;
    else {
      runs.push(n);
      n = 0;
      shift = 0;
    }
  }
  const total = runs.reduce((a, r) => a + r, 0);
  const mask = new Uint8Array(total);
  let i = 0;
  runs.forEach((r, k) => {
    if (k % 2) mask.fill(1, i, i + r);
    i += r;
  });
  return mask;
}

/** An old 500-cell mask on the current grid: each old cell becomes a square of cells. */
function scaleUp(old: Uint8Array): Uint8Array {
  const mask = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    const oy = Math.floor(y / GRID_SCALE) * OLD_GRID;
    for (let x = 0; x < GRID; x++) if (old[oy + Math.floor(x / GRID_SCALE)]) mask[y * GRID + x] = 1;
  }
  return mask;
}

const cache = new Map<string, Uint8Array>();

/** A stored line mask on the current grid — runs or packed bits, on this grid or the old one. */
export function unpackMask(packed: string): Uint8Array {
  const hit = cache.get(packed);
  if (hit) return hit;
  let mask: Uint8Array;
  if (packed.startsWith(RUNS)) mask = unpackRuns(packed);
  else {
    const bytes = fromBase64(packed);
    const cells = bytes.length * 8 >= GRID * GRID ? GRID * GRID : OLD_GRID * OLD_GRID;
    mask = new Uint8Array(cells);
    for (let i = 0; i < cells; i++) if (bytes[i >> 3] & (1 << (i & 7))) mask[i] = 1;
  }
  if (mask.length === OLD_GRID * OLD_GRID) mask = scaleUp(mask);
  else if (mask.length !== GRID * GRID) mask = new Uint8Array(GRID * GRID);
  if (cache.size > 12) cache.clear();
  cache.set(packed, mask);
  return mask;
}

/** Packed (bit) length for a full grid of the current size. */
export const PACKED_LENGTH = Math.ceil(Math.ceil((GRID * GRID) / 8) / 3) * 4;

const wallCache = new Map<string, Uint8Array>();

/**
 * A picture's lines thickened to close small gaps — what keeps one part from
 * leaking into the next. Worked out from its real lines and gap setting (an
 * older picture stored them ready-made). Null when the picture has neither.
 */
export function pictureWalls(picture: Pick<PaintPicture, "raw" | "walls" | "gap">): Uint8Array | null {
  // An older picture stored its thickened lines ready-made: they are what its steps were made on.
  if (picture.walls) return unpackMask(picture.walls);
  if (picture.raw) {
    const key = `${picture.gap ?? 0}|${picture.raw}`;
    let w = wallCache.get(key);
    if (!w) {
      w = closeGaps(unpackMask(picture.raw), picture.gap ?? 0);
      if (wallCache.size > 8) wallCache.clear();
      wallCache.set(key, w);
    }
    return w;
  }
  return null;
}

/* ------------------------------------------------------------------ lines */

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * RGBA pixels of the fitted square (SIDE×SIDE) → the line mask on the grid and
 * the line pixels (alpha only) for the PNG. Pure.
 */
export function findLines(pixels: Uint8ClampedArray, strength: number): { mask: Uint8Array; alpha: Uint8Array } {
  const alpha = new Uint8Array(SIDE * SIDE);
  const mask = new Uint8Array(GRID * GRID);
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const p = (y * SIDE + x) * 4;
      if (pixels[p + 3] < 128) continue;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      const l = lum(r, g, b);
      // Faint pencil lines count; a coloured fill (a yellow hat, an orange shirt) does not.
      if (l >= strength || (Math.max(r, g, b) - Math.min(r, g, b) > GREY && l > VERY_DARK)) continue;
      // Darker = more opaque, with a soft edge near the strength so lines stay smooth.
      alpha[y * SIDE + x] = Math.min(255, Math.round(255 * Math.min(1, (strength - l) / 40 + 0.35)));
      mask[Math.floor(y / PX) * GRID + Math.floor(x / PX)] = 1;
    }
  }
  return { mask, alpha };
}

/** Grow every line by `gap` old-grid cells (2 units each, a round brush), sealing breaks up to about twice that wide. */
export function closeGaps(mask: Uint8Array, gap: number): Uint8Array {
  if (gap <= 0) return mask;
  const r = Math.round(gap * GRID_SCALE);
  const out = mask.slice();
  const offsets: [number, number][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offsets.push([dx, dy]);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!mask[y * GRID + x]) continue;
      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GRID && ny < GRID) out[ny * GRID + nx] = 1;
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------- colours */

/** Weighted RGB distance ("redmean"), squared: close enough to how eyes judge colours. */
function distance(a: [number, number, number], b: [number, number, number]): number {
  const rm = (a[0] + b[0]) / 2;
  return (2 + rm / 256) * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + (2 + (255 - rm) / 256) * (a[2] - b[2]) ** 2;
}

/** Closer than this to a crayon, a colour is that crayon; further, the picture's own colour is kept. */
const NEAR_CRAYON = 1500;

/** The crayon nearest to a colour, or null for white/paper (light and grey). */
export function crayonFor(r: number, g: number, b: number): string | null {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (lum(r, g, b) > 215 && max - min < 40) return null;
  let best = PALETTE[0].id;
  let bestD = Infinity;
  for (const c of PALETTE) {
    const d = distance([r, g, b], rgb(c.hex));
    if (d < bestD) [bestD, best] = [d, c.id];
  }
  return best;
}

/** Each part's average colour in the picture (RGBA, SIDE×SIDE). */
export function areaColours(pixels: Uint8ClampedArray, areas: Areas): [number, number, number][] {
  const sum = areas.sizes.map(() => [0, 0, 0, 0]);
  for (let i = 0; i < areas.labels.length; i++) {
    const l = areas.labels[i];
    if (l < 0) continue;
    const x = Math.floor((i % GRID) * PX);
    const y = Math.floor(Math.floor(i / GRID) * PX);
    const p = (y * SIDE + x) * 4;
    const s = sum[l];
    s[0] += pixels[p];
    s[1] += pixels[p + 1];
    s[2] += pixels[p + 2];
    s[3]++;
  }
  return sum.map(([r, g, b, n]) => (n ? [r / n, g / n, b / n] : [255, 255, 255]));
}

/**
 * A point well inside each of these parts: its cell nearest the part's centre.
 * Two passes over the grid for any number of parts — one per part would be a
 * million cells each.
 */
export function insidePoints(areas: Areas, labels: Iterable<number>): Map<number, Point> {
  const want = new Set(labels);
  const sum = new Map<number, { x: number; y: number; n: number; best: number; d: number }>();
  for (const l of want) sum.set(l, { x: 0, y: 0, n: 0, best: -1, d: Infinity });
  for (let i = 0; i < areas.labels.length; i++) {
    const s = sum.get(areas.labels[i]);
    if (!s) continue;
    s.x += i % GRID;
    s.y += Math.floor(i / GRID);
    s.n++;
  }
  for (const s of sum.values()) if (s.n) [s.x, s.y] = [s.x / s.n, s.y / s.n];
  for (let i = 0; i < areas.labels.length; i++) {
    const s = sum.get(areas.labels[i]);
    if (!s) continue;
    const d = (i % GRID - s.x) ** 2 + (Math.floor(i / GRID) - s.y) ** 2;
    if (d < s.d) [s.d, s.best] = [d, i];
  }
  const cell = 1000 / GRID;
  const out = new Map<number, Point>();
  for (const [l, s] of sum) if (s.best >= 0) out.set(l, { x: Math.round(((s.best % GRID) + 0.5) * cell), y: Math.round((Math.floor(s.best / GRID) + 0.5) * cell) });
  return out;
}

/** A point well inside one part. */
export const insidePoint = (areas: Areas, label: number): Point => insidePoints(areas, [label]).get(label) ?? { x: 500, y: 500 };

/**
 * Steps from a coloured example: one step per crayon, its parts the ones
 * painted that colour. Biggest first — a child colours the big parts first.
 * White parts and specks make no step.
 */
export function stepsFromColours(colours: [number, number, number][], areas: Areas, newId: () => string): PaintStep[] {
  const groups = new Map<string, { labels: number[]; size: number; sum: [number, number, number] }>();
  colours.forEach(([r, g, b], l) => {
    if (areas.sizes[l] < SPECK) return;
    const crayon = crayonFor(r, g, b);
    if (!crayon) return;
    const gr = groups.get(crayon) ?? { labels: [], size: 0, sum: [0, 0, 0] };
    const n = areas.sizes[l];
    gr.labels.push(l);
    gr.size += n;
    gr.sum = [gr.sum[0] + r * n, gr.sum[1] + g * n, gr.sum[2] + b * n];
    groups.set(crayon, gr);
  });
  const points = insidePoints(areas, [...groups.values()].flatMap((g) => g.labels));
  return [...groups.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([crayon, gr]) => {
      // The crayon when it is close; otherwise the picture's own colour (a pale orange stays pale orange).
      const avg: [number, number, number] = [gr.sum[0] / gr.size, gr.sum[1] / gr.size, gr.sum[2] / gr.size];
      const exact = distance(avg, rgb(PALETTE.find((c) => c.id === crayon)!.hex)) > NEAR_CRAYON;
      return { id: newId(), color: exact ? toHex(...avg) : crayon, seeds: gr.labels.map((l) => points.get(l)!) };
    });
}

/** How many real parts a picture splits into (specks left out). */
export const partCount = (areas: Areas) => areas.sizes.filter((s) => s >= SPECK).length;

/**
 * The magic pen: a picture's lines redrawn as smooth strokes. The gap-closed
 * line mask is thinned to its centre line, which joins dashes and evens out
 * wobbly edges, then fitted to curves. Specks too short to be a line are dropped.
 */
export function smoothLines(on: Uint8Array, newId: () => string): Stroke[] {
  const list = pieces({ w: GRID, h: GRID, on }, { minSpur: 0.012, minLength: 14 });
  return strokesFromPlan(list, readingOrder(list), newId, 2.5).map((s) => ({ ...s, width: 30 }));
}

/* ------------------------------------------------------- canvas (Studio) */

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** The picture fitted (contain, centred) into the white SIDE×SIDE square. */
export function fittedPixels(img: HTMLImageElement): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = c.height = SIDE;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIDE, SIDE);
  const k = Math.min(SIDE / img.naturalWidth, SIDE / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, (SIDE - w) / 2, (SIDE - h) / 2, w, h);
  return ctx.getImageData(0, 0, SIDE, SIDE).data;
}

/** The child's line art: the found lines in ink, on transparent, as a PNG. */
export function linesPng(alpha: Uint8Array, ink = "#1f2544"): string {
  const c = document.createElement("canvas");
  c.width = c.height = SIDE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(SIDE, SIDE);
  const [r, g, b] = rgb(ink);
  for (let i = 0; i < alpha.length; i++) {
    if (!alpha[i]) continue;
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = alpha[i];
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/** The picture with the rubbed-out marks painted white, so they are never lines. Pure. */
export function applyErase(pixels: Uint8ClampedArray, erase: readonly EraseMark[] = []): Uint8ClampedArray {
  if (erase.length === 0) return pixels;
  const out = pixels.slice();
  const k = SIDE / 1000;
  const dab = (cx: number, cy: number, r: number) => {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(SIDE - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(SIDE - 1, Math.ceil(cx + r)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const p = (y * SIDE + x) * 4;
        out[p] = out[p + 1] = out[p + 2] = out[p + 3] = 255;
      }
    }
  };
  for (const m of erase) {
    const r = m.r * k;
    m.points.forEach((q, i) => {
      const a = m.points[Math.max(0, i - 1)];
      const n = Math.max(1, Math.ceil((Math.hypot(q.x - a.x, q.y - a.y) * k) / Math.max(1, r / 2)));
      for (let s = 0; s <= n; s++) dab((a.x + ((q.x - a.x) * s) / n) * k, (a.y + ((q.y - a.y) * s) / n) * k, r);
    });
  }
  return out;
}

/** Picture → what a colouring item keeps: its line art and its line mask. */
export function pictureFrom(pixels: Uint8ClampedArray, strength: number, gap = DEFAULT_GAP, erase: EraseMark[] = []): PaintPicture {
  const { mask, alpha } = findLines(applyErase(pixels, erase), strength);
  // Only the real lines are kept; the thickened ones are worked out when the picture is read (`pictureWalls`).
  return { lines: linesPng(alpha), raw: packRuns(mask), strength, gap, ...(erase.length ? { erase } : {}) };
}

/** An uploaded file, shrunk so a draft stays small, as a JPEG data URL. */
export function readFile(file: File, max = 1000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = async () => {
      try {
        const img = await loadImage(String(reader.result));
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.9));
      } catch (e) {
        reject(e);
      }
    };
    reader.readAsDataURL(file);
  });
}
