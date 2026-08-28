/**
 * Rasterises the brand mark into the PNG sizes an installed app needs.
 *
 * Run with `npm run icons` after changing public/favicon.svg. The output is
 * committed, so a normal build never needs sharp.
 *
 * Two shapes, not one:
 *  - `icon-*.png` is the mark as drawn, for launchers that show it as-is.
 *  - `maskable-*.png` pads the mark into the safe zone, because Android crops
 *    an adaptive icon to a circle or squircle and an un-padded mark loses its
 *    corners.
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = path.resolve("public/favicon.svg");
const OUT = path.resolve("public/icons");
const svg = await readFile(SRC);

// Android's maskable spec guarantees only the middle 80% is visible; the safe
// zone is a circle of 40% radius. 12% padding a side keeps the glyph inside it.
const MASKABLE_PAD = 0.12;
const BACKDROP = "#4527C9"; // the darkest stop of the mark's own gradient

const sizes = [64, 192, 512];

await sharp({ create: { width: 1, height: 1, channels: 4, background: BACKDROP } })
  .png()
  .toBuffer(); // fail fast if sharp cannot run at all

for (const size of sizes) {
  const png = await sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();
  await writeFile(path.join(OUT, `icon-${size}.png`), png);
}

for (const size of [192, 512]) {
  const inner = Math.round(size * (1 - MASKABLE_PAD * 2));
  const pad = Math.round((size - inner) / 2);
  const mark = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
  const png = await sharp({
    create: { width: size, height: size, channels: 4, background: BACKDROP },
  })
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toBuffer();
  await writeFile(path.join(OUT, `maskable-${size}.png`), png);
}

// Apple ignores the manifest and reads a link tag, and it composites the icon
// onto white — so this one is flattened rather than transparent.
const apple = await sharp(svg, { density: 512 })
  .resize(180, 180)
  .flatten({ background: BACKDROP })
  .png()
  .toBuffer();
await writeFile(path.join(OUT, "apple-touch-icon.png"), apple);

console.log("wrote icons to public/icons");
