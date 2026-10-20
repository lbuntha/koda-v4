/** Grade 3 (ages 8–9): times tables, sharing, fractions, quarter-hour clocks, area and perimeter, rounding and units. */

import type { Puzzle } from "../../types";
import { ARRAYS, GRIDS, TALLIES } from "../../icons/more/maths";
import { addRule, bigAdd, bigTake, change, clocks, compareNumbers, fractionPies, groups, nextInPattern, priceTimes, riddles, sharing, takeRule, timesRule } from "./common";
import { build, distinct, intBetween, pic, pickOne, sumQ, type Q } from "./kit";

const G = 3 as const;

const arrays: Q[] = ARRAYS.map(([r, c]) => ({
  grade: G, key: `array-${r}x${c}`, pics: [pic(`array-${r}x${c}`, `${r} rows of ${c} dots`)],
  en: "How many dots are there in all?", km: "សរុបមានចំណុចប៉ុន្មាន?", answer: String(r * c),
  whyEn: `${r} rows of ${c}: ${r} × ${c} = ${r * c}.`, whyKm: `${r} ជួរ ជួរនីមួយៗ ${c}៖ ${r} × ${c} = ${r * c}។`,
}));

const areas: Q[] = GRIDS.slice(0, 8).map(([r, c]) => ({
  grade: G, key: `area-${r}x${c}`, pics: [pic(`grid-${r}x${c}`, `${r} by ${c} squares`)],
  en: "How many small squares cover this rectangle?", km: "តើមានការ៉េតូចៗប៉ុន្មានគ្របលើចតុកោណកែងនេះ?", answer: String(r * c),
  whyEn: `${r} rows of ${c} squares: ${r} × ${c} = ${r * c}.`, whyKm: `${r} ជួរ ជួរនីមួយៗមាន ${c} ការ៉េ៖ ${r} × ${c} = ${r * c}។`,
}));

const perimeters: Q[] = GRIDS.slice(0, 6).map(([r, c]) => ({
  grade: G, key: `perimeter-${r}x${c}`, pics: [pic(`grid-${r}x${c}`, `${r} by ${c} squares`)],
  en: "Each square side is 1 cm. How long is the edge all the way round?", km: "ជ្រុងការ៉េនីមួយៗវែង 1 សង់ទីម៉ែត្រ។ គែមជុំវិញទាំងមូលវែងប៉ុន្មាន?", answer: String(2 * (r + c)),
  whyEn: `${r} + ${c} + ${r} + ${c} = ${2 * (r + c)} cm.`, whyKm: `${r} + ${c} + ${r} + ${c} = ${2 * (r + c)} សង់ទីម៉ែត្រ។`,
}));

const tallies: Q[] = TALLIES.slice(6).map((n) => ({
  grade: G, key: `tally-${n}`, pics: [pic(`tally-${n}`, `${n} tally marks`)],
  en: "How many tally marks are there? Every fifth mark crosses four.", km: "មានគំនូសប៉ុន្មាន? គំនូសទីប្រាំកាត់ពីលើគំនូស 4 មុន។", answer: String(n),
  whyEn: `Count the crossed groups in fives, then the rest: ${n}.`, whyKm: `រាប់ក្រុមដែលគូសកាត់ជាប្រាំៗ ហើយបន្ថែមសល់៖ ${n}។`,
}));

const solids: Q[] = [
  { grade: G, key: "faces-cuboid", pics: [pic("shape-cuboid", "box")], en: "How many flat faces does this box shape have?", km: "រូបប្រអប់នេះមានមុខរាបស្មើប៉ុន្មាន?", answer: "6", whyEn: "A box has a top, a bottom and four sides: 6 faces.", whyKm: "ប្រអប់មានមុខលើ មុខក្រោម និងមុខចំហៀងបួន៖ 6 មុខ។" },
  { grade: G, key: "faces-pyramid", pics: [pic("shape-pyramid", "pyramid")], en: "This pyramid has a square base. How many flat faces does it have?", km: "ពីរ៉ាមីតនេះមានបាតរាងការ៉េ។ វាមានមុខរាបស្មើប៉ុន្មាន?", answer: "5", whyEn: "One square base and four triangle sides: 5 faces.", whyKm: "បាតការ៉េមួយ និងមុខត្រីកោណបួន៖ 5 មុខ។" },
  { grade: G, key: "faces-cylinder", pics: [pic("shape-cylinder", "can")], en: "How many flat faces does a can shape (a cylinder) have?", km: "រូបកំប៉ុង (ស៊ីឡាំង) មានមុខរាបស្មើប៉ុន្មាន?", answer: "2", whyEn: "The top and the bottom are flat: 2 faces.", whyKm: "មុខលើ និងមុខក្រោមរាបស្មើ៖ 2 មុខ។" },
  { grade: G, key: "faces-cone", pics: [pic("shape-cone", "cone")], en: "How many flat faces does a cone have?", km: "កោណមានមុខរាបស្មើប៉ុន្មាន?", answer: "1", whyEn: "Only the round bottom is flat: 1 face.", whyKm: "មានតែបាតមូលទេដែលរាបស្មើ៖ 1 មុខ។" },
  { grade: G, key: "faces-sphere", pics: [pic("shape-sphere", "ball")], en: "How many flat faces does a ball shape (a sphere) have?", km: "រូបបាល់ (ស្វ៊ែរ) មានមុខរាបស្មើប៉ុន្មាន?", answer: "0", whyEn: "A sphere is round all over, so it has no flat faces.", whyKm: "ស្វ៊ែរមូលទាំងមូល ដូច្នេះគ្មានមុខរាបស្មើទេ។" },
  { grade: G, key: "edges-cube", pics: [pic("cube", "cube")], en: "How many edges does a cube have?", km: "គូបមានគែមប៉ុន្មាន?", answer: "12", whyEn: "4 edges on the top, 4 on the bottom and 4 going up: 12.", whyKm: "គែមលើ 4 គែមក្រោម 4 និងគែមបញ្ឈរ 4៖ 12។" },
];

