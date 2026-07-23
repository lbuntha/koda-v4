/**
 * Column Subtraction — shared, pure arithmetic model.
 *
 * Operands are constrained to a non-negative five-digit problem. Columns are
 * stored ones-first because that is the order in which the written algorithm
 * is solved. Borrowing can cascade through any number of zeroes.
 */

export const SUBTRACTION_MIN = 0;
export const SUBTRACTION_MAX = 99_999;
export const MAX_SUBTRACTION_DIGITS = 5;

const PLACE_LABELS = ["ones", "tens", "hundreds", "thousands", "ten-thousands"];
const BORROW_UNITS = ["ten", "hundred", "thousand", "ten-thousand"];

export interface ColumnSubtractionChallenge {
  minuend: number;
  subtrahend: number;
}

export interface SubtractionColumn {
  place: number;
  placeLabel: string;
  topDigit: number;
  bottomDigit: number;
  bottomDigit2: number;
  hasTopDigit: boolean;
  hasBottomDigit: boolean;
  hasBottomDigit2: boolean;
  /** One unit already passed from this column to the column on its right. */
  borrowIn: number;
  /** Value remaining before this column borrows from its left neighbour. */
  adjustedTop: number;
  /** One unit borrowed from the column to the left. */
  borrowOut: number;
  /** Number actually used for the subtraction in this column. */
  workingTop: number;
  digitOut: number;
  /** False only for a leading zero that is not written in the answer. */
  requiresAnswer: boolean;
}

export interface ColumnSubtractionModel {
  minuend: number;
  subtrahend: number;
  subtrahend2: number | null;
  rowCount: 2 | 3;
  difference: number;
  columns: SubtractionColumn[];
  answerDigits: number[];
  borrowCount: number;
  anyBorrow: boolean;
  digits1: number;
  digits2: number;
  digits3: number | null;
  answerDigitCount: number;
  digitMode: string;
}

export type SubtractionColumnErrorType =
  | "missed_borrow"
  | "reversed_digits"
  | "extra_borrow"
  | "incorrect_difference";

export interface SubtractionNarration {
  subtract: string;
  write: string;
}

export const clampSubtractionOperand = (value: unknown): number => {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return SUBTRACTION_MIN;
  return Math.min(SUBTRACTION_MAX, Math.max(SUBTRACTION_MIN, number));
};

export function normalizeSubtractionOperands(
  rawMinuend: unknown,
  rawSubtrahend: unknown,
): ColumnSubtractionChallenge {
  const minuend = clampSubtractionOperand(rawMinuend);
  const subtrahend = Math.min(clampSubtractionOperand(rawSubtrahend), minuend);
  return { minuend, subtrahend };
}

export function normalizeMultiRowSubtractionOperands(
  rawMinuend: unknown,
  rawSubtrahend: unknown,
  rawSubtrahend2: unknown,
): { minuend: number; subtrahend: number; subtrahend2: number } {
  const { minuend, subtrahend } = normalizeSubtractionOperands(rawMinuend, rawSubtrahend);
  const subtrahend2 = Math.min(
    clampSubtractionOperand(rawSubtrahend2),
    Math.max(0, minuend - subtrahend),
  );
  return { minuend, subtrahend, subtrahend2 };
}

function digitAt(value: number, place: number): number {
  return Math.floor(value / (10 ** place)) % 10;
}

export function buildColumnSubtractionModel(
  rawMinuend: unknown,
  rawSubtrahend: unknown,
  rawSubtrahend2?: unknown,
): ColumnSubtractionModel {
  const hasThirdRow = rawSubtrahend2 !== undefined && rawSubtrahend2 !== null;
  const normalized = hasThirdRow
    ? normalizeMultiRowSubtractionOperands(rawMinuend, rawSubtrahend, rawSubtrahend2)
    : { ...normalizeSubtractionOperands(rawMinuend, rawSubtrahend), subtrahend2: null };
  const { minuend, subtrahend, subtrahend2 } = normalized;
  const difference = minuend - subtrahend - (subtrahend2 ?? 0);
  const columnCount = Math.max(1, String(minuend).length);
  const requiredCount = Math.max(1, String(difference).length);
  const columns: SubtractionColumn[] = [];
  let borrowIn = 0;

  for (let place = 0; place < columnCount; place++) {
    const topDigit = digitAt(minuend, place);
    const bottomDigit = digitAt(subtrahend, place);
    const bottomDigit2 = subtrahend2 === null ? 0 : digitAt(subtrahend2, place);
    const bottomTotal = bottomDigit + bottomDigit2;
    const adjustedTop = topDigit - borrowIn;
    const borrowOut = Math.max(0, Math.ceil((bottomTotal - adjustedTop) / 10));
    const workingTop = adjustedTop + borrowOut * 10;
    columns.push({
      place,
      placeLabel: PLACE_LABELS[place] ?? `place ${place}`,
      topDigit,
      bottomDigit,
      bottomDigit2,
      hasTopDigit: place < String(minuend).length,
      hasBottomDigit: place < String(subtrahend).length,
      hasBottomDigit2: subtrahend2 !== null && place < String(subtrahend2).length,
      borrowIn,
      adjustedTop,
      borrowOut,
      workingTop,
      digitOut: workingTop - bottomTotal,
      requiresAnswer: place < requiredCount,
    });
    borrowIn = borrowOut;
  }

  const answerDigits = columns.filter(column => column.requiresAnswer).map(column => column.digitOut);
  const borrowCount = columns.filter(column => column.borrowOut > 0).length;

  return {
    minuend,
    subtrahend,
    subtrahend2,
    rowCount: hasThirdRow ? 3 : 2,
    difference,
    columns,
    answerDigits,
    borrowCount,
    anyBorrow: borrowCount > 0,
    digits1: String(minuend).length,
    digits2: String(subtrahend).length,
    digits3: subtrahend2 === null ? null : String(subtrahend2).length,
    answerDigitCount: requiredCount,
    digitMode: [
      String(minuend).length,
      String(subtrahend).length,
      ...(subtrahend2 === null ? [] : [String(subtrahend2).length]),
    ].join("-"),
  };
}

