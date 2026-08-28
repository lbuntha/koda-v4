import { describe, expect, it } from "vitest";

import { skill } from "./index";
import { PREDEFINED_ASSETS } from "./internal/data/countingAssets";
import { getSkillArt } from "../../assets/svg/skillArt";
import { sanitizeSvgMarkup } from "../../utils/svg";

/**
 * The countable objects are a contract, not decoration.
 *
 * Three things can break them silently, and each has a test here:
 *
 *  1. `sanitizeSvgMarkup` is a fail-closed allowlist. An element it does not
 *     know is *dropped*, not reported — so bad artwork does not throw, it draws
 *     a child a set with four rockets in it instead of seven.
 *  2. The Art page holds ids to `^[a-z0-9]+(-[a-z0-9]+)*$`. An id that fails it
 *     renders perfectly and can never be edited or replaced by an operator.
 *  3. Equal optical weight across the eight is the whole reason this art
 *     replaced emoji. One asset drawn at a different scale reintroduces exactly
 *     the confound the change was made to remove.
 */

/** The rule `svgAssetRoutes.ts` and `generate-svg-ids.mjs` both enforce. */
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Elements the parser sees, by tag name. */
const tally = (markup: string): Record<string, number> => {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const counts: Record<string, number> = {};
  doc.querySelectorAll("*").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    counts[tag] = (counts[tag] ?? 0) + 1;
  });
  return counts;
};

describe("counting ships its own art", () => {
  it("registers everything it ships", () => {
    expect(skill.assets).toEqual([
      "counting-butterfly",
      "counting-crown",
      "counting-fish",
      "counting-frog",
      "counting-gift",
      "counting-leaf",
      "counting-lily-pad",
      "counting-pencil",
      "counting-rocket",
      "counting-sun",
    ]);
  });

  /*
   * Countables are a *subset* of the art.
   *
   * This used to assert the two lists were equal, which held only while every
   * drawing happened to be something you could count. Froggy and her lily pads
   * are scenery — the skill ships them and must never offer them as things to
   * count, or a round would ask a child to "touch each lily pad" on the number
   * line.
   */
  it("offers only countable objects as countables", () => {
    const countables = PREDEFINED_ASSETS.map((a) => a.id);
    expect(countables).toHaveLength(8);
    for (const id of countables) expect(skill.assets).toContain(id);
    expect(countables).not.toContain("counting-frog");
    expect(countables).not.toContain("counting-lily-pad");
  });

  it.each(PREDEFINED_ASSETS)("$name resolve to markup", ({ id }) => {
    expect(getSkillArt(id)).toBeTruthy();
  });

  it.each(PREDEFINED_ASSETS)("$name keep an id the Art page can save", ({ id }) => {
    expect(id).toMatch(NAME_PATTERN);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it.each(PREDEFINED_ASSETS)("$name survive the sanitiser whole", ({ id }) => {
    const markup = getSkillArt(id)!;
    expect(tally(sanitizeSvgMarkup(markup))).toEqual(tally(markup));
  });

  it.each(PREDEFINED_ASSETS)("$name share one viewBox, so sets weigh the same", ({ id }) => {
    expect(getSkillArt(id)).toContain('viewBox="0 0 128 128"');
  });
});
