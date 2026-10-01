/**
 * New items from a list: "A-Z", "0-9", "ក-អ", "១-៩", or any characters or
 * words. One draft per entry, with its kind, script, numerals, grid and (for a
 * Khmer vowel, foot or sign) its carrier letter and place worked out — so a
 * whole alphabet starts in one step and only its strokes are left to make.
 */

import type { TraceItem, TraceKind, Zone } from "../geometry/types";

const MAX = 200;
/** Old Khmer letters no longer taught: ឝ ឞ, and the deprecated independent vowels. */
const OBSOLETE = new Set([0x179d, 0x179e, 0x17a3, 0x17a4, 0x17a8]);

const graphemes = (s: string): string[] => {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: object) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg("km", { granularity: "grapheme" }).segment(s)].map((x) => x.segment);
  return [...s];
};

function range(a: string, b: string): string[] | null {
  const ca = a.codePointAt(0)!;
  const cb = b.codePointAt(0)!;
  if ([...a].length !== 1 || [...b].length !== 1 || cb < ca || cb - ca > MAX) return null;
  const out: string[] = [];
  for (let c = ca; c <= cb; c++) {
    if (OBSOLETE.has(c)) continue;
    out.push(String.fromCodePoint(c));
  }
  return out;
}

/**
 * What the list means. Separated by spaces, commas or lines: one item per entry
 * (so "cat dog" makes two words). Written together with no separator: one item
 * per character ("ABC" → A, B, C; "កខគ" → ក, ខ, គ). "X-Y" is a range either way.
 */
export function parseList(input: string): string[] {
  const text = input.trim();
  if (!text) return [];
  const separated = /[\s,،、]/.test(text);
  const tokens = separated ? text.split(/[\s,،、]+/).filter(Boolean) : [text];
  const out: string[] = [];
  for (const tok of tokens) {
    const m = tok.match(/^(.+)[-–](.+)$/u);
    const r = m ? range(m[1], m[2]) : null;
    if (r) out.push(...r);
    else if (separated) out.push(tok);
    else out.push(...graphemes(tok));
  }
  return [...new Set(out)].slice(0, MAX);
}

const isKhmer = (s: string) => /[ក-៿᧠-᧿]/.test(s);
const KHMER_DIGIT = /^[០-៩]$/;

/** Where a Khmer mark sits around its letter. */
const ZONES: [RegExp, Zone][] = [
  [/^្/, "below"], // a foot (subscript)
  [/^[ុូួ]$/, "below"], // ◌ុ ◌ូ ◌ួ
  [/^[េែៃ]$/, "left"], // ◌េ ◌ែ ◌ៃ
  [/^[ាះៈ]$/, "right"], // ◌ា ◌ះ ◌ៈ
  [/^[ិ-ឺំ៉-៑៓៝]$/, "above"], // ◌ិ ◌ី ◌ឹ ◌ឺ ◌ំ shifters, signs
];

export interface ListDefaults {
  grid: TraceItem["grid"];
  sensitivity: TraceItem["sensitivity"];
}

export function itemFor(entry: string, id: string, d: ListDefaults): TraceItem {
  const khmer = isKhmer(entry);
  const first = entry.codePointAt(0) ?? 0;
  const combining = khmer && ((first >= 0x17b6 && first <= 0x17d3) || first === 0x17dd);
  let kind: TraceKind = "letter";
  if (/^[0-9]$/.test(entry) || KHMER_DIGIT.test(entry)) kind = "numeral";
  else if (combining) kind = "mark";
  else if (graphemes(entry).length > 1) kind = "word";
  const zone = kind === "mark" ? (ZONES.find(([re]) => re.test(entry))?.[1] ?? "around") : undefined;
  return {
    id,
    rev: 1,
    title: entry,
    kind,
    script: khmer ? "khmer" : "latin",
    numerals: khmer ? "khmer" : "latin",
    grid: khmer ? d.grid : d.grid === "4x3-moeys" ? "baseline-4-lines" : d.grid,
    sensitivity: d.sensitivity,
    strokes: [],
    ...(kind === "mark" ? { carrier: { text: "ក", box: { x: 150, y: 350, w: 450, h: 450 } }, zone } : {}),
    // The typed guide: the mark is shown on its letter, so its place is clear.
    guide: { glyph: { text: kind === "mark" ? `ក${entry}` : entry, size: kind === "word" ? 360 : 720, x: 500, y: 780 } },
  };
}
