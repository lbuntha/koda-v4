/**
 * Coaching a child through a Khmer spelling, unit by unit.
 *
 * Built on the spelling units of `khmer.ts` (consonant · foot · shifter ·
 * vowel · sign). Three things a Khmer class does that a plain letter ring
 * does not:
 *
 * 1. **Names.** Each unit is spoken of by its classroom name — ◌្ម is ជើងម,
 *    ◌ែ is ស្រៈអែ, ◌់ is បន្តក់ — so a hint can say "next is ជើងម".
 * 2. **Order.** A child who has every piece but in the drawn order (◌ែ before
 *    ◌្ម, because ◌ែ is drawn on the left) is told the rule, not just ✕.
 * 3. **Decoys that teach.** A spare tile is one a child really confuses with a
 *    piece of the word — ◌ិ for ◌ី, គ for ក, ◌្ត for ◌្ដ — never a random letter
 *    that is easy to ignore.
 *
 * Pure and deterministic, so the same word always coaches the same way.
 *
 * Khmer here is written as code points (`k(...)`): two strings that look the
 * same are exactly what Khmer spelling is about, so none is typed as a glyph.
 *
 * The names follow the usual classroom convention (a vowel is ស្រៈ with the
 * vowel on អ; a foot is ជើង with its consonant). They want a native speaker's
 * review before release, the sign names especially.
 */

import { isKhmerConsonant, isKhmerIndependentVowel, normalizeKhmer } from "./khmer";

export type UnitKind = "consonant" | "foot" | "shifter" | "vowel" | "sign";

const k = (...cps: number[]) => String.fromCodePoint(...cps);
const COENG = 0x17d2;
const DOTTED = "◌";
const cp = (u: string, i = 0) => [...u][i]?.codePointAt(0) ?? 0;

const SRA = k(0x179f, 0x17d2, 0x179a, 0x17c8); // ស្រៈ
const CHOEUNG = k(0x1787, 0x17be, 0x1784); // ជើង
const QA = k(0x17a2); // អ, the carrier a vowel is named on

const SHIFTER_NAME: Record<number, string> = {
  0x17c9: k(0x1798, 0x17bc, 0x179f, 0x17b7, 0x1780, 0x1791, 0x1793, 0x17d2, 0x178f), // មូសិកទន្ត
  0x17ca: k(0x178f, 0x17d2, 0x179a, 0x17b8, 0x179f, 0x1796, 0x17d2, 0x1791), // ត្រីសព្ទ
};
const SIGN_NAME: Record<number, string> = {
  0x17cb: k(0x1794, 0x1793, 0x17d2, 0x178f, 0x1780, 0x17cb), // បន្តក់
  0x17cc: k(0x179a, 0x1794, 0x17b6, 0x1791), // របាទ
  0x17cd: k(0x1791, 0x178e, 0x17d2, 0x178c, 0x1783, 0x17b6, 0x178f), // ទណ្ឌឃាត
  0x17ce: k(0x1780, 0x17b6, 0x1780, 0x1794, 0x17b6, 0x1791), // កាកបាទ
  0x17cf: k(0x17a2, 0x179f, 0x17d2, 0x178f, 0x17b6), // អស្តា
  0x17d0: k(0x179f, 0x17c6, 0x1799, 0x17c4, 0x1782, 0x179f, 0x1789, 0x17d2, 0x1789, 0x17b6), // សំយោគសញ្ញា
  0x17d1: k(0x179c, 0x17b7, 0x179a, 0x17b6, 0x1798), // វិរាម
  0x17c8: k(0x1799, 0x17bb, 0x1782, 0x179b, 0x1796, 0x17b7, 0x1793, 0x17d2, 0x1791, 0x17bb), // យុគលពិន្ទុ
};

export function unitKind(unit: string): UnitKind {
  const c = cp(unit);
  if (isKhmerConsonant(c) || isKhmerIndependentVowel(c)) return "consonant";
  if (c === COENG) return "foot";
  if (c in SHIFTER_NAME) return "shifter";
  if ((c >= 0x17b4 && c <= 0x17c5) || c === 0x17c6 || c === 0x17c7) return "vowel";
  return "sign";
}

