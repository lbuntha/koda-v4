import type { ComprehensionQuestion } from "../../data/passage";
import { core, sentenceText } from "../../data/text";
import { answerStandsOut, choiceLength } from "../../data/verifyPassage";
import type { Draft } from "./shared";

/** Ready-made fixes for a question whose right answer gives itself away by its length. */
export interface LengthFixes {
  /** Longer wrong choices, by the index of the choice each would replace. */
  wrong: Array<{ index: number; options: string[] }>;
  /** A shorter right answer, cut from its evidence sentence. */
  answer: string[];
}

const LONGEST_PHRASE = 6;
const PER_CHOICE = 3;
const bare = (s: string) => s.normalize("NFC").replace(/[\s​]+/gu, "").toLowerCase();

/** Every run of up to six words in a sentence, as the story writes it. */
function phrasesOf(words: readonly string[], lang: Draft["language"]): string[] {
  const tokens = words.map(core).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++)
    for (let n = 1; n <= LONGEST_PHRASE && i + n <= tokens.length; n++) out.push(sentenceText(tokens.slice(i, i + n), lang));
  return out;
}

/**
 * Local fixes for rule 3, built only from the story's own words so a wrong
 * choice still reads like the story (rule 2). Empty when the rule passes.
 */
export function lengthFixes(q: ComprehensionQuestion, draft: Draft): LengthFixes {
  const none = { wrong: [], answer: [] };
  if (!answerStandsOut(q.options, q.answer)) return none;
  const answer = q.options[q.answer] ?? "";
  const want = choiceLength(answer);
  const reach = Math.max(want + 2, Math.ceil(want * 1.3));
  const answerKey = bare(answer);
  const taken = new Set(q.options.map(bare));

  // A phrase that holds the answer, or sits inside it, would be a second right answer.
  const byPhrase = new Map<string, { text: string; evidence: boolean }>();
  for (const s of draft.sentences)
    for (const text of phrasesOf(s.words, draft.language)) {
      const key = bare(text);
      if (!key || taken.has(key) || key.includes(answerKey) || answerKey.includes(key)) continue;
      const seen = byPhrase.get(key);
      byPhrase.set(key, { text, evidence: (seen?.evidence ?? false) || s.id === q.evidence });
    }
  const fits = [...byPhrase.values()].filter((p) => {
    const len = choiceLength(p.text);
    return len >= want && len <= reach;
  });

  const wrong = q.options.flatMap((option, index) => {
    if (index === q.answer) return [];
    const own = bare(option);
    // Growing the choice the author wrote keeps their idea; a phrase from another sentence is less likely to also be true.
    const ranked = [...fits].sort((a, b) =>
      Number(own && bare(b.text).includes(own)) - Number(own && bare(a.text).includes(own)) ||
      Number(a.evidence) - Number(b.evidence) ||
      Math.abs(choiceLength(a.text) - want) - Math.abs(choiceLength(b.text) - want));
    const options = ranked.slice(0, PER_CHOICE).map((p) => p.text);
    return options.length ? [{ index, options }] : [];
  });

  // A shorter right answer must still come from its evidence and no longer stand out.
  const evidence = draft.sentences.find((s) => s.id === q.evidence);
  const others = Math.max(...q.options.filter((_, i) => i !== q.answer).map(choiceLength));
  const shorter = evidence
    ? [...new Set(phrasesOf(evidence.words, draft.language))]
      .filter((text) => {
        const len = choiceLength(text);
        return answerKey.includes(bare(text)) && len >= 2 && len <= others && !taken.has(bare(text));
      })
      .sort((a, b) => choiceLength(b) - choiceLength(a))
      .slice(0, PER_CHOICE)
    : [];

  return { wrong, answer: shorter };
}
