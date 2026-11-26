import React, { useCallback, useRef, useState } from "react";
import { readsAloud } from "../internal/readsAloud";
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
  MASS_THINGS,
  balanceModeAt,
  buildBalance,
  compareTilt,
  tilt,
  type BalanceQuestion,
  type BalanceSetup,
} from "../internal/balance";
import { Cube, MassArt, PanBalance } from "./rigs";
import { BalanceDemoScene, balanceDemoSteps } from "./MeasureDemos";

/**
 * BalanceBeam — a pan balance. `compare`: put two things on and tap the
 * heavier (or lighter); size is no guide, the beam is. `cubes`: add and take
 * off cubes until the beam is level, then say it balances.
 *
 * Tap only: "Put them on the balance", "Add a cube", "Take a cube off".
 */

interface BalanceParams extends BalanceSetup {
  question?: BalanceSetup;
}
export interface BalanceRoundQuestion extends RoundQuestion {
  q: BalanceQuestion;
}

const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);
const massName = (thing: string) => tx(`mass.${thing}`);
/** Pixel size for a thing's drawing: its `size` (1–10) scaled, so a balloon looks big and a rock small. */
const drawPx = (thing: keyof typeof MASS_THINGS) => 28 + MASS_THINGS[thing].size * 6;

export function balancePrompt(q: BalanceQuestion): string {
  return q.mode === "compare"
    ? tx("balance.prompt.compare", { ask: tx(`ask.${q.ask}`), left: massName(q.left), right: massName(q.right!) })
    : tx("balance.prompt.cubes", { thing: massName(q.left) });
}

export function buildBalanceQuestion(params: BalanceParams, index: number, seen: Set<string> = new Set()): BalanceRoundQuestion {
  const setup = { ...params, ...params.question };
  const q = buildBalance(setup, balanceModeAt(setup, index), seen);
  return {
    id: `balance-${index}-${q.left}-${q.right ?? q.cubes}-${q.ask}`,
    taskKind: `balance_${q.mode}`,
    prompt: balancePrompt(q),
    expected: q.answer,
    q,
  };
}

export function balanceHints(q: BalanceQuestion, kidTip?: string): string[] {
  return composeHints(kidTip, tx(`balance.hint.${q.mode}.look`), tx(`balance.hint.${q.mode}.worked`));
}

interface Play {
  qid: string;
  weighed: boolean;
  cubes: number;
  status: string | null;
}

