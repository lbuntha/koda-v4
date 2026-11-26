import React from "react";
import type { DemoPhase, DemoStep } from "../../kit";
import { tx } from "../internal/i18n";
import { MASS_THINGS } from "../internal/balance";
import { CupRow, MassArt, MeasuringJug, PanBalance, VesselArt } from "./rigs";
import { ThingArt } from "./things";

/**
 * How to play for BalanceBeam and PourLab, on the engines' own rigs.
 *
 *   balance: a big balloon and a small rock; on the balance, the rock's side goes down.
 *   pour:    a tall jar fills 3 cups, a wide bowl fills 5; the bowl holds more.
 *   jug:     300 ml in a 1000 ml jug marked every 100.
 *
 * The values are fixed so the captions can name them; `measureDemoFacts` is
 * checked by a test to be a real answer.
 */

export const measureDemoFacts = () => ({
  balance: { left: "balloon" as const, right: "rock" as const },
  pour: { cups: [3, 5] },
  jug: { ml: 300, max: 1000, step: 100 },
});

const frame = "absolute inset-0 overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-3";
const done = (step: number, phase: DemoPhase, s: number) => step > s || (step === s && phase === "done");

export function balanceDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo2.balanceIntro"), holdMs: 2200 },
    { caption: tx("demo2.balanceTap"), hand: [[0.5, 0.86]], moveMs: 900 },
    { caption: tx("demo2.balanceDown"), hand: [[0.78, 0.55]], moveMs: 900, holdMs: 2400 },
  ];
}

export const BalanceDemoScene: React.FC<{ step: number; phase: DemoPhase; motionOK: boolean }> = ({ step, phase, motionOK }) => {
  const { left, right } = measureDemoFacts().balance;
  const on = done(step, phase, 1);
  return (
    <div className={frame} data-testid="balance-demo">
      <PanBalance
        angle={on ? (MASS_THINGS[right].grams > MASS_THINGS[left].grams ? 14 : -14) : 0}
        motionOK={motionOK}
        left={on ? <MassArt thing={left} px={70} /> : null}
        right={on ? <MassArt thing={right} px={44} /> : null}
      />
      {!on && (
        <div className="flex justify-around">
          <MassArt thing={left} px={80} />
          <MassArt thing={right} px={48} />
        </div>
      )}
    </div>
  );
};

export function pourDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo2.pourIntro"), holdMs: 2200 },
    { caption: tx("demo2.pourFirst"), hand: [[0.25, 0.85]], moveMs: 900 },
    { caption: tx("demo2.pourSecond"), hand: [[0.75, 0.85]], moveMs: 900 },
    { caption: tx("demo2.pourAnswer"), hand: [[0.75, 0.35]], moveMs: 900, holdMs: 2400 },
  ];
}

export const PourDemoScene: React.FC<{ step: number; phase: DemoPhase; motionOK: boolean }> = ({ step, phase, motionOK }) => {
  const { cups } = measureDemoFacts().pour;
  const poured = [done(step, phase, 1), done(step, phase, 2)];
  return (
    <div className={`${frame} flex gap-2`} data-testid="pour-demo">
      {(["jar", "bowl"] as const).map((v, i) => (
        <div key={v} className={`flex flex-1 flex-col items-center gap-1 rounded-xl ${i === 1 && done(step, phase, 3) ? "ring-4 ring-emerald-400" : ""}`}>
          <VesselArt vessel={v} fill={poured[i] ? 0 : 0.9} px={70} motionOK={motionOK} />
          {poured[i] && <CupRow full={cups[i]} motionOK={motionOK} />}
        </div>
      ))}
    </div>
  );
};

export function jugDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo2.jugIntro"), hand: [[0.5, 0.62]], moveMs: 900 },
    { caption: tx("demo2.jugMarks"), hand: [[0.42, 0.62]], moveMs: 900 },
    { caption: tx("demo2.jugRead"), holdMs: 2400 },
  ];
}

export const JugDemoScene: React.FC<{ step: number; phase: DemoPhase; motionOK: boolean; unit: string }> = ({ step, phase, motionOK, unit }) => {
  const { ml, max, step: s } = measureDemoFacts().jug;
  return (
    <div className={frame} data-testid="jug-demo">
      <MeasuringJug ml={ml} max={max} step={s} labelEvery={s} unit={unit} highlight={done(step, phase, 0)} motionOK={motionOK} />
    </div>
  );
};

/* ------------------------------------------------------------ units: blocks along a pencil */

export const unitsDemoFacts = () => ({ length: 4 });

export function unitsDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo3.unitsIntro"), holdMs: 2000 },
    { caption: tx("demo3.unitsLay"), hand: [[0.7, 0.85]], moveMs: 900 },
    { caption: tx("demo3.unitsMore"), hand: [[0.7, 0.85]], taps: 3, moveMs: 700 },
    { caption: tx("demo3.unitsCount"), holdMs: 2600 },
  ];
}

export const UnitsDemoScene: React.FC<{ step: number; phase: DemoPhase; motionOK: boolean }> = ({ step, phase }) => {
  const { length } = unitsDemoFacts();
  const laid = done(step, phase, 2) ? length : done(step, phase, 1) ? 1 : 0;
  const w = (v: number) => `${(v / 10) * 100}%`;
  return (
    <div className={`${frame} flex flex-col justify-center gap-2`} data-testid="units-demo">
      <div className="h-10" style={{ width: w(length) }}>
        <ThingArt thing="pencil" colour="pink" />
      </div>
      <div className="relative h-8">
        {Array.from({ length: laid }, (_, i) => (
          <span key={i} className="absolute inset-y-0 rounded border-2 border-violet-700 bg-violet-400" style={{ left: w(i), width: w(1) }} />
        ))}
      </div>
    </div>
  );
};
