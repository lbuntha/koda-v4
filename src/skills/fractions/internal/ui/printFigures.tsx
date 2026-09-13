import React from "react";

/**
 * The apparatus, redrawn for a pencil.
 *
 * Not the round's components. Those are built for a finger — theme colours,
 * hover states, springs, forty-four pixel hit targets — none of which survive
 * being printed and several of which cost ink. These are the same figures in
 * black lines, with whatever the child fills in left empty.
 *
 * Shading is hatched rather than filled for the same reason: a solid violet bar
 * is a grey slab on a home printer, and a child cannot write on it.
 */

const INK = "currentColor";

/** Diagonal hatching, defined once per figure that needs it. */
const Hatch: React.FC<{ id: string }> = ({ id }) => (
  <defs>
    <pattern id={id} width="4" height="4" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="4" stroke={INK} strokeWidth="1.2" />
    </pattern>
  </defs>
);

/**
 * A bar cut into equal parts, with some of them shaded.
 *
 * `widths` overrides the equal cut, for the one level whose question is whether
 * the parts are equal at all — drawing those equal would print a question with
 * a visible lie in it.
 */
export function printBar(
  parts: number,
  shaded = 0,
  options: { widths?: number[]; width?: number; label?: string } = {},
): React.ReactNode {
  const width = options.width ?? 220;
  const height = 34;
  const id = `hatch-bar-${parts}-${shaded}`;
  const slices = options.widths ?? Array.from({ length: parts }, () => 1);
  const span = slices.reduce((a, b) => a + b, 0);
  let x = 0;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={options.label ?? `A bar in ${parts} parts, ${shaded} shaded`}
      className="text-slate-900"
    >
      <Hatch id={id} />
      {slices.map((slice, i) => {
        const w = (slice / span) * width;
        const rect = (
          <rect
            key={i}
            x={x}
            y={1}
            width={w}
            height={height - 2}
            fill={i < shaded ? `url(#${id})` : "none"}
            stroke={INK}
            strokeWidth="1.5"
          />
        );
        x += w;
        return rect;
      })}
    </svg>
  );
}

/** A circle cut into equal parts, with some of them shaded. */
export function printCircle(parts: number, shaded = 0, label?: string): React.ReactNode {
  const size = 80;
  const r = size / 2 - 2;
  const c = size / 2;
  const id = `hatch-circle-${parts}-${shaded}`;
  const wedge = (i: number): string => {
    const a0 = (i / parts) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / parts) * Math.PI * 2 - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${c} ${c} L ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`;
  };
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={label ?? `A circle in ${parts} parts, ${shaded} shaded`}
      className="text-slate-900"
    >
      <Hatch id={id} />
      {Array.from({ length: parts }).map((_, i) => (
        <path key={i} d={wedge(i)} fill={i < shaded ? `url(#${id})` : "none"} stroke={INK} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/**
 * A number line, ruled but unmarked.
 *
 * The marker is never drawn: on paper the child puts it there, and a line that
 * arrives with the answer on it is a picture of the answer.
 */
export function printLine(span: number, intervals: number, label?: string): React.ReactNode {
  const width = 240;
  const height = 40;
  const step = width / intervals;
  return (
    <svg
      viewBox={`0 0 ${width + 12} ${height}`}
      width={width + 12}
      height={height}
      role="img"
      aria-label={label ?? `A number line from 0 to ${span} in ${intervals} jumps`}
      className="text-slate-900"
    >
      <line x1="6" y1="18" x2={width + 6} y2="18" stroke={INK} strokeWidth="1.5" />
      {Array.from({ length: intervals + 1 }).map((_, i) => {
        const whole = (i * span) % intervals === 0;
        return (
          <g key={i}>
            <line
              x1={6 + i * step}
              y1={whole ? 8 : 12}
              x2={6 + i * step}
              y2={whole ? 28 : 24}
              stroke={INK}
              strokeWidth={whole ? 1.8 : 1}
            />
            {whole ? (
              <text x={6 + i * step} y={38} fontSize="9" textAnchor="middle" fill={INK}>
                {(i * span) / intervals}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** An empty grid, for shading one fraction across and another down. */
export function printGrid(columns: number, rows: number, label?: string): React.ReactNode {
  const cell = 20;
  return (
    <svg
      viewBox={`0 0 ${columns * cell + 2} ${rows * cell + 2}`}
      width={columns * cell + 2}
      height={rows * cell + 2}
      role="img"
      aria-label={label ?? `An empty grid ${columns} across and ${rows} down`}
      className="text-slate-900"
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: columns }).map((_, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * cell + 1}
            y={r * cell + 1}
            width={cell}
            height={cell}
            fill="none"
            stroke={INK}
            strokeWidth="1"
          />
        )),
      )}
    </svg>
  );
}

/** A hundred square, some of it shaded. */
export function printHundred(shaded: number, label?: string): React.ReactNode {
  const cell = 11;
  const id = `hatch-hundred-${shaded}`;
  return (
    <svg
      viewBox={`0 0 ${cell * 10 + 2} ${cell * 10 + 2}`}
      width={cell * 10 + 2}
      height={cell * 10 + 2}
      role="img"
      aria-label={label ?? `A hundred squares, ${shaded} shaded`}
      className="text-slate-900"
    >
      <Hatch id={id} />
      {Array.from({ length: 100 }).map((_, i) => (
        <rect
          key={i}
          x={(i % 10) * cell + 1}
          y={Math.floor(i / 10) * cell + 1}
          width={cell}
          height={cell}
          fill={i < shaded ? `url(#${id})` : "none"}
          stroke={INK}
          strokeWidth="0.6"
        />
      ))}
    </svg>
  );
}

/** A row of things, for the levels about a fraction of a set. */
export function printSet(count: number, label?: string): React.ReactNode {
  const r = 7;
  const gap = 20;
  const perRow = Math.min(count, 10);
  const rows = Math.ceil(count / perRow);
  return (
    <svg
      viewBox={`0 0 ${perRow * gap + 4} ${rows * gap + 4}`}
      width={perRow * gap + 4}
      height={rows * gap + 4}
      role="img"
      aria-label={label ?? `${count} things`}
      className="text-slate-900"
    >
      {Array.from({ length: count }).map((_, i) => (
        <circle
          key={i}
          cx={(i % perRow) * gap + gap / 2 + 2}
          cy={Math.floor(i / perRow) * gap + gap / 2 + 2}
          r={r}
          fill="none"
          stroke={INK}
          strokeWidth="1.4"
        />
      ))}
    </svg>
  );
}
