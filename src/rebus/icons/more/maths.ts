/**
 * Drawings for math questions: shapes, dice, ten-frames, fractions, clocks,
 * tally marks, arrays, angles, grids, thermometers and rulers.
 *
 * Most of these are the same drawing with a number changed, so they are built
 * by small functions instead of drawn one by one: a clock for any time, a
 * fraction for any slice. Only the ones a question uses are listed (see
 * `MATH_ART` at the bottom), because every drawing must be used by something.
 */

import { PAL as P, circle, ellipse, line, path, rect } from "../draw";

const f1 = (n: number): string => n.toFixed(1);
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** A regular polygon's corners, starting at the top unless turned. */
const polygon = (sides: number, cx: number, cy: number, r: number, turn = 0): string =>
  Array.from({ length: sides }, (_, i) => {
    const a = -Math.PI / 2 + turn + (i / sides) * Math.PI * 2;
    return `${i === 0 ? "M" : "L"}${f1(cx + r * Math.cos(a))} ${f1(cy + r * Math.sin(a))}`;
  }).join("") + "Z";

// ---- flat and solid shapes --------------------------------------------------

const SHAPES: Record<string, string> = {
  "shape-triangle": path("M32 7L58 55H6z", P.sky, P.navy),
  "shape-square": rect(10, 10, 44, 44, P.rose, 2, P.darkRed),
  "shape-rectangle": rect(5, 18, 54, 28, P.green, 2, P.darkGreen),
  "shape-circle": circle(32, 32, 25, P.orange, P.deepOrange),
  "shape-pentagon": path(polygon(5, 32, 35, 27), P.violet, P.indigo),
  "shape-hexagon": path(polygon(6, 32, 32, 27, Math.PI / 6), P.emerald, P.darkGreen),
  "shape-octagon": path(polygon(8, 32, 32, 27, Math.PI / 8), P.pink, P.rose),
  "shape-diamond": path("M32 5L57 32L32 59L7 32z", P.lav, P.indigo),
  "shape-oval": ellipse(32, 32, 27, 17, P.peach, P.deepOrange),
  "shape-cylinder":
    path("M12 18v28c0 6 9 10 20 10s20-4 20-10V18z", P.sky, P.navy) + ellipse(32, 18, 20, 8, P.ice, P.navy),
  "shape-pyramid": path("M32 6L58 50L32 58L6 50z", P.orange, P.deepOrange) + path("M32 6L58 50L32 58z", P.peach, P.deepOrange),
  "shape-sphere": circle(32, 32, 25, P.rose, P.darkRed) + path("M16 24c2-8 8-12 14-12", "none", P.pink).replace('stroke-width="2"', 'stroke-width="4"'),
  "shape-cone": path("M32 6L54 46c0 6-10 10-22 10S10 52 10 46z", P.green, P.darkGreen) + ellipse(32, 46, 22, 8, P.emerald, P.darkGreen),
  "shape-cuboid": path("M6 22h40v32H6z", P.violet, P.indigo) + path("M6 22l12-12h40L46 22z", P.lav, P.indigo) + path("M46 22l12-12v32L46 54z", P.indigo, P.navy),
};

// ---- dice, and ten-frames ----------------------------------------------------

const DOTS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[32, 32]],
  2: [[20, 20], [44, 44]],
  3: [[18, 18], [32, 32], [46, 46]],
  4: [[20, 20], [44, 20], [20, 44], [44, 44]],
  5: [[18, 18], [46, 18], [32, 32], [18, 46], [46, 46]],
  6: [[20, 16], [44, 16], [20, 32], [44, 32], [20, 48], [44, 48]],
};

const die = (n: number): string => rect(6, 6, 52, 52, P.white, 9, P.mid) + DOTS[n].map(([x, y]) => circle(x, y, 5, P.ink)).join("");

const tenFrame = (n: number): string => {
  const cells = Array.from({ length: 10 }, (_, i) => rect(6 + (i % 5) * 10.4, 19 + Math.floor(i / 5) * 14, 10.4, 14, "none", 0, P.mid)).join("");
  const dots = Array.from({ length: n }, (_, i) => circle(11.2 + (i % 5) * 10.4, 26 + Math.floor(i / 5) * 14, 4, P.rose)).join("");
  return rect(6, 19, 52, 28, P.white, 0) + cells.replace(/stroke-width="2"/g, 'stroke-width="1.5"') + dots;
};

// ---- fractions ----------------------------------------------------------------

