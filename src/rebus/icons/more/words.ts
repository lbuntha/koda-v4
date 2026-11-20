/**
 * Drawings for the Word Guess starter words: the everyday things, people and
 * feelings a young speller meets that the other files had no picture for.
 */

import { PAL as P, circle, ellipse, line, path, rect } from "../draw";

const swatch = (fill: string, outline?: string): string =>
  rect(10, 10, 44, 44, fill, 10, outline) + circle(22, 22, 4, P.white).replace("<circle", '<circle opacity=".5"');

/** A round face; the feeling is in the brows, the eyes and the mouth. */
const face = (inner: string, fill: string = P.peach): string => circle(32, 32, 24, fill, P.deepOrange) + inner;
const dotEyes = circle(24, 28, 2.8, P.ink) + circle(40, 28, 2.8, P.ink);
const smile = line("M22 38c5 7 15 7 20 0", P.ink, 3);
const frown = line("M22 44c5-6 15-6 20 0", P.ink, 3);
const flat = line("M24 41h16", P.ink, 3);
const blush = circle(18, 37, 3.5, P.pink) + circle(46, 37, 3.5, P.pink);

/** A standing person; `top` dresses the head (a hat, hair), `extra` adds what they hold. */
const person = (body: string, top = "", extra = "", skin: string = P.cream): string =>
  path("M18 58c0-12 6-20 14-20s14 8 14 20z", body) +
  circle(32, 24, 11, skin, P.tan) +
  circle(28, 24, 1.6, P.ink) +
  circle(36, 24, 1.6, P.ink) +
  line("M29 29c2 2 4 2 6 0", P.brown, 1.8) +
  top +
  extra;

