/**
 * Khmer spelling, as the Khmer Angkor keyboard (Keyman) documents it.
 *
 * Three jobs, all structural — they look at what kind of character each one is,
 * never at what a word means:
 *
 * 1. **Order.** A Khmer syllable is stored in the order it is *spelled*, not the
 *    order it is drawn:
 *
 *        consonant + subscript(s) + consonant shifter + vowel + sign + diacritic
 *
 *    ខ្មែរ is ខ ◌្ម ◌ែ រ even though ◌ែ is drawn to the left. Text typed on a
 *    loose keyboard, pasted from a PDF or written by a model often has the same
 *    look in another order — "invisible typos". `normalizeKhmer` puts every
 *    syllable back in spelling order, applying the keyboard's silent
 *    corrections, so a story word, a quiz word and a child's answer that look
 *    the same *are* the same.
 *
 * 2. **Constraints.** What the keyboard beeps at — two vowels on one
 *    syllable, two subscript signs or two shifters in a row, a bantoc after a
 *    vowel — is `khmerProblem`, so the studio can say what is wrong.
 *
 * 3. **Spelling units.** A Khmer class spells ស្វាយ as ស · ជើងវ · ស្រៈអា · យ:
 *    a consonant, a subscript ("foot"), a vowel. `spellingUnits` splits a word
 *    that way, with the compound vowels a child learns as one (◌ុំ ◌ាំ ◌ុះ ◌េះ
 *    ◌ោះ) kept whole.
 *
 * Mirrored in Python in server/app/library_verify.py; the shared cases in
 * khmer-cases.json keep the two honest.
 */

const COENG = 0x17d2;
const RO = 0x179a;
const DA = 0x178a; // ដ
const TA = 0x178f; // ត
const NNO = 0x178e; // ណ
const NO = 0x1793; // ន
const E = 0x17c1; // ◌េ
const AA = 0x17b6; // ◌ា
const II = 0x17b8; // ◌ី
const U = 0x17bb; // ◌ុ
const OO = 0x17c4; // ◌ោ
const OE = 0x17be; // ◌ើ
const NIKAHIT = 0x17c6; // ◌ំ
const REAHMUK = 0x17c7; // ◌ះ
const BANTOC = 0x17cb; // ◌់
const MUUSIKATOAN = 0x17c9; // ◌៉
const TRIISAP = 0x17ca; // ◌៊

export const isKhmerConsonant = (c: number) => c >= 0x1780 && c <= 0x17a2;
export const isKhmerIndependentVowel = (c: number) => c >= 0x17a3 && c <= 0x17b3;
const isVowel = (c: number) => c >= 0x17b4 && c <= 0x17c5;
const isShifter = (c: number) => c === MUUSIKATOAN || c === TRIISAP;
/** ◌ំ ◌ះ ◌ៈ: signs that behave like vowels ("pseudo vowels"). */
const isPseudoVowel = (c: number) => c >= 0x17c6 && c <= 0x17c8;
const isDiacritic = (c: number) => (c >= 0x17cb && c <= 0x17d1) || c === 0x17d3 || c === 0x17dd;
export const isKhmerBase = (c: number) => isKhmerConsonant(c) || isKhmerIndependentVowel(c);
/** A character that sits on a base rather than starting a syllable. */
export const isKhmerMark = (c: number) => isVowel(c) || isShifter(c) || isPseudoVowel(c) || isDiacritic(c) || c === COENG;

/** Vowels drawn above the consonant; ◌ុ with one of these is really a shifter. */
const ABOVE = new Set([0x17b7, 0x17b8, 0x17b9, 0x17ba, OE]);
/**
 * Which shifter a consonant takes, for the keyboard's "◌ុ + above vowel"
 * correction. Only consonants that take exactly one; ប takes either (ប៉ / ប៊),
 * so it is left for a person to fix.
 */
const SHIFTER_FOR = new Map<number, number>([
  ...[0x1784, 0x1789, 0x1793, 0x1798, 0x1799, 0x179a, 0x179c].map((c) => [c, MUUSIKATOAN] as [number, number]), // ង ញ ន ម យ រ វ
  ...[0x179f, 0x17a0, 0x17a2].map((c) => [c, TRIISAP] as [number, number]), // ស ហ អ
]);

interface Syllable {
  base: number | null; // null: marks with nothing to sit on
  subs: number[]; // subscript consonants, without their coeng
  shifters: number[];
  vowels: number[];
  pseudo: number[];
  diacritics: number[];
  /** Coeng signs with no consonant after them, and anything else left over, in order. */
  stray: number[];
}

const empty = (base: number | null): Syllable => ({ base, subs: [], shifters: [], vowels: [], pseudo: [], diacritics: [], stray: [] });

/** Split code points into syllables (a base and its marks) and other text. */
function parse(cps: number[]): Array<Syllable | number> {
  const out: Array<Syllable | number> = [];
  let cur: Syllable | null = null;
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i];
    if (isKhmerBase(c)) {
      cur = empty(c);
      out.push(cur);
    } else if (isKhmerMark(c)) {
      if (!cur) {
        cur = empty(null);
        out.push(cur);
      }
      if (c === COENG) {
        const next = cps[i + 1];
        if (next !== undefined && isKhmerConsonant(next)) {
          cur.subs.push(next);
          i++;
        } else cur.stray.push(c);
      } else if (isShifter(c)) cur.shifters.push(c);
      else if (isVowel(c)) cur.vowels.push(c);
      else if (isPseudoVowel(c)) cur.pseudo.push(c);
      else cur.diacritics.push(c);
    } else {
      cur = null;
      out.push(c);
    }
  }
  return out;
}

