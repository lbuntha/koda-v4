/** Grade 5 (ages 10–11): decimals, fractions, percent, order of operations, averages, primes, powers, HCF and LCM, volume, triangles and speed. */

import type { Puzzle } from "../../types";
import { shuffled } from "../../rng";
import { compareNumbers, riddles } from "./common";
import { build, distinct, intBetween, NAMES, pickOne, sumQ, type Q } from "./kit";

const G = 5 as const;

/** Hundredths as a short decimal: 425 is "4.25", 450 is "4.5". Both ways of writing a trailing zero are accepted. */
const dec = (h: number): string => String(Number((h / 100).toFixed(2)));
const decAccepts = (h: number): string[] => (h % 10 === 0 && h % 100 !== 0 ? [(h / 100).toFixed(2)] : []);
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const decimalMoney: Q[] = distinct("g5-money", 8, (rng, i) => {
  const a = intBetween(rng, 120, 995);
  const b = intBetween(rng, 105, 480);
  if (a % 100 === 0 || b % 100 === 0) return null;
  const add = i % 2 === 0;
  const x = add ? a : Math.max(a, b);
  const y = add ? b : Math.min(a, b);
  const r = add ? x + y : x - y;
  if (r % 100 === 0 || r <= 0) return null;
  const who = pickOne(rng, NAMES);
  return {
    grade: G, key: `money-${add ? "add" : "sub"}-${x}-${y}`,
    en: add ? `${who.en} spends $${dec(x)} on a book and $${dec(y)} on a snack. How many dollars is that in all?` : `${who.en} has $${dec(x)} and buys a snack for $${dec(y)}. How many dollars are left?`,
    km: add ? `${who.km}ចំណាយ ${dec(x)} ដុល្លារលើសៀវភៅ និង ${dec(y)} ដុល្លារលើនំ។ សរុបប៉ុន្មានដុល្លារ?` : `${who.km}មាន ${dec(x)} ដុល្លារ ហើយទិញនំ ${dec(y)} ដុល្លារ។ នៅសល់ប៉ុន្មានដុល្លារ?`,
    answer: dec(r), accepts: decAccepts(r),
    whyEn: `${dec(x)} ${add ? "+" : "−"} ${dec(y)} = ${dec(r)}.`, whyKm: `${dec(x)} ${add ? "+" : "−"} ${dec(y)} = ${dec(r)}។`,
  };
});

const decimalTimes: Q[] = distinct("g5-dectimes", 6, (rng) => {
  const t = intBetween(rng, 2, 9);
  const k = intBetween(rng, 2, 9);
  if (t % 10 === 0) return null;
  const r = t * k;
  const text = `0.${t}`;
  return {
    grade: G, key: `dectimes-${t}-${k}`,
    en: `${text} × ${k} = ?`, km: `${text} × ${k} = ?`, answer: r % 10 === 0 ? String(r / 10) : (r / 10).toFixed(1),
    whyEn: `${t} tenths × ${k} = ${r} tenths = ${r % 10 === 0 ? r / 10 : (r / 10).toFixed(1)}.`, whyKm: `${t} ភាគដប់ × ${k} = ${r} ភាគដប់ = ${r % 10 === 0 ? r / 10 : (r / 10).toFixed(1)}។`,
  };
});

const unlikeFractions: Q[] = distinct("g5-unlike", 6, (rng, i) => {
  const base = pickOne(rng, [2, 3, 4, 5]);
  const mult = pickOne(rng, [2, 3]);
  const d2 = base * mult;
  const a = intBetween(rng, 1, base - 1);
  const b = intBetween(rng, 1, d2 - 1);
  const add = i % 2 === 0;
  const top = add ? a * mult + b : a * mult - b;
  if (top <= 0 || (add && top >= d2) || (top === d2)) return null;
  const g = gcd(top, d2);
  const answer = `${top / g}/${d2 / g}`;
  const ans = answer === `${top}/${d2}` ? answer : answer;
  return {
    grade: G, key: `unlike-${add ? "add" : "sub"}-${a}-${base}-${b}-${d2}`,
    en: `${a}/${base} ${add ? "+" : "−"} ${b}/${d2} = ? (Write it in its simplest form.)`, km: `${a}/${base} ${add ? "+" : "−"} ${b}/${d2} = ? (សរសេរជាប្រភាគសម្រួលលែងបាន។)`, answer: ans,
    whyEn: `${a}/${base} = ${a * mult}/${d2}. Then ${a * mult} ${add ? "+" : "−"} ${b} = ${top}, so ${top}/${d2}${g > 1 ? ` = ${answer}` : ""}.`,
    whyKm: `${a}/${base} = ${a * mult}/${d2}។ បន្ទាប់មក ${a * mult} ${add ? "+" : "−"} ${b} = ${top} ដូច្នេះ ${top}/${d2}${g > 1 ? ` = ${answer}` : ""}។`,
  };
});

