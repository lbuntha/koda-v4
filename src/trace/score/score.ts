/**
 * Scoring a child's ink against a trace item — per stroke, then overall.
 * Pure and deterministic: runs on the device, offline, no AI.
 * See docs/TRACE_STUDIO_BUILD_PLAN.md §2.
 *
 * Each stroke passes gates first (it started in the right place, went the
 * right way, passed every checkpoint, covered the stroke). A stroke that fails
 * a gate is not accepted — the child redoes it and is told why. Only an
 * accepted stroke gets a 0–100 score, from how close it stayed and how much
 * it covered.
 */

import { strokePolyline } from "../geometry/bezier";
import { withCheckpoints } from "../geometry/checkpoints";
import type { Nearest, Track } from "../geometry/polyline";
import { centroid, nearest, nearestWithin, pointAt, polylineLength, resample, signedArea, track } from "../geometry/polyline";
import type { Point, StepId, Stroke, StrokeShape, TraceItem, Zone } from "../geometry/types";
import { isGuidedStep, modeOf } from "../geometry/types";
import { clamp, dist } from "../geometry/vec";
import type { Transform } from "./fitInk";
import { applyTransform, fitInk } from "./fitInk";
import { assign, dtw } from "./match";
import type { ToleranceOptions } from "./tolerance";
import { radius } from "./tolerance";

export type Fault =
  | "unfit" // nothing that can be read as the item: too little ink, too few strokes
  | "scribble" // far too much ink, or back and forth
  | "order" // a stroke written before the one that comes first
  | "missing" // a stroke never written
  | "direction" // the right path, the wrong way
  | "start" // began away from the start
  | "checkpoint" // skipped a part in the middle (a loop not closed, a hook not curled)
  | "coverage" // stopped early
  | "placement" // a mark written on the wrong side of its letter
  | "path"; // accepted, but wobbly — advice, never a gate

/** Which fault to talk about first when several strokes have one. */
export const FAULT_PRIORITY: Fault[] = [
  "unfit",
  "scribble",
  "order",
  "direction",
  "start",
  "checkpoint",
  "coverage",
  "placement",
  // Below the rest: a stroke not reached because an earlier one needs fixing is not the news.
  "missing",
  "path",
];

export interface StrokeMeasures {
  startDistance: number;
  direction: "forward" | "reverse" | "unclear";
  checkpointsHit: number;
  checkpointsTotal: number;
  /** 0–1 share of the target's length the ink passed near. */
  coverage: number;
  /** Mean and 90th-percentile distance of the ink from the target, in units. */
  mean: number;
  p90: number;
  /** 0–1: 1 = right on the line. */
  pathScore: number;
  /** Ink far outside the band, as a share of the target's length. */
  extraInk: number;
  inkLength: number;
  targetLength: number;
  /** Times the ink turned back along the stroke. */
  reversals: number;
  /** The radius every measure used. */
  r: number;
}

export interface StrokeScore {
  accepted: boolean;
  score: number;
  fault?: Fault;
  measures: StrokeMeasures;
}

/* ------------------------------------------------------------------ targets */

export interface PreparedStroke {
  stroke: Stroke;
  index: number;
  dot: boolean;
  track: Track;
  samples: Point[];
  reversed: Point[];
  length: number;
  start: Point;
  end: Point;
  area: number;
  checkpoints: { t: number; point: Point }[];
  /** How much this stroke counts in the item score. */
  weight: number;
}

const SAMPLE = 8;
const DOT_WEIGHT = 40;

export function prepareStroke(stroke: Stroke, index: number): PreparedStroke {
  const dot = stroke.nodes.length === 1 || stroke.shape === "dot";
  const poly = strokePolyline(stroke, 0.25);
  const t = track(poly);
  const samples = dot ? poly : resample(poly, SAMPLE);
  // Pinned checkpoints plus fresh automatic ones — stored automatic ones may be stale.
  const ts = withCheckpoints(stroke).checkpoints.map((c) => c.t);
  return {
    stroke,
    index,
    dot,
    track: t,
    samples,
    reversed: [...samples].reverse(),
    length: t.length,
    start: poly[0],
    end: stroke.closed ? poly[0] : poly[poly.length - 1],
    area: signedArea(poly),
    checkpoints: dot ? [] : ts.map((c) => ({ t: c, point: pointAt(t, c * t.length) })),
    weight: dot ? DOT_WEIGHT : t.length,
  };
}

