/**
 * Question shapes several grades share: comparing, patterns, riddles, money,
 * sharing, times-table stories, clocks and fractions. Each takes a grade and the
 * range of numbers that grade works with.
 */

import { CLOCK_TIMES, FRACTIONS } from "../../icons/more/maths";
import { clockId } from "../../icons/more/maths";
import { makeRng, shuffled } from "../../rng";
import { countKm, distinct, howKm, intBetween, NAMES, pic, pickOne, THINGS, type Grade, type Q } from "./kit";

// ---- comparing ----------------------------------------------------------------

/** Which of two numbers is bigger (or smaller): a tap. */
export const compareNumbers = (grade: Grade, count: number, lo: number, hi: number): Q[] =>
  distinct(`g${grade}-compare`, count, (rng, i) => {
    const a = intBetween(rng, lo, hi);
    // Close numbers are the interesting ones: same tens, or one hundred apart.
    const b = Math.max(lo, Math.min(hi, a + intBetween(rng, -Math.max(3, Math.round((hi - lo) / 8)), Math.max(3, Math.round((hi - lo) / 8)))));
    if (a === b) return null;
    const bigger = i % 2 === 0;
    const right = bigger ? Math.max(a, b) : Math.min(a, b);
    const other = right === a ? b : a;
    return {
      grade, key: `cmp-${bigger ? "big" : "small"}-${Math.min(a, b)}-${Math.max(a, b)}`,
      en: `Which number is ${bigger ? "bigger" : "smaller"}: ${a} or ${b}?`, km: `តើចំនួនមួយណា${bigger ? "ធំជាង" : "តូចជាង"}៖ ${a} ឬ ${b}?`,
      options: [String(a), String(b)], answer: String(right),
      whyEn: `${right} is ${bigger ? "more" : "less"} than ${other}.`, whyKm: `${right} ${bigger ? "ធំជាង" : "តូចជាង"} ${other}។`,
    };
  });

/** Which of two sums is bigger: a tap that makes a child work both out. */
export const compareSums = (grade: Grade, count: number, lo: number, hi: number): Q[] =>
  distinct(`g${grade}-comparesums`, count, (rng) => {
    const a = intBetween(rng, lo, hi);
    const b = intBetween(rng, lo, hi);
    const c = intBetween(rng, lo, hi);
    const d = intBetween(rng, lo, hi);
    const x = a + b;
    const y = c + d;
    if (x === y) return null;
    const left = `${a} + ${b}`;
    const right = `${c} + ${d}`;
    const win = x > y ? left : right;
    return {
      grade, key: `sums-${a}-${b}-${c}-${d}`,
      en: `Which is more: ${left} or ${right}?`, km: `មួយណាច្រើនជាង៖ ${left} ឬ ${right}?`,
      options: [left, right], answer: win,
      whyEn: `${left} = ${x} and ${right} = ${y}, so ${win} is more.`, whyKm: `${left} = ${x} ហើយ ${right} = ${y} ដូច្នេះ ${win} ច្រើនជាង។`,
    };
  });

// ---- patterns and riddles ------------------------------------------------------

export interface Rule {
  /** The next term after `t`. */
  next(t: number): number;
  en: string;
  km: string;
}

export const addRule = (n: number): Rule => ({ next: (t) => t + n, en: `Each number is ${n} more.`, km: `លេខនីមួយៗច្រើនជាងមុន ${n}។` });
export const takeRule = (n: number): Rule => ({ next: (t) => t - n, en: `Each number is ${n} less.`, km: `លេខនីមួយៗតិចជាងមុន ${n}។` });
export const timesRule = (n: number): Rule => ({ next: (t) => t * n, en: `Each number is ${n} times the one before.`, km: `លេខនីមួយៗគុណនឹង ${n} ពីលេខមុន។` });

