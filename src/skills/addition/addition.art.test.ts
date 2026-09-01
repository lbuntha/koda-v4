import { describe, expect, it } from "vitest";
import { COUNTABLES } from "./internal/data/additionAssets";
import { preprocessSvgMarkup, sanitizeSvgMarkup } from "../../utils/svg";

/**
 * The countable objects are a contract, not decoration.
 *
 * `sanitizeSvgMarkup` is a fail-closed allowlist: an element it does not know
 * is *dropped*, not reported. So artwork that breaks the policy does not
 * throw — it quietly draws a child a set with four apples in it instead of
 * seven, which is a wrong answer the child cannot see the cause of. That is
 * what this file is here to catch, and it is worth catching in Phase 0, before
 * anything renders these.
 *
 * The registration half of this suite arrives with `index.ts` in Phase 1;
 * these are the properties the files themselves must hold.
 */

/** The rule `svgAssetRoutes.ts` and `generate-svg-ids.mjs` both enforce. */
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const files = import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const markupOf = (name: string): string => {
  const found = Object.entries(files).find(([path]) => path.endsWith(`/${name}.svg`));
  expect(found, `no drawing for ${name}`).toBeTruthy();
  return preprocessSvgMarkup(found![1]);
};

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

describe("addition ships its own art", () => {
  it("ships one drawing per countable and nothing spare", () => {
    expect(Object.keys(files)).toHaveLength(COUNTABLES.length);
  });

  it("gives no two countables the same silhouette", () => {
    // Two objects of one outline in two bins turns "how many altogether" into
    // a discrimination task, which is not what any of these lessons assess.
    const shapes = COUNTABLES.map((c) => c.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it.each(COUNTABLES)("$one keeps an id the Art page can save", ({ id }) => {
    expect(id).toMatch(NAME_PATTERN);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id.startsWith("addition-")).toBe(true);
  });

  it.each(COUNTABLES)("$one survives the sanitiser whole", ({ one }) => {
    const markup = markupOf(one);
    expect(tally(sanitizeSvgMarkup(markup))).toEqual(tally(markup));
  });

  it.each(COUNTABLES)("$one shares one viewBox, so sets weigh the same", ({ one }) => {
    expect(markupOf(one)).toContain('viewBox="0 0 128 128"');
  });
});
