/**
 * Fixed sizes for the learner cards, per device.
 *
 * These are deliberately explicit rather than fluid: the artwork is authored per skill and has
 * to sit in a predictable box, and a row of cards must line up even when one has a longer
 * title. Mobile → tablet (`sm`) → computer (`lg`) in every entry.
 */

/** Artwork panel inside an activity card. */
export const ACTIVITY_ART = "h-28 sm:h-32 lg:h-36";

/** Whole activity card. A fixed height keeps a 3-up row aligned. */
export const ACTIVITY_CARD = "min-h-[15.5rem] sm:min-h-[16.5rem] lg:min-h-[17.5rem]";

/** Artwork panel in the large "next up" card. */
export const NEXT_UP_ART = "h-32 w-32 sm:h-40 sm:w-40 lg:h-44 lg:w-44";

/** Welcome-band mascot. */
export const HERO_MASCOT = "h-28 w-28 sm:h-36 sm:w-36 lg:h-44 lg:w-44";

/** Thumbnail on a compact list row. */
export const ROW_ART = "h-10 w-10 sm:h-11 sm:w-11";

/** Art medallion inside a recommendation card. */
export const MEDALLION = "h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32";

/** Glyph tile on a skill-path card. */
export const PATH_GLYPH = "h-11 w-11 text-sm sm:h-12 sm:w-12 sm:text-base";

/** Scene artwork in the corner of a recommendation card. */
export const REC_ART = "h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28";
