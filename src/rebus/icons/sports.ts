/** Balls, equipment and the people of sport. Flat, a few shapes each, readable at the size of a puzzle piece. */

import { PAL as P, circle, ellipse, line, path, rect } from "./draw";

const pentagon = (cx: number, cy: number, r: number): string => {
  const pts = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join("L")}z`;
};

export const SPORTS: Record<string, string> = {
  // A football: white with a dark centre patch, seams and patches round the edge.
  ball:
    circle(32, 32, 23, P.white, P.ink) +
    path(pentagon(32, 32, 8), P.ink) +
    line("M32 24V14M39.6 29.5L48 25M36.7 38.5L42 46M27.3 38.5L22 46M24.4 29.5L16 25", P.ink, 2) +
    path(pentagon(32, 11.5, 4.2), P.ink) + path(pentagon(51.5, 25.5, 4.2), P.ink) + path(pentagon(44, 49, 4.2), P.ink) + path(pentagon(20, 49, 4.2), P.ink) + path(pentagon(12.5, 25.5, 4.2), P.ink),
  basketball:
    circle(32, 32, 23, P.orange, P.deepOrange) +
    line("M32 9v46M9 32h46", P.darkBrown, 2) +
    line("M15 14c9 9 9 27 0 36M49 14c-9 9-9 27 0 36", P.darkBrown, 2),
  base:
    ellipse(32, 54, 24, 4, P.tan) +
    path("M32 20l24 13-24 13-24-13z", P.white, P.mid) +
    path("M8 33v7l24 13v-7z", P.pale, P.mid) + path("M56 33v7L32 53v-7z", P.soft, P.mid),
  bat:
    '<g transform="rotate(42 32 32)">' +
    path("M27 4h10c2 10 2 28 0.5 40l-1.5 12h-8l-1.5-12C25 32 25 14 27 4z", P.tan, P.brown) +
    line("M26.5 44h11M26 49h12", P.brown, 2) + rect(27.5, 52, 9, 8, P.brown, 3) +
    "</g>",
  racket:
    '<g transform="rotate(35 32 32)">' +
    ellipse(32, 20, 14, 17, "none", P.indigo).replace('stroke-width="2"', 'stroke-width="4"') +
    line("M32 5v30M20 14h24M18 20h28M20 26h24M24 8v24M40 8v24", P.soft, 1.3) +
    rect(29.5, 36, 5, 20, P.brown, 2) + rect(29, 52, 6, 7, P.rose, 2) +
    "</g>",
  net:
    rect(5, 8, 4, 48, P.mid, 2) + rect(55, 8, 4, 48, P.mid, 2) +
    rect(9, 12, 46, 5, P.white, 1, P.ink) +
    line("M9 24h46M9 32h46M9 40h46M9 48h46M17 17v32M25 17v32M33 17v32M41 17v32M49 17v32", P.ink, 1.6),
  goal:
    line("M10 56V18h44v38", P.mid, 4) +
    line("M14 24l-4 30M24 20l-3 34M34 20l1 34M44 20l3 34M52 24l4 30M12 30h40M11 40h42M10 50h44", P.soft, 1.6) +
    circle(46, 52, 7, P.white, P.ink) + path(pentagon(46, 52, 3), P.ink),
  medal:
    path("M20 6h10l6 20h-9zM44 6H34l-6 20h9z", P.rose) +
    circle(32, 40, 16, P.orange, P.deepOrange) + circle(32, 40, 11, P.peach) +
    path("M32 31l2.6 6 6.4.6-4.8 4.2 1.4 6.4-5.6-3.4-5.6 3.4 1.4-6.4-4.8-4.2 6.4-.6z", P.deepOrange),
  trophy:
    path("M18 10h28v16c0 10-6 16-14 16s-14-6-14-16z", P.orange, P.deepOrange) +
    line("M18 15c-8 0-8 12 2 14M46 15c8 0 8 12-2 14", P.deepOrange, 3) +
    rect(29, 42, 6, 8, P.deepOrange, 1) + rect(21, 50, 22, 7, P.brown, 2) +
    path("M26 16c0 8 2 14 6 16", P.peach, P.peach),
  whistle:
    rect(6, 24, 30, 14, P.mid, 6, P.ink) +
    circle(44, 36, 13, P.mid, P.ink) + circle(44, 36, 5, P.pale) +
    rect(9, 21, 14, 4, P.ink, 2) + circle(54, 16, 5, "none", P.mid).replace('stroke-width="2"', 'stroke-width="3"') + line("M47 24l4-5", P.mid, 3),
  helmet:
    path("M8 40c0-16 11-26 24-26s24 10 24 26z", P.red, P.darkRed) +
    rect(6, 38, 52, 8, P.darkRed, 4) +
    path("M30 14c2 8 2 16 0 24h4c2-8 2-16 0-24z", P.white) +
    rect(40, 38, 12, 5, P.soft, 2),
  glove:
    path("M16 26c0-10 6-15 16-15s16 5 16 15v14c0 8-6 12-16 12s-16-4-16-12z", P.red, P.darkRed) +
    path("M14 36c-6-2-7-9-3-12 3-2 7 0 8 4z", P.red, P.darkRed) +
    rect(20, 48, 24, 12, P.white, 3, P.soft) + line("M26 52v5M32 52v5M38 52v5", P.soft, 2) +
    line("M24 26c3-4 13-4 16 0", P.darkRed, 2),
  skate:
    path("M14 8h16v22l13 7c5 3 8 6 8 11v3H12z", P.sky, P.blue) +
    path("M14 8h16v8H14z", P.white, P.blue) +
    line("M16 22h12M17 27h12M20 32h14", P.white, 2) +
    rect(8, 52, 48, 3.5, P.mid, 1.7) + path("M8 53c-4 0-5-3-4-5", "none", P.mid).replace('stroke-width="2"', 'stroke-width="3"') +
    rect(17, 45, 4, 8, P.mid, 1) + rect(42, 45, 4, 8, P.mid, 1),
  ski:
    line("M12 56L46 8", P.indigo, 5) + line("M22 58L54 14", P.rose, 5) +
    line("M8 16L28 52M32 14L44 48", P.mid, 2) + circle(8, 16, 3, P.mid) + circle(32, 14, 3, P.mid),
  skateboard:
    path("M6 28h52c2 0 3 2 2 3l-3 3H9l-3-3c-1-1 0-3 0-3z", P.violet, P.indigo) +
    circle(18, 44, 6, P.ink) + circle(46, 44, 6, P.ink) + circle(18, 44, 2.4, P.pale) + circle(46, 44, 2.4, P.pale) +
    line("M18 34v4M46 34v4", P.mid, 3),
  hoop:
    rect(12, 6, 40, 26, P.white, 3, P.mid) + rect(24, 16, 16, 12, "none", 0, P.red) +
    ellipse(32, 36, 14, 3.4, "none", P.deepOrange).replace('stroke-width="2"', 'stroke-width="3"') +
    line("M19 37l5 18M27 39l2 17M37 39l-2 17M45 37l-5 18M22 46h20M24 53h16", P.soft, 1.6),
  target:
    circle(32, 32, 24, P.red) + circle(32, 32, 18, P.white) + circle(32, 32, 12, P.red) + circle(32, 32, 6, P.white) + circle(32, 32, 2.6, P.red) +
    line("M32 32l22-22", P.brown, 3) + path("M54 10l-8 1 7 7z", P.ink) + line("M50 12l5-5M54 16l5-5", P.ink, 2),
  arrow:
    line("M10 54L54 10", P.brown, 3) + path("M58 6l-12 3 9 9z", P.mid, P.ink) +
    path("M10 54l-2-10 8 4zM10 54l10 2-4-8z", P.rose) + line("M16 48l-5 5", P.rose, 3),
  goggles:
    rect(2, 26, 60, 4, P.ink, 2) +
    circle(20, 34, 13, P.sky, P.ink) + circle(44, 34, 13, P.sky, P.ink) + rect(30, 31, 4, 6, P.ink, 2) +
    path("M12 30c3-4 8-5 12-3", "none", P.white).replace('stroke-width="2"', 'stroke-width="3"') + path("M36 30c3-4 8-5 12-3", "none", P.white).replace('stroke-width="2"', 'stroke-width="3"'),
  shoe:
    path("M6 38c0-6 4-8 8-8l10 2 8 6h14c6 0 12 3 12 9v3H6z", P.blue, P.navy) +
    rect(6, 47, 58, 7, P.white, 3, P.soft) + path("M24 32l4-8h8l-4 10z", P.sky) +
    line("M28 36l8 0M30 40h8", P.white, 2) + circle(14, 44, 1.6, P.white),
  cap:
    path("M10 38c0-14 9-22 22-22s22 8 22 22z", P.blue, P.navy) +
    path("M30 38h30c0 5-6 8-12 8H30z", P.navy) + circle(32, 15, 3, P.navy) + line("M32 18v18", P.navy, 2),
  stopwatch:
    circle(32, 36, 22, P.white, P.mid) + circle(32, 36, 18, P.pale) +
    rect(28, 6, 8, 6, P.mid, 2) + rect(30, 11, 4, 5, P.mid, 1) + line("M50 18l4-4", P.mid, 4) +
    line("M32 36V24M32 36l9 6", P.red, 3) + circle(32, 36, 2.6, P.ink) + line("M32 20v2M32 52v2M16 36h2M46 36h2", P.mid, 2),
  dumbbell:
    rect(14, 29, 36, 6, P.mid, 2) +
    rect(6, 18, 8, 28, P.ink, 3) + rect(14, 22, 6, 20, P.mid, 2) +
    rect(50, 18, 8, 28, P.ink, 3) + rect(44, 22, 6, 20, P.mid, 2),
  flag:
    rect(12, 6, 4, 54, P.mid, 2) +
    path("M16 8c8-4 14 4 22 0s12-4 12-4v24c0 0-4 0-12 4s-14-4-22 0z", P.red, P.darkRed) +
    path("M22 14l4 4M30 12l3 4", P.white, P.white),
  kite:
    path("M32 4l20 20-20 28-20-28z", P.pink, P.rose) + path("M32 4v48M12 24h40", P.rose, P.rose) +
    path("M32 52c-4 4 4 6 0 10M32 52c4 4-4 6 0 10", "none", P.mid) + path("M30 56l-4 0M34 60l4 0", P.rose, P.rose),
  rope:
    rect(6, 10, 6, 18, P.rose, 3) + rect(52, 10, 6, 18, P.rose, 3) +
    line("M9 28c0 36 46 36 46 0", P.mid, 3),
  cone:
    path("M32 6l14 44H18z", P.orange, P.deepOrange) + path("M26 24h12l3 10H23z", P.white) +
    rect(10, 48, 44, 8, P.deepOrange, 3),
  wheel:
    circle(32, 32, 24, P.ink) + circle(32, 32, 18, P.pale) + circle(32, 32, 4, P.mid) +
    line("M32 14v36M14 32h36M19 19l26 26M45 19L19 45", P.mid, 2),
  bike:
    circle(14, 42, 12, "none", P.ink).replace('stroke-width="2"', 'stroke-width="3"') + circle(50, 42, 12, "none", P.ink).replace('stroke-width="2"', 'stroke-width="3"') +
    line("M14 42l12-18h16l8 18M26 24l8 18H14M22 16h8M40 24l-2-8h6", P.rose, 3) + circle(34, 42, 2.4, P.mid),
  runner:
    circle(38, 12, 6, P.violet) +
    line("M36 20l-6 14 10 8-2 14M30 34l-12 4M36 22l10 8M36 22l-8 6", P.indigo, 5),
};
