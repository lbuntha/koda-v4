/** Grade 6 (ages 11–12): negative numbers, percent, ratio, equations, statistics, circles, roots, probability and classic puzzles. */

import type { Puzzle } from "../../types";
import { THERMOS, thermoId } from "../../icons/more/maths";
import { shuffled } from "../../rng";
import { compareNumbers, riddles } from "./common";
import { build, distinct, intBetween, NAMES, pic, pickOne, sumQ, type Q } from "./kit";

const G = 6 as const;
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** A simplified fraction, with the decimal and percent a child might type instead. */
const fraction = (n: number, d: number): { answer: string; accepts: string[] } => {
  const g = gcd(n, d);
  const a = n / g;
  const b = d / g;
  const text = b === 1 ? String(a) : `${a}/${b}`;
  const accepts = b !== 1 && 100 % b === 0 ? [String((100 * a) / b / 100), `${(100 * a) / b}%`] : [];
  return { answer: text, accepts };
};

const thermometers: Q[] = THERMOS.map((t) => ({
  grade: G, key: `thermo-${t}`, pics: [pic(thermoId(t), `thermometer ${t}`)],
  en: "What temperature does the thermometer show, in degrees?", km: "ទែម៉ូម៉ែត្របង្ហាញសីតុណ្ហភាពប៉ុន្មានដឺក្រេ?", answer: String(t),
  whyEn: t < 0 ? `The red line is ${-t} below zero: ${t}.` : t === 0 ? "The red line stops at zero: 0." : `The red line is ${t} above zero: ${t}.`,
  whyKm: t < 0 ? `បន្ទាត់ក្រហមនៅក្រោមសូន្យ ${-t}៖ ${t}។` : t === 0 ? "បន្ទាត់ក្រហមឈប់នៅសូន្យ៖ 0។" : `បន្ទាត់ក្រហមនៅលើសូន្យ ${t}៖ ${t}។`,
}));

const warmer: Q[] = distinct("g6-warmer", 4, (rng) => {
  const start = intBetween(rng, -9, -2);
  const rise = intBetween(rng, 3, 14);
  return {
    grade: G, key: `warmer-${start}-${rise}`,
    en: `The temperature is ${start}° in the morning. It rises by ${rise} degrees. What is the temperature now?`, km: `សីតុណ្ហភាពពេលព្រឹកគឺ ${start}°។ វាឡើង ${rise} ដឺក្រេ។ ឥឡូវសីតុណ្ហភាពប៉ុន្មាន?`, answer: String(start + rise),
    whyEn: `${start} + ${rise} = ${start + rise}.`, whyKm: `${start} + ${rise} = ${start + rise}។`,
  };
});

const gaps: Q[] = distinct("g6-gap", 4, (rng) => {
  const low = intBetween(rng, -9, -1);
  const high = intBetween(rng, 2, 12);
  return {
    grade: G, key: `gap-${low}-${high}`,
    en: `How many degrees warmer is ${high}° than ${low}°?`, km: `${high}° ក្តៅជាង ${low}° ប៉ុន្មានដឺក្រេ?`, answer: String(high - low),
    whyEn: `From ${low} up to 0 is ${-low}, and then ${high} more: ${high - low}.`, whyKm: `ពី ${low} ឡើងដល់ 0 គឺ ${-low} ហើយបន្ត ${high} ទៀត៖ ${high - low}។`,
  };
});

const integerSums: Q[] = distinct("g6-integers", 10, (rng, i) => {
  const kind = i % 5;
  if (kind <= 1) {
    const a = intBetween(rng, -12, -2);
    const b = intBetween(rng, 4, 20);
    return { grade: G, key: `int-${a}p${b}`, en: `${a} + ${b} = ?`, km: `${a} + ${b} = ?`, answer: String(a + b), whyEn: `Start at ${a} and go up ${b}: ${a + b}.`, whyKm: `ចាប់ពី ${a} ហើយឡើង ${b}៖ ${a + b}។` };
  }
  if (kind <= 3) {
    const a = intBetween(rng, 2, 12);
    const b = intBetween(rng, a + 1, a + 12);
    return { grade: G, key: `int-${a}m${b}`, en: `${a} − ${b} = ?`, km: `${a} − ${b} = ?`, answer: String(a - b), whyEn: `Start at ${a} and go down ${b}: ${a - b}.`, whyKm: `ចាប់ពី ${a} ហើយចុះ ${b}៖ ${a - b}។` };
  }
  const a = intBetween(rng, -10, -2);
  const b = intBetween(rng, 2, 9);
  return { grade: G, key: `int-${a}m${b}b`, en: `${a} − ${b} = ?`, km: `${a} − ${b} = ?`, answer: String(a - b), whyEn: `Start at ${a} and go down ${b} more: ${a - b}.`, whyKm: `ចាប់ពី ${a} ហើយចុះ ${b} ទៀត៖ ${a - b}។` };
});