const ROUND_TO: Array<[number, string, string]> = [[10, "ten", "ដប់"], [100, "hundred", "រយ"]];
const rounding: Q[] = distinct("g3-round", 12, (rng, i) => {
  const [unit, en, km] = ROUND_TO[i % 2];
  const n = unit === 10 ? intBetween(rng, 11, 99) : intBetween(rng, 101, 999);
  if (n % unit === 0) return null;
  const up = n % unit >= unit / 2;
  const rounded = (Math.floor(n / unit) + (up ? 1 : 0)) * unit;
  return {
    grade: G, key: `round-${unit}-${n}`,
    en: `Round ${n} to the nearest ${en}.`, km: `បង្គត់ ${n} ទៅខ្ទង់${km}។`, answer: String(rounded),
    whyEn: `${n} is ${up ? "halfway or more towards" : "closer to"} ${rounded}, so it rounds ${up ? "up" : "down"} to ${rounded}.`,
    whyKm: `${n} ជិត ${rounded} ជាងដូច្នេះបង្គត់${up ? "ឡើង" : "ចុះ"}ទៅ ${rounded}។`,
  };
});

const UNITS: Array<[string, string, string, string, number]> = [
  ["metres", "centimetres", "ម៉ែត្រ", "សង់ទីម៉ែត្រ", 100],
  ["kilograms", "grams", "គីឡូក្រាម", "ក្រាម", 1000],
  ["hours", "minutes", "ម៉ោង", "នាទី", 60],
  ["litres", "millilitres", "លីត្រ", "មីលីលីត្រ", 1000],
];
const units: Q[] = distinct("g3-units", 10, (rng) => {
  const [big, small, bigKm, smallKm, k] = pickOne(rng, UNITS);
  const n = intBetween(rng, 2, 9);
  return {
    grade: G, key: `units-${big}-${n}`,
    en: `How many ${small} are in ${n} ${big}?`, km: `${n} ${bigKm}ស្មើប៉ុន្មាន${smallKm}?`, answer: String(n * k),
    whyEn: `1 ${big.replace(/s$/, "")} is ${k} ${small}, so ${n} × ${k} = ${n * k}.`, whyKm: `1 ${bigKm} ស្មើ ${k} ${smallKm} ដូច្នេះ ${n} × ${k} = ${n * k}។`,
  };
});

const times: Puzzle[] = [
  sumQ(G, 11, "×", 6), sumQ(G, 12, "×", 5), sumQ(G, 12, "×", 7), sumQ(G, 11, "×", 8), sumQ(G, 7, "×", 11), sumQ(G, 9, "×", 12),
  sumQ(G, 42, "÷", 6), sumQ(G, 54, "÷", 9), sumQ(G, 64, "÷", 8), sumQ(G, 96, "÷", 12), sumQ(G, 7, "×", 8, "b"), sumQ(G, 6, "×", 9, "b"),
  sumQ(G, 56, "÷", 7, "b"), sumQ(G, 72, "÷", 9, "a"),
];

export const GRADE_3: Puzzle[] = [
  ...[
    ...groups(G, 18, 9, 9),
    ...sharing(G, 14, 9, 8),
    ...arrays,
    ...fractionPies(G),
    ...clocks(G, [15, 45]),
    ...areas,
    ...tallies,
    ...perimeters,
    ...solids,
    ...priceTimes(G, 12, 9, 9),
    ...change(G, 6, [20, 50], 19),
    ...rounding,
    ...bigAdd(G, 6, 120, 480),
    ...bigTake(G, 6, 300, 900),
    ...compareNumbers(G, 6, 100, 999),
    ...nextInPattern(G, 10, [addRule(25), addRule(50), addRule(100), takeRule(5), takeRule(10), timesRule(2)], [0, 5, 10, 100, 150, 200, 3, 4, 6, 20], 4),
    ...units,
    ...riddles(G, 8, ["×", "÷", "+", "−"], 6, 60),
  ].map(build),
  ...times,
];