/** What number comes next in a row that follows a rule: the next term is typed. */
export const nextInPattern = (grade: Grade, count: number, rules: readonly Rule[], starts: readonly number[], shown = 4): Q[] =>
  distinct(`g${grade}-pattern`, count, (rng) => {
    const rule = pickOne(rng, rules);
    let t = pickOne(rng, starts);
    const seq = [t];
    for (let i = 1; i < shown; i++) seq.push((t = rule.next(t)));
    const next = rule.next(t);
    if (next < 0 || next > 99999 || seq.some((x) => x < 0)) return null;
    const row = seq.join(", ");
    return {
      grade, key: `next-${seq.join("-")}`,
      en: `What number comes next? ${row}, ?`, km: `តើលេខបន្ទាប់ជាលេខអ្វី? ${row}, ?`, answer: String(next),
      whyEn: `${rule.en} After ${t} comes ${next}.`, whyKm: `${rule.km} បន្ទាប់ពី ${t} គឺ ${next}។`,
    };
  });

/** "I think of a number. I add 6 and get 15. What is it?" */
export const riddles = (grade: Grade, count: number, kinds: ReadonlyArray<"+" | "−" | "×" | "÷">, lo: number, hi: number): Q[] =>
  distinct(`g${grade}-riddle`, count, (rng) => {
    const op = pickOne(rng, kinds);
    const x = intBetween(rng, lo, hi);
    const k = op === "×" || op === "÷" ? intBetween(rng, 2, 9) : intBetween(rng, Math.max(2, Math.round(lo / 2)), Math.max(5, Math.round(hi / 2)));
    const result = op === "+" ? x + k : op === "−" ? x - k : op === "×" ? x * k : x;
    const start = op === "÷" ? x * k : x;
    if (op === "−" && x - k < 1) return null;
    const verb = { "+": ["add", "បូក"], "−": ["take away", "ដក"], "×": ["multiply by", "គុណនឹង"], "÷": ["divide by", "ចែកនឹង"] }[op];
    const told = op === "÷" ? x : result;
    return {
      grade, key: `riddle-${op === "+" ? "add" : op === "−" ? "sub" : op === "×" ? "mul" : "div"}-${start}-${k}`,
      en: `I think of a number. I ${verb[0]} ${k} and get ${told}. What is my number?`,
      km: `ខ្ញុំគិតចំនួនមួយ។ ខ្ញុំ${verb[1]} ${k} ហើយបាន ${told}។ តើចំនួនរបស់ខ្ញុំជាអ្វី?`,
      answer: String(start),
      whyEn: op === "+" ? `Go back: ${told} − ${k} = ${start}.` : op === "−" ? `Go back: ${told} + ${k} = ${start}.` : op === "×" ? `Go back: ${told} ÷ ${k} = ${start}.` : `Go back: ${told} × ${k} = ${start}.`,
      whyKm: op === "+" ? `ត្រឡប់ក្រោយ៖ ${told} − ${k} = ${start}។` : op === "−" ? `ត្រឡប់ក្រោយ៖ ${told} + ${k} = ${start}។` : op === "×" ? `ត្រឡប់ក្រោយ៖ ${told} ÷ ${k} = ${start}។` : `ត្រឡប់ក្រោយ៖ ${told} × ${k} = ${start}។`,
    };
  });

// ---- stories with money, groups and sharing -----------------------------------------

export interface Item {
  en: string;
  many: string;
  km: string;
  /** What Khmer counts it in. */
  cls: string;
  /** "a pencil" / "an orange". */
  a: string;
}

export const ITEMS: readonly Item[] = [
  { en: "pencil", many: "pencils", km: "ខ្មៅដៃ", cls: "ដើម", a: "a pencil" },
  { en: "notebook", many: "notebooks", km: "សៀវភៅកត់ត្រា", cls: "ក្បាល", a: "a notebook" },
  { en: "ball", many: "balls", km: "បាល់", cls: "គ្រាប់", a: "a ball" },
  { en: "banana", many: "bananas", km: "ចេក", cls: "ផ្លែ", a: "a banana" },
  { en: "apple", many: "apples", km: "ផ្លែប៉ោម", cls: "ផ្លែ", a: "an apple" },
  { en: "ruler", many: "rulers", km: "បន្ទាត់", cls: "ដើម", a: "a ruler" },
  { en: "mango", many: "mangoes", km: "ស្វាយ", cls: "ផ្លែ", a: "a mango" },
  { en: "coconut", many: "coconuts", km: "ដូង", cls: "ផ្លែ", a: "a coconut" },
  { en: "loaf of bread", many: "loaves of bread", km: "នំបុ័ង", cls: "ដុំ", a: "a loaf of bread" },
  { en: "toy car", many: "toy cars", km: "ឡានក្មេងលេង", cls: "គ្រឿង", a: "a toy car" },
];

