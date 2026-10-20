/** Everyday objects. */

import { PAL as P, circle, ellipse, line, path, rect } from "../draw";

export const MORE_THINGS: Record<string, string> = {
  basket:
    path("M8 26h48l-6 26c-1 4-4 6-8 6H22c-4 0-7-2-8-6z", P.tan, P.brown) +
    line("M14 34h36M16 42h32M18 50h28M22 26l2 32M32 26v32M42 26l-2 32", P.brown, 1.8) +
    path("M16 26c0-14 8-20 16-20s16 6 16 20", "none", P.brown).replace('stroke-width="2"', 'stroke-width="3.5"'),
  pin:
    path("M26 6h12c2 8 2 14 0 18 4 4 6 10 6 18 0 10-5 16-12 16s-12-6-12-16c0-8 2-14 6-18-2-4-2-10 0-18z", P.white, P.mid) +
    path("M27 20h10v5H27z", P.red),
  rug:
    path("M14 18h40l8 28H6z", P.rose, P.darkRed) + path("M18 23h32l5 18H13z", P.pink) +
    path("M32 25l12 7-12 7-12-7z", P.orange, P.deepOrange) + circle(32, 32, 2.5, P.cream) +
    path("M22 28l-6 4 6 4M42 28l6 4-6 4", "none", P.rose) +
    line("M8 49v8M14 49v8M20 49v8M26 49v8M32 49v8M38 49v8M44 49v8M50 49v8M56 49v8", P.darkRed, 2.5),
  hawk:
    path("M8 44c6-8 8-18 6-28 8 2 12 8 14 16z", P.darkBrown, P.ink) +
    ellipse(34, 32, 15, 20, P.brown, P.darkBrown) +
    path("M26 26c0 10 4 16 12 18-2 4-6 6-10 6-6-4-6-16-2-24z", P.cream, P.brown) +
    path("M28 34h8M28 40h8", "none", P.brown) +
    path("M36 18c-4-6 0-12 8-12 6 0 10 4 10 10 0 4-2 8-6 10z", P.brown, P.darkBrown) +
    path("M50 12c6 0 10 4 8 8l-6-1z", P.orange, P.deepOrange) +
    circle(46, 13, 2.6, P.white) + circle(46.6, 13, 1.4, P.ink) + path("M40 9l8 1", "none", P.darkBrown) +
    line("M6 56h52", P.brown, 4) + path("M30 52l-2 6M38 52l2 6", "none", P.orange).replace('stroke-width="2"', 'stroke-width="3"'),
  carrot:
    path("M30 18c10-2 22 16 20 28-2 8-8 10-14 6-8-6-12-18-6-34z", P.orange, P.deepOrange) +
    line("M34 26l8 2M36 34l8 2M32 42l6 2", P.deepOrange, 2) +
    path("M30 18c-6-6-4-12 2-12 4 0 6 4 4 8 4-4 10-2 10 2 0 4-6 6-16 2z", P.green, P.darkGreen),
  surfboard:
    path("M32 4c10 8 12 30 6 56H26c-6-26-4-48 6-56z", P.sky, P.blue) + line("M32 8v50", P.white, 3) + path("M28 52h8v4h-8z", P.blue),
  sailboat:
    path("M32 8v38H12c4-14 10-28 20-38z", P.white, P.mid) + path("M36 16v30h18C50 34 44 24 36 16z", P.rose, P.darkRed) +
    path("M8 48h48l-8 10H16z", P.indigo, P.navy) + line("M32 6v42", P.ink, 2) + path("M4 58c8-3 14-3 20 0s14 3 20 0 10-2 16 0", "none", P.sky).replace('stroke-width="2"', 'stroke-width="3"'),
  fence:
    path("M6 14l5-5 5 5v40H6zM20 14l5-5 5 5v40H20zM34 14l5-5 5 5v40H34zM48 14l5-5 5 5v40H48z", P.white, P.mid) +
    rect(4, 24, 56, 5, P.brown, 1) + rect(4, 40, 56, 5, P.brown, 1),
  bowl:
    path("M6 26h52c0 18-10 28-26 28S6 44 6 26z", P.blue, P.navy) + ellipse(32, 26, 26, 5, P.sky, P.navy) + rect(20, 54, 24, 5, P.navy, 2),
  box:
    path("M8 22l24-10 24 10v28L32 60 8 50z", P.tan, P.brown) + path("M8 22l24 10 24-10M32 32v28", "none", P.brown) +
    path("M22 17l24 10v8l-6-2v-6L16 18z", P.cream, P.brown),
  can:
    path("M16 14h32v38c0 4-7 7-16 7s-16-3-16-7z", P.soft, P.mid) + ellipse(32, 14, 16, 5, P.pale, P.mid) +
    rect(16, 26, 32, 18, P.red) + path("M26 33l6-4 6 4v6l-6 3-6-3z", P.white),
  ring:
    ellipse(32, 42, 17, 15, "none", P.orange).replace('stroke-width="2"', 'stroke-width="7"') +
    ellipse(32, 42, 20.5, 18.5, "none", P.deepOrange).replace('stroke-width="2"', 'stroke-width="1.2"') +
    path("M22 14h20l6 8-16 14-16-14z", P.sky, P.blue) + path("M22 14l10 22 10-22M16 22h32M27 14l-3 8 8 14M37 14l3 8-8 14", "none", P.white).replace('stroke-width="2"', 'stroke-width="1.2"') +
    path("M10 8l3 4-4 0zM54 6l2 5-5-1z", P.sky),
  cricket:
    ellipse(32, 38, 12, 16, P.darkGreen, P.ink) + path("M32 22V10M24 24L10 12M40 24L54 12", "none", P.ink).replace('stroke-width="2"', 'stroke-width="3"') +
    circle(32, 24, 7, P.green, P.ink) + circle(29, 23, 1.8, P.white) + circle(35, 23, 1.8, P.white) + line("M22 40l-12 8M42 40l12 8M24 48l-8 10M40 48l8 10", P.ink, 3) + line("M30 8l-3-4M34 8l3-4", P.ink, 2),
};
