/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The counting staging contract.
 *
 * Nine components in this codebase teach *count these objects* and differ in one
 * thing only: what counting physically is. Tap each object where it lies. Drag
 * each into a second bin. Drop each into a numbered slot. Pile them into a jar.
 * Group them into tens. Everything else — sizing, motion, bins, the answer
 * panel, CPA, the ghost guide, badges, sounds, the keyboard path — is the same
 * activity wearing different clothes, and was copied nine times.
 *
 * So a staging owns exactly four decisions:
 *
 *   1. `zones`     — what bins exist (none means the objects live on open stage)
 *   2. `layout`    — the object size, and where each object rests
 *   3. `resolve`   — what acting on an object means
 *   4. `isComplete`— when the activity is finished
 *
 * Everything else belongs to the engine (`CountCanvas`), and deliberately so.
 * Re-ranking in particular: a staging never assigns a count order, because
 * "place the one object that moved" is precisely the bug that put two objects
 * on the same spot wearing the same badge in the canvas this replaces. The
 * engine re-ranks whole zones, once, for every staging.
 *
 * Adding a staging is adding a file and a ladder row. It is never an edit to
 * the engine.
 */

import type React from "react";
import type { Rect } from "../objectLayout";
import type { Point } from "../oneToOneLayout";

export type CountStagingId = "tap" | "move" | "lineup" | "container" | "tens";

/** Zones are addressed by name so a staging reads as itself, not as `zones[1]`. */
export type ZoneId = string;

/**
 * A bin the engine should render and measure.
 *
 * Chrome comes from `CanvasBin` — a staging never draws bin chrome itself, which
 * is what stopped nine canvases from agreeing on what a bin looks like.
 */
export interface ZoneDeclaration {
  id: ZoneId;
  /** Child-facing when `learnerMode`, else the quiet mono caption. */
  label: string;
  learnerLabel: string;
  /**
   * Where uncounted objects start (`home`) and where counted ones end up
   * (`target`). A staging with no `target` counts objects in place.
   */
  role: "home" | "target";
  /** Hint shown while the zone is empty. Omit when the zone says it itself. */
  emptyHint?: (ctx: StagingLabelContext) => string | undefined;
}

export interface StagingLabelContext {
  count: number;
  counted: number;
  remaining: number;
  objectLabel: string;
}

/** One object on the board. Position is derived, never stored by a staging. */
export interface CountItem {
  id: string;
  /** Creation order, stable for the life of the question. */
  index: number;
  counted: boolean;
  /** 1..n within the counted set, assigned by the engine. */
  order: number | null;
}

export interface StagingConfig {
  /** The slide's `question.config`, for staging-specific options. */
  [key: string]: unknown;
}

export interface LayoutInput {
  count: number;
  stage: { width: number; height: number };
  /** True when the stage is narrow enough that zones stack instead of sitting side by side. */
  stacked: boolean;
  /** Measured content rects of the declared zones, empty until the first measure. */
  zones: Partial<Record<ZoneId, Rect>>;
  items: CountItem[];
  config: StagingConfig;
}

export interface LayoutResult {
  /** The board's default object size. */
  size: number;
  /** Resting position per item id. An id may be omitted while unmeasured. */
  positions: Record<string, Point>;
  /**
   * Per-item size, where a zone changes how big an object is.
   *
   * A container makes objects smaller as they go in, not before: an apple
   * waiting on the shelf is the shared counting size — the same apple the child
   * just saw in Move & Count — and it shrinks on the drop, where a child reads
   * it as "it went in". Sizing everything to the jar's mouth made the loose
   * apples half the size they should be.
   */
  sizes?: Record<string, number>;
}

