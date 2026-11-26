import React from "react";
import { motion } from "motion/react";
import type { DemoPhase, DemoStep } from "../../kit";
import { tx } from "../internal/i18n";
import { ThingArt } from "./things";

/**
 * How to play for CompareBench: two short scripts on the bench's own pieces.
 *
 *   compare: a purple pencil of 12 starts at the line; a blue one of 8 starts 6
 *            late, so it looks longer. The hand taps the blue one, taps the
 *            start line, and the blue slides back; then it taps the purple.
 *   order:   ribbons of 5, 13 and 9 go into the slots shortest first.
 *
 * The values are fixed so the captions can talk about them, and the test checks
 * they are a real answer (`demoFacts`).
 */

const BENCH = 20;
export const demoFacts = () => ({
  compare: { long: 12, short: 8, shortStart: 6 },
  order: { sizes: [5, 13, 9], order: [0, 2, 1] },
});

export function compareDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo.compareIntro"), holdMs: 2400 },
    { caption: tx("demo.compareTapLate"), hand: [[0.62, 0.68]], moveMs: 900 },
    { caption: tx("demo.compareTapLine"), hand: [[0.06, 0.5]], moveMs: 1000 },
    { caption: tx("demo.compareTogether"), holdMs: 1800 },
    { caption: tx("demo.compareAnswer"), hand: [[0.5, 0.3]], moveMs: 900, holdMs: 2200 },
  ];
}

export function orderDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo.orderIntro"), holdMs: 2200 },
    { caption: tx("demo.orderShortest"), hand: [[0.25, 0.7]], moveMs: 900 },
    { caption: tx("demo.orderMiddle"), hand: [[0.35, 0.92]], moveMs: 900 },
    { caption: tx("demo.orderLongest"), hand: [[0.4, 0.8]], moveMs: 900 },
    { caption: tx("demo.orderDone"), holdMs: 2200 },
  ];
}

const w = (spaces: number) => `${(spaces / BENCH) * 100}%`;

export const CompareDemoScene: React.FC<{ kind: "compare" | "order"; step: number; phase: DemoPhase; motionOK: boolean }> = ({ kind, step, phase, motionOK }) => {
  const done = (s: number) => step > s || (step === s && phase === "done");
  const t = motionOK ? { type: "spring" as const, stiffness: 320, damping: 30 } : { duration: 0 };

  if (kind === "compare") {
    const { long, short, shortStart } = demoFacts().compare;
    const held = step === 1 && phase !== "start" ? true : step === 2 && phase === "start";
    const back = done(2);
    return (
      <div className="absolute inset-0 overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-4" data-testid="compare-demo">
        <div className="relative h-full">
          <div className={`absolute left-0 top-0 bottom-0 w-[10%] rounded-lg border-2 border-dashed ${step === 2 ? "border-violet-600 bg-violet-100 dark:bg-violet-900/40" : "border-ink/40"}`} />
          <div className="absolute left-[12%] right-0 top-[18%] h-[22%]">
            <motion.div className={`h-full rounded ${done(4) ? "ring-4 ring-emerald-400" : ""}`} style={{ width: w(long) }} initial={false} animate={{ scale: done(4) && motionOK ? [1, 1.05, 1] : 1 }}>
              <ThingArt thing="pencil" colour="purple" />
            </motion.div>
          </div>
          <div className="absolute left-[12%] right-0 top-[58%] h-[22%]">
            <motion.div
              className={`absolute h-full rounded ${held ? "ring-4 ring-violet-500" : ""}`}
              style={{ width: w(short) }}
              initial={false}
              animate={{ left: back ? "0%" : w(shortStart), y: held && motionOK ? -4 : 0 }}
              transition={t}
            >
              <ThingArt thing="pencil" colour="blue" />
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  const { sizes } = demoFacts().order;
  const placed = [done(1) ? 0 : null, done(2) ? 2 : null, done(3) ? 1 : null];
  return (
    <div className="absolute inset-0 flex flex-col gap-2 overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-3" data-testid="order-demo">
      {placed.map((p, s) => (
        <div key={s} className="flex h-[16%] items-center rounded-lg border-2 border-dashed border-line px-1">
          {p !== null && (
            <motion.div layout={motionOK} className="h-[70%]" style={{ width: w(sizes[p]) }} transition={t}>
              <ThingArt thing="ribbon" colour={(["pink", "blue", "green"] as const)[p]} />
            </motion.div>
          )}
        </div>
      ))}
      <div className="mt-1 flex flex-1 flex-col justify-around border-t border-line pt-1">
        {sizes.map((size, i) =>
          placed.includes(i) ? (
            <div key={i} className="h-[18%]" />
          ) : (
            <motion.div key={i} layout={motionOK} className="h-[18%]" style={{ width: w(size) }} transition={t}>
              <ThingArt thing="ribbon" colour={(["pink", "blue", "green"] as const)[i]} />
            </motion.div>
          ),
        )}
      </div>
    </div>
  );
};