const negCompare: Q[] = distinct("g6-negcmp", 3, (rng, i) => {
  const a = intBetween(rng, -15, -1);
  const b = intBetween(rng, -15, 12);
  if (a === b) return null;
  const small = i % 2 === 0;
  const win = small ? Math.min(a, b) : Math.max(a, b);
  return {
    grade: G, key: `negcmp-${small ? "small" : "big"}-${Math.min(a, b)}-${Math.max(a, b)}`,
    en: `Which number is ${small ? "smaller" : "bigger"}: ${a} or ${b}?`, km: `តើចំនួនមួយណា${small ? "តូចជាង" : "ធំជាង"}៖ ${a} ឬ ${b}?`,
    options: [String(a), String(b)], answer: String(win),
    whyEn: `On a number line ${win} is ${small ? "further left" : "further right"}, so it is ${small ? "smaller" : "bigger"}.`, whyKm: `លើបន្ទាត់លេខ ${win} នៅ${small ? "ខាងឆ្វេងជាង" : "ខាងស្តាំជាង"} ដូច្នេះវា${small ? "តូចជាង" : "ធំជាង"}។`,
  };
});

const percentOf: Q[] = distinct("g6-percentof", 6, (rng) => {
  const pct = pickOne(rng, [5, 15, 30, 40, 60, 70, 90]);
  const base = pickOne(rng, [20, 40, 60, 80, 120, 200, 300, 400, 500]);
  const r = (base * pct) / 100;
  if (!Number.isInteger(r)) return null;
  return {
    grade: G, key: `pctof-${pct}-${base}`,
    en: `What is ${pct}% of ${base}?`, km: `${pct}% នៃ ${base} គឺប៉ុន្មាន?`, answer: String(r),
    whyEn: `${base} × ${pct} ÷ 100 = ${r}.`, whyKm: `${base} × ${pct} ÷ 100 = ${r}។`,
  };
});

const discounts: Q[] = distinct("g6-discount", 6, (rng) => {
  const price = pickOne(rng, [20, 40, 50, 60, 80, 100, 120, 200]);
  const pct = pickOne(rng, [10, 20, 25, 50]);
  const off = (price * pct) / 100;
  if (!Number.isInteger(off)) return null;
  return {
    grade: G, key: `discount-${price}-${pct}`,
    en: `A bag costs $${price}. It is on sale with ${pct}% off. How many dollars does it cost now?`, km: `កាបូបមួយថ្លៃ ${price} ដុល្លារ។ វាមានការបញ្ចុះតម្លៃ ${pct}%។ ឥឡូវវាថ្លៃប៉ុន្មានដុល្លារ?`, answer: String(price - off),
    whyEn: `${pct}% of $${price} is $${off}. $${price} − $${off} = $${price - off}.`, whyKm: `${pct}% នៃ ${price} ដុល្លារ គឺ ${off} ដុល្លារ។ ${price} − ${off} = ${price - off} ដុល្លារ។`,
  };
});

const percentOut: Q[] = distinct("g6-pctout", 6, (rng) => {
  const whole = pickOne(rng, [20, 25, 40, 50, 100, 200]);
  const pct = pickOne(rng, [10, 20, 25, 40, 50, 60, 75, 80]);
  const part = (whole * pct) / 100;
  if (!Number.isInteger(part)) return null;
  return {
    grade: G, key: `pctout-${part}-${whole}`,
    en: `${part} out of ${whole} is what percent?`, km: `${part} ក្នុងចំណោម ${whole} ស្មើប៉ុន្មានភាគរយ?`, answer: String(pct), accepts: [`${pct}%`],
    whyEn: `${part} ÷ ${whole} = ${pct}/100 = ${pct}%.`, whyKm: `${part} ÷ ${whole} = ${pct}/100 = ${pct}%។`,
  };
});