export function describeSubtractionMode(mode: string): string {
  return mode.split("-").map(value => `${value}-digit`).join(" − ");
}

export function diagnoseSubtractionColumnError(
  column: SubtractionColumn,
  selectedDigit: unknown,
): SubtractionColumnErrorType {
  const selected = Number(selectedDigit);
  const bottomTotal = column.bottomDigit + column.bottomDigit2;
  const withoutIncomingBorrow = ((column.topDigit - bottomTotal) + 20) % 10;
  const reversed = Math.abs(column.adjustedTop - bottomTotal);
  const unnecessaryBorrow = column.adjustedTop + 10 - bottomTotal;

  if (column.borrowIn && selected === withoutIncomingBorrow) return "missed_borrow";
  if (column.borrowOut && selected === reversed) return "reversed_digits";
  if (!column.borrowOut && unnecessaryBorrow < 10 && selected === unnecessaryBorrow) return "extra_borrow";
  return "incorrect_difference";
}

export function subtractionColumnNarration(column: SubtractionColumn): SubtractionNarration {
  const lead = column.place === 0 ? "Start with the **ones**" : `Now the **${column.placeLabel}**`;
  const bottomText = column.hasBottomDigit2
    ? `**${column.bottomDigit}** plus **${column.bottomDigit2}**`
    : `**${column.bottomDigit}**`;
  const subtractText = column.hasBottomDigit2
    ? `**${column.workingTop}** minus **${column.bottomDigit}** minus **${column.bottomDigit2}**`
    : `**${column.workingTop}** minus **${column.bottomDigit}**`;

  if (column.borrowOut) {
    const unit = BORROW_UNITS[column.place] ?? "unit";
    const borrowed = `**${column.borrowOut} ${unit}${column.borrowOut > 1 ? "s" : ""}**`;
    if (column.borrowIn) {
      return {
        subtract: `${lead}. This column passed **${column.borrowIn}** to the place on its right. The lower rows total ${bottomText}, so borrow ${borrowed} from the left. The working value is **${column.workingTop}**.`,
        write: `${subtractText} is **${column.digitOut}**. Write **${column.digitOut}** in the **${column.placeLabel}** place.`,
      };
    }
    return {
      subtract: `${lead}. The lower rows total ${bottomText}. **${column.adjustedTop}** is too small, so borrow ${borrowed}. It becomes **${column.workingTop}**.`,
      write: `${subtractText} is **${column.digitOut}**. Write **${column.digitOut}** in the **${column.placeLabel}** place.`,
    };
  }

  const incoming = column.borrowIn
    ? ` This column already gave **${column.borrowIn}** to the place on its right, so **${column.topDigit}** becomes **${column.adjustedTop}**.`
    : "";
  return {
    subtract: `${lead}.${incoming} Subtract ${bottomText} from **${column.adjustedTop}**.`,
    write: `${subtractText} is **${column.digitOut}**. Write **${column.digitOut}** in the **${column.placeLabel}** place.`,
  };
}

/** Deterministic practice problems with the same digit shape and borrow pattern. */
export function generateSubtractionChallenges(
  rawMinuend: unknown,
  rawSubtrahend: unknown,
  count = 3,
): ColumnSubtractionChallenge[] {
  const target = buildColumnSubtractionModel(rawMinuend, rawSubtrahend);
  const challenges: ColumnSubtractionChallenge[] = [];
  let seed = (target.minuend * 31 + target.subtrahend * 17 + 97) >>> 0;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const minTop = target.digits1 === 1 ? 0 : 10 ** (target.digits1 - 1);
  const maxTop = Math.min(SUBTRACTION_MAX, 10 ** target.digits1 - 1);

  for (let attempts = 0; attempts < 400 && challenges.length < count; attempts++) {
    const minuend = Math.floor(minTop + next() * (maxTop - minTop + 1));
    const minBottom = target.digits2 === 1 ? 0 : 10 ** (target.digits2 - 1);
    const maxBottom = Math.min(minuend, 10 ** target.digits2 - 1);
    if (minBottom > maxBottom) continue;
    const subtrahend = Math.floor(minBottom + next() * (maxBottom - minBottom + 1));
    const candidate = buildColumnSubtractionModel(minuend, subtrahend);
    if (
      candidate.digits1 === target.digits1
      && candidate.digits2 === target.digits2
      && candidate.columns.map(column => column.borrowOut).join("")
        === target.columns.map(column => column.borrowOut).join("")
      && !challenges.some(item => item.minuend === minuend && item.subtrahend === subtrahend)
    ) {
      challenges.push({ minuend, subtrahend });
    }
  }
  return challenges;
}
