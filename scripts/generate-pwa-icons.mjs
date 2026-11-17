/**
 * Rasterises the brand mark into the PNG sizes an installed app needs.
 *
 * Run with `npm run icons` after changing public/favicon.svg. The output is
 * committed, so a normal build never needs sharp.
 *
 * Two shapes, not one:
 *  - `icon-*.png` is the mark as drawn, for launchers that show it as-is.
 *  - `maskable-*.png` is full-bleed: the gradient fills the whole square (the
 *    launcher cuts its own circle or squircle out of it) and only the K and
 *    the star shrink into the safe zone. Padding the whole rounded tile on a
 *    dark backdrop instead showed as a frame — a gap around the logo.
 *
 * And the iPhone's `apple-touch-icon.png` is the same full-bleed square at the
 * mark's own scale: iOS rounds the corners itself, and a tile that arrives
 * already rounded shows a gap in each corner.
 *
 * And one that is not an icon at all: `badge-96.png`, the silhouette Android
 * puts in the status bar beside a notification. It is drawn from the *alpha*
 * channel and filled with the system colour, so it has to be a shape on
 * transparency — the app icon was being used, and a full-colour rounded square
 * has alpha everywhere, which the mask turns into a white blob with no mark in
 * it.
 */
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = path.resolve("public/favicon.svg");
const BADGE_SRC = path.resolve("public/badge.svg");
const OUT = path.resolve("public/icons");
const svg = await readFile(SRC);
const source = svg.toString();

/** The mark with square corners: the device's own mask does the rounding. */
const square = source.replace(/<clipPath id="clip"><rect([^>]*?) rx="\d+"/, '<clipPath id="clip"><rect$1 rx="0"');
if (square === source) throw new Error("favicon.svg: could not find the rounded clip to square off");

/** Square, with the glyph (everything after the three background fills) scaled into the middle. */
const MASKABLE_GLYPH = 0.8;
const shift = (512 * (1 - MASKABLE_GLYPH)) / 2;
const backgrounds = /(<rect width="512" height="512" fill="url\(#pink\)" \/>)/;
if (!backgrounds.test(square)) throw new Error("favicon.svg: could not find the background fills");
const maskable = square
  .replace(backgrounds, `$1\n    <g transform="translate(${shift} ${shift}) scale(${MASKABLE_GLYPH})">`)
  .replace(/(\s*<\/g>\s*<\/svg>\s*)$/, "\n    </g>$1");

// Android's maskable spec guarantees only a centred circle of 40% radius is
// visible; the glyph at 80% scale keeps the K and the star's tips inside it.
const BACKDROP = "#3B1FB8"; // the darkest stop of the mark's own gradient

const sizes = [64, 192, 512];

await sharp({ create: { width: 1, height: 1, channels: 4, background: BACKDROP } })
  .png()
  .toBuffer(); // fail fast if sharp cannot run at all

for (const size of sizes) {
  const png = await sharp(svg, { density: 512 }).resize(size, size).png().toBuffer();
  await writeFile(path.join(OUT, `icon-${size}.png`), png);
}

for (const size of [192, 512]) {
  const png = await sharp(Buffer.from(maskable), { density: 512 })
    .resize(size, size)
    .flatten({ background: BACKDROP })
    .png()
    .toBuffer();
  await writeFile(path.join(OUT, `maskable-${size}.png`), png);
}

// Apple ignores the manifest and reads a link tag, composites the icon onto
// white and rounds it itself — so this one is square and opaque.
const apple = await sharp(Buffer.from(square), { density: 512 })
  .resize(180, 180)
  .flatten({ background: BACKDROP })
  .png()
  .toBuffer();
await writeFile(path.join(OUT, "apple-touch-icon.png"), apple);

// 96px is the size Android asks for; it is drawn at about 24dp, so the detail
// that survives is the glyph and nothing else.
const badge = await sharp(await readFile(BADGE_SRC), { density: 512 })
  .resize(96, 96)
  .png()
  .toBuffer();
await writeFile(path.join(OUT, "badge-96.png"), badge);

console.log("wrote icons to public/icons");
