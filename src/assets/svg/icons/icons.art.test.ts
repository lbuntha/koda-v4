import { describe, expect, it } from "vitest";

import { preprocessSvgMarkup, sanitizeSvgMarkup } from "../../../utils/svg";

const files = import.meta.glob("./*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const icons = ["trophy", "weekly-progress"] as const;

const markupOf = (id: string): string => {
  const found = Object.entries(files).find(([path]) => path.endsWith(`/${id}.svg`));
  expect(found, `no icon for ${id}`).toBeTruthy();
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

describe("leaderboard icons", () => {
  it("ships exactly the intended icon set", () => {
    expect(Object.keys(files)).toHaveLength(icons.length);
  });

  it.each(icons)("%s uses the shared icon canvas and survives sanitising", (id) => {
    const markup = markupOf(id);
    expect(markup).toContain('viewBox="0 0 100 100"');
    expect(tally(sanitizeSvgMarkup(markup))).toEqual(tally(markup));
  });
});
