import { describe, expect, it } from "vitest";
import type { ComprehensionQuestion } from "../../data/passage";
import { answerStandsOut } from "../../data/verifyPassage";
import { lengthFixes } from "./choiceSuggestions";
import type { Draft } from "./shared";

const sentence = (id: string, words: string[]) => ({ id, words, text: words.join("") });
const draft = {
  language: "km",
  sentences: [
    sentence("s4", ["ម៉ូក", "ដើររក", "អាហារ", "នៅ", "ក្នុង", "ព្រៃ", "ជ្រៅ", "ក្រោម", "ផ្កា។"]),
    sentence("s20", ["ម៉ូក", "ត្រឡប់", "ទៅ", "ផ្ទះ", "របស់", "វា", "វិញ។"]),
    sentence("s23", ["ម៉ូក", "បាន", "ជូន", "ប៊ូប៊ូ", "ទៅ", "ដល់", "ជម្រក", "គ្រួសារ", "ទន្សាយ", "ដោយ", "សុវត្ថិភាព។"]),
  ],
} as unknown as Draft;
const q3: ComprehensionQuestion = {
  id: "q3", kind: "comprehension", prompt: "ចុងក្រោយម៉ូកបានជូនប៊ូប៊ូទៅដល់ទីណា?",
  options: ["ជម្រកគ្រួសារទន្សាយ", "ព្រៃជ្រៅ", "ផ្ទះ"], answer: 0, evidence: "s23",
};

describe("lengthFixes — one-tap fixes for a right answer that stands out by size", () => {
  it("offers nothing when the answer does not stand out", () => {
    expect(lengthFixes({ ...q3, options: ["ជម្រក", "ព្រៃជ្រៅ", "ផ្ទះរបស់វា"] }, draft)).toEqual({ wrong: [], answer: [] });
  });

  it("grows each short wrong choice from the story, and every offer fixes the rule", () => {
    const { wrong } = lengthFixes(q3, draft);
    expect(wrong.map((w) => w.index)).toEqual([1, 2]);
    // The author's own choice comes first, grown with the words around it.
    expect(wrong[0].options[0]).toContain("ព្រៃជ្រៅ");
    expect(wrong[1].options[0]).toContain("ផ្ទះ");
    for (const { index, options } of wrong)
      for (const text of options) expect(answerStandsOut(q3.options.map((o, j) => (j === index ? text : o)), 0)).toBe(false);
  });

  it("never offers a phrase that holds the right answer", () => {
    const all = lengthFixes(q3, draft).wrong.flatMap((w) => w.options);
    expect(all.some((t) => t.includes("ជម្រកគ្រួសារទន្សាយ") || "ជម្រកគ្រួសារទន្សាយ".includes(t))).toBe(false);
  });

  it("offers a shorter right answer cut from the evidence when one fits", () => {
    const long = { ...q3, options: ["ជម្រកគ្រួសារទន្សាយ", "ព្រៃជ្រៅក្រោម", "ផ្ទះរបស់វាវិញ"] };
    expect(lengthFixes(long, draft).answer).toContain("ជម្រកគ្រួសារ");
  });
});
