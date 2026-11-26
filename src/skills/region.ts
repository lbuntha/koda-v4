/**
 * Which national curriculum a learner follows, for the few lessons and words
 * that differ by country.
 *
 * Most of Koda is the same everywhere: a ten-frame is a ten-frame. Measurement
 * is not. A US child meets inches and a.m./p.m., an English child meets
 * Roman-numeral clocks and "quarter past", a Cambodian child meets hectares,
 * and all three spell "metre" differently from at least one of the others.
 *
 * Three curricula are supported. Everyone else is `INTL` and sees only the
 * lessons every curriculum shares, in UK spelling (the spelling Cambodian and
 * most international English teaching uses).
 */
export type Region = "US" | "GB" | "KH" | "INTL";

export const REGIONS: readonly Region[] = ["US", "GB", "KH", "INTL"];

/** The curricula a lesson can be limited to. `INTL` is never a lesson's own region. */
export type CurriculumRegion = Exclude<Region, "INTL">;

/**
 * A sign-up country (ISO 3166 two-letter) as a curriculum.
 *
 * England's curriculum stands for the whole UK here: Scotland, Wales and
 * Northern Ireland differ in detail, never in which units exist.
 */
export function regionFromCountry(country?: string | null): Region {
  switch ((country ?? "").toUpperCase()) {
    case "US":
      return "US";
    case "GB":
    case "UK":
      return "GB";
    case "KH":
      return "KH";
    default:
      return "INTL";
  }
}

/** Whether a lesson limited to `regions` is shown in `region`. No list means everywhere. */
export function lessonInRegion(regions: readonly string[] | undefined, region: Region): boolean {
  return !regions || regions.length === 0 || regions.includes(region);
}