export const prepareItem = (item: TraceItem): PreparedStroke[] =>
  [...item.strokes].sort((a, b) => a.order - b.order).map((s, i) => prepareStroke(s, i));

/* ------------------------------------------------------------- one stroke */

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

/**
 * How far along the target each ink point is, following the hand rather than
 * jumping to whichever part of the line happens to be closest.
 *
 * A letter like ង passes close to itself — its head loop starts and ends at
 * one spot, and its right side runs up beside the middle — so the nearest
 * point of the line can be a part the child reached long ago, or has not
 * reached yet. Read that way, a clean trace "turned back" at every such place
 * and was called a scribble. Each point is placed near where the last one was,
 * unless somewhere else on the line is clearly closer: then the hand really
 * did go there.
 */
function progressAlong(target: PreparedStroke, ink: Point[], near: Nearest[], r: number): number[] {
  const out: number[] = [];
  let at = near[0]?.s ?? 0;
  for (let i = 0; i < ink.length; i++) {
    if (i > 0) {
      const step = dist(ink[i - 1], ink[i]);
      const local = nearestWithin(target.track, ink[i], at - step - r, at + step + 2 * r);
      at = local.dist <= near[i].dist + r ? local.s : near[i].s;
    }
    out.push(at);
  }
  return out;
}

function reversalsAlong(positions: number[], r: number): number {
  let dir = 0;
  let extreme = positions[0] ?? 0;
  let count = 0;
  for (const s of positions) {
    if (dir === 0) {
      if (Math.abs(s - positions[0]) > r) {
        dir = Math.sign(s - positions[0]);
        extreme = s;
      }
    } else if (dir > 0) {
      if (s > extreme) extreme = s;
      else if (extreme - s > r) {
        count++;
        dir = -1;
        extreme = s;
      }
    } else if (s < extreme) extreme = s;
    else if (s - extreme > r) {
      count++;
      dir = 1;
      extreme = s;
    }
  }
  return count;
}

function measureDot(target: PreparedStroke, ink: Point[], r: number): StrokeScore {
  const center = target.start;
  const reach = (target.stroke.radius ?? 20) + r;
  const d = dist(centroid([ink]), center);
  const inkLength = polylineLength(ink);
  const measures: StrokeMeasures = {
    startDistance: d,
    direction: "unclear",
    checkpointsHit: 0,
    checkpointsTotal: 0,
    coverage: d <= reach ? 1 : 0,
    mean: d,
    p90: d,
    pathScore: clamp(1 - d / reach, 0, 1),
    extraInk: 0,
    inkLength,
    targetLength: 0,
    reversals: 0,
    r,
  };
  if (inkLength > 4 * reach) return { accepted: false, score: 0, fault: "scribble", measures };
  if (d > reach) return { accepted: false, score: 0, fault: "start", measures };
  return { accepted: true, score: Math.round(100 * (1 - 0.5 * (d / reach))), measures };
}

/**
 * Compare one ink stroke with one target stroke, with tolerance radius `r`.
 * `free` = written with no guide (copy, memory): a stroke has started right
 * when it begins at its own start end — within 30% of its length — rather
 * than within a few units of a dot the child never saw.
 */
