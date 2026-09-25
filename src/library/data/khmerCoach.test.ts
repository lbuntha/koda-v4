import { describe, expect, it } from "vitest";
import { BAND_LEVEL_CAP, drawnLeftNote, khmerDecoys, nextUnit, orderFeedback, spellingLevel, unitCue, unitKind, unitName } from "./khmerCoach";
import { spellingUnits } from "./khmer";

/** Khmer as code points: look-alike strings are the whole subject here. */
const k = (...cps: number[]) => String.fromCodePoint(...cps);

const KHMAE = spellingUnits(k(0x1781, 0x17d2, 0x1798, 0x17c2, 0x179a)); // ខ្មែរ → ខ · ◌្ម · ◌ែ · រ
const SVAY = spellingUnits(k(0x179f, 0x17d2, 0x179c, 0x17b6, 0x1799)); // ស្វាយ → ស · ◌្វ · ◌ា · យ

describe("unit names", () => {
  it("names each kind of unit the way a class does", () => {
    expect(unitName(k(0x1781))).toBe(k(0x1781)); // a consonant is its own name
    expect(unitName(k(0x17d2, 0x1798))).toBe(k(0x1787, 0x17be, 0x1784, 0x1798)); // ◌្ម → ជើងម
    expect(unitName(k(0x17c2))).toBe(k(0x179f, 0x17d2, 0x179a, 0x17c8, 0x17a2, 0x17c2)); // ◌ែ → ស្រៈអែ
    expect(unitName(k(0x17bb, 0x17c6))).toBe(k(0x179f, 0x17d2, 0x179a, 0x17c8, 0x17a2, 0x17bb, 0x17c6)); // ◌ុំ → ស្រៈអុំ
    expect(unitName(k(0x17cb))).toBe(k(0x1794, 0x1793, 0x17d2, 0x178f, 0x1780, 0x17cb)); // ◌់ → បន្តក់
    expect(unitName(k(0x17c9))).toBe(k(0x1798, 0x17bc, 0x179f, 0x17b7, 0x1780, 0x1791, 0x1793, 0x17d2, 0x178f)); // ◌៉ → មូសិកទន្ត
  });

  it("sorts units into consonant, foot, shifter, vowel and sign", () => {
    expect(KHMAE.map(unitKind)).toEqual(["consonant", "foot", "vowel", "consonant"]);
    expect(unitKind(k(0x17ca))).toBe("shifter");
    expect(unitKind(k(0x17cb))).toBe("sign");
  });

  it("gives the name with the shape to look for", () => {
    expect(unitCue(k(0x17d2, 0x1798))).toBe(`${unitName(k(0x17d2, 0x1798))} (◌${k(0x17d2, 0x1798)})`);
    expect(unitCue(k(0x1781))).toBe(k(0x1781));
  });
});

describe("the next unit", () => {
  it("follows a trace that is right so far, and starts again when it is not", () => {
    expect(nextUnit(KHMAE, [])).toEqual({ unit: KHMAE[0], index: 0 });
    expect(nextUnit(KHMAE, KHMAE.slice(0, 2))).toEqual({ unit: KHMAE[2], index: 2 });
    expect(nextUnit(KHMAE, [KHMAE[0], KHMAE[2]])).toBeNull();
    expect(nextUnit(KHMAE, KHMAE)).toBeNull();
  });
});

describe("order feedback", () => {
  it("explains a vowel traced before its foot — the drawn order, not the spelled one", () => {
    const drawn = [KHMAE[0], KHMAE[2], KHMAE[1], KHMAE[3]]; // ខ ◌ែ ◌្ម រ
    const msg = orderFeedback(KHMAE, drawn)!;
    expect(msg).toContain(`${unitCue(KHMAE[1])} comes before ${unitCue(KHMAE[2])}`);
    expect(msg).toContain("written on the left");
  });

  it("explains a left-drawn vowel traced before its consonant", () => {
    const msg = orderFeedback(KHMAE, [KHMAE[2], KHMAE[0], KHMAE[1], KHMAE[3]])!;
    expect(msg).toContain("spelled after its consonant");
  });

  it("says only 'different order' when no rule explains it", () => {
    expect(orderFeedback(SVAY, [SVAY[3], SVAY[1], SVAY[2], SVAY[0]])).toMatch(/right pieces in a different order/);
  });

  it("says nothing for a right answer or for wrong pieces", () => {
    expect(orderFeedback(KHMAE, KHMAE)).toBeNull();
    expect(orderFeedback(KHMAE, [KHMAE[0], KHMAE[1], k(0x17c1), KHMAE[3]])).toBeNull();
    expect(orderFeedback(KHMAE, KHMAE.slice(0, 3))).toBeNull();
  });
});

