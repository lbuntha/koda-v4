import React from "react";
import { motion } from "motion/react";
import type { DemoPhase, DemoStep } from "../../kit";
import { tx } from "../internal/i18n";
import type { Rect } from "../internal/rules";
import { TONES } from "./tones";

/**
 * Box Split's "How to play": lesson 1's first kind of board, solved by the
 * hand one box at a time.
 *
 *   [2][1][ ]      the 1s are boxes of their own, the 3 runs down the right,
 *   [ ][2][3]      each 2 takes the square below it.
 *   [1][ ][ ]
 */

const N = 3;
const CLUES: { cell: number; area: number }[] = [
  { cell: 0, area: 2 },
  { cell: 1, area: 1 },
  { cell: 4, area: 2 },
  { cell: 5, area: 3 },
  { cell: 6, area: 1 },
];

/** Each step's box, in the order the hand draws them; null for the opening and closing steps. */
const BOXES: (Rect & { tone: number } | null)[] = [
  null,
  { r: 0, c: 1, h: 1, w: 1, tone: 1 },
  { r: 0, c: 2, h: 3, w: 1, tone: 3 },
  { r: 1, c: 1, h: 2, w: 1, tone: 2 },
  { r: 0, c: 0, h: 2, w: 1, tone: 0 },
  { r: 2, c: 0, h: 1, w: 1, tone: 4 },
  null,
];

/** The demo's numbers and boxes, for a test to check the demo solves a real split. */
export const demoClues = () => CLUES;
export const demoBoxes = () => BOXES.filter(Boolean) as Rect[];

const centre = (r: number, c: number) => [(c + 0.5) / N, (r + 0.5) / N] as const;

export function demoSteps(): DemoStep[] {
  return [
    { caption: tx("demo.intro"), holdMs: 2600 },
    { caption: tx("demo.one"), hand: [centre(0, 1)], taps: 2, moveMs: 1000 },
    { caption: tx("demo.three"), hand: [centre(0, 2), centre(2, 2)], moveMs: 1500 },
    { caption: tx("demo.two"), hand: [centre(1, 1), centre(2, 1)], moveMs: 1100 },
    { caption: tx("demo.twoAgain"), hand: [centre(0, 0), centre(1, 0)], moveMs: 1100 },
    { caption: tx("demo.last"), hand: [centre(2, 0)], taps: 2, moveMs: 1000 },
    { caption: tx("demo.done"), holdMs: 2200 },
  ];
}

const pct = (v: number) => `${(v / N) * 100}%`;
const place = (b: Rect): React.CSSProperties => ({ left: pct(b.c), top: pct(b.r), width: pct(b.w), height: pct(b.h) });

/** The little board at a step: every earlier box drawn, this one growing under the hand, then drawn. */
export const DemoScene: React.FC<{ step: number; phase: DemoPhase; moveMs: number; motionOK: boolean }> = ({ step, phase, moveMs, motionOK }) => {
  const box = BOXES[step];
  const drawn = BOXES.slice(0, step).filter(Boolean) as (Rect & { tone: number })[];
  if (box && phase === "done") drawn.push(box);
  const growing = box && phase === "move" && motionOK && (box.h > 1 || box.w > 1);
  const finished = step === BOXES.length - 1;
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface"
      animate={finished && motionOK ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.6 }}
      data-testid="box-demo"
    >
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden="true">
        {Array.from({ length: N * N }, (_, i) => (
          <span key={i} className={`border-line ${i % N === N - 1 ? "" : "border-r"} ${i >= N * (N - 1) ? "" : "border-b"}`} />
        ))}
      </div>
      {drawn.map((b) => (
        <motion.div
          key={`${b.r}-${b.c}`}
          className={`absolute rounded-xl border-[3px] ${TONES[b.tone]}`}
          style={{ ...place(b), margin: 3, width: `calc(${pct(b.w)} - 6px)`, height: `calc(${pct(b.h)} - 6px)` }}
          initial={motionOK && b === box ? { scale: 0.6, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          data-testid="box-demo-drawn"
        />
      ))}
      {growing && (
        <motion.div
          className="absolute rounded-xl border-4 border-dashed border-violet-600 bg-violet-400/25 dark:border-violet-300"
          style={{ left: pct(box.c), top: pct(box.r) }}
          initial={{ width: pct(1), height: pct(1) }}
          animate={{ width: pct(box.w), height: pct(box.h) }}
          transition={{ duration: moveMs / 1000, ease: "easeInOut" }}
        >
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-violet-700 px-2 py-0.5 text-xs font-black text-white">
            {box.h} × {box.w} = {box.h * box.w}
          </span>
        </motion.div>
      )}
      {CLUES.map((cl) => {
        const r = Math.floor(cl.cell / N);
        const c = cl.cell % N;
        const now = box && box.r <= r && r < box.r + box.h && box.c <= c && c < box.c + box.w && phase !== "done";
        return (
          <span key={cl.cell} className="absolute grid place-items-center text-4xl font-black text-ink" style={{ left: pct(c), top: pct(r), width: pct(1), height: pct(1) }}>
            <motion.span
              className={`flex flex-col items-center gap-1 ${now ? "text-violet-700 dark:text-violet-300" : ""}`}
              animate={step === 0 && motionOK ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.8, repeat: step === 0 && motionOK ? 2 : 0 }}
            >
              <span>{cl.area}</span>
              <span className="flex gap-[0.12em]" aria-hidden="true">
                {Array.from({ length: cl.area }, (_, k) => <span key={k} className="h-[0.26em] w-[0.26em] rounded-full bg-violet-600 dark:bg-violet-300" />)}
              </span>
            </motion.span>
          </span>
        );
      })}
    </motion.div>
  );
};