export interface Holder {
  en: string;
  many: string;
  km: string;
}

export const HOLDERS: readonly Holder[] = [
  { en: "box", many: "boxes", km: "ប្រអប់" },
  { en: "bag", many: "bags", km: "ថង់" },
  { en: "basket", many: "baskets", km: "កន្ត្រក" },
  { en: "plate", many: "plates", km: "ចាន" },
  { en: "tray", many: "trays", km: "ថាស" },
  { en: "shelf", many: "shelves", km: "ធ្នើ" },
];

/** Change from a note: "has $10, buys something for $6, gets $4 back." */
export const change = (grade: Grade, count: number, notes: readonly number[], maxPrice: number): Q[] =>
  distinct(`g${grade}-change`, count, (rng) => {
    const who = pickOne(rng, NAMES);
    const item = pickOne(rng, ITEMS);
    const note = pickOne(rng, notes);
    const price = intBetween(rng, 1, Math.min(maxPrice, note - 1));
    return {
      grade, key: `change-${who.en.toLowerCase()}-${item.en.replace(/ /g, "")}-${note}-${price}`,
      en: `${who.en} has $${note}. ${item.a[0].toUpperCase() + item.a.slice(1)} costs $${price}. How many dollars does ${who.en} have left?`,
      km: `${who.km}មាន ${note} ដុល្លារ។ ${item.km}មួយ${item.cls}ថ្លៃ ${price} ដុល្លារ។ ${who.km}នៅសល់ប៉ុន្មានដុល្លារ?`,
      answer: String(note - price),
      whyEn: `$${note} − $${price} = $${note - price}.`, whyKm: `${note} − ${price} = ${note - price} ដុល្លារ។`,
    };
  });

/** Groups of the same size: "each box has 6 pencils; how many in 4 boxes?" */
export const groups = (grade: Grade, count: number, perMax: number, groupsMax: number): Q[] =>
  distinct(`g${grade}-groups`, count, (rng) => {
    const item = pickOne(rng, ITEMS);
    const h = pickOne(rng, HOLDERS);
    const per = intBetween(rng, 2, perMax);
    const n = intBetween(rng, 2, groupsMax);
    return {
      grade, key: `groups-${item.en.replace(/ /g, "")}-${h.en}-${per}x${n}`,
      en: `Each ${h.en} has ${per} ${item.many}. How many ${item.many} are in ${n} ${h.many}?`,
      km: `${h.km}នីមួយៗមាន${item.km} ${per} ${item.cls}។ ${h.km} ${n} មាន${item.km}ប៉ុន្មាន${item.cls}?`,
      answer: String(per * n),
      whyEn: `${n} groups of ${per}: ${n} × ${per} = ${per * n}.`, whyKm: `${n} ក្រុម ក្រុមនីមួយៗ ${per}៖ ${n} × ${per} = ${per * n}។`,
    };
  });

/** Sharing equally: "12 sweets shared among 4 children: how many each?" */
export const sharing = (grade: Grade, count: number, perMax: number, peopleMax: number): Q[] =>
  distinct(`g${grade}-share`, count, (rng) => {
    const item = pickOne(rng, ITEMS);
    const people = intBetween(rng, 2, peopleMax);
    const each = intBetween(rng, 2, perMax);
    const total = people * each;
    return {
      grade, key: `share-${item.en.replace(/ /g, "")}-${total}-${people}`,
      en: `${total} ${item.many} are shared equally among ${people} children. How many does each child get?`,
      km: `${item.km} ${total} ${item.cls}ត្រូវបែងចែកស្មើៗគ្នាដល់កុមារ ${people} នាក់។ កុមារម្នាក់ៗបានប៉ុន្មាន${item.cls}?`,
      answer: String(each),
      whyEn: `${total} ÷ ${people} = ${each}.`, whyKm: `${total} ÷ ${people} = ${each}។`,
    };
  });

