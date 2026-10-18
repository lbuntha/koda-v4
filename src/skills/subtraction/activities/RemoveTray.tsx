import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  isPractice,
  modeAt,
  playCopy,
  stagger,
  useSkillRound,
  useSpokenFinish,
  type PracticeSetup,
  type RoundQuestion,
  answerChoices,
  guideSetup,
  useGuide,
} from "../../kit";
import { SvgAsset } from "../../../assets/svg";
import { themeSystem } from "../../../lib/themeSystem";
import { COUNTABLES, type Countable } from "../internal/data/subtractionAssets";
import { DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { COUNT_BADGE, HELD, REMOVED, SCENE, TOKEN_COMPACT, ZONE } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey,
  drawDifference,
  numberWord as say,
  pick,
  shuffle,
  withoutRepeat,
  type Difference,
  type DifferenceSpec,
} from "../internal/data/subtractionNumbers";
import { ts } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

export type TrayMode =
  | "remove"
  | "remainder"
  | "separate"
  | "match_groups"
  | "equation_match"
  | "count_back"
  | "subtract_zero"
  | "subtract_all"
  | "subtract_one"
  | "fingers";

export interface TraySetup extends PracticeSetup {
  mode?: TrayMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  questionsPerRound?: number;
  settleMs?: number;
}

export interface RemoveTrayParams extends TraySetup {
  question?: TraySetup;
}

export interface TrayQuestion extends RoundQuestion {
  mode: TrayMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  asset: Countable;
}

const DEFAULT_SPEC: Record<TrayMode, DifferenceSpec> = {
  remove: { minuendRange: [2, 10], subtrahendRange: [1, 9], differenceRange: [1, 9], excludeEqual: true },
  remainder: { minuendRange: [3, 10], subtrahendRange: [1, 9], differenceRange: [1, 9], excludeEqual: true },
  separate: { minuendRange: [3, 10], subtrahendRange: [1, 9], differenceRange: [1, 9], excludeEqual: true },
  match_groups: { minuendRange: [3, 10], subtrahendRange: [2, 9], differenceRange: [1, 8], excludeEqual: true },
  equation_match: { minuendRange: [2, 10], subtrahendRange: [1, 9], differenceRange: [0, 9] },
  count_back: { minuendRange: [4, 15], subtrahendRange: [1, 3], smallSubtrahend: true },
  subtract_zero: { minuendRange: [0, 20], subtrahendRange: [0, 0] },
  subtract_all: { minuendRange: [1, 20], differenceRange: [0, 0] },
  subtract_one: { minuendRange: [1, 20], subtrahendRange: [1, 1] },
  fingers: { minuendRange: [1, 10], subtrahendRange: [1, 10] },
};

const declared = (setup: TraySetup): DifferenceSpec => {
  const spec: DifferenceSpec = {};
  if (setup.minuendRange) spec.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) spec.subtrahendRange = setup.subtrahendRange;
  if (setup.differenceRange) spec.differenceRange = setup.differenceRange;
  return spec;
};

export const specFor = (mode: TrayMode, setup: TraySetup): DifferenceSpec => {
  const spec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  if (mode === "subtract_zero") spec.subtrahendRange = [0, 0];
  if (mode === "subtract_one") spec.subtrahendRange = [1, 1];
  if (mode === "subtract_all") spec.differenceRange = [0, 0];
  if (mode === "count_back") spec.smallSubtrahend = true;
  return spec;
};

export const buildQuestion = (setup: TraySetup, index: number, seen: Set<string>): TrayQuestion => {
  const mode = modeAt<TrayMode>(setup, index, "remove");
  const drawn = withoutRepeat<Difference>(
    () => drawDifference(specFor(mode, setup)),
    differenceKey,
    seen,
  );
  return {
    id: `q${index}-${Date.now().toString(36)}`,
    taskKind: `subtract_${mode}`,
    mode,
    ...drawn,
    asset: pick(COUNTABLES),
    expected: mode === "equation_match"
      ? `${drawn.minuend} − ${drawn.subtrahend} = ${drawn.difference}`
      : String(drawn.difference),
    itemCount: drawn.minuend,
  };
};

