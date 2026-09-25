import { describe, expect, it } from "vitest";
import { core, gapOf, icuKhmerSplitter, parseStory, sentenceText, splitSentences, tokenizeSentence, type WordSplitter } from "./text";

describe("core", () => {
  it("strips the punctuation around a word and keeps an apostrophe inside it", () => {
    expect(core("mother.")).toBe("mother");
    expect(core("“Hello,”")).toBe("Hello");
    expect(core("don't")).toBe("don't");
    expect(core("morning,")).toBe("morning");
    expect(core("ម្តាយ។")).toBe("ម្តាយ");
  });

  it("returns nothing for a token that is only punctuation", () => {
    expect(core("...")).toBe("");
    expect(core("។")).toBe("");
  });
});

describe("splitSentences", () => {
  it("splits on new lines and on terminal punctuation", () => {
    expect(splitSentences("A cat sat. The dog ran!\nNo more?")).toEqual(["A cat sat.", "The dog ran!", "No more?"]);
    expect(splitSentences("  \n\nOne.\n")).toEqual(["One."]);
  });

  it("splits Khmer on the Khmer full stop", () => {
    expect(splitSentences("សុខាទៅផ្សារ។នាងទិញស្វាយ។")).toEqual(["សុខាទៅផ្សារ។", "នាងទិញស្វាយ។"]);
  });

  /*
   * A closing quote is not a sentence. Splitting on the `!` inside `…ស្អែក!»`
   * left the `»` alone as one, which reached the author as a page with no words
   * on it, and in English left the rest of the line starting with a stray `"`.
   */
  it("keeps a closing quote with the sentence it closes", () => {
    expect(splitSentences("លីណានិយាយថាៈ«ខ្ញុំចង់មកម្ដងទៀតនៅថ្ងៃស្អែក!»")).toEqual(["លីណានិយាយថាៈ«ខ្ញុំចង់មកម្ដងទៀតនៅថ្ងៃស្អែក!»"]);
    expect(splitSentences("នាងថាៈ«ខ្ញុំភ័យ!»។ ពេលនោះគាត់ញញឹម។")).toEqual(["នាងថាៈ«ខ្ញុំភ័យ!»។", "ពេលនោះគាត់ញញឹម។"]);
    expect(splitSentences('She shouted "Stop!" Then it rained.')).toEqual(['She shouted "Stop!"', "Then it rained."]);
  });
});

describe("tokenizeSentence", () => {
  it("splits English on whitespace", () => {
    expect(tokenizeSentence("  The  mango is sweet. ", "en")).toEqual(["The", "mango", "is", "sweet."]);
  });

  it("glues Khmer punctuation to the word before it", () => {
    // A fake breaker keeps this about the gluing, not about any machine's ICU data.
    const fake: WordSplitter = (chunk) => (chunk === "សុខាទៅ។" ? ["សុខា", "ទៅ", "។"] : [chunk]);
    expect(tokenizeSentence("សុខាទៅ។", "km", fake)).toEqual(["សុខា", "ទៅ។"]);
  });

  it("treats a typed space as a forced break in Khmer", () => {
    const whole: WordSplitter = (chunk) => [chunk];
    expect(tokenizeSentence("នាង ទិញ", "km", whole)).toEqual(["នាង", "ទិញ"]);
  });

  it("whatever the platform breaker returns, the words rejoin to the text", () => {
    for (const s of ["សុខាទៅផ្សារជាមួយម្តាយ។", "នាងទិញស្វាយមួយ។", "ស្វាយផ្អែមណាស់។"]) {
      expect(tokenizeSentence(s, "km", icuKhmerSplitter).join("")).toBe(s);
    }
  });
});

describe("parseStory", () => {
  it("numbers sentences from s1 and rebuilds each text from its words", () => {
    const story = parseStory("It rained.\nDara stayed in.", "en");
    expect(story.map((s) => s.id)).toEqual(["s1", "s2"]);
    for (const s of story) expect(s.text).toBe(sentenceText(s.words, "en"));
  });

  it("drops a Khmer space the person typed — it was a hint, not part of the sentence", () => {
    const whole: WordSplitter = (chunk) => [chunk];
    const [s] = parseStory("នាង ទិញស្វាយ។", "km", whole);
    expect(s.words).toEqual(["នាង", "ទិញស្វាយ។"]);
    expect(s.text).toBe("នាងទិញស្វាយ។");
  });
});

describe("gapOf", () => {
  const market = { words: ["Sokha", "goes", "to", "the", "market", "with", "her", "mother."] };

  it("blanks a word in the middle", () => {
    expect(gapOf(market, "market", "en")).toEqual({ text: "Sokha goes to the ___ with her mother.", original: "market", index: 4 });
  });

  it("keeps the punctuation that was attached", () => {
    expect(gapOf({ words: ["The", "mango", "is", "sweet."] }, "sweet", "en")?.text).toBe("The mango is ___.");
  });

  it("matches without regard to case and reports the word as the story wrote it", () => {
    const g = gapOf({ words: ["Grandma", "bakes"] }, "grandma", "en");
    expect(g?.text).toBe("___ bakes");
    expect(g?.original).toBe("Grandma");
  });

  it("blanks only the first occurrence", () => {
    expect(gapOf({ words: ["the", "cat", "and", "the", "dog"] }, "the", "en")?.text).toBe("___ cat and the dog");
  });

  it("returns null when the word is not in the sentence", () => {
    expect(gapOf(market, "zebra", "en")).toBeNull();
    expect(gapOf(market, "mark", "en")).toBeNull(); // a part of a word is not the word
  });

  it("joins Khmer with no spaces", () => {
    expect(gapOf({ words: ["នាង", "ទិញ", "ស្វាយ", "មួយ។"] }, "ស្វាយ", "km")?.text).toBe("នាងទិញ___មួយ។");
  });

  it("re-joins to the original sentence for every word of every sentence", () => {
    const words = ["Sokha", "goes", "to", "the", "market", "with", "her", "mother."];
    const text = sentenceText(words, "en");
    for (const w of words) {
      const g = gapOf({ words }, core(w), "en");
      expect(g).not.toBeNull();
      expect(g!.text.replace("___", g!.original)).toBe(text);
    }
  });
});