export interface ResolveInput {
  item: CountItem;
  /**
   * The zone the object was released over, or `null` for a tap and for a
   * release that landed on no zone at all.
   */
  zone: ZoneId | null;
  /**
   * Where the object's centre was released, in stage pixels — `null` for a tap.
   *
   * A zone is not always fine-grained enough: Line Up has to know *which* slot
   * the child aimed at, and a container has to know whether the object actually
   * reached the jar's mouth.
   */
  point: Point | null;
  /** True when the gesture was a tap rather than a drag. */
  tapped: boolean;
  items: CountItem[];
  count: number;
  /** The object size the board is currently laid out at. */
  size: number;
  /** Measured zone rects, for stagings that place within a zone. */
  zones: Partial<Record<ZoneId, Rect>>;
  stage: { width: number; height: number };
  config: StagingConfig;
}

/**
 * The new counted state, or `null` to leave the board untouched.
 *
 * Returning `null` is how a staging refuses a move — an already-counted object
 * in One-to-One, a drop on an occupied slot in Line Up — and the engine puts
 * the object back where it belongs without the staging having to say where.
 */
export type ResolveResult = {
  counted: boolean;
  /**
   * The 1-based position this object takes in the count.
   *
   * Only meaningful when the staging sets `ordersByPlacement`: in Line Up the
   * slot a child chose *is* the number, so arrival order would be wrong. Left
   * undefined, the engine ranks by arrival.
   */
  at?: number;
} | null;

/** A dashed target the engine draws behind the objects, e.g. Line Up's slots. */
export interface SlotMarker {
  index: number;
  x: number;
  y: number;
  /** Shown inside the marker — the slot's number. */
  label?: string;
}

export interface CountStaging {
  id: CountStagingId;

  /** Bins to render, in render order. Empty means the open stage. */
  zones(config: StagingConfig): ZoneDeclaration[];

  /**
   * Size and resting positions, computed together.
   *
   * Together because they are circular: a pattern places centres, but an object
   * hangs half its width past its centre, so the size decides the usable area
   * and the area decides the size. Splitting them is what produced objects that
   * overlapped at the edges.
   */
  layout(input: LayoutInput): LayoutResult;

  /** What acting on this object means. */
  resolve(input: ResolveInput): ResolveResult;

  /** Dashed targets drawn behind the objects. Omit when there is nothing to aim at. */
  slots?(input: LayoutInput & { size: number }): SlotMarker[];

  /**
   * Artwork drawn inside the target zone — Magnets' jar, basket or box.
   *
   * Decoration only. A drawing is never a drop target: the *zone* is what a
   * release is tested against, and the drawing sits inside it. Conflating the
   * two is how a basket ended up catching objects by a hardcoded radius.
   */
  Decoration?: React.FC<{ zone: Rect; config: StagingConfig; isDark: boolean }>;

  /** Whether counting has finished. Defaults to "every object is counted". */
  isComplete?(items: CountItem[], count: number): boolean;

  /**
   * Whether the staging assigns the count order itself, via `resolve().at`.
   *
   * Line Up does: the slot a child drops into is the number, so an object put in
   * slot 5 is the fifth however many went before it. Everything else ranks by
   * arrival, and the engine re-ranks whole zones to keep 1..n contiguous.
   */
  ordersByPlacement?: boolean;

  /**
   * How the zones flow. `auto` puts them side by side on a wide stage and
   * stacks them on a narrow one; `column` always stacks, for stagings whose
   * bands are read top-to-bottom.
   */
  orientation?: "auto" | "column";

  /**
   * Whether counting an object relocates it.
   *
   * Tap counts in place, so a counted object must not be re-slotted; Move sends
   * it to the other bin. The engine needs this to know whether a re-rank should
   * move anything.
   */
  movesOnCount: boolean;

  /** Instruction shown when the child has been idle, and read aloud. */
  guidance(ctx: StagingLabelContext): string;
}

/** Every object counted — the default for stagings that don't override it. */
export const allCounted = (items: CountItem[], count: number) =>
  count > 0 && items.filter(item => item.counted).length === count;
