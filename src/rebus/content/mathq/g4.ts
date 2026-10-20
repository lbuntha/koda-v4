/** Grade 4 (ages 9–10): bigger numbers, remainders, factors, fractions and decimals, angles, area, elapsed time and Roman numerals. */

import type { Puzzle } from "../../types";
import { ANGLES, GRIDS } from "../../icons/more/maths";
import { makeRng, shuffled } from "../../rng";
import { addRule, bigAdd, bigTake, compareNumbers, groups, nextInPattern, riddles, takeRule, timesRule } from "./common";
import { build, distinct, intBetween, NAMES, pic, pickOne, sumQ, type Q } from "./kit";

const G = 4 as const;

const remainders: Q[] = distinct("g4-remainder", 8, (rng) => {
  const d = intBetween(rng, 3, 9);
  const q = intBetween(rng, 3, 12);
  const r = intBetween(rng, 1, d - 1);
  const n = d * q + r;
  return {
    grade: G, key: `remainder-${n}-${d}`,
    en: `What is the remainder when ${n} is divided by ${d}?`, km: `តើ ${n} ចែកនឹង ${d} មានសំណល់ប៉ុន្មាន?`, answer: String(r),
    whyEn: `${d} × ${q} = ${d * q}, and ${n} − ${d * q} = ${r}.`, whyKm: `${d} × ${q} = ${d * q} ហើយ ${n} − ${d * q} = ${r}។`,
  };
});

const factorOf: Q[] = distinct("g4-factorof", 6, (rng) => {
  const n = pickOne(rng, [12, 18, 20, 24, 30, 36, 40, 42, 48]);
  const factors: number[] = [];
  for (let i = 2; i < n; i++) if (n % i === 0) factors.push(i);
  const right = pickOne(rng, factors);
  const wrong = new Set<number>();
  for (let tries = 0; wrong.size < 3 && tries < 80; tries++) {
    const x = intBetween(rng, 2, n - 1);
    if (n % x !== 0) wrong.add(x);
  }
  return {
    grade: G, key: `factorof-${n}-${right}`,
    en: `Which number is a factor of ${n}?`, km: `លេខមួយណាជាកត្តានៃ ${n}?`,
    options: shuffled(rng, [right, ...wrong].map(String)), answer: String(right),
    whyEn: `${n} ÷ ${right} = ${n / right}, with nothing left over.`, whyKm: `${n} ÷ ${right} = ${n / right} ដោយគ្មានសំណល់។`,
  };
});

const countFactors: Q[] = [6, 8, 9, 10, 12, 15, 16, 18].slice(0, 5).map((n) => {
  const factors = Array.from({ length: n }, (_, i) => i + 1).filter((x) => n % x === 0);
  return {
    grade: G, key: `factors-${n}`,
    en: `How many factors does ${n} have?`, km: `${n} មានកត្តាប៉ុន្មាន?`, answer: String(factors.length),
    whyEn: `The factors of ${n} are ${factors.join(", ")}: ${factors.length} of them.`, whyKm: `កត្តានៃ ${n} គឺ ${factors.join(", ")}៖ មាន ${factors.length}។`,
  };
});

const equivalent: Q[] = distinct("g4-equiv", 8, (rng) => {
  const n = pickOne(rng, [2, 3, 4, 5]);
  const k = intBetween(rng, 1, n - 1);
  const m = intBetween(rng, 2, 4);
  return {
    grade: G, key: `equiv-${k}-${n}-${m}`,
    en: `What number makes the fractions equal? ${k}/${n} = ?/${n * m}`, km: `តើចំនួនណាធ្វើឱ្យប្រភាគទាំងពីរស្មើគ្នា? ${k}/${n} = ?/${n * m}`, answer: String(k * m),
    whyEn: `${n} × ${m} = ${n * m}, so multiply the top by ${m} too: ${k} × ${m} = ${k * m}.`, whyKm: `${n} × ${m} = ${n * m} ដូច្នេះគុណភាគយកនឹង ${m} ដែរ៖ ${k} × ${m} = ${k * m}។`,
  };
});

const fractionOf: Q[] = distinct("g4-fracof", 8, (rng) => {
  const n = pickOne(rng, [2, 3, 4, 5]);
  const k = intBetween(rng, 1, n - 1);
  const unit = intBetween(rng, 2, 9);
  const total = n * unit;
  return {
    grade: G, key: `fracof-${k}-${n}-${total}`,
    en: `What is ${k}/${n} of ${total}?`, km: `${k}/${n} នៃ ${total} គឺប៉ុន្មាន?`, answer: String(k * unit),
    whyEn: `${total} ÷ ${n} = ${unit}, and ${unit} × ${k} = ${k * unit}.`, whyKm: `${total} ÷ ${n} = ${unit} ហើយ ${unit} × ${k} = ${k * unit}។`,
  };
});