export const BalanceBeam: React.FC<ActivityProps<BalanceParams>> = ({ params, koda, onComplete, lesson }) => {
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
    nextQuestion: useCallback((i: number) => buildBalanceQuestion(params, i, seen.current), [params]),
    onComplete,
  });
  const question = round.question as BalanceRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);

  const demo = useHowToPlay(`${koda.skillId}/balance`, !practising);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const fresh = (): Play => ({ qid: question.id, weighed: false, cubes: 0, status: null });
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

  const submit = (given: string) => {
    if (locked) return;
    const correct = given === q.answer;
    chime(correct ? "success" : "error");
    buzz(correct);
    const chosen = q.mode === "compare" ? (q.answer === "left" ? q.left : q.right!) : q.left;
    const message = correct
      ? q.mode === "compare"
        ? tx("balance.right.compare", { name: massName(chosen), ask: tx(`ask.${q.ask}`) })
        : tx("balance.right.cubes", { thing: massName(q.left), count: q.answer })
      : tx(`balance.wrong.${q.mode}`);
    round.submit({ correct, given, expected: q.answer, title: tx(correct ? "title.right" : "title.wrong"), message });
  };

  const hints = practising ? [] : balanceHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;

  // The beam: level until weighed (compare), or by cube difference (cubes).
  const angle =
    q.mode === "compare" ? (play.weighed ? compareTilt(q) : 0) : tilt(q.cubes!, play.cubes);
  const level = q.mode === "cubes" && angle === 0;

  const thingOnPan = (thing: typeof q.left) => (
    <span className="flex items-end" title={massName(thing)}>
      <MassArt thing={thing} px={Math.min(76, drawPx(thing))} />
    </span>
  );
  const offPan = (thing: typeof q.left) => (
    <span className="flex flex-col items-center gap-1">
      <MassArt thing={thing} px={drawPx(thing)} />
    </span>
  );

  const cubeStack = (
    <span className="flex max-w-24 flex-wrap-reverse justify-center gap-0.5" data-testid="cube-stack">
      {Array.from({ length: play.cubes }, (_, i) => <Cube key={i} />)}
    </span>
  );

  let board: React.ReactNode;
  if (q.mode === "compare") {
    const pickButton = (side: "left" | "right") => {
      const thing = side === "left" ? q.left : q.right!;
      return (
        <button
          key={side}
          type="button"
          disabled={locked}
          onClick={() => (play.weighed ? submit(side) : (chime("error"), update({ status: tx("balance.status.weighFirst") })))}
          className="min-h-11 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-base font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {cap(tx("the", { thing: massName(thing) }))}
        </button>
      );
    };
    board = (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-surface p-3 shadow-inner" data-testid="balance-bench">
          <PanBalance
            angle={angle}
            motionOK={motionOK}
            left={play.weighed ? thingOnPan(q.left) : null}
            right={play.weighed ? thingOnPan(q.right!) : null}
          />
          {!play.weighed && (
            <div className="mt-2 flex items-end justify-around" data-testid="table">
              {offPan(q.left)}
              {offPan(q.right!)}
            </div>
          )}
          {rung >= 2 && play.weighed && (
            <p className="mt-1 text-center text-sm font-bold text-rose-600 dark:text-rose-300" data-testid="down-mark">
              {angle > 0 ? "↘" : "↙"} {tx("balance.status.weighed")}
            </p>
          )}
        </div>
        {!play.weighed && (
          <button
            type="button"
            disabled={locked}
            onClick={() => { chime("pop"); update({ weighed: true, status: tx("balance.status.weighed") }); }}
            className="mx-auto min-h-11 rounded-2xl bg-violet-600 px-6 py-2 font-bold text-white shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            {tx("balance.weigh")}
          </button>
        )}
        <div className="flex flex-wrap justify-center gap-3">{pickButton("left")}{pickButton("right")}</div>
      </div>
    );
  } else {
    const setCubes = (n: number) => {
      chime("pop");
      const a = tilt(q.cubes!, n);
      update({
        cubes: n,
        status: a === 0 ? tx("balance.status.level") : a < 0 ? tx("balance.status.tooFew", { thing: massName(q.left) }) : tx("balance.status.tooMany"),
      });
    };
    board = (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-surface p-3 shadow-inner" data-testid="balance-bench">
          <PanBalance angle={angle} motionOK={motionOK} left={thingOnPan(q.left)} right={cubeStack} />
          <p className="text-center text-sm font-bold text-body" aria-live="polite">{tx("balance.cubeCount", { count: String(play.cubes) })}</p>
          {rung >= 2 && !level && (
            <p className="text-center text-sm font-bold text-rose-600 dark:text-rose-300" data-testid="down-mark">
              {angle < 0 ? tx("balance.status.tooFew", { thing: massName(q.left) }) : tx("balance.status.tooMany")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={locked || play.cubes === 0} onClick={() => setCubes(play.cubes - 1)}
            className="min-h-11 rounded-2xl border-2 border-line bg-surface px-4 py-2 font-bold text-ink disabled:opacity-40">
            {tx("balance.takeCube")}
          </button>
          <button type="button" disabled={locked || play.cubes >= 12} onClick={() => setCubes(play.cubes + 1)}
            className="min-h-11 rounded-2xl border-2 border-violet-400 bg-violet-50 px-4 py-2 font-bold text-violet-800 disabled:opacity-40 dark:bg-violet-950/40 dark:text-violet-200">
            {tx("balance.addCube")}
          </button>
        </div>
        <button type="button" disabled={locked || play.cubes === 0} onClick={() => submit(String(play.cubes))}
          className="mx-auto min-h-11 rounded-2xl bg-violet-600 px-6 py-2 font-bold text-white shadow disabled:opacity-40">
          {tx("balance.balances")}
        </button>
      </div>
    );
  }

  const canStartOver = !locked && (play.weighed || play.cubes > 0);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("balance.weigh")}
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
      onStartOver={canStartOver ? () => setStored(fresh()) : undefined}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-motion={motionOK ? "on" : "off"}>
        {board}
        <p className="min-h-6 text-center text-base font-semibold text-body" aria-live="polite">{play.status}</p>
        {!practising && <HowToPlayButton onClick={demo.show} />}
      </div>
      <HowToPlay
        open={demo.open}
        steps={balanceDemoSteps()}
        scene={(step, phase) => <BalanceDemoScene step={step} phase={phase} motionOK={motionOK} />}
        onClose={demo.close}
        speak={sayCaption}
      />
    </SkillRound>
  );
};