const shares: Q[] = distinct("g6-share", 6, (rng) => {
  const a = intBetween(rng, 1, 4);
  const b = intBetween(rng, a + 1, 6);
  if (gcd(a, b) > 1) return null;
  const k = intBetween(rng, 2, 9);
  const total = (a + b) * k;
  const who = pickOne(rng, NAMES);
  return {
    grade: G, key: `ratioshare-${a}-${b}-${total}`,
    en: `${who.en} shares ${total} sweets in the ratio ${a}:${b}. How many sweets are in the bigger share?`, km: `${who.km}ចែកស្ករគ្រាប់ ${total} គ្រាប់តាមផលធៀប ${a}:${b}។ ចំណែកធំមានស្ករគ្រាប់ប៉ុន្មានគ្រាប់?`, answer: String(b * k),
    whyEn: `${a} + ${b} = ${a + b} parts. ${total} ÷ ${a + b} = ${k} each. The bigger share is ${b} × ${k} = ${b * k}.`, whyKm: `${a} + ${b} = ${a + b} ផ្នែក។ ${total} ÷ ${a + b} = ${k} ក្នុងមួយផ្នែក។ ចំណែកធំគឺ ${b} × ${k} = ${b * k}។`,
  };
});

const unitRates: Q[] = distinct("g6-unitrate", 6, (rng) => {
  const people = pickOne(rng, [2, 3, 4, 5, 6]);
  const cups = people * intBetween(rng, 1, 3);
  const more = people * intBetween(rng, 2, 5);
  if (more === people) return null;
  return {
    grade: G, key: `unitrate-${cups}-${people}-${more}`,
    en: `A recipe uses ${cups} cups of rice for ${people} people. How many cups are needed for ${more} people?`, km: `រូបមន្តមួយប្រើអង្ករ ${cups} ពែងសម្រាប់មនុស្ស ${people} នាក់។ តើត្រូវការអង្ករប៉ុន្មានពែងសម្រាប់មនុស្ស ${more} នាក់?`, answer: String((cups * more) / people),
    whyEn: `${cups} ÷ ${people} = ${cups / people} cups each. ${cups / people} × ${more} = ${(cups * more) / people}.`, whyKm: `${cups} ÷ ${people} = ${cups / people} ពែងក្នុងមនុស្សម្នាក់។ ${cups / people} × ${more} = ${(cups * more) / people}។`,
  };
});

const simplifyRatios: Q[] = distinct("g6-simplifyratio", 6, (rng) => {
  const a = intBetween(rng, 1, 5);
  const b = intBetween(rng, a + 1, 8);
  if (gcd(a, b) > 1) return null;
  const k = intBetween(rng, 2, 6);
  return {
    grade: G, key: `simpratio-${a * k}-${b * k}`,
    en: `Write the ratio ${a * k}:${b * k} in its simplest form.`, km: `សរសេរផលធៀប ${a * k}:${b * k} ជាទម្រង់សាមញ្ញបំផុត។`, answer: `${a}:${b}`,
    whyEn: `Divide both numbers by ${k}: ${a}:${b}.`, whyKm: `ចែកលេខទាំងពីរនឹង ${k}៖ ${a}:${b}។`,
  };
});

