import React, { useCallback, useMemo, useRef } from "react";
import { readsAloud } from "../internal/readsAloud";
import { forRegion } from "../internal/regionModes";
import type { ActivityProps } from "../../types";
import {
  HowToPlay,
  HowToPlayButton,
  SkillRound,
  composeHints,
  isPractice,
  playCopy,
  useHowToPlay,
  useMotionOK,
  useSkillRound,
  type DemoPhase,
  type DemoStep,
  type RoundQuestion,
} from "../../kit";
import { tx } from "../internal/i18n";
import { READ_SCALES, buildThermo, degText, thermoChoices, thermoModeAt, type ThermoQuestion, type ThermoScale, type ThermoSetup } from "../internal/thermo";
import { seededOrder } from "../internal/ruler";
import { ThermometerArt } from "./dials";

/**
 * Thermometer — read °C (marks of 1, 2 or 5), read below zero, work out a
 * change of temperature across 0, and read °F (US).
 */

interface ThermoParams extends ThermoSetup {
  question?: ThermoSetup;
}
export interface ThermoRoundQuestion extends RoundQuestion {
  q: ThermoQuestion;
}

export const tempText = (q: ThermoQuestion, v: number) => `${degText(v)} °${q.scale.unit}`;

export function thermoPrompt(q: ThermoQuestion): string {
  if (q.mode === "change") return tx(`thermo.prompt.${q.change!.dir}`, { start: degText(q.value), by: String(q.change!.by) });
  return tx(`thermo.prompt.${q.mode}`);
}

export function buildThermoQuestion(params: ThermoParams, index: number, seen: Set<string> = new Set()): ThermoRoundQuestion {
  const setup = { ...params, ...params.question };
  const q = buildThermo(setup, thermoModeAt(setup, index), index, seen);
  return {
    id: `thermo-${index}-${q.mode}-${q.scale.step}-${q.value}-${q.change?.by ?? ""}${q.change?.dir ?? ""}`,
    taskKind: `thermo_${q.mode}`,
    prompt: thermoPrompt(q),
    expected: tempText(q, q.answer),
    q,
  };
}

/** The numbered mark at or below a temperature (−3 → −10 on a scale numbered in 10s). */
export const labelBelow = (s: ThermoScale, v: number) => Math.floor(v / s.labelEvery) * s.labelEvery;

const hintKey = (q: ThermoQuestion) => (q.mode === "read_f" ? "read" : q.mode);

export function thermoHints(q: ThermoQuestion, kidTip?: string): string[] {
  const vars = {
    step: String(q.scale.step),
    start: degText(q.value),
    by: String(q.change?.by ?? ""),
    dir: q.change ? tx(q.change.dir === "warmer" ? "thermo.hint.up" : "thermo.hint.down") : "",
  };
  const key = hintKey(q);
  return composeHints(kidTip, tx(`thermo.hint.${key}.look`, vars), tx(`thermo.hint.${key}.worked`, vars));
}

const choiceClass =
  "min-h-11 min-w-24 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-lg font-black text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

export const Thermometer: React.FC<ActivityProps<ThermoParams>> = ({ params, koda, onComplete, lesson }) => {
  const regional = useMemo(() => forRegion(params, koda.ui.region), [params, koda.ui.region]);
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const motionOK = useMotionOK() && koda.config.isEnabled("instrument_motion", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const seen = useRef(new Set<string>());

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising || !readsAloud(lesson?.id) ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildThermoQuestion(regional, i, seen.current), [regional]),
    onComplete,
  });
  const question = round.question as ThermoRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);

  const firstMode = setup.modes?.[0] ?? setup.mode ?? "read";
  const demo = useHowToPlay(`${koda.skillId}/thermo`, !practising && firstMode === "read");
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const submit = (v: number) => {
    if (locked) return;
    const correct = v === q.answer;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success(); else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: tempText(q, v),
      expected: tempText(q, q.answer),
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct ? tx("thermo.right", { amount: tempText(q, q.answer) }) : tx(`thermo.wrong.${hintKey(q)}`),
    });
  };

  const hints = practising ? [] : thermoHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;
  const showHint = rung >= 2;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("thermo.prompt.read")}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="thermometer"
      iconTone="pink"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-motion={motionOK ? "on" : "off"}>
        <div className="rounded-2xl bg-surface p-3 shadow-inner" data-testid="thermo-bench">
          <ThermometerArt
            scale={q.scale}
            value={q.value}
            motionOK={motionOK}
            from={showHint && q.mode !== "change" ? labelBelow(q.scale, q.value) : undefined}
            arrow={showHint && q.change ? (q.change.dir === "warmer" ? "up" : "down") : undefined}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {seededOrder(thermoChoices(q), question.id).map((v) => (
            <button key={v} type="button" disabled={locked} className={choiceClass} onClick={() => submit(v)}>
              {tempText(q, v)}
            </button>
          ))}
        </div>
        {!practising && firstMode === "read" && <HowToPlayButton onClick={demo.show} />}
      </div>
      {firstMode === "read" && (
        <HowToPlay
          open={demo.open}
          steps={thermoDemoSteps()}
          scene={(step, phase) => <ThermoDemoScene step={step} phase={phase} motionOK={motionOK} />}
          onClose={demo.close}
          speak={sayCaption}
        />
      )}
    </SkillRound>
  );
};

/* ------------------------------------------------------------ demo: 26 °C in 2s */

export const thermoDemoFacts = () => ({ scale: READ_SCALES[1], value: 26 });

export function thermoDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo5.thermoIntro"), holdMs: 1800 },
    { caption: tx("demo5.thermoTop"), hand: [[0.62, 0.38]], moveMs: 900, holdMs: 1200 },
    { caption: tx("demo5.thermoCount"), hand: [[0.66, 0.48]], moveMs: 900, holdMs: 2200 },
    { caption: tx("demo5.thermoAnswer"), holdMs: 2200 },
  ];
}

const ThermoDemoScene: React.FC<{ step: number; phase: DemoPhase; motionOK: boolean }> = ({ step, phase, motionOK }) => {
  const { scale, value } = thermoDemoFacts();
  const counting = step > 2 || (step === 2 && phase === "done");
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-2" data-testid="thermo-demo">
      <div className="h-full [&>svg]:h-full">
        <ThermometerArt scale={scale} value={value} motionOK={motionOK} from={counting ? labelBelow(scale, value) : undefined} />
      </div>
    </div>
  );
};
