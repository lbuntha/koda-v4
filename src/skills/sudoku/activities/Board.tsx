import React from "react";
import { digitsOf, geometry, has, type Size } from "../internal/board";
import { tx } from "../internal/i18n";

/**
 * The board both activities draw. Boxes are their own grids, so the thick lines
 * between boxes are gaps rather than borders and every cell stays square.
 */

/* ---------- pictures ---------- */

export const PICTURES = ["circle", "triangle", "square", "star", "heart", "diamond"] as const;
export type Picture = (typeof PICTURES)[number];

const TONES = [
  "text-violet-600 dark:text-violet-300",
  "text-sky-600 dark:text-sky-300",
  "text-rose-600 dark:text-rose-300",
  "text-emerald-600 dark:text-emerald-300",
  "text-indigo-600 dark:text-indigo-300",
  "text-pink-600 dark:text-pink-300",
];

const PATHS: Record<Picture, React.ReactNode> = {
  circle: <circle cx="12" cy="12" r="9" />,
  triangle: <path d="M12 3 21.5 20h-19z" />,
  square: <rect x="3.5" y="3.5" width="17" height="17" rx="3" />,
  star: <path d="m12 2.5 2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.8z" />,
  heart: <path d="M12 21s-8.5-5.3-8.5-11.2A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 3.2C20.5 15.7 12 21 12 21z" />,
  diamond: <path d="M12 2.5 21 12l-9 9.5L3 12z" />,
};

/** A picture set for one puzzle: which shape and colour stands for each digit. */
export interface PictureSet {
  shapes: Picture[];
  tones: number[];
}

export function PictureMark({ set, value, className = "h-3/5 w-3/5" }: { set: PictureSet; value: number; className?: string }) {
  const shape = set.shapes[value - 1];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`${className} fill-current ${TONES[set.tones[value - 1] % TONES.length]}`}>
      {PATHS[shape]}
    </svg>
  );
}

export const pictureName = (set: PictureSet, value: number): string => tx(`picture.${set.shapes[value - 1]}`);

/* ---------- the board ---------- */

export type CellMark = "hint" | "target" | "wrong" | undefined;

export interface BoardProps {
  n: Size;
  /** What is in each cell now. 0 is empty. */
  values: number[];
  /** Cells that came with the puzzle. */
  givens: boolean[];
  /** Notes per cell, as bitmasks. */
  notes?: number[];
  selected: number;
  marks?: Map<number, CellMark>;
  /** Notes a hint says to take out: cell → bitmask. */
  struck?: Map<number, number>;
  /** Cells to shade lightly, for the house a hint names. */
  area?: Set<number>;
  pictures?: PictureSet;
  disabled?: boolean;
  onSelect(cell: number): void;
  labelFor(cell: number): string;
}

export function Board({ n, values, givens, notes, selected, marks, struck, area, pictures, disabled, onSelect, labelFor }: BoardProps) {
  const g = geometry(n);
  const boxes = g.houses.filter((h) => h.kind === "box");
  const selValue = selected >= 0 ? values[selected] : 0;
  const near = new Set(selected >= 0 ? g.peers[selected] : []);
  const text = n === 9 ? "text-[clamp(1rem,5vw,1.4rem)]" : n === 6 ? "text-[clamp(1.25rem,6.5vw,1.75rem)]" : "text-[clamp(1.5rem,8vw,2.25rem)]";
  const noteCols = n === 4 ? 2 : 3;

  return (
    <div
      role="grid"
      aria-label={tx("grid")}
      className="mx-auto grid aspect-square w-full max-w-[26rem] gap-[3px] overflow-hidden rounded-2xl border-[3px] border-slate-500 bg-slate-500 dark:border-slate-400 dark:bg-slate-400"
      style={{ gridTemplateColumns: `repeat(${n / g.bc}, 1fr)`, gridTemplateRows: `repeat(${n / g.br}, 1fr)` }}
    >
      {boxes.map((box) => (
        <div
          key={box.index}
          role="presentation"
          className="grid gap-px bg-slate-300 dark:bg-slate-600"
          style={{ gridTemplateColumns: `repeat(${g.bc}, 1fr)`, gridTemplateRows: `repeat(${g.br}, 1fr)` }}
        >
          {box.cells.map((i) => {
            const v = values[i];
            const mark = marks?.get(i);
            const given = givens[i];
            const tone =
              mark === "wrong"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                : i === selected
                  ? "bg-indigo-100 ring-[3px] ring-inset ring-indigo-500 dark:bg-indigo-950"
                  : mark === "target"
                    ? "bg-emerald-100 ring-[3px] ring-inset ring-emerald-500 dark:bg-emerald-950"
                    : mark === "hint"
                      ? "bg-emerald-50 dark:bg-emerald-950/60"
                      : selValue && v === selValue
                        ? "bg-indigo-100 dark:bg-indigo-900/60"
                        : area?.has(i)
                          ? "bg-emerald-50/70 dark:bg-emerald-950/40"
                          : near.has(i)
                            ? "bg-slate-100 dark:bg-slate-800"
                            : "bg-surface";
            const ink = given ? "text-ink" : "text-indigo-600 dark:text-indigo-300";
            const cellNotes = !v && notes ? notes[i] : 0;
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                aria-label={labelFor(i)}
                aria-selected={i === selected}
                disabled={disabled}
                onClick={() => onSelect(i)}
                className={`relative grid min-h-0 min-w-0 place-items-center font-black tabular-nums transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-indigo-500 ${text} ${mark === "wrong" ? "" : ink} ${tone}`}
              >
                {mark === "wrong" && <span className="sr-only">✗ </span>}
                {v ? (
                  pictures ? <PictureMark set={pictures} value={v} /> : v
                ) : cellNotes ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0.5 grid text-[clamp(0.5rem,2.2vw,0.7rem)] font-semibold leading-none text-muted"
                    style={{ gridTemplateColumns: `repeat(${noteCols}, 1fr)` }}
                  >
                    {Array.from({ length: n }, (_, k) => k + 1).map((d) => (
                      <span
                        key={d}
                        className={`grid place-items-center ${struck && has(struck.get(i) ?? 0, d) ? "rounded-sm bg-rose-200 text-rose-700 line-through dark:bg-rose-900 dark:text-rose-200" : ""}`}
                      >
                        {has(cellNotes, d) ? d : ""}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------- the number pad ---------- */

export interface PadProps {
  n: Size;
  pictures?: PictureSet;
  disabled?: boolean;
  /** Numbers placed as often as the grid allows: dimmed, but still pressable,
   *  so a number put in the wrong cell does not lock out the right one. */
  done?: Set<number>;
  onPick(value: number): void;
  labelFor(value: number): string;
}

export function Pad({ n, pictures, disabled, done, onPick, labelFor }: PadProps) {
  const cols = n === 9 ? 9 : n;
  return (
    <div role="group" aria-label={tx("pad")} className="grid w-full max-w-[26rem] gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: n }, (_, k) => k + 1).map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          aria-label={labelFor(d)}
          onClick={() => onPick(d)}
          className={`grid min-h-12 place-items-center rounded-xl border-2 border-b-4 border-line bg-surface text-xl font-black tabular-nums text-ink shadow-sm transition active:translate-y-0.5 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${done?.has(d) ? "opacity-40" : ""}`}
        >
          {pictures ? <PictureMark set={pictures} value={d} className="h-7 w-7" /> : d}
        </button>
      ))}
    </div>
  );
}

/** A mask's digits as "1, 4, 7". */
export const listDigits = (mask: number): string => digitsOf(mask).join(", ");
