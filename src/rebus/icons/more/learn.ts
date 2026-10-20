/** Things from the classroom, the lab and the landscape. */

import { PAL as P, circle, ellipse, line, path, rect } from "../draw";

const thick = (s: string, w: number): string => s.replace('stroke-width="2"', `stroke-width="${w}"`);

export const LEARN: Record<string, string> = {
  ruler:
    rect(4, 20, 56, 24, P.sky, 3, P.navy) + line("M12 20v10M20 20v6M28 20v10M36 20v6M44 20v10M52 20v6", P.navy, 2.5),
  scissors:
    circle(18, 48, 9, "none", P.red).replace('stroke-width="2"', 'stroke-width="5"') + circle(46, 48, 9, "none", P.red).replace('stroke-width="2"', 'stroke-width="5"') +
    path("M22 40L46 6l4 3-22 34z", P.soft, P.mid) + path("M42 40L18 6l-4 3 22 34z", P.pale, P.mid),
  glue:
    path("M22 30h20v28H22z", P.white, P.mid) + rect(22, 38, 20, 12, P.blue, 0) + path("M26 30V16l6-8 6 8v14z", P.orange, P.deepOrange) + circle(32, 5, 2.4, P.white, P.mid),
  crayon:
    path("M18 56L46 10l8 4-26 46z", P.rose, P.darkRed) + path("M46 10l4-6 8 4-4 6z", P.pink, P.rose) + line("M24 46l10 6M30 36l10 6", P.white, 2.5),
  eraser:
    path("M10 38l22-22 20 20-22 22H18z", P.pink, P.rose) + path("M32 16l20 20-10 10-20-20z", P.sky, P.navy) + line("M8 56h44", P.mid, 3),
  calculator:
    rect(12, 4, 40, 56, P.ink, 5) + rect(17, 9, 30, 12, P.ice, 2) + circle(22, 30, 3.5, P.pink) + circle(32, 30, 3.5, P.pink) + circle(42, 30, 3.5, P.pink) + circle(22, 40, 3.5, P.soft) + circle(32, 40, 3.5, P.soft) + circle(42, 40, 3.5, P.soft) + circle(22, 50, 3.5, P.soft) + circle(32, 50, 3.5, P.soft) + circle(42, 50, 3.5, P.orange),
  desk:
    rect(4, 14, 56, 8, P.tan, 3, P.brown) + rect(6, 22, 5, 36, P.brown, 1) + rect(53, 22, 5, 36, P.brown, 1) + rect(34, 22, 18, 20, P.brown, 2, P.darkBrown) + circle(43, 32, 2, P.cream) + rect(13, 22, 3, 20, P.brown, 0),
  backpack:
    path("M14 18c0-10 8-14 18-14s18 4 18 14v38c0 2-2 4-4 4H18c-2 0-4-2-4-4z", P.indigo, P.navy) + rect(20, 34, 24, 18, P.violet, 4, P.navy) + path("M22 18c2-4 18-4 20 0", "none", P.navy) + rect(28, 40, 8, 4, P.lav, 1),
  chalk:
    path("M10 44L44 10l10 10-34 34z", P.white, P.mid) + line("M16 50l-4-4M24 42l-4-4", P.soft, 3) + path("M6 58l8-6-4-4z", P.pale),
  globe:
    circle(32, 28, 22, P.sky, P.navy) + path("M18 18c6-4 10 0 8 6s-6 4-8 10c-4-4-4-12 0-16zM38 28c6 0 10 4 8 12-4 2-10-2-8-12z", P.green) + path("M20 54h24", "none", P.mid).replace('stroke-width="2"', 'stroke-width="5"') + line("M32 50v6", P.mid, 4),
  map:
    path("M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6z", P.cream, P.brown) + line("M22 8v42M42 14v42", P.brown, 2) + path("M30 22l4 4M34 22l-4 4", "none", P.red).replace('stroke-width="2"', 'stroke-width="3"') + line("M10 40c8-6 12 4 20-2", P.sky, 2.5),
  magnet:
    path("M10 52V30C10 6 54 6 54 30v22H42V30c0-10-20-10-20 0v22z", P.red, P.darkRed) + rect(10, 44, 12, 10, P.white, 0, P.mid) + rect(42, 44, 12, 10, P.white, 0, P.mid),
  lens:
    circle(26, 26, 18, P.ice, P.mid).replace('stroke-width="2"', 'stroke-width="5"') + path("M16 20c4-6 10-8 14-6", "none", P.white) + line("M40 40l16 16", P.brown, 7),
  planet:
    ellipse(32, 32, 28, 9, "none", P.violet).replace('stroke-width="2"', 'stroke-width="3"') + circle(32, 32, 16, P.orange, P.deepOrange) + path("M20 28c8 4 16 4 24 0", "none", P.deepOrange) + path("M4 32c0 6 12 12 28 12s28-6 28-12", "none", P.violet).replace('stroke-width="2"', 'stroke-width="3"'),
  battery:
    rect(10, 18, 40, 28, P.soft, 4, P.mid) + rect(50, 26, 6, 12, P.mid, 2) + rect(10, 18, 18, 28, P.green, 4, P.darkGreen) + path("M34 26l-4 8h6l-4 8", "none", P.ink).replace('stroke-width="2"', 'stroke-width="3"'),
  bulb:
    path("M32 4C18 4 12 16 18 28c4 6 6 8 6 14h16c0-6 2-8 6-14C52 16 46 4 32 4z", P.ice, P.sky) + rect(24, 42, 16, 6, P.mid, 2) + rect(26, 48, 12, 6, P.mid, 2) + rect(29, 54, 6, 5, P.ink, 2) + path("M26 22l6 8 6-8", "none", P.orange).replace('stroke-width="2"', 'stroke-width="3"'),
  telescope:
    '<g transform="rotate(-25 32 32)">' + rect(6, 22, 20, 14, P.indigo, 3, P.navy) + rect(24, 24, 18, 10, P.violet, 2, P.navy) + rect(40, 20, 16, 18, P.indigo, 3, P.navy) + "</g>" + line("M32 40l-8 20M32 40l8 20M32 40v20", P.mid, 3),
  microscope:
    rect(22, 4, 10, 30, P.ink, 3) + rect(20, 30, 14, 6, P.mid, 2) + path("M36 12c10 2 16 12 14 24-1 6-6 10-14 10", "none", P.ink).replace('stroke-width="2"', 'stroke-width="5"') + rect(10, 44, 20, 5, P.soft, 2, P.mid) + rect(8, 54, 44, 6, P.ink, 3),
  gear:
    circle(32, 32, 18, P.mid, P.ink) + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="28" y="2" width="8" height="12" rx="2" fill="${P.mid}" stroke="${P.ink}" stroke-width="2" transform="rotate(${a} 32 32)"/>`).join("") + circle(32, 32, 18, P.mid) + circle(32, 32, 7, P.white, P.ink),
  robot:
    rect(14, 16, 36, 28, P.soft, 6, P.mid) + rect(26, 6, 12, 10, P.mid, 2) + line("M32 6V2", P.mid, 3) + circle(32, 2, 2.4, P.red) + circle(24, 28, 5, P.sky, P.navy) + circle(40, 28, 5, P.sky, P.navy) + rect(24, 37, 16, 4, P.ink, 2) + rect(18, 46, 28, 12, P.mid, 3) + rect(6, 22, 6, 14, P.mid, 2) + rect(52, 22, 6, 14, P.mid, 2),
  volcano:
    path("M4 58L24 24h16l20 34z", P.brown, P.darkBrown) + path("M24 24c2-8 4-12 8-14 4 2 6 6 8 14z", P.red) + path("M26 12c-2-4 2-6 0-10M38 12c-2-4 2-6 0-10", "none", P.mid) + path("M30 30l-2 12M36 34l4 14", "none", P.orange).replace('stroke-width="2"', 'stroke-width="3"'),
  mountain:
    path("M2 58L24 14l12 20 8-10 18 34z", P.mid, P.ink) + path("M24 14l-8 15 6-4 4 6 4-6 5 3z", P.white),
  river:
    rect(2, 2, 60, 60, P.green, 0) + path("M40 2c-14 12 10 20-4 30S14 48 22 62h14c-8-14 14-22 2-32S54 14 54 2z", P.sky, P.navy),
  lake:
    rect(2, 2, 60, 60, P.green, 0) + ellipse(32, 34, 26, 18, P.sky, P.navy) + path("M18 32c4-3 8 3 12 0s8 3 12 0", "none", P.white) + path("M22 40c4-2 6 2 10 0", "none", P.white),
  island:
    rect(2, 34, 60, 28, P.sky, 0) + ellipse(32, 46, 22, 8, P.tan, P.brown) + path("M30 44c0-10 0-18 4-24", "none", P.brown).replace('stroke-width="2"', 'stroke-width="4"') + path("M34 20c-8-8-16-4-18 0 8-2 12 0 18 0zM34 20c8-8 16-4 18 0-8-2-12 0-18 0z", P.green, P.darkGreen),
  hill:
    rect(2, 2, 60, 60, P.ice, 0) + path("M0 58c6-24 22-34 36-34 16 0 24 14 28 34z", P.green, P.darkGreen) + path("M0 64c8-12 24-14 34-10 10 4 22 2 30-4v14z", P.emerald),
  cave:
    rect(2, 2, 60, 60, P.mid, 0) + path("M6 58c0-26 10-40 26-40s26 14 26 40z", P.ink) + path("M20 58c0-14 4-22 12-22s12 8 12 22z", P.darkBrown),
  desert:
    rect(2, 2, 60, 60, P.ice, 0) + circle(48, 16, 8, P.orange) + path("M0 60c8-18 20-22 32-12 8-10 22-10 32 0v12z", P.peach, P.deepOrange) + path("M16 40v-12c0-3 5-3 5 0v12M16 34h-5v-5c0-2 5-2 5 2", "none", P.darkGreen).replace('stroke-width="2"', 'stroke-width="3"'),
  forest:
    rect(2, 2, 60, 60, P.ice, 0) + path("M10 54l10-26 10 26zM30 54l12-32 12 32zM2 58h60v4H2z", P.darkGreen, P.darkGreen) + path("M17 54h6v6h-6zM39 54h6v6h-6z", P.brown),
  sky:
    rect(2, 2, 60, 60, P.sky, 8) + circle(46, 18, 8, P.orange) + circle(18, 40, 9, P.white) + circle(30, 36, 11, P.white) + circle(42, 42, 8, P.white) + rect(18, 40, 24, 10, P.white, 0),
};