const addFractions: Q[] = distinct("g4-addfrac", 6, (rng) => {
  const n = pickOne(rng, [5, 6, 7, 8, 9, 10]);
  const a = intBetween(rng, 1, n - 2);
  const b = intBetween(rng, 1, n - 1 - a);
  if (b < 1) return null;
  return {
    grade: G, key: `addfrac-${a}-${b}-${n}`,
    en: `${a}/${n} + ${b}/${n} = ?`, km: `${a}/${n} + ${b}/${n} = ?`, answer: `${a + b}/${n}`,
    whyEn: `The bottom stays ${n}: ${a} + ${b} = ${a + b} parts, so ${a + b}/${n}.`, whyKm: `ភាគបែងនៅតែ ${n}៖ ${a} + ${b} = ${a + b} ផ្នែក ដូច្នេះ ${a + b}/${n}។`,
  };
});

/** Tenths, kept as whole numbers so no sum is ever off by a hair. */
const tenths = (t: number): string => (t % 10 === 0 ? String(t / 10) : (t / 10).toFixed(1));

const decimalSums: Q[] = distinct("g4-decimal", 8, (rng, i) => {
  const a = intBetween(rng, 2, 59);
  const b = intBetween(rng, 2, 39);
  if (a % 10 === 0 || b % 10 === 0) return null;
  const add = i % 2 === 0;
  const x = add ? a : Math.max(a, b);
  const y = add ? b : Math.min(a, b);
  const r = add ? x + y : x - y;
  if (r % 10 === 0 || r <= 0) return null;
  return {
    grade: G, key: `decimal-${add ? "add" : "sub"}-${x}-${y}`,
    en: `${tenths(x)} ${add ? "+" : "−"} ${tenths(y)} = ?`, km: `${tenths(x)} ${add ? "+" : "−"} ${tenths(y)} = ?`, answer: tenths(r),
    whyEn: `${x} tenths ${add ? "+" : "−"} ${y} tenths = ${r} tenths = ${tenths(r)}.`, whyKm: `${x} ភាគដប់ ${add ? "+" : "−"} ${y} ភាគដប់ = ${r} ភាគដប់ = ${tenths(r)}។`,
  };
});

const decimalCompare: Q[] = distinct("g4-decimalcmp", 6, (rng, i) => {
  const a = intBetween(rng, 11, 99);
  const b = intBetween(rng, 11, 99);
  if (a === b || a % 10 === 0 || b % 10 === 0) return null;
  const small = i % 2 === 1;
  // Written as tenths and hundredths: 0.6 and 0.45 look different but the longer one is not always bigger.
  const x = i % 3 === 0 ? tenths(a) : (a / 100).toFixed(2);
  const y = (b / 100).toFixed(2);
  const xv = Number(x);
  const yv = Number(y);
  if (xv === yv) return null;
  const right = (small ? xv < yv : xv > yv) ? x : y;
  return {
    grade: G, key: `dcmp-${small ? "small" : "big"}-${x}-${y}`,
    en: `Which number is ${small ? "smaller" : "bigger"}: ${x} or ${y}?`, km: `តើចំនួនមួយណា${small ? "តូចជាង" : "ធំជាង"}៖ ${x} ឬ ${y}?`,
    options: [x, y], answer: right,
    whyEn: `Line up the decimals: ${right} is ${small ? "less" : "more"}.`, whyKm: `តម្រឹមចំនួនទសភាគ៖ ${right} ${small ? "តូចជាង" : "ធំជាង"}។`,
  };
});

const angles: Q[] = ANGLES.map((d) => {
  const near = [30, 45, 60, 90, 120, 135, 150].filter((x) => x !== d).sort((a, b) => Math.abs(a - d) - Math.abs(b - d)).slice(0, 2);
  return {
    grade: G, key: `angle-${d}`, pics: [pic(`angle-${d}`, `${d} degree angle`)],
    en: "About how big is this angle?", km: "មុំនេះមានទំហំប្រហែលប៉ុន្មាន?",
    options: shuffled(makeRng(`g4-angle-${d}`), [`${d}°`, ...near.map((x) => `${x}°`)]), answer: `${d}°`,
    whyEn: d === 90 ? "It is a square corner: a right angle is 90°." : d < 90 ? `It is narrower than a square corner (90°): about ${d}°.` : `It is wider than a square corner (90°): about ${d}°.`,
    whyKm: d === 90 ? "វាជាមុំកែង៖ មុំកែងមាន 90°។" : d < 90 ? `វាតូចជាងមុំកែង (90°)៖ ប្រហែល ${d}°។` : `វាធំជាងមុំកែង (90°)៖ ប្រហែល ${d}°។`,
  };
});

