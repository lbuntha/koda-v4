/** Animals, insects and the people who turn up in puzzles. Faces are kept simple so a child knows each at a glance. */

import { PAL as P, circle, ellipse, eyes, line, path, rays, rect } from "./draw";

export const CREATURES: Record<string, string> = {
  cat: path("M12 14l10 10h20l10-10v26a20 16 0 0 1-40 0z", P.orange) + eyes(32, 9) + path("M30 38h4l-2 3z", P.rose) + line("M32 41v3M26 44c3 2 9 2 12 0", P.ink, 2) + line("M8 36l12 2M8 44l12-2M56 36l-12 2M56 44l-12-2", P.mid, 2),
  // A floppy-eared pup: hanging ears, a patch over one eye, a pale muzzle, a nose and a tongue.
  dog:
    path("M13 17c-8 2-10 24-2 32 4 3 9-2 8-9l-1-19z", P.brown) +
    path("M51 17c8 2 10 24 2 32-4 3-9-2-8-9l1-19z", P.brown) +
    ellipse(32, 34, 19, 20, P.tan) +
    path("M38 18c7-3 13 1 12 9-1 5-7 8-12 4z", P.brown) +
    ellipse(32, 44, 11, 9, P.cream) +
    circle(25, 31, 3.6, P.white) + circle(39, 31, 3.6, P.white) +
    circle(25, 31, 2.2, P.ink) + circle(39, 31, 2.2, P.ink) +
    circle(25.9, 30.1, 0.8, P.white) + circle(39.9, 30.1, 0.8, P.white) +
    ellipse(32, 40, 4.8, 3.4, P.ink) + circle(30.8, 38.9, 1, P.white) +
    line("M32 43v3M26 47c3 3 9 3 12 0", P.ink, 2) +
    path("M29.5 48.5c.5 6 4.5 6 5 0z", P.rose),
  bull: path("M6 12c0 14 8 16 14 16M58 12c0 14-8 16-14 16", P.cream, P.tan) + ellipse(32, 36, 17, 20, P.brown) + ellipse(32, 46, 11, 8, P.pink) + eyes(32, 9) + circle(28, 46, 2, P.ink) + circle(36, 46, 2, P.ink) + circle(32, 56, 0.1, P.ink),
  frog: circle(20, 24, 9, P.green) + circle(44, 24, 9, P.green) + ellipse(32, 38, 24, 18, P.green) + circle(20, 24, 4.5, P.white) + circle(44, 24, 4.5, P.white) + circle(20, 24, 2.4, P.ink) + circle(44, 24, 2.4, P.ink) + line("M18 42c8 8 20 8 28 0", P.darkGreen, 3),
  fish: path("M6 32c10-16 26-16 38 0-12 16-28 16-38 0z", P.orange) + path("M42 32l16-12v24z", P.deepOrange) + circle(18, 29, 2.8, P.ink) + line("M28 22c3 6 3 14 0 20", P.deepOrange, 2),
  bird: path("M10 30c0-12 12-18 24-14 6 2 10 8 12 14l12 4-12 4c-2 12-10 18-20 18S10 46 10 30z", P.sky) + path("M16 34c6-2 14 0 18 8-8 4-16 0-18-8z", P.blue) + circle(36, 24, 2.8, P.ink) + path("M46 30l12 4-12 4z", P.orange),
  bee: ellipse(32, 38, 18, 14, P.orange) + path("M26 25v26M34 24v28M42 27v22", P.ink, P.ink).replace('stroke-width="2"', 'stroke-width="5"') + ellipse(22, 22, 8, 12, P.ice, P.sky).replace("<ellipse", '<ellipse transform="rotate(-30 22 22)"') + ellipse(40, 20, 8, 12, P.ice, P.sky).replace("<ellipse", '<ellipse transform="rotate(30 40 20)"') + circle(14, 38, 2, P.ink) + path("M50 38l8 0", P.ink, P.ink),
  // A horse seen from the front: a dark mane, pricked ears, a white blaze and a soft muzzle.
  horse:
    path("M13 14c6-9 32-9 38 0 4 12 2 30-4 42H17C11 44 9 26 13 14z", P.darkBrown) +
    path("M18 16L14 3l10 8zM46 16L50 3l-10 8z", P.brown) +
    path("M22 15c6-4 14-4 20 0 3 11 3 24 1 34-3 8-19 8-22 0-2-10-2-23 1-34z", P.brown) +
    path("M29.5 14c1.5-1 3.5-1 5 0 1 9 1 19 0 27h-5c-1-8-1-18 0-27z", P.cream) +
    path("M25 11c4 7 10 7 14 0l-2 9h-10z", P.darkBrown) +
    ellipse(32, 51, 10, 8, P.tan) +
    circle(28, 52, 1.8, P.ink) + circle(36, 52, 1.8, P.ink) +
    circle(24, 31, 2.8, P.ink) + circle(40, 31, 2.8, P.ink) +
    circle(24.9, 30.1, 0.9, P.white) + circle(40.9, 30.1, 0.9, P.white),
  lion: circle(32, 32, 26, P.deepOrange) + circle(32, 32, 20, P.orange) + circle(32, 34, 14, P.peach) + eyes(30, 6) + path("M29 36h6l-3 4z", P.ink) + line("M32 40v3M27 45c3 2 7 2 10 0", P.ink, 2),
  hog: ellipse(32, 34, 22, 20, P.pink) + path("M14 18l8 8-10 2zM50 18l-8 8 10 2z", P.rose) + ellipse(32, 42, 11, 8, P.rose) + circle(28, 42, 2, P.ink) + circle(36, 42, 2, P.ink) + eyes(30, 9),
  monkey: circle(14, 32, 8, P.brown) + circle(50, 32, 8, P.brown) + circle(32, 30, 20, P.brown) + ellipse(32, 38, 13, 11, P.tan) + eyes(28, 7) + circle(28, 40, 1.6, P.ink) + circle(36, 40, 1.6, P.ink) + line("M27 45c3 2 7 2 10 0", P.ink, 2),
  // A monk in a saffron robe, head shaved, hands together, eyes gently closed.
  monk:
    rect(28, 28, 8, 8, P.tan, 0) +
    path("M8 62c0-16 7-27 24-28 17 1 24 12 24 28z", P.deepOrange) +
    path("M12 62c1-12 6-20 14-24l22 24z", P.orange) +
    path("M34 36c8 1 14 6 16 13l-13-4z", P.tan) +
    circle(32, 20, 11.5, P.tan) + circle(20.5, 21, 2.8, P.tan) + circle(43.5, 21, 2.8, P.tan) +
    line("M26 20c1.5 1.8 3.6 1.8 5 0M33 20c1.5 1.8 3.6 1.8 5 0M29 26.5c2 1.8 4 1.8 6 0", P.ink, 2) +
    path("M32 44c-5 0-6 7-4 11h8c2-4 1-11-4-11z", P.tan, P.brown) +
    line("M32 46v8", P.brown, 1.6),
  doll: circle(32, 14, 9, P.cream, P.tan) + path("M23 12c0-8 18-8 18 0", P.brown, P.brown) + eyes(14, 3.5) + path("M24 24h16l6 28H18z", P.rose) + rect(24, 52, 6, 6, P.cream, 2) + rect(34, 52, 6, 6, P.cream, 2) + line("M24 28l-8 10M40 28l8 10", P.cream, 4),
  // A shark's fin cutting through the water, with ripples either side.
  fin:
    path("M2 48c9-4 15-4 22 0s15 4 22 0 12-3 16-2v18H2z", P.sky) +
    path("M15 52C20 34 31 17 42 6c2 15 4 31 14 46z", P.mid, P.ink) +
    line("M31 24c1 8 4 16 9 24", P.soft, 2.6) +
    path("M2 54c9-4 15-4 22 0s15 4 22 0 12-3 16-2v12H2z", P.blue),
  // A sheep from the front: a woolly crown and cheeks, a dark face with white eyes, and pink nose.
  sheep:
    ellipse(12, 33, 8, 4.5, P.mid) + ellipse(52, 33, 8, 4.5, P.mid) +
    circle(18, 22, 9, P.white, P.soft) + circle(32, 15, 10.5, P.white, P.soft) + circle(46, 22, 9, P.white, P.soft) +
    circle(14, 40, 8, P.white, P.soft) + circle(50, 40, 8, P.white, P.soft) +
    ellipse(32, 37, 13, 17, P.ink) +
    circle(26, 24, 5, P.white, P.soft) + circle(38, 24, 5, P.white, P.soft) +
    circle(26.5, 34, 3.4, P.white) + circle(37.5, 34, 3.4, P.white) +
    circle(26.5, 34, 1.7, P.ink) + circle(37.5, 34, 1.7, P.ink) +
    ellipse(32, 45, 4, 3, P.pink) + line("M32 48v2M28.5 51c2 2 5 2 7 0", P.white, 1.8),
  jelly: path("M10 40c0-18 10-28 22-28s22 10 22 28z", P.rose) + rect(6, 40, 52, 10, P.pink, 5) + path("M20 20c2-4 6-6 10-6", "none", P.white).replace('stroke-width="2"', 'stroke-width="3"') + rect(24, 8, 4, 4, P.red, 2),
  fly: ellipse(32, 38, 7, 14, P.ink) + circle(32, 22, 7, P.ink) + ellipse(20, 30, 10, 6, P.ice, P.sky).replace("<ellipse", '<ellipse transform="rotate(-30 20 30)"') + ellipse(44, 30, 10, 6, P.ice, P.sky).replace("<ellipse", '<ellipse transform="rotate(30 44 30)"') + circle(29, 20, 2, P.red) + circle(35, 20, 2, P.red),
  dragon: path("M6 36c0-14 10-24 24-24 8 0 14 4 18 10l10-2-6 10c4 12-4 24-18 26-4 4-12 4-18-2z", P.emerald) + path("M30 10l4-6 4 8zM40 14l6-4 0 8z", P.darkGreen) + circle(34, 24, 3, P.white) + circle(34, 24, 1.6, P.ink) + circle(52, 22, 1.6, P.ink) + path("M44 36c4 4 8 6 12 6", P.deepOrange, P.deepOrange).replace('stroke-width="2"', 'stroke-width="3"'),
  bug: ellipse(32, 38, 20, 18, P.red) + circle(32, 16, 8, P.ink) + line("M32 20v34", P.ink, 3) + circle(22, 34, 3.4, P.ink) + circle(42, 34, 3.4, P.ink) + circle(24, 46, 3, P.ink) + circle(40, 46, 3, P.ink) + line("M28 10l-6-6M36 10l6-6", P.ink, 2),
  lady: circle(32, 12, 8, P.cream, P.tan) + path("M24 12c0-10 16-10 16 0 2 6 0 12-4 14l-2-10-6 0-2 10c-4-2-4-8-2-14z", P.darkBrown) + path("M26 22h12l12 34H14z", P.rose) + circle(32, 22, 0.1, P.ink) + eyes(13, 3),
  whale: path("M4 38c0-16 14-24 30-22 12 2 20 10 22 22 0 6-4 10-12 10H18c-8 0-14-2-14-10z", P.blue) + path("M50 22c4-6 10-6 12-2-4 0-8 2-10 6z", P.navy) + path("M10 44h40", P.ice, P.ice).replace('stroke-width="2"', 'stroke-width="3"') + circle(18, 32, 2.4, P.white) + path("M30 14c-2-6-6-8-10-6M30 14c2-6 6-8 10-6", "none", P.sky).replace('stroke-width="2"', 'stroke-width="3"'),
  // A turkey with its tail fanned out behind: five feathers, a brown body, a red wattle.
  turkey:
    [-56, -28, 0, 28, 56].map((a, i) => `<g transform="rotate(${a} 32 42)">` + ellipse(32, 17, 7, 16, [P.deepOrange, P.red, P.orange, P.red, P.deepOrange][i]) + circle(32, 8, 2.4, P.cream) + `</g>`).join("") +
    ellipse(32, 46, 15, 13, P.brown) +
    path("M21 46c3 9 19 9 22 0", P.darkBrown, P.darkBrown).replace('stroke-width="2"', 'stroke-width="3"') +
    circle(32, 31, 8, P.brown) +
    path("M32 31l-3.6 5.5h7.2z", P.orange) +
    line("M32 36c-2 4 0 7 2 7", P.red, 3.4) +
    circle(28.6, 29, 1.7, P.ink) + circle(35.4, 29, 1.7, P.ink) +
    line("M27 58v5M37 58v5M23 63h8M33 63h8", P.orange, 2.6),
  hedge: rect(6, 22, 52, 32, P.darkGreen, 10) + circle(16, 30, 4, P.green) + circle(30, 26, 4, P.green) + circle(44, 32, 4, P.green) + circle(24, 44, 4, P.green) + circle(40, 46, 4, P.green) + rect(26, 54, 12, 6, P.brown, 2),
  worm: path("M8 46c0-10 10-10 14-2s12 6 14-2 12-10 20-4", "none", P.rose).replace('stroke-width="2"', 'stroke-width="9"').replace("<path", '<path stroke-linecap="round"') + circle(52, 38, 1.8, P.ink),
  germ: circle(32, 32, 16, P.green) + rays(32, 32, 16, 26, 12, P.emerald, 4) + circle(32, 32, 10, P.emerald) + circle(27, 30, 2.4, P.ink) + circle(37, 30, 2.4, P.ink) + line("M27 38c3 3 7 3 10 0", P.ink, 2),
  eye: path("M4 32c10-16 46-16 56 0-10 16-46 16-56 0z", P.white, P.ink) + circle(32, 32, 10, P.sky) + circle(32, 32, 5, P.ink) + circle(35, 29, 2, P.white),
};
