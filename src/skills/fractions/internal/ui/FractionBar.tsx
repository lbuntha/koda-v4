import React from "react";

/**
 * A whole, cut into equal parts, with some of them shaded.
 *
 * One component rather than one per engine, because the claim this skill rests
 * on is that the *same amount* can wear different names — and that is only
 * visible if the strip is drawn the same way every time it appears. Two
 * renderers, however carefully matched on the day, drift the first time one of
 * them is nudged, and the lesson quietly stops being about the thing it says.
 *
 * Colours come from the theme: `surface-muted` for an unshaded part, violet for
 * a shaded one — violet being the skill's colour for parts taken, the same one
 * the card on the shelf uses. Nothing here hand-rolls a dark-mode pair; the
 * token already knows.
 */

export interface FractionBarProps {
  parts: number;
  /** Indices of the shaded parts. */
  shaded: number[];
  /**
   * Part widths as fractions of the whole, where they are deliberately unequal.
   * Absent means every part is the same size, which is the honest default.
   */
  widths?: number[];
  /** How wide to draw it, as a fraction of the standard length. */
  scale?: number;
  onToggle?: (index: number) => void;
  disabled?: boolean;
  label?: string;
  /** Faint, for showing what a fraction looked like before it was re-cut. */
  ghost?: boolean;
  /**
   * The part the Smart guide is pointing at, or undefined.
   *
   * Drawn here rather than in each engine for the same reason the bar itself
   * is one component: a strip that lights differently in two lessons is two
   * strips, and the whole claim of this skill is that it is the same one.
   */
  lit?: number;
}

const FULL = 280;

export const FractionBar: React.FC<FractionBarProps> = ({
  parts,
  shaded,
  widths,
  scale = 1,
  onToggle,
  disabled,
  label,
  ghost,
  lit,
}) => {
  const W = FULL * scale;
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < parts; i += 1) {
    offsets.push(acc);
    acc += (widths?.[i] ?? 1 / parts) * W;
  }

  return (
    <svg
      viewBox={`0 0 ${FULL + 4} 52`}
      width={FULL + 4}
      height={52}
      role="img"
      aria-label={`${label ?? `${shaded.length} of ${parts} parts shaded`}${
        lit === undefined ? "" : `, part ${lit + 1} next`
      }`}
      className="text-ink"
      opacity={ghost ? 0.35 : 1}
    >
      {Array.from({ length: parts }, (_, i) => {
        const w = (widths?.[i] ?? 1 / parts) * W;
        return (
          <rect
            key={i}
            x={offsets[i] + 2}
            y={6}
            width={Math.max(2, w - 2)}
            height={40}
            rx={4}
            className={shaded.includes(i) ? "fill-violet-400" : "fill-surface-muted"}
            /* The coach's light is a ring on the part, not a fill: a filled
               part means "shaded", and borrowing that colour would tell a
               child the part was already taken. */
            stroke={i === lit ? "rgb(99 102 241)" : "currentColor"}
            strokeWidth={i === lit ? 3.5 : 1.2}
            style={{ cursor: onToggle && !disabled ? "pointer" : undefined }}
            onClick={onToggle && !disabled ? () => onToggle(i) : undefined}
          />
        );
      })}
    </svg>
  );
};

/** The same whole as a circle, for the partitions a circle can show honestly. */
export const FractionCircle: React.FC<{
  parts: number;
  shaded: number[];
  onToggle?: (index: number) => void;
  disabled?: boolean;
  label?: string;
  /** The part the Smart guide is pointing at — see `FractionBarProps`. */
  lit?: number;
}> = ({ parts, shaded, onToggle, disabled, label, lit }) => {
  const R = 54;
  const C = 60;
  const wedge = (i: number): string => {
    const a0 = (i / parts) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / parts) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${C} ${C} L ${C + R * Math.cos(a0)} ${C + R * Math.sin(a0)} A ${R} ${R} 0 ${large} 1 ${C + R * Math.cos(a1)} ${C + R * Math.sin(a1)} Z`;
  };
  return (
    <svg
      viewBox="0 0 120 120"
      width={120}
      height={120}
      role="img"
      aria-label={`${label ?? `${shaded.length} of ${parts} parts shaded`}${
        lit === undefined ? "" : `, part ${lit + 1} next`
      }`}
      className="text-ink"
    >
      {Array.from({ length: parts }, (_, i) => (
        <path
          key={i}
          d={wedge(i)}
          className={shaded.includes(i) ? "fill-violet-400" : "fill-surface-muted"}
          stroke={i === lit ? "rgb(99 102 241)" : "currentColor"}
          strokeWidth={i === lit ? 3.5 : 1.2}
          style={{ cursor: onToggle && !disabled ? "pointer" : undefined }}
          onClick={onToggle && !disabled ? () => onToggle(i) : undefined}
        />
      ))}
    </svg>
  );
};
