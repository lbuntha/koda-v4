import React, { useCallback, useRef } from "react";
import { readsAloud } from "../internal/readsAloud";
import { motion } from "motion/react";
import {
  Apple, Banana, Bath, Bed, Bike, Book, Bus, Car, Coffee, CupSoda, Dog, DoorOpen, Egg, Footprints, GlassWater, Key, Mail, PaintBucket,
  Pencil, PersonStanding, Scissors, Signpost, Smartphone, Sofa, TrainFront, TreePine, type LucideIcon,
} from "lucide-react";
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
import {
  ESTIMATE_THINGS,
  LENGTH_UNITS,
  buildEstimate,
  quantityOf,
  type EstimateUnit,
  estimateModeAt,
  type EstimateQuestion,
  type EstimateSetup,
  type EstimateThing,
} from "../internal/estimate";
import { seededOrder } from "../internal/ruler";
import { symbolFor } from "../internal/units";
import type { Region } from "../../region";

/**
 * EstimateCards — the sensible unit (cm, m or km) and the sensible amount
 * ("about 2 m or 20 m?"). The object is a picture of the object itself, so the
 * picture never disagrees with the word; size is judged from life, not from
 * how big the picture is, so every picture is drawn the same size.
 */

interface EstimateParams extends EstimateSetup {
  question?: EstimateSetup;
}
export interface EstimateRoundQuestion extends RoundQuestion {
  q: EstimateQuestion;
}

export const ESTIMATE_ICON: Record<EstimateThing, LucideIcon> = {
  key: Key,
  pencil: Pencil,
  phone: Smartphone,
  book: Book,
  scissors: Scissors,
  door: DoorOpen,
  bed: Bed,
  car: Car,
  bus: Bus,
  tree: TreePine,
  walk: Footprints,
  town: Signpost,
  train: TrainFront,
  apple: Apple,
  egg: Egg,
  banana: Banana,
  letter: Mail,
  dog: Dog,
  bike: Bike,
  child: PersonStanding,
  sofa: Sofa,
  glass: GlassWater,
  mug: Coffee,
  can: CupSoda,
  bath: Bath,
  bucket: PaintBucket,
};

/** "ml" in England and Cambodia, "mL" in the US; length units are the same everywhere. */
/** The header icon follows what is being measured, not the engine: g or kg is a scale question. */
const HEADER_ICON = { length: "ruler", mass: "scale", capacity: "waves" } as const;

export const unitSymbol = (u: EstimateUnit, region: Region) => (u === "mL" || u === "L" ? symbolFor(u, region) : u);
const amountOf = (q: EstimateQuestion, v: number, region: Region = "INTL") => `${v} ${unitSymbol(ESTIMATE_THINGS[q.thing].unit, region)}`;
/** Which hint and wrong-answer words: length, mass or capacity. */
const quantityKey = (q: EstimateQuestion) => {
  const k = quantityOf(ESTIMATE_THINGS[q.thing].unit);
  return k === "length" ? "unit" : `unit_${k}`;
};

export function estimatePrompt(q: EstimateQuestion): string {
  return q.mode === "choose_unit" ? tx("estimate.prompt.unit", { what: tx(`estimate.what.${q.thing}`) }) : tx(`estimate.ask.${q.thing}`);
}

export function buildEstimateQuestion(params: EstimateParams, index: number, seen: Set<string> = new Set()): EstimateRoundQuestion {
  const setup = { ...params, ...params.question };
  const q = buildEstimate(setup, estimateModeAt(setup, index), seen);
  return {
    id: `estimate-${index}-${q.mode}-${q.thing}-${q.options?.join("-") ?? ""}`,
    taskKind: `estimate_${q.mode}`,
    prompt: estimatePrompt(q),
    expected: q.mode === "choose_unit" ? q.answer : amountOf(q, Number(q.answer)),
    q,
  };
}

export function estimateHints(q: EstimateQuestion, kidTip?: string): string[] {
  const key = q.mode === "choose_unit" ? quantityKey(q) : "amount";
  return composeHints(kidTip, tx(`estimate.hint.${key}.look`), tx(`estimate.hint.${key}.worked`));
}

const cardClass =
  "flex min-h-14 min-w-24 flex-col items-center justify-center rounded-2xl border-2 border-line bg-surface px-4 py-2 text-xl font-black text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/** Rung 2: what one of each unit is like. */
const Benchmarks: React.FC<{ units: readonly EstimateUnit[]; region: Region }> = ({ units, region }) => (
  <ul className="grid gap-1 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" data-testid="benchmarks">
    {units.map((u) => (
      <li key={u}>{tx(`estimate.bench.${u}`, { unit: unitSymbol(u, region) })}</li>
    ))}
  </ul>
);

