import type { Region } from "../../region";

/**
 * Every unit Measure It teaches, in one table.
 *
 * Rulers, scales, jugs, conversions and copy all read this, so "1 m = 100 cm"
 * is written once. Amounts are stored as whole numbers of the quantity's base
 * unit (mm, g, mL, s), never as decimals of a bigger unit, so arithmetic is
 * exact and 0.1 + 0.2 never reaches a child.
 */
export type Quantity = "length" | "mass" | "capacity" | "time";
export type UnitSystem = "metric" | "customary" | "time";

export interface Unit {
  id: string;
  quantity: Quantity;
  system: UnitSystem;
  /** How many base units (mm, g, mL, s) one of this unit is. Customary units are exact SI values rounded to base units. */
  base: number;
  /** Symbol shown after a number. US and UK schools write the litre's symbol differently. */
  symbol: string;
  symbolUS?: string;
}

export const UNITS: readonly Unit[] = [
  { id: "mm", quantity: "length", system: "metric", base: 1, symbol: "mm" },
  { id: "cm", quantity: "length", system: "metric", base: 10, symbol: "cm" },
  { id: "m", quantity: "length", system: "metric", base: 1000, symbol: "m" },
  { id: "km", quantity: "length", system: "metric", base: 1_000_000, symbol: "km" },
  { id: "in", quantity: "length", system: "customary", base: 25.4, symbol: "in" },
  { id: "ft", quantity: "length", system: "customary", base: 304.8, symbol: "ft" },
  { id: "yd", quantity: "length", system: "customary", base: 914.4, symbol: "yd" },
  { id: "mi", quantity: "length", system: "customary", base: 1_609_344, symbol: "mi" },
  { id: "g", quantity: "mass", system: "metric", base: 1, symbol: "g" },
  { id: "kg", quantity: "mass", system: "metric", base: 1000, symbol: "kg" },
  { id: "oz", quantity: "mass", system: "customary", base: 28.349523125, symbol: "oz" },
  { id: "lb", quantity: "mass", system: "customary", base: 453.59237, symbol: "lb" },
  { id: "mL", quantity: "capacity", system: "metric", base: 1, symbol: "ml", symbolUS: "mL" },
  { id: "L", quantity: "capacity", system: "metric", base: 1000, symbol: "l", symbolUS: "L" },
  { id: "cup", quantity: "capacity", system: "customary", base: 236.5882365, symbol: "c" },
  { id: "pt", quantity: "capacity", system: "customary", base: 473.176473, symbol: "pt" },
  { id: "qt", quantity: "capacity", system: "customary", base: 946.352946, symbol: "qt" },
  { id: "gal", quantity: "capacity", system: "customary", base: 3785.411784, symbol: "gal" },
  { id: "s", quantity: "time", system: "time", base: 1, symbol: "s" },
  { id: "min", quantity: "time", system: "time", base: 60, symbol: "min" },
  { id: "h", quantity: "time", system: "time", base: 3600, symbol: "h" },
  { id: "day", quantity: "time", system: "time", base: 86_400, symbol: "d" },
  { id: "week", quantity: "time", system: "time", base: 604_800, symbol: "wk" },
];

export function unit(id: string): Unit {
  const found = UNITS.find((u) => u.id === id);
  if (!found) throw new Error(`Unknown unit "${id}"`);
  return found;
}

/** The symbol a learner in `region` reads: "ml" in England and Cambodia, "mL" in the US. */
export const symbolFor = (id: string, region: Region): string => {
  const u = unit(id);
  return region === "US" && u.symbolUS ? u.symbolUS : u.symbol;
};

/**
 * How many `small` make one `big`, when that is a whole number (1 m = 100 cm,
 * 1 ft = 12 in, 1 h = 60 min). Throws for pairs a lesson must never ask about:
 * across quantities, or across systems that do not divide exactly.
 */
export function factor(big: string, small: string): number {
  const a = unit(big);
  const b = unit(small);
  if (a.quantity !== b.quantity) throw new Error(`${big} and ${small} measure different things`);
  const f = a.base / b.base;
  const whole = Math.round(f);
  if (Math.abs(f - whole) > 1e-9 || whole < 1) throw new Error(`${big} is not a whole number of ${small}`);
  return whole;
}

/** Whether a region's lessons use this unit system at all. Cambodia and England teach metric; the US teaches both. */
export const systemTaught = (system: UnitSystem, region: Region): boolean =>
  system !== "customary" || region === "US";