describe("the drawn-left note", () => {
  it("speaks up when a piece lands in front of what is there", () => {
    const note = drawnLeftNote(KHMAE.slice(0, 3))!; // ខ ◌្ម ◌ែ → ◌ែ in front of ខ្ម
    expect(note).toContain(unitCue(KHMAE[2]));
    expect(note).toContain(`left of ${KHMAE[0]}${KHMAE[1]}`);
  });

  it("stays quiet otherwise", () => {
    expect(drawnLeftNote(KHMAE.slice(0, 2))).toBeNull();
    expect(drawnLeftNote(SVAY.slice(0, 3))).toBeNull(); // ◌ា is drawn after
    expect(drawnLeftNote([])).toBeNull();
  });
});

describe("spelling levels", () => {
  const level = (...cps: number[]) => spellingLevel(spellingUnits(k(...cps)));

  it("rises one idea at a time", () => {
    expect(level(0x1791, 0x17b6)).toBe(1); // ទា — consonant and vowel
    expect(level(0x1782, 0x17c4)).toBe(2); // គោ — ◌ោ is drawn on the left
    expect(level(0x1785, 0x17c1, 0x1780)).toBe(2); // ចេក
    expect(level(0x179f, 0x17d2, 0x179c, 0x17b6, 0x1799)).toBe(3); // ស្វាយ — one foot
    expect(level(0x1780, 0x17bb, 0x17c6)).toBe(4); // កុំ — compound vowel
    expect(level(0x1798, 0x17b6, 0x1793, 0x17cb)).toBe(4); // មាន់ — a sign
    expect(level(0x179f, 0x17d2, 0x178f, 0x17d2, 0x179a, 0x17b8)).toBe(5); // ស្ត្រី — two feet
    expect(level(0x1780, 0x17d2, 0x179a, 0x17bc, 0x1785)).toBe(5); // ក្រូច — ◌្រ is drawn on the left
    expect(level(0x1798, 0x17c9, 0x17b8)).toBe(5); // ម៉ី — a shifter
  });

  it("counts feet per consonant, not per word", () => {
    // ផ្សារ has one foot; a second syllable with its own foot is still level 3.
    expect(spellingLevel([...spellingUnits(k(0x1795, 0x17d2, 0x179f, 0x17b6, 0x179a)), ...spellingUnits(k(0x1786, 0x17d2, 0x1798, 0x17b6))])).toBe(3);
  });

  it("keeps the youngest band below compound vowels", () => {
    expect(BAND_LEVEL_CAP.A).toBe(3);
    expect(BAND_LEVEL_CAP.B).toBe(5);
  });
});

describe("decoys", () => {
  it("offers a vowel's look-alike first", () => {
    expect(khmerDecoys(KHMAE, 1)).toEqual([k(0x17c1)]); // ◌ែ → ◌េ
    expect(khmerDecoys(SVAY, 1)).toEqual([k(0x17c5)]); // ◌ា → ◌ៅ
  });

  it("then a foot's look-alike or its full consonant, then a consonant's pair", () => {
    const d = khmerDecoys(KHMAE, 3);
    expect(d).toContain(k(0x1798)); // ◌្ម's own consonant ម, as a full letter
    const tda = spellingUnits(k(0x1793, 0x17d2, 0x178f, 0x17b6)); // ន្តា
    expect(khmerDecoys(tda, 2)).toContain(k(0x17d2, 0x178a)); // ◌្ត ↔ ◌្ដ
    expect(khmerDecoys([k(0x1780), k(0x1780)], 1)).toEqual([k(0x1782)]); // ក → គ
  });

  it("never offers a tile already in the word, or the same one twice", () => {
    for (const word of [KHMAE, SVAY]) {
      const d = khmerDecoys(word, 4);
      expect(d.some((t) => word.includes(t))).toBe(false);
      expect(new Set(d).size).toBe(d.length);
    }
  });
});