const ThingCard: React.FC<{ thing: EstimateThing; motionOK: boolean }> = ({ thing, motionOK }) => {
  const Icon = ESTIMATE_ICON[thing];
  return (
    <motion.div
      className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-4 shadow-inner"
      initial={motionOK ? { scale: 0.85, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={motionOK ? { type: "spring", stiffness: 300, damping: 22 } : { duration: 0 }}
      data-testid="estimate-thing"
      data-thing={thing}
    >
      <Icon className="h-16 w-16 text-violet-600 dark:text-violet-300" strokeWidth={1.75} aria-hidden="true" />
      <span className="text-base font-bold text-ink">{tx(`estimate.name.${thing}`)}</span>
    </motion.div>
  );
};

export const EstimateCards: React.FC<ActivityProps<EstimateParams>> = ({ params, koda, onComplete, lesson }) => {
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
    nextQuestion: useCallback((i: number) => buildEstimateQuestion(params, i, seen.current), [params]),
    onComplete,
  });
  const question = round.question as EstimateRoundQuestion;
  const q = question.q;
  const region = koda.ui.region;
  const locked = Boolean(round.feedback);

  const demo = useHowToPlay(`${koda.skillId}/estimate`, !practising);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const submit = (given: string) => {
    if (locked) return;
    const correct = given === q.answer;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success(); else koda.haptics.pulse("error");
    }
    const isUnit = q.mode === "choose_unit";
    const sym = (u: string) => unitSymbol(u as EstimateUnit, region);
    round.submit({
      correct,
      given: isUnit ? sym(given) : amountOf(q, Number(given), region),
      expected: isUnit ? sym(q.answer) : amountOf(q, Number(q.answer), region),
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct
        ? isUnit
          ? tx("estimate.right.unit", { unit: sym(q.answer) })
          : tx("estimate.right.amount", { amount: amountOf(q, Number(q.answer), region) })
        : isUnit
          ? tx(`estimate.wrong.${quantityKey(q)}`)
          : tx("estimate.wrong.amount"),
    });
  };

  const hints = practising ? [] : estimateHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;

  const options =
    q.mode === "choose_unit"
      ? seededOrder([...(q.units ?? LENGTH_UNITS)], question.id).map((u) => ({ value: u as string, label: unitSymbol(u, region) }))
      : q.options!.map((v) => ({ value: String(v), label: tx("estimate.about", { amount: amountOf(q, v, region) }) }));

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("estimate.prompt.unit", { what: "" })}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName={HEADER_ICON[quantityOf(ESTIMATE_THINGS[question.q.thing].unit)]}
      iconTone="emerald"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-motion={motionOK ? "on" : "off"}>
        <ThingCard key={question.id} thing={q.thing} motionOK={motionOK} />
        {rung >= 2 && <Benchmarks units={q.mode === "choose_unit" ? (q.units ?? LENGTH_UNITS) : LENGTH_UNITS} region={region} />}
        <div className="flex flex-wrap justify-center gap-3">
          {options.map((o) => (
            <button key={o.value} type="button" disabled={locked} className={cardClass} onClick={() => submit(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        {!practising && <HowToPlayButton onClick={demo.show} />}
      </div>
      <HowToPlay
        open={demo.open}
        steps={estimateDemoSteps()}
        scene={(step, phase) => <EstimateDemoScene step={step} phase={phase} motionOK={motionOK} />}
        onClose={demo.close}
        speak={sayCaption}
      />
    </SkillRound>
  );
};

/* ------------------------------------------------------------ demo: the door */

/** The demo's door: its real size and the wrong amount, both named in the captions. */
export const estimateDemoFacts = () => ({ thing: "door" as const, right: 2, wrong: 20 });

export function estimateDemoSteps(): DemoStep[] {
  return [
    { caption: tx("demo4.estimateIntro"), holdMs: 2000 },
    { caption: tx("demo4.estimateThink"), holdMs: 2400 },
    { caption: tx("demo4.estimateTap"), hand: [[0.3, 0.84]], moveMs: 900, holdMs: 2200 },
  ];
}

const EstimateDemoScene: React.FC<{ step: number; phase: DemoPhase; motionOK: boolean }> = ({ step, phase, motionOK }) => {
  const f = estimateDemoFacts();
  const picked = step > 2 || (step === 2 && phase === "done");
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface p-3" data-testid="estimate-demo">
      <ThingCard thing={f.thing} motionOK={motionOK} />
      <div className="flex w-full justify-around">
        {[f.right, f.wrong].map((v) => (
          <span key={v} className={`rounded-2xl border-2 px-4 py-2 text-lg font-black text-ink ${picked && v === f.right ? "border-emerald-500 ring-4 ring-emerald-300" : "border-line"}`}>
            {tx("estimate.about", { amount: `${v} m` })}
          </span>
        ))}
      </div>
    </div>
  );
};
