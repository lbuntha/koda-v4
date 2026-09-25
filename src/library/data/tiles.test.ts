import { describe, expect, it } from "vitest";
import { normalizeWord, pickExtras, spellsWord, tilesOf, whyUnspellable, wordFromTiles } from "./tiles";

/**
 * Khmer is written here as code points, not glyphs. A typed glyph can silently
 * become a different sequence (a precomposed form, a reordered mark) and a test
 * that compares a string to itself proves nothing; a code point cannot.
 *
 * These pin the *rule* — base, then subscripts, then each vowel sign and sign as
 * its own tile. They say nothing about whether a word is a good one to teach, and
 * they do not need a Khmer speaker to be right or wrong.
 */
const k = (...cps: number[]) => String.fromCodePoint(...cps);

// [word, tiles]. Consonants 1780–17A2, coeng 17D2, vowel signs 17B6–17C5, signs 17C6–17D1.
const KHMER: Array<[string, string[]]> = [
  [k(0x179f, 0x17d2, 0x179c, 0x17b6, 0x1799), [k(0x179f), k(0x17d2, 0x179c), k(0x17b6), k(0x1799)]], // ស្វាយ: ស · ជើងវ · ស្រៈអា · យ
  [k(0x1781, 0x17d2, 0x1798, 0x17c2, 0x179a), [k(0x1781), k(0x17d2, 0x1798), k(0x17c2), k(0x179a)]], // ខ្មែរ: ◌ែ is spelled after the foot, though drawn first
  [k(0x1785, 0x17c1, 0x1780), [k(0x1785), k(0x17c1), k(0x1780)]], // ចេក
  [k(0x1786, 0x17d2, 0x1798, 0x17b6), [k(0x1786), k(0x17d2, 0x1798), k(0x17b6)]], // ឆ្មា
  [k(0x178f, 0x17d2, 0x179a, 0x17b8), [k(0x178f), k(0x17d2, 0x179a), k(0x17b8)]], // ត្រី
  [k(0x1780, 0x17d2, 0x179a, 0x17bc, 0x1785), [k(0x1780), k(0x17d2, 0x179a), k(0x17bc), k(0x1785)]], // ក្រូច
  [k(0x1795, 0x17d2, 0x179f, 0x17b6, 0x179a), [k(0x1795), k(0x17d2, 0x179f), k(0x17b6), k(0x179a)]], // ផ្សារ
  [k(0x1795, 0x17d2, 0x17a2, 0x17c2, 0x1798), [k(0x1795), k(0x17d2, 0x17a2), k(0x17c2), k(0x1798)]], // ផ្អែម
  [k(0x1795, 0x17d2, 0x1780, 0x17b6), [k(0x1795), k(0x17d2, 0x1780), k(0x17b6)]], // ផ្កា
  [k(0x1791, 0x17b9, 0x1780), [k(0x1791), k(0x17b9), k(0x1780)]], // ទឹក
  [k(0x179f, 0x17b6, 0x179b, 0x17b6), [k(0x179f), k(0x17b6), k(0x179b), k(0x17b6)]], // សាលា — the same vowel sign twice
  [k(0x1782, 0x17c4), [k(0x1782), k(0x17c4)]], // គោ
  [k(0x1791, 0x17b6), [k(0x1791), k(0x17b6)]], // ទា
  [k(0x179f, 0x17d2, 0x178f, 0x17d2, 0x179a, 0x17b8), [k(0x179f), k(0x17d2, 0x178f), k(0x17d2, 0x179a), k(0x17b8)]], // ស្ត្រី — two feet, ◌្រ last
  [k(0x1798, 0x17b6, 0x1793, 0x17cb), [k(0x1798), k(0x17b6), k(0x1793), k(0x17cb)]], // មាន់ — a sign is its own tile
  [k(0x1780, 0x17bb, 0x17c6), [k(0x1780), k(0x17bb, 0x17c6)]], // កុំ — ◌ុំ is one vowel
  [k(0x17aa, 0x17a1, 0x17b9, 0x1780), [k(0x17aa), k(0x17a1), k(0x17b9), k(0x1780)]], // ឪឡឹក — an independent vowel starts a tile
];

const ENGLISH: Array<[string, string[]]> = [
  ["cat", ["C", "A", "T"]],
  ["sheep", ["S", "H", "E", "E", "P"]],
  ["Puddles", ["P", "U", "D", "D", "L", "E", "S"]],
  ["it", ["I", "T"]],
  ["notebook", ["N", "O", "T", "E", "B", "O", "O", "K"]],
];

