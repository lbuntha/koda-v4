import React from "react";
import type { PrintedQuestion } from "../../types";
import { tx } from "../internal/i18n";
import { factorsOf, fractionOf, resolve, seededRandom, tilePool, type MergeSetup, type Resolved } from "../internal/rules";

/**
 * Number Merge on paper.
 *
 * A board cannot be dragged on paper, but the fact behind every merge can be
 * written: one tile is given, the partner is left blank, and the target sits
 * after the equals sign. "7 + ___ = 10" is the merge a child makes on the
 * board, asked the other way round. The figure draws it as the board shows it
 * — two tiles and what they make — in black lines, with the dots, rods or pie
 * where the lesson uses pictures.
 */

export interface SheetQuestion {
  id: string;
  expected: string;
  setup: Resolved;
  /** The tile that is given. */
  a: number;
  /** A second given tile, for three-number sums. */
  b?: number;
  /** What goes on the line. */
  answer: number;
  /** What the merge makes. */
  makes: number;
  /** Asked the other way round: the blank first ("___ + 3 = 5"), or the halving form of a double. */
  flip?: boolean;
}

const pick = <T,>(xs: T[], rand: () => number): T => xs[Math.floor(rand() * xs.length)];

function draw(s: Resolved, rand: () => number): Omit<SheetQuestion, "id" | "expected" | "setup"> {
  const t = s.target;
  switch (s.mode) {
    case "bond": {
      const a = 1 + Math.floor(rand() * (t - 1));
      return { a, answer: t - a, makes: t };
    }
    case "difference": {
      const a = pick(tilePool(s).filter((v) => v + t <= (s.max ?? t + 7)), rand);
      return { a, answer: a + t, makes: t };
    }
    case "doubleFact": {
      const a = pick(tilePool(s), rand);
      return { a, answer: a + a, makes: a + a };
    }
    case "double": {
      const steps: number[] = [];
      for (const p of s.parts ?? [1]) for (let v = p; v < t; v *= 2) steps.push(v);
      const a = pick(steps, rand);
      return { a, answer: a + a, makes: a + a };
    }
    case "sum": {
      const max = Math.min(s.max ?? 9, t - 2);
      const a = 1 + Math.floor(rand() * max);
      const room = t - a - 1;
      const b = 1 + Math.floor(rand() * Math.min(max, room));
      return { a, b, answer: t - a - b, makes: t };
    }
    case "product": {
      const a = pick(factorsOf(t), rand);
      return { a, answer: t / a, makes: t };
    }
    case "bundle": {
      if (t === 10) {
        const a = 1 + Math.floor(rand() * 9);
        return { a, answer: 10 - a, makes: 10 };
      }
      const a = 10 * (1 + Math.floor(rand() * 9));
      return { a, answer: 100 - a, makes: 100 };
    }
    case "fraction": {
      const a = 1 + Math.floor(rand() * (t - 1));
      return { a, answer: t - a, makes: t };
    }
  }
}

const frac = (s: Resolved, v: number): string => {
  const [n, d] = fractionOf(v, s.target);
  return d === 1 ? String(n) : `${n}/${d}`;
};

/** What goes on the line: the halving form of a double asks for the number doubled. */
const blankValue = (q: SheetQuestion): number =>
  q.flip && ["double", "doubleFact", "difference"].includes(q.setup.mode) ? q.a : q.answer;

/** The written answer, as the key shows it. */
const answerText = (q: SheetQuestion): string => (q.setup.mode === "fraction" ? frac(q.setup, blankValue(q)) : String(blankValue(q)));

export function buildSheetQuestion(params: MergeSetup & { question?: MergeSetup }, index: number, seen: Set<string> = new Set()): SheetQuestion {
  const s = resolve({ ...params, ...params.question });
  let last: SheetQuestion | null = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rand = seededRandom(`sheet:${s.mode}:${s.target}:${index}:${attempt}`);
    const d = draw(s, rand);
    // Bonds, products, parts and doubles are also asked the other way round.
    if (s.mode !== "sum" && rand() < 0.5) d.flip = true;
    const key = `${d.a}:${d.b ?? ""}:${d.flip ? 1 : 0}`;
    last = { id: `merge-sheet-${index}-${key}`, setup: s, ...d, expected: "" };
    last.expected = answerText(last);
    if (!seen.has(key)) {
      seen.add(key);
      return last;
    }
  }
  return last!;
}