const compareFractions: Q[] = distinct("g5-fraccmp", 6, (rng, i) => {
  const d1 = pickOne(rng, [2, 3, 4, 5, 6, 8]);
  const d2 = pickOne(rng, [2, 3, 4, 5, 6, 8]);
  if (d1 === d2) return null;
  const n1 = intBetween(rng, 1, d1 - 1);
  const n2 = intBetween(rng, 1, d2 - 1);
  if (n1 * d2 === n2 * d1) return null;
  const small = i % 2 === 1;
  const left = `${n1}/${d1}`;
  const right = `${n2}/${d2}`;
  const leftBigger = n1 * d2 > n2 * d1;
  const win = (small ? !leftBigger : leftBigger) ? left : right;
  return {
    grade: G, key: `fcmp-${small ? "small" : "big"}-${left}-${right}`,
    en: `Which fraction is ${small ? "smaller" : "bigger"}: ${left} or ${right}?`, km: `ប្រភាគមួយណា${small ? "តូចជាង" : "ធំជាង"}៖ ${left} ឬ ${right}?`,
    options: [left, right], answer: win,
    whyEn: `Make the bottoms the same: ${n1 * d2}/${d1 * d2} and ${n2 * d1}/${d1 * d2}. ${win} is ${small ? "smaller" : "bigger"}.`, whyKm: `ធ្វើឲ្យភាគបែងដូចគ្នា៖ ${n1 * d2}/${d1 * d2} និង ${n2 * d1}/${d1 * d2}។ ${win} ${small ? "តូចជាង" : "ធំជាង"}។`,
  };
});

const fractionsOfAmount: Q[] = distinct("g5-fracamt", 6, (rng) => {
  const n = pickOne(rng, [3, 4, 5, 6, 8]);
  const k = intBetween(rng, 2, n - 1);
  if (gcd(k, n) > 1) return null;
  const unit = intBetween(rng, 3, 12);
  const total = n * unit;
  return {
    grade: G, key: `fracamt-${k}-${n}-${total}`,
    en: `What is ${k}/${n} of ${total}?`, km: `${k}/${n} នៃ ${total} គឺប៉ុន្មាន?`, answer: String(k * unit),
    whyEn: `${total} ÷ ${n} = ${unit}, then ${unit} × ${k} = ${k * unit}.`, whyKm: `${total} ÷ ${n} = ${unit} បន្ទាប់មក ${unit} × ${k} = ${k * unit}។`,
  };
});

const simplify: Q[] = distinct("g5-simplify", 6, (rng) => {
  const d = pickOne(rng, [2, 3, 4, 5, 6, 7]);
  const n = intBetween(rng, 1, d - 1);
  if (gcd(n, d) > 1) return null;
  const m = intBetween(rng, 2, 5);
  return {
    grade: G, key: `simplify-${n * m}-${d * m}`,
    en: `Write ${n * m}/${d * m} in its simplest form.`, km: `សរសេរ ${n * m}/${d * m} ជាទម្រង់សាមញ្ញបំផុត។`, answer: `${n}/${d}`,
    whyEn: `Divide the top and the bottom by ${m}: ${n}/${d}.`, whyKm: `ចែកភាគយក និងភាគបែងនឹង ${m}៖ ${n}/${d}។`,
  };
});