/** The order units come in within a syllable. */
const RANK: Record<UnitKind, number> = { consonant: 0, foot: 1, shifter: 2, vowel: 3, sign: 4 };

/** What a class calls a unit: ក → ក, ◌្ម → ជើងម, ◌ែ → ស្រៈអែ, ◌៉ → មូសិកទន្ត. */
export function unitName(unit: string): string {
  const kind = unitKind(unit);
  if (kind === "consonant") return unit;
  if (kind === "foot") return CHOEUNG + [...unit].slice(1).join("");
  if (kind === "shifter") return SHIFTER_NAME[cp(unit)];
  if (kind === "vowel") return SRA + normalizeKhmer(QA + unit);
  return SIGN_NAME[cp(unit)] ?? unit;
}

/** The name with the shape to look for: "ជើងម (◌្ម)". A consonant is its own name. */
export const unitCue = (unit: string): string =>
  unitKind(unit) === "consonant" ? unit : `${unitName(unit)} (${DOTTED}${unit})`;

/** Vowels drawn in front of (left of) the consonant, though spelled after it: ◌េ ◌ែ ◌ៃ ◌ោ ◌ៅ ◌ើ ◌ឿ ◌ៀ. */
const DRAWN_LEFT = new Set([0x17c1, 0x17c2, 0x17c3, 0x17c4, 0x17c5, 0x17be, 0x17bf, 0x17c0]);
/** ◌្រ is drawn on the left of its consonant too. */
const ROBAT_FOOT = k(COENG, 0x179a);
const drawnLeft = (u: string) => DRAWN_LEFT.has(cp(u)) || u === ROBAT_FOOT;

/**
 * The next unit a child needs, given what they have traced so far — or null
 * when the trace has already gone wrong (the hint then starts them again).
 */
export function nextUnit(tiles: readonly string[], traced: readonly string[]): { unit: string; index: number } | null {
  if (traced.length >= tiles.length) return null;
  for (let i = 0; i < traced.length; i++) if (traced[i] !== tiles[i]) return null;
  return { unit: tiles[traced.length], index: traced.length };
}

/**
 * Why a wrong trace is wrong, when the reason is teachable: the right pieces
 * in the wrong order. Null for anything else — a plain ✕ is then the honest
 * answer.
 */
export function orderFeedback(tiles: readonly string[], chosen: readonly string[]): string | null {
  if (chosen.length !== tiles.length) return null;
  const bag = (a: readonly string[]) => [...a].sort().join("|");
  if (bag(chosen) !== bag(tiles) || chosen.every((t, i) => t === tiles[i])) return null;
  const i = chosen.findIndex((t, j) => t !== tiles[j]);
  const want = tiles[i];
  const got = chosen[i];
  const kw = unitKind(want);
  const kg = unitKind(got);
  if (kw !== "consonant" && RANK[kg] > RANK[kw]) {
    const left = drawnLeft(got) ? `, even though ${unitCue(got)} is written on the left` : "";
    return `Nearly! ${unitCue(want)} comes before ${unitCue(got)}${left}. Spell it in the order you say it.`;
  }
  if (drawnLeft(got) && kw === "consonant") {
    return `Nearly! ${unitCue(got)} is written on the left, but it is spelled after its consonant. Start with ${unitCue(tiles[0])}.`;
  }
  return `Nearly! These are the right pieces in a different order. Start with ${unitCue(tiles[0])}.`;
}

/**
 * When the unit just chosen lands on the *left* of what is already there (◌ែ
 * after ផ្អ draws as ផ្អែ, with ◌ែ in front), a note saying so — the moment
 * the drawn order and the spelled order part is the moment to explain it.
 */
export function drawnLeftNote(traced: readonly string[]): string | null {
  const last = traced[traced.length - 1];
  if (!last || !drawnLeft(last)) return null;
  // Back to this syllable's consonant: what the unit is drawn in front of.
  let start = traced.length - 2;
  while (start > 0 && unitKind(traced[start]) !== "consonant") start--;
  const before = start >= 0 ? traced.slice(start, traced.length - 1).join("") : "";
  if (!before) return null;
  return `${unitCue(last)} is written on the left of ${before}, but it is spelled after it.`;
}

