/** Grade 1 (ages 6–7): counting, adding and taking away within 20, comparing, patterns and flat shapes. */

import type { Puzzle } from "../../types";
import { build, countKm, distinct, howKm, intBetween, many, NAMES, pic, pickOne, plus, sumQ, SHAPE_NAMES, THINGS, type Q } from "./kit";

const G = 1 as const;
const STORY_THINGS = THINGS.filter((t) => t.cls !== "");

const counting: Q[] = distinct("g1-count", 18, (rng) => {
  const t = pickOne(rng, THINGS);
  const n = intBetween(rng, 3, 10);
  return {
    grade: G, key: `count-${t.icon}-${n}`, pics: many(t.icon, n, t.one),
    en: `How many ${t.many} are there?`, km: `មាន${howKm(t)}?`, answer: String(n),
    whyEn: `Count them one by one: there are ${n}.`, whyKm: `រាប់ម្តងមួយៗ៖ មាន ${n}។`,
  };
});

const frames: Q[] = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => ({
  grade: G, key: `frame-${n}`, pics: [pic(`frame-${n}`)],
  en: "How many dots can you see?", km: "អ្នកឃើញចំណុចប៉ុន្មាន?", answer: String(n),
  whyEn: `The frame has ${n} dots.`, whyKm: `ប្រអប់នេះមានចំណុច ${n}។`,
}));

const dice: Q[] = [
  ...[1, 2, 3, 4, 5, 6].map((n): Q => ({
    grade: G, key: `die-${n}`, pics: [pic(`dice-${n}`)],
    en: "How many dots are on the dice?", km: "លើគ្រាប់ឡុកឡាក់មានចំណុចប៉ុន្មាន?", answer: String(n),
    whyEn: `Count the dots: ${n}.`, whyKm: `រាប់ចំណុច៖ ${n}។`,
  })),
  ...distinct("g1-dice", 8, (rng) => {
    const a = intBetween(rng, 1, 6);
    const b = intBetween(rng, 1, 6);
    return {
      grade: G, key: `dice-${a}-${b}`, pics: [pic(`dice-${a}`), plus, pic(`dice-${b}`)],
      en: "Add the dots on both dice.", km: "បូកចំណុចលើគ្រាប់ឡុកឡាក់ទាំងពីរ។", answer: String(a + b),
      whyEn: `${a} + ${b} = ${a + b}.`, whyKm: `${a} + ${b} = ${a + b}។`,
    };
  }),
];

const addPictures: Q[] = distinct("g1-addpic", 10, (rng) => {
  const t = pickOne(rng, THINGS);
  const a = intBetween(rng, 1, 7);
  const b = intBetween(rng, 1, Math.min(7, 11 - a));
  return {
    grade: G, key: `addpic-${t.icon}-${a + b}`, pics: [...many(t.icon, a, t.one), plus, ...many(t.icon, b, t.one)],
    en: `How many ${t.many} altogether?`, km: `សរុបមាន${howKm(t)}?`, answer: String(a + b),
    whyEn: `${a} + ${b} = ${a + b}.`, whyKm: `${a} + ${b} = ${a + b}។`,
  };
});

const addStories: Q[] = distinct("g1-addstory", 18, (rng) => {
  const t = pickOne(rng, STORY_THINGS);
  const n = pickOne(rng, NAMES);
  const a = intBetween(rng, 2, 12);
  const b = intBetween(rng, 2, 20 - a);
  if (b < 2) return null;
  const sum = a + b;
  const animal = t.kind === "animal";
  return {
    grade: G, key: `add-${n.en.toLowerCase()}-${t.icon}-${a}-${b}`,
    en: animal ? `There are ${a} ${t.many}. ${b} more come. How many are there now?` : `${n.en} has ${a} ${t.many}. A friend gives ${n.en} ${b} more. How many does ${n.en} have now?`,
    km: animal ? `មាន${countKm(t, a)}។ មាន${countKm(t, b)}ទៀតមកដល់។ ឥឡូវមាន${howKm(t)}?` : `${n.km}មាន${countKm(t, a)}។ មិត្តឲ្យ${n.km}${t.km} ${b} ${t.cls}ទៀត។ ឥឡូវ${n.km}មាន${howKm(t)}?`,
    answer: String(sum), whyEn: `${a} + ${b} = ${sum}.`, whyKm: `${a} + ${b} = ${sum}។`,
  };
});

const takeStories: Q[] = distinct("g1-takestory", 18, (rng) => {
  const t = pickOne(rng, STORY_THINGS);
  const n = pickOne(rng, NAMES);
  const a = intBetween(rng, 5, 20);
  const b = intBetween(rng, 2, a - 1);
  const left = a - b;
  const animal = t.kind === "animal";
  return {
    grade: G, key: `take-${n.en.toLowerCase()}-${t.icon}-${a}-${b}`,
    en: animal ? `There are ${a} ${t.many}. ${b} ${t.leaveEn}. How many are left?` : `${n.en} has ${a} ${t.many}. ${n.en} gives ${b} to a friend. How many are left?`,
    km: animal ? `មាន${countKm(t, a)}។ ${t.km} ${b} ${t.cls}${t.leaveKm}។ នៅសល់${howKm(t)}?` : `${n.km}មាន${countKm(t, a)}។ ${n.km}ឲ្យមិត្ត ${b} ${t.cls}។ ${n.km}នៅសល់${howKm(t)}?`,
    answer: String(left), whyEn: `${a} − ${b} = ${left}.`, whyKm: `${a} − ${b} = ${left}។`,
  };
});

