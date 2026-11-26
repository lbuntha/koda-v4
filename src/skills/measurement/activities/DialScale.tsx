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
import { buildScale, halfText, lbOz, scaleChoices, scaleModeAt, stepsOf, type Dial, type ScaleQuestion, type ScaleSetup } from "../internal/scale";
import { seededOrder } from "../internal/ruler";
import { ScaleDial } from "./dials";

/**
 * DialScale — read a round scale. The needle springs to the weight; the child
 * picks it from four. With unnumbered marks, the work is finding what one
 * small mark is worth (plan Stage 4).
 */

interface ScaleParams extends ScaleSetup {
  question?: ScaleSetup;
}
export interface ScaleRoundQuestion extends RoundQuestion {
  q: ScaleQuestion;
}

/** "650 g", "7½ kg", "1 lb 5 oz". */
export const weightText = (dial: Dial, v: number) => (dial.unit === "oz" ? lbOz(v) : `${dial.unit === "kg" ? halfText(v) : v} ${dial.unit}`);

/** The numbered mark at or below `v`, and the one above. */
export const labelsAround = (dial: Dial, v: number) => {
  const from = Math.floor(v / dial.labelEvery + 1e-9) * dial.labelEvery;
  return { from, to: from + dial.labelEvery };
};

export function buildScaleQuestion(params: ScaleParams, index: number, seen: Set<string> = new Set()): ScaleRoundQuestion {
  const setup = { ...params, ...params.question };
  const q = buildScale(setup, scaleModeAt(setup, index), seen);
  return {
    id: `scale-${index}-${q.mode}-${q.dial.max}-${q.dial.step}-${q.value}`,
    taskKind: `scale_${q.mode}`,
    prompt: tx(`scale.prompt.${q.dial.unit}`),
    expected: weightText(q.dial, q.value),
    q,
  };
}

const hintKey = (q: ScaleQuestion) => (q.mode === "read_kg" ? "kg" : q.mode === "read_lb" ? "lb" : q.mode);

export function scaleHints(q: ScaleQuestion, kidTip?: string): string[] {
  const { from, to } = labelsAround(q.dial, q.value);
  const vars = {
    from: String(from),
    to: String(to),
    marks: String(Math.round(q.dial.labelEvery / q.dial.step)),
    step: q.dial.unit === "kg" ? halfText(q.dial.step) : String(q.dial.step),
  };
  const key = hintKey(q);
  return composeHints(kidTip, tx(`scale.hint.${key}.look`, vars), tx(`scale.hint.${key}.worked`, vars));
}

const choiceClass =
  "min-h-11 min-w-24 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-lg font-black text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

export const DialScale: React.FC<ActivityProps<ScaleParams>> = ({ params, koda, onComplete, lesson }) => {
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
    nextQuestion: useCallback((i: number) => buildScaleQuestion(regional, i, seen.current), [regional]),
    onComplete,
  });
  const question = round.question as ScaleRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);

  const demo = useHowToPlay(`${koda.skillId}/scale`, !practising);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const submit = (v: number) => {
    if (locked) return;
    const correct = v === q.value;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success(); else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: weightText(q.dial, v),
      expected: weightText(q.dial, q.value),
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct ? tx("scale.right", { amount: weightText(q.dial, q.value) }) : tx(`scale.wrong.${hintKey(q)}`),
    });
  };

  const hints = practising ? [] : scaleHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("scale.prompt.g")}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="scale"
      iconTone="purple"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-motion={motionOK ? "on" : "off"}>
        <div className="rounded-2xl bg-surface p-3 shadow-inner" data-testid="scale-bench">
          <ScaleDial key={question.id} dial={q.dial} value={q.value} load={q.load} motionOK={motionOK} from={rung >= 2 ? labelsAround(q.dial, q.value).from : undefined} />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {seededOrder(scaleChoices(q), question.id).map((v) => (
            <button key={v} type="button" disabled={locked} className={choiceClass} onClick={() => submit(v)}>
              {weightText(q.dial, v)}
            </button>
          ))}
        </div>
        {!practising && <HowToPlayButton onClick={demo.show} />}
      </div>
      <HowToPlay
        open={demo.open}
        steps={scaleDemoSteps()}
        scene={(step, phase) => <ScaleDemoScene step={step} phase={phase} motionOK={motionOK} />}
        onClose={demo.close}
        speak={sayCaption}
      />
    </SkillRound>
  );
};

/* ------------------------------------------------------------ demo: 650 g of flour */

export const scaleDemoFacts = () => ({ dial: { unit: "g", max: 1000, step: 50, labelEvery: 200 } as Dial, value: 650 });

export function scaleDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo5.scaleIntro"), holdMs: 2000 },
    { caption: tx("demo5.scaleBefore"), hand: [[0.62, 0.42]], moveMs: 900, holdMs: 1400 },
    { caption: tx("demo5.scaleSteps"), hand: [[0.7, 0.5]], moveMs: 900, holdMs: 1600 },
    { caption: tx("demo5.scaleAnswer"), holdMs: 2400 },
  ];
}

const ScaleDemoScene: React.FC<{ step: number; phase: DemoPhase; motionOK: boolean }> = ({ step, phase, motionOK }) => {
  const { dial, value } = scaleDemoFacts();
  const counting = step > 2 || (step === 2 && phase === "done");
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-2" data-testid="scale-demo">
      <div className="w-[85%]">
        <ScaleDial dial={dial} value={value} load="flour" motionOK={motionOK} from={counting ? labelsAround(dial, value).from : undefined} />
      </div>
    </div>
  );
};

/** For tests: the demo's dial really has `value` on a mark, and 600 is the number before it. */
export const scaleDemoCheck = () => {
  const { dial, value } = scaleDemoFacts();
  return { onMark: value % dial.step === 0 && value < dial.max, before: labelsAround(dial, value).from, steps: stepsOf(dial) };
};