export function measureStroke(target: PreparedStroke, rawInk: Point[], r: number, free = false): StrokeScore {
  if (target.dot) return measureDot(target, rawInk, r);

  const inkTrack = track(rawInk.length > 1 ? resample(rawInk, 4) : rawInk);
  const ink = inkTrack.points;
  const near: Nearest[] = ink.map((p) => nearest(target.track, p));
  const distances = near.map((n) => n.dist).sort((a, b) => a - b);
  const mean = distances.reduce((a, b) => a + b, 0) / Math.max(1, distances.length);
  const p90 = percentile(distances, 0.9);

  let coveredCount = 0;
  for (const q of target.samples) {
    if (nearest(inkTrack, q).dist <= r) coveredCount++;
  }
  const coverage = coveredCount / Math.max(1, target.samples.length);

  let extra = 0;
  for (let i = 1; i < ink.length; i++) {
    if (near[i - 1].dist > 2 * r && near[i].dist > 2 * r) extra += dist(ink[i - 1], ink[i]);
  }
  const extraInk = target.length === 0 ? 0 : extra / target.length;

  let direction: StrokeMeasures["direction"] = "unclear";
  if (target.stroke.closed) {
    const inkArea = signedArea(ink);
    if (Math.abs(inkArea) >= 0.25 * Math.abs(target.area) && target.area !== 0) {
      direction = Math.sign(inkArea) === Math.sign(target.area) ? "forward" : "reverse";
    }
  } else {
    const sampled = resample(rawInk, SAMPLE);
    const forward = dtw(sampled, target.samples);
    const backward = dtw(sampled, target.reversed);
    if (backward < forward * 0.75) direction = "reverse";
    else if (forward < backward * 0.75) direction = "forward";
  }

  // Turning back by more than 2r counts; corners and wobble near the line don't.
  const reversals = target.stroke.closed ? 0 : reversalsAlong(progressAlong(target, ink, near, r), 2 * r);

  // Checkpoints, in order along the ink.
  const hits: boolean[] = [];
  let from = 0;
  for (const cp of target.checkpoints) {
    let found = -1;
    for (let i = from; i < ink.length; i++) {
      if (dist(ink[i], cp.point) <= r) {
        found = i;
        break;
      }
    }
    hits.push(found >= 0);
    if (found >= 0) from = found;
  }
  const hitCount = hits.filter(Boolean).length;
  const firstMiss = hits.indexOf(false);
  // Every miss after the last hit = the ink simply stopped early.
  const stoppedEarly = firstMiss >= 0 && hits.slice(firstMiss).every((h) => !h);

  const inkLength = inkTrack.length;
  const pathScore = clamp(1 - (0.7 * mean + 0.3 * p90) / r, 0, 1);
  const measures: StrokeMeasures = {
    startDistance: ink.length > 0 ? dist(ink[0], target.start) : Infinity,
    direction,
    checkpointsHit: hitCount,
    checkpointsTotal: hits.length,
    coverage,
    mean,
    p90,
    pathScore,
    extraInk,
    inkLength,
    targetLength: target.length,
    reversals,
    r,
  };

  const fail = (fault: Fault): StrokeScore => ({ accepted: false, score: 0, fault, measures });
  if (inkLength > 2.5 * target.length + 4 * r || reversals > 3) return fail("scribble");
  // Checked before start: a stroke drawn backwards also starts in the wrong place,
  // and "go the other way" is the more useful thing to hear.
  if (direction === "reverse") return fail("direction");
  const startLimit = free ? Math.max(1.5 * r, 0.3 * target.length) : 1.5 * r;
  const endDistance = ink.length > 0 ? dist(ink[0], target.end) : Infinity;
  if (measures.startDistance > startLimit || (free && !target.stroke.closed && endDistance < measures.startDistance)) return fail("start");
  if (firstMiss >= 0) return fail(stoppedEarly ? "coverage" : "checkpoint");
  if (coverage < 0.85) return fail("coverage");

  const score = Math.round(clamp(100 * (0.6 * pathScore + 0.4 * coverage) - Math.min(1, extraInk) * 40, 0, 100));
  return { accepted: true, score, measures };
}

/* ------------------------------------------------------------ an attempt */

export interface AttemptOptions extends ToleranceOptions {
  step: StepId;
  /** Default: strict for writing items, loose for drawing items. */
  orderMatters?: boolean;
}

export interface StrokeResult {
  order: number;
  accepted: boolean;
  /** 0–100; 0 when not accepted. Guided: −10 per failed try before it was accepted. */
  score: number;
  tries: number;
  fault?: Fault;
  /** Faults of failed tries, oldest first (guided steps). */
  faults: Fault[];
  /** Order fault: the stroke that should have come first. */
  expected?: number;
  /** Order fault in a guided step: the stroke the child drew instead. */
  drewInstead?: number;
  measures?: StrokeMeasures;
}