// ---- clocks and fractions ---------------------------------------------------------------

const timeText = (h: number, m: number): string => `${h}:${String(m).padStart(2, "0")}`;

/** What time is it: one question for each of these minutes, with three other times to tap. */
export const clocks = (grade: Grade, minutes: readonly number[]): Q[] => {
  const pool = CLOCK_TIMES.filter(([, m]) => minutes.includes(m));
  const rng = makeRng(`g${grade}-clock`);
  return pool.map(([h, m]): Q => {
    const right = timeText(h, m);
    const others = new Set<string>();
    for (let tries = 0; others.size < 3 && tries < 40; tries++) {
      const [oh, om] = pickOne(rng, pool);
      const t = timeText(oh, om);
      if (t !== right) others.add(t);
    }
    const hourHand = m === 0 ? `short hand points to ${h} and the long hand to 12` : m === 30 ? `short hand is past ${h} and the long hand points to 6` : m === 15 ? `short hand is just past ${h} and the long hand points to 3` : `short hand is nearly at ${h === 12 ? 1 : h + 1} and the long hand points to 9`;
    const hourHandKm = m === 0 ? `ម្ជុលខ្លីចង្អុលលេខ ${h} ហើយម្ជុលវែងចង្អុលលេខ 12` : m === 30 ? `ម្ជុលខ្លីហួសលេខ ${h} ហើយម្ជុលវែងចង្អុលលេខ 6` : m === 15 ? `ម្ជុលខ្លីហួសលេខ ${h} បន្តិច ហើយម្ជុលវែងចង្អុលលេខ 3` : `ម្ជុលខ្លីជិតដល់លេខ ${h === 12 ? 1 : h + 1} ហើយម្ជុលវែងចង្អុលលេខ 9`;
    return {
      grade, key: `clock-${h}-${String(m).padStart(2, "0")}`, pics: [pic(clockId(h, m), `clock ${right}`)],
      en: "What time does the clock show?", km: "នាឡិកាបង្ហាញម៉ោងប៉ុន្មាន?",
      options: shuffled(rng, [right, ...others]), answer: right,
      whyEn: `The ${hourHand}: ${right}.`, whyKm: `${hourHandKm}៖ ${right}។`,
    };
  });
};

/** What fraction of the circle is coloured: one question per drawing, with three unequal fractions to tap beside the right one. */
export const fractionPies = (grade: Grade): Q[] => {
  const rng = makeRng(`g${grade}-fracpie`);
  return FRACTIONS.map(([k, n]): Q => {
    const right = `${k}/${n}`;
    const value = k / n;
    const others = new Set<string>();
    for (let tries = 0; others.size < 3 && tries < 60; tries++) {
      const dn = pickOne(rng, [2, 3, 4, 5, 6, 8]);
      const dk = intBetween(rng, 1, dn - 1);
      if (Math.abs(dk / dn - value) > 1e-9) others.add(`${dk}/${dn}`);
    }
    return {
      grade, key: `fracpie-${k}-${n}`, pics: [pic(`frac-${k}-${n}`, `${k} of ${n} parts`)],
      en: "What fraction of the circle is coloured?", km: "តើប្រភាគនៃរង្វង់ដែលបានផាត់ពណ៌ជាអ្វី?",
      options: shuffled(rng, [right, ...others]), answer: right,
      whyEn: `The circle has ${n} equal parts and ${k} are coloured: ${right}.`, whyKm: `រង្វង់មាន ${n} ផ្នែកស្មើគ្នា ហើយ ${k} ផ្នែកត្រូវបានផាត់ពណ៌៖ ${right}។`,
    };
  });
};

// ---- add and take-away stories, for any size of number ----------------------------------

const STORY_THINGS = THINGS.filter((t) => t.cls !== "");

