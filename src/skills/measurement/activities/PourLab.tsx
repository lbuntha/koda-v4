import React, { useCallback, useMemo, useRef, useState } from "react";
import { readsAloud } from "../internal/readsAloud";
import { forRegion } from "../internal/regionModes";
import type { ActivityProps } from "../../types";
import {
  HowToPlay,
  HowToPlayButton,
  SkillRound,
  answerChoices,
  composeHints,
  isPractice,
  playCopy,
  useHowToPlay,
  useMotionOK,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { tx } from "../internal/i18n";
import { symbolFor } from "../internal/units";
import {
  buildCapacity,
  capacityModeAt,
  customaryChoices,
  type CapacityMode,
  type CapacityQuestion,
  type CapacitySetup,
  type CustomaryUnit,
} from "../internal/capacity";
import { CupRow, CustomaryArt, MeasuringJug, VesselArt } from "./rigs";
import { JugDemoScene, PourDemoScene, jugDemoSteps, pourDemoSteps } from "./MeasureDemos";

/**
 * PourLab — water. `pour`: pour two containers into cups and tap the one that
 * holds more. `cups`: how many cups one fills. `jug`: read a measuring jug.
 * `fill`: pour in and out by the jug's steps until the water reaches a line.
 * `customary`: US cups, pints, quarts and gallons.
 *
 * Tap only: "Pour … into cups", "Pour in 100 ml", "Pour out 50 ml", "Done".
 */

interface CapacityParams extends CapacitySetup {
  question?: CapacitySetup;
}
export interface CapacityRoundQuestion extends RoundQuestion {
  q: CapacityQuestion;
}

const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);
const vesselName = (v: string) => tx(`vessel.${v}`);
export const usName = (u: CustomaryUnit, plural = false) => tx(`${plural ? "customaryPlural" : "customary"}.${u}`);

export function capacityPrompt(q: CapacityQuestion, unit: string): string {
  switch (q.mode) {
    case "pour":
      return tx("pour.prompt.pour", { a: vesselName(q.vessels![0]), b: vesselName(q.vessels![1]) });
    case "cups":
      return tx("pour.prompt.cups", { thing: vesselName(q.vessels![0]) });
    case "jug":
      return tx("pour.prompt.jug");
    case "fill":
      return tx("pour.prompt.fill", { target: String(q.ml), unit });
    case "customary":
      return q.kind === "which"
        ? tx("pour.prompt.which", { a: usName(q.big!), b: usName(q.small!) })
        : tx("pour.prompt.howMany", { small: usName(q.small!, true), big: usName(q.big!) });
  }
}

export function buildCapacityQuestion(params: CapacityParams, index: number, seen: Set<string> = new Set(), unit = "ml"): CapacityRoundQuestion {
  const merged = { ...params, ...params.question };
  // A round that steps down: two questions on 100s, two on 50s, then 25s.
  const setup = merged.steps?.length ? { ...merged, step: merged.steps[Math.min(merged.steps.length - 1, Math.floor((index - 1) / 2))] } : merged;
  const q = buildCapacity(setup, capacityModeAt(setup, index), seen);
  return {
    id: `capacity-${index}-${q.mode}-${q.vessels?.join("-") ?? ""}-${q.cups?.join("-") ?? ""}-${q.ml ?? ""}-${q.big ?? ""}-${q.small ?? ""}`,
    taskKind: `capacity_${q.mode}`,
    prompt: capacityPrompt(q, unit),
    expected: q.answer,
    q,
  };
}

export function capacityHints(q: CapacityQuestion, kidTip?: string): string[] {
  const key = q.mode === "customary" ? "customary" : q.mode;
  return composeHints(kidTip, tx(`pour.hint.${key}.look`), tx(`pour.hint.${key}.worked`, { step: String(q.step ?? "") }));
}

interface Play {
  qid: string;
  poured: boolean[];
  ml: number;
  status: string | null;
}

const choiceClass =
  "min-h-11 min-w-16 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-lg font-black text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

