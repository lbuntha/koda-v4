import React from "react";

import type { ExpressionName } from "../lib/kodaFace";

/**
 * Koda's face, drawn rather than generated.
 *
 * The character is the one the project already had — the same dome — and the
 * point is not to redesign it but to own it. Generated, the outline came with a
 * hard diagonal down the lower left, a straight bottom edge and an angular kink
 * on the right, and none of that could be fixed from outside: you cannot round
 * a corner you do not own, so the mirroring, the colour and the expression
 * mapping were all working around a silhouette nobody had chosen.
 *
 * Drawn here, the shape is the same and every segment is a curve.
 *
 * Everything scales from a 100×100 box, so one size prop drives the lot and the
 * features cannot drift apart from the head at small sizes — the 28px avatar in
 * the chat is the same drawing as the 96px one in the coach.
 *
 * The expression vocabulary is unchanged: `kodaFace.ts` still owns which
 * expression a state wears and when it changes, and this only decides what each
 * one looks like. That seam is why the blink timing, the talking cycle and the
 * lip-sync all kept working when the artwork was replaced.
 */

export interface KodaVectorFaceProps {
  expression: ExpressionName;
  /** The head colour. Features are always the light on top of it. */
  color: string;
  /** How open the mouth is, 0–1, when a live voice is driving it. */
  openness?: number;
  className?: string;
  title?: string;
}

/**
 * The head: the shape the app already had, drawn properly.
 *
 * A tall dome over a full, slightly flattened base — the silhouette the
 * generated face had and which the project likes. What it did not have was a
 * smooth outline: the generated version came with a hard diagonal down the
 * lower left, a straight bottom edge and an angular kink on the right, so the
 * character read as something chopped rather than drawn.
 *
 * Every segment here is a cubic curve and the path is symmetric about x=50.
 * There is not a straight line or a corner in it, which is the whole point.
 */
const HEAD =
  "M50 7 C74 7 91 25 91 49 C91 66 89 79 85 86 C81 92 71 95 50 95 " +
  "C29 95 19 92 15 86 C11 79 9 66 9 49 C9 25 26 7 50 7 Z";

/**
 * One eye: white, with a dark pupil in it.
 *
 * A plain white oval is a hole in a head, not an eye — it is why the face read
 * as blank at every size. The pupil is what gives it somewhere to look, and it
 * is drawn as its own circle so an expression can move it without moving the
 * eye: `pondering` looks up and away, and that is the pupil shifting inside a
 * sclera that has not moved.
 */
const Eye: React.FC<{
  cx: number;
  cy: number;
  rx?: number;
  ry?: number;
  /** Where the pupil sits inside the eye, in units of the eye's own radius. */
  look?: [number, number];
  pupil?: number;
}> = ({ cx, cy, rx = 5.4, ry = 6.6, look = [0, 0], pupil = 3.6 }) => {
  const px = cx + look[0] * rx * 0.34;
  const py = cy + look[1] * ry * 0.34;
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFFFFF" stroke="none" />
      <circle cx={px} cy={py} r={pupil} fill="#1B1533" stroke="none" />
      {/*
        * The catchlight, and it is doing most of the work.
        *
        * A flat dark disc is a dot; the same disc with a highlight off its upper
        * left is an eye with something wet in it, which is the whole difference
        * between a face that looks drawn and one that looks alive. Two of them,
        * the second much smaller and low on the opposite side, because a single
        * highlight reads as a sticker and a pair reads as a curved surface.
        */}
      <circle
        cx={px - pupil * 0.36}
        cy={py - pupil * 0.4}
        r={pupil * 0.38}
        fill="#FFFFFF"
        stroke="none"
      />
      <circle
        cx={px + pupil * 0.34}
        cy={py + pupil * 0.42}
        r={pupil * 0.17}
        fill="#FFFFFF"
        fillOpacity={0.8}
        stroke="none"
      />
    </>
  );
};