export const addStories = (grade: Grade, count: number, aMin: number, aMax: number, totalMax: number): Q[] =>
  distinct(`g${grade}-addstory`, count, (rng) => {
    const t = pickOne(rng, STORY_THINGS);
    const n = pickOne(rng, NAMES);
    const a = intBetween(rng, aMin, aMax);
    const b = intBetween(rng, Math.max(2, Math.round(aMin / 2)), totalMax - a);
    if (b < 2) return null;
    const sum = a + b;
    const animal = t.kind === "animal";
    return {
      grade, key: `add-${n.en.toLowerCase()}-${t.icon}-${a}-${b}`,
      en: animal ? `There are ${a} ${t.many}. ${b} more come. How many are there now?` : `${n.en} has ${a} ${t.many}. A friend gives ${n.en} ${b} more. How many does ${n.en} have now?`,
      km: animal ? `មាន${countKm(t, a)}។ មាន${countKm(t, b)}ទៀតមកដល់។ ឥឡូវមាន${howKm(t)}?` : `${n.km}មាន${countKm(t, a)}។ មិត្តឲ្យ${n.km}${t.km} ${b} ${t.cls}ទៀត។ ឥឡូវ${n.km}មាន${howKm(t)}?`,
      answer: String(sum), whyEn: `${a} + ${b} = ${sum}.`, whyKm: `${a} + ${b} = ${sum}។`,
    };
  });

export const takeStories = (grade: Grade, count: number, aMin: number, aMax: number): Q[] =>
  distinct(`g${grade}-takestory`, count, (rng) => {
    const t = pickOne(rng, STORY_THINGS);
    const n = pickOne(rng, NAMES);
    const a = intBetween(rng, aMin, aMax);
    const b = intBetween(rng, 2, a - 2);
    const left = a - b;
    const animal = t.kind === "animal";
    return {
      grade, key: `take-${n.en.toLowerCase()}-${t.icon}-${a}-${b}`,
      en: animal ? `There are ${a} ${t.many}. ${b} ${t.leaveEn}. How many are left?` : `${n.en} has ${a} ${t.many}. ${n.en} gives ${b} to a friend. How many are left?`,
      km: animal ? `មាន${countKm(t, a)}។ ${t.km} ${b} ${t.cls}${t.leaveKm}។ នៅសល់${howKm(t)}?` : `${n.km}មាន${countKm(t, a)}។ ${n.km}ឲ្យមិត្ត ${b} ${t.cls}។ ${n.km}នៅសល់${howKm(t)}?`,
      answer: String(left), whyEn: `${a} − ${b} = ${left}.`, whyKm: `${a} − ${b} = ${left}។`,
    };
  });

/** What several of one thing cost: "a pencil costs $3; how much do 4 cost?" */
export const priceTimes = (grade: Grade, count: number, priceMax: number, qtyMax: number): Q[] =>
  distinct(`g${grade}-pricetimes`, count, (rng) => {
    const item = pickOne(rng, ITEMS);
    const price = intBetween(rng, 2, priceMax);
    const qty = intBetween(rng, 2, qtyMax);
    return {
      grade, key: `price-${item.en.replace(/ /g, "")}-${price}x${qty}`,
      en: `${item.a[0].toUpperCase() + item.a.slice(1)} costs $${price}. How many dollars do ${qty} ${item.many} cost?`,
      km: `${item.km}មួយ${item.cls}ថ្លៃ ${price} ដុល្លារ។ ${item.km} ${qty} ${item.cls}ថ្លៃប៉ុន្មានដុល្លារ?`,
      answer: String(price * qty),
      whyEn: `${qty} × $${price} = $${price * qty}.`, whyKm: `${qty} × ${price} = ${price * qty} ដុល្លារ។`,
    };
  });

// ---- bigger-number stories: a school, a farm, a shop ---------------------------------------

interface Scene {
  key: string;
  en(a: number, b: number): string;
  km(a: number, b: number): string;
}

