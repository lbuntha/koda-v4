/**
 * Column Multiplication — pure written-algorithm model.
 *
 * Supports a five-digit multiplicand and a three-digit multiplier. Each
 * multiplier digit creates one shifted partial-product row; multi-digit
 * multipliers then add those rows to form the final product.
 */

export const MULTIPLICAND_MIN = 0;
export const MULTIPLICAND_MAX = 99_999;
export const MULTIPLIER_MIN = 0;
export const MULTIPLIER_MAX = 999;

const PLACE_LABELS = [
  "ones", "tens", "hundreds", "thousands",
  "ten-thousands", "hundred-thousands", "millions", "ten-millions",
];

export interface MultiplicationStep {
  place: number;
  placeLabel: string;
  multiplicandDigit: number;
  multiplierDigit: number;
  carryIn: number;
  total: number;
  digitOut: number;
  carryOut: number;
}

export interface PartialProductRow {
  index: number;
  multiplierPlace: number;
  multiplierPlaceLabel: string;
  multiplierDigit: number;
  shiftZeros: number;
  baseProduct: number;
  value: number;
  /** Ones-first, including the required place-shift zeros. */
  answerDigits: number[];
  steps: MultiplicationStep[];
}

export interface MultiplicationStage {
  id: string;
  kind: "partial" | "final";
  label: string;
  value: number;
  answerDigits: number[];
  partialIndex?: number;
}

export interface ColumnMultiplicationModel {
  multiplicand: number;
  multiplier: number;
  product: number;
  multiplicandDigits: number;
  multiplierDigits: number;
  digitMode: string;
  partialRows: PartialProductRow[];
  stages: MultiplicationStage[];
  productDigits: number[];
  maxAnswerDigits: number;
  anyCarry: boolean;
  carryCount: number;
}

export type MultiplicationErrorType = "missed_carry" | "incorrect_digit";

export const clampMultiplicand = (value: unknown): number => {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return MULTIPLICAND_MIN;
  return Math.min(MULTIPLICAND_MAX, Math.max(MULTIPLICAND_MIN, number));
};

export const clampMultiplier = (value: unknown): number => {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return MULTIPLIER_MIN;
  return Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, number));
};

function digitsOnesFirst(value: number): number[] {
  if (value === 0) return [0];
  const digits: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    digits.push(remaining % 10);
    remaining = Math.floor(remaining / 10);
  }
  return digits;
}

function buildPartialRow(
  multiplicand: number,
  multiplierDigit: number,
  multiplierPlace: number,
): PartialProductRow {
  const topDigits = digitsOnesFirst(multiplicand);
  const steps: MultiplicationStep[] = [];
  let carry = 0;
  let place = 0;

  while (place < topDigits.length || carry > 0) {
    const multiplicandDigit = topDigits[place] ?? 0;
    const total = multiplicandDigit * multiplierDigit + carry;
    steps.push({
      place,
      placeLabel: PLACE_LABELS[place] ?? `place ${place}`,
      multiplicandDigit,
      multiplierDigit,
      carryIn: carry,
      total,
      digitOut: total % 10,
      carryOut: Math.floor(total / 10),
    });
    carry = Math.floor(total / 10);
    place++;
  }

  const baseProduct = multiplicand * multiplierDigit;
  const value = baseProduct * (10 ** multiplierPlace);
  const baseDigits = digitsOnesFirst(baseProduct);
  const answerDigits = [
    ...Array.from({ length: multiplierPlace }, () => 0),
    ...baseDigits,
  ];

  return {
    index: multiplierPlace,
    multiplierPlace,
    multiplierPlaceLabel: PLACE_LABELS[multiplierPlace] ?? `place ${multiplierPlace}`,
    multiplierDigit,
    shiftZeros: multiplierPlace,
    baseProduct,
    value,
    answerDigits,
    steps,
  };
}

export function buildColumnMultiplicationModel(
  rawMultiplicand: unknown,
  rawMultiplier: unknown,
): ColumnMultiplicationModel {
  const multiplicand = clampMultiplicand(rawMultiplicand);
  const multiplier = clampMultiplier(rawMultiplier);
  const multiplierDigitsArray = digitsOnesFirst(multiplier);
  const partialRows = multiplierDigitsArray.map((digit, place) =>
    buildPartialRow(multiplicand, digit, place),
  );
  const product = multiplicand * multiplier;
  const productDigits = digitsOnesFirst(product);
  const stages: MultiplicationStage[] = partialRows.map((row, index) => ({
    id: `partial-${index}`,
    kind: "partial",
    label: `${row.multiplierPlaceLabel} partial product`,
    value: row.value,
    answerDigits: row.answerDigits,
    partialIndex: index,
  }));

  if (partialRows.length > 1) {
    stages.push({
      id: "final-product",
      kind: "final",
      label: "Final product",
      value: product,
      answerDigits: productDigits,
    });
  }

  const carryCount = partialRows.flatMap(row => row.steps).filter(step => step.carryOut > 0).length;

  return {
    multiplicand,
    multiplier,
    product,
    multiplicandDigits: String(multiplicand).length,
    multiplierDigits: String(multiplier).length,
    digitMode: `${String(multiplicand).length}×${String(multiplier).length}`,
    partialRows,
    stages,
    productDigits,
    maxAnswerDigits: Math.max(productDigits.length, ...partialRows.map(row => row.answerDigits.length)),
    anyCarry: carryCount > 0,
    carryCount,
  };
}

export function describeMultiplicationMode(mode: string): string {
  const [a, b] = mode.split("×");
  return `${a}-digit × ${b}-digit`;
}

export function multiplicationStepNarration(
  step: MultiplicationStep,
  shiftZeros = 0,
): { multiply: string; write: string } {
  const carryText = step.carryIn
    ? ` plus the carried **${step.carryIn}**`
    : "";
  const shiftText = shiftZeros
    ? ` This partial row starts with **${shiftZeros} place-value zero${shiftZeros > 1 ? "s" : ""}**.`
    : "";
  return {
    multiply: `${shiftText} In the **${step.placeLabel}** place, **${step.multiplicandDigit}** times **${step.multiplierDigit}**${carryText} makes **${step.total}**.`,
    write: step.carryOut
      ? `Write **${step.digitOut}** and carry **${step.carryOut}** into the next place.`
      : `Write **${step.digitOut}**. Nothing carries to the next place.`,
  };
}

export function diagnoseMultiplicationError(
  step: MultiplicationStep | undefined,
  selectedDigit: unknown,
): MultiplicationErrorType {
  if (!step) return "incorrect_digit";
  const selected = Number(selectedDigit);
  const withoutCarry = (step.multiplicandDigit * step.multiplierDigit) % 10;
  return step.carryIn > 0 && selected === withoutCarry ? "missed_carry" : "incorrect_digit";
}