export interface Feedback {
  fault: Fault;
  /** The stroke badge to name. */
  order: number;
  /** Order fault: "that was stroke `order` — do `expected` first". */
  expected?: number;
  shape: StrokeShape;
}

export interface AttemptResult {
  accepted: boolean;
  score: number;
  stars: 0 | 1 | 2 | 3;
  strokes: StrokeResult[];
  /** Ink not matched to any stroke, as a share of the item's length. */
  extraInk: number;
  feedback: Feedback | null;
  /** Unguided steps: how the ink was moved onto the target. */
  transform?: Transform;
}

export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= 90 ? 3 : score >= 70 ? 2 : score >= 40 ? 1 : 0);

const rOf = (t: PreparedStroke, opts: AttemptOptions) => radius(t.stroke.width, opts);

/**
 * A `continue` pair can be written as one ink stroke: cut it where it passes
 * the join. Returns index ranges into `ink`, one per target from `j` on.
 */
export function splitContinued(ink: Point[], targets: PreparedStroke[], j: number, r: number): [number, number][] {
  const ranges: [number, number][] = [];
  let from = 0;
  let k = j;
  const cum = track(ink).cum;
  // Only cut when the ink ends where a later stroke of the chain ends — a
  // scribble over one stroke is that stroke's problem, not two strokes.
  const inkEnd = ink[ink.length - 1];
  const endsLater = (after: number) => {
    for (let m = after + 1; targets[m]?.stroke.join === "continue"; m++) {
      if (dist(inkEnd, targets[m].end) <= 2 * r) return true;
    }
    return false;
  };
  while (targets[k + 1]?.stroke.join === "continue" && endsLater(k)) {
    const t = targets[k];
    const remaining = cum[cum.length - 1] - cum[from];
    if (remaining < 1.3 * t.length) break;
    // Look for the join only past half this stroke's length, so a shape that
    // passes near its own end early on is not cut there.
    let best = -1;
    let bestDist = Infinity;
    for (let i = from + 1; i < ink.length - 1; i++) {
      if (cum[i] - cum[from] < 0.5 * t.length) continue;
      const d = dist(ink[i], t.end);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best < 0 || bestDist > 2 * r) break;
    ranges.push([from, best]);
    from = best;
    k++;
  }
  ranges.push([from, ink.length - 1]);
  return ranges;
}

const slice = (ink: Point[], [a, b]: [number, number]) => ink.slice(a, b + 1);

function emptyResults(targets: PreparedStroke[]): StrokeResult[] {
  return targets.map((t) => ({ order: t.stroke.order, accepted: false, score: 0, tries: 0, faults: [] }));
}

function finish(
  item: TraceItem,
  targets: PreparedStroke[],
  results: StrokeResult[],
  extraLength: number,
  transform?: Transform,
): AttemptResult {
  for (const r of results) {
    if (!r.accepted && !r.fault) r.fault = "missing";
  }
  const totalWeight = targets.reduce((a, t) => a + t.weight, 0) || 1;
  const totalLength = targets.reduce((a, t) => a + (t.dot ? DOT_WEIGHT : t.length), 0) || 1;
  const extraInk = extraLength / totalLength;
  const weighted = targets.reduce((a, t, i) => a + t.weight * (results[i].accepted ? results[i].score : 0), 0) / totalWeight;
  const score = Math.round(clamp(weighted - Math.min(1, extraInk) * 40, 0, 100));
  const accepted = results.every((r) => r.accepted);
  return {
    accepted,
    score,
    stars: accepted ? starsFor(score) : 0,
    strokes: results,
    extraInk,
    feedback: pickFeedback(item, results),
    transform,
  };
}

/**
 * Score one whole attempt. Guided steps (big, guided, faded) take the ink
 * stroke by stroke against the stroke the child is on — a failed stroke is
 * retried by the next ink. Unguided steps (copy, memory) fit the whole
 * drawing onto the item first, then pair strokes up.
 */
export function scoreAttempt(item: TraceItem, ink: Point[][], opts: AttemptOptions): AttemptResult {
  const targets = prepareItem(item);
  const orderMatters = opts.orderMatters ?? modeOf(item.kind) === "writing";
  const strokes = ink.filter((s) => s.length > 0);
  return isGuidedStep(opts.step)
    ? scoreGuided(item, targets, strokes, opts, orderMatters)
    : scoreUnguided(item, targets, strokes, opts, orderMatters);
}