const equations: Q[] = distinct("g6-equation", 16, (rng, i) => {
  const kind = i % 7;
  const x = intBetween(rng, 2, 15);
  if (kind <= 1) {
    const k = intBetween(rng, 3, 20);
    return { grade: G, key: `eq-add-${x}-${k}`, en: `If x + ${k} = ${x + k}, what is x?`, km: `បើ x + ${k} = ${x + k} តើ x ស្មើប៉ុន្មាន?`, answer: String(x), whyEn: `${x + k} − ${k} = ${x}.`, whyKm: `${x + k} − ${k} = ${x}។` };
  }
  if (kind <= 3) {
    const k = intBetween(rng, 2, 9);
    return { grade: G, key: `eq-times-${x}-${k}`, en: `If ${k}x = ${k * x}, what is x?`, km: `បើ ${k}x = ${k * x} តើ x ស្មើប៉ុន្មាន?`, answer: String(x), whyEn: `${k * x} ÷ ${k} = ${x}.`, whyKm: `${k * x} ÷ ${k} = ${x}។` };
  }
  if (kind <= 5) {
    const k = intBetween(rng, 2, 6);
    const c = intBetween(rng, 1, 12);
    return { grade: G, key: `eq-two-${x}-${k}-${c}`, en: `If ${k}x + ${c} = ${k * x + c}, what is x?`, km: `បើ ${k}x + ${c} = ${k * x + c} តើ x ស្មើប៉ុន្មាន?`, answer: String(x), whyEn: `${k * x + c} − ${c} = ${k * x}, and ${k * x} ÷ ${k} = ${x}.`, whyKm: `${k * x + c} − ${c} = ${k * x} ហើយ ${k * x} ÷ ${k} = ${x}។`, d: 3 };
  }
  const k = intBetween(rng, 2, 9);
  return { grade: G, key: `eq-div-${x}-${k}`, en: `If x ÷ ${k} = ${x}, what is x?`, km: `បើ x ÷ ${k} = ${x} តើ x ស្មើប៉ុន្មាន?`, answer: String(x * k), whyEn: `${x} × ${k} = ${x * k}.`, whyKm: `${x} × ${k} = ${x * k}។` };
});

const expressions: Q[] = distinct("g6-eval", 8, (rng) => {
  const a = intBetween(rng, 2, 9);
  const k = intBetween(rng, 2, 6);
  const c = intBetween(rng, 1, 9);
  const minus = rng() < 0.3 && k * a > c;
  return {
    grade: G, key: `eval-${a}-${k}-${c}-${minus ? "m" : "p"}`,
    en: `If a = ${a}, what is ${k}a ${minus ? "−" : "+"} ${c}?`, km: `បើ a = ${a} តើ ${k}a ${minus ? "−" : "+"} ${c} ស្មើប៉ុន្មាន?`, answer: String(minus ? k * a - c : k * a + c),
    whyEn: `${k}a = ${k} × ${a} = ${k * a}. Then ${k * a} ${minus ? "−" : "+"} ${c} = ${minus ? k * a - c : k * a + c}.`, whyKm: `${k}a = ${k} × ${a} = ${k * a}។ បន្ទាប់មក ${k * a} ${minus ? "−" : "+"} ${c} = ${minus ? k * a - c : k * a + c}។`, d: 3,
  };
});

const medians: Q[] = distinct("g6-median", 6, (rng) => {
  const n = pickOne(rng, [5, 7]);
  const values = Array.from({ length: n }, () => intBetween(rng, 2, 30));
  const sorted = [...values].sort((a, b) => a - b);
  if (new Set(values).size < n) return null;
  return {
    grade: G, key: `median-${values.join("-")}`,
    en: `What is the median of ${values.join(", ")}?`, km: `តើមេដ្យាននៃ ${values.join(", ")} ជាប៉ុន្មាន?`, answer: String(sorted[(n - 1) / 2]),
    whyEn: `Put them in order: ${sorted.join(", ")}. The middle one is ${sorted[(n - 1) / 2]}.`, whyKm: `រៀបតាមលំដាប់៖ ${sorted.join(", ")}។ លេខកណ្តាលគឺ ${sorted[(n - 1) / 2]}។`,
  };
});

const modes: Q[] = distinct("g6-mode", 6, (rng) => {
  const mode = intBetween(rng, 2, 15);
  const others = new Set<number>();
  while (others.size < 4) {
    const x = intBetween(rng, 2, 15);
    if (x !== mode) others.add(x);
  }
  const row = shuffled(rng, [mode, mode, mode, ...[...others].slice(0, 2), ...[...others].slice(2, 4), [...others][0]]);
  return {
    grade: G, key: `mode-${row.join("-")}`,
    en: `What is the mode of ${row.join(", ")}?`, km: `តើម៉ូដនៃ ${row.join(", ")} ជាប៉ុន្មាន?`, answer: String(mode),
    whyEn: `The mode is the number that appears most often: ${mode}.`, whyKm: `ម៉ូដគឺលេខដែលលេចឡើងញឹកញាប់បំផុត៖ ${mode}។`,
  };
});

