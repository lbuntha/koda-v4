/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Count Back" — a set of objects and a countdown said out loud.
 *
 * The odd one out, and worth saying why, because the shape of this file is the
 * argument for the capabilities it uses.
 *
 * Every other staging counts *toward* the board: eight objects, eight acts, and
 * the answer is the eight. This one has eight objects and three acts — cross
 * three out and stop — and the answer is the five that were never touched. So it
 * is the staging that separated three numbers the engine used to treat as one:
 *
 *   - `count`    — objects on the board (`totalCount`)
 *   - `goal`     — acts that finish it (`removeCount`)
 *   - `expected` — what the answer panel checks (`total − remove`)
 *
 * Two more things it needs, both for the same reason — counting back is a
 * *sequence*, not a set:
 *
 *   - `emphasise` names the object to cross next, because the last one goes
 *     first and then the one before it. A board that accepted any tap would be
 *     teaching the opposite of the skill, and one that silently refused the
 *     wrong tap would teach nothing at all.
 *   - the countdown band is a `readout` zone: "8 → 7 → 6", the numbers the child
 *     is saying. That readout *is* the lesson. Dropping it and leaving only a
 *     header chip would keep the mechanics and lose the point.
 *
 * The physical act is still the engine's — tap, drag threshold, pointer capture,
 * keyboard, sounds, the answer panel — and this file never touches any of it.
 */

import React from "react";
import { contentZone, fitObjectSize, slotPosition, type Rect } from "../objectLayout";
import { boardTotals } from "./boardTotals";
import type { Point } from "../oneToOneLayout";
import type {
  CountItem,
  CountStaging,
  LayoutInput,
  LayoutResult,
  StagingConfig,
  ZoneContentProps
} from "./types";

export const SET: string = "set";
export const COUNTDOWN: string = "countdown";

const totalOf = (config: StagingConfig, count: number) =>
  Math.max(1, Number(config.totalCount ?? count) || count || 8);

const removeOf = (config: StagingConfig, count: number) =>
  Math.max(1, Math.min(totalOf(config, count), Number(config.removeCount ?? 3) || 3));

/** Crossed out, most recent last — the order the numbers were said in. */
const crossed = (items: CountItem[]) => items.filter(item => item.counted);

/**
 * The next object to cross: the last one still standing.
 *
 * Counting back walks the set from the end, so "which one now" is always the
 * highest-indexed object that has not been crossed yet.
 */
const nextToCross = (items: CountItem[]): CountItem | null => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index].counted) return items[index];
  }
  return null;
};

/**
 * The countdown itself: where the child started, and every number since.
 *
 * Rendered as the running sequence rather than just the current number, because
 * "8 → 7 → 6" is what they are being asked to say, and seeing the trail is what
 * makes the next one predictable.
 */
const Countdown: React.FC<ZoneContentProps> = ({ count, done, isDark }) => (
  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 overflow-hidden px-2">
    <span
      className={`font-mono font-black text-xl sm:text-2xl md:text-3xl ${
        isDark ? "text-slate-100" : "text-slate-800"
      }`}
    >
      {count}
    </span>
    {Array.from({ length: done }, (_, step) => (
      <React.Fragment key={step}>
        <span
          aria-hidden="true"
          className={`font-mono font-black text-sm sm:text-base ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}
        >
          →
        </span>
        <span
          className={`font-mono font-black text-xl sm:text-2xl md:text-3xl animate-scale-in ${
            isDark ? "text-rose-300" : "text-rose-500"
          }`}
        >
          {count - step - 1}
        </span>
      </React.Fragment>
    ))}
  </div>
);

export const countBackStaging: CountStaging = {
  id: "countback",
  // Crossing out happens where the object lies; nothing travels.
  movesOnCount: false,
  // The set above, the countdown below — read top to bottom.
  orientation: "column",
  // A crossed object is not the seventh of anything.
  countedAppearance: "struck",

  objectCount: (config, targetCount) => boardTotals(config, targetCount).objects,

  /** Three crossings finish it, however many objects are on the board. */
  goal: (config, count) => boardTotals(config, count).goal,

  /** What is left, which is the one number never marked on the board. */
  expectedAnswer: (config, count) => boardTotals(config, count).expected,

  emphasise: items => nextToCross(items)?.id ?? null,

  zones: () => [
    {
      id: SET,
      label: "The set",
      learnerLabel: "Tap the last one",
      role: "home"
      // No empty hint: this bin never empties — that is the whole point.
    },
    {
      id: COUNTDOWN,
      label: "Countdown",
      learnerLabel: "Say it out loud",
      role: "readout",
      /*
        A readout needs one line of numbers, so it takes a fixed slice rather
        than half the stage. Everything else belongs to the set, which is what
        the child is actually looking at.
      */
      flex: "0 0 5.5rem",
      Content: Countdown
    }
  ],

  layout({ count, stage, zones, items }: LayoutInput): LayoutResult {
    const setRect = zones[SET];
    const size = fitObjectSize({
      width: setRect?.width ?? stage.width,
      height: setRect?.height ?? stage.height * 0.7,
      count
    });

    const area: Rect | null = setRect ? contentZone(setRect, size) : null;
    const positions: Record<string, Point> = {};
    if (area) {
      /*
        Every object keeps its place for the whole activity, crossed or not.
        Compacting the survivors would answer the question for the child — the
        set has to look untouched apart from the marks on it.
      */
      for (const item of items) {
        positions[item.id] = slotPosition(item.index + 1, count, area, size);
      }
    }

    return { size, positions };
  },

  /**
   * A tap on the last object still standing crosses it out.
   *
   * Refusing everything else is deliberate, and it is why `emphasise` exists:
   * the ring says which one, so a refusal is a rule the child can see rather
   * than a board that stopped responding.
   */
  resolve({ item, items, tapped }) {
    if (!tapped || item.counted) return null;
    // Any object but the last one standing is the count going the wrong way.
    return nextToCross(items)?.id === item.id ? { counted: true } : "refused";
  },

  copy: {
    todo: ctx => `${ctx.remaining} to cross out`,
    finished: ctx => `${ctx.expected} left`,
    // "8 take away 0" reads as a sum a child could answer, not as progress.
    status: ctx => (ctx.done === 0 ? `Start at ${ctx.count}` : `${ctx.count} take away ${ctx.done}`),
    statusFinished: ctx => `${ctx.count} take away ${ctx.goal} leaves ${ctx.expected}!`,
    prompt: ctx => `How many ${ctx.objectLabel}${ctx.expected === 1 ? "" : "s"} are left?`,
    wrong: ctx =>
      `Not quite! ${ctx.count} take away ${ctx.goal} leaves ${ctx.expected} ${ctx.objectLabel}${
        ctx.expected === 1 ? "" : "s"
      }. Enter ${ctx.expected}!`,
    actedLabel: ctx => `Crossed out ${ctx.objectLabel}.`
  },

  guidance: ctx =>
    ctx.remaining === 0
      ? `Now enter how many ${ctx.objectLabel}s are left!`
      : `Start at ${ctx.count} and tap the last ${ctx.objectLabel} to count backward!`
};