export const WORDS: Record<string, string> = {
  /* ---- creatures ---- */
  butterfly:
    path("M32 30C22 12 8 14 10 26s14 10 22 6z", P.violet) +
    path("M32 30c10-18 24-16 22-4s-14 10-22 6z", P.violet) +
    path("M32 34c-8 2-18 6-16 14s12 2 16-10z", P.rose) +
    path("M32 34c8 2 18 6 16 14s-12 2-16-10z", P.rose) +
    ellipse(32, 34, 3, 14, P.ink) +
    line("M31 20l-4-8M33 20l4-8", P.ink, 2),
  crocodile:
    path("M4 36c6-8 20-10 34-8l18 2c4 1 4 7 0 8l-18 2c-14 2-28 2-34-4z", P.green) +
    line("M38 38l18-1", P.darkGreen, 2) +
    path("M12 30l3-5 3 5M20 28l3-5 3 5M28 27l3-5 3 5", P.darkGreen) +
    circle(44, 30, 2.4, P.ink) +
    rect(12, 42, 6, 8, P.green, 2) +
    rect(28, 42, 6, 8, P.green, 2),
  donkey:
    path("M14 30h30l4 10v14h-6V44H22v10h-6V40z", P.mid) +
    path("M44 32c0-10 4-16 10-16l2 4-4 2v14z", P.mid) +
    path("M48 18l-2-12 5 10M54 18l2-12-1 13", P.mid) +
    ellipse(54, 30, 4, 3, P.soft) +
    circle(51, 22, 1.8, P.ink) +
    line("M14 32l-6 12", P.mid, 3),
  lizard:
    path("M10 34c8-6 18-6 26-2 6 3 12 2 18-2 2-1 4 1 2 3-6 6-14 8-22 6-8-1-14 3-20 7-4 2-8-8-4-12z", P.emerald) +
    circle(50, 30, 1.8, P.ink) +
    line("M20 38l-4 8M30 36l2 10M24 30l-4-8M34 32l4-8", P.darkGreen, 2.5),
  snail:
    ellipse(30, 48, 24, 6, P.tan) +
    circle(32, 34, 16, P.peach, P.deepOrange) +
    path("M32 34m-9 0a9 9 0 1 0 9-9", "none", P.deepOrange) +
    line("M50 44l4-14M56 44l2-14", P.tan, 3) +
    circle(54, 29, 2.5, P.ink) +
    circle(58, 29, 2.5, P.ink),
  panda:
    circle(18, 16, 7, P.ink) +
    circle(46, 16, 7, P.ink) +
    circle(32, 34, 22, P.white, P.soft) +
    ellipse(24, 32, 6, 8, P.ink) +
    ellipse(40, 32, 6, 8, P.ink) +
    circle(24, 32, 2, P.white) +
    circle(40, 32, 2, P.white) +
    ellipse(32, 42, 4, 3, P.ink) +
    line("M28 48c2 2 6 2 8 0", P.ink, 2),
  rhinoceros:
    path("M8 30c4-10 18-12 32-10h10l8 8-4 8H42v16h-6V44H20v8h-6V42c-6-2-8-8-6-12z", P.mid) +
    path("M54 26l6-10-1 14z", P.pale, P.mid) +
    path("M46 22l2-6 3 6z", P.pale, P.mid) +
    circle(48, 28, 1.8, P.ink),

  /* ---- body ---- */
  face:
    circle(32, 32, 24, P.cream, P.tan) +
    path("M10 28c0-14 10-22 22-22s22 8 22 22c-6-8-12-12-22-12s-16 4-22 12z", P.darkBrown) +
    dotEyes +
    smile +
    blush,
  body:
    circle(32, 12, 8, P.cream, P.tan) +
    rect(22, 22, 20, 22, P.sky, 6) +
    line("M22 26l-8 14M42 26l8 14", P.cream, 5) +
    line("M27 44v14M37 44v14", P.navy, 6),
  brain:
    path("M14 34c-6-4-4-14 4-16 0-8 10-12 16-8 6-4 16 0 16 8 8 2 10 12 4 16 2 8-6 14-12 12-4 4-12 4-16 0-8 2-14-4-12-12z", P.pink, P.rose) +
    line("M32 14v34M22 22c4 4 4 8 0 12M42 22c-4 4-4 8 0 12M20 42c4-2 8-2 12 2M44 42c-4-2-8-2-12 2", P.rose, 2),

  /* ---- clothes ---- */
  shirt:
    path("M22 10l-14 8 6 12 6-3v29h24V27l6 3 6-12-14-8c-2 4-6 6-10 6s-8-2-10-6z", P.sky) +
    path("M26 10c2 4 4 6 6 6s4-2 6-6", "none", P.blue) +
    circle(32, 30, 1.6, P.navy) +
    circle(32, 38, 1.6, P.navy),
  pants: path("M18 8h28l4 50H38l-6-30-6 30H14z", P.navy) + rect(18, 8, 28, 6, P.blue, 1) + line("M32 14v12", P.blue, 2),
  scarf:
    path("M14 18c10-6 26-6 36 0l-2 10c-10-4-22-4-32 0z", P.rose) +
    path("M38 26l8 0 2 30-10-2z", P.rose) +
    line("M40 56v4M44 56v4M48 56v4", P.rose, 2) +
    line("M20 20v6M28 18v8M36 18v8M44 20v6", P.white, 2),
  glasses: circle(20, 34, 10, P.ice, P.ink) + circle(44, 34, 10, P.ice, P.ink) + line("M30 32c1-2 3-2 4 0M10 32L4 26M54 32l6-6", P.ink, 3),
  mask:
    path("M12 24c10-4 30-4 40 0v16c-6 8-34 8-40 0z", P.ice, P.sky) +
    line("M12 26L4 22M52 26l8-4M12 36L4 40M52 36l8 4", P.mid, 2) +
    line("M18 30h28M18 36h28", P.sky, 2),
  watch: rect(26, 4, 12, 56, P.indigo, 4) + circle(32, 32, 13, P.white, P.indigo) + line("M32 32v-8M32 32l6 3", P.ink, 2.5),
  button:
    circle(32, 32, 22, P.rose, P.darkRed) +
    circle(32, 32, 15, "none", P.darkRed) +
    circle(27, 27, 3, P.darkRed) +
    circle(37, 27, 3, P.darkRed) +
    circle(27, 37, 3, P.darkRed) +
    circle(37, 37, 3, P.darkRed),
  zip:
    rect(22, 4, 20, 56, P.lav, 3) +
    line("M32 4v40", P.indigo, 2) +
    line("M28 8h4M32 12h4M28 16h4M32 20h4M28 24h4M32 28h4M28 32h4M32 36h4M28 40h4", P.indigo, 2) +
    rect(27, 42, 10, 8, P.mid, 2) +
    rect(30, 50, 4, 8, P.mid, 2),

  /* ---- colours ---- */
  red: swatch(P.red),
  pink: swatch(P.pink),
  purple: swatch(P.violet),
  brown: swatch(P.brown),
  grey: swatch(P.mid),
  silver: swatch(P.soft, P.mid),
  tan: swatch(P.tan),
  colour:
    path("M32 8C16 8 6 20 6 32s10 24 24 24c4 0 6-3 4-6s0-6 4-6h6c8 0 14-6 14-14C58 18 46 8 32 8z", P.cream, P.brown) +
    circle(20, 28, 4.5, P.red) +
    circle(30, 18, 4.5, P.blue) +
    circle(42, 20, 4.5, P.green) +
    circle(48, 32, 4.5, P.violet) +
    circle(18, 42, 4.5, P.orange),

  /* ---- people ---- */
  kid: person(P.emerald, path("M21 22c0-10 22-10 22 0-4-3-8-4-11-4s-7 1-11 4z", P.darkBrown)),
  baby:
    ellipse(32, 46, 16, 12, P.ice) +
    circle(32, 26, 13, P.cream, P.tan) +
    path("M28 14c2-4 6-4 8 0", "none", P.brown) +
    line("M27 26h2M35 26h2", P.ink, 2) +
    circle(32, 32, 2.5, P.pink),
  family:
    path("M4 58c0-10 4-16 10-16s10 6 10 16z", P.indigo) +
    circle(14, 34, 7, P.cream, P.tan) +
    path("M40 58c0-10 4-16 10-16s10 6 10 16z", P.rose) +
    circle(50, 34, 7, P.cream, P.tan) +
    path("M43 32c0-8 14-8 14 0l-2 4-10 0z", P.darkBrown) +
    path("M24 58c0-7 3-11 8-11s8 4 8 11z", P.emerald) +
    circle(32, 41, 5.5, P.cream, P.tan),
  teacher: person(
    P.violet,
    path("M21 22c0-11 22-11 22 0-4-3-8-4-11-4s-7 1-11 4z", P.ink),
    rect(44, 34, 14, 10, P.white, 2, P.mid) + line("M47 38h8M47 41h6", P.mid, 1.5),
  ),
  doctor: person(P.ice, "", path("M28 38l4 8 4-8", P.white) + line("M26 40c0 8 4 10 6 10s6-2 6-10", P.mid, 2) + circle(32, 50, 3, P.mid)),
  nurse: person(P.sky, rect(22, 10, 20, 7, P.white, 2, P.soft) + line("M32 11v5M29.5 13.5h5", P.red, 1.8)),
  police: person(
    P.navy,
    path("M19 18h26l-2-8H21z", P.navy) + rect(18, 17, 28, 3, P.ink, 1) + circle(32, 13, 2, P.peach),
    circle(26, 46, 2.5, P.peach),
  ),
  farmer: person(P.green, path("M14 20h36l-8-4c-2-6-18-6-20 0z", P.tan, P.brown)),
  chef: person(P.white, path("M22 16c-6 0-6-10 2-8 2-6 14-6 16 0 8-2 8 8 2 8z", P.white, P.soft) + rect(23, 14, 18, 4, P.white, 1, P.soft)),

  /* ---- feelings ---- */
  happy: face(dotEyes + line("M20 38c6 10 18 10 24 0z", P.ink, 3) + blush),
  sad: face(dotEyes + frown + path("M40 33c-2 4-2 6 0 7s2-3 0-7z", P.sky)),
  angry: face(dotEyes + line("M18 20l10 4M46 20l-10 4", P.ink, 3) + frown, P.orange),
  scared: face(
    circle(24, 28, 4, P.white, P.ink) +
      circle(40, 28, 4, P.white, P.ink) +
      circle(24, 28, 1.6, P.ink) +
      circle(40, 28, 1.6, P.ink) +
      ellipse(32, 43, 5, 6, P.ink),
  ),
  tired: face(line("M19 29h10M35 29h10", P.ink, 3) + flat + path("M50 12h6l-6 6h6", "none", P.indigo)),
  shy: face(
    line("M20 28c2-2 6-2 8 0M36 28c2-2 6-2 8 0", P.ink, 3) +
      line("M27 40c3 2 7 2 10 0", P.ink, 3) +
      circle(18, 36, 5, P.pink) +
      circle(46, 36, 5, P.pink),
  ),
  calm: face(line("M20 29c2 2 6 2 8 0M36 29c2 2 6 2 8 0", P.ink, 3) + smile),
  sick: face(dotEyes + flat + rect(36, 44, 18, 4, P.white, 2, P.mid) + rect(50, 44, 4, 4, P.red, 1), P.lav),
  hungry: face(dotEyes + ellipse(32, 42, 7, 5, P.ink) + path("M28 44c2 6 8 6 8 0", P.rose)),
  proud: face(
    line("M20 29c2-2 6-2 8 0M36 29c2-2 6-2 8 0", P.ink, 3) + smile + path("M24 4l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z", P.violet),
  ),
  funny: face(
    line("M19 26l8 3-8 3M45 26l-8 3 8 3", P.ink, 3) + path("M20 38c6 12 18 12 24 0z", P.ink) + path("M26 46c4 3 8 3 12 0", P.rose),
  ),
  brave: face(dotEyes + line("M18 22l10-2M46 22l-10-2", P.ink, 3) + line("M24 40c4 3 12 3 16 0", P.ink, 3)),

  /* ---- food ---- */
  coconut:
    circle(32, 34, 22, P.brown, P.darkBrown) +
    ellipse(32, 30, 15, 13, P.white) +
    circle(26, 18, 2.5, P.darkBrown) +
    circle(32, 15, 2.5, P.darkBrown) +
    circle(38, 18, 2.5, P.darkBrown),
  cucumber:
    path("M10 46c0-10 30-34 42-32 6 1 4 8 0 12-10 12-30 26-38 26-3 0-4-3-4-6z", P.green, P.darkGreen) +
    circle(22, 40, 1.5, P.darkGreen) +
    circle(32, 32, 1.5, P.darkGreen) +
    circle(42, 24, 1.5, P.darkGreen),
  durian:
    ellipse(32, 36, 20, 22, P.green, P.darkGreen) +
    path(
      "M32 10l3 6h-6zM18 18l5 4-6 2zM46 18l-5 4 6 2zM12 34l6 2-6 3zM52 34l-6 2 6 3zM18 50l5-3-1 6zM46 50l-5-3 1 6zM32 58l3-5h-6z",
      P.darkGreen,
    ) +
    line("M32 14V6", P.brown, 3),
  mushroom:
    path("M8 32C8 18 20 10 32 10s24 8 24 22z", P.red) +
    circle(22, 22, 3.5, P.white) +
    circle(36, 18, 3, P.white) +
    circle(46, 26, 3, P.white) +
    path("M24 32h16l-2 24H26z", P.cream, P.tan),
  noodle:
    path("M6 30h52c0 16-12 26-26 26S6 46 6 30z", P.sky, P.blue) +
    path("M10 30c4-8 8-8 10 0s6 8 8 0 6-8 8 0 6 8 8 0 6-8 8 0", "none", P.peach) +
    line("M40 4l-8 30M48 6l-12 28", P.brown, 2.5),
  papaya:
    ellipse(32, 34, 18, 24, P.orange, P.deepOrange) +
    ellipse(32, 36, 9, 15, P.peach) +
    circle(30, 30, 2, P.ink) +
    circle(34, 36, 2, P.ink) +
    circle(30, 42, 2, P.ink) +
    circle(33, 47, 1.8, P.ink),
  pineapple:
    path("M32 4l-4 14-6-8 4 12M32 4l4 14 6-8-4 12", "none", P.darkGreen) +
    path("M26 22l-6-12 10 10 2-14 2 14 10-10-6 12z", P.green) +
    ellipse(32, 42, 15, 18, P.orange, P.deepOrange) +
    line("M20 32l24 20M20 44l18 14M24 26l22 18M44 32L20 52M44 44L26 58M40 26L18 44", P.deepOrange, 1.5),
  watermelon:
    path("M6 26h52c0 16-12 28-26 28S6 42 6 26z", P.green) +
    path("M10 26h44c0 13-10 23-22 23S10 39 10 26z", P.rose) +
    circle(22, 34, 1.8, P.ink) +
    circle(32, 38, 1.8, P.ink) +
    circle(42, 34, 1.8, P.ink) +
    circle(28, 44, 1.8, P.ink) +
    circle(37, 44, 1.8, P.ink),
  garlic:
    path("M32 8c-2 8-20 14-20 30 0 12 10 18 20 18s20-6 20-18C52 22 34 16 32 8z", P.white, P.soft) +
    line("M32 12v42M24 24c-4 10-4 22 2 30M40 24c4 10 4 22-2 30", P.soft, 2) +
    line("M26 56l-2 4M32 56v4M38 56l2 4", P.tan, 2),
  salad:
    path("M6 32h52c0 14-12 24-26 24S6 46 6 32z", P.white, P.soft) +
    circle(18, 28, 8, P.green) +
    circle(30, 24, 9, P.emerald) +
    circle(44, 27, 8, P.green) +
    circle(24, 30, 4, P.red) +
    circle(40, 31, 4, P.red) +
    circle(34, 30, 3, P.orange),
  mangosteen:
    circle(32, 36, 20, P.indigo, P.navy) +
    path("M24 16l8 4 8-4-4 8h-8z", P.green) +
    ellipse(32, 38, 10, 8, P.white) +
    line("M32 30v16M24 38h16", P.soft, 1.5),

  /* ---- home ---- */
  broom:
    line("M40 4L28 34", P.brown, 4) +
    path("M22 30l12 6-4 22c-6 2-14-2-18-8z", P.peach, P.deepOrange) +
    line("M18 50l8-14M24 54l6-16M30 56l4-18", P.deepOrange, 1.5),
  candle:
    path("M32 6c-6 8-6 14 0 16 6-2 6-8 0-16z", P.orange) +
    path("M32 12c-2 4-2 7 0 8 2-1 2-4 0-8z", P.peach) +
    line("M32 22v4", P.ink, 2) +
    rect(24, 26, 16, 30, P.lav, 3) +
    ellipse(32, 58, 16, 3, P.soft),
  drum:
    ellipse(32, 24, 22, 8, P.cream, P.brown) +
    path("M10 24v22c0 4 10 8 22 8s22-4 22-8V24c0 4-10 8-22 8s-22-4-22-8z", P.red) +
    line("M10 30l12 20M54 30L42 50M22 32l10 20M42 32L32 52", P.white, 2) +
    line("M40 4l-6 18M52 8l-12 14", P.brown, 3),
  fan:
    circle(32, 26, 20, "none", P.mid) +
    path("M32 26c-4-10 0-18 6-16 4 2 0 10-6 16zM32 26c10-2 16 4 12 8-4 2-8-4-12-8zM32 26c2 10-4 16-8 12-2-4 4-8 8-12z", P.sky) +
    circle(32, 26, 3, P.mid) +
    line("M32 46v8", P.mid, 4) +
    rect(20, 54, 24, 5, P.mid, 2),
  kettle:
    path("M14 28c0-6 8-10 18-10s18 4 18 10v22c0 4-8 6-18 6s-18-2-18-6z", P.sky, P.blue) +
    path("M50 32l10-8-2 14-8 6z", P.sky, P.blue) +
    path("M22 18c0-8 20-8 20 0", "none", P.ink) +
    circle(32, 13, 3, P.ink),
  phone: rect(18, 4, 28, 56, P.ink, 6) + rect(21, 10, 22, 40, P.ice, 2) + circle(32, 54, 2.5, P.mid) + rect(28, 6, 8, 2, P.mid, 1),
  pillow:
    path("M8 20c8-6 40-6 48 0 4 8 4 16 0 24-8 6-40 6-48 0-4-8-4-16 0-24z", P.lav, P.violet) + line("M14 26c10-3 26-3 36 0", P.white, 2),
  radio:
    rect(6, 22, 52, 32, P.red, 6) +
    circle(22, 38, 10, P.ink) +
    circle(22, 38, 4, P.mid) +
    rect(38, 30, 14, 6, P.ice, 2) +
    circle(42, 46, 3, P.white) +
    circle(50, 46, 3, P.white) +
    line("M44 22L56 6", P.mid, 2.5),
  sofa:
    rect(10, 22, 44, 18, P.indigo, 6) +
    rect(4, 30, 12, 20, P.violet, 4) +
    rect(48, 30, 12, 20, P.violet, 4) +
    rect(14, 38, 36, 12, P.violet, 3) +
    line("M10 50v6M54 50v6", P.brown, 3),
  umbrella:
    path("M4 32C4 16 18 6 32 6s28 10 28 26c-4-4-8-4-10 0-4-4-10-4-12 0-4-4-10-4-12 0-4-4-10-4-12 0-2-4-6-4-10 0z", P.rose) +
    line("M32 6v42c0 6 8 6 8 0", P.ink, 3),
  camera:
    rect(6, 18, 52, 36, P.ink, 6) +
    rect(18, 12, 14, 8, P.ink, 2) +
    circle(32, 36, 12, P.mid) +
    circle(32, 36, 7, P.sky) +
    circle(48, 26, 2.5, P.red),
  calendar:
    rect(8, 12, 48, 44, P.white, 5, P.mid) +
    rect(8, 12, 48, 12, P.rose, 5) +
    line("M20 6v12M44 6v12", P.ink, 3) +
    rect(16, 30, 7, 6, P.lav, 1) +
    rect(28, 30, 7, 6, P.lav, 1) +
    rect(40, 30, 7, 6, P.violet, 1) +
    rect(16, 42, 7, 6, P.lav, 1) +
    rect(28, 42, 7, 6, P.lav, 1),

  /* ---- nature ---- */
  rainbow:
    path("M4 52a28 28 0 0 1 56 0h-6a22 22 0 0 0-44 0z", P.red) +
    path("M10 52a22 22 0 0 1 44 0h-6a16 16 0 0 0-32 0z", P.orange) +
    path("M16 52a16 16 0 0 1 32 0h-6a10 10 0 0 0-20 0z", P.green) +
    path("M22 52a10 10 0 0 1 20 0h-5a5 5 0 0 0-10 0z", P.blue),
  grass:
    path(
      "M4 56c2-12 4-20 8-28 0 10 2 18 4 28zM14 56c2-16 6-26 12-36-2 14-2 24 2 36zM28 56c0-12 4-22 10-30-2 12 0 20 2 30zM40 56c2-14 6-24 12-30-2 12-2 22 0 30zM50 56c2-8 6-16 10-20-2 8-2 14-2 20z",
      P.green,
    ) + rect(2, 54, 60, 6, P.darkGreen, 2),
  seed:
    ellipse(32, 44, 12, 8, P.brown) +
    path("M32 38c0-10-2-16-8-22 8 0 12 6 8 22zM32 36c2-8 8-12 14-12-2 8-8 12-14 12z", P.green) +
    rect(6, 52, 52, 6, P.darkBrown, 2),
  cactus:
    path(
      "M26 58V18c0-8 12-8 12 0v40zM26 38H18c-4 0-6-2-6-6v-8c0-4 6-4 6 0v6h8zM38 30h8v-8c0-4 6-4 6 0v8c0 4-2 6-6 6h-8z",
      P.emerald,
      P.darkGreen,
    ) + rect(20, 52, 24, 8, P.deepOrange, 2),
  lotus:
    path("M32 14c-8 8-8 22 0 30 8-8 8-22 0-30z", P.pink, P.rose) +
    path("M32 44c-12 0-20-10-20-20 8 2 16 8 20 20zM32 44c12 0 20-10 20-20-8 2-16 8-20 20z", P.pink, P.rose) +
    ellipse(32, 50, 22, 5, P.green),
  puddle:
    ellipse(32, 46, 26, 9, P.sky) +
    ellipse(28, 44, 10, 3, P.ice) +
    path("M14 20c-3 5-3 8 0 9s3-4 0-9zM36 10c-3 5-3 8 0 9s3-4 0-9zM50 24c-3 5-3 8 0 9s3-4 0-9z", P.sky),

  /* ---- places ---- */
  shop:
    rect(8, 26, 48, 30, P.white, 2, P.mid) +
    path("M4 26l6-14h44l6 14z", P.rose) +
    line("M16 12l-4 14M26 12l-2 14M38 12l2 14M48 12l4 14", P.white, 2) +
    rect(14, 34, 14, 22, P.sky, 2) +
    rect(34, 34, 16, 12, P.ice, 2, P.mid),
  temple:
    path("M32 4l4 10h-8z", P.orange) +
    path("M20 22l12-10 12 10z", P.orange) +
    rect(18, 22, 28, 8, P.peach) +
    path("M10 36l22-8 22 8z", P.deepOrange) +
    rect(14, 36, 36, 20, P.cream, 2, P.tan) +
    rect(28, 42, 8, 14, P.brown, 1),
  farm:
    path("M8 28L32 10l24 18v28H8z", P.red) +
    path("M4 30L32 8l28 22", "none", P.white) +
    rect(24, 36, 16, 20, P.white, 1) +
    line("M24 36l16 20M40 36L24 56", P.red, 2) +
    rect(28, 20, 8, 8, P.white, 1),
  pool:
    rect(6, 22, 52, 34, P.sky, 6, P.blue) +
    path("M10 34c6-4 10 4 16 0s10 4 16 0 10 4 14 0M10 44c6-4 10 4 16 0s10 4 16 0 10 4 14 0", "none", P.white) +
    line("M44 8v26M52 8v26M44 14h8M44 22h8", P.mid, 2.5),

  /* ---- learning ---- */
  pen:
    path("M44 6l12 12-30 30-14 4 4-14z", P.indigo) +
    path("M16 38l10 10-12 4z", P.cream) +
    path("M14 50l-2 4 4-2z", P.ink) +
    line("M40 10l12 12", P.violet, 3),
  guitar:
    line("M40 24L56 8", P.brown, 5) +
    path("M38 18c-6-2-12 0-14 6-8 0-16 6-16 16 0 10 8 18 18 16 10-2 16-10 14-18 6-2 8-8 6-14z", P.orange, P.deepOrange) +
    circle(26, 38, 5, P.darkBrown) +
    line("M54 10l-28 30", P.cream, 1.2),
  computer:
    rect(10, 10, 44, 30, P.ink, 4) + rect(14, 14, 36, 22, P.ice, 2) + path("M4 46h56l-4 8H8z", P.mid) + rect(26, 48, 12, 2, P.soft, 1),
  chess: path("M24 58h16v-5l-3-3c0-6-1-14 3-18h-16c4 4 3 12 3 18l-3 3z", P.ink) + circle(32, 22, 7, P.ink) + rect(24, 29, 16, 4, P.ink, 2),

  /* ---- travel ---- */
  motorbike:
    circle(14, 44, 10, P.ink) +
    circle(50, 44, 10, P.ink) +
    circle(14, 44, 4, P.mid) +
    circle(50, 44, 4, P.mid) +
    path("M14 44l10-14h14l6-8h6l-6 10 6 12H34l-6-6z", P.red) +
    rect(22, 24, 16, 6, P.ink, 3) +
    line("M46 18l6-2", P.ink, 3),
  tuktuk:
    rect(4, 22, 30, 22, P.emerald, 3) +
    path("M2 18h36l-4-6H6z", P.darkGreen) +
    path("M34 34h12l10 10H34z", P.mid) +
    circle(12, 48, 7, P.ink) +
    circle(48, 48, 7, P.ink) +
    circle(12, 48, 3, P.mid) +
    circle(48, 48, 3, P.mid) +
    rect(8, 26, 20, 10, P.ice, 2),
  cart:
    rect(8, 22, 38, 16, P.brown, 2) +
    line("M8 28h38M8 34h38", P.darkBrown, 1.5) +
    circle(26, 46, 10, "none", P.darkBrown) +
    line("M26 36v20M16 46h20M19 39l14 14M33 39L19 53", P.darkBrown, 2) +
    line("M46 30l14-4", P.darkBrown, 3),
  tunnel:
    path("M4 58V30C4 14 16 4 32 4s28 10 28 26v28z", P.mid) +
    path("M14 58V34c0-10 8-18 18-18s18 8 18 18v24z", P.ink) +
    path("M26 58l2-20h8l2 20z", P.soft) +
    line("M32 42v4M32 50v4", P.white, 2),
};