const ranges: Q[] = distinct("g6-range", 4, (rng) => {
  const values = Array.from({ length: 5 }, () => intBetween(rng, 3, 60));
  return {
    grade: G, key: `range-${values.join("-")}`,
    en: `What is the range of ${values.join(", ")}?`, km: `តើជួរ (ភាពខុសគ្នាធំបំផុត) នៃ ${values.join(", ")} ជាប៉ុន្មាន?`, answer: String(Math.max(...values) - Math.min(...values)),
    whyEn: `Biggest − smallest = ${Math.max(...values)} − ${Math.min(...values)} = ${Math.max(...values) - Math.min(...values)}.`, whyKm: `ធំបំផុត − តូចបំផុត = ${Math.max(...values)} − ${Math.min(...values)} = ${Math.max(...values) - Math.min(...values)}។`,
  };
});

const circles: Q[] = distinct("g6-circle", 6, (rng, i) => {
  const r = i % 2 === 0 ? pickOne(rng, [5, 10, 20, 50]) : pickOne(rng, [10, 20, 30]);
  if (i % 2 === 0) {
    const c = 2 * 3.14 * r;
    return { grade: G, key: `circ-${r}`, en: `A circle has a radius of ${r} cm. Use π = 3.14. What is its circumference in cm?`, km: `រង្វង់មួយមានកាំ ${r} សង់ទីម៉ែត្រ។ ប្រើ π = 3.14។ បរិមាត្ររបស់វាជាប៉ុន្មានសង់ទីម៉ែត្រ?`, answer: String(Number(c.toFixed(1))), whyEn: `2 × 3.14 × ${r} = ${Number(c.toFixed(1))}.`, whyKm: `2 × 3.14 × ${r} = ${Number(c.toFixed(1))}។`, d: 3 };
  }
  const area = 3.14 * r * r;
  return { grade: G, key: `circarea-${r}`, en: `A circle has a radius of ${r} cm. Use π = 3.14. What is its area in cm²?`, km: `រង្វង់មួយមានកាំ ${r} សង់ទីម៉ែត្រ។ ប្រើ π = 3.14។ ក្រឡាផ្ទៃរបស់វាជាប៉ុន្មានសង់ទីម៉ែត្រការ៉េ?`, answer: String(Number(area.toFixed(2))), whyEn: `3.14 × ${r} × ${r} = ${Number(area.toFixed(2))}.`, whyKm: `3.14 × ${r} × ${r} = ${Number(area.toFixed(2))}។`, d: 3 };
});

const roots: Q[] = distinct("g6-root", 8, (rng, i) => {
  if (i < 8) {
    const n = intBetween(rng, 2, 15);
    return { grade: G, key: `root-${n * n}`, en: `What is the square root of ${n * n}?`, km: `ឫសការ៉េនៃ ${n * n} ស្មើប៉ុន្មាន?`, answer: String(n), whyEn: `${n} × ${n} = ${n * n}, so the square root is ${n}.`, whyKm: `${n} × ${n} = ${n * n} ដូច្នេះឫសការ៉េគឺ ${n}។` };
  }
  const n = intBetween(rng, 12, 25);
  return { grade: G, key: `sq-${n}`, en: `What is ${n}²?`, km: `${n}² ស្មើប៉ុន្មាន?`, answer: String(n * n), whyEn: `${n} × ${n} = ${n * n}.`, whyKm: `${n} × ${n} = ${n * n}។` };
});