const gridAreas: Q[] = GRIDS.slice(8).map(([r, c]) => ({
  grade: G, key: `area-${r}x${c}`, pics: [pic(`grid-${r}x${c}`, `${r} by ${c} squares`)],
  en: "Each small square is 1 cm². What is the area of this rectangle in cm²?", km: "ការ៉េតូចនីមួយៗមាន 1 សង់ទីម៉ែត្រការ៉េ។ ក្រឡាផ្ទៃចតុកោណកែងនេះជាប៉ុន្មានសង់ទីម៉ែត្រការ៉េ?", answer: String(r * c),
  whyEn: `${r} rows of ${c}: ${r} × ${c} = ${r * c} cm².`, whyKm: `${r} ជួរ ជួរនីមួយៗ ${c}៖ ${r} × ${c} = ${r * c} សង់ទីម៉ែត្រការ៉េ។`,
}));

const rectangles: Q[] = distinct("g4-rect", 14, (rng, i) => {
  const l = intBetween(rng, 4, 15);
  const w = intBetween(rng, 2, l - 1);
  const area = i % 2 === 0;
  return {
    grade: G, key: `rect-${area ? "area" : "perimeter"}-${l}x${w}`,
    en: `A rectangle is ${l} cm long and ${w} cm wide. What is its ${area ? "area in cm²" : "perimeter in cm"}?`,
    km: `ចតុកោណកែងមួយមានបណ្តោយ ${l} សង់ទីម៉ែត្រ និងទទឹង ${w} សង់ទីម៉ែត្រ។ ${area ? "ក្រឡាផ្ទៃរបស់វាជាប៉ុន្មានសង់ទីម៉ែត្រការ៉េ" : "បរិមាត្ររបស់វាជាប៉ុន្មានសង់ទីម៉ែត្រ"}?`,
    answer: String(area ? l * w : 2 * (l + w)),
    whyEn: area ? `Area = length × width = ${l} × ${w} = ${l * w}.` : `Perimeter = 2 × (${l} + ${w}) = ${2 * (l + w)}.`,
    whyKm: area ? `ក្រឡាផ្ទៃ = បណ្តោយ × ទទឹង = ${l} × ${w} = ${l * w}។` : `បរិមាត្រ = 2 × (${l} + ${w}) = ${2 * (l + w)}។`,
  };
});

const clock = (m: number): string => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const elapsed: Q[] = distinct("g4-elapsed", 6, (rng) => {
  const start = intBetween(rng, 7, 15) * 60 + pickOne(rng, [0, 15, 30, 45]);
  const len = pickOne(rng, [35, 40, 45, 50, 75, 80, 90, 105, 120, 135]);
  return {
    grade: G, key: `elapsed-${start}-${len}`,
    en: `A lesson starts at ${clock(start)} and ends at ${clock(start + len)}. How many minutes long is it?`, km: `មេរៀនមួយចាប់ផ្តើមម៉ោង ${clock(start)} ហើយចប់ម៉ោង ${clock(start + len)}។ វាមានរយៈពេលប៉ុន្មាននាទី?`, answer: String(len),
    whyEn: `From ${clock(start)} to ${clock(start + len)} is ${len} minutes.`, whyKm: `ពីម៉ោង ${clock(start)} ដល់ ${clock(start + len)} គឺ ${len} នាទី។`,
  };
});

const ROMAN: ReadonlyArray<[number, string]> = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
const toRoman = (n: number): string => ROMAN.reduce((out, [v, s]) => { while (n >= v) { out += s; n -= v; } return out; }, "");

const romans: Q[] = distinct("g4-roman", 8, (rng) => {
  const n = intBetween(rng, 4, 49);
  const r = toRoman(n);
  return {
    grade: G, key: `roman-${n}`,
    en: `Which number is the Roman numeral ${r}?`, km: `លេខរ៉ូម៉ាំង ${r} ស្មើលេខប៉ុន្មាន?`, answer: String(n),
    whyEn: `${r} is ${n}. (I = 1, V = 5, X = 10, L = 50. A small one before a bigger one is taken away.)`, whyKm: `${r} ស្មើ ${n}។ (I = 1, V = 5, X = 10, L = 50។ លេខតូចនៅមុខលេខធំត្រូវដក។)`,
    d: n > 30 ? 3 : 2,
  };
});