export const promptFor = (q: TrayQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.minuend))
    .replaceAll("{b}", String(q.subtrahend))
    .replaceAll("{difference}", String(q.difference))
    .replaceAll("{item}", q.asset.name);
  if (filled) return filled;
  switch (q.mode) {
    case "remainder": return ts("tray.promptRemainder");
    case "separate": return ts("tray.promptSeparate", { b: q.subtrahend, items: q.asset.name });
    case "match_groups": return ts("tray.promptMatch");
    case "equation_match": return ts("tray.promptEquation");
    case "count_back": return ts("tray.promptCountBack", { a: q.minuend, b: q.subtrahend });
    case "subtract_zero": return ts("tray.promptZero", { a: q.minuend });
    case "subtract_all": return ts("tray.promptAll", { a: q.minuend });
    case "subtract_one": return ts("tray.promptOne", { a: q.minuend });
    case "fingers": return ts("tray.promptFingers", { a: q.minuend, b: q.subtrahend });
    default: return ts("tray.prompt", { b: q.subtrahend, items: q.asset.name });
  }
};

export const printedFor = (q: TrayQuestion): PrintedQuestion => ({
  text: q.mode === "match_groups"
    ? ts("tray.printedMatch", { a: q.minuend, b: q.subtrahend })
    : q.mode === "fingers"
      ? ts("tray.printedFingers", { a: q.minuend, b: q.subtrahend })
      : `${q.minuend} − ${q.subtrahend} =`,
  answer: String(q.difference),
});

export const methodFor = (q: TrayQuestion): string[] => {
  switch (q.mode) {
    case "match_groups": return [ts("tray.mMatch1"), ts("tray.mMatch2"), ts("tray.mMatch3")];
    case "count_back": return [ts("tray.mBack1"), ts("tray.mBack2", { b: q.subtrahend }), ts("tray.mBack3")];
    case "subtract_zero": return [ts("tray.mZero1"), ts("tray.mZero2")];
    case "subtract_all": return [ts("tray.mAll1"), ts("tray.mAll2")];
    case "subtract_one": return [ts("tray.mOne1"), ts("tray.mOne2")];
    case "fingers": return [ts("tray.mFingers1"), ts("tray.mFingers2"), ts("tray.mFingers3")];
    default: return [ts("tray.m1"), ts("tray.m2", { b: q.subtrahend }), ts("tray.m3")];
  }
};

/** Four near misses, ordered by the question so they cannot be learned by position. */
export const choicesFor = (answer: number, seed: string): number[] => answerChoices(answer, seed);

export const equationChoicesFor = (q: TrayQuestion): string[] => shuffle([
  `${q.minuend} − ${q.subtrahend} = ${q.difference}`,
  `${q.minuend} + ${q.subtrahend} = ${q.difference}`,
  `${q.minuend} − ${q.subtrahend} = ${q.difference + 1}`,
  `${q.subtrahend} − ${q.minuend} = ${q.difference}`,
]);

