/**
 * Publish checks, run live in the Studio (and on the server from Phase 3).
 * Each check names what is wrong and, where it can, which stroke.
 * See docs/TRACE_STUDIO_BUILD_PLAN.md §5.
 */

import { strokePolyline } from "../geometry/bezier";
import { polylineLength } from "../geometry/polyline";
import type { TraceItem } from "../geometry/types";
import { activityOf, hasArt } from "../geometry/types";
import { labelAreas, stepAreas } from "../paint/areas";
import { dist } from "../geometry/vec";
import { prepareItem } from "../score/score";
import type { TraceDraft } from "./drafts";
import { strokesPrint } from "./drafts";

export type CheckId =
  | "hasTitle"
  | "hasStrokes"
  | "strokeNodes"
  | "strokeLength"
  | "orders"
  | "insideCanvas"
  | "continueTouches"
  | "planEndsAtCanDo"
  | "tested"
  | "hasLineArt"
  | "paintSteps"
  | "paintAreas"
  | "paintShared";

export interface CheckResult {
  id: CheckId;
  ok: boolean;
  /** Strokes (by order) that fail it — or, for a paint check, colour steps (1, 2, 3…). */
  strokes?: number[];
  /** Steps still to test. */
  steps?: string[];
}

const MIN_LENGTH = 40;
const TOUCH = 18;

export function runChecks(draft: TraceDraft): CheckResult[] {
  const item: TraceItem = draft.item;
  const sorted = [...item.strokes].sort((a, b) => a.order - b.order);
  const bad = (pred: (i: number) => boolean) => sorted.flatMap((s, i) => (pred(i) ? [s.order] : []));

  const fewNodes = bad((i) => {
    const s = sorted[i];
    return s.shape === "dot" ? s.nodes.length !== 1 : s.nodes.length < 2;
  });
  const short = bad((i) => sorted[i].shape !== "dot" && polylineLength(strokePolyline(sorted[i])) < MIN_LENGTH);
  const outside = bad((i) => sorted[i].nodes.some((n) => n.x < 0 || n.y < 0 || n.x > 1000 || n.y > 1000));
  const prepared = prepareItem(item);
  const loose = bad((i) => i > 0 && sorted[i].join === "continue" && dist(prepared[i - 1].end, prepared[i].start) > TOUCH);

  if (activityOf(item) === "color") {
    // A colouring item: line art and colour steps, no writing steps to test.
    const steps = item.paint?.steps ?? [];
    const areas = labelAreas(item);
    const sets = steps.map((st) => stepAreas(areas, st));
    const empty = sets.flatMap((a, k) => (a.size === 0 ? [k + 1] : []));
    const seen = new Map<number, number>();
    const shared = new Set<number>();
    sets.forEach((a, k) =>
      a.forEach((l) => {
        if (seen.has(l)) {
          shared.add(seen.get(l)! + 1);
          shared.add(k + 1);
        } else seen.set(l, k);
      }),
    );
    return [
      { id: "hasTitle", ok: item.title.trim().length > 0 },
      { id: "hasLineArt", ok: hasArt(item) },
      { id: "strokeNodes", ok: fewNodes.length === 0, strokes: fewNodes },
      { id: "insideCanvas", ok: outside.length === 0, strokes: outside },
      { id: "paintSteps", ok: steps.length > 0 },
      { id: "paintAreas", ok: empty.length === 0, strokes: empty },
      { id: "paintShared", ok: shared.size === 0, strokes: [...shared].sort((a, b) => a - b) },
    ];
  }

  const print = strokesPrint(item);
  const untested = draft.plan.steps
    .map((s) => s.id)
    .filter((step) => {
      const test = draft.tests[step];
      const rule = draft.plan.steps.find((s) => s.id === step)!;
      return !test || test.strokes !== print || !test.accepted || test.score < rule.pass;
    });

  return [
    { id: "hasTitle", ok: item.title.trim().length > 0 },
    { id: "hasStrokes", ok: sorted.length > 0 },
    { id: "strokeNodes", ok: fewNodes.length === 0, strokes: fewNodes },
    { id: "strokeLength", ok: short.length === 0, strokes: short },
    { id: "orders", ok: sorted.every((s, i) => s.order === i + 1) },
    { id: "insideCanvas", ok: outside.length === 0, strokes: outside },
    { id: "continueTouches", ok: loose.length === 0, strokes: loose },
    { id: "planEndsAtCanDo", ok: draft.plan.steps.some((s) => s.id === draft.plan.canDoAt) && draft.plan.steps[draft.plan.steps.length - 1]?.id === draft.plan.canDoAt },
    { id: "tested", ok: untested.length === 0, steps: untested },
  ];
}

export const allPass = (checks: CheckResult[]) => checks.every((c) => c.ok);
