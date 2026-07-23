/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Column Addition — shared arithmetic model.
 *
 * The canvas, the Property Studio panel and the AI generator schema all derive
 * their numbers from here so they can never disagree about what a problem
 * means. Everything is pure and synchronous; there is no React in this file.
 *
 * Unlike additionTutorModel (capped at 99, a single ones→tens carry), this
 * model is per-column and cascades carries across any number of places, so it
 * scales from 1-digit + 1-digit up through 5-digit + 5-digit. Core invariant,
 * true for every legal pair:
 *
 *     answerDigits read most-significant-last === num1 + num2
 */

export interface ColumnChallenge {
  num1: number;
  num2: number;
}

/** Two addends, 0..99,999 — gives 1+1 through 5+5 digit problems. */
export const ADDEND_MIN = 0;
export const MAX_ADDEND_DIGITS = 5;
export const ADDEND_MAX = 99_999;

/** Place names, ones-first, indexed by column position. */
const PLACE_LABELS = ["ones", "tens", "hundreds", "thousands", "ten-thousands", "hundred-thousands"];
/** What a carry *out of* each place is worth, ones-first. Used in captions. */
const CARRY_UNIT = ["ten", "hundred", "thousand", "ten-thousand", "hundred-thousand"];
/** Five addend places plus one possible leading answer carry. */
const MAX_COLUMNS = MAX_ADDEND_DIGITS + 1;

export const clampAddend = (value: unknown): number => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return ADDEND_MIN;
  return Math.min(ADDEND_MAX, Math.max(ADDEND_MIN, n));
};

/** 18 -> [8, 1]; 0 -> [0]. Least-significant digit first. */
function digitsOnesFirst(n: number): number[] {
  if (n === 0) return [0];
  const out: number[] = [];
  let x = n;
  while (x > 0) {
    out.push(x % 10);
    x = Math.floor(x / 10);
  }
  return out;
}

/**
 * One place-value column of the sum, in the order the algorithm works them:
 * `columns[0]` is the ones, `columns[1]` the tens, and so on.
 */
export interface AdditionColumn {
  /** 0 = ones, 1 = tens, 2 = hundreds … */
  place: number;
  placeLabel: string;
  /** This place's digit of each addend (0 when the addend has no digit here). */
  digit1: number;
  digit2: number;
  digit3: number;
  /** Whether the addend actually reaches this place (renders a blank if not). */
  hasDigit1: boolean;
  hasDigit2: boolean;
  hasDigit3: boolean;
  /** Carry received from the column to the right (0..2 for up to three addends). */
  carryIn: number;
  /** digit1 + digit2 + carryIn — may reach 19. */
  columnSum: number;
  /** The digit written under this column (columnSum % 10). */
  digitOut: number;
  /** Carry passed to the next column left (0 or 1). */
  carryOut: number;
}

export interface ColumnAdditionModel {
  num1: number;
  num2: number;
  num3: number | null;
  addendCount: 2 | 3;
  sum: number;
  /** Ones-first — the order the standard algorithm resolves them. */
  columns: AdditionColumn[];
  /** Ones-first answer digits (same length as `columns`). */
  answerDigits: number[];
  /** How many columns pass a carry to the left. */
  carryCount: number;
  anyCarry: boolean;
  /** Digit count of each addend and of the answer. */
  digits1: number;
  digits2: number;
  digits3: number | null;
  answerDigitCount: number;
  /** "3+2" — see describeColumnMode for the human label. */
  digitMode: string;
}

