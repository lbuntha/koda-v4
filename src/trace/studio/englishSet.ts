/**
 * First-draft strokes for the English collections: A–Z, a–z and 0–9.
 *
 * Hand-made so the stroke ORDER is the one taught in school print (top to
 * bottom, left to right, rounds counter-clockwise from the top right, dots and
 * crossbars last). The Studio fills an empty draft from here before it falls
 * back to tracing the typed letter; the author then shapes and test-writes it.
 *
 * Geometry follows the item's `baseline-4-lines` grid (0–1000 square):
 * top 250, middle 450, baseline 650, bottom 850. Capitals and digits span
 * top → baseline; small letters span middle → baseline, with ascenders to the
 * top line and descenders to the bottom line.
 */

import { makeStroke } from "../fixtures/items";
import type { Stroke } from "../geometry/types";

const TOP = 250;
const MID = 450;
const BASE = 650;

type P = [number, number];
interface Piece {
  pts: P[];
  smooth?: boolean;
  closed?: boolean;
  /** One motion with the stroke before it (a corner the pen turns without lifting). */
  go?: boolean;
  /** A dot: the point is its centre. */
  dot?: boolean;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Points round an ellipse, angles counter-clockwise from 3 o'clock as seen on screen. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, step = 40): P[] {
  const out: P[] = [];
  const dir = to >= from ? 1 : -1;
  for (let a = from; dir > 0 ? a < to : a > to; a += dir * step) out.push([Math.round(cx + rx * Math.cos(rad(a))), Math.round(cy - ry * Math.sin(rad(a)))]);
  out.push([Math.round(cx + rx * Math.cos(rad(to))), Math.round(cy - ry * Math.sin(rad(to)))]);
  return out;
}

/** A closed round: `ccw` from the given angle, or clockwise when `ccw` is false. */
function round(cx: number, cy: number, rx: number, ry: number, start: number, ccw = true): Piece {
  const pts = arc(cx, cy, rx, ry, start, start + (ccw ? 315 : -315), 45);
  return { pts, closed: true, smooth: true };
}

const line = (...pts: P[]): Piece => ({ pts });
const curve = (...pts: P[]): Piece => ({ pts, smooth: true });
const bend = (...pts: P[]): Piece => ({ pts });
const dot = (x: number, y: number): Piece => ({ pts: [[x, y]], dot: true });
const goOn = (p: Piece): Piece => ({ ...p, go: true });

/** The first stroke of "p", "b" and friends sits on the left; a bowl starts on that stem. */
const bowl = (cx: number, cy = 550, rx = 90, ry = 100) => round(cx, cy, rx, ry, 45);

