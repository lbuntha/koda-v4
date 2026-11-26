import { describe, expect, it } from "vitest";
import { UNITS, factor, symbolFor, systemTaught, unit } from "./units";

/* Known facts, written out by hand, not derived from the table they check. */
const FACTS: [string, string, number][] = [
  ["cm", "mm", 10],
  ["m", "cm", 100],
  ["km", "m", 1000],
  ["kg", "g", 1000],
  ["L", "mL", 1000],
  ["ft", "in", 12],
  ["yd", "ft", 3],
  ["mi", "yd", 1760],
  ["lb", "oz", 16],
  ["gal", "qt", 4],
  ["qt", "pt", 2],
  ["pt", "cup", 2],
  ["min", "s", 60],
  ["h", "min", 60],
  ["day", "h", 24],
  ["week", "day", 7],
];

describe("measurement units", () => {
  it.each(FACTS)("1 %s is %i %s", (big, small, n) => {
    expect(factor(big, small)).toBe(n);
  });

  it("refuses conversions across quantities or that are not whole", () => {
    expect(() => factor("m", "g")).toThrow();
    expect(() => factor("in", "cm")).toThrow();
    expect(() => factor("cm", "m")).toThrow();
  });

  it("has unique ids, each with a symbol", () => {
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length);
    for (const u of UNITS) expect(u.symbol.length, u.id).toBeGreaterThan(0);
  });

  it("writes millilitres the way each country's schools do", () => {
    expect(symbolFor("mL", "US")).toBe("mL");
    expect(symbolFor("mL", "GB")).toBe("ml");
    expect(symbolFor("L", "KH")).toBe("l");
    expect(symbolFor("cm", "US")).toBe("cm");
  });

  it("teaches customary units in the US only", () => {
    expect(systemTaught("customary", "US")).toBe(true);
    for (const r of ["GB", "KH", "INTL"] as const) expect(systemTaught("customary", r)).toBe(false);
    for (const r of ["US", "GB", "KH", "INTL"] as const) expect(systemTaught("metric", r)).toBe(true);
  });

  it("throws for a unit nobody defined", () => {
    expect(() => unit("furlong")).toThrow();
  });
});
