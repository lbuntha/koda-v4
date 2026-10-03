/**
 * Koda Trace — the shapes a child writes or draws.
 *
 * Everything is in a normalised square, 0–1000 on each axis, y pointing down,
 * so an item draws the same on a phone and a laptop and the scorer never sees
 * pixels. A stroke is one pen-down motion: a chain of cubic Béziers through
 * nodes. Nothing stores freehand pixels, which is what keeps strokes editable
 * and exactly measurable. See docs/TRACE_STUDIO_BUILD_PLAN.md §1.
 */

export interface Point {
  x: number;
  y: number;
}

/** A Bézier handle, relative to its node. */
export interface Handle {
  dx: number;
  dy: number;
}

/** How the path passes through a node — the Studio's "blend". */
export type NodeType = "corner" | "smooth" | "symmetric";

export interface TraceNode {
  x: number;
  y: number;
  type: NodeType;
  /** Handle toward the previous node; absent = the segment arrives straight. */
  in?: Handle;
  /** Handle toward the next node; absent = the segment leaves straight. */
  out?: Handle;
}

/** A hint for defaults and for wording feedback ("close the loop"). */
export type StrokeShape = "line" | "curve" | "hook" | "loop" | "dot" | "free";

/** Where a mark sits around its carrier letter. */
export type Zone = "above" | "below" | "left" | "right" | "around";

/** A point the ink must pass through, in order. `t` is 0–1 along the stroke's length. */
export interface Checkpoint {
  t: number;
  pinned: boolean;
}

export interface Stroke {
  id: string;
  /** 1…n — drives the badge (១ ២ ៣ or 1 2 3). */
  order: number;
  shape: StrokeShape;
  /** At least 2, except a dot, which has 1 and a radius. */
  nodes: TraceNode[];
  /** A loop: the last node joins back to the first. */
  closed: boolean;
  /** Pen up before this stroke, or one motion carrying on from the last. */
  join: "lift" | "continue";
  /** The band's width, in units. */
  width: number;
  /** A dot's radius, in units. */
  radius?: number;
  /** For a mark's stroke: where it belongs around the carrier. Falls back to the item's zone. */
  zone?: Zone;
  checkpoints: Checkpoint[];
  /** Strokes sharing a group id move, resize and copy together in the Studio. Writing order stays per stroke. */
  group?: string;
  /** Where the number badge sits, relative to the stroke's start. Absent = placed automatically. */
  badge?: { dx: number; dy: number };
  /** Content, read aloud: "Start at the top, go down." */
  instruction?: string;
}

export type TraceKind = "line" | "drawing" | "letter" | "mark" | "numeral" | "word";

/** Writing earns "can write" (strict order); drawing earns "can draw" (order loose). */
export type TraceMode = "writing" | "drawing";

export const modeOf = (kind: TraceKind): TraceMode => (kind === "line" || kind === "drawing" ? "drawing" : "writing");

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TraceItem {
  id: string;
  rev: number;
  /** Content: "ច", "7", "Loop", "Cat". */
  title: string;
  kind: TraceKind;
  script?: "khmer" | "latin";
  /** Stroke numbers as ១ ២ ៣ or 1 2 3. Absent = follow the script. */
  numerals?: "khmer" | "latin";
  grid: "none" | "3x3" | "4x3-moeys" | "baseline-4-lines" | "dots";
  strokes: Stroke[];
  sensitivity: Sensitivity;
  /** A mark (foot, vowel, sign) is written around a faded base letter that is not scored. */
  carrier?: { text: string; box: Box };
  zone?: Zone;
  /** What the admin traced over in the Studio: a typed glyph and/or a picture (e.g. a book page crop). */
  guide?: TraceGuide;
  /** A recording of the item said aloud (its name or sound): a library clip id, played by the learner's speaker button. */
  voice?: string;
  /** What the recording says when it is more than the title ("ក — ក្អែក"). Absent = the title. */
  voiceText?: string;
}

export interface TraceGuide {
  glyph?: { text: string; size: number; x: number; y: number; hidden?: boolean };
  image?: { src: string; x: number; y: number; w: number; h: number; opacity: number; hidden?: boolean };
}

export type Sensitivity = "relaxed" | "balanced" | "strict";

export type StepId = "watch" | "big" | "guided" | "faded" | "copy" | "memory";

/** Same bands as Library: A ≈ 4–6, B ≈ 7–9, C ≈ 10+. */
export type AgeBand = "A" | "B" | "C";

/** Steps with the model on the canvas: the expected stroke is known. */
export const isGuidedStep = (step: StepId) => step === "watch" || step === "big" || step === "guided" || step === "faded";
