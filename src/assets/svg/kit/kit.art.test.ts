import { describe, expect, it } from "vitest";

import { preprocessSvgMarkup, sanitizeSvgMarkup } from "../../../utils/svg";

/**
 * Koda's icon kit — the colourful identity icons pages reuse through
 * `UIArtIcon`. One canvas, one palette, and no yellow: amber is hard to read
 * and Koda keeps it off every screen.
 */

const files = import.meta.glob("./*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/* Tailwind amber/yellow/orange shades, the ones Koda rules out. */
const YELLOW = /#(F59E0B|FBBF24|FCD34D|FDE68A|FEF3C7|D97706|B45309|92400E|78350F|EAB308|FACC15|FDE047|CA8A04|F97316|FB923C|EA580C|FFD700|FFFF00)\b/i;

const tally = (markup: string): Record<string, number> => {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const counts: Record<string, number> = {};
  doc.querySelectorAll("*").forEach((element) => {
    const tag = element.tagName.toLowerCase();
    counts[tag] = (counts[tag] ?? 0) + 1;
  });
  return counts;
};

describe("icon kit", () => {
  const entries = Object.entries(files);

  it("has icons, each named kit-*", () => {
    expect(entries.length).toBeGreaterThan(20);
    for (const [path] of entries) expect(path).toMatch(/\/kit-[a-z-]+\.svg$/);
  });

  it.each(entries)("%s uses the shared canvas, survives sanitising and has no yellow", (_path, raw) => {
    const markup = preprocessSvgMarkup(raw);
    expect(markup).toContain('viewBox="0 0 100 100"');
    expect(tally(sanitizeSvgMarkup(markup))).toEqual(tally(markup));
    expect(markup).not.toMatch(YELLOW);
  });
});
