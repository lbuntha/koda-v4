import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

/**
 * Each joined pair's colour: its tiles and the string between them. No yellow —
 * it is hard to read in this app.
 */
const TONES = [
  { tile: "border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100", line: "text-indigo-500" },
  { tile: "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100", line: "text-emerald-500" },
  { tile: "border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100", line: "text-sky-500" },
  { tile: "border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100", line: "text-rose-500" },
  { tile: "border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-950 dark:text-violet-100", line: "text-violet-500" },
];

export interface UIMatchPairsProps {
  /** The pairs as written: `left[i]` goes with `right[i]`. */
  pairs: ReadonlyArray<{ left: string; right: string }>;
  /** The order the answers are shown in, as indexes into `pairs`. Shuffle it — or the first answer answers the first question. */
  order: readonly number[];
  /** Joined pairs: index into `pairs` → the order it was joined in, which picks its colour. Owned by the caller, so a hint can join one. */
  joined: Readonly<Record<number, number>>;
  /** A question and its own answer were chosen. */
  onJoin(index: number): void;
  /** A question and someone else's answer were chosen. The tiles flash, then let go. */
  onMiss(left: number, right: number): void;
  leftLabel: string;
  rightLabel: string;
  /** Extra classes for the tiles' text, e.g. a Khmer font. */
  textClassName?: string;
  disabled?: boolean;
}

interface Line {
  index: number;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Match each question to its answer: two columns, tap one on each side. A
 * joined pair takes a colour and a string is drawn between its two tiles, so a
 * child can see what goes with what at a glance — the way it is done on paper.
 *
 * Either side can be chosen first. The caller decides what a join or a miss
 * means (sounds, scoring); this only draws the board and reports.
 */
export const UIMatchPairs: React.FC<UIMatchPairsProps> = ({ pairs, order, joined, onJoin, onMiss, leftLabel, rightLabel, textClassName = "", disabled = false }) => {
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const [miss, setMiss] = useState<{ left: number; right: number } | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const lefts = useRef<Record<number, HTMLButtonElement | null>>({});
  const rights = useRef<Record<number, HTMLButtonElement | null>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  /** Where each string runs: from a question's right edge to its answer's left edge, measured on the board. */
  const measure = useCallback(() => {
    const host = board.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    setSize({ w: box.width, h: box.height });
    setLines(
      Object.keys(joined).map(Number).flatMap((index) => {
        const a = lefts.current[index]?.getBoundingClientRect();
        const b = rights.current[index]?.getBoundingClientRect();
        if (!a || !b) return [];
        const x1 = a.right - box.left;
        const y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left;
        const y2 = b.top + b.height / 2 - box.top;
        const bend = Math.max(12, (x2 - x1) / 2);
        return [{ index, x1, y1, x2, y2, d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` }];
      }),
    );
  }, [joined]);

  useLayoutEffect(() => {
    measure();
    const host = board.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    // Tiles reflow when the screen turns or the text wraps; the strings follow.
    const watch = new ResizeObserver(measure);
    watch.observe(host);
    return () => watch.disconnect();
  }, [measure]);

  const tryPair = (l: number, r: number) => {
    setLeft(null);
    setRight(null);
    if (l === r) return onJoin(l);
    setMiss({ left: l, right: r });
    onMiss(l, r);
    setTimeout(() => setMiss(null), 650);
  };
  const pickLeft = (l: number) => {
    if (disabled || l in joined || miss) return;
    if (right !== null) tryPair(l, right);
    else setLeft(l === left ? null : l);
  };
  const pickRight = (r: number) => {
    if (disabled || r in joined || miss) return;
    if (left !== null) tryPair(left, r);
    else setRight(r === right ? null : r);
  };

  const tone = (index: number) => TONES[(joined[index] ?? 0) % TONES.length];
  const tile = (index: number, chosen: boolean, missed: boolean) =>
    `flex min-h-14 w-full items-center rounded-2xl border-2 px-3 py-2 text-left text-base font-bold transition-colors sm:text-lg ${textClassName} ${
      index in joined ? tone(index).tile
      : missed ? "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
      : chosen ? "border-indigo-600 bg-indigo-600 text-white"
      : "border-line bg-surface text-ink hover:border-indigo-400"
    }`;

  return (
    <div ref={board} className="relative grid grid-cols-2 gap-x-8 gap-y-2 sm:gap-x-16">
      <svg data-match-strings aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={size.w} height={size.h}>
        {lines.map((l) => (
          <g key={l.index} className={tone(l.index).line}>
            <path d={l.d} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
            <circle cx={l.x1} cy={l.y1} r={5} fill="currentColor" />
            <circle cx={l.x2} cy={l.y2} r={5} fill="currentColor" />
          </g>
        ))}
      </svg>
      <ul className="grid content-start gap-2" aria-label={leftLabel}>
        {pairs.map((pr, l) => (
          <li key={l}>
            <button
              ref={(el) => { lefts.current[l] = el; }}
              type="button"
              onClick={() => pickLeft(l)}
              disabled={disabled || l in joined}
              aria-pressed={left === l}
              className={tile(l, left === l, miss?.left === l)}
            >
              {l in joined && <Check className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 break-words">{pr.left}</span>
            </button>
          </li>
        ))}
      </ul>
      <ul className="grid content-start gap-2" aria-label={rightLabel}>
        {order.map((r) => (
          <li key={r}>
            <button
              ref={(el) => { rights.current[r] = el; }}
              type="button"
              onClick={() => pickRight(r)}
              disabled={disabled || r in joined}
              aria-pressed={right === r}
              className={tile(r, right === r, miss?.right === r)}
            >
              <span className="min-w-0 break-words">{pairs[r].right}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
