/** Objects, buildings and signs. */

import { PAL as P, circle, line, path, rays, rect } from "./draw";

export const THINGS: Record<string, string> = {
  key: circle(20, 22, 12, "none", P.orange).replace('stroke-width="2"', 'stroke-width="6"') + line("M29 30l24 24M44 45l6-6M50 51l6-6", P.orange, 6),
  sword: path("M32 4l5 8v30H27V12z", P.soft, P.mid) + rect(18, 42, 28, 6, P.indigo, 3) + rect(29, 48, 6, 10, P.brown, 2) + circle(32, 60, 3, P.indigo),
  house: path("M6 30L32 8l26 22z", P.red) + rect(12, 30, 40, 26, P.cream, 2, P.tan) + rect(26, 38, 12, 18, P.brown, 2) + rect(15, 34, 8, 8, P.sky, 1) + rect(41, 34, 8, 8, P.sky, 1),
  home: path("M6 30L32 8l26 22z", P.indigo) + rect(12, 30, 40, 26, P.lav, 2) + rect(26, 38, 12, 18, P.violet, 2) + path("M32 34c-4-4-8 0-4 4l4 4 4-4c4-4 0-8-4-4z", P.rose),
  tie: path("M26 6h12l-3 10 6 36-9 8-9-8 6-36z", P.indigo) + path("M28 20h8l2 10h-12z", P.violet) + rect(24, 4, 16, 6, P.violet, 2),
  no: circle(32, 32, 24, "none", P.red).replace('stroke-width="2"', 'stroke-width="7"') + line("M15 49L49 15", P.red, 7),
  way: path("M26 6h12l16 52H10z", P.mid) + line("M32 10v8M32 24v10M32 40v10", P.white, 3) + line("M26 6L10 58M38 6l16 52", P.soft, 2),
  pain: circle(32, 32, 22, P.cream, P.tan) + rect(10, 26, 44, 12, P.peach, 4, P.orange).replace("<rect", '<rect transform="rotate(-30 32 32)"') + line("M32 20l-3-8M42 24l6-6M22 24l-6-6", P.red, 3) + circle(26, 34, 2, P.ink) + circle(40, 30, 2, P.ink),
  money: rect(6, 16, 52, 32, P.green, 5, P.darkGreen) + circle(32, 32, 10, P.emerald, P.darkGreen) + line("M32 26v12M28 30c0-3 8-3 8 0s-8 3-8 6 8 3 8 0", P.white, 2.5) + circle(14, 32, 3, P.darkGreen) + circle(50, 32, 3, P.darkGreen),
  cube: path("M32 6l22 12v26L32 58 10 44V18z", P.violet) + path("M32 6l22 12-22 12L10 18z", P.lav) + path("M32 30v28L10 44V18z", P.indigo),
  clock: circle(32, 32, 24, P.white, P.indigo).replace('stroke-width="2"', 'stroke-width="4"') + line("M32 16v16l10 6", P.ink, 4) + rays(32, 32, 19, 22, 12, P.violet, 2),
  tooth: path("M16 10c8-4 12 2 16 2s8-6 16-2c6 4 4 16 0 24-2 8-2 20-8 20-4 0-4-10-8-10s-4 10-8 10c-6 0-6-12-8-20-4-8-6-20 0-24z", P.white, P.soft),
  nail: path("M26 6h12v6h-12z", P.mid) + path("M29 12h6v38l-3 8-3-8z", P.soft, P.mid),
  broken: path("M32 56C10 40 6 26 12 16c6-8 16-6 20 2l-6 8 8 6-6 10z", P.rose) + path("M32 56C54 40 58 26 52 16c-6-8-16-6-20 2l6 8-8 6 6 10z", P.red) + line("M32 18l-6 8 8 6-6 10", P.white, 3),
  cross: line("M14 14l36 36M50 14L14 50", P.red, 9),
  sleep: line("M14 18h16l-16 16h16", P.indigo, 4) + line("M36 30h12l-12 12h12", P.violet, 4) + line("M30 46h8l-8 8h8", P.lav, 3),
  book: path("M8 12c10-4 18-2 24 4 6-6 14-8 24-4v40c-10-4-18-2-24 4-6-6-14-8-24-4z", P.indigo) + path("M12 14c8-2 14 0 18 4v32c-6-4-12-4-18-2z", P.lav) + path("M52 14c-8-2-14 0-18 4v32c6-4 12-4 18-2z", P.white) + line("M32 18v36", P.violet, 2),
  work: rect(8, 22, 48, 32, P.brown, 5) + path("M24 22v-6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6", "none", P.darkBrown).replace('stroke-width="2"', 'stroke-width="4"') + rect(8, 34, 48, 4, P.darkBrown, 0) + rect(28, 32, 8, 8, P.orange, 2),
  note: rect(12, 8, 40, 48, P.white, 4, P.mid) + line("M20 20h24M20 30h24M20 40h16", P.sky, 3) + circle(18, 8, 3, P.indigo) + circle(32, 8, 3, P.indigo) + circle(46, 8, 3, P.indigo),
  board: rect(6, 14, 52, 36, P.darkGreen, 4, P.brown).replace('stroke-width="2"', 'stroke-width="5"') + line("M14 26c6-4 10 4 16 0s10-2 14 0M14 38h18", P.white, 3) + rect(10, 52, 12, 4, P.soft, 2),
  paper: path("M14 6h26l12 12v40H14z", P.white, P.mid) + path("M40 6v12h12", P.pale, P.mid) + line("M22 28h20M22 36h20M22 44h14", P.sky, 3),
  clip: path("M40 14L20 36a8 8 0 0 0 12 12l22-24a12 12 0 0 0-18-16L14 32a16 16 0 0 0 24 22", "none", P.mid).replace('stroke-width="2"', 'stroke-width="4"'),
  shelf: rect(6, 10, 52, 44, P.brown, 3) + rect(10, 14, 44, 16, P.darkBrown, 2) + rect(10, 34, 44, 16, P.darkBrown, 2) + rect(14, 16, 6, 14, P.rose, 1) + rect(22, 18, 6, 12, P.sky, 1) + rect(30, 16, 6, 14, P.green, 1) + rect(16, 38, 8, 12, P.violet, 1) + rect(26, 40, 6, 10, P.rose, 1),
  // A zipped pencil case with a pencil poking out of the top.
  case:
    rect(14, 12, 9, 18, P.rose, 2) +
    path("M14.6 12L18.5 4.5l3.9 7.5z", P.peach, P.brown) +
    circle(18.5, 5.6, 1.4, P.ink) +
    rect(6, 24, 52, 26, P.violet, 10, P.indigo) +
    line("M13 33h38", P.lav, 2.5) +
    circle(50, 33, 3.2, P.white, P.indigo) +
    line("M12 42h14", P.lav, 2.5),
  bus: rect(6, 14, 52, 36, P.deepOrange, 8) + rect(10, 20, 14, 12, P.ice, 2) + rect(26, 20, 14, 12, P.ice, 2) + rect(42, 20, 12, 12, P.ice, 2) + rect(6, 36, 52, 4, P.darkRed, 0) + circle(18, 52, 6, P.ink) + circle(46, 52, 6, P.ink) + circle(18, 52, 2.4, P.soft) + circle(46, 52, 2.4, P.soft),
  bell: path("M32 8c-10 0-16 8-16 20 0 10-4 12-6 16h44c-2-4-6-6-6-16 0-12-6-20-16-20z", P.orange) + circle(32, 50, 5, P.deepOrange) + circle(32, 6, 3, P.deepOrange),
  bag: path("M12 22h40l4 34H8z", P.rose, P.darkRed) + path("M22 22v-6a10 10 0 0 1 20 0v6", "none", P.darkRed).replace('stroke-width="2"', 'stroke-width="4"') + rect(24, 34, 16, 12, P.pink, 3),
  pencil: path("M44 6l14 14-34 34-18 4 4-18z", P.rose) + path("M44 6l14 14-6 6-14-14z", P.pink) + path("M10 40l14 14-18 4z", P.cream) + path("M6 58l3-10 7 7z", P.ink),
  school: rect(8, 26, 48, 30, P.rose, 3) + path("M4 26L32 8l28 18z", P.darkRed) + rect(26, 38, 12, 18, P.cream, 2) + rect(12, 32, 8, 8, P.ice, 1) + rect(44, 32, 8, 8, P.ice, 1) + line("M32 8V2", P.ink, 2) + path("M32 2l8 3-8 3z", P.indigo),
  ship: path("M6 36h52l-8 16H14z", P.indigo) + rect(18, 22, 28, 14, P.white, 2, P.mid) + circle(26, 29, 3, P.sky) + circle(38, 29, 3, P.sky) + rect(28, 10, 8, 12, P.red, 2) + path("M4 56c6-4 10 4 16 0s10 4 16 0 10 4 16 0 8 2 8 2v4H4z", P.sky),
  plane: path("M4 36l10-4 14 2L14 10h8l24 22 12-4c4-1 4 5 0 6l-12 4-8 20h-8l2-18-10 2-12 4z", P.mid) + path("M30 28L14 10h8l24 22z", P.sky),
  rise: line("M32 54V14M16 28l16-16 16 16", P.green, 7),
  drop: path("M32 6C22 22 14 30 14 42a18 18 0 0 0 36 0C50 30 42 22 32 6z", P.ice) + path("M24 42a8 8 0 0 0 7 8", P.white, P.white),
  man: circle(32, 14, 9, P.violet) + path("M20 28h24l4 18H40v14H24V46H16z", P.indigo),
  witch: path("M32 4l14 38H18z", P.indigo) + rect(6, 40, 52, 8, P.indigo, 4) + rect(20, 32, 24, 6, P.violet, 0) + rect(28, 30, 8, 10, P.orange, 2),
};
