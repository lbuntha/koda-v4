/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The order as a strip, and the tray filling it.
 *
 * Crates say what they are worth; this says what that *means*. Each loaded crate takes a
 * slice of the strip in proportion to its value, so a 10 is visibly ten times a 1 rather
 * than a bigger number printed on a similar box. That is the bar model, and it is the
 * representation that turns "ten is a bundle of ten ones" from a claim into something a
 * child can see across the width of the screen.
 *
 *     order 24 ────────────────────────────────────────────────┐
 *     ├──────────10──────────┤────5────┤1┤1┤                   │
 *                                          ▲ 21, still short
 *
 * Ticks every ten mark the tens, so the strip doubles as a number line: a child can count
 * the marks to check the total instead of trusting the numeral.
 */

import React from "react";

interface Props {
  /** Crate sizes in the tray, in load order. */
  tray: number[];
  orderTotal: number;
  isDark: boolean;
  /** Colour per crate size — the same palette the crates use, so the link is obvious. */
  fill: Record<number, string>;
  reduceMotion: boolean;
}

export const CountingStrip: React.FC<Props> = ({ tray, orderTotal, isDark, fill, reduceMotion }) => {
  const total = tray.reduce((sum, unit) => sum + unit, 0);
  // Overshoot has to be visible, so the strip is scaled by whichever is larger. It never
  // silently clips the part that is over — being over is the thing worth seeing.
  const span = Math.max(orderTotal, total);
  const pct = (value: number) => `${(value / span) * 100}%`;

  let offset = 0;
  const segments = tray.map((unit, index) => {
    const start = offset;
    offset += unit;
    return { unit, index, start };
  });

  const ticks = Array.from({ length: Math.floor(span / 10) }, (_, i) => (i + 1) * 10);

  return (
    <div className="w-full max-w-2xl shrink-0 px-1" data-testid="counting-strip">
      <div
        className={`relative h-7 w-full overflow-hidden rounded-full sm:h-8 ${
          isDark ? "bg-white/[0.07]" : "bg-slate-900/[0.06]"
        }`}
      >
        {segments.map(({ unit, index, start }) => (
          <div
            key={index}
            style={{
              left: pct(start),
              width: pct(unit),
              transitionProperty: reduceMotion ? "none" : "left, width",
              transitionDuration: "220ms",
            }}
            className={`absolute inset-y-0 flex items-center justify-center border-r border-white/40 ${fill[unit]}`}
          >
            {/* The numeral only fits on the wider slices; narrow ones are read by width. */}
            {unit / span > 0.06 && (
              <span className="text-[10px] font-black text-slate-900/70 sm:text-xs">{unit}</span>
            )}
          </div>
        ))}

        {/* Tens marks, so the strip can be counted rather than taken on trust. */}
        {ticks.map((tick) => (
          <span
            key={tick}
            style={{ left: pct(tick) }}
            className={`absolute inset-y-0 w-px ${isDark ? "bg-white/25" : "bg-slate-900/20"}`}
          />
        ))}

        {/* Where the order sits. Only worth drawing once something has overshot it. */}
        {total > orderTotal && (
          <span
            style={{ left: pct(orderTotal) }}
            className="absolute inset-y-0 w-0.5 bg-rose-500"
            aria-hidden="true"
          />
        )}
      </div>

      <div className={`mt-0.5 flex justify-between text-[9px] font-bold tabular-nums ${
        isDark ? "text-slate-500" : "text-slate-400"
      }`}>
        <span>0</span>
        <span>{orderTotal}</span>
      </div>
    </div>
  );
};
