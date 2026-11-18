/** Drawings made for country puzzles: each shows one plain thing a child can name. */

import { PAL as P, circle, ellipse, line, path, rect } from "../draw";

export const PLACES: Record<string, string> = {
  // A crane, the tall bird: long legs, long neck, a red cap. ("U" + crane = Ukraine.)
  crane:
    line("M27 38l-3 22M35 38l3 22", P.ink, 2.5) +
    path("M16 28c-6 2-11 8-12 14 7-1 12-5 15-9z", P.ink) +
    ellipse(30, 31, 15, 9, P.white, P.mid) +
    line("M42 27C46 20 44 13 47 7", P.mid, 6) +
    line("M42 27C46 20 44 13 47 7", P.white, 3) +
    circle(48, 7, 4.5, P.white, P.mid) +
    circle(47, 4.5, 2.2, P.red) +
    path("M52 6l11 3-11 3z", P.ink) +
    circle(49, 7.5, 1.2, P.ink),

  // A big tick, the mark a teacher puts by a right answer. ("DEN" + mark = Denmark.)
  tick: circle(32, 32, 27, P.white, P.soft) + line("M17 33l10 11 21-24", P.emerald, 8),

  // A tongue sticking out of an open mouth. (tongue + "A" = Tonga.)
  tongue:
    ellipse(32, 22, 25, 14, P.red, P.darkRed) +
    ellipse(32, 22, 18, 8, P.ink) +
    rect(20, 15, 24, 4, P.white, 1.5) +
    path("M21 24c0 17 5 32 11 32s11-15 11-32c-7 3-15 3-22 0z", P.rose, P.darkRed) +
    line("M32 30v14", P.darkRed, 1.5),

  // A guinea pig: round, short legs, no tail. (guinea pig − "PIG" = Guinea.)
  "guinea-pig":
    ellipse(34, 38, 26, 17, P.cream, P.brown) +
    ellipse(42, 32, 14, 11, P.brown) +
    ellipse(16, 23, 5, 4, P.pink, P.brown) +
    circle(15, 34, 2.6, P.ink) +
    circle(9, 41, 2.2, P.rose) +
    line("M10 43l-7 2M10 45l-6 5", P.mid, 1.2) +
    ellipse(20, 55, 4.5, 2.6, P.pink) +
    ellipse(46, 55, 4.5, 2.6, P.pink),
};