const MULTI: Array<{ en: (n: string, a: number, p: number, q: number, extra: number) => string; km: (n: string, a: number, p: number, q: number, extra: number) => string; item: string }> = [
  { item: "pencils", en: (n, _a, p, q, e) => `${n} buys ${q} pencils at $${p} each and a notebook for $${e}. How many dollars does ${n} spend?`, km: (n, _a, p, q, e) => `${n}ទិញខ្មៅដៃ ${q} ដើម ក្នុងតម្លៃ ${p} ដុល្លារក្នុងមួយដើម និងសៀវភៅកត់ត្រាមួយក្បាលតម្លៃ ${e} ដុល្លារ។ ${n}ចំណាយអស់ប៉ុន្មានដុល្លារ?` },
  { item: "mangoes", en: (n, _a, p, q, e) => `${n} buys ${q} mangoes at $${p} each and pays with $${e}. How many dollars does ${n} get back?`, km: (n, _a, p, q, e) => `${n}ទិញស្វាយ ${q} ផ្លែ ក្នុងតម្លៃ ${p} ដុល្លារក្នុងមួយផ្លែ ហើយបង់ ${e} ដុល្លារ។ ${n}ត្រូវទទួលលុយអាប់ប៉ុន្មានដុល្លារ?` },
];

const multiSteps: Q[] = distinct("g4-multi", 8, (rng, i) => {
  const who = pickOne(rng, NAMES);
  const p = intBetween(rng, 2, 6);
  const q = intBetween(rng, 3, 7);
  const kind = MULTI[i % 2];
  const extra = i % 2 === 0 ? intBetween(rng, 3, 9) : (Math.ceil((p * q + 1) / 10) * 10);
  const answer = i % 2 === 0 ? p * q + extra : extra - p * q;
  return {
    grade: G, key: `multi-${kind.item}-${who.en.toLowerCase()}-${p}x${q}-${extra}`,
    en: kind.en(who.en, 0, p, q, extra), km: kind.km(who.km, 0, p, q, extra), answer: String(answer),
    whyEn: i % 2 === 0 ? `${q} × $${p} = $${p * q}, and $${p * q} + $${extra} = $${answer}.` : `${q} × $${p} = $${p * q}, and $${extra} − $${p * q} = $${answer}.`,
    whyKm: i % 2 === 0 ? `${q} × ${p} = ${p * q} ហើយ ${p * q} + ${extra} = ${answer} ដុល្លារ។` : `${q} × ${p} = ${p * q} ហើយ ${extra} − ${p * q} = ${answer} ដុល្លារ។`,
  };
});

const ROUND_UNITS: Array<[number, string, string]> = [[10, "ten", "ដប់"], [100, "hundred", "រយ"], [1000, "thousand", "ពាន់"]];
const rounding: Q[] = distinct("g4-round", 6, (rng, i) => {
  const [unit, en, km] = ROUND_UNITS[i % 3];
  const n = intBetween(rng, unit * 2 + 1, unit * 9 - 1);
  if (n % unit === 0) return null;
  const up = n % unit >= unit / 2;
  const rounded = (Math.floor(n / unit) + (up ? 1 : 0)) * unit;
  return {
    grade: G, key: `round-${unit}-${n}`,
    en: `Round ${n} to the nearest ${en}.`, km: `បង្គត់ ${n} ទៅខ្ទង់${km}។`, answer: String(rounded),
    whyEn: `Look at the digit to the right: ${up ? "5 or more, so round up" : "less than 5, so round down"} to ${rounded}.`, whyKm: `មើលខ្ទង់ខាងស្តាំ៖ ${up ? "ចាប់ពី 5 ឡើងទៅ ដូច្នេះបង្គត់ឡើង" : "តិចជាង 5 ដូច្នេះបង្គត់ចុះ"}ទៅ ${rounded}។`,
  };
});

const sums: Puzzle[] = [
  sumQ(G, 34, "×", 6), sumQ(G, 47, "×", 8), sumQ(G, 58, "×", 7), sumQ(G, 63, "×", 9), sumQ(G, 125, "×", 4), sumQ(G, 208, "×", 5),
  sumQ(G, 156, "÷", 6), sumQ(G, 224, "÷", 8), sumQ(G, 315, "÷", 5), sumQ(G, 432, "÷", 9), sumQ(G, 25, "×", 4, "a"), sumQ(G, 360, "÷", 6, "b"),
];

export const GRADE_4: Puzzle[] = [
  ...[
    ...bigAdd(G, 6, 1000, 4000),
    ...bigTake(G, 6, 3000, 9000),
    ...groups(G, 10, 25, 9),
    ...remainders,
    ...factorOf,
    ...countFactors,
    ...equivalent,
    ...fractionOf,
    ...addFractions,
    ...decimalSums,
    ...decimalCompare,
    ...angles,
    ...gridAreas,
    ...rectangles,
    ...elapsed,
    ...romans,
    ...multiSteps,
    ...rounding,
    ...compareNumbers(G, 5, 1000, 9999),
    ...nextInPattern(G, 8, [addRule(11), addRule(12), addRule(25), addRule(125), takeRule(7), takeRule(15), timesRule(2), timesRule(3)], [1, 2, 3, 5, 10, 40, 100, 500, 900], 4),
    ...riddles(G, 6, ["×", "÷"], 6, 40),
  ].map(build),
  ...sums,
];
