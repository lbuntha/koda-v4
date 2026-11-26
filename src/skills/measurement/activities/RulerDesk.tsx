import React, { useCallback, useMemo, useRef, useState } from "react";
import { readsAloud } from "../internal/readsAloud";
import { forRegion } from "../internal/regionModes";
import { motion } from "motion/react";
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
  type RoundQuestion,
} from "../../kit";
import { tx } from "../internal/i18n";
import {
  NUMBER_LINE,
  buildRuler,
  quartersText,
  rulerChoices,
  rulerModeAt,
  type RulerMode,
  type RulerQuestion,
  type RulerSetup,
} from "../internal/ruler";
import { ThingArt } from "./things";
import { DrawnLine, NumberLine, RulerStrip, ZoomLens, wPct, xPct } from "./ruler";
import { RulerDemoScene, rulerDemoFor, rulerDemoSteps, type RulerDemo } from "./RulerDemo";

/**
 * RulerDesk — read a ruler, put a thing on it properly, draw a line, read a
 * broken ruler, find a difference, jump along a number line, and read inches,
 * quarter inches and millimetres. Every thing ends exactly on a mark.
 */

interface RulerParams extends RulerSetup {
  question?: RulerSetup;
}
export interface RulerRoundQuestion extends RoundQuestion {
  q: RulerQuestion;
}

const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);
const thingName = (t: string) => tx(`thing.${t}`);

/** The unit an answer is said in. */
export const answerUnit = (q: RulerQuestion) => (q.mode === "read_mm" ? "mm" : q.ruler.unit);
/** "7 cm", "3½ in", "47 mm". */
export const amountText = (q: RulerQuestion, v: number) =>
  `${q.mode === "read_inch_fraction" ? quartersText(v) : v} ${answerUnit(q)}`;

export function rulerPrompt(q: RulerQuestion): string {
  const thing = thingName(q.thing);
  switch (q.mode) {
    case "draw":
      return tx("ruler.prompt.draw", { n: String(q.answer), unit: "cm" });
    case "difference":
      return tx("ruler.prompt.difference", { a: thingName(q.thing), b: thingName(q.other!.thing) });
    case "numberline":
      return tx(q.line!.op === "add" ? "ruler.prompt.numberline_add" : "ruler.prompt.numberline_cut", {
        start: String(q.line!.start),
        change: String(q.line!.change),
      });
    default:
      return tx(`ruler.prompt.${q.mode}`, { thing });
  }
}

export function buildRulerQuestion(params: RulerParams, index: number, seen: Set<string> = new Set()): RulerRoundQuestion {
  const setup = { ...params, ...params.question };
  const q = buildRuler(setup, rulerModeAt(setup, index), seen);
  return {
    id: `ruler-${index}-${q.mode}-${q.thing}-${q.ruler.start}-${q.steps}-${q.other?.steps ?? ""}-${q.line ? `${q.line.start}${q.line.op}${q.line.change}` : ""}`,
    taskKind: `ruler_${q.mode}`,
    prompt: rulerPrompt(q),
    expected: amountText(q, q.answer),
    q,
  };
}

const hintKey = (mode: RulerMode) =>
  mode === "read_inch" || mode === "read_inch_fraction" ? "inch" : mode === "read_mm" ? "mm" : mode === "place" ? "read" : mode;

export function rulerHints(q: RulerQuestion, kidTip?: string): string[] {
  const key = hintKey(q.mode);
  const vars = {
    thing: thingName(q.thing),
    start: String(q.line?.start ?? q.ruler.start),
    n: String(q.answer),
    change: String(q.line?.change ?? ""),
    dir: q.line ? tx(`ruler.hint.numberline.${q.line.op === "add" ? "right" : "left"}`) : "",
  };
  // Whole inches read like centimetres; only fractions need the "4 parts" hint.
  const k = q.mode === "read_inch" ? "read" : key;
  return composeHints(kidTip, tx(`ruler.hint.${k}.look`, vars), tx(`ruler.hint.${k}.worked`, vars));
}

interface Play {
  qid: string;
  /** place: the thing is held, then sits at 0. */
  held: boolean;
  placed: boolean;
  /** draw / numberline: the mark picked. */
  picked: number | null;
  status: string | null;
}

const choiceClass =
  "min-h-11 min-w-20 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-lg font-black text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const actionClass =
  "min-h-11 rounded-2xl border-2 border-violet-400 bg-violet-50 px-5 py-2 font-bold text-violet-800 disabled:opacity-40 dark:bg-violet-950/40 dark:text-violet-200";