/** The question in words: the merge with its partner left blank. */
export function printedFor(q: SheetQuestion): PrintedQuestion {
  const s = q.setup;
  const blank = "___";
  let text: string;
  switch (s.mode) {
    case "bond":
      text = q.flip ? `${blank} + ${q.a} = ${q.makes}` : `${q.a} + ${blank} = ${q.makes}`;
      break;
    case "difference":
      text = q.flip ? `${q.answer} − ${blank} = ${q.makes}` : `${blank} − ${q.a} = ${q.makes}`;
      break;
    case "doubleFact":
    case "double":
      text = q.flip ? tx("sheet.half", { value: q.answer, blank }) : tx("sheet.double", { a: q.a, blank });
      break;
    case "sum":
      text = `${q.a} + ${q.b} + ${blank} = ${q.makes}`;
      break;
    case "product":
      text = q.flip ? `${blank} × ${q.a} = ${q.makes}` : `${q.a} × ${blank} = ${q.makes}`;
      break;
    case "bundle":
      if (s.target === 10) text = q.flip ? tx("sheet.onesFirst", { a: q.a, blank }) : tx("sheet.ones", { a: q.a, blank });
      else text = q.flip ? `${blank} + ${q.a} = 100` : `${q.a} + ${blank} = 100`;
      break;
    case "fraction":
      text = q.flip ? `${blank} + ${frac(s, q.a)} = 1` : `${frac(s, q.a)} + ${blank} = 1`;
      break;
  }
  return { text, answer: answerText(q) };
}

export const sheetPrompt = (q: SheetQuestion): string => printedFor(q).text;

/** How the technique goes, for the sheet to teach from. */
export const sheetMethod = (q: SheetQuestion): string[] => [tx(`sheet.method.${q.setup.mode}`, { target: q.setup.target })];

/* ---------- the figure: two tiles and what they make, in black lines ---------- */

const INK = "#111";

function TileBox({ x, s, v }: { x: number; s: Resolved; v: number | null }) {
  const size = 56;
  const pictures = s.show === "dots" || s.show === "both";
  let inside: React.ReactNode = null;
  if (v !== null) {
    if (s.mode === "fraction") {
      const [n, d] = fractionOf(v, s.target);
      const r = 20;
      const cx = x + size / 2;
      const cy = size / 2 + 4;
      inside = (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth={1.5} />
          {Array.from({ length: d }, (_, k) => {
            const a0 = (k / d) * 2 * Math.PI - Math.PI / 2;
            const a1 = ((k + 1) / d) * 2 * Math.PI - Math.PI / 2;
            return (
              <path
                key={k}
                d={`M${cx} ${cy} L${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} Z`}
                fill={k < n ? "#bbb" : "none"}
                stroke={INK}
                strokeWidth={1}
              />
            );
          })}
        </g>
      );
    } else if (pictures && v <= 10) {
      inside = (
        <g>
          {Array.from({ length: v }, (_, k) => (
            <circle key={k} cx={x + 10 + (k % 5) * 9} cy={20 + Math.floor(k / 5) * 12} r={3.5} fill={INK} />
          ))}
          <text x={x + size / 2} y={size - 6} textAnchor="middle" fontSize={14} fontWeight={700} fill={INK}>{v}</text>
        </g>
      );
    } else {
      inside = <text x={x + size / 2} y={size / 2 + 12} textAnchor="middle" fontSize={24} fontWeight={800} fill={INK}>{v}</text>;
    }
  }
  return (
    <g>
      <rect x={x} y={4} width={size} height={size} rx={10} fill="none" stroke={INK} strokeWidth={2} strokeDasharray={v === null ? "5 4" : undefined} />
      {inside}
    </g>
  );
}

export function sheetFigure(q: SheetQuestion): React.ReactNode {
  const s = q.setup;
  const given = q.b === undefined ? [q.a] : [q.a, q.b];
  const boxes = q.flip ? [null, ...given] : [...given, null];
  const width = boxes.length * 84 + 80;
  const makes = s.mode === "fraction" ? "1" : String(q.makes);
  return (
    <svg viewBox={`0 0 ${width} 64`} width={width} height={64} role="img" aria-label={printedFor(q).text}>
      {boxes.map((v, k) => (
        <g key={k}>
          <TileBox x={k * 84} s={s} v={v} />
          {k < boxes.length - 1 && (
            <text x={k * 84 + 70} y={40} textAnchor="middle" fontSize={22} fontWeight={700} fill={INK}>{s.mode === "product" ? "×" : "+"}</text>
          )}
        </g>
      ))}
      <text x={boxes.length * 84 - 14} y={40} textAnchor="middle" fontSize={22} fontWeight={700} fill={INK}>=</text>
      <circle cx={boxes.length * 84 + 30} cy={32} r={27} fill="none" stroke={INK} strokeWidth={2.5} />
      <text x={boxes.length * 84 + 30} y={40} textAnchor="middle" fontSize={makes.length > 2 ? 18 : 22} fontWeight={800} fill={INK}>{makes}</text>
    </svg>
  );
}

/** Differences and doubles read badly as a picture of a sum, so only sums, products and parts get one. */
export const figureFor = (q: SheetQuestion): React.ReactNode | null =>
  ["bond", "sum", "product", "bundle", "fraction"].includes(q.setup.mode) ? sheetFigure(q) : null;
