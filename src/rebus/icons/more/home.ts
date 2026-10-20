/** Parts of the body, the house and what we wear. */

import { PAL as P, circle, ellipse, line, path, rect } from "../draw";

export const HOME: Record<string, string> = {
  head:
    ellipse(32, 34, 17, 21, P.cream, P.brown) + path("M15 30c0-14 8-20 17-20s17 6 17 20c-6-6-10-9-17-9s-11 3-17 9z", P.darkBrown) +
    circle(25, 35, 2.4, P.ink) + circle(39, 35, 2.4, P.ink) + line("M26 46c4 4 8 4 12 0", P.brown, 2.5),
  nose:
    path("M30 8c0 14-2 22-8 30-4 5 0 12 8 12h4c8 0 12-7 8-12-6-8-8-16-8-30z", P.cream, P.brown) +
    circle(28, 44, 2.4, P.brown) + circle(40, 44, 2.4, P.brown),
  ear:
    path("M30 8C16 8 12 22 18 34c3 6 2 10 6 16 4 6 14 4 16-4 1-4 6-6 8-12 4-14-2-26-18-26z", P.cream, P.brown) +
    line("M30 18c-7 0-9 8-5 14 2 3 2 5 2 8", P.brown, 2.5),
  mouth:
    path("M6 28c10-8 16-6 26-2 10-4 16-6 26 2-6 20-14 28-26 28S12 48 6 28z", P.rose, P.darkRed) +
    path("M10 31c8-3 14-2 22 0 8-2 14-3 22 0-6 3-14 5-22 5s-16-2-22-5z", P.white),
  arm:
    path("M22 22h20v30H22z", P.cream, P.brown) + path("M16 4h32l4 22H12z", P.sky, P.navy) +
    path("M20 50h24c2 8-2 12-6 12h-12c-4 0-8-4-6-12z", P.cream, P.brown) + path("M44 52l8-6c3-1 4 3 2 5l-8 6", P.cream, P.brown) + line("M27 56v4M32 56v4M37 56v4", P.brown, 2),
  leg:
    path("M26 4h12v30l4 12h12c4 0 5 8-1 10H34c-5 0-8-4-8-10z", P.cream, P.brown) + path("M46 46h8c4 0 5 8-1 10H42z", P.sky, P.navy),
  knee:
    path("M24 4h16v18c4 4 4 12 0 16v22H24V38c-4-4-4-12 0-16z", P.cream, P.brown) + circle(32, 30, 8, P.pink, P.rose),
  finger:
    path("M26 56V20c0-8 12-8 12 0v36z", P.cream, P.brown) + line("M27 28h10", P.brown, 2) + rect(27, 12, 10, 8, P.pink, 4),
  thumb:
    path("M18 56V36c0-8 4-14 10-20 6-8 16 0 10 8l-4 8h14c6 0 6 10 0 10H36v14z", P.cream, P.brown) + rect(24, 12, 12, 9, P.pink, 4),
  heart: path("M32 56C8 40 6 24 14 16c8-6 14-2 18 4 4-6 10-10 18-4 8 8 6 24-18 40z", P.red, P.darkRed),
  bone:
    path("M16 20a7 7 0 1 1 10-6l22 22a7 7 0 1 1 6 10 7 7 0 1 1-10 6L22 30a7 7 0 1 1-6-10z", P.white, P.mid),
  toe:
    ellipse(32, 44, 18, 14, P.cream, P.brown) + circle(18, 22, 6, P.cream, P.brown) + circle(28, 16, 5.5, P.cream, P.brown) + circle(38, 14, 5, P.cream, P.brown) + circle(47, 18, 4.6, P.cream, P.brown),
  hair:
    path("M32 6c-14 0-22 10-22 24 0 10 2 18 4 26 2-6 4-6 6-12 2-8 4-14 12-16 8 2 10 8 12 16 2 6 4 6 6 12 2-8 4-16 4-26C54 16 46 6 32 6z", P.darkBrown),
  door:
    rect(14, 6, 36, 52, P.brown, 3, P.darkBrown) + rect(20, 12, 10, 16, P.tan, 2) + rect(34, 12, 10, 16, P.tan, 2) + rect(20, 34, 10, 16, P.tan, 2) + rect(34, 34, 10, 16, P.tan, 2) + circle(44, 33, 2.6, P.cream),
  window:
    rect(10, 10, 44, 44, P.ice, 3, P.mid) + line("M32 10v44M10 32h44", P.mid, 3) + path("M16 40l10-10M16 48l16-16", "none", P.white),
  wall:
    rect(6, 10, 52, 44, P.rose, 2, P.darkRed) + line("M6 24h52M6 38h52M20 10v14M40 10v14M30 24v14M10 38v16M50 38v16M28 54v-16", P.pink, 2.5),
  chair:
    rect(18, 6, 28, 28, P.brown, 3, P.darkBrown) + rect(14, 34, 36, 8, P.tan, 3, P.brown) + rect(16, 42, 5, 16, P.brown, 2) + rect(43, 42, 5, 16, P.brown, 2),
  table:
    rect(6, 20, 52, 8, P.tan, 3, P.brown) + rect(10, 28, 6, 28, P.brown, 2) + rect(48, 28, 6, 28, P.brown, 2),
  bed:
    rect(6, 24, 6, 32, P.brown, 2) + rect(52, 34, 6, 22, P.brown, 2) + rect(10, 34, 46, 12, P.sky, 3, P.navy) + rect(12, 28, 16, 8, P.white, 4, P.mid) + rect(10, 46, 46, 4, P.brown, 1),
  lamp:
    path("M18 8h28l8 26H10z", P.lav, P.indigo) + rect(29, 34, 6, 18, P.mid, 2) + ellipse(32, 54, 14, 4, P.mid),
  spoon:
    ellipse(32, 18, 11, 14, P.soft, P.mid) + path("M29 30h6l2 28H27z", P.soft, P.mid),
  fork:
    path("M18 6v14c0 6 4 8 8 8V58h6V28c4 0 8-2 8-8V6h-4v14h-4V6h-4v14h-4V6z", P.soft, P.mid),
  knife:
    path("M26 4c10 2 14 14 12 30H26z", P.soft, P.mid) + rect(25, 34, 14, 22, P.brown, 4, P.darkBrown),
  plate:
    circle(32, 32, 24, P.white, P.mid) + circle(32, 32, 15, P.pale, P.soft),
  glass:
    path("M16 8h32l-4 48H20z", P.ice, P.sky) + path("M18 26h28l-2 30H20z", P.sky),
  bottle:
    path("M27 6h10v12c8 4 10 10 10 18v20H17V36c0-8 2-14 10-18z", P.emerald, P.darkGreen) + rect(26, 4, 12, 6, P.mid, 2) + rect(20, 36, 24, 14, P.white, 2),
  bucket:
    path("M12 22h40l-4 34H16z", P.sky, P.navy) + ellipse(32, 22, 20, 5, P.ice, P.navy) + line("M14 22C14 4 50 4 50 22", P.mid, 3),
  brush:
    rect(28, 28, 8, 30, P.brown, 3, P.darkBrown) + path("M22 6h20l2 22H20z", P.rose, P.darkRed) + line("M26 10v16M32 10v16M38 10v16", P.pink, 2),
  comb:
    rect(6, 14, 52, 12, P.sky, 3, P.navy) + path("M10 26v22M16 26v22M22 26v22M28 26v22M34 26v22M40 26v22M46 26v22M52 26v22", "none", P.navy).replace(/stroke-width="2"/, 'stroke-width="3"'),
  soap:
    rect(10, 22, 44, 26, P.pink, 10, P.rose) + circle(18, 12, 5, P.ice, P.sky) + circle(30, 8, 4, P.ice, P.sky) + circle(44, 14, 6, P.ice, P.sky),
  towel:
    rect(10, 6, 44, 52, P.sky, 3, P.navy) + rect(10, 14, 44, 6, P.white, 0) + rect(10, 44, 44, 6, P.white, 0),
  mirror:
    ellipse(32, 26, 17, 21, P.ice, P.mid).replace('stroke-width="2"', 'stroke-width="5"') + path("M24 16c4-4 8-4 10-2", "none", P.white) + rect(29, 47, 6, 10, P.brown, 2),
  ladder:
    rect(16, 4, 5, 56, P.brown, 2) + rect(43, 4, 5, 56, P.brown, 2) + rect(21, 12, 22, 4, P.tan, 1) + rect(21, 24, 22, 4, P.tan, 1) + rect(21, 36, 22, 4, P.tan, 1) + rect(21, 48, 22, 4, P.tan, 1),
  hammer:
    rect(28, 20, 8, 38, P.brown, 3, P.darkBrown) + rect(10, 8, 40, 14, P.mid, 3, P.ink) + path("M50 8l8 4v6l-8 4z", P.soft, P.ink),
  saw:
    path("M6 24h52l-4 18H6z", P.soft, P.mid) + path("M6 42l4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6 4 6 4-6", "none", P.mid) + rect(4, 14, 14, 14, P.brown, 5, P.darkBrown),
  axe:
    rect(28, 8, 6, 50, P.brown, 3, P.darkBrown) + path("M34 10c14-4 22 4 22 4v16s-8 4-22 2z", P.soft, P.mid),
  screw:
    path("M22 6h20v8l-6 4v36l-4 6-4-6V18l-6-4z", P.soft, P.mid) + line("M26 24h12M26 32h12M26 40h12M26 48h12", P.mid, 2.5) + line("M28 10h8", P.mid, 2),
  chain:
    rect(4, 22, 24, 14, "none", 7, P.mid).replace('stroke-width="2"', 'stroke-width="5"') + rect(20, 22, 24, 14, "none", 7, P.ink).replace('stroke-width="2"', 'stroke-width="5"') + rect(36, 22, 24, 14, "none", 7, P.mid).replace('stroke-width="2"', 'stroke-width="5"') + rect(14, 40, 4, 4, "none", 0),
  lock:
    rect(12, 28, 40, 28, P.orange, 5, P.deepOrange) + path("M20 28V20c0-16 24-16 24 0v8", "none", P.mid).replace('stroke-width="2"', 'stroke-width="5"') + circle(32, 40, 4, P.ink) + rect(30, 42, 4, 8, P.ink, 1),
  hat:
    ellipse(32, 48, 28, 7, P.violet, P.indigo) + path("M16 48c0-24 6-36 16-36s16 12 16 36z", P.indigo, P.navy) + rect(16, 38, 32, 6, P.rose, 0),
  coat:
    path("M20 6h24l14 12v38H44V30l-2 26H22l-2-26v26H6V18z", P.sky, P.navy) + line("M32 8v48", P.navy, 2) + circle(36, 24, 1.8, P.navy) + circle(36, 34, 1.8, P.navy),
  sock:
    path("M22 6h18v24l14 10c6 6 4 18-6 18H28c-8 0-12-8-10-16l4-6z", P.rose, P.darkRed) + rect(22, 6, 18, 8, P.white, 0, P.darkRed),
  boot:
    path("M20 6h20v28l14 8c4 4 4 14-2 14H16V6z", P.brown, P.darkBrown) + rect(20, 6, 20, 8, P.tan, 0, P.darkBrown),
  dress:
    path("M24 4h16l-2 14 20 38H6l20-38z", P.pink, P.rose) + rect(24, 14, 16, 5, P.rose, 0),
  belt:
    rect(4, 22, 56, 20, P.brown, 3, P.darkBrown) + rect(24, 18, 16, 28, "none", 6, P.soft).replace('stroke-width="2"', 'stroke-width="5"') + line("M26 32h12", P.mid, 3) + circle(50, 32, 1.8, P.cream) + circle(10, 32, 1.8, P.cream),
  crown:
    path("M8 50L6 18l16 14L32 10l10 22 16-14-2 32z", P.orange, P.deepOrange) + circle(32, 8, 3, P.red) + circle(6, 16, 3, P.red) + circle(58, 16, 3, P.red) + rect(8, 46, 48, 8, P.deepOrange, 2),
  shield:
    path("M32 4l22 8c0 22-4 38-22 48C14 50 10 34 10 12z", P.blue, P.navy) + path("M32 4l22 8c0 22-4 38-22 48z", P.sky) + path("M32 20l4 8h8l-6 6 2 8-8-4-8 4 2-8-6-6h8z", P.white),
  castle:
    rect(10, 22, 44, 36, P.soft, 0, P.mid) + path("M10 22v-8h6v4h6v-4h6v4h8v-4h6v4h6v-4h6v8z", P.soft, P.mid) + path("M26 58V42c0-10 12-10 12 0v16z", P.brown) + rect(16, 28, 5, 8, P.ink, 2) + rect(43, 28, 5, 8, P.ink, 2),
  tower:
    path("M22 58V24h20v34z", P.soft, P.mid) + path("M18 24v-10h5v4h6v-4h6v4h6v-4h5v10z", P.soft, P.mid) + path("M22 14l10-12 10 12z", P.red, P.darkRed) + rect(29, 32, 6, 10, P.ink, 3) + rect(28, 46, 8, 12, P.brown, 4),
  bridge:
    rect(2, 34, 60, 6, P.brown, 1, P.darkBrown) + path("M4 34C16 8 48 8 60 34", "none", P.mid).replace('stroke-width="2"', 'stroke-width="4"') + line("M16 22v12M26 16v18M38 16v18M48 22v12", P.mid, 2.5) + rect(8, 40, 6, 18, P.mid, 0) + rect(50, 40, 6, 18, P.mid, 0),
  road:
    path("M26 4h12l20 56H6z", P.mid) + line("M32 8v6M32 22v8M32 38v10M32 54v4", P.white, 3),
  car:
    path("M4 40v-8c0-4 2-6 6-8l8-12c2-3 4-4 8-4h12c4 0 6 1 8 4l8 12c4 2 6 4 6 8v8z", P.red, P.darkRed) + path("M20 14h8v12H14zM34 14h8l8 12H34z", P.ice) + circle(18, 42, 8, P.ink) + circle(46, 42, 8, P.ink) + circle(18, 42, 3, P.soft) + circle(46, 42, 3, P.soft),
  truck:
    rect(2, 14, 36, 30, P.sky, 3, P.navy) + path("M38 22h12l10 12v10H38z", P.blue, P.navy) + path("M42 26h7l6 8H42z", P.ice) + circle(14, 46, 7, P.ink) + circle(48, 46, 7, P.ink) + circle(14, 46, 2.6, P.soft) + circle(48, 46, 2.6, P.soft),
  train:
    rect(8, 8, 48, 40, P.red, 6, P.darkRed) + rect(14, 14, 15, 14, P.ice, 3) + rect(35, 14, 15, 14, P.ice, 3) + rect(8, 34, 48, 5, P.white, 0) + circle(20, 40, 3, P.cream) + circle(44, 40, 3, P.cream) + line("M6 56h52M12 48l-4 8M52 48l4 8", P.mid, 3),
  boat:
    path("M4 36h56l-8 18H12z", P.brown, P.darkBrown) + rect(30, 14, 4, 22, P.ink, 1) + path("M34 14v18h14z", P.white, P.mid) + path("M2 58c6-4 10-4 14 0s10 4 14 0 10-4 14 0 10 4 14 0", "none", P.sky),
  rocket:
    path("M32 2c10 8 12 22 10 36H22C20 24 22 10 32 2z", P.white, P.mid) + circle(32, 22, 6, P.sky, P.navy) + path("M22 28L10 44l12-2zM42 28l12 16-12-2z", P.red, P.darkRed) + path("M26 38h12l-6 20z", P.orange, P.deepOrange),
};