function scoreGuided(
  item: TraceItem,
  targets: PreparedStroke[],
  ink: Point[][],
  opts: AttemptOptions,
  orderMatters: boolean,
): AttemptResult {
  const results = emptyResults(targets);
  let extra = 0;
  const current = () => results.findIndex((r) => !r.accepted);

  for (const raw of ink) {
    const k = current();
    if (k < 0) {
      extra += polylineLength(raw);
      continue;
    }
    const ranges = splitContinued(raw, targets, k, rOf(targets[k], opts));
    for (let p = 0; p < ranges.length; p++) {
      const piece = slice(raw, ranges[p]);
      const at = current();
      if (at < 0) {
        extra += polylineLength(piece);
        continue;
      }
      const target = targets[at];
      const result = results[at];
      const m = measureStroke(target, piece, rOf(target, opts));
      result.tries++;
      result.measures = m.measures;
      if (m.accepted) {
        result.accepted = true;
        result.fault = undefined;
        result.drewInstead = undefined;
        result.score = Math.max(0, m.score - 10 * (result.tries - 1));
        continue;
      }
      // Did the child draw a different stroke instead?
      let other = -1;
      for (let j = 0; j < targets.length; j++) {
        if (j === at || results[j].accepted) continue;
        if (measureStroke(targets[j], piece, rOf(targets[j], opts)).accepted) {
          other = j;
          break;
        }
      }
      if (other >= 0 && !orderMatters) {
        // Drawings: any order is fine — take it as that stroke.
        const o = results[other];
        const om = measureStroke(targets[other], piece, rOf(targets[other], opts));
        o.tries++;
        o.accepted = true;
        o.score = om.score;
        o.measures = om.measures;
        result.tries--; // not a failed try at the current stroke
        continue;
      }
      const fault: Fault = other >= 0 ? "order" : (m.fault ?? "path");
      result.fault = fault;
      result.faults.push(fault);
      result.drewInstead = other >= 0 ? targets[other].stroke.order : undefined;
      break; // the rest of this ink belongs to a failed try
    }
  }
  return finish(item, targets, results, extra);
}

const ZONE_TEST: Record<Exclude<Zone, "around">, (c: Point, b: { x: number; y: number; w: number; h: number }) => boolean> = {
  above: (c, b) => c.y < b.y + 0.25 * b.h,
  below: (c, b) => c.y > b.y + 0.75 * b.h,
  left: (c, b) => c.x < b.x + 0.25 * b.w,
  right: (c, b) => c.x > b.x + 0.75 * b.w,
};