const fractionTimes: Q[] = distinct("g6-fractimes", 4, (rng) => {
  const a = intBetween(rng, 1, 3);
  const b = intBetween(rng, a + 1, 5);
  const c = intBetween(rng, 1, 3);
  const d = intBetween(rng, c + 1, 5);
  const top = a * c;
  const bottom = b * d;
  const f = fraction(top, bottom);
  if (gcd(a, b) > 1 || gcd(c, d) > 1) return null;
  return {
    grade: G, key: `ftimes-${a}-${b}-${c}-${d}`,
    en: `${a}/${b} × ${c}/${d} = ? (Write it in its simplest form.)`, km: `${a}/${b} × ${c}/${d} = ? (សរសេរជាប្រភាគសម្រួលលែងបាន។)`, answer: f.answer, accepts: f.accepts,
    whyEn: `Multiply the tops and the bottoms: ${top}/${bottom}${f.answer !== `${top}/${bottom}` ? ` = ${f.answer}` : ""}.`, whyKm: `គុណភាគយក និងភាគបែង៖ ${top}/${bottom}${f.answer !== `${top}/${bottom}` ? ` = ${f.answer}` : ""}។`, d: 3,
  };
});

const howManyFractions: Q[] = distinct("g6-howmany", 4, (rng) => {
  const whole = intBetween(rng, 2, 8);
  const d = pickOne(rng, [2, 3, 4, 5]);
  return {
    grade: G, key: `howmany-${whole}-${d}`,
    en: `How many pieces of size 1/${d} are in ${whole}?`, km: `ក្នុង ${whole} មានចំណែកទំហំ 1/${d} ប៉ុន្មាន?`, answer: String(whole * d),
    whyEn: `Each whole has ${d} pieces, so ${whole} × ${d} = ${whole * d}.`, whyKm: `មួយទាំងមូលមាន ${d} ចំណែក ដូច្នេះ ${whole} × ${d} = ${whole * d}។`, d: 3,
  };
});

const conversions: Q[] = distinct("g6-convert", 8, (rng, i) => {
  if (i % 2 === 0) {
    const h = pickOne(rng, [1.5, 2.5, 0.5, 3.5, 4.5]);
    return { grade: G, key: `hours-${h}`, en: `How many minutes are in ${h} hours?`, km: `${h} ម៉ោងស្មើប៉ុន្មាននាទី?`, answer: String(h * 60), whyEn: `${h} × 60 = ${h * 60}.`, whyKm: `${h} × 60 = ${h * 60}។` };
  }
  const km = pickOne(rng, [0.5, 1.2, 2.5, 3.4, 0.8, 4.5]);
  return { grade: G, key: `km-${km}`, en: `How many metres are in ${km} km?`, km: `${km} គីឡូម៉ែត្រស្មើប៉ុន្មានម៉ែត្រ?`, answer: String(Math.round(km * 1000)), whyEn: `${km} × 1000 = ${Math.round(km * 1000)}.`, whyKm: `${km} × 1000 = ${Math.round(km * 1000)}។` };
});

const probabilities: Q[] = [
  ...[["even", "លេខគូ", 3], ["bigger than 4", "លេខធំជាង 4", 2], ["a 6", "លេខ 6", 1], ["smaller than 3", "លេខតូចជាង 3", 2], ["bigger than 2", "លេខធំជាង 2", 4]].map(([en, km, k]) => {
    const f = fraction(k as number, 6);
    return {
      grade: G, key: `dice-${String(en).replace(/ /g, "-")}`,
      en: `A fair dice is rolled. What is the chance of getting ${en}? Write it as a fraction.`, km: `គេបោះគ្រាប់ឡុកឡាក់សុចរិតមួយ។ តើប្រូបាបដែលទទួលបាន ${km} ជាប៉ុន្មាន? សរសេរជាប្រភាគ។`, answer: f.answer, accepts: f.accepts,
      whyEn: `${k} of the 6 faces work: ${k}/6${f.answer !== `${k}/6` ? ` = ${f.answer}` : ""}.`, whyKm: `មុខ ${k} ក្នុងចំណោម 6 ត្រឹមត្រូវ៖ ${k}/6${f.answer !== `${k}/6` ? ` = ${f.answer}` : ""}។`, d: 3 as const,
    };
  }),
  ...distinct("g6-bag", 6, (rng) => {
    const red = intBetween(rng, 2, 8);
    const blue = intBetween(rng, 2, 8);
    const target = rng() < 0.5 ? "blue" : "red";
    const hit = target === "blue" ? blue : red;
    const f = fraction(hit, red + blue);
    return {
      grade: G, key: `bag-${red}-${blue}-${target}`,
      en: `A bag has ${red} red and ${blue} blue marbles. One is picked without looking. What is the chance it is ${target}?`, km: `ថង់មួយមានគ្រាប់ឃ្លីពណ៌ក្រហម ${red} និងពណ៌ខៀវ ${blue}។ ចាប់យកមួយដោយមិនមើល។ តើប្រូបាបដែលចាប់បានគ្រាប់ពណ៌${target === "blue" ? "ខៀវ" : "ក្រហម"}ជាប៉ុន្មាន?`, answer: f.answer, accepts: f.accepts,
      whyEn: `${hit} of the ${red + blue} marbles are ${target}: ${hit}/${red + blue}${f.answer !== `${hit}/${red + blue}` ? ` = ${f.answer}` : ""}.`, whyKm: `${hit} ក្នុងចំណោមគ្រាប់ឃ្លី ${red + blue} គឺពណ៌${target === "blue" ? "ខៀវ" : "ក្រហម"}៖ ${hit}/${red + blue}${f.answer !== `${hit}/${red + blue}` ? ` = ${f.answer}` : ""}។`, d: 3 as const,
    };
  }),
];

