import { describe, expect, it } from "vitest";
import { RING_MAX, type Passage } from "./passage";
import { buildSpellingDeck, judgeSpelling, ringOf } from "./spellingDeck";
import { STARTER_PASSAGES } from "./starterPassages";
import { normalizeWord, wordFromTiles } from "./tiles";

const clone = <T,>(x: T): T => structuredClone(x);
const sentences = (p: Passage) => new Map(p.sentences.map((s) => [s.id, s]));

describe.each(STARTER_PASSAGES.map((p) => [p.id, p] as const))("the spelling deck for %s", (_id, p) => {
  const deck = buildSpellingDeck(p);

  it("has one word per spelling question, in order", () => {
    expect(deck.map((w) => w.id)).toEqual(p.questions.filter((x) => x.kind === "spell").map((x) => `${p.id}/${x.id}`));
  });

  it("spells the word from its own tiles", () => {
    for (const w of deck) expect(wordFromTiles(w.tiles, p.language)).toBe(normalizeWord(w.word, p.language));
  });

  it("blanks the word and gives the sentence back when it is put in", () => {
    const by = sentences(p);
    for (const w of deck) {
      expect(w.gapped).toContain("___");
      expect(w.gapped.replace("___", w.original)).toBe(by.get(w.sentenceId)!.text);
    }
  });

  it("never puts a distractor on the ring that the word already uses, and never overfills it", () => {
    for (const w of deck) {
      expect(w.extras.some((t) => w.tiles.includes(t))).toBe(false);
      expect(w.tiles.length + w.extras.length).toBeLessThanOrEqual(RING_MAX);
    }
  });

  it("accepts the word and refuses a reversal or a missing tile", () => {
    for (const w of deck) {
      expect(judgeSpelling(w, w.tiles, p)).toBe("correct");
      expect(judgeSpelling(w, w.tiles.slice(1), p)).toBe("wrong");
      const reversed = [...w.tiles].reverse();
      if (reversed.join("") !== w.tiles.join("")) expect(judgeSpelling(w, reversed, p)).toBe("wrong");
    }
  });
});

describe("ringOf", () => {
  const [market] = STARTER_PASSAGES;
  const [word] = buildSpellingDeck(market);

  it("lays out every tile and every distractor exactly once", () => {
    for (let i = 0; i < 50; i++) expect([...ringOf(word)].sort()).toEqual([...word.tiles, ...word.extras].sort());
  });

  it("is reproducible when the generator is pinned", () => {
    const rng = () => 0;
    expect(ringOf(word, rng)).toEqual(ringOf(word, rng));
  });
});

describe("a story that cannot be played", () => {
  const [market] = STARTER_PASSAGES;

  it("throws rather than reach a child as a ring nobody can finish", () => {
    const a = clone(market);
    (a.questions.find((x) => x.id === "sp1") as { word: string }).word = "zebra";
    expect(() => buildSpellingDeck(a)).toThrow(/not a word of s1/);

    const b = clone(market);
    (b.questions.find((x) => x.id === "sp1") as { sentence: string }).sentence = "s9";
    expect(() => buildSpellingDeck(b)).toThrow(/does not exist/);

    const c = clone(market);
    c.sentences[0].words[4] = "strawberries";
    c.sentences[0].text = c.sentences[0].words.join(" ");
    (c.questions.find((x) => x.id === "sp1") as { word: string }).word = "strawberries";
    expect(() => buildSpellingDeck(c)).toThrow(/too_many_tiles/);
  });

  it("gives a full eight-tile word no distractor, so the ring stays eight", () => {
    const p = clone(market);
    p.sentences = [{ id: "s1", text: "I lost my notebook.", words: ["I", "lost", "my", "notebook."] }];
    p.questions = [{ id: "sp1", kind: "spell", sentence: "s1", word: "notebook" }];
    const [w] = buildSpellingDeck(p);
    expect(w.tiles).toHaveLength(8);
    expect(w.extras).toEqual([]);
  });
});