/** A circle cut into `n` equal slices with the first `k` coloured. */
const pie = (k: number, n: number): string => {
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return `${f1(32 + 25 * Math.cos(a))} ${f1(32 + 25 * Math.sin(a))}`;
  };
  const slice = (i: number) => `M32 32L${at(i)}A25 25 0 ${1 / n > 0.5 ? 1 : 0} 1 ${at(i + 1)}z`;
  const shaded = Array.from({ length: k }, (_, i) => path(slice(i), P.sky)).join("");
  const cuts = Array.from({ length: n }, (_, i) => line(`M32 32L${at(i)}`, P.navy, 2)).join("");
  return circle(32, 32, 25, P.white) + shaded + (n > 1 ? cuts : "") + circle(32, 32, 25, "none", P.navy).replace('stroke-width="2"', 'stroke-width="2.5"');
};

// ---- clocks ---------------------------------------------------------------------

const hand = (angle: number, length: number, width: number, colour: string): string => {
  const a = ((angle - 90) * Math.PI) / 180;
  return line(`M32 32L${f1(32 + length * Math.cos(a))} ${f1(32 + length * Math.sin(a))}`, colour, width);
};

const clock = (h: number, m: number): string => {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return line(`M${f1(32 + 25.5 * Math.sin(a))} ${f1(32 - 25.5 * Math.cos(a))}L${f1(32 + 28 * Math.sin(a))} ${f1(32 - 28 * Math.cos(a))}`, P.indigo, i % 3 === 0 ? 3 : 1.6);
  }).join("");
  const nums = Array.from({ length: 12 }, (_, i) => {
    const n = i === 0 ? 12 : i;
    const a = (n / 12) * Math.PI * 2;
    return `<text x="${f1(32 + 20 * Math.sin(a))}" y="${f1(32 - 20 * Math.cos(a) + 2.6)}" font-size="7.5" font-weight="800" text-anchor="middle" fill="${P.ink}" font-family="system-ui,sans-serif">${n}</text>`;
  }).join("");
  return (
    circle(32, 32, 30, P.white, P.indigo).replace('stroke-width="2"', 'stroke-width="3"') +
    ticks +
    nums +
    hand(((h % 12) + m / 60) * 30, 10, 4.5, P.ink) +
    hand(m * 6, 15, 3, P.rose) +
    circle(32, 32, 2.6, P.ink)
  );
};

// ---- counting aids ----------------------------------------------------------------

/** Tally marks in fives: four strokes crossed by a fifth. */
const tally = (n: number): string => {
  const groups = Math.ceil(n / 5);
  let svg = "";
  for (let g = 0; g < groups; g++) {
    const count = Math.min(5, n - g * 5);
    const ox = 5 + (g % 2) * 29;
    const oy = 5 + Math.floor(g / 2) * 29;
    const strokes = Math.min(count, 4);
    for (let i = 0; i < strokes; i++) svg += line(`M${ox + 3 + i * 6} ${oy}v22`, P.ink, 2.6);
    if (count === 5) svg += line(`M${ox - 1} ${oy + 19}L${ox + 25} ${oy + 3}`, P.rose, 2.6);
  }
  return svg;
};

/** `rows` × `cols` dots, for seeing a times table. */
const dotArray = (rows: number, cols: number): string => {
  const s = Math.min(50 / cols, 50 / rows);
  const ox = 32 - (s * (cols - 1)) / 2;
  const oy = 32 - (s * (rows - 1)) / 2;
  return Array.from({ length: rows * cols }, (_, i) => circle(r1(ox + (i % cols) * s), r1(oy + Math.floor(i / cols) * s), r1(Math.min(s * 0.36, 6)), i % 2 === 0 ? P.sky : P.violet)).join("");
};

/** A rectangle of unit squares, for area and perimeter. */
const grid = (rows: number, cols: number): string => {
  const c = Math.floor(54 / Math.max(rows, cols));
  const ox = 32 - (c * cols) / 2;
  const oy = 32 - (c * rows) / 2;
  const cells = Array.from({ length: rows * cols }, (_, i) => rect(ox + (i % cols) * c, oy + Math.floor(i / cols) * c, c, c, P.ice, 0, P.navy)).join("");
  return cells.replace(/stroke-width="2"/g, 'stroke-width="1.5"');
};

/** An angle opened `deg` degrees, with its arc. */
const angle = (deg: number): string => {
  const a = (deg * Math.PI) / 180;
  // An open angle is drawn from further right, so its arm stays on the picture.
  const x0 = 14 + 34 * Math.max(0, -Math.cos(a));
  const ex = x0 + 34 * Math.cos(a);
  const ey = 50 - 34 * Math.sin(a);
  const arc = (r: number) => `${f1(x0 + r * Math.cos(a))} ${f1(50 - r * Math.sin(a))}`;
  return (
    path(`M${f1(x0)} 50L${f1(x0 + 14)} 50A14 14 0 0 0 ${arc(14)}z`, P.lav) +
    line(`M${f1(x0)} 50H58`, P.navy, 3.5) +
    line(`M${f1(x0)} 50L${f1(ex)} ${f1(ey)}`, P.navy, 3.5) +
    path(`M${f1(x0 + 14)} 50A14 14 0 0 0 ${arc(14)}`, "none", P.rose).replace('stroke-width="2"', 'stroke-width="3"') +
    circle(r1(x0), 50, 3, P.navy)
  );
};