const polygons: Q[] = distinct("g6-angles", 8, (rng, i) => {
  if (i % 3 === 0) {
    const a = intBetween(rng, 70, 110);
    const b = intBetween(rng, 70, 110);
    const c = intBetween(rng, 70, 110);
    return { grade: G, key: `quad-${a}-${b}-${c}`, en: `Three angles of a four-sided shape are ${a}°, ${b}° and ${c}°. How many degrees is the fourth angle?`, km: `មុំបីនៃរូបបួនជ្រុងមួយគឺ ${a}° ${b}° និង ${c}°។ មុំទីបួនមានប៉ុន្មានដឺក្រេ?`, answer: String(360 - a - b - c), whyEn: `The four angles add up to 360°: 360 − ${a} − ${b} − ${c} = ${360 - a - b - c}.`, whyKm: `មុំទាំងបួនបូករួមបាន 360°៖ 360 − ${a} − ${b} − ${c} = ${360 - a - b - c}។` };
  }
  if (i % 3 === 1) {
    const a = intBetween(rng, 30, 80);
    const b = intBetween(rng, 30, 80);
    return { grade: G, key: `tri-${a}-${b}`, en: `Two angles of a triangle are ${a}° and ${b}°. How many degrees is the third angle?`, km: `មុំពីរនៃត្រីកោណមួយគឺ ${a}° និង ${b}°។ មុំទីបីមានប៉ុន្មានដឺក្រេ?`, answer: String(180 - a - b), whyEn: `180 − ${a} − ${b} = ${180 - a - b}.`, whyKm: `180 − ${a} − ${b} = ${180 - a - b}។` };
  }
  const a = intBetween(rng, 20, 160);
  return { grade: G, key: `cross-${a}`, en: `Two straight lines cross. One angle is ${a}°. How many degrees is the angle directly opposite it?`, km: `បន្ទាត់ត្រង់ពីរកាត់គ្នា។ មុំមួយមាន ${a}°។ មុំទល់មុខវាមានប៉ុន្មានដឺក្រេ?`, answer: String(a), whyEn: `Opposite angles are equal: ${a}°.`, whyKm: `មុំឈមគ្នាស្មើគ្នា៖ ${a}°។` };
});