export function buildColumnAdditionModel(
  rawNum1: unknown,
  rawNum2: unknown,
  rawNum3?: unknown,
): ColumnAdditionModel {
  const num1 = clampAddend(rawNum1);
  const num2 = clampAddend(rawNum2);
  const hasThirdAddend = rawNum3 !== undefined && rawNum3 !== null;
  const num3 = hasThirdAddend ? clampAddend(rawNum3) : null;

  const d1 = digitsOnesFirst(num1);
  const d2 = digitsOnesFirst(num2);
  const d3 = hasThirdAddend ? digitsOnesFirst(num3 ?? 0) : [];
  const maxLen = Math.max(d1.length, d2.length, d3.length);

  const columns: AdditionColumn[] = [];
  let carry = 0;
  let place = 0;
  // Keep going while either addend still has digits OR a carry is still in
  // flight — the trailing carry is what grows 99,999 + 1 into a 6-digit answer.
  while ((place < maxLen || carry > 0) && place < MAX_COLUMNS) {
    const hasDigit1 = place < d1.length;
    const hasDigit2 = place < d2.length;
    const digit1 = d1[place] ?? 0;
    const digit2 = d2[place] ?? 0;
    const hasDigit3 = hasThirdAddend && place < d3.length;
    const digit3 = d3[place] ?? 0;
    const columnSum = digit1 + digit2 + digit3 + carry;
    const digitOut = columnSum % 10;
    const carryOut = Math.floor(columnSum / 10);
    columns.push({
      place,
      placeLabel: PLACE_LABELS[place] ?? `place ${place}`,
      digit1,
      digit2,
      digit3,
      hasDigit1,
      hasDigit2,
      hasDigit3,
      carryIn: carry,
      columnSum,
      digitOut,
      carryOut,
    });
    carry = carryOut;
    place++;
  }

  const carryCount = columns.filter(c => c.carryOut > 0).length;

  return {
    num1,
    num2,
    num3,
    addendCount: hasThirdAddend ? 3 : 2,
    sum: num1 + num2 + (num3 ?? 0),
    columns,
    answerDigits: columns.map(c => c.digitOut),
    carryCount,
    anyCarry: carryCount > 0,
    digits1: String(num1).length,
    digits2: String(num2).length,
    digits3: hasThirdAddend ? String(num3).length : null,
    answerDigitCount: columns.length,
    digitMode: [
      String(num1).length,
      String(num2).length,
      ...(hasThirdAddend ? [String(num3).length] : []),
    ].join("+"),
  };
}

/** Human label for the studio, e.g. "3-digit + 2-digit". */
export function describeColumnMode(mode: string): string {
  return mode.split("+").map(value => `${value}-digit`).join(" + ");
}

/**
 * What Koda says while the guide animates one column, split into the two beats
 * the animation plays so speech lands *with* the picture, not ahead of it:
 *
 *   - `add`   — spoken as the column lights up: name it and add it up.
 *   - `write` — spoken as the answer digit drops (and any carry flies): what
 *               to write, and whether a ten/hundred/… carries across.
 *
 * Warm, place-value aware, and built from *this* column's actual digits and
 * carry state, so the explanation always follows the real problem. Centralised
 * here so the canvas can never phrase the arithmetic differently from how the
 * model computed it; carry-in is read first, in the order a child adds.
 *
 * `**…**` marks the words the shared KodaActor highlights as pills and (once
 * stripped) reads aloud — see components/canvases/KodaActor.tsx.
 */
export interface ColumnNarration {
  add: string;
  write: string;
}

export type ColumnErrorType = "missed_carry" | "extra_carry" | "incorrect_column_sum";

/**
 * Explain a wrong answer digit in mathematical terms. This stays in the pure
 * model so feedback, logs and future teacher reports use the same diagnosis.
 */
export function diagnoseColumnError(col: AdditionColumn, selectedDigit: unknown): ColumnErrorType {
  const selected = Number(selectedDigit);
  const addendTotal = col.digit1 + col.digit2 + col.digit3;
  const withoutCarry = addendTotal % 10;
  const withExtraCarry = (addendTotal + 1) % 10;
  if (col.carryIn > 0 && selected === withoutCarry) return "missed_carry";
  if (col.carryIn === 0 && selected === withExtraCarry) return "extra_carry";
  return "incorrect_column_sum";
}

