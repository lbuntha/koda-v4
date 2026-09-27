import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SvgMarkup, aspectOfViewBox } from "./SvgAsset";

/**
 * Filling a wide frame with a drawing, without cutting the top off one that was
 * never made to lose it. A near-square drawing across the top of a page would
 * lose its flag or its roof; one drawn to the banner's shape loses nothing.
 */

const svg = (viewBox: string) => `<svg viewBox="${viewBox}"><rect width="10" height="10"/></svg>`;
const fitOf = (markup: string, cover: boolean | number) => {
  const { container } = render(<SvgMarkup markup={markup} size="100%" cover={cover} />);
  return container.querySelector("svg")?.getAttribute("preserveAspectRatio");
};

describe("reading a drawing's shape", () => {
  it("is its viewBox's width over its height", () => {
    expect(aspectOfViewBox(svg("0 0 1600 800"))).toBe(2);
    expect(aspectOfViewBox(svg("0 0 200 128"))).toBeCloseTo(1.5625);
    expect(aspectOfViewBox(svg("0,0,512,512"))).toBe(1);
  });

  it("is nothing when there is no viewBox to read", () => {
    expect(aspectOfViewBox("<svg><rect/></svg>")).toBeNull();
    expect(aspectOfViewBox(svg("0 0 nope 800"))).toBeNull();
    expect(aspectOfViewBox(svg("0 0 100 0"))).toBeNull();
  });
});

describe("a drawing across the top of a page", () => {
  it("fills the width when it is drawn to the banner's shape", () => {
    expect(fitOf(svg("0 0 1600 800"), 1.7)).toBe("xMidYMid slice");
  });

  it("is shown whole when it is close to square", () => {
    expect(fitOf(svg("0 0 512 512"), 1.7)).not.toBe("xMidYMid slice");
    expect(fitOf(svg("0 0 200 128"), 1.7)).not.toBe("xMidYMid slice");
  });

  it("is always trimmed when told to cover outright", () => {
    expect(fitOf(svg("0 0 512 512"), true)).toBe("xMidYMid slice");
  });
});
