import { describe, expect, it } from "vitest";
import { BANDS, type Passage, type Question } from "./passage";
import { STARTER_PASSAGES } from "./starterPassages";
import { verifyPassage, type RuleId } from "./verifyPassage";
import { readingLexiconFor } from "./readingLexicon";

/**
 * A verifier that only ever sees good stories proves nothing: it could return
 * "pass" for everything and these tests would stay green. So every rule here has
 * two halves — the starter stories pass it, and a story broken in exactly that
 * one way fails it, and fails *only* it.
 */

const [MARKET, RAINY, MARKET_KM] = STARTER_PASSAGES;
const clone = <T,>(x: T): T => structuredClone(x);
const q = (p: Passage, id: string): Question => p.questions.find((x) => x.id === id)!;
const failingRules = (p: Passage, opts = {}): RuleId[] => [...new Set(verifyPassage(p, { confirmedSplit: true, ...opts }).checks.filter((c) => c.status === "fail").map((c) => c.rule))].sort();

describe("the starter stories", () => {
  it.each(STARTER_PASSAGES.map((p) => [p.id, p] as const))("%s passes content checks but is below the new 10-per-section target", (_id, p) => {
    const v = verifyPassage(p, { stage: "publish", confirmedSplit: true });
    expect(v.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(v.countsMatchBand).toBe(false);
    expect(v.publishable).toBe(false);
    expect(v.rules).toHaveLength(8);
  });

  it("accepts 9 of 10 and rejects 8 of 10", () => {
    const enough = clone(MARKET);
    enough.questions = [
      ...Array.from({ length: 9 }, (_, i) => ({ id: `q${i}`, kind: "comprehension", prompt: "x", options: ["a", "b", "c"], answer: 0, evidence: "s1" } as Question)),
      ...Array.from({ length: 9 }, (_, i) => ({ id: `w${i}`, kind: "vocab", prompt: "x", word: "x", options: ["a", "b", "c"], answer: 0 } as Question)),
      ...Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, kind: "spell", sentence: "s1", word: "market" } as Question)),
    ];
    expect(verifyPassage(enough).countsMatchBand).toBe(true);
    enough.questions.pop();
    expect(verifyPassage(enough).countsMatchBand).toBe(false);
  });

  it("says plainly that rule 4 did not run, rather than passing it", () => {
    const v = verifyPassage(MARKET, { confirmedSplit: true });
    expect(v.rules.find((r) => r.rule === 4)?.status).toBe("skipped");
  });

  it.each(STARTER_PASSAGES.map((p) => [p.id, p] as const))("%s has no conflicting content checks when its reading list is available", (_id, p) => {
    const v = verifyPassage(p, { confirmedSplit: true, lexicon: readingLexiconFor(p.band, p.language) });
    expect(v.checks.filter((c) => c.status === "fail")).toEqual([]);
  });
});

describe("rule 0 — is this a passage", () => {
  it("catches words that no longer rejoin to their sentence", () => {
    const p = clone(MARKET);
    p.sentences[0].words[1] = "went";
    // Rule 5 fails with it, and rightly: the gapped sentence cannot re-join to a text that no longer matches.
    expect(failingRules(p)).toEqual([0, 5]);
    expect(failingRules(p)).toContain(0);
  });

  it("catches colliding ids", () => {
    const a = clone(MARKET);
    a.sentences[1].id = "s1";
    expect(failingRules(a)).toContain(0);
    const b = clone(MARKET);
    q(b, "q2").id = "q1";
    expect(failingRules(b)).toContain(0);
  });

  it("catches an answer index off the end, and choices that repeat", () => {
    const a = clone(MARKET);
    (q(a, "q1") as { answer: number }).answer = 3;
    expect(failingRules(a)).toContain(0);
    const b = clone(MARKET);
    (q(b, "q1") as { options: string[] }).options = ["Home", "home", "Under the hot sun"];
    expect(failingRules(b)).toContain(0);
  });

  it("does not throw on a broken answer index — it reports it", () => {
    const p = clone(MARKET);
    (q(p, "q1") as { answer: number }).answer = -1;
    expect(() => verifyPassage(p)).not.toThrow();
  });
});