describe("tilesOf", () => {
  it.each(ENGLISH)("spells English %s in letters", (word, tiles) => {
    expect(tilesOf(word, "en")).toEqual(tiles);
  });

  it.each(KHMER)("spells Khmer %s the way a class does", (word, tiles) => {
    expect(tilesOf(word, "km")).toEqual(tiles);
  });

  it("always rejoins to the word — the property, not a table", () => {
    for (const [word] of KHMER) expect(wordFromTiles(tilesOf(word, "km"), "km")).toBe(word.normalize("NFC"));
    for (const [word] of ENGLISH) expect(wordFromTiles(tilesOf(word, "en"), "en")).toBe(word.toUpperCase());
  });

  it("keeps each subscript whole — the sign ◌្ never without its consonant", () => {
    const COENG = 0x17d2;
    for (const [word] of KHMER) {
      for (const tile of tilesOf(word, "km")) {
        const cps = [...tile].map((c) => c.codePointAt(0) ?? 0);
        if (cps.includes(COENG)) expect(cps).toHaveLength(2);
        if (cps.includes(COENG)) expect(cps[0]).toBe(COENG);
      }
    }
  });

  it("tiles a word typed in drawn order like the same word typed correctly", () => {
    const drawn = k(0x1781, 0x17c2, 0x17d2, 0x1798, 0x179a); // ខ ◌ែ ◌្ម រ
    const spelled = k(0x1781, 0x17d2, 0x1798, 0x17c2, 0x179a);
    expect(tilesOf(drawn, "km")).toEqual(tilesOf(spelled, "km"));
    expect(spellsWord(tilesOf(spelled, "km"), drawn, "km")).toBe(true);
    // But a child who chooses the units in the drawn order has not spelled it,
    // though the two draw the same: the order is what is being learned.
    const units = tilesOf(spelled, "km");
    expect(spellsWord([units[0], units[2], units[1], units[3]], spelled, "km")).toBe(false);
  });

  it("ignores case in English and nothing else", () => {
    expect(spellsWord(["C", "A", "T"], "cat", "en")).toBe(true);
    expect(spellsWord(["C", "A", "T"], "act", "en")).toBe(false);
    expect(normalizeWord("Cat", "en")).toBe("CAT");
    expect(normalizeWord("Cat", "km")).toBe("Cat");
  });
});

describe("whyUnspellable", () => {
  it("accepts an ordinary word in each language", () => {
    expect(whyUnspellable("market", "en")).toBeNull();
    expect(whyUnspellable(KHMER[0][0], "km")).toBeNull();
  });

  it.each([
    ["", "en", "empty"],
    ["don't", "en", "not_letters"],
    ["ab1", "en", "not_letters"],
    ["a", "en", "too_few_tiles"],
    ["strawberries", "en", "too_many_tiles"],
    ["notebook", "en", null],
  ] as const)("English %j → %s", (word, lang, why) => {
    expect(whyUnspellable(word, lang)).toBe(why);
  });

  it("refuses Khmer that cannot be drawn", () => {
    expect(whyUnspellable(k(0x17b6, 0x1780), "km")).toBe("starts_with_mark"); // a vowel sign with no consonant
    expect(whyUnspellable(k(0x17d2, 0x1780), "km")).toBe("starts_with_mark"); // a subscript with no base
    expect(whyUnspellable(k(0x1780, 0x17d2), "km")).toBe("dangling_coeng"); // a base with a subscript to nothing
    expect(whyUnspellable(k(0x1780, 0x17d2, 0x17b6), "km")).toBe("dangling_coeng"); // a subscript to a vowel sign
    expect(whyUnspellable("cat", "km")).toBe("not_letters");
    expect(whyUnspellable(k(0x1780), "km")).toBe("too_few_tiles");
  });
});

describe("pickExtras", () => {
  it("never returns a tile the word already uses", () => {
    for (const [word] of ENGLISH) {
      const tiles = tilesOf(word, "en");
      expect(pickExtras(tiles, "en", 3).some((t) => tiles.includes(t))).toBe(false);
    }
    for (const [word] of KHMER) {
      const tiles = tilesOf(word, "km");
      expect(pickExtras(tiles, "km", 3).some((t) => tiles.includes(t))).toBe(false);
    }
  });

  it("is deterministic, and returns only as many as asked for", () => {
    expect(pickExtras(["C", "A", "T"], "en", 2)).toEqual(pickExtras(["C", "A", "T"], "en", 2));
    expect(pickExtras(["C", "A", "T"], "en", 2)).toHaveLength(2);
    expect(pickExtras(["C", "A", "T"], "en", 0)).toEqual([]);
    expect(pickExtras(["C", "A", "T"], "en", -1)).toEqual([]);
  });
});
