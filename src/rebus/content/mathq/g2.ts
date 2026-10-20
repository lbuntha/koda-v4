/** Grade 2 (ages 7–8): numbers to 100, place value, skip counting, even and odd, coins, clocks and lengths. */

import type { Puzzle } from "../../types";
import { LENGTHS, TALLIES } from "../../icons/more/maths";
import { addRule, addStories, change, clocks, compareNumbers, compareSums, groups, nextInPattern, riddles, takeStories } from "./common";
import { build, distinct, intBetween, pic, pickOne, plus, sumQ, SHAPE_NAMES, type Q } from "./kit";

const G = 2 as const;

const adds = addStories(G, 16, 20, 60, 99);
const takes = takeStories(G, 16, 30, 99);

const patterns = nextInPattern(G, 12, [addRule(2), addRule(3), addRule(4), addRule(5), addRule(10)], [0, 2, 3, 4, 5, 10, 12, 15, 20, 25, 30], 4);

const evens: Q[] = distinct("g2-even", 8, (rng, i) => {
  const wantEven = i % 2 === 0;
  const right = intBetween(rng, 3, 99);
  if (right % 2 !== (wantEven ? 0 : 1)) return null;
  const others = new Set<number>();
  for (let tries = 0; others.size < 2 && tries < 40; tries++) {
    const x = intBetween(rng, 3, 99);
    if (x % 2 === (wantEven ? 1 : 0)) others.add(x);
  }
  if (others.size < 2) return null;
  const options = [right, ...others].sort((a, b) => a - b).map(String);
  return {
    grade: G, key: `${wantEven ? "even" : "odd"}-${options.join("-")}`,
    en: `Which number is ${wantEven ? "even" : "odd"}?`, km: `តើចំនួនមួយណាជាចំនួន${wantEven ? "គូ" : "សេស"}?`,
    options, answer: String(right),
    whyEn: wantEven ? `${right} can be split into two equal groups.` : `${right} ends in ${right % 10}, so it cannot be split into two equal groups.`,
    whyKm: wantEven ? `${right} អាចបែងចែកជាពីរក្រុមស្មើគ្នា។` : `${right} ចុងបញ្ចប់ដោយ ${right % 10} ដូច្នេះមិនអាចបែងចែកជាពីរក្រុមស្មើគ្នាទេ។`,
  };
});

const tensOnes: Q[] = distinct("g2-tens", 10, (rng) => {
  const t = intBetween(rng, 1, 9);
  const o = intBetween(rng, 1, 9);
  return {
    grade: G, key: `tens-${t}-${o}`,
    en: `How much is ${t} tens and ${o} ones?`, km: `${t} ដប់ និង ${o} ឯកតា ស្មើប៉ុន្មាន?`, answer: String(t * 10 + o),
    whyEn: `${t} tens is ${t * 10}, and ${o} more is ${t * 10 + o}.`, whyKm: `${t} ដប់ស្មើ ${t * 10} បូក ${o} ទៀតបាន ${t * 10 + o}។`,
  };
});

const PLACES: Array<[string, string, number]> = [["tens", "ខ្ទង់ដប់", 10], ["ones", "ខ្ទង់ឯកតា", 1]];
const placeValue: Q[] = distinct("g2-place", 10, (rng) => {
  const n = intBetween(rng, 21, 98);
  if (n % 10 === 0) return null;
  const [en, km, mult] = pickOne(rng, PLACES);
  const digit = mult === 10 ? Math.floor(n / 10) : n % 10;
  if (new Set(String(n)).size < 2) return null;
  return {
    grade: G, key: `place-${n}-${en}`,
    en: `What is the value of the ${digit} in ${n}?`, km: `តម្លៃនៃលេខ ${digit} ក្នុង ${n} គឺប៉ុន្មាន?`, answer: String(digit * mult),
    whyEn: `The ${digit} is in the ${en} place, so it is worth ${digit * mult}.`, whyKm: `លេខ ${digit} នៅ${km} ដូច្នេះមានតម្លៃ ${digit * mult}។`,
  };
});

const clockQs = clocks(G, [0, 30]);

const lengths: Q[] = LENGTHS.map((n) => ({
  grade: G, key: `length-${n}`, pics: [pic(`length-${n}`, `arrow ${n} cm`)],
  en: "How many centimetres long is the orange arrow?", km: "ព្រួញពណ៌ទឹកក្រូចវែងប៉ុន្មានសង់ទីម៉ែត្រ?", answer: String(n),
  whyEn: `The arrow starts at 0 and ends at ${n}, so it is ${n} cm long.`, whyKm: `ព្រួញចាប់ពី 0 ដល់ ${n} ដូច្នេះវែង ${n} សង់ទីម៉ែត្រ។`,
}));

