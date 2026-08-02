/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What is inside a crate, drawn rather than asserted.
 *
 * A crate labelled "10" tells a child the answer. A crate showing ten pips in a two-by-five
 * frame *shows* it — and that frame is the ten-frame, the representation the rest of early
 * maths teaching already uses. This is the difference between the game being about numerals
 * and being about quantity:
 *
 *     1        5           10              100
 *    ┌─┐    ┌─────┐   ┌───────────┐   ┌───────────┐
 *    │•│    │•••••│   │ • • • • • │   │▦▦▦▦▦▦▦▦▦▦ │  ten tens,
 *    └─┘    └─────┘   │ • • • • • │   │  (10×10)  │  drawn small
 *                     └───────────┘   └───────────┘
 *
 * The numeral stays on the crate as well. Neither representation is load-bearing alone:
 * the pips carry the quantity for a child who cannot yet read "100", the numeral carries it
 * once the pips are too small to count — which is exactly the transition to unitizing that
 * the ladder is teaching.
 */

import React from "react";

interface Props {
  unit: number;
  /** Overall crate size in px; pips scale from it. */
  size: number;
  className?: string;
}

const Pip: React.FC<{ r: number; cx: number; cy: number }> = ({ r, cx, cy }) => (
  <circle cx={cx} cy={cy} r={r} className="fill-current" opacity={0.55} />
);

export const CrateFace: React.FC<Props> = ({ unit, size, className }) => {
  const box = 48;
  const pips: React.ReactNode[] = [];
  /** A faint frame behind the ten, so the crate reads as a ten-frame and not as dots. */
  let frame: React.ReactNode = null;

  if (unit === 1) {
    pips.push(<Pip key="1" r={11} cx={24} cy={24} />);
  } else if (unit === 5) {
    // A row of five, the way fingers come.
    for (let i = 0; i < 5; i++) pips.push(<Pip key={i} r={4.4} cx={6 + i * 9} cy={24} />);
  } else if (unit === 10) {
    // The ten-frame: two rows of five, so "five and five" is visible without counting.
    frame = (
      <g opacity={0.35}>
        <rect x={2} y={12} width={44} height={24} rx={3} className="fill-none stroke-current" strokeWidth={1.5} />
        <line x1={24} y1={12} x2={24} y2={36} className="stroke-current" strokeWidth={1.5} />
        <line x1={2} y1={24} x2={46} y2={24} className="stroke-current" strokeWidth={1.5} />
      </g>
    );
    for (let i = 0; i < 10; i++) {
      pips.push(<Pip key={i} r={3.4} cx={6.4 + (i % 5) * 8.8} cy={18 + Math.floor(i / 5) * 12} />);
    }
  } else if (unit === 100) {
    // Ten tens. Individually uncountable at this size, and that is the point — a hundred
    // is read as "ten of those tens", which is the step the grandmaster tier asks for.
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        pips.push(<Pip key={`${row}-${col}`} r={1.5} cx={4.5 + col * 4.4} cy={4.5 + row * 4.4} />);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${box} ${box}`}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {frame}
      {pips}
    </svg>
  );
};