/** The keyboard's silent corrections, applied to one syllable. */
function correct(s: Syllable): Syllable {
  const t: Syllable = { ...s, subs: [...s.subs], vowels: [...s.vowels], shifters: [...s.shifters] };
  // ◌្រ comes after any other subscript: ក្ញ្រ, not ក្រ្ញ.
  t.subs = [...t.subs.filter((c) => c !== RO), ...t.subs.filter((c) => c === RO)];
  // ◌្ដ and ◌្ត look the same: ◌្ដ goes under ណ, ◌្ត under ន.
  if (t.subs.length) {
    if (t.base === NNO && t.subs[0] === TA) t.subs[0] = DA;
    if (t.base === NO && t.subs[0] === DA) t.subs[0] = TA;
  }
  // ◌េ + ◌ា is ◌ោ, and ◌េ + ◌ី is ◌ើ — one vowel each, whichever was typed first.
  const has = (v: number) => t.vowels.includes(v);
  if (t.vowels.length === 2 && has(E) && has(AA)) t.vowels = [OO];
  else if (t.vowels.length === 2 && has(E) && has(II)) t.vowels = [OE];
  // ◌ុ with an above vowel (or with ◌ាំ) is the consonant's shifter mistyped.
  if (!t.shifters.length && t.base !== null && SHIFTER_FOR.has(t.base) && has(U)) {
    const other = t.vowels.filter((v) => v !== U);
    if (t.vowels.length === 2 && other.length === 1 && (ABOVE.has(other[0]) || (other[0] === AA && t.pseudo.includes(NIKAHIT)))) {
      t.vowels = other;
      t.shifters = [SHIFTER_FOR.get(t.base)!];
    }
  }
  return t;
}

const emit = (s: Syllable): number[] => [
  ...(s.base === null ? [] : [s.base]),
  ...s.subs.flatMap((c) => [COENG, c]),
  ...s.shifters,
  ...s.vowels,
  ...s.pseudo,
  ...s.diacritics,
  ...s.stray,
];

/**
 * Text in Khmer spelling order, with the keyboard's silent corrections applied.
 * Anything that is not Khmer passes through untouched; a zero-width space
 * (what Khmer keyboards type between words) is kept. NFC first, so the result
 * is a stable form to compare.
 */
export function normalizeKhmer(text: string): string {
  const cps = [...text.normalize("NFC")].map((ch) => ch.codePointAt(0) ?? 0);
  if (!cps.some((c) => c >= 0x1780 && c <= 0x17ff)) return text.normalize("NFC");
  return String.fromCodePoint(...parse(cps).flatMap((x) => (typeof x === "number" ? [x] : emit(correct(x)))));
}

export type KhmerProblem = "starts_with_mark" | "dangling_coeng" | "two_vowels" | "two_shifters" | "bantoc_misplaced";

/**
 * What the keyboard would beep at, for one word, after correction; null when
 * the word is well formed. Reported in reading order, first problem only.
 */
export function khmerProblem(word: string): KhmerProblem | null {
  const raw = [...word.normalize("NFC")].map((ch) => ch.codePointAt(0) ?? 0);
  if (raw.some((c, i) => c === COENG && raw[i + 1] === COENG)) return "dangling_coeng";
  for (const x of parse(raw)) {
    if (typeof x === "number") continue;
    const s = correct(x);
    if (s.base === null) return "starts_with_mark";
    if (s.stray.length) return "dangling_coeng";
    if (s.vowels.length > 1) return "two_vowels";
    if (s.shifters.length > 1) return "two_shifters";
    if (s.diacritics.includes(BANTOC) && (s.vowels.length || s.pseudo.length || s.shifters.length || s.subs.length)) return "bantoc_misplaced";
  }
  return null;
}

/** The compound vowels a child learns as one: ◌ុំ ◌ាំ ◌ុះ ◌េះ ◌ោះ. */
const COMPOUND: Array<[number, number]> = [[U, NIKAHIT], [AA, NIKAHIT], [U, REAHMUK], [E, REAHMUK], [OO, REAHMUK]];

/**
 * A word in the units a Khmer class spells it with, in spelling order:
 * the consonant (or independent vowel); each subscript as ◌្C; a shifter; the
 * vowel, compound vowels whole; each other sign and diacritic. The word is
 * normalized first, so the units always rejoin to its normal form.
 */
export function spellingUnits(word: string): string[] {
  const cps = [...normalizeKhmer(word)].map((ch) => ch.codePointAt(0) ?? 0);
  const out: string[] = [];
  const s = (...c: number[]) => String.fromCodePoint(...c);
  for (const x of parse(cps)) {
    if (typeof x === "number") {
      out.push(s(x));
      continue;
    }
    if (x.base !== null) out.push(s(x.base));
    for (const c of x.subs) out.push(s(COENG, c));
    for (const c of x.shifters) out.push(s(c));
    const signs = [...x.pseudo];
    for (const v of x.vowels) {
      const k = signs.findIndex((p) => COMPOUND.some(([a, b]) => a === v && b === p));
      if (k >= 0) out.push(s(v, signs.splice(k, 1)[0]));
      else out.push(s(v));
    }
    for (const c of [...signs, ...x.diacritics, ...x.stray]) out.push(s(c));
  }
  return out;
}

/** A unit as drawn on a tile: a mark gets the dotted circle it sits on. */
export const unitLabel = (unit: string): string => {
  const c = unit.codePointAt(0) ?? 0;
  return isKhmerMark(c) ? `◌${unit}` : unit;
};