const groupStories = groups(G, 8, 5, 5);
const moneyChange = change(G, 12, [10, 20], 9);

const tallies: Q[] = TALLIES.slice(0, 6).map((n) => ({
  grade: G, key: `tally-${n}`, pics: [pic(`tally-${n}`, `${n} tally marks`)],
  en: "How many tally marks are there? Every fifth mark crosses four.", km: "មានគំនូសប៉ុន្មាន? គំនូសទីប្រាំកាត់ពីលើគំនូស 4 មុន។", answer: String(n),
  whyEn: `Each crossed group is 5. Count them: ${n}.`, whyKm: `ក្រុមដែលមានគំនូសកាត់នីមួយៗមាន 5។ រាប់ទាំងអស់៖ ${n}។`,
}));

const sideTotals: Q[] = distinct("g2-sides", 6, (rng) => {
  const names = ["triangle", "square", "rectangle", "pentagon", "hexagon"] as const;
  const n = intBetween(rng, 2, 3);
  const row = Array.from({ length: n }, () => pickOne(rng, names));
  const total = row.reduce((s, r) => s + SHAPE_NAMES[r].sides, 0);
  return {
    grade: G, key: `sidetotal-${row.join("-")}`, pics: row.flatMap((r, i) => (i === 0 ? [pic(`shape-${r}`, r)] : [plus, pic(`shape-${r}`, r)])),
    en: "How many sides are there in all?", km: "សរុបមានជ្រុងប៉ុន្មាន?", answer: String(total),
    whyEn: `${row.map((r) => SHAPE_NAMES[r].sides).join(" + ")} = ${total}.`, whyKm: `${row.map((r) => SHAPE_NAMES[r].sides).join(" + ")} = ${total}។`,
  };
});

const roundShapes: Q[] = [
  { grade: G, key: "sides-diamond", pics: [pic("shape-diamond", "diamond")], en: "How many sides does this diamond shape have?", km: "រូបពេជ្រនេះមានជ្រុងប៉ុន្មាន?", answer: "4", whyEn: "A diamond shape has 4 straight sides.", whyKm: "រូបពេជ្រមានជ្រុងត្រង់ 4។" },
  { grade: G, key: "sides-oval", pics: [pic("shape-oval", "oval")], en: "How many straight sides does an oval have?", km: "រាងពងក្រពើមានជ្រុងត្រង់ប៉ុន្មាន?", answer: "0", whyEn: "An oval is smooth and round, so it has no straight sides.", whyKm: "រាងពងមូលរលោង ដូច្នេះគ្មានជ្រុងត្រង់ទេ។" },
];

const halves: Q[] = distinct("g2-half", 4, (rng, i) => {
  const half = intBetween(rng, 3, 25);
  const total = half * 2;
  return {
    grade: G, key: `half-${total}`,
    en: `What is half of ${total}?`, km: `ពាក់កណ្តាលនៃ ${total} គឺប៉ុន្មាន?`, answer: String(half),
    whyEn: `Split ${total} into 2 equal parts: ${half} each.`, whyKm: `បែងចែក ${total} ជា 2 ផ្នែកស្មើគ្នា៖ ម្ខាងៗ ${half}។`,
    d: i < 2 ? 1 : 2,
  };
});

const missing: Puzzle[] = [
  sumQ(G, 30, "+", 25, "b"), sumQ(G, 45, "+", 20, "b"), sumQ(G, 17, "+", 40, "b"), sumQ(G, 60, "−", 25, "b"), sumQ(G, 80, "−", 35, "a"), sumQ(G, 100, "−", 40, "b"),
  sumQ(G, 28, "+", 15), sumQ(G, 56, "+", 27), sumQ(G, 91, "−", 46), sumQ(G, 70, "−", 38),
];

export const GRADE_2: Puzzle[] = [
  ...[...adds, ...takes, ...patterns, ...evens, ...tensOnes, ...placeValue, ...clockQs, ...lengths, ...groupStories, ...moneyChange, ...tallies, ...sideTotals, ...roundShapes, ...halves,
    ...riddles(G, 8, ["+", "−"], 5, 40), ...compareNumbers(G, 8, 10, 99), ...compareSums(G, 8, 5, 40)].map(build),
  ...missing,
];