// ---- measuring ----------------------------------------------------------------------

/** A thermometer showing `t` degrees, from -10 to 10, with 0 marked. */
const thermometer = (t: number): string => {
  const y = (v: number) => 44 - ((v + 10) / 20) * 36;
  const ticks = [-10, -5, 0, 5, 10].map((v) => line(`M38 ${f1(y(v))}h${v === 0 ? 10 : 6}`, v === 0 ? P.darkRed : P.mid, v === 0 ? 2.5 : 1.8)).join("");
  return (
    rect(26, 4, 12, 44, P.white, 6, P.mid) +
    circle(32, 52, 9, P.red, P.darkRed) +
    rect(29.5, r1(y(t)), 5, r1(48 - y(t)), P.red, 2) +
    ticks
  );
};

/** A pencil lying along a ruler, `cm` long, for reading a length. */
const measure = (cm: number): string => {
  const step = 5.2;
  const x0 = 6;
  const ticks = Array.from({ length: 11 }, (_, i) => line(`M${f1(x0 + i * step)} 40v${i % 5 === 0 ? 9 : 5}`, P.navy, 1.6)).join("");
  const num = (t: string, x: number) => `<text x="${x}" y="58" font-size="7" font-weight="800" text-anchor="middle" fill="${P.ink}" font-family="system-ui,sans-serif">${t}</text>`;
  return (
    rect(2, 38, 60, 14, P.sky, 2, P.navy) + ticks + num("0", x0) + num("5", x0 + 5 * step) + num("10", x0 + 10 * step) +
    path(`M${x0} 16h${f1(cm * step - 7)}l7 5-7 5H${x0}z`, P.orange, P.deepOrange) +
    line(`M${f1(x0 + cm * step)} 14v22`, P.rose, 1.8)
  );
};

// ---- what is on offer ------------------------------------------------------------------

/** Fractions shown as slices of a circle: (shaded, parts). */
export const FRACTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [1, 3], [2, 3], [1, 4], [2, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 6], [5, 6], [1, 8], [3, 8], [5, 8],
];
/** Clock times: every hour and half past, and a quarter past or quarter to for every hour (one or the other, so each hour has one). */
export const CLOCK_TIMES: ReadonlyArray<readonly [number, number]> = Array.from({ length: 12 }, (_, i) => i + 1).flatMap((h) => [
  [h, 0] as const,
  [h, 30] as const,
  [h, h % 2 === 1 ? 15 : 45] as const,
]);
export const TALLIES = [6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19] as const;
export const ARRAYS: ReadonlyArray<readonly [number, number]> = [[2, 3], [2, 4], [2, 5], [3, 3], [3, 4], [3, 5], [4, 4], [4, 5], [5, 5], [2, 6], [3, 6], [4, 6]];
export const GRIDS: ReadonlyArray<readonly [number, number]> = [[2, 2], [2, 3], [2, 4], [2, 5], [3, 3], [3, 4], [3, 5], [4, 4], [4, 5], [3, 6], [4, 6], [5, 5], [2, 6]];
export const ANGLES = [30, 45, 60, 90, 120, 135, 150] as const;
export const THERMOS = [-10, -8, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 8, 10] as const;
export const LENGTHS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

const pad = (m: number): string => String(m).padStart(2, "0");

export const MATH_ART: Record<string, string> = {
  ...SHAPES,
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`dice-${n}`, die(n)])),
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [`frame-${n}`, tenFrame(n)])),
  ...Object.fromEntries(FRACTIONS.map(([k, n]) => [`frac-${k}-${n}`, pie(k, n)])),
  ...Object.fromEntries(CLOCK_TIMES.map(([h, m]) => [`clock-${h}-${pad(m)}`, clock(h, m)])),
  ...Object.fromEntries(TALLIES.map((n) => [`tally-${n}`, tally(n)])),
  ...Object.fromEntries(ARRAYS.map(([r, c]) => [`array-${r}x${c}`, dotArray(r, c)])),
  ...Object.fromEntries(GRIDS.map(([r, c]) => [`grid-${r}x${c}`, grid(r, c)])),
  ...Object.fromEntries(ANGLES.map((d) => [`angle-${d}`, angle(d)])),
  ...Object.fromEntries(THERMOS.map((t) => [`thermo-${t < 0 ? `m${-t}` : t}`, thermometer(t)])),
  ...Object.fromEntries(LENGTHS.map((n) => [`length-${n}`, measure(n)])),
};

export const clockId = (h: number, m: number): string => `clock-${h}-${pad(m)}`;
export const thermoId = (t: number): string => `thermo-${t < 0 ? `m${-t}` : t}`;