export function trayHints(q: TrayQuestion, state: {
  removed: number;
  counted: number;
  paired: number;
  countValue: number;
  fingersUp: number;
  kidTip?: string;
}): string[] {
  const one = q.asset.one;
  switch (q.mode) {
    case "remainder":
      return composeHints(
        state.kidTip ?? ts("tray.hRemainderTip"),
        state.counted === 0 ? ts("tray.hStartWith", { one }) : ts("tray.hCountedSoFar", { counted: state.counted }),
        ts("tray.hTakenFrom", { b: q.subtrahend, a: q.minuend, difference: q.difference }),
      );
    case "separate":
      return composeHints(
        state.kidTip ?? ts("tray.hSeparateTip"),
        ts("tray.hSeparated", { removed: state.removed, left: q.subtrahend - state.removed }),
        ts("tray.hSeparates", { a: q.minuend, b: q.subtrahend, difference: q.difference }),
      );
    case "match_groups":
      return composeHints(
        state.kidTip ?? ts("tray.hMatchTip"),
        ts("tray.hPairs", { paired: state.paired }),
        ts("tray.hUnmatched", { b: q.subtrahend, difference: q.difference }),
      );
    case "count_back":
      return composeHints(
        state.kidTip ?? ts("tray.hBackTip"),
        ts("tray.hMoved", { at: state.countValue, moved: q.minuend - state.countValue, b: q.subtrahend }),
        ts("tray.hBackRun", { a: q.minuend, run: Array.from({ length: q.subtrahend }, (_, i) => q.minuend - i - 1).join(", ") }),
      );
    case "subtract_zero":
      return composeHints(state.kidTip ?? ts("tray.hZeroTip"), ts("tray.hZero2"), ts("tray.hZero3"));
    case "subtract_all":
      return composeHints(state.kidTip ?? ts("tray.hAllTip"), ts("tray.hAll2"), ts("tray.hAll3"));
    case "subtract_one":
      return composeHints(state.kidTip ?? ts("tray.hOneTip"), ts("tray.hOne2", { a: q.minuend }), ts("tray.hOne3"));
    case "fingers":
      return composeHints(
        state.kidTip ?? ts("tray.hFingersTip"),
        ts("tray.hRaised", { up: state.fingersUp }),
        ts("tray.hLowered", { a: q.minuend, b: q.subtrahend, difference: q.difference }),
      );
    case "equation_match":
      return composeHints(state.kidTip ?? ts("tray.hEquationTip"), ts("tray.hLookFor", { a: q.minuend, b: q.subtrahend }), ts("tray.hEquals"));
    default:
      return composeHints(
        state.kidTip ?? ts("tray.hTip"),
        ts("tray.hTakenSoFar", { removed: state.removed, left: q.subtrahend - state.removed }),
        ts("tray.hLeaves", { a: q.minuend, b: q.subtrahend, difference: q.difference }),
      );
  }
}

const ICONS: Record<TrayMode, string> = {
  remove: "boxes", remainder: "search", separate: "layers", match_groups: "scale",
  equation_match: "circleDot", count_back: "footprints", subtract_zero: "circleDot",
  subtract_all: "sparkles", subtract_one: "zap", fingers: "sparkles",
};

const Token: React.FC<{
  asset: Countable;
  label: string;
  state?: "removed" | "separated" | "held" | "counted" | "paired";
  badge?: number;
  badges: boolean;
  onTap?: () => void;
  /** The one the coach is pointing at. */
  lit?: boolean;
  delay?: number;
}> = ({ asset, label, state, badge, badges, onTap, lit = false, delay = 0 }) => {
  const shell = `relative ${TOKEN_COMPACT} flex items-center justify-center rounded-2xl ${
    state === "removed" ? REMOVED : state === "separated" ? "ring-4 ring-rose-400/60 translate-y-1" : state === "held" ? HELD : state === "paired" ? "ring-4 ring-sky-400/60 opacity-55" : state === "counted" ? "opacity-55" : ""
  }`;
  const face = <>
    <span className="block w-full h-full drop-shadow-[0_3px_8px_rgba(0,0,0,0.16)]"><SvgAsset id={asset.id} size="100%" title={asset.one} /></span>
    {badges && badge !== undefined && <span className={`${COUNT_BADGE} ${state === "removed" || state === "separated" ? REMOVED_PART.solid : DIFFERENCE.solid} text-white`}>{badge}</span>}
  </>;
  if (!onTap) return <div className={shell} role="img" aria-label={label}>{face}</div>;
  return <motion.button type="button" onClick={onTap}
    aria-label={lit ? ts("tray.touchNext", { label }) : label}
    aria-pressed={Boolean(state)} className={`${shell}${lit ? " ring-4 ring-indigo-500 animate-pulse" : ""}`}
    initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING.enter, delay }}
    whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.86 }}>{face}</motion.button>;
};