const puzzles: Q[] = [
  ...[6, 10, 20, 100].map((n): Q => ({
    grade: G, key: `gauss-${n}`, en: `What is 1 + 2 + 3 + ... + ${n}?`, km: `តើ 1 + 2 + 3 + ... + ${n} ស្មើប៉ុន្មាន?`, answer: String((n * (n + 1)) / 2),
    whyEn: `Pair the ends: ${n + 1} each, and there are ${n / 2} pairs. ${n / 2} × ${n + 1} = ${(n * (n + 1)) / 2}.`, whyKm: `ផ្គូផ្គងចុងទាំងពីរ៖ គូនីមួយៗ ${n + 1} មាន ${n / 2} គូ។ ${n / 2} × ${n + 1} = ${(n * (n + 1)) / 2}។`, d: 3,
  })),
  ...[4, 6, 8].map((n): Q => ({
    grade: G, key: `handshake-${n}`, en: `${n} friends each shake hands once with every other friend. How many handshakes are there?`, km: `មិត្ត ${n} នាក់ចាប់ដៃគ្នាម្នាក់ម្តងជាមួយគ្រប់គ្នាទៀត។ មានការចាប់ដៃសរុបប៉ុន្មានដង?`, answer: String((n * (n - 1)) / 2),
    whyEn: `Each of ${n} shakes with ${n - 1} others, but every handshake is counted twice: ${n} × ${n - 1} ÷ 2 = ${(n * (n - 1)) / 2}.`, whyKm: `មនុស្ស ${n} នាក់ម្នាក់ៗចាប់ដៃជាមួយអ្នកដទៃ ${n - 1} ប៉ុន្តែរាប់ពីរដង៖ ${n} × ${n - 1} ÷ 2 = ${(n * (n - 1)) / 2}។`, d: 3,
  })),
  ...[[10, 2], [20, 4], [30, 5], [18, 3]].map(([len, gap]): Q => ({
    grade: G, key: `fence-${len}-${gap}`, en: `A straight fence is ${len} m long. A post is put in every ${gap} m, including both ends. How many posts are there?`, km: `របងត្រង់មួយវែង ${len} ម៉ែត្រ។ គេដាក់បង្គោលរៀងរាល់ ${gap} ម៉ែត្រ រួមទាំងចុងទាំងពីរ។ មានបង្គោលប៉ុន្មានដើម?`, answer: String(len / gap + 1),
    whyEn: `${len} ÷ ${gap} = ${len / gap} gaps, and there is one more post than gaps: ${len / gap + 1}.`, whyKm: `${len} ÷ ${gap} = ${len / gap} ចន្លោះ ហើយមានបង្គោលច្រើនជាងចន្លោះមួយ៖ ${len / gap + 1}។`, d: 3,
  })),
  ...[[2, 5], [3, 14], [4, 30]].map(([n, total]): Q => ({
    grade: G, key: `squares-${n}`, pics: [pic(`grid-${n}x${n}`, `${n} by ${n} squares`)],
    en: "How many squares of any size can you find in this grid?", km: "តើអ្នកអាចរកឃើញរូបការ៉េគ្រប់ទំហំប៉ុន្មានក្នុងក្រឡាចត្រង្គនេះ?", answer: String(total),
    whyEn: n === 2 ? "4 small squares and 1 big one: 5." : n === 3 ? "9 small, 4 medium and 1 big: 14." : "16 small, 9, 4 and 1: 30.", whyKm: n === 2 ? "ការ៉េតូច 4 និងការ៉េធំ 1៖ 5។" : n === 3 ? "ការ៉េតូច 9 ការ៉េមធ្យម 4 និងការ៉េធំ 1៖ 14។" : "ការ៉េតូច 16 និង 9, 4, 1៖ 30។", d: 3,
  })),
];

const sums: Puzzle[] = [
  sumQ(G, 48, "×", 25), sumQ(G, 76, "×", 35), sumQ(G, 125, "×", 16), sumQ(G, 94, "×", 48), sumQ(G, 1728, "÷", 12), sumQ(G, 2025, "÷", 25),
  sumQ(G, 3456, "÷", 18), sumQ(G, 5000, "−", 2378), sumQ(G, 8000, "−", 3456), sumQ(G, 6789, "+", 2345), sumQ(G, 15, "×", 15), sumQ(G, 99, "×", 99),
];

export const GRADE_6: Puzzle[] = [
  ...[
    ...thermometers,
    ...warmer,
    ...gaps,
    ...integerSums,
    ...negCompare,
    ...percentOf,
    ...discounts,
    ...percentOut,
    ...shares,
    ...unitRates,
    ...simplifyRatios,
    ...equations,
    ...expressions,
    ...medians,
    ...modes,
    ...ranges,
    ...circles,
    ...roots,
    ...fractionTimes,
    ...howManyFractions,
    ...conversions,
    ...probabilities,
    ...polygons,
    ...puzzles,
    ...compareNumbers(G, 4, 10000, 99999),
    ...riddles(G, 4, ["×", "÷"], 15, 60),
  ].map(build),
  ...sums,
];