const SET: Record<string, Piece[]> = {
  // --- capitals ---
  A: [line([500, TOP], [335, BASE]), line([500, TOP], [665, BASE]), line([393, 520], [607, 520])],
  B: [
    line([350, TOP], [350, BASE]),
    curve([350, TOP], [470, 252], [560, 300], [545, 375], [470, 445], [350, 450]),
    curve([350, 450], [490, 452], [590, 520], [565, 605], [485, 648], [350, BASE]),
  ],
  C: [curve(...arc(520, 450, 205, 200, 40, 320))],
  D: [line([340, TOP], [340, BASE]), curve([340, TOP], [470, 252], [580, 330], [610, 450], [580, 570], [470, 648], [340, BASE])],
  E: [line([350, TOP], [350, BASE]), line([350, TOP], [620, TOP]), line([350, 450], [580, 450]), line([350, BASE], [620, BASE])],
  F: [line([360, TOP], [360, BASE]), line([360, TOP], [630, TOP]), line([360, 450], [590, 450])],
  G: [curve(...arc(510, 450, 200, 200, 40, 360)), line([550, 450], [700, 450])],
  H: [line([340, TOP], [340, BASE]), line([660, TOP], [660, BASE]), line([340, 450], [660, 450])],
  I: [line([500, TOP], [500, BASE])],
  J: [curve([580, TOP], [580, 530], [535, 625], [455, 645], [390, 600])],
  K: [line([350, TOP], [350, BASE]), line([650, TOP], [350, 470]), line([430, 415], [660, BASE])],
  L: [line([380, TOP], [380, BASE]), line([380, BASE], [620, BASE])],
  M: [line([320, TOP], [320, BASE]), line([320, TOP], [500, 510]), line([500, 510], [680, TOP]), line([680, TOP], [680, BASE])],
  N: [line([340, TOP], [340, BASE]), line([340, TOP], [660, BASE]), line([660, TOP], [660, BASE])],
  O: [round(500, 450, 190, 200, 60)],
  P: [line([350, TOP], [350, BASE]), curve([350, TOP], [480, 252], [580, 310], [580, 390], [480, 448], [350, 450])],
  Q: [round(500, 450, 190, 200, 60), line([540, 540], [690, 690])],
  R: [line([350, TOP], [350, BASE]), curve([350, TOP], [480, 252], [580, 310], [580, 390], [480, 448], [350, 450]), line([470, 450], [650, BASE])],
  S: [curve([610, 310], [550, 262], [470, 252], [395, 285], [385, 355], [440, 415], [520, 455], [600, 505], [620, 575], [570, 635], [490, 652], [400, 640], [360, 590])],
  T: [line([350, TOP], [650, TOP]), line([500, TOP], [500, BASE])],
  U: [curve([340, TOP], [340, 520], [400, 625], [500, BASE], [600, 625], [660, 520], [660, TOP])],
  V: [line([340, TOP], [500, BASE]), line([500, BASE], [660, TOP])],
  W: [line([270, TOP], [385, BASE]), line([385, BASE], [500, 330]), line([500, 330], [615, BASE]), line([615, BASE], [730, TOP])],
  X: [line([340, TOP], [660, BASE]), line([660, TOP], [340, BASE])],
  Y: [line([340, TOP], [500, 460]), line([660, TOP], [500, 460]), line([500, 460], [500, BASE])],
  Z: [line([340, TOP], [660, TOP]), line([660, TOP], [340, BASE]), line([340, BASE], [660, BASE])],

  // --- small letters ---
  a: [bowl(480), line([570, MID], [570, BASE])],
  b: [line([400, TOP], [400, BASE]), round(490, 550, 90, 100, 180, false)],
  c: [curve(...arc(510, 550, 95, 100, 40, 320))],
  d: [bowl(520), line([610, TOP], [610, BASE])],
  e: [line([405, 550], [595, 550]), goOn(curve(...arc(500, 550, 95, 100, 0, 320)))],
  f: [curve([590, 300], [540, 255], [480, 260], [450, 320], [450, BASE]), line([370, 450], [560, 450])],
  g: [bowl(480), curve([570, MID], [570, 740], [530, 815], [450, 845], [385, 810])],
  h: [line([400, TOP], [400, BASE]), curve([400, 520], [440, 465], [500, 450], [560, 470], [590, 530], [590, BASE])],
  i: [line([500, MID], [500, BASE]), dot(500, 340)],
  j: [curve([520, MID], [520, 770], [480, 835], [420, 845], [380, 820]), dot(520, 340)],
  k: [line([400, TOP], [400, BASE]), line([580, MID], [400, 570]), line([470, 520], [600, BASE])],
  l: [line([500, TOP], [500, BASE])],
  m: [
    line([350, MID], [350, BASE]),
    curve([350, 520], [380, 465], [430, 450], [480, 470], [500, 530], [500, BASE]),
    curve([500, 520], [530, 465], [580, 450], [630, 470], [650, 530], [650, BASE]),
  ],
  n: [line([400, MID], [400, BASE]), curve([400, 520], [440, 465], [500, 450], [560, 470], [590, 530], [590, BASE])],
  o: [round(500, 550, 95, 100, 60)],
  p: [line([400, MID], [400, 850]), round(490, 550, 90, 100, 180, false)],
  q: [bowl(480), line([570, MID], [570, 850])],
  r: [line([420, MID], [420, BASE]), curve([420, 540], [450, 480], [500, 452], [560, 460])],
  s: [curve([575, 485], [530, 452], [465, 452], [420, 485], [435, 525], [500, 550], [565, 580], [580, 620], [535, 648], [470, 652], [415, 625])],
  t: [curve([480, 310], [480, 610], [500, 645], [550, 648], [580, 630]), line([390, MID], [580, MID])],
  u: [curve([400, MID], [400, 590], [450, 645], [510, 648], [590, 600]), line([600, MID], [600, BASE])],
  v: [line([400, MID], [500, BASE]), line([500, BASE], [600, MID])],
  w: [line([340, MID], [420, BASE]), line([420, BASE], [500, 490]), line([500, 490], [580, BASE]), line([580, BASE], [660, MID])],
  x: [line([410, MID], [590, BASE]), line([590, MID], [410, BASE])],
  y: [line([400, MID], [500, BASE]), curve([610, MID], [500, 670], [440, 800], [385, 850])],
  z: [line([410, MID], [590, MID]), line([590, MID], [410, BASE]), line([410, BASE], [590, BASE])],

  // --- numbers ---
  "0": [round(500, 450, 150, 200, 60)],
  "1": [bend([400, 330], [500, TOP], [500, BASE])],
  "2": [curve([365, 340], [420, 272], [500, TOP], [580, 275], [615, 340], [585, 415], [490, 520], [350, BASE]), goOn(line([350, BASE], [650, BASE]))],
  "3": [curve([370, 300], [430, 258], [510, TOP], [580, 285], [590, 350], [540, 410], [470, 440], [545, 470], [610, 530], [600, 605], [540, 645], [450, BASE], [370, 610])],
  "4": [bend([560, TOP], [340, 530], [690, 530]), line([560, TOP], [560, BASE])],
  "5": [line([400, TOP], [385, 450]), curve([385, 450], [470, 425], [560, 440], [620, 510], [610, 590], [550, 640], [460, BASE], [380, 620]), line([400, TOP], [610, TOP])],
  "6": [curve([580, 280], [510, TOP], [440, 290], [390, 380], [370, 490], [385, 590], [450, 645], [530, 640], [590, 590], [590, 520], [540, 470], [470, 470], [400, 510])],
  "7": [line([350, TOP], [650, TOP]), goOn(line([650, TOP], [450, BASE]))],
  "8": [round(500, 350, 105, 100, 90), round(500, 550, 125, 100, 90)],
  "9": [round(500, 360, 130, 110, 60), curve([630, 360], [625, 500], [580, 600], [500, 648], [420, 640])],
};

/** Whether a hand-made draft exists for this character. */
export const hasEnglishStrokes = (title: string): boolean => Object.hasOwn(SET, title);

/** The guide letter's size and baseline so it sits on the 4-lines grid like the strokes do. */
export function englishGuide(title: string): { size: number; y: number } {
  const small = /^[a-z]$/.test(title);
  // Size is the font size in the 0–1000 square: capitals and digits are ~0.7 of it tall, small letters' bodies ~0.5.
  return { size: small ? 400 : 570, y: BASE };
}

/** Strokes for a character, or null when it is not in the set. */
export function englishStrokes(title: string, newId: () => string): Stroke[] | null {
  const pieces = SET[title];
  if (!pieces) return null;
  return pieces.map((p, i) =>
    makeStroke(newId(), i + 1, p.pts, {
      ...(p.dot ? { shape: "dot" as const, radius: 28 } : p.closed ? { shape: "loop" as const, closed: true } : p.pts.length > 2 && !p.smooth ? { shape: "line" as const } : {}),
      smooth: p.smooth,
      join: p.go ? "continue" : "lift",
    }),
  );
}