const Hand: React.FC<{ total: number; up: number; onToggle: (n: number) => void }> = ({ total, up, onToggle }) => (
  <div className="flex flex-wrap justify-center gap-2 max-w-[380px]" aria-label={ts("tray.fingersRaised", { up })}>
    {Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      const raised = n <= up;
      return <motion.button key={n} type="button" onClick={() => onToggle(n)} aria-label={ts(raised ? "tray.fingerRaised" : "tray.fingerLowered", { n })} aria-pressed={raised}
        className={`w-11 min-h-20 rounded-t-full border-2 ${raised ? `${WHOLE.solid} border-violet-300` : "h-12 self-end bg-surface border-line opacity-55"}`}
        whileTap={{ scale: 0.9 }} transition={SPRING.tap} />;
    })}
  </div>
);

export const RemoveTray: React.FC<ActivityProps<RemoveTrayParams>> = ({ params, koda, onComplete, lesson }) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: TraySetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());
  const [removed, setRemoved] = useState<number[]>([]);
  const [counted, setCounted] = useState<number[]>([]);
  const [selectedTop, setSelectedTop] = useState<number>();
  const [pairs, setPairs] = useState<number>(0);
  const [countValue, setCountValue] = useState<number>(0);
  const [fingersUp, setFingersUp] = useState<number>(0);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const finishing = useSpokenFinish({ floorMs: setup.settleMs });

  const round = useSkillRound({
    koda,
    resumable: practising,
    totalQuestions,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => {
      void koda.progress.nextStep().then((value) => setNextStep(value));
      onComplete(result);
    },
  });
  const q = round.question as TrayQuestion;

  useEffect(() => {
    finishing.cancel();
    setRemoved([]);
    setCounted([]);
    setSelectedTop(undefined);
    setPairs(0);
    setCountValue(q.minuend);
    setFingersUp(q.minuend);
    nudge.clear();
  }, [q.id, q.minuend, finishing, nudge.clear]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    finishing.cancel();
    setRemoved([]);
    setCounted([]);
    setSelectedTop(undefined);
    setPairs(0);
    setCountValue(q.minuend);
    setFingersUp(q.minuend);
    nudge.clear();
  };


  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const badges = koda.config.isEnabled("counting_badges", true);
  const showsDifference = koda.config.isEnabled("running_difference_badge", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);

  const undoLastMove = () => {
    setRemoved((items) => items.slice(0, -1));
    chime(koda, "undone");
    koda.haptics.tap();
  };

  const feedback = (kind: "tap" | "success" | "error") => {
    // Only the tap sounds. A judged answer is spoken by the shared reaction,
    // and Addition adds no chime of its own on top of it.
    if (kind === "tap") chime(koda, "moved");
    if (kind === "success") koda.haptics.success();
    else koda.haptics.tap();
  };
  const sayNumber = (n: number): Promise<void> => speaks
    ? koda.speech.say(say(n), speechRate(koda)).catch(() => {})
    : Promise.resolve();
  const submit = (given: string, correct: boolean, message: string) => {
    feedback(correct ? "success" : "error");
    round.submit({
      correct,
      given,
      expected: q.expected,
      errorKind: correct ? undefined : "off_by_more",
      title: correct ? ts("tray.rightTitle") : ts("tray.lookOnce"),
      message: practising ? undefined : message,
    });
  };
  const choose = (value: number) => submit(String(value), value === q.difference, ts("aMinusBIs", { a: q.minuend, b: q.subtrahend, difference: q.difference }));

  const take = (i: number) => {
    if (stateFor(i) !== undefined) guide.stumbled();
    else guide.moved();
    if (round.feedback || removed.includes(i)) return;
    if (removed.length >= q.subtrahend) {
      nudge.refuse(ts("tray.refuseEnough", { b: q.subtrahend }));
      return;
    }
    setRemoved((items) => [...items, i]);
    feedback("tap");
    if (speaks) void koda.speech.say(ts("tray.saidTakeOne"), speechRate(koda));
  };

  const countRemainder = (i: number) => {
    if (round.feedback || counted.includes(i)) return;
    const next = [...counted, i];
    setCounted(next);
    feedback("tap");
    const spoken = sayNumber(next.length);
    if (next.length === q.difference) {
      finishing.after(spoken, () => submit(String(next.length), true, ts("tray.objectsRemain", { difference: q.difference })));
    }
  };

  const countBack = () => {
    const moved = q.minuend - countValue;
    if (moved >= q.subtrahend || round.feedback) return;
    const next = countValue - 1;
    setCountValue(next);
    feedback("tap");
    const spoken = sayNumber(next);
    if (moved + 1 === q.subtrahend) finishing.after(spoken, () => submit(String(next), true, ts("tray.landedOn", { difference: q.difference })));
  };

  const pairBottom = (i: number) => {
    if (selectedTop === undefined) {
      nudge.refuse(ts("tray.refuseMatch"));
      return;
    }
    if (i < pairs) return;
    setPairs((n) => n + 1);
    setSelectedTop(undefined);
    feedback("tap");
  };

  const ready = removed.length === q.subtrahend;
  const answerChoices = choicesFor(q.difference, q.id);
  const equationChoices = useRef(new Map<string, string[]>());
  if (!equationChoices.current.has(q.id)) equationChoices.current.set(q.id, equationChoicesFor(q));
  const prompt = promptFor(q, copy.prompts?.default);
  const stateFor = (i: number): "removed" | "counted" | "held" | "paired" | undefined => {
    if (removed.includes(i)) return "removed";
    if (counted.includes(i)) return "counted";
    if (selectedTop === i) return "held";
    return undefined;
  };

  const wholeTokens = (mode: "take" | "count" | "separate") => (
    <div className="flex flex-wrap justify-center gap-2 max-w-[430px]">
      {Array.from({ length: q.minuend }, (_, i) => {
        const preRemoved = mode === "count" && i < q.subtrahend;
        const state = preRemoved ? "removed" : stateFor(i);
        const onTap = preRemoved ? undefined : mode === "count" ? () => countRemainder(i) : () => take(i);
        return <Token key={i} asset={q.asset}
          label={state ? ts("tray.tokenState", { one: q.asset.one, n: i + 1, state: ts(`tray.state.${state}`) }) : ts("tray.token", { one: q.asset.one, n: i + 1 })}
          state={state} badge={state === "removed" ? (preRemoved ? i + 1 : removed.indexOf(i) + 1) : state === "counted" ? counted.indexOf(i) + 1 : undefined}
          badges={badges} onTap={round.feedback ? undefined : onTap}
          lit={guide.target === i && onTap !== undefined} delay={stagger(i)} />;
      })}
    </div>
  );

  const separationModel = (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full max-w-[580px]">
      <div className={`${ZONE} ${WHOLE.soft} min-h-[150px]`}>
        <div className={`mb-3 text-center text-xs font-bold uppercase tracking-wide ${WHOLE.text}`}>{ts("tray.wholeArea")}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {Array.from({ length: q.minuend }, (_, i) => removed.includes(i) ? null : (
            <Token key={i} asset={q.asset} label={ts("tray.token", { one: q.asset.one, n: i + 1 })} badges={badges}
              onTap={round.feedback ? undefined : () => take(i)} delay={stagger(i)} />
          ))}
        </div>
      </div>
      <div className={`${ZONE} ${REMOVED_PART.soft} min-h-[150px]`}>
        <div className={`mb-3 text-center text-xs font-bold uppercase tracking-wide ${REMOVED_PART.text}`}>{ts("tray.separatedPart")}</div>
        <div className="flex flex-wrap justify-center gap-2">
          {removed.map((source, i) => <Token key={source} asset={q.asset}
            label={ts("tray.separatedToken", { one: q.asset.one, n: i + 1 })} state="separated" badge={i + 1} badges={badges} />)}
        </div>
      </div>
    </div>
  );

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : trayHints(q, { removed: removed.length, counted: counted.length, paired: pairs, countValue, fingersUp, kidTip: copy.kidTip });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: q.id,
    rungs: hints,
    /*
     * The next object to act on: the first one still untouched.
     *
     * `count` mode has the taken-away ones already crossed off, so the first
     * *countable* one is what matters there — pointing at a crossed-out object
     * would send a child to recount what has already gone.
     */
    target: Array.from({ length: q.minuend }, (_, i) => i).find(
      (i) => stateFor(i) === undefined && !(q.mode === "remainder" && i < q.subtrahend),
    ) ?? -1,
    /*
     * What the learner has done, measured against how the question started.
     *
     * The fingers begin *all raised* — lowering them is the technique — so
     * counting them as effort told the coach a child who had touched nothing
     * was already mid-flow, and it stepped in at five seconds instead of seven.
     */
    progress: removed.length + counted.length + pairs + (q.minuend - fingersUp),
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return <SkillRound
    koda={koda} lesson={lesson} fallbackTitle={ts("tray.title")} round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName={ICONS[q.mode]} iconTone="purple"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={hints}
    guide={practising ? undefined : guide}
    guideMethod={copy.stepByStep}
    onStartOver={
      !round.feedback && (removed.length > 0 || counted.length > 0 || pairs > 0 || selectedTop !== undefined) ? restart : undefined
    }
    onExit={koda.ui.exit}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}
    recommendation={nextStep}
  >
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-6 min-h-[230px] flex flex-col items-center justify-center gap-4`}>
        {q.mode === "remove" && wholeTokens("take")}
        {q.mode === "separate" && separationModel}
        {q.mode === "remainder" && wholeTokens("count")}

        {q.mode === "match_groups" && <div className="space-y-5">
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: q.minuend }, (_, i) => <Token key={`a${i}`} asset={q.asset} badges={badges}
              label={ts(i < pairs ? "tray.largerPaired" : "tray.larger", { one: q.asset.one, n: i + 1 })}
              state={i < pairs ? "paired" : selectedTop === i ? "held" : undefined}
              onTap={!round.feedback && i >= pairs ? () => setSelectedTop(i) : undefined} delay={stagger(i)} />)}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: q.subtrahend }, (_, i) => <Token key={`b${i}`} asset={q.asset} badges={badges}
              label={ts(i < pairs ? "tray.smallerPaired" : "tray.smaller", { one: q.asset.one, n: i + 1 })}
              state={i < pairs ? "paired" : undefined} badge={i < pairs ? i + 1 : undefined}
              onTap={!round.feedback && i >= pairs ? () => pairBottom(i) : undefined} delay={stagger(i)} />)}
          </div>
        </div>}

        {q.mode === "equation_match" && <div className="flex items-center gap-1 sm:gap-5 max-w-full">
          <div className={`rounded-2xl px-2 py-2 sm:px-4 sm:py-3 ${WHOLE.soft} text-center`}><strong className={`text-3xl sm:text-4xl ${WHOLE.text}`}>{q.minuend}</strong><div className="text-[9px] sm:text-xs font-bold">{ts("tray.started")}</div></div>
          <span className="text-2xl sm:text-4xl font-black text-ink/30">−</span>
          <div className={`rounded-2xl px-2 py-2 sm:px-4 sm:py-3 ${REMOVED_PART.soft} text-center`}><strong className={`text-3xl sm:text-4xl ${REMOVED_PART.text}`}>{q.subtrahend}</strong><div className="text-[9px] sm:text-xs font-bold">{ts("tray.removed")}</div></div>
          <span className="text-2xl sm:text-4xl font-black text-ink/30">=</span>
          <div className={`rounded-2xl px-2 py-2 sm:px-4 sm:py-3 ${DIFFERENCE.soft} text-center`}><strong className={`text-3xl sm:text-4xl ${DIFFERENCE.text}`}>{q.difference}</strong><div className="text-[9px] sm:text-xs font-bold">{ts("tray.remains")}</div></div>
        </div>}

        {q.mode === "count_back" && <div className="flex flex-col items-center gap-5">
          <motion.span key={countValue} initial={{ scale: 0.7 }} animate={{ scale: 1 }} className={`text-7xl font-black tabular-nums ${DIFFERENCE.text}`}>{countValue}</motion.span>
          <div className="flex gap-2" aria-label={ts("tray.stepsDone", { done: q.minuend - countValue, b: q.subtrahend })}>
            {Array.from({ length: q.subtrahend }, (_, i) => <span key={i} className={`w-11 h-2 rounded-full ${i < q.minuend - countValue ? DIFFERENCE.solid : "bg-ink/15"}`} />)}
          </div>
        </div>}

        {(q.mode === "subtract_zero" || q.mode === "subtract_all" || q.mode === "subtract_one") && <div className="text-center">
          <div className="text-6xl font-black tabular-nums text-ink">{q.minuend} <span className={REMOVED_PART.text}>− {q.subtrahend}</span></div>
          <div className="mt-3 text-sm font-bold text-ink/55">{ts(q.mode === "subtract_zero" ? "tray.nothingLeaves" : q.mode === "subtract_all" ? "tray.allLeaves" : "tray.oneLeaves")}</div>
        </div>}

        {q.mode === "fingers" && <Hand total={q.minuend} up={fingersUp} onToggle={(n) => {
          if (round.feedback) return;
          const next = n <= fingersUp ? n - 1 : n;
          setFingersUp(next);
          feedback("tap");
        }} />}

        {showsDifference && (removed.length > 0 || counted.length > 0 || pairs > 0) && <div aria-live="polite" className={`text-3xl font-black tabular-nums ${DIFFERENCE.text}`}>
          {q.mode === "remainder" ? counted.length : q.mode === "match_groups" ? q.minuend - pairs : q.minuend - removed.length}
          <span className="ml-2 text-xs uppercase tracking-wide text-ink/50">{ts(q.mode === "match_groups" ? "tray.unmatched" : "tray.remain")}</span>
        </div>}
        {scaffold && !practising && q.mode === "separate" && <div className={`${ZONE} ${REMOVED_PART.soft} text-sm font-bold`}>{ts("tray.moveMore", { left: q.subtrahend - removed.length })}</div>}
      </div>

      {(q.mode === "remove" || q.mode === "separate") && removed.length > 0 && !round.feedback && <div className="flex justify-center">
        <button type="button" onClick={undoLastMove} className={themeSystem.button("ghost", "sm")}>{ts("tray.undoMove")}</button>
      </div>}
      {q.mode === "match_groups" && pairs > 0 && !round.feedback && <div className="flex justify-center">
        <button type="button" onClick={() => setPairs((n) => n - 1)} className={themeSystem.button("ghost", "sm")}>{ts("tray.undoPair")}</button>
      </div>}

      {q.mode === "count_back" && <div className="flex justify-center"><motion.button type="button" onClick={countBack} disabled={Boolean(round.feedback) || countValue === q.difference} className={themeSystem.button("primary", "lg")} whileTap={{ scale: 0.92 }}>{ts("tray.countBackOne")}</motion.button></div>}

      {q.mode === "fingers" && <div className="flex justify-center"><motion.button type="button" onClick={() => {
        if (fingersUp === q.minuend) { nudge.refuse(ts("tray.refuseLower", { b: q.subtrahend })); return; }
        choose(fingersUp);
      }} className={themeSystem.button("primary", "lg")} whileTap={{ scale: 0.92 }}>{ts("check")}</motion.button></div>}

      {q.mode === "equation_match" && <div className="flex flex-wrap justify-center gap-2.5">
        {equationChoices.current.get(q.id)!.map((value) => <button key={value} type="button" onClick={() => submit(value, value === q.expected, ts("tray.equals", { a: q.minuend, b: q.subtrahend, difference: q.difference }))} disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>{value}</button>)}
      </div>}

      {((q.mode === "remove" || q.mode === "separate") && ready || q.mode === "match_groups" && pairs === q.subtrahend || q.mode === "subtract_zero" || q.mode === "subtract_all" || q.mode === "subtract_one") && <div className="flex flex-wrap justify-center gap-2.5">
        {answerChoices.map((value) => <button key={value} type="button" onClick={() => choose(value)} disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>{value}</button>)}
      </div>}
    </div>
  </SkillRound>;
};