export function columnNarration(col: AdditionColumn): ColumnNarration {
  const unit = CARRY_UNIT[col.place] ?? "unit";
  const nextPlace = PLACE_LABELS[col.place + 1] ?? "next place";
  const lead = col.place === 0 ? "Start with the **ones**" : `Now the **${col.placeLabel}**`;
  const digitsHere = (col.hasDigit1 ? 1 : 0) + (col.hasDigit2 ? 1 : 0) + (col.hasDigit3 ? 1 : 0);

  // A column only the carry reaches — e.g. the leading 1 in 999 + 9 = 1008.
  if (digitsHere === 0) {
    return {
      add: `${lead}: only the carried **${col.carryIn}** reaches here.`,
      write: `Bring it straight down — write **${col.digitOut}** in the **${col.placeLabel}** place.`,
    };
  }
  // Only one number reaches this column and nothing carries — just copy it down.
  if (digitsHere === 1 && !col.carryIn && !col.carryOut) {
    const only = col.hasDigit1 ? col.digit1 : col.digit2;
    return {
      add: `${lead}: there's nothing to add to the **${only}**.`,
      write: `Bring down **${only}** and write it in the **${col.placeLabel}** place.`,
    };
  }

  const parts: string[] = [];
  if (col.carryIn) parts.push(`**${col.carryIn}** carried`);
  if (col.hasDigit1) parts.push(`**${col.digit1}**`);
  if (col.hasDigit2) parts.push(`**${col.digit2}**`);
  if (col.hasDigit3) parts.push(`**${col.digit3}**`);
  const expr = parts.join(" plus ");

  return {
    add: `${lead}: ${expr} makes **${col.columnSum}**.`,
    write: col.carryOut
      ? `Write **${col.digitOut}** in the **${col.placeLabel}** place. Carry **${col.carryOut} ${unit}${col.carryOut > 1 ? "s" : ""}** to the **${nextPlace}** place.`
      : `Write **${col.digitOut}** in the **${col.placeLabel}** place. Nothing carries.`,
  };
}

/**
 * Derive practice problems that rehearse the same skill as the taught one:
 * identical digit shape and identical carrying behaviour, so a lesson about
 * carrying never ends on a problem that does not carry.
 *
 * Deterministic — the same inputs always yield the same list, so this can be
 * called during render without destabilising state. A small seeded PRNG keeps
 * it deterministic while still ranging across 5-digit space where a fixed
 * ±spread search would run dry.
 */
export function generateChallenges(num1: number, num2: number, count = 3): ColumnChallenge[] {
  const target = buildColumnAdditionModel(num1, num2);
  const len1 = target.digits1;
  const len2 = target.digits2;
  const lo = (len: number) => (len === 1 ? 1 : Math.pow(10, len - 1));
  const hi = (len: number) => Math.pow(10, len) - 1;

  const out: ColumnChallenge[] = [];
  const seen = new Set<string>([`${target.num1}:${target.num2}`]);

  let seed = (target.num1 * 131 + target.num2 * 17 + 7) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  let guard = 0;
  while (out.length < count && guard++ < 500) {
    const a = lo(len1) + Math.floor(rand() * (hi(len1) - lo(len1) + 1));
    const b = lo(len2) + Math.floor(rand() * (hi(len2) - lo(len2) + 1));
    const key = `${a}:${b}`;
    if (seen.has(key)) continue;

    const cand = buildColumnAdditionModel(a, b);
    if (cand.digitMode !== target.digitMode) continue;
    if (cand.anyCarry !== target.anyCarry) continue;

    seen.add(key);
    out.push({ num1: a, num2: b });
  }

  return out;
}

/** Coerce authored challenge rows into valid addends, dropping malformed entries. */
export function normaliseChallenges(raw: unknown): ColumnChallenge[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map(c => ({ num1: clampAddend(c.num1), num2: clampAddend(c.num2) }))
    .slice(0, 8);
}