/** A closed lid. A curve, never a straight bar — a bar reads as a scowl. */
const Lid: React.FC<{ cx: number; cy: number; lift?: number }> = ({ cx, cy, lift = 5 }) => (
  <path
    d={`M${cx - 5} ${cy} Q${cx} ${cy - lift} ${cx + 5} ${cy}`}
    fill="none"
    stroke="#1B1533"
    strokeWidth="2.6"
    strokeLinecap="round"
  />
);

/** Both eyes, as the pair each expression wears. */
const EYES: Record<ExpressionName, React.ReactNode> = {
  neutral: (
    <>
      <Eye cx={38} cy={45} />
      <Eye cx={62} cy={45} />
    </>
  ),
  blink: (
    <>
      <Lid cx={38} cy={46} />
      <Lid cx={62} cy={46} />
    </>
  ),
  surprised: (
    <>
      <Eye cx={38} cy={43} rx={6.6} ry={8} pupil={4.4} />
      <Eye cx={62} cy={43} rx={6.6} ry={8} pupil={4.4} />
    </>
  ),
  // Thinking happens somewhere other than at you: the pupils go up and away.
  pondering: (
    <>
      <Eye cx={38} cy={45} look={[0.9, -0.8]} />
      <Eye cx={62} cy={45} look={[0.9, -0.8]} />
    </>
  ),
  talkClosed: (
    <>
      <Eye cx={38} cy={45} />
      <Eye cx={62} cy={45} />
    </>
  ),
  talkOpen: (
    <>
      <Eye cx={38} cy={45} />
      <Eye cx={62} cy={45} />
    </>
  ),
  talkWide: (
    <>
      <Eye cx={38} cy={43} rx={5.6} ry={7} />
      <Eye cx={62} cy={43} rx={5.6} ry={7} />
    </>
  ),
  // Delight is eyes shut and smiling, so the lids arch up rather than down.
  delighted: (
    <>
      <Lid cx={38} cy={47} lift={6} />
      <Lid cx={62} cy={47} lift={6} />
    </>
  ),
};

/** The mouth each expression wears. */
const MOUTHS: Record<ExpressionName, React.ReactNode> = {
  neutral: <path d="M40 63 Q50 72 60 63" fill="none" strokeWidth="3.4" strokeLinecap="round" />,
  blink: <path d="M40 63 Q50 72 60 63" fill="none" strokeWidth="3.4" strokeLinecap="round" />,
  surprised: <ellipse cx="50" cy="66" rx="5" ry="6" />,
  /*
   * Thinking, not unhappy.
   *
   * This was "M43 66 Q50 63 57 67" — the control point above both ends, so in
   * SVG's downward-y the curve bowed up into a frown. A character that pulls a
   * sad face every time it thinks is telling a stuck child the wrong thing.
   * Now a small mouth, tipped slightly, which reads as considering.
   */
  pondering: <path d="M43 65 Q50 68.5 57 64" fill="none" strokeWidth="3.2" strokeLinecap="round" />,
  talkClosed: <path d="M43 65 Q50 69 57 65" fill="none" strokeWidth="3.4" strokeLinecap="round" />,
  talkOpen: <ellipse cx="50" cy="66" rx="6" ry="5.5" />,
  talkWide: <ellipse cx="50" cy="66" rx="7" ry="8.5" />,
  delighted: <path d="M38 61 Q50 74 62 61 Z" />,
};

export const KodaVectorFace: React.FC<KodaVectorFaceProps> = ({
  expression,
  color,
  openness,
  className = "",
  title,
}) => {
  /*
   * A live voice drives the mouth directly.
   *
   * `openness` is Koda's own volume, so the mouth follows the sound rather than
   * a fixed cycle. Scaled about its own centre, so it opens downward and upward
   * together instead of sliding down the chin.
   */
  const mouthScale = openness === undefined ? 1 : 0.55 + openness * 0.95;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={HEAD} fill={color} />
      {/* Eyes bring their own colours; the mouth inherits the light one here. */}
      <g fill="#FFFFFF" stroke="#FFFFFF">
        {EYES[expression]}
        <g
          style={{ transform: `scaleY(${mouthScale})`, transformOrigin: "50px 66px" }}
        >
          {MOUTHS[expression]}
        </g>
      </g>
    </svg>
  );
};