const percents: Q[] = distinct("g5-percent", 12, (rng) => {
  const pct = pickOne(rng, [10, 20, 25, 50, 75]);
  const base = pct === 25 || pct === 75 ? pickOne(rng, [20, 40, 60, 80, 100, 120, 200]) : pickOne(rng, [30, 40, 50, 60, 80, 90, 120, 150, 200, 250]);
  const r = (base * pct) / 100;
  if (!Number.isInteger(r)) return null;
  return {
    grade: G, key: `percent-${pct}-${base}`,
    en: `What is ${pct}% of ${base}?`, km: `${pct}% នៃ ${base} គឺប៉ុន្មាន?`, answer: String(r),
    whyEn: pct === 50 ? `50% is a half: ${base} ÷ 2 = ${r}.` : pct === 25 ? `25% is a quarter: ${base} ÷ 4 = ${r}.` : pct === 10 ? `10% is a tenth: ${base} ÷ 10 = ${r}.` : `${pct}% of ${base} = ${base} × ${pct} ÷ 100 = ${r}.`,
    whyKm: pct === 50 ? `50% គឺពាក់កណ្តាល៖ ${base} ÷ 2 = ${r}។` : pct === 25 ? `25% គឺមួយភាគបួន៖ ${base} ÷ 4 = ${r}។` : pct === 10 ? `10% គឺមួយភាគដប់៖ ${base} ÷ 10 = ${r}។` : `${pct}% នៃ ${base} = ${base} × ${pct} ÷ 100 = ${r}។`,
  };
});

const percentFractions: Q[] = [[1, 2, 50], [1, 4, 25], [3, 4, 75], [1, 5, 20], [1, 10, 10]].map(([k, n, p]) => ({
  grade: G, key: `pctfrac-${k}-${n}`,
  en: `What percent is ${k}/${n}?`, km: `${k}/${n} ស្មើប៉ុន្មានភាគរយ?`, answer: String(p), accepts: [`${p}%`],
  whyEn: `${k}/${n} = ${p}/100 = ${p}%.`, whyKm: `${k}/${n} = ${p}/100 = ${p}%។`,
}));

/** Order of operations: the kind of line that goes round the internet. */
const orderOfOps: Q[] = distinct("g5-order", 16, (rng, i) => {
  const a = intBetween(rng, 2, 12);
  const b = intBetween(rng, 2, 9);
  const c = intBetween(rng, 2, 9);
  const form = i % 4;
  if (form === 0) return { grade: G, key: `ooo-${a}p${b}t${c}`, en: `${a} + ${b} × ${c} = ?`, km: `${a} + ${b} × ${c} = ?`, answer: String(a + b * c), whyEn: `Multiply first: ${b} × ${c} = ${b * c}. Then ${a} + ${b * c} = ${a + b * c}.`, whyKm: `គុណមុន៖ ${b} × ${c} = ${b * c}។ បន្ទាប់មក ${a} + ${b * c} = ${a + b * c}។` };
  if (form === 1) return { grade: G, key: `ooo-p${a}p${b}t${c}`, en: `(${a} + ${b}) × ${c} = ?`, km: `(${a} + ${b}) × ${c} = ?`, answer: String((a + b) * c), whyEn: `Brackets first: ${a} + ${b} = ${a + b}. Then ${a + b} × ${c} = ${(a + b) * c}.`, whyKm: `វង់ក្រចកមុន៖ ${a} + ${b} = ${a + b}។ បន្ទាប់មក ${a + b} × ${c} = ${(a + b) * c}។` };
  if (form === 2) {
    const big = a * c + b + 5;
    return { grade: G, key: `ooo-${big}m${a}t${c}`, en: `${big} − ${a} × ${c} = ?`, km: `${big} − ${a} × ${c} = ?`, answer: String(big - a * c), whyEn: `Multiply first: ${a} × ${c} = ${a * c}. Then ${big} − ${a * c} = ${big - a * c}.`, whyKm: `គុណមុន៖ ${a} × ${c} = ${a * c}។ បន្ទាប់មក ${big} − ${a * c} = ${big - a * c}។` };
  }
  const total = b * c;
  return { grade: G, key: `ooo-${a}p${total}d${b}`, en: `${a} + ${total} ÷ ${b} = ?`, km: `${a} + ${total} ÷ ${b} = ?`, answer: String(a + c), whyEn: `Divide first: ${total} ÷ ${b} = ${c}. Then ${a} + ${c} = ${a + c}.`, whyKm: `ចែកមុន៖ ${total} ÷ ${b} = ${c}។ បន្ទាប់មក ${a} + ${c} = ${a + c}។` };
});

