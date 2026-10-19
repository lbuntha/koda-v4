import React from "react";

/** Where each piece lands and when it leaves. No yellow anywhere: it is hard to read. */
const PIECES = [
  { x: -150, y: -120, color: "bg-indigo-500", delay: 0 },
  { x: -90, y: -170, color: "bg-pink-500", delay: 0.05 },
  { x: -30, y: -140, color: "bg-emerald-500", delay: 0.1 },
  { x: 40, y: -180, color: "bg-cyan-500", delay: 0.02 },
  { x: 100, y: -130, color: "bg-purple-500", delay: 0.08 },
  { x: 150, y: -160, color: "bg-pink-400", delay: 0.12 },
  { x: -120, y: -60, color: "bg-cyan-400", delay: 0.15 },
  { x: 120, y: -70, color: "bg-emerald-400", delay: 0.06 },
  { x: -60, y: -90, color: "bg-purple-400", delay: 0.18 },
  { x: 70, y: -100, color: "bg-indigo-400", delay: 0.14 },
];

export interface UIBurstProps {
  /** Where the burst starts, inside a `relative` parent. */
  className?: string;
}

/**
 * One burst of confetti, for a moment worth celebrating.
 *
 * It flies out and fades once and never loops, and it is decoration only:
 * hidden from assistive technology, never in the way of a tap, and standing
 * still for a player who asked their device for less motion. Whatever it
 * celebrates must also be said in words and shown in an icon.
 */
export const UIBurst: React.FC<UIBurstProps> = ({ className = "left-1/2 top-1/3" }) => (
  <span aria-hidden="true" className={`pointer-events-none absolute ${className}`}>
    {PIECES.map((c, i) => (
      <span
        key={i}
        className={`ui-burst absolute block h-2.5 w-1.5 rounded-sm ${c.color}`}
        style={{ ["--x" as string]: `${c.x}px`, ["--y" as string]: `${c.y}px`, animationDelay: `${c.delay}s` }}
      />
    ))}
  </span>
);