/* --------------------------------------------------------- every unit, named */

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/**
 * Every unit a Khmer word can be spelled with, grouped as a class learns them —
 * the list a person records names for. The two historical consonants ឝ and ឞ
 * are left out of the classroom list because they are not part of the modern
 * 33-consonant alphabet and can look duplicated in some fonts.
 */
const MODERN_CONSONANTS = range(0x1780, 0x17a2).filter((c) => c !== 0x179d && c !== 0x179e);
export const UNIT_GROUPS: ReadonlyArray<{ kind: UnitKind; title: string; units: string[] }> = [
  { kind: "consonant", title: "Consonants", units: MODERN_CONSONANTS.map((c) => k(c)) },
  { kind: "consonant", title: "Independent vowels", units: range(0x17a5, 0x17b3).filter((c) => c !== 0x17a8).map((c) => k(c)) },
  { kind: "foot", title: "Feet (subscripts)", units: MODERN_CONSONANTS.map((c) => k(COENG, c)) },
  {
    kind: "vowel",
    title: "Vowels",
    units: [...range(0x17b6, 0x17c5).map((c) => k(c)), k(0x17c6), k(0x17c7), k(0x17bb, 0x17c6), k(0x17b6, 0x17c6), k(0x17bb, 0x17c7), k(0x17c1, 0x17c7), k(0x17c4, 0x17c7)],
  },
  { kind: "shifter", title: "Consonant shifters", units: [k(0x17c9), k(0x17ca)] },
  { kind: "sign", title: "Signs", units: [...range(0x17cb, 0x17d1), 0x17c8].map((c) => k(c)) },
];

/* ------------------------------------------------------------------ levels */

/**
 * How hard a word is to spell, from what its units ask of a child — never from
 * a tag an author has to remember. Each level adds one idea to the last:
 *
 *   1 consonants and vowels drawn after, above or below          ទា គោ
 *   2 a vowel drawn on the left, though spelled after             ចេក គេ
 *   3 one foot under a consonant                                  ស្វាយ ផ្សារ
 *   4 a compound vowel or a sign (◌ុំ ◌ោះ ◌់ …)                    កុំ មាន់
 *   5 two feet on one consonant, ◌្រ (drawn left), or a shifter   ស្ត្រី ក្រូច ម៉ី
 *
 * A word is the highest level any of its syllables reaches.
 */
export type SpellingLevel = 1 | 2 | 3 | 4 | 5;

export const LEVEL_NAME: Record<SpellingLevel, string> = {
  1: "Consonants and vowels",
  2: "Vowels written on the left",
  3: "A foot under a consonant",
  4: "Compound vowels and signs",
  5: "Two feet, ◌្រ and shifters",
};

const COMPOUND_OR_SIGN = (u: string) => {
  const kind = unitKind(u);
  return kind === "sign" || (kind === "vowel" && ([...u].length > 1 || cp(u) === 0x17c6 || cp(u) === 0x17c7));
};

export function spellingLevel(units: readonly string[]): SpellingLevel {
  let level: SpellingLevel = 1;
  const raise = (n: SpellingLevel) => { if (n > level) level = n; };
  let feetHere = 0;
  for (const u of units) {
    const kind = unitKind(u);
    if (kind === "consonant") feetHere = 0;
    if (kind === "vowel" && DRAWN_LEFT.has(cp(u))) raise(2);
    if (kind === "foot") {
      feetHere++;
      raise(u === ROBAT_FOOT || feetHere > 1 ? 5 : 3);
    }
    if (COMPOUND_OR_SIGN(u)) raise(4);
    if (kind === "shifter") raise(5);
  }
  return level;
}

/** The hardest level a young band should be asked to spell: ages 5–7 stop before compound vowels. */
export const BAND_LEVEL_CAP = { A: 3, B: 5 } as const satisfies Record<"A" | "B", SpellingLevel>;