const means: Q[] = distinct("g5-mean", 8, (rng) => {
  const n = pickOne(rng, [3, 4, 5]);
  const m = intBetween(rng, 4, 20);
  const values: number[] = [];
  for (let i = 0; i < n - 1; i++) values.push(intBetween(rng, Math.max(1, m - 6), m + 6));
  const last = m * n - values.reduce((s, v) => s + v, 0);
  if (last < 1) return null;
  values.push(last);
  const row = shuffled(rng, values);
  return {
    grade: G, key: `mean-${row.join("-")}`,
    en: `What is the mean (average) of ${row.join(", ")}?`, km: `តើមធ្យមភាគនៃ ${row.join(", ")} ជាប៉ុន្មាន?`, answer: String(m),
    whyEn: `${row.join(" + ")} = ${m * n}, and ${m * n} ÷ ${n} = ${m}.`, whyKm: `${row.join(" + ")} = ${m * n} ហើយ ${m * n} ÷ ${n} = ${m}។`,
  };
});

const isPrime = (n: number): boolean => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((d) => n % d !== 0);
const primes: Q[] = distinct("g5-prime", 6, (rng) => {
  const right = pickOne(rng, [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
  const wrong = new Set<number>();
  for (let tries = 0; wrong.size < 3 && tries < 80; tries++) {
    const x = intBetween(rng, 12, 49);
    if (!isPrime(x)) wrong.add(x);
  }
  return {
    grade: G, key: `prime-${right}-${[...wrong].sort((a, b) => a - b).join("-")}`,
    en: "Which number is a prime number?", km: "តើចំនួនមួយណាជាចំនួនបឋម?",
    options: shuffled(rng, [right, ...wrong].map(String)), answer: String(right),
    whyEn: `${right} can only be divided by 1 and itself. The others have more factors.`, whyKm: `${right} ចែកដាច់បានតែនឹង 1 និងខ្លួនវាប៉ុណ្ណោះ។ លេខផ្សេងទៀតមានកត្តាច្រើនជាង។`,
  };
});

const powers: Q[] = distinct("g5-power", 8, (rng, i) => {
  if (i < 8) {
    const n = intBetween(rng, 3, 15);
    return { grade: G, key: `square-${n}`, en: `What is ${n}²?`, km: `${n}² ស្មើប៉ុន្មាន?`, answer: String(n * n), whyEn: `${n}² = ${n} × ${n} = ${n * n}.`, whyKm: `${n}² = ${n} × ${n} = ${n * n}។` };
  }
  const n = intBetween(rng, 2, 5);
  return { grade: G, key: `cube-${n}`, en: `What is ${n}³?`, km: `${n}³ ស្មើប៉ុន្មាន?`, answer: String(n ** 3), whyEn: `${n}³ = ${n} × ${n} × ${n} = ${n ** 3}.`, whyKm: `${n}³ = ${n} × ${n} × ${n} = ${n ** 3}។` };
});

const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
const hcfLcm: Q[] = distinct("g5-hcflcm", 8, (rng, i) => {
  const a = pickOne(rng, [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 24]);
  const b = pickOne(rng, [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 24]);
  if (a >= b || gcd(a, b) === 1) return null;
  const hcf = i % 2 === 0;
  const r = hcf ? gcd(a, b) : lcm(a, b);
  return {
    grade: G, key: `${hcf ? "hcf" : "lcm"}-${a}-${b}`,
    en: hcf ? `What is the biggest number that divides both ${a} and ${b}?` : `What is the smallest number that both ${a} and ${b} divide into?`,
    km: hcf ? `តើចំនួនធំបំផុតដែលចែក ${a} និង ${b} ដាច់ជាអ្វី?` : `តើចំនួនតូចបំផុតដែលចែកដាច់នឹង ${a} និង ${b} ជាអ្វី?`,
    answer: String(r),
    whyEn: hcf ? `The biggest number that goes into both ${a} and ${b} is ${r}.` : `Count in ${b}s until ${a} fits too: ${r}.`, whyKm: hcf ? `លេខធំបំផុតដែលចែកដាច់ទាំង ${a} និង ${b} គឺ ${r}។` : `រាប់ជាក្រុម ${b} រហូតដល់ ${a} ចែកដាច់ដែរ៖ ${r}។`,
  };
});

const volumes: Q[] = distinct("g5-volume", 6, (rng) => {
  const l = intBetween(rng, 2, 10);
  const w = intBetween(rng, 2, 8);
  const h = intBetween(rng, 2, 6);
  return {
    grade: G, key: `volume-${l}x${w}x${h}`,
    en: `A box is ${l} cm long, ${w} cm wide and ${h} cm high. What is its volume in cm³?`, km: `ប្រអប់មួយបណ្តោយ ${l} សង់ទីម៉ែត្រ ទទឹង ${w} សង់ទីម៉ែត្រ និងកម្ពស់ ${h} សង់ទីម៉ែត្រ។ មាឌរបស់វាជាប៉ុន្មានសង់ទីម៉ែត្រគូប?`,
    answer: String(l * w * h),
    whyEn: `${l} × ${w} × ${h} = ${l * w * h}.`, whyKm: `${l} × ${w} × ${h} = ${l * w * h}។`,
  };
});

const triangleAngles: Q[] = distinct("g5-trianglesum", 6, (rng) => {
  const a = intBetween(rng, 25, 80);
  const b = intBetween(rng, 25, 80);
  if (a + b >= 150) return null;
  return {
    grade: G, key: `third-${a}-${b}`,
    en: `Two angles of a triangle are ${a}° and ${b}°. How many degrees is the third angle?`, km: `មុំពីរនៃត្រីកោណមួយគឺ ${a}° និង ${b}°។ មុំទីបីមានប៉ុន្មានដឺក្រេ?`, answer: String(180 - a - b),
    whyEn: `The three angles add up to 180°: 180 − ${a} − ${b} = ${180 - a - b}.`, whyKm: `មុំទាំងបីបូករួមបាន 180°៖ 180 − ${a} − ${b} = ${180 - a - b}។`,
  };
});

const straightLine: Q[] = distinct("g5-straight", 4, (rng) => {
  const a = pickOne(rng, [30, 40, 50, 55, 65, 70, 110, 125, 140]);
  return {
    grade: G, key: `straight-${a}`,
    en: `Two angles sit side by side on a straight line. One is ${a}°. How many degrees is the other?`, km: `មុំពីរនៅជាប់គ្នាលើបន្ទាត់ត្រង់មួយ។ មួយមាន ${a}°។ មួយទៀតមានប៉ុន្មានដឺក្រេ?`, answer: String(180 - a),
    whyEn: `Angles on a straight line add up to 180°: 180 − ${a} = ${180 - a}.`, whyKm: `មុំលើបន្ទាត់ត្រង់បូករួមបាន 180°៖ 180 − ${a} = ${180 - a}។`,
  };
});

const triangleArea: Q[] = distinct("g5-trianglearea", 4, (rng) => {
  const b = intBetween(rng, 4, 14) * 2;
  const h = intBetween(rng, 3, 12);
  return {
    grade: G, key: `tarea-${b}-${h}`,
    en: `A triangle has a base of ${b} cm and a height of ${h} cm. What is its area in cm²?`, km: `ត្រីកោណមួយមានបាត ${b} សង់ទីម៉ែត្រ និងកម្ពស់ ${h} សង់ទីម៉ែត្រ។ ក្រឡាផ្ទៃរបស់វាជាប៉ុន្មានសង់ទីម៉ែត្រការ៉េ?`, answer: String((b * h) / 2),
    whyEn: `Half of base × height: ${b} × ${h} ÷ 2 = ${(b * h) / 2}.`, whyKm: `ពាក់កណ្តាលនៃបាត × កម្ពស់៖ ${b} × ${h} ÷ 2 = ${(b * h) / 2}។`,
  };
});

const speeds: Q[] = distinct("g5-speed", 6, (rng) => {
  const s = intBetween(rng, 3, 12) * 10;
  const t = intBetween(rng, 2, 6);
  return {
    grade: G, key: `speed-${s}-${t}`,
    en: `A bus travels ${s} km every hour. How many km does it travel in ${t} hours?`, km: `ឡានក្រុងមួយធ្វើដំណើរ ${s} គីឡូម៉ែត្រក្នុងមួយម៉ោង។ ក្នុង ${t} ម៉ោងវាធ្វើដំណើរបានប៉ុន្មានគីឡូម៉ែត្រ?`, answer: String(s * t),
    whyEn: `${s} × ${t} = ${s * t} km.`, whyKm: `${s} × ${t} = ${s * t} គីឡូម៉ែត្រ។`,
  };
});

const ratios: Q[] = distinct("g5-ratio", 6, (rng) => {
  const a = intBetween(rng, 1, 4);
  const b = intBetween(rng, a + 1, 6);
  if (gcd(a, b) > 1) return null;
  const k = intBetween(rng, 2, 9);
  return {
    grade: G, key: `ratio-${a}-${b}-${k}`,
    en: `The ratio of boys to girls is ${a}:${b}. There are ${a * k} boys. How many girls are there?`, km: `ផលធៀបរវាងក្មេងប្រុស និងក្មេងស្រីគឺ ${a}:${b}។ មានក្មេងប្រុស ${a * k} នាក់។ មានក្មេងស្រីប៉ុន្មាននាក់?`, answer: String(b * k),
    whyEn: `${a} parts is ${a * k}, so 1 part is ${k}. ${b} parts is ${b} × ${k} = ${b * k}.`, whyKm: `${a} ផ្នែកស្មើ ${a * k} ដូច្នេះ 1 ផ្នែកស្មើ ${k}។ ${b} ផ្នែកស្មើ ${b} × ${k} = ${b * k}។`,
  };
});

const SEQUENCES: Array<{ shown: number[]; next: number; en: string; km: string }> = [
  { shown: [1, 4, 9, 16, 25], next: 36, en: "These are the square numbers: 6 × 6 = 36.", km: "ទាំងនេះជាចំនួនការ៉េ៖ 6 × 6 = 36។" },
  { shown: [1, 3, 6, 10, 15], next: 21, en: "Add 2, then 3, then 4, then 5, then 6: 15 + 6 = 21.", km: "បូក 2 បន្ទាប់មក 3, 4, 5, 6៖ 15 + 6 = 21។" },
  { shown: [2, 4, 8, 16, 32], next: 64, en: "Each number is doubled: 32 × 2 = 64.", km: "លេខនីមួយៗត្រូវគុណនឹង 2៖ 32 × 2 = 64។" },
  { shown: [1, 1, 2, 3, 5], next: 8, en: "Add the last two numbers: 3 + 5 = 8.", km: "បូកលេខពីរចុងក្រោយ៖ 3 + 5 = 8។" },
  { shown: [1, 8, 27, 64], next: 125, en: "These are the cube numbers: 5 × 5 × 5 = 125.", km: "ទាំងនេះជាចំនួនគូប៖ 5 × 5 × 5 = 125។" },
  { shown: [2, 3, 5, 7, 11], next: 13, en: "These are the prime numbers: the next one is 13.", km: "ទាំងនេះជាចំនួនបឋម៖ លេខបន្ទាប់គឺ 13។" },
  { shown: [3, 6, 12, 24, 48], next: 96, en: "Each number is doubled: 48 × 2 = 96.", km: "លេខនីមួយៗត្រូវគុណនឹង 2៖ 48 × 2 = 96។" },
  { shown: [1, 2, 4, 7, 11], next: 16, en: "Add 1, then 2, then 3, then 4, then 5: 11 + 5 = 16.", km: "បូក 1 បន្ទាប់មក 2, 3, 4, 5៖ 11 + 5 = 16។" },
];
const famous: Q[] = SEQUENCES.map((s) => ({
  grade: G, key: `seq-${s.shown.join("-")}`,
  en: `What number comes next? ${s.shown.join(", ")}, ?`, km: `តើលេខបន្ទាប់ជាលេខអ្វី? ${s.shown.join(", ")}, ?`, answer: String(s.next), whyEn: s.en, whyKm: s.km, d: 3,
}));

const placeValue: Q[] = distinct("g5-place", 6, (rng) => {
  const digits: number[] = [];
  while (digits.length < 5) {
    const d = intBetween(rng, 1, 9);
    if (!digits.includes(d)) digits.push(d);
  }
  const n = Number(digits.join(""));
  const pos = intBetween(rng, 0, 4);
  const digit = digits[digits.length - 1 - pos];
  return {
    grade: G, key: `place-${n}-${pos}`,
    en: `What is the value of the ${digit} in ${n}?`, km: `តម្លៃនៃលេខ ${digit} ក្នុង ${n} គឺប៉ុន្មាន?`, answer: String(digit * 10 ** pos),
    whyEn: `The ${digit} is in the ${["ones", "tens", "hundreds", "thousands", "ten-thousands"][pos]} place: ${digit * 10 ** pos}.`, whyKm: `លេខ ${digit} នៅខ្ទង់${["ឯកតា", "ដប់", "រយ", "ពាន់", "ម៉ឺន"][pos]}៖ ${digit * 10 ** pos}។`,
  };
});

const twoStep: Q[] = distinct("g5-twostep", 6, (rng) => {
  const who = pickOne(rng, NAMES);
  const p1 = intBetween(rng, 2, 8);
  const q1 = intBetween(rng, 2, 6);
  const p2 = intBetween(rng, 1, 5);
  const q2 = intBetween(rng, 2, 6);
  const total = p1 * q1 + p2 * q2;
  return {
    grade: G, key: `twostep-${who.en.toLowerCase()}-${p1}x${q1}-${p2}x${q2}`,
    en: `${who.en} buys ${q1} books at $${p1} each and ${q2} pens at $${p2} each. How many dollars does ${who.en} spend?`,
    km: `${who.km}ទិញសៀវភៅ ${q1} ក្បាល ក្បាលនីមួយៗ ${p1} ដុល្លារ និងប៊ិច ${q2} ដើម ដើមនីមួយៗ ${p2} ដុល្លារ។ ${who.km}ចំណាយអស់ប៉ុន្មានដុល្លារ?`, answer: String(total),
    whyEn: `${q1} × $${p1} = $${p1 * q1}, ${q2} × $${p2} = $${p2 * q2}, and $${p1 * q1} + $${p2 * q2} = $${total}.`, whyKm: `${q1} × ${p1} = ${p1 * q1}, ${q2} × ${p2} = ${p2 * q2} ហើយ ${p1 * q1} + ${p2 * q2} = ${total} ដុល្លារ។`,
  };
});

const sums: Puzzle[] = [
  sumQ(G, 23, "×", 14), sumQ(G, 35, "×", 12), sumQ(G, 47, "×", 21), sumQ(G, 64, "×", 15), sumQ(G, 38, "×", 25), sumQ(G, 52, "×", 18),
  sumQ(G, 612, "÷", 12), sumQ(G, 855, "÷", 15), sumQ(G, 756, "÷", 14), sumQ(G, 1008, "÷", 16), sumQ(G, 1500, "−", 678), sumQ(G, 4000, "−", 1275),
];

export const GRADE_5: Puzzle[] = [
  ...[
    ...decimalMoney,
    ...decimalTimes,
    ...unlikeFractions,
    ...compareFractions,
    ...fractionsOfAmount,
    ...simplify,
    ...percents,
    ...percentFractions,
    ...orderOfOps,
    ...means,
    ...primes,
    ...powers,
    ...hcfLcm,
    ...volumes,
    ...triangleAngles,
    ...straightLine,
    ...triangleArea,
    ...speeds,
    ...ratios,
    ...famous,
    ...placeValue,
    ...twoStep,
    ...compareNumbers(G, 4, 10000, 99999),
    ...riddles(G, 5, ["×", "÷", "+", "−"], 20, 99),
  ].map(build),
  ...sums,
];
