import { describe, expect, it } from "vitest";
import { preprocessSvgMarkup, sanitizeSvgMarkup } from "../../utils/svg";
import { COUNTABLES } from "./internal/data/subtractionAssets";

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

const tally = (markup: string): Record<string, number> => {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const counts: Record<string, number> = {};
  doc.querySelectorAll("*").forEach((element) => {
    const tag = element.tagName.toLowerCase();
    counts[tag] = (counts[tag] ?? 0) + 1;
  });
  return counts;
};

describe("subtraction ships its own countable art", () => {
  it("ships one drawing per countable and nothing spare", () => {
    expect(Object.keys(files)).toHaveLength(COUNTABLES.length);
  });

  it("uses six distinct silhouettes", () => {
    const shapes = COUNTABLES.map((countable) => countable.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it.each(COUNTABLES)("$one has a stable skill-scoped id", ({ id }) => {
    expect(id).toMatch(NAME_PATTERN);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id.startsWith("subtraction-")).toBe(true);
  });

  it.each(COUNTABLES)("$one survives the SVG sanitiser whole", ({ one }) => {
    const markup = markupOf(one);
    expect(tally(sanitizeSvgMarkup(markup))).toEqual(tally(markup));
  });

  it.each(COUNTABLES)("$one uses the shared optical canvas", ({ one }) => {
    expect(markupOf(one)).toContain('viewBox="0 0 128 128"');
  });
});
