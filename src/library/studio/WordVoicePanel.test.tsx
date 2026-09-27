import { describe, expect, it } from "vitest";
import { wordsToVoice } from "./WordVoicePanel";
import { STARTER_PASSAGES } from "../data/starterPassages";
import type { Passage } from "../data/passage";

/**
 * Which words an author is asked to record.
 *
 * The list is the whole point of the panel: a story says the same words over
 * and over, and an author should record each one once, not once per occurrence.
 * The key has to be exactly what a tap in the reader looks up, or a recording
 * is made and never heard.
 */

const story = (words: string[][], language: Passage["language"] = "en"): Passage["sentences"] =>
  words.map((w, i) => ({ id: `s${i + 1}`, text: w.join(" "), words: w, language } as unknown as Passage["sentences"][number]));

describe("the words an author records", () => {
  it("asks for one recording per word, however often the story says it", () => {
    const found = wordsToVoice(story([["the", "cat", "sat"], ["the", "cat", "ran"]]));
    expect(found.map((w) => w.key)).toEqual(["the", "cat", "sat", "ran"]);
    expect(found.find((w) => w.key === "cat")!.times).toBe(2);
  });

  it("keeps them in the order a child meets them", () => {
    expect(wordsToVoice(story([["mango", "apple"], ["banana"]])).map((w) => w.shown)).toEqual(["mango", "apple", "banana"]);
  });

  it("treats a word at the start of a sentence as the same word", () => {
    // The reader falls back to the lowercase form, so "The" and "the" must not
    // be two recordings — and the author is shown the form the story first used.
    const found = wordsToVoice(story([["The", "cat"], ["the", "cat"]]));
    expect(found.map((w) => w.key)).toEqual(["the", "cat"]);
    expect(found[0].shown).toBe("The");
    expect(found[0].times).toBe(2);
  });

  it("strips punctuation, because a tap looks a word up without it", () => {
    const found = wordsToVoice(story([["cat,", "sat."], ["cat"]]));
    expect(found.map((w) => w.key)).toEqual(["cat", "sat"]);
    expect(found[0].times).toBe(2);
  });

  it("asks for nothing where there is no word", () => {
    expect(wordsToVoice(story([[",", ""]]))).toEqual([]);
  });

  it("dedupes a real Khmer story, where the saving is largest", () => {
    const km = STARTER_PASSAGES.find((p) => p.language === "km")!;
    const occurrences = km.sentences.reduce((n, s) => n + s.words.length, 0);
    const found = wordsToVoice(km.sentences);
    expect(found.length).toBeLessThan(occurrences);
    expect(new Set(found.map((w) => w.key)).size).toBe(found.length);
  });
});