const bonds: Puzzle[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((a) => sumQ(G, a, "+", 10 - a, "b")),
  sumQ(G, 12, "+", 8, "b"), sumQ(G, 15, "+", 5, "b"), sumQ(G, 13, "+", 7, "b"),
  sumQ(G, 9, "−", 4, "a"), sumQ(G, 7, "−", 2, "a"),
];

const comparing: Q[] = distinct("g1-compare", 14, (rng, i) => {
  const a = intBetween(rng, 1, 20);
  const b = intBetween(rng, 1, 20);
  if (a === b) return null;
  const bigger = i % 2 === 0;
  const right = bigger ? Math.max(a, b) : Math.min(a, b);
  return {
    grade: G, key: `cmp-${bigger ? "big" : "small"}-${Math.min(a, b)}-${Math.max(a, b)}`,
    en: `Which number is ${bigger ? "bigger" : "smaller"}: ${a} or ${b}?`, km: `លេខមួយណា${bigger ? "ធំជាង" : "តូចជាង"}៖ ${a} ឬ ${b}?`,
    options: [String(a), String(b)], answer: String(right),
    whyEn: `${right} is ${bigger ? "more" : "less"} than ${right === a ? b : a}.`, whyKm: `${right} ${bigger ? "ធំជាង" : "តូចជាង"} ${right === a ? b : a}។`,
  };
});

/** Counting on in steps: 2, 4, 6, ? */
const patterns: Q[] = distinct("g1-pattern", 14, (rng) => {
  const step = pickOne(rng, [1, 2, 2, 5, 5, 10, -1, -2]);
  const start = step > 0 ? intBetween(rng, 0, step === 10 ? 3 : 10) * (step === 10 ? 10 : step === 5 ? 1 : 1) : intBetween(rng, 14, 20);
  const seq = [0, 1, 2, 3].map((k) => start + k * step);
  const next = start + 4 * step;
  if (next < 0 || next > 100) return null;
  return {
    grade: G, key: `next-${seq.join("-")}`,
    en: `What number comes next? ${seq.join(", ")}, ?`, km: `តើលេខបន្ទាប់ជាលេខអ្វី? ${seq.join(", ")}, ?`, answer: String(next),
    whyEn: step > 0 ? `Each number is ${step} more. ${seq[3]} + ${step} = ${next}.` : `Each number is ${-step} less. ${seq[3]} − ${-step} = ${next}.`,
    whyKm: step > 0 ? `លេខនីមួយៗច្រើនជាងមុន ${step}។ ${seq[3]} + ${step} = ${next}។` : `លេខនីមួយៗតិចជាងមុន ${-step}។ ${seq[3]} − ${-step} = ${next}។`,
  };
});

const sides: Q[] = (["triangle", "square", "rectangle", "pentagon", "hexagon", "octagon"] as const).map((s) => ({
  grade: G, key: `sides-${s}`, pics: [pic(`shape-${s}`, s)],
  en: "How many sides does this shape have?", km: "រូបនេះមានជ្រុងប៉ុន្មាន?", answer: String(SHAPE_NAMES[s].sides),
  whyEn: `A ${SHAPE_NAMES[s].en} has ${SHAPE_NAMES[s].sides} sides.`, whyKm: `${SHAPE_NAMES[s].km}មានជ្រុង ${SHAPE_NAMES[s].sides}។`,
}));

const shapeCounts: Q[] = distinct("g1-shapes", 8, (rng) => {
  const kinds = ["triangle", "square", "circle", "rectangle"] as const;
  const target = pickOne(rng, kinds);
  const total = intBetween(rng, 6, 10);
  const row = Array.from({ length: total }, () => pickOne(rng, kinds));
  const n = row.filter((s) => s === target).length;
  if (n < 1 || n > 5) return null;
  return {
    grade: G, key: `shapes-${row.join("")}-${target}`, pics: row.map((s) => pic(`shape-${s}`, s)),
    en: `How many ${SHAPE_NAMES[target].plural} are there?`, km: `មាន${SHAPE_NAMES[target].km}ប៉ុន្មាន?`, answer: String(n),
    whyEn: `Count only the ${SHAPE_NAMES[target].plural}: ${n}.`, whyKm: `រាប់តែ${SHAPE_NAMES[target].km}៖ ${n}។`,
  };
});

const neighbours: Q[] = distinct("g1-neighbour", 7, (rng, i) => {
  const kind = ["after", "before", "between"][i % 3];
  const n = intBetween(rng, 2, 19);
  if (kind === "after") return { grade: G, key: `after-${n}`, en: `What number comes after ${n}?`, km: `តើលេខអ្វីនៅបន្ទាប់ពី ${n}?`, answer: String(n + 1), whyEn: `${n} + 1 = ${n + 1}.`, whyKm: `${n} + 1 = ${n + 1}។` };
  if (kind === "before") return { grade: G, key: `before-${n}`, en: `What number comes before ${n}?`, km: `តើលេខអ្វីនៅមុន ${n}?`, answer: String(n - 1), whyEn: `${n} − 1 = ${n - 1}.`, whyKm: `${n} − 1 = ${n - 1}។` };
  return { grade: G, key: `between-${n}`, en: `What number is between ${n - 1} and ${n + 1}?`, km: `តើលេខអ្វីនៅចន្លោះ ${n - 1} និង ${n + 1}?`, answer: String(n), whyEn: `${n - 1}, ${n}, ${n + 1}: the middle one is ${n}.`, whyKm: `${n - 1}, ${n}, ${n + 1}៖ លេខកណ្តាលគឺ ${n}។` };
});

export const GRADE_1: Puzzle[] = [
  ...[...counting, ...frames, ...dice, ...addPictures, ...addStories, ...takeStories, ...comparing, ...patterns, ...sides, ...shapeCounts, ...neighbours].map(build),
  ...bonds,
];
