import { translate } from "../lib/i18n";

/**
 * The shape of a picture in a book, defined once.
 *
 * A page has to know how much room a picture takes before the picture has
 * arrived — otherwise the words are laid out around nothing and jump when it
 * lands, which on a slow connection is the whole time a child is looking at the
 * page. So a picture has a shape the page can reserve, and everything that makes
 * a picture makes it to that shape: the reader's frame, the AI that draws
 * artwork, and the advice an author is given for a photo.
 *
 * Two shapes, because a picture sits in one of two places. Across the top or
 * bottom of the words it is a banner; beside them it is a portrait. On a phone
 * there is no room beside, so a "side" picture stacks and is a banner too.
 */

export interface PictureShape {
  width: number;
  height: number;
}

/** Above or below the words, and every placement on a phone. */
export const BANNER: PictureShape = { width: 1600, height: 800 };
/** Beside the words, from a small tablet up. */
export const PORTRAIT: PictureShape = { width: 1200, height: 1600 };

/** As a CSS `aspect-ratio` value. */
export const ratioOf = (s: PictureShape): string => `${s.width} / ${s.height}`;

/**
 * Keep the subject inside this share of the picture, and centred.
 *
 * A banner is shown edge to edge and trimmed to fit the frame, so anything at
 * the edge can be cropped by a narrower screen. The middle is what is always
 * seen.
 */
export const SAFE_AREA = 0.8;

export type PictureKind = "banner" | "portrait";

export const SHAPES: Record<PictureKind, PictureShape> = { banner: BANNER, portrait: PORTRAIT };

/** What an author is told about the size, in one line. */
export const describeShape = (kind: PictureKind): string => {
  const s = SHAPES[kind];
  return translate(kind === "banner" ? "studio.picture.shapeWide" : "studio.picture.shapeTall", {
    width: String(s.width),
    height: String(s.height),
    safe: String(Math.round(SAFE_AREA * 100)),
  });
};