export const PourLab: React.FC<ActivityProps<CapacityParams>> = ({ params, koda, onComplete, lesson }) => {
  const regional = useMemo(() => forRegion(params, koda.ui.region), [params, koda.ui.region]);
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const motionOK = useMotionOK() && koda.config.isEnabled("instrument_motion", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const unit = symbolFor("mL", koda.ui.region);
  const seen = useRef(new Set<string>());

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising || !readsAloud(lesson?.id) ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildCapacityQuestion(regional, i, seen.current, unit), [regional, unit]),
    onComplete,
  });
  const question = round.question as CapacityRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);

  const firstMode: CapacityMode = setup.modes?.[0] ?? setup.mode ?? "pour";
  const demoKind = firstMode === "pour" || firstMode === "cups" ? "pour" : firstMode === "jug" || firstMode === "fill" ? "jug" : null;
  const demo = useHowToPlay(`${koda.skillId}/${demoKind ?? "none"}`, !practising && demoKind !== null);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const fresh = (): Play => ({ qid: question.id, poured: (q.vessels ?? []).map(() => false), ml: 0, status: null });
  const [stored, setStored] = useState<Play>(fresh);
  const play = stored.qid === question.id ? stored : fresh();
  const update = (next: Partial<Play>) => setStored({ ...play, ...next });

  const chime = (name: "pop" | "success" | "error") => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(name);
  };
  const buzz = (ok: boolean) => {
    if (!hapticsEnabled) return;
    if (ok) koda.haptics.success(); else koda.haptics.pulse("error");
  };

  const rightMessage = (): string => {
    switch (q.mode) {
      case "pour":
        return tx("pour.right.pour", { thing: vesselName(q.vessels![Number(q.answer)]) });
      case "cups":
        return tx("pour.right.cups", { count: q.answer });
      case "jug":
        return tx("pour.right.jug", { amount: q.answer, unit });
      case "fill":
        return tx("pour.right.fill");
      case "customary":
        return q.kind === "which"
          ? tx("pour.right.which", { name: usName(q.answer as CustomaryUnit) })
          : tx("pour.right.howMany", { count: q.answer, small: usName(q.small!, true), big: usName(q.big!) });
    }
  };

  const submit = (given: string) => {
    if (locked) return;
    const correct = given === q.answer;
    chime(correct ? "success" : "error");
    buzz(correct);
    const message = correct ? rightMessage() : tx(`pour.wrong.${q.mode}`);
    round.submit({ correct, given, expected: q.answer, title: tx(correct ? "title.right" : "title.wrong"), message });
  };

  const hints = practising ? [] : capacityHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;

  const pourButton = (i: number) => (
    <button
      type="button"
      disabled={locked || play.poured[i]}
      onClick={() => {
        chime("pop");
        const poured = [...play.poured];
        poured[i] = true;
        // Never the count: counting the full cups is the lesson.
        update({ poured, status: tx("pour.status.filled", { thing: vesselName(q.vessels![i]) }) });
      }}
      className="min-h-11 rounded-2xl border-2 border-sky-500 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 disabled:opacity-40 dark:bg-sky-950/40 dark:text-sky-100"
    >
      {cap(tx("pour.pourInto", { thing: vesselName(q.vessels![i]) }))}
    </button>
  );

  const vesselColumn = (i: number) => (
    <div key={i} className="flex flex-1 flex-col items-center gap-2" data-testid={`vessel-${i}`}>
      <VesselArt vessel={q.vessels![i]} fill={play.poured[i] ? 0 : 0.9} motionOK={motionOK} />
      <span className="text-sm font-bold text-ink">{cap(vesselName(q.vessels![i]))}</span>
      {play.poured[i] && <CupRow full={q.cups![i]} motionOK={motionOK} testId={`cups-${i}`} />}
      {play.poured[i] && rung >= 2 && (
        <span className="rounded-full bg-violet-100 px-2 text-sm font-black text-violet-800 dark:bg-violet-900/50 dark:text-violet-100" data-testid="cup-count">
          {tx("pour.cupsFull", { count: String(q.cups![i]) })}
        </span>
      )}
      {pourButton(i)}
    </div>
  );

  let board: React.ReactNode = null;

  if (q.mode === "pour") {
    const both = play.poured.every(Boolean);
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 rounded-2xl bg-surface p-3 shadow-inner" data-testid="pour-bench">
          {vesselColumn(0)}
          {vesselColumn(1)}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {q.vessels!.map((v, i) => (
            <button key={i} type="button" disabled={locked} className={choiceClass}
              onClick={() => (both ? submit(String(i)) : (chime("error"), update({ status: tx("pour.status.pourBoth") })))}>
              {cap(tx("the", { thing: vesselName(v) }))}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.mode === "cups") {
    const choices = answerChoices(q.cups![0], question.id, { min: 1, max: 12 });
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex justify-center rounded-2xl bg-surface p-3 shadow-inner" data-testid="pour-bench">{vesselColumn(0)}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {choices.map((n) => (
            <button key={n} type="button" disabled={locked} className={choiceClass}
              onClick={() => (play.poured[0] ? submit(String(n)) : (chime("error"), update({ status: tx("pour.status.pourFirst") })))}>
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.mode === "jug") {
    const choices = answerChoices(q.ml!, question.id, { step: q.step!, min: q.step!, max: q.max! - q.step! });
    board = (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-surface p-3 shadow-inner" data-testid="pour-bench">
          <MeasuringJug ml={q.ml!} max={q.max!} step={q.step!} labelEvery={q.labelEvery!} unit={unit} highlight={rung >= 2} motionOK={motionOK} />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {choices.map((n) => (
            <button key={n} type="button" disabled={locked} className={choiceClass} onClick={() => submit(String(n))}>
              {tx("pour.amount", { amount: String(n), unit })}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.mode === "fill") {
    const step = q.step!;
    const big = Math.max(step, q.labelEvery!);
    const pourTo = (ml: number) => {
      chime("pop");
      update({ ml, status: null });
    };
    board = (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-surface p-3 shadow-inner" data-testid="pour-bench">
          <MeasuringJug ml={play.ml} max={q.max!} step={step} labelEvery={q.labelEvery!} unit={unit} target={q.ml} highlight={rung >= 2} motionOK={motionOK} />
          <p className="text-center text-sm font-bold text-body" data-testid="in-jug">{tx("pour.inJug", { amount: String(play.ml), unit })}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={locked || play.ml - step < 0} onClick={() => pourTo(play.ml - step)}
            className="min-h-11 rounded-2xl border-2 border-line bg-surface px-3 py-2 text-sm font-bold text-ink disabled:opacity-40">
            {tx("pour.remove", { amount: String(step), unit })}
          </button>
          <button type="button" disabled={locked || play.ml + step > q.max!} onClick={() => pourTo(play.ml + step)}
            className="min-h-11 rounded-2xl border-2 border-sky-500 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 disabled:opacity-40 dark:bg-sky-950/40 dark:text-sky-100">
            {tx("pour.add", { amount: String(step), unit })}
          </button>
          {big !== step && (
            <button type="button" disabled={locked || play.ml + big > q.max!} onClick={() => pourTo(play.ml + big)}
              className="min-h-11 rounded-2xl border-2 border-sky-500 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 disabled:opacity-40 dark:bg-sky-950/40 dark:text-sky-100">
              {tx("pour.add", { amount: String(big), unit })}
            </button>
          )}
        </div>
        <button type="button" disabled={locked || play.ml === 0} onClick={() => submit(String(play.ml))}
          className="mx-auto min-h-11 rounded-2xl bg-violet-600 px-6 py-2 font-bold text-white shadow disabled:opacity-40">
          {tx("pour.done")}
        </button>
      </div>
    );
  }

  if (q.mode === "customary") {
    const units: CustomaryUnit[] = q.kind === "which" ? [q.big!, q.small!] : [q.small!, q.big!];
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-center gap-6 rounded-2xl bg-surface p-4 shadow-inner" data-testid="pour-bench">
          {units.map((u) => <CustomaryArt key={u} unit={u} label={usName(u)} />)}
          {rung >= 2 && q.kind === "howMany" && (
            <span className="flex flex-wrap items-end gap-0.5" data-testid="fill-row">
              {Array.from({ length: Number(q.answer) }, (_, i) => <CustomaryArt key={i} unit={q.small!} label="" />)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {q.kind === "which"
            ? units.map((u) => (
                <button key={u} type="button" disabled={locked} className={choiceClass} onClick={() => submit(u)}>
                  {cap(usName(u))}
                </button>
              ))
            : customaryChoices(Number(q.answer)).map((n) => (
                <button key={n} type="button" disabled={locked} className={choiceClass} onClick={() => submit(String(n))}>
                  {n}
                </button>
              ))}
        </div>
      </div>
    );
  }

  const canStartOver = !locked && (play.poured.some(Boolean) || play.ml > 0);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("pour.done")}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="waves"
      iconTone="cyan"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
      onStartOver={canStartOver ? () => setStored(fresh()) : undefined}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-motion={motionOK ? "on" : "off"}>
        {board}
        <p className="min-h-6 text-center text-base font-semibold text-body" aria-live="polite">{play.status}</p>
        {!practising && demoKind && <HowToPlayButton onClick={demo.show} />}
      </div>
      {demoKind && (
        <HowToPlay
          open={demo.open}
          steps={demoKind === "pour" ? pourDemoSteps() : jugDemoSteps()}
          scene={(step, phase) =>
            demoKind === "pour" ? <PourDemoScene step={step} phase={phase} motionOK={motionOK} /> : <JugDemoScene step={step} phase={phase} motionOK={motionOK} unit={unit} />
          }
          onClose={demo.close}
          speak={sayCaption}
        />
      )}
    </SkillRound>
  );
};