/* ------------------------------------------------------------------ decoys */

/** Vowels children mix up: they look or sound alike. */
const VOWEL_GROUPS: string[][] = [
  [k(0x17b7), k(0x17b8)], // ◌ិ ◌ី
  [k(0x17b9), k(0x17ba)], // ◌ឹ ◌ឺ
  [k(0x17bb), k(0x17bc), k(0x17bd)], // ◌ុ ◌ូ ◌ួ
  [k(0x17c1), k(0x17c2), k(0x17c3)], // ◌េ ◌ែ ◌ៃ
  [k(0x17c4), k(0x17c5)], // ◌ោ ◌ៅ
  [k(0x17be), k(0x17bf), k(0x17c0)], // ◌ើ ◌ឿ ◌ៀ
  [k(0x17bb, 0x17c6), k(0x17b6, 0x17c6), k(0x17c6)], // ◌ុំ ◌ាំ ◌ំ
  [k(0x17bb, 0x17c7), k(0x17c1, 0x17c7), k(0x17c4, 0x17c7), k(0x17c7)], // ◌ុះ ◌េះ ◌ោះ ◌ះ
  [k(0x17b6), k(0x17c5)], // ◌ា ◌ៅ
];

/** The two series of the consonant chart: the same sound, a different letter. ក/គ ខ/ឃ ច/ជ ឆ/ឈ ដ/ឌ ឋ/ឍ ត/ទ ថ/ធ ប/ព ផ/ភ. */
const CONSONANT_PAIRS: Array<[number, number]> = [
  [0x1780, 0x1782], [0x1781, 0x1783], [0x1785, 0x1787], [0x1786, 0x1788], [0x178a, 0x178c],
  [0x178b, 0x178d], [0x178f, 0x1791], [0x1790, 0x1792], [0x1794, 0x1796], [0x1795, 0x1797],
];
const PAIR = new Map<number, number>(CONSONANT_PAIRS.flatMap(([a, b]) => [[a, b], [b, a]] as Array<[number, number]>));
const DA = 0x178a;
const TA = 0x178f;

function confusablesOf(unit: string): string[] {
  const kind = unitKind(unit);
  if (kind === "vowel") return VOWEL_GROUPS.find((g) => g.includes(unit))?.filter((v) => v !== unit) ?? [];
  if (kind === "consonant") return PAIR.has(cp(unit)) ? [k(PAIR.get(cp(unit))!)] : [];
  if (kind === "foot") {
    const c = cp(unit, 1);
    const out: string[] = [];
    if (c === DA) out.push(k(COENG, TA)); // ◌្ដ and ◌្ត look the same
    if (c === TA) out.push(k(COENG, DA));
    if (PAIR.has(c)) out.push(k(COENG, PAIR.get(c)!));
    out.push(k(c)); // the foot's own consonant, written as a full letter
    return out;
  }
  if (kind === "shifter") return [k(cp(unit) === 0x17c9 ? 0x17ca : 0x17c9)];
  return [];
}

/** When a word offers nothing to confuse: common consonants. ក ម ត ន ប ល */
const FALLBACK = [0x1780, 0x1798, 0x178f, 0x1793, 0x1794, 0x179b].map((c) => k(c));

/**
 * Spare tiles for a Khmer word, most instructive first: a vowel's look-alike,
 * then a foot's, then a consonant's pair, then a shifter's. Never a tile
 * already in the word, never the same tile twice.
 */
export function khmerDecoys(tiles: readonly string[], n: number): string[] {
  if (n <= 0) return [];
  const of = (kind: UnitKind) => tiles.filter((t) => unitKind(t) === kind).flatMap(confusablesOf);
  const pool = [...of("vowel"), ...of("foot"), ...of("consonant"), ...of("shifter"), ...FALLBACK];
  const out: string[] = [];
  for (const d of pool) {
    if (out.length >= n) break;
    if (!tiles.includes(d) && !out.includes(d)) out.push(d);
  }
  return out;
}