function scoreUnguided(
  item: TraceItem,
  targets: PreparedStroke[],
  ink: Point[][],
  opts: AttemptOptions,
  orderMatters: boolean,
): AttemptResult {
  const results = emptyResults(targets);
  const inkLength = ink.reduce((a, s) => a + polylineLength(s), 0);
  const targetLength = targets.reduce((a, t) => a + t.length, 0);
  const lifts = targets.filter((t, i) => i === 0 || t.stroke.join === "lift").length;
  if (ink.length === 0 || inkLength < 0.3 * targetLength || ink.length < Math.ceil(lifts / 2)) {
    for (const r of results) r.fault = "unfit";
    return finish(item, targets, results, 0);
  }

  // Move and resize the ink onto the item. A mark is written beside a carrier
  // letter that stays on screen, so it keeps its size and angle; where it
  // landed is judged separately (placement), on the raw ink.
  const limits = item.carrier ? { rotation: 0, aspect: 0, scale: [0.85, 1.15] as [number, number] } : {};
  const { transform } = fitInk(
    ink.map((s) => resample(s, 16)),
    targets.map((t) => (t.dot ? t.samples : resample(t.samples, 16))),
    limits,
  );
  const fitted = ink.map((s) => s.map((p) => applyTransform(p, transform)));

  // Cut continued strokes, then pair every piece with a target stroke.
  const pieces: { fitted: Point[]; raw: Point[] }[] = [];
  fitted.forEach((stroke, i) => {
    const j = targets.findIndex((t, k) => targets[k + 1]?.stroke.join === "continue" && dist(stroke[0], t.start) <= 2 * rOf(t, opts));
    const ranges = j >= 0 ? splitContinued(stroke, targets, j, rOf(targets[j], opts)) : [[0, stroke.length - 1] as [number, number]];
    for (const range of ranges) pieces.push({ fitted: slice(stroke, range), raw: slice(ink[i], range) });
  });

  const cost = pieces.map(({ fitted: piece }) =>
    targets.map((t) => {
      const r = rOf(t, opts);
      if (t.dot) return dist(centroid([piece]), t.start) / r;
      const sampled = resample(piece, SAMPLE);
      return Math.min(dtw(sampled, t.samples), dtw(sampled, t.reversed)) / r;
    }),
  );
  const pairs = assign(cost, 3);

  let extra = 0;
  pieces.forEach((piece, i) => {
    const j = pairs[i];
    if (j < 0) {
      extra += polylineLength(piece.fitted);
      return;
    }
    const target = targets[j];
    const r = rOf(target, opts);
    // The whole letter is already laid onto the model; a single stroke may still
    // sit a little off in a child's own proportions. Nudge it onto its own part
    // of the model (at most 2r) — position is not marked here, shape is.
    const own = target.dot ? [target.start] : target.samples;
    const at = centroid([resample(piece.fitted, SAMPLE)]);
    const want = centroid([own]);
    let dx = want.x - at.x;
    let dy = want.y - at.y;
    const d = Math.hypot(dx, dy);
    if (d > 2 * r) {
      dx = (dx * 2 * r) / d;
      dy = (dy * 2 * r) / d;
    }
    const m = measureStroke(target, piece.fitted.map((p) => ({ x: p.x + dx, y: p.y + dy })), r, true);
    const result = results[j];
    result.tries = 1;
    result.measures = m.measures;
    result.accepted = m.accepted;
    result.score = m.accepted ? m.score : 0;
    result.fault = m.fault;
    const zone = target.stroke.zone ?? item.zone;
    if (result.accepted && item.carrier && zone && zone !== "around") {
      if (!ZONE_TEST[zone](centroid([piece.raw]), item.carrier.box)) {
        result.accepted = false;
        result.score = 0;
        result.fault = "placement";
      }
    }
  });

  if (orderMatters) {
    const written = new Set(pairs.filter((j) => j >= 0));
    const used = new Set<number>();
    for (const j of pairs) {
      if (j < 0) continue;
      const expected = targets.findIndex((_, k) => written.has(k) && !used.has(k));
      used.add(j);
      if (expected >= 0 && expected !== j && results[j].accepted) {
        results[j].accepted = false;
        results[j].score = 0;
        results[j].fault = "order";
        results[j].expected = targets[expected].stroke.order;
      }
    }
  }

  return finish(item, targets, results, extra, transform);
}

/** One thing to say: the highest-priority fault, on the earliest stroke; else a wobbly stroke; else nothing. */
export function pickFeedback(item: TraceItem, results: StrokeResult[]): Feedback | null {
  const shapeOf = (order: number) => item.strokes.find((s) => s.order === order)?.shape ?? "free";
  let best: StrokeResult | undefined;
  for (const r of results) {
    if (r.accepted || !r.fault) continue;
    if (!best || FAULT_PRIORITY.indexOf(r.fault) < FAULT_PRIORITY.indexOf(best.fault!)) best = r;
  }
  if (best?.fault) {
    if (best.fault === "order" && best.drewInstead !== undefined) {
      return { fault: "order", order: best.drewInstead, expected: best.order, shape: shapeOf(best.drewInstead) };
    }
    return { fault: best.fault, order: best.order, expected: best.expected, shape: shapeOf(best.order) };
  }
  let wobbly: StrokeResult | undefined;
  for (const r of results) {
    const p = r.measures?.pathScore ?? 1;
    if (r.accepted && p < 0.6 && (!wobbly || p < (wobbly.measures?.pathScore ?? 1))) wobbly = r;
  }
  return wobbly ? { fault: "path", order: wobbly.order, shape: shapeOf(wobbly.order) } : null;
}
