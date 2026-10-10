import { describe, expect, it } from "vitest";
import { PALETTE, colourName, crayonHex, crayonIndex, customColours, hexOfIndex, isColour } from "./palette";

describe("paint palette", () => {
  it("numbers crayons first and custom colours after, and gives each colour back", () => {
    expect(crayonIndex("red")).toBe(1);
    const n = crayonIndex("#A1B2C3");
    expect(n).toBeGreaterThan(PALETTE.length);
    expect(crayonIndex("#a1b2c3")).toBe(n);
    expect(hexOfIndex(n)).toBe("#a1b2c3");
    expect(crayonHex("#A1B2C3")).toBe("#a1b2c3");
  });

  it("accepts crayons and hex colours only", () => {
    expect(isColour("blue")).toBe(true);
    expect(isColour("#123abc")).toBe(true);
    expect(isColour("gold")).toBe(false);
    expect(isColour("#123")).toBe(false);
  });

  it("lists an item's custom colours once, and names them generically", () => {
    expect(customColours([{ color: "red" }, { color: "#ABCDEF" }, { color: "#abcdef" }])).toEqual(["#abcdef"]);
    const t = (k: string) => k;
    expect(colourName(t, "#abcdef")).toBe("paint.thisColour");
    expect(colourName(t, "red")).toBe("paint.color.red");
  });
});