describe("rule 1 — the answer is in the story", () => {
  it("fails when the evidence sentence does not contain the answer", () => {
    const p = clone(MARKET);
    (q(p, "q1") as { evidence: string }).evidence = "s1"; // the answer is "Home"; s1 is about the market
    expect(failingRules(p)).toEqual([1]);
  });

  it("fails when the evidence sentence does not exist", () => {
    const p = clone(MARKET);
    (q(p, "q1") as { evidence: string }).evidence = "s9";
    expect(failingRules(p)).toEqual([1]);
  });

  it("fails a picture question whose right picture is the wrong one", () => {
    const p = clone(MARKET);
    (q(p, "q3") as { answer: number }).answer = 0; // "banana" with the mango picture marked right
    expect(failingRules(p)).toEqual([1]);
  });

  it("fails a picture question for a word that is not in the story, or has no declared picture", () => {
    const a = clone(MARKET);
    (q(a, "q3") as { word: string }).word = "elephant";
    expect(failingRules(a)).toEqual([1]);
    const b = clone(MARKET);
    delete b.pictures.market;
    expect(failingRules(b)).toEqual([1]);
  });

  it("matches on the stem, so a paraphrase still counts", () => {
    const p = clone(RAINY);
    // "Because it rained" is the right answer to a question whose evidence says "It rained all morning".
    expect(failingRules(p)).toEqual([]);
  });
});

describe("rule 2 — wrong choices come from the story", () => {
  it("fails when no wrong choice uses a word of the story", () => {
    const p = clone(MARKET);
    (q(p, "q2") as { options: string[] }).options = ["The zebra", "The mango", "The lion"];
    expect(failingRules(p)).toEqual([2]);
  });

  it("passes when at least one does — a person confirms the rest", () => {
    const p = clone(MARKET);
    (q(p, "q2") as { options: string[] }).options = ["The zebra", "The mango", "The sun"];
    expect(failingRules(p)).toEqual([]);
  });

  /*
   * Khmer writes without spaces, so the word regex hands back a whole clause as
   * one token and a four-letter stem only ever sees its opening. A distractor
   * built the way a good one is — the story's words rearranged, the shared word
   * in the middle — read as story-free, and the rule failed a question whose
   * author had done nothing wrong.
   */
  it("sees a Khmer distractor that shares a word in the middle, not just at the start", () => {
    const p = clone(MARKET_KM);
    const target = p.questions.find((x) => x.kind === "comprehension")!;
    const shared = p.sentences.flatMap((s) => s.words).find((w) => [...w].length >= 2)!;
    const right = target.options[target.answer];
    // Two wrong choices that open on a word of their own and carry a story word after it.
    target.options = target.options.map((o, i) => (i === target.answer ? o : `ភ្លេច${shared}`));
    target.options[target.answer] = right;
    // Distinct, so rule 0's "all different" check is not what we are measuring.
    target.options = target.options.map((o, i) => (i === target.answer ? o : `${o}${"ៗ".repeat(i + 1)}`));
    expect(failingRules(p)).not.toContain(2);
  });
});

describe("rule 3 — the right answer is not the longest", () => {
  it("fails the classic slip: the model wrote the fullest answer", () => {
    const p = clone(MARKET);
    (q(p, "q2") as { options: string[] }).options = ["The market", "The mango is here", "The sun"];
    expect(failingRules(p)).toEqual([3]);
  });

  it("passes a tie — only a strict winner can be picked out by length", () => {
    const p = clone(MARKET);
    (q(p, "q2") as { options: string[] }).options = ["The market", "The mango", "The sunny"];
    expect(failingRules(p)).toEqual([]);
  });

  it("measures code points, so Khmer is judged fairly", () => {
    expect(failingRules(MARKET_KM)).toEqual([]);
  });
});

describe("rule 4 — questions read no harder than the story", () => {
  it("fails a question with no text, with or without a lexicon", () => {
    const p = clone(MARKET);
    (q(p, "q2") as { prompt: string }).prompt = "   ";
    expect(failingRules(p)).toEqual([4]);
  });

  it("fails a word that is neither in the story nor in the lexicon, and passes once it is", () => {
    // A lexicon that already knows every word the untouched story's questions use.
    const wordsOf = (text: string) => text.toLowerCase().split(/[^\p{L}\p{M}]+/u).filter(Boolean);
    const lexicon = new Set(MARKET.questions.filter((x) => x.kind !== "spell").flatMap((x) => wordsOf(x.kind === "comprehension" ? [x.prompt, ...x.options].join(" ") : x.prompt)));
    expect(failingRules(MARKET, { lexicon })).toEqual([]);

    const p = clone(MARKET);
    (q(p, "q2") as { prompt: string }).prompt = "What is scrumptious?";
    expect(failingRules(p, { lexicon })).toEqual([4]);
    expect(verifyPassage(p, { confirmedSplit: true, lexicon }).failures).toBe(0);
    expect(failingRules(p, { lexicon: new Set([...lexicon, "scrumptious"]) })).toEqual([]);
  });
});

