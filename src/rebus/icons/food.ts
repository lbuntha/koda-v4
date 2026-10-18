/** Things people eat and drink, and the dishes they come in. */

import { PAL as P, circle, ellipse, line, path, rect } from "./draw";

export const FOOD: Record<string, string> = {
  honey: rect(16, 24, 32, 32, P.orange, 8) + rect(18, 14, 28, 12, P.brown, 4) + rect(22, 34, 20, 14, P.cream, 3) + path("M16 30c4 0 4 8 8 8", P.peach, P.peach),
  egg: ellipse(32, 34, 17, 22, P.white, P.soft) + ellipse(26, 26, 4, 7, P.pale),
  cheese: path("M6 42L54 22v22L6 52z", P.orange) + path("M6 42L54 22 40 12 6 30z", P.peach) + circle(22, 42, 3, P.deepOrange) + circle(36, 38, 3, P.deepOrange) + circle(46, 30, 2.5, P.deepOrange),
  butter: path("M8 32l30-10 18 8v14L26 54 8 46z", P.cream, P.tan) + path("M8 32l18 8 30-10", P.white, P.tan) + line("M26 40v14", P.tan, 2),
  milk: path("M22 8h20l4 12v34H18V20z", P.white, P.soft) + rect(22, 28, 20, 14, P.sky, 3) + path("M22 8h20l4 12H18z", P.blue),
  apple: path("M32 20c-10-6-24 0-22 16s12 22 22 20c10 2 20-4 22-20S42 14 32 20z", P.red) + line("M32 20c0-6 2-10 6-12", P.brown, 3) + path("M36 14c6-4 12-2 14 2-6 4-12 2-14-2z", P.green),
  berry: circle(24, 40, 12, P.rose) + circle(42, 40, 12, P.red) + circle(32, 28, 12, P.rose) + path("M32 14c-4-6-10-6-14-2 4 4 10 4 14 2zM32 14c4-6 10-6 14-2-4 4-10 4-14 2z", P.green) + circle(28, 26, 1.8, P.pink) + circle(36, 30, 1.8, P.pink) + circle(22, 38, 1.8, P.pink) + circle(44, 38, 1.8, P.pink),
  melon: path("M6 30h52c0 16-12 28-26 28S6 46 6 30z", P.green) + path("M10 30h44c0 12-9 22-22 22S10 42 10 30z", P.rose) + circle(24, 38, 2, P.ink) + circle(32, 44, 2, P.ink) + circle(40, 38, 2, P.ink),
  corn: ellipse(32, 30, 11, 22, P.peach, P.orange) + line("M32 10v40M24 20h16M22 30h20M24 40h16", P.orange, 2) + path("M32 58c-14 0-20-14-18-26 6 10 12 14 18 14zM32 58c14 0 20-14 18-26-6 10-12 14-18 14z", P.green),
  bread: path("M10 28c0-12 10-16 22-16s22 4 22 16c0 4-2 6-4 7v17H14V35c-2-1-4-3-4-7z", P.tan, P.brown) + line("M24 24l4 8M34 22l4 8", P.brown, 3),
  cake: rect(10, 34, 44, 20, P.pink, 6) + rect(10, 34, 44, 8, P.rose, 4) + rect(30, 18, 4, 16, P.lav, 1) + path("M32 8c3 4 3 6 0 8-3-2-3-4 0-8z", P.deepOrange) + line("M16 48h32", P.white, 2),
  pie: path("M6 46c0-12 12-22 26-22s26 10 26 22z", P.tan, P.brown) + path("M12 44c2-8 10-14 20-14s18 6 20 14z", P.red) + line("M22 32l4 10M34 30l-2 12M44 34l-6 8", P.brown, 3),
  cup: path("M12 18h32v22a14 14 0 0 1-14 14H26a14 14 0 0 1-14-14z", P.sky, P.blue) + path("M44 24h6a6 6 0 0 1 0 14h-6", "none", P.blue).replace('stroke-width="2"', 'stroke-width="4"') + line("M20 26h16", P.ice, 3),
  pan: circle(26, 36, 20, P.mid) + circle(26, 36, 14, P.ink) + rect(44, 33, 18, 6, P.brown, 3),
  peanut: path("M26 8c8-4 14 4 10 12-2 4 2 6 4 10 4 8-2 20-12 24-8 2-14-6-10-14 2-4-2-6-2-10 0-8 4-18 10-22z", P.tan, P.brown) + circle(28, 20, 1.6, P.brown) + circle(34, 28, 1.6, P.brown) + circle(26, 40, 1.6, P.brown) + circle(32, 48, 1.6, P.brown),
  pepper: path("M22 22h20l4 32H18z", P.mid) + rect(22, 14, 20, 10, P.ink, 5) + circle(28, 18, 1.5, P.white) + circle(36, 18, 1.5, P.white) + circle(32, 38, 5, P.ink) + circle(28, 46, 2, P.ink) + circle(37, 47, 2, P.ink),
  salt: path("M22 22h20l4 32H18z", P.white, P.soft) + rect(22, 14, 20, 10, P.sky, 5) + circle(28, 18, 1.5, P.white) + circle(36, 18, 1.5, P.white) + line("M24 36h16M24 44h16", P.ice, 3),
  ham: ellipse(26, 34, 21, 17, P.pink, P.rose) + ellipse(24, 33, 13, 10, P.rose) + path("M16 30c3-5 9-7 14-6", "none", P.pink).replace('stroke-width="2"', 'stroke-width="4"') + rect(44, 31, 12, 6, P.white, 3, P.soft) + circle(58, 30, 4, P.white, P.soft) + circle(58, 38, 4, P.white, P.soft),
  burger: path("M10 28c0-10 10-16 22-16s22 6 22 16z", P.deepOrange) + circle(22, 20, 1.6, P.cream) + circle(34, 17, 1.6, P.cream) + circle(42, 22, 1.6, P.cream) + path("M8 32c4 4 8-2 12 2s8-2 12 2 8-2 12 2 8-2 12 0v4H8z", P.green) + rect(8, 38, 48, 8, P.darkBrown, 4) + path("M10 48h44c0 6-6 8-12 8H22c-6 0-12-2-12-8z", P.orange),
  tea: path("M12 22h32v16a14 14 0 0 1-14 14H26a14 14 0 0 1-14-14z", P.white, P.mid) + path("M44 28h5a5 5 0 0 1 0 10h-5", "none", P.mid).replace('stroke-width="2"', 'stroke-width="3"') + rect(15, 24, 26, 5, P.brown, 2) + line("M30 24l4-12", P.mid, 2) + rect(32, 8, 8, 8, P.green, 2),
  pot: path("M10 24h44v20a12 12 0 0 1-12 12H22a12 12 0 0 1-12-12z", P.mid) + rect(8, 20, 48, 6, P.ink, 3) + circle(32, 14, 4, P.ink) + rect(4, 30, 6, 4, P.ink, 2) + rect(54, 30, 6, 4, P.ink, 2),
  pumpkin: ellipse(32, 38, 24, 18, P.deepOrange) + ellipse(22, 38, 10, 18, P.orange) + ellipse(42, 38, 10, 18, P.orange) + rect(29, 12, 6, 10, P.darkGreen, 2) + path("M35 16c6-4 10-2 12 2", "none", P.green).replace('stroke-width="2"', 'stroke-width="3"'),
  straw: path("M14 28h36l-4 28H18z", P.white, P.soft) + rect(14, 24, 36, 6, P.sky, 3) + line("M38 24V10h10", P.rose, 5) + line("M38 22V12", P.white, 1.5),
  bacon: path("M8 20c8-6 12 6 20 0s12 6 20 0v10c-8 6-12-6-20 0s-12-6-20 0z", P.red) + path("M8 36c8-6 12 6 20 0s12 6 20 0v10c-8 6-12-6-20 0s-12-6-20 0z", P.rose) + path("M14 24c4-2 8 2 12 0", P.pink, P.pink),
  chili: path("M14 20c10-6 24-2 30 12s8 18 12 26c-16 2-30-6-38-22-4-8-8-12-4-16z", P.red) + path("M14 20c-4-2-6-8-2-12 4-2 8 2 10 8z", P.green) + path("M20 24c8-2 14 4 18 12", "none", P.white).replace('stroke-width="2"', 'stroke-width="3"').replace('<path', '<path opacity=".5"'),
  jam: rect(16, 20, 32, 34, P.red, 8) + rect(16, 14, 32, 10, P.indigo, 4) + rect(22, 30, 20, 14, P.cream, 3) + circle(32, 37, 4, P.darkRed),
  nut: ellipse(32, 38, 16, 18, P.brown) + path("M16 30c0-10 8-16 16-16s16 6 16 16z", P.darkBrown) + line("M32 14V8", P.brown, 3) + path("M24 40c2 4 6 6 8 6", "none", P.tan).replace('stroke-width="2"', 'stroke-width="3"'),
  dough: ellipse(32, 36, 24, 16, P.cream, P.tan) + path("M16 32c4-6 12-8 20-6", "none", P.white).replace('stroke-width="2"', 'stroke-width="3"') + rect(6, 46, 52, 8, P.brown, 4),
};