const ADD_SCENES: readonly Scene[] = [
  { key: "school", en: (a, b) => `A school has ${a} boys and ${b} girls. How many children are in the school?`, km: (a, b) => `សាលាមួយមានក្មេងប្រុស ${a} នាក់ និងក្មេងស្រី ${b} នាក់។ សាលានេះមានសិស្សសរុបប៉ុន្មាននាក់?` },
  { key: "farm", en: (a, b) => `A farm has ${a} hens and ${b} ducks. How many birds does it have?`, km: (a, b) => `កសិដ្ឋានមួយមានមាន់ ${a} ក្បាល និងទា ${b} ក្បាល។ កសិដ្ឋានមានសត្វស្លាបសរុបប៉ុន្មានក្បាល?` },
  { key: "library", en: (a, b) => `A library has ${a} story books and ${b} picture books. How many books is that?`, km: (a, b) => `បណ្ណាល័យមួយមានសៀវភៅរឿង ${a} ក្បាល និងសៀវភៅរូបភាព ${b} ក្បាល។ សរុបមានសៀវភៅប៉ុន្មានក្បាល?` },
  { key: "market", en: (a, b) => `A market sells ${a} mangoes in the morning and ${b} in the afternoon. How many mangoes is that in all?`, km: (a, b) => `ផ្សារមួយលក់ស្វាយ ${a} ផ្លែពេលព្រឹក និង ${b} ផ្លែពេលរសៀល។ លក់បានស្វាយសរុបប៉ុន្មានផ្លែ?` },
  { key: "bus", en: (a, b) => `A bus carries ${a} people in the morning and ${b} in the evening. How many people is that in all?`, km: (a, b) => `ឡានក្រុងមួយដឹកមនុស្ស ${a} នាក់ពេលព្រឹក និង ${b} នាក់ពេលល្ងាច។ សរុបប៉ុន្មាននាក់?` },
];

const TAKE_SCENES: readonly Scene[] = [
  { key: "eggs", en: (a, b) => `A shop has ${a} eggs. It sells ${b}. How many eggs are left?`, km: (a, b) => `ហាងមួយមានស៊ុត ${a} គ្រាប់។ ហាងលក់អស់ ${b} គ្រាប់។ នៅសល់ស៊ុតប៉ុន្មានគ្រាប់?` },
  { key: "seats", en: (a, b) => `A hall has ${a} seats. ${b} of them are empty. How many seats are used?`, km: (a, b) => `សាលមួយមានកៅអី ${a}។ កៅអី ${b} នៅទំនេរ។ តើមានកៅអីប្រើប្រាស់ប៉ុន្មាន?` },
  { key: "pages", en: (a, b) => `A book has ${a} pages. Dara has read ${b} pages. How many pages are left?`, km: (a, b) => `សៀវភៅមួយមាន ${a} ទំព័រ។ ដារ៉ាបានអានរួច ${b} ទំព័រ។ នៅសល់ប៉ុន្មានទំព័រ?` },
  { key: "rice", en: (a, b) => `A truck carries ${a} kg of rice. ${b} kg are sold. How many kg are left?`, km: (a, b) => `ឡានដឹកអង្ករ ${a} គីឡូក្រាម។ លក់អស់ ${b} គីឡូក្រាម។ នៅសល់ប៉ុន្មានគីឡូក្រាម?` },
];

export const bigAdd = (grade: Grade, count: number, lo: number, hi: number): Q[] =>
  distinct(`g${grade}-bigadd`, count, (rng) => {
    const s = pickOne(rng, ADD_SCENES);
    const a = intBetween(rng, lo, hi);
    const b = intBetween(rng, lo, hi);
    return { grade, key: `bigadd-${s.key}-${a}-${b}`, en: s.en(a, b), km: s.km(a, b), answer: String(a + b), whyEn: `${a} + ${b} = ${a + b}.`, whyKm: `${a} + ${b} = ${a + b}។` };
  });

export const bigTake = (grade: Grade, count: number, lo: number, hi: number): Q[] =>
  distinct(`g${grade}-bigtake`, count, (rng) => {
    const s = pickOne(rng, TAKE_SCENES);
    const a = intBetween(rng, lo, hi);
    const b = intBetween(rng, Math.round(lo / 3), a - Math.round(lo / 4));
    if (a - b < 1) return null;
    return { grade, key: `bigtake-${s.key}-${a}-${b}`, en: s.en(a, b), km: s.km(a, b), answer: String(a - b), whyEn: `${a} − ${b} = ${a - b}.`, whyKm: `${a} − ${b} = ${a - b}។` };
  });