/** A thing lying above the ruler, from `from` for `steps`. */
const ThingRow: React.FC<{ q: RulerQuestion; thing: string; from: number; steps: number; colour?: "pink" | "purple"; motionOK: boolean; testId: string }> = ({
  q,
  thing,
  from,
  steps,
  colour = "pink",
  motionOK,
  testId,
}) => (
  <div className="relative h-9">
    <motion.div
      className="absolute inset-y-0"
      initial={false}
      animate={{ left: `${xPct(q.ruler, from)}%` }}
      transition={motionOK ? { type: "spring", stiffness: 220, damping: 24 } : { duration: 0 }}
      style={{ width: `${wPct(q.ruler, steps)}%` }}
      data-testid={testId}
      data-from={from}
      data-steps={steps}
    >
      <ThingArt thing={thing} colour={colour} />
    </motion.div>
  </div>
);

export const RulerDesk: React.FC<ActivityProps<RulerParams>> = ({ params, koda, onComplete, lesson }) => {
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
    nextQuestion: useCallback((i: number) => buildRulerQuestion(regional, i, seen.current), [regional]),
    onComplete,
  });
  const question = round.question as RulerRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);

  const firstMode = setup.modes?.[0] ?? setup.mode ?? "read";
  const demoId: RulerDemo | null = practising ? null : rulerDemoFor(firstMode);
  const demo = useHowToPlay(`${koda.skillId}/ruler-${demoId ?? "none"}`, demoId !== null);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const fresh = (): Play => ({ qid: question.id, held: false, placed: false, picked: null, status: null });
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
  const refuse = (message: string) => {
    chime("error");
    update({ status: message });
  };

  const thing = thingName(q.thing);
  const amount = amountText(q, q.answer);
  const rightLine = () => {
    if (q.mode === "draw") return tx("ruler.right.draw", { amount });
    if (q.mode === "difference") return tx("ruler.right.difference", { amount });
    if (q.mode === "numberline") return tx("ruler.right.numberline", { amount });
    return tx("ruler.right.length", { thing: cap(thing), amount });
  };
  const wrongLine = () => {
    const vars = { thing, start: String(q.line?.start ?? ""), change: String(q.line?.change ?? "") };
    if (q.mode === "read_inch_fraction") return tx("ruler.wrong.inch");
    if (q.mode === "read_mm") return tx("ruler.wrong.mm");
    if (q.mode === "offset" || q.mode === "difference" || q.mode === "draw" || q.mode === "numberline") return tx(`ruler.wrong.${q.mode}`, vars);
    return tx("ruler.wrong.read", vars);
  };
  const submit = (value: number) => {
    if (locked) return;
    const correct = value === q.answer;
    chime(correct ? "success" : "error");
    buzz(correct);
    round.submit({
      correct,
      given: amountText(q, value),
      expected: amount,
      title: tx(correct ? "title.right" : "title.wrong"),
      message: correct ? rightLine() : wrongLine(),
    });
  };

  const hints = practising ? [] : rulerHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;
  const end = q.from + q.steps;

  const choices = (onPick: (v: number) => void) => (
    <div className="flex flex-wrap justify-center gap-2">
      {rulerChoices(q).map((v) => (
        <button key={v} type="button" disabled={locked} className={choiceClass} onClick={() => onPick(v)}>
          {amountText(q, v)}
        </button>
      ))}
    </div>
  );

  let board: React.ReactNode;

  if (q.mode === "numberline") {
    const { max, step, labelEvery } = NUMBER_LINE;
    board = (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-surface p-3 shadow-inner" data-testid="ruler-bench">
          <NumberLine
            max={max}
            step={step}
            labelEvery={labelEvery}
            start={q.line!.start}
            picked={play.picked}
            arrow={rung >= 2 ? (q.line!.op === "add" ? "right" : "left") : undefined}
            disabled={locked}
            onPick={(n) => {
              chime("pop");
              update({ picked: n, status: tx("ruler.landing", { n: String(n) }) });
            }}
          />
        </div>
        <div className="flex justify-center">
          <button type="button" disabled={locked} className={actionClass}
            onClick={() => (play.picked === null ? refuse(tx("ruler.status.tapLine")) : submit(play.picked))}>
            {tx("ruler.check")}
          </button>
        </div>
      </div>
    );
  } else if (q.mode === "draw") {
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface p-3 shadow-inner" data-testid="ruler-bench">
          <DrawnLine spec={q.ruler} to={play.picked} motionOK={motionOK} />
          <RulerStrip
            spec={q.ruler}
            ring={rung >= 2 ? q.answer * q.ruler.sub : undefined}
            disabled={locked}
            onMark={(n) => {
              chime("pop");
              update({ picked: n, status: null });
            }}
          />
        </div>
        <div className="flex justify-center">
          <button type="button" disabled={locked} className={actionClass}
            onClick={() => (play.picked === null || play.picked === 0 ? refuse(tx("ruler.status.drawFirst")) : submit(play.picked))}>
            {tx("ruler.done")}
          </button>
        </div>
      </div>
    );
  } else if (q.mode === "place") {
    // Off the ruler until placed: never lined up with 0, and never past the ruler's end.
    const offFrom = Math.max(1, Math.min(3, q.ruler.span * q.ruler.sub - q.steps));
    const from = play.placed ? 0 : offFrom;
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface p-3 shadow-inner" data-testid="ruler-bench">
          <div className="relative">
            <ThingRow q={q} thing={q.thing} from={from} steps={q.steps} motionOK={motionOK} testId="thing" />
            {!play.placed && (
              <button
                type="button"
                disabled={locked}
                aria-label={tx("ruler.tapThing", { thing })}
                aria-pressed={play.held}
                onClick={() => {
                  chime("pop");
                  update({ held: true, status: tx("ruler.status.pickUp") });
                }}
                className={`absolute inset-y-0 rounded-lg ${play.held ? "ring-4 ring-violet-500" : ""}`}
                style={{ left: `${xPct(q.ruler, from)}%`, width: `${wPct(q.ruler, q.steps)}%` }}
              />
            )}
          </div>
          <RulerStrip
            spec={q.ruler}
            ring={rung >= 2 && !play.placed ? 0 : undefined}
            green={rung >= 2 && play.placed ? { from: 0, to: end } : undefined}
            disabled={locked || play.placed}
            onEdge={() => (play.held ? refuse(tx("ruler.status.edge")) : refuse(tx("ruler.status.pickFirst", { thing })))}
            onMark={(n) => {
              if (!play.held) return refuse(tx("ruler.status.pickFirst", { thing }));
              if (n !== 0) return refuse(tx("ruler.status.notZero", { n: String(n) }));
              chime("pop");
              update({ placed: true, held: false, status: tx("ruler.status.placed", { thing: cap(thing) }) });
            }}
          />
        </div>
        {choices((v) => (play.placed ? submit(v) : refuse(tx("ruler.status.placeFirst", { thing }))))}
      </div>
    );
  } else {
    const twoThings = q.mode === "difference";
    const shortEnd = twoThings ? q.other!.steps : 0;
    const green =
      rung < 2
        ? undefined
        : twoThings
          ? { from: shortEnd, to: end }
          : { from: q.from, to: end, count: q.mode === "offset" };
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface p-3 shadow-inner" data-testid="ruler-bench">
          <ThingRow q={q} thing={q.thing} from={q.from} steps={q.steps} motionOK={motionOK} testId="thing" />
          {twoThings && <ThingRow q={q} thing={q.other!.thing} from={0} steps={q.other!.steps} colour="purple" motionOK={motionOK} testId="other" />}
          <RulerStrip spec={q.ruler} green={green} ring={rung >= 2 && q.mode !== "offset" ? 0 : undefined} />
          {q.mode === "read_inch" && <p className="text-right text-xs font-bold text-body">{tx("ruler.foot")}</p>}
          {(q.mode === "read_mm" || q.mode === "read_inch_fraction") && <ZoomLens spec={q.ruler} end={end} />}
        </div>
        {choices(submit)}
      </div>
    );
  }

  const canStartOver = !locked && (play.held || play.placed || play.picked !== null);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("ruler.prompt.read", { thing })}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="ruler"
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
        {demoId && <HowToPlayButton onClick={demo.show} />}
      </div>
      {demoId && (
        <HowToPlay
          open={demo.open}
          steps={rulerDemoSteps(demoId)}
          scene={(step, phase) => <RulerDemoScene demo={demoId} step={step} phase={phase} motionOK={motionOK} />}
          onClose={demo.close}
          speak={sayCaption}
        />
      )}
    </SkillRound>
  );
};
