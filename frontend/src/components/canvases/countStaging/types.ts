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

/**
 * Every way of counting the engine can stage.
 *
 * An array rather than a bare union so non-React consumers — the AI schema, the
 * Studio picker, the ladder's tests — can enumerate them without importing a
 * staging module and dragging artwork in with it. The union is derived from it,
 * so the two can never disagree about what exists.
 */
export const COUNT_STAGING_IDS = [
  "move",
  "tap",
  "lineup",
  "container",
  "tens",
  "counton",
  "countback",
  "arrangements",
  "skipcount"
] as const;

export type CountStagingId = (typeof COUNT_STAGING_IDS)[number];

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
   *
   * `readout` is neither: a band that reports the activity back to the child and
   * never holds an object. Count Back's countdown is one — "8 → 7 → 6", the
   * numbers being said out loud, which is the whole skill rather than decoration.
   * The engine keeps a readout out of the drop test entirely, so a release over
   * it is a release over nothing.
   */
  role: "home" | "target" | "readout";
  /** Hint shown while the zone is empty. Omit when the zone says it itself. */
  emptyHint?: (ctx: StagingLabelContext) => string | undefined;
  /**
   * Inline `flex` for a band that must not share the stage equally.
   *
   * Two bins split the stage down the middle, which is right when both hold
   * objects and wrong for a one-line readout. Given as flex rather than a
   * measured height so it stays a layout decision, not a second measurement
   * pass the engine would have to keep in step.
   */
  flex?: string;
  /**
   * What a `readout` band shows. Ignored for zones that hold objects.
   *
   * The staging draws it because the staging is the only thing that knows what
   * the activity is reporting; the engine still owns the bin around it, so a
   * readout wears exactly the chrome every other zone does.
   */
  Content?: React.FC<ZoneContentProps>;
}

export interface ZoneContentProps {
  items: CountItem[];
  /** Objects on the board. */
  count: number;
  /** Acts that finish the activity — see `CountStaging.goal`. */
  goal: number;
  /** Acts performed so far. */
  done: number;
  config: StagingConfig;
  isDark: boolean;
}

export interface StagingLabelContext {
  count: number;
  counted: number;
  remaining: number;
  objectLabel: string;
  /**
   * The slide, so anything that speaks can name the setting it is talking about.
   *
   * Skip Count needs its bundle size in almost every line it writes; without
   * this it had to divide the total by the number of bundles to recover a number
   * it already knew — arithmetic that is correct right up until a default moves.
   */
  config: StagingConfig;
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
  /**
   * Same flag `layout` and `slots` get.
   *
   * A staging whose arrangement changes when the zones stack has to test drops
   * against the arrangement it *drew*, and re-deriving that from `stage.width`
   * here means two copies of the breakpoint that can drift apart — a drop test
   * disagreeing with the visible cells is invisible in code and obvious to a
   * child whose object springs back.
   */
  stacked: boolean;
  config: StagingConfig;
}

/**
 * What acting on an object did.
 *
 * Three outcomes, not two, and the third is the one that was missing. `null`
 * used to mean both "nothing happens" and "no, not that one" — so tapping an
 * already-counted object in One-to-One, which is a child confirming what they
 * just did, produced the same result as dropping onto a taken slot in Line Up,
 * which is a rule being broken. The engine can only tell a child apart what a
 * staging tells apart.
 *
 *   - an object  the board changes
 *   - `"refused"` the activity does not allow this, and the child should see so
 *   - `null`     nothing to do; no feedback, because nothing happened
 *
 * The engine puts a refused object back where it belongs without the staging
 * having to say where, and shakes it on the way.
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
} | "refused" | null;

/** A dashed target the engine draws behind the objects, e.g. Line Up's slots. */
export interface SlotMarker {
  index: number;
  x: number;
  y: number;
  /** Shown inside the marker — the slot's number. */
  label?: string;
  /**
   * The one place a child may fill next, for a staging that insists on order.
   *
   * Group in Tens does: a ten-frame is read by its shape, and a frame filled
   * 1, 4, 9, 2 has no shape to read. Refusing the other cells without saying
   * which one is right teaches nothing, so the engine draws this one solid.
   */
  next?: boolean;
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
   * Artwork drawn inside the target zone — Magnets' jar, Group in Tens' frames.
   *
   * Decoration only. A drawing is never a drop target: the *zone* is what a
   * release is tested against, and the drawing sits inside it. Conflating the
   * two is how a basket ended up catching objects by a hardcoded radius.
   *
   * `count`, `size` and `stacked` come along because artwork that has to line up
   * with the objects needs the same inputs the objects were placed from — Group
   * in Tens draws one outline per ten, on the very geometry its cells use, and a
   * drawing computed from anything else drifts off the cells at some stage size.
   */
  Decoration?: React.FC<{
    zone: Rect;
    config: StagingConfig;
    isDark: boolean;
    count: number;
    size: number;
    stacked: boolean;
  }>;

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

  /**
   * How many objects the board has, when the slide's `targetCount` is not it.
   *
   * Count On is authored as `baseCount` + `extraCount` and carries no
   * `targetCount` at all, so the engine cannot get the number from the question
   * alone. Returning `targetCount` unchanged is the default, and every staging
   * that counts a plain total simply omits this.
   */
  objectCount?(config: StagingConfig, targetCount: number): number;

