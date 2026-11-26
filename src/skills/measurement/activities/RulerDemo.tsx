import React from "react";
import type { DemoPhase, DemoStep } from "../../kit";
import { tx } from "../internal/i18n";
import { CM_RULER, type RulerMode } from "../internal/ruler";
import { ThingArt } from "./things";
import { DrawnLine, RulerStrip, wPct, xPct } from "./ruler";

/**
 * How to play for RulerDesk, on the real ruler strip.
 *
 *   read:  a 7 cm pencil from 0; find 0, look at the end, it is 7 cm.
 *   place: a 5 cm crayon off the ruler; tap it, tap the 0 (not the edge); 5 cm.
 *   draw:  tap the 6 mark; the line draws from 0 to 6.
 *
 * The values are fixed so the captions can name them; `rulerDemoFacts` is
 * checked by a test against the captions.
 */

export type RulerDemo = "read" | "place" | "draw";

export const rulerDemoFacts = () => ({ read: 7, place: 5, draw: 6 });

/** The demo a lesson opens with, by its first mode. Other modes reuse what these taught. */
export const rulerDemoFor = (mode: RulerMode): RulerDemo | null =>
  mode === "read" ? "read" : mode === "place" ? "place" : mode === "draw" ? "draw" : null;

const frame = "absolute inset-0 flex flex-col justify-center gap-1 overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-3";
const done = (step: number, phase: DemoPhase, s: number) => step > s || (step === s && phase === "done");
/** Hand positions are fractions of the scene; the ruler sits a little below the middle. */
const atMark = (cm: number) => 0.04 + (xPct(CM_RULER, cm * CM_RULER.sub) / 100) * 0.92;

export function rulerDemoSteps(demo: RulerDemo): DemoStep[] {
  const f = rulerDemoFacts();
  if (demo === "read")
    return [
      { caption: tx("demo4.readIntro"), holdMs: 1800 },
      { caption: tx("demo4.readZero"), hand: [[atMark(0), 0.66]], moveMs: 900 },
      { caption: tx("demo4.readEnd"), hand: [[atMark(f.read), 0.66]], moveMs: 900 },
      { caption: tx("demo4.readAnswer"), holdMs: 2400 },
    ];
  if (demo === "place")
    return [
      { caption: tx("demo4.placeIntro"), holdMs: 1800 },
      { caption: tx("demo4.placeTap"), hand: [[atMark(3), 0.38]], moveMs: 900 },
      { caption: tx("demo4.placeZero"), hand: [[atMark(0), 0.66]], moveMs: 900 },
      { caption: tx("demo4.placeRead"), holdMs: 2600 },
    ];
  return [
    { caption: tx("demo4.drawIntro"), holdMs: 1800 },
    { caption: tx("demo4.drawTap"), hand: [[atMark(f.draw), 0.66]], moveMs: 900 },
    { caption: tx("demo4.drawDone"), holdMs: 2400 },
  ];
}

export const RulerDemoScene: React.FC<{ demo: RulerDemo; step: number; phase: DemoPhase; motionOK: boolean }> = ({ demo, step, phase, motionOK }) => {
  const f = rulerDemoFacts();
  const spec = CM_RULER;
  if (demo === "draw") {
    return (
      <div className={frame} data-testid="ruler-demo">
        <DrawnLine spec={spec} to={done(step, phase, 1) ? f.draw : null} motionOK={motionOK} />
        <RulerStrip spec={spec} />
      </div>
    );
  }
  const cm = demo === "read" ? f.read : f.place;
  const placed = demo === "read" || done(step, phase, 2);
  const held = demo === "place" && done(step, phase, 1) && !placed;
  const from = placed ? 0 : 1.5 * spec.sub;
  return (
    <div className={frame} data-testid="ruler-demo">
      <div className="relative h-9">
        <div
          className={`absolute inset-y-0 transition-[left] duration-500 ${held ? "rounded-lg ring-4 ring-violet-500" : ""}`}
          style={{ left: `${xPct(spec, from)}%`, width: `${wPct(spec, cm * spec.sub)}%` }}
        >
          <ThingArt thing={demo === "read" ? "pencil" : "crayon"} colour="pink" />
        </div>
      </div>
      <RulerStrip
        spec={spec}
        ring={demo === "read" && done(step, phase, 0) && !done(step, phase, 1) ? 0 : undefined}
        green={demo === "read" && done(step, phase, 2) ? { from: 0, to: cm * spec.sub } : undefined}
      />
    </div>
  );
};