describe("rule 5 — spelling words fit the ring and re-join", () => {
  it("fails a word that is not in its sentence", () => {
    const p = clone(MARKET);
    (q(p, "sp1") as { word: string }).word = "zebra";
    expect(failingRules(p)).toEqual([5]);
  });

  it("fails a word too long for the ring", () => {
    const p = clone(MARKET);
    // "two" in s2 — a word no other question depends on, so only rule 5 can object.
    p.sentences[1].words[5] = "strawberries";
    p.sentences[1].text = p.sentences[1].words.join(" ");
    (q(p, "sp2") as { word: string }).word = "strawberries";
    expect(failingRules(p)).toEqual([5]);
  });

  it("fails a Khmer word that cannot be drawn", () => {
    const p = clone(MARKET_KM);
    const dangling = String.fromCodePoint(0x1780, 0x17d2);
    p.sentences[0].words[0] = dangling;
    p.sentences[0].text = p.sentences[0].words.join("");
    (q(p, "sp1") as { word: string }).word = dangling;
    expect(failingRules(p)).toContain(5);
  });
});

describe("rule 6 — no two questions share an answer or a sentence", () => {
  it("fails two spelling questions on the same word", () => {
    const p = clone(MARKET);
    (q(p, "sp2") as { word: string }).word = "market";
    (q(p, "sp2") as { sentence: string }).sentence = "s1";
    expect(failingRules(p)).toEqual([6]);
  });

  it("fails two comprehension questions with the same evidence sentence", () => {
    const p = clone(MARKET);
    (q(p, "q2") as { evidence: string }).evidence = "s4";
    (q(p, "q2") as { options: string[] }).options = ["The market", "The sun", "Home"]; // keep it answerable from s4
    (q(p, "q2") as { answer: number }).answer = 1;
    expect(failingRules(p)).toContain(6);
  });
});

describe("rule 7 — recordings are optional", () => {
  it("never fails, with or without recordings, and says how many there are", () => {
    const p = clone(MARKET);
    expect(failingRules(p, { stage: "publish" })).toEqual([]);
    p.sentences[0].audio = "a".repeat(64);
    const v = verifyPassage(p, { stage: "publish", confirmedSplit: true });
    expect(v.rules.find((r) => r.rule === 7)?.message).toMatch(/^1 of 4 sentences recorded/);
  });
});

describe("rule 8 — a person confirmed the Khmer split", () => {
  it("blocks an unconfirmed Khmer story and never blocks an English one", () => {
    expect(failingRules(MARKET_KM, { confirmedSplit: false })).toEqual([8]);
    expect(failingRules(MARKET_KM, { confirmedSplit: true })).toEqual([]);
    expect(failingRules(MARKET, { confirmedSplit: false })).toEqual([]);
  });
});

describe("the band's counts", () => {
  it("are exact: one question short is not publishable even with every check green", () => {
    const p = clone(MARKET);
    p.questions = p.questions.filter((x) => x.id !== "sp3");
    const v = verifyPassage(p, { confirmedSplit: true });
    expect(v.failures).toBe(0);
    expect(v.countsMatchBand).toBe(false);
    expect(v.publishable).toBe(false);
  });

  it("are exact the other way too: one too many", () => {
    const p = clone(MARKET);
    p.questions.push({ id: "q9", kind: "comprehension", prompt: "What did Sokha buy?", options: ["A mango", "Two bananas", "A market"], answer: 0, evidence: "s2" });
    expect(verifyPassage(p, { confirmedSplit: true }).countsMatchBand).toBe(false);
  });

  it("hold band B to its own numbers", () => {
    expect(verifyPassage(RAINY, { confirmedSplit: true }).counts).toEqual({ comprehension: 3, vocab: 2, spell: 5 });
  });
});