  /**
   * How many objects start already counted, from the front of the board.
   *
   * Count On begins with a group the child does *not* recount — five in the box,
   * numbered 1..5 — and counts on from six. Those objects are counted before the
   * child touches anything, which no other staging needs, so the default is
   * none. The engine seeds and ranks them; a staging only says how many.
   *
   * They are the first `n` items by creation order, so `layout` can rely on
   * `item.index < n` meaning "part of the group we started with".
   */
  seedCounted?(config: StagingConfig, count: number): number;

  /**
   * How many acts finish the activity, when that is not "all of them".
   *
   * Every staging but one counts *toward* the board: eight objects, eight acts.
   * Count Back has eight objects and three acts — it crosses three out and stops
   * — so `count` and "what finishes it" stop being the same number, and the
   * tally, the chip, the footer and the default completion test all need the
   * second one. Defaults to `count`, which is why the other stagings never
   * mention it.
   */
  goal?(config: StagingConfig, count: number): number;

  /**
   * The number the answer panel checks, when it is not the object count.
   *
   * Count Back asks for what is *left* — `total − removed` — which is the one
   * number never marked on the board. Defaults to `count`.
   */
  expectedAnswer?(config: StagingConfig, count: number): number;

  /**
   * What this staging calls what the child is doing.
   *
   * The engine says "counted" and "to count" in five places. That is right for
   * five stagings and wrong for Count Back, which crosses out. Each entry
   * defaults to the counting wording, so a staging overrides only the lines that
   * would otherwise lie.
   */
  copy?: Partial<StagingCopy>;

  /**
   * How a counted object reads.
   *
   * `badge` is the default: a numbered chip, because the number is the point.
   * `struck` is for an act that takes an object *out* of the count — it is
   * struck through and dimmed, and wears no number, because a crossed-out object
   * is not the seventh of anything.
   */
  countedAppearance?: "badge" | "struck";

  /**
   * The one object the child should act on next, if the activity is ordinal.
   *
   * Counting back is: the last object goes first, then the one before it. A
   * board that accepts any tap teaches the opposite, and one that silently
   * refuses the wrong tap teaches nothing at all — so the staging names the next
   * object and the engine rings it. Returning `null` (the default) means any
   * object may be acted on, which is true of every other staging.
   */
  emphasise?(items: CountItem[], count: number, goal: number): string | null;

  /**
   * What a counted object wears, when its ordinal is not the number to show.
   *
   * Skip Count badges the running total — 5, 10, 15 — because the number a child
   * says over the third bundle is "fifteen", not "three". Defaults to the
   * ordinal itself, which is what counting one at a time means.
   */
  badgeFor?(order: number, config: StagingConfig): string;

  /**
   * Artwork for one object, where an object is not a single thing.
   *
   * Skip Count's objects are bundles, and a bundle drawn as one apple wearing a
   * "10" teaches a child to multiply rather than to skip count — the quantity
   * has to be on the screen. `Art` arrives pre-bound to whatever the slide chose,
   * so a staging decides how many and where without knowing anything about asset
   * types or emoji.
   */
  ItemArt?: React.FC<{
    item: CountItem;
    /** Edge length of the object's box, in px. */
    size: number;
    /** This slide's artwork, ready to draw at any size. */
    Art: React.FC<{ size: number }>;
    config: StagingConfig;
    isDark: boolean;
  }>;

  /** Instruction shown when the child has been idle, and read aloud. */
  guidance(ctx: StagingLabelContext): string;
}

/**
 * Everything a staging says about its own progress.
 *
 * Context carries both totals on purpose: `count` is how many objects there are
 * and `goal` is how many acts finish it, and the two differ exactly where this
 * interface earns its keep.
 */
export interface StagingCopyContext extends StagingLabelContext {
  /** Acts that finish the activity. */
  goal: number;
  /** Acts performed so far. */
  done: number;
  /** What the answer panel expects. */
  expected: number;
}

export interface StagingCopy {
  /** Header chip while working — "3 to count", "2 to cross out". */
  todo(ctx: StagingCopyContext): string;
  /** Header chip once finished — "All counted", "5 left". */
  finished(ctx: StagingCopyContext): string;
  /** Footer line while working. */
  status(ctx: StagingCopyContext): string;
  /** Footer line once finished. */
  statusFinished(ctx: StagingCopyContext): string;
  /** The answer panel's question. */
  prompt(ctx: StagingCopyContext): string;
  /** The answer panel's "not quite" line. */
  wrong(ctx: StagingCopyContext): string;
  /** Screen-reader label for an object that has been acted on. */
  actedLabel(ctx: StagingCopyContext, order: number | null): string;
}

/** Counting's own words — what every staging gets unless it says otherwise. */
export const COUNTING_COPY: StagingCopy = {
  todo: ctx => `${ctx.remaining} to count`,
  finished: () => "All counted",
  status: ctx => `${ctx.done} of ${ctx.goal} counted`,
  statusFinished: ctx => `All ${ctx.goal} counted!`,
  prompt: ctx => `How many ${ctx.objectLabel}${ctx.count === 1 ? "" : "s"} in total?`,
  wrong: ctx =>
    `Not quite! There are ${ctx.expected} ${ctx.objectLabel}${ctx.expected === 1 ? "" : "s"}. Enter ${ctx.expected}!`,
  actedLabel: (ctx, order) => `Counted ${ctx.objectLabel}, number ${order} of ${ctx.count}.`
};

/**
 * The activity's acts are done — the default for stagings that don't override it.
 *
 * Takes the *goal*, not the object count. They are the same number for every
 * staging that counts the whole board, and for Count Back they are eight objects
 * and three crossings — which is why this is the default there too rather than
 * an override.
 */
export const allCounted = (items: CountItem[], goal: number) =>
  goal > 0 && items.filter(item => item.counted).length === goal;
