import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy, stagger,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { FRAME_CELL, SCENE } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, drawDifference, withoutRepeat, type Difference, type DifferenceSpec,
} from "../internal/data/subtractionNumbers";

export type FrameMode = "five" | "ten" | "from_five" | "from_ten";

export interface FrameSetup extends PracticeSetup {
  mode?: FrameMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  questionsPerRound?: number;
}

export interface FrameTakeawayParams extends FrameSetup { question?: FrameSetup }

export interface FrameQuestion extends RoundQuestion {
  mode: FrameMode;
  size: 5 | 10;
  minuend: number;
  subtrahend: number;
  difference: number;
}

/**
 * Recall modes state the fact first.
 *
 * `five` and `ten` build the answer by taking counters out. `from_five` and
 * `from_ten` are the same apparatus asking a different question: the child says
 * what is left, and the frame then crosses the counters out to confirm it. Left
 * tappable they would be levels 11 and 12 again with the minuend pinned, which
 * is the master table's point in naming them "Recall".
 */
export const isRecall = (mode: FrameMode): boolean => mode === "from_five" || mode === "from_ten";

const DEFAULT_SPEC: Record<FrameMode, DifferenceSpec> = {
  five: { minuendRange: [2, 5], subtrahendRange: [1, 4] },
  ten: { minuendRange: [3, 10], subtrahendRange: [1, 9] },
  from_five: { minuendRange: [5, 5], subtrahendRange: [1, 5] },
  from_ten: { minuendRange: [10, 10], subtrahendRange: [1, 10] },
};

const declared = (setup: FrameSetup): DifferenceSpec => {
  const out: DifferenceSpec = {};
  if (setup.minuendRange) out.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) out.subtrahendRange = setup.subtrahendRange;
  if (setup.differenceRange) out.differenceRange = setup.differenceRange;
  return out;
};

export const specFor = (mode: FrameMode, setup: FrameSetup): DifferenceSpec => {
  const spec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  if (mode === "from_five") spec.minuendRange = [5, 5];
  if (mode === "from_ten") spec.minuendRange = [10, 10];
  return spec;
};

export const buildQuestion = (setup: FrameSetup, index: number, seen: Set<string>): FrameQuestion => {
  const mode = modeAt<FrameMode>(setup, index, "ten");
  const value = withoutRepeat<Difference>(() => drawDifference(specFor(mode, setup)), differenceKey, seen);
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_frame_${mode}`,
    mode, size: mode === "five" || mode === "from_five" ? 5 : 10,
    ...value, expected: String(value.difference), itemCount: value.minuend,
  };
};

export const promptFor = (q: FrameQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  if (filled) return filled;
  return isRecall(q.mode)
    ? `${q.minuend} take away ${q.subtrahend}. How many are left?`
    : `Take ${q.subtrahend} counters out of the ${q.size}-frame. How many remain?`;
};

export const printedFor = (q: FrameQuestion): PrintedQuestion => ({
  // A recall question that opens with "cross out five counters" is a counting
  // question again, so on paper the fact comes first and the frame checks it.
  text: isRecall(q.mode)
    ? `${q.minuend} − ${q.subtrahend} =`
    : `Cross out ${q.subtrahend} counters. ${q.minuend} − ${q.subtrahend} =`,
  answer: String(q.difference),
});

export const methodFor = (q: FrameQuestion): string[] => isRecall(q.mode) ? [
  `Recall the partners that make ${q.minuend}.`,
  `Name the partner of ${q.subtrahend}.`,
  `Check it against the ${q.size}-frame.`,
] : [
  `See ${q.minuend} in the ${q.size}-frame.`,
  `Cross out ${q.subtrahend} counters without rearranging the frame.`,
  "Read how many counters remain.",
];

export function frameHints(q: FrameQuestion, state: { removed: number; kidTip?: string }): string[] {
  if (isRecall(q.mode)) return composeHints(
    state.kidTip ?? `Remember the partners that make ${q.minuend}.`,
    `The frame still holds all ${q.minuend}. Say what is left when ${q.subtrahend} go, and it will show you.`,
    `${q.subtrahend} and ${q.difference} are the partners that make ${q.minuend}.`,
  );
  const left = q.subtrahend - state.removed;
  return composeHints(
    state.kidTip ?? "Keep the frame in its rows. Take counters out without moving the others.",
    state.removed === 0
      ? `The frame starts with ${q.minuend}. Take out ${q.subtrahend} counters.`
      : `You have taken out ${state.removed}. Take out ${left} more, then read the counters still filled.`,
    `${q.minuend} counters with ${q.subtrahend} taken out leaves ${q.difference}.`,
  );
}

export const figureFor = (q: FrameQuestion): React.ReactNode => {
  const rows = q.size === 5 ? 1 : 2;
  const cell = 26;
  return <svg viewBox={`0 0 ${5 * cell + 2} ${rows * cell + 2}`} width={5 * cell + 2} height={rows * cell + 2}
    role="img" aria-label={isRecall(q.mode)
      ? `${q.size} frame holding ${q.minuend} counters, to check ${q.minuend} minus ${q.subtrahend}`
      : `${q.size} frame with ${q.minuend} counters; cross out ${q.subtrahend}`} className="text-slate-900">
    <g stroke="currentColor" strokeWidth="1.5" fill="none">
      {Array.from({ length: q.size }, (_, i) => <rect key={i} x={(i % 5) * cell + 1} y={Math.floor(i / 5) * cell + 1} width={cell} height={cell} />)}
    </g>
    {Array.from({ length: q.minuend }, (_, i) => <circle key={i} cx={(i % 5) * cell + 1 + cell / 2} cy={Math.floor(i / 5) * cell + 1 + cell / 2} r={cell / 3} fill="currentColor" />)}
  </svg>;
};

const choicesFor = (answer: number) => Array.from({ length: 4 }, (_, i) => Math.max(0, answer - 2) + i);

export const FrameTakeaway: React.FC<ActivityProps<FrameTakeawayParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: FrameSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [removed, setRemoved] = useState<number[]>([]);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 11,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then(setNextStep); onComplete(result); },
  });
  const q = round.question as FrameQuestion;
  const recall = isRecall(q.mode);

  useEffect(() => { setRemoved([]); nudge.clear(); }, [q.id, nudge.clear]);

  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const badges = koda.config.isEnabled("counting_badges", true);
  const showsDifference = koda.config.isEnabled("running_difference_badge", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const take = (i: number) => {
    if (removed.includes(i) || round.feedback) return;
    if (removed.length >= q.subtrahend) { nudge.refuse(`You have already taken out ${q.subtrahend}. Read what remains.`); return; }
    setRemoved((current) => [...current, i]);
    chime(koda, "moved");
    koda.haptics.tap();
    if (speaks) void koda.speech.say(String(removed.length + 1), speechRate(koda));
  };
  const putBackLast = () => {
    setRemoved((items) => items.slice(0, -1));
    chime(koda, "undone");
    koda.haptics.tap();
  };
  const check = () => {
    if (removed.length !== q.subtrahend) { nudge.refuse(`Take out ${q.subtrahend - removed.length} more before you check.`); return; }
  };
  const choose = (value: number) => {
    // The frame answers back: recall reveals the partner the child just named.
    if (recall) setRemoved(Array.from({ length: q.subtrahend }, (_, i) => i));
    const correct = value === q.difference;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({ correct, given: String(value), expected: q.expected, errorKind: correct ? undefined : "miscounted_items",
      title: correct ? "You read the frame!" : "Look at the filled counters",
      message: practising ? undefined : `${q.minuend} minus ${q.subtrahend} is ${q.difference}.` });
  };
  const ready = removed.length === q.subtrahend;
  const prompt = promptFor(q, copy.prompts?.default);

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Take Away in a Frame" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="boxes" iconTone="purple"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : frameHints(q, { removed: removed.length, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-6 min-h-[230px] flex flex-col items-center justify-center gap-4`}>
        <div className={`grid grid-cols-5 gap-1.5 sm:gap-2 w-full max-w-[430px] ${q.size === 5 ? "grid-rows-1" : "grid-rows-2"}`}
          role={recall ? "img" : undefined}
          aria-label={recall
            ? `${q.size}-frame holding ${q.minuend} counters${removed.length ? `, ${removed.length} crossed out` : ""}`
            : undefined}>
          {Array.from({ length: q.size }, (_, i) => {
            const filled = i < q.minuend;
            const gone = removed.includes(i);
            const interactive = filled && !round.feedback && !recall;
            const cell = `${FRAME_CELL} relative rounded-2xl border-2 flex items-center justify-center ${gone ? `${REMOVED_PART.soft} ${REMOVED_PART.border}` : filled ? `${WHOLE.soft} ${WHOLE.border}` : "bg-surface/70 border-line"}`;
            const enter = { initial: { opacity: 0, scale: 0.7 }, animate: { opacity: 1, scale: 1 }, transition: { ...SPRING.enter, delay: stagger(i) } };
            const contents = <>
              {filled && <span className={`relative block w-2/3 aspect-square rounded-full ${gone ? "bg-rose-300/35 translate-y-1 after:absolute after:left-0 after:right-0 after:top-1/2 after:h-1 after:-rotate-12 after:bg-rose-600" : `${WHOLE.solid} shadow-lg`}`} />}
              {gone && badges && <span className="absolute -top-2 -right-1 w-7 h-7 rounded-full bg-rose-600 text-white text-sm font-black flex items-center justify-center">{removed.indexOf(i) + 1}</span>}
            </>;
            // Nothing in a recall frame is tappable, so nothing in it is a
            // button: the grid reads as the one picture it is.
            return recall
              ? <motion.div key={i} className={cell} {...enter}>{contents}</motion.div>
              : <motion.button key={i} type="button" onClick={interactive ? () => take(i) : undefined} disabled={!interactive}
                aria-label={`Frame space ${i + 1}, ${gone ? "removed" : filled ? "filled" : "empty"}`}
                className={cell} {...enter}>{contents}</motion.button>;
          })}
        </div>
        {showsDifference && removed.length > 0 && <div aria-live="polite" className={`text-4xl font-black tabular-nums ${DIFFERENCE.text}`}>{q.minuend - removed.length}<span className="ml-2 text-xs uppercase text-ink/50">remain</span></div>}
        {scaffold && !practising && <div className="text-sm font-bold text-ink/60">{recall
          ? removed.length > 0
            ? `${q.subtrahend} and ${q.difference} make ${q.minuend}.`
            : `Answer from memory; the frame will show the partner.`
          : `Take out ${Math.max(0, q.subtrahend - removed.length)} more; keep the frame pattern.`}</div>}
      </div>
      {!recall && removed.length > 0 && !round.feedback && <div className="flex justify-center"><button type="button" onClick={putBackLast} className={themeSystem.button("ghost", "sm")}>Put back the last counter</button></div>}
      {!recall && !ready && <div className="flex justify-center"><button type="button" onClick={check} className={themeSystem.button("primary", "lg")}>Check</button></div>}
      {(recall || ready) && <div className="flex flex-wrap justify-center gap-2.5">{choicesFor(q.difference).map((value) => <button key={value} type="button" onClick={() => choose(value)} disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>{value}</button>)}</div>}
    </div>
  </SkillRound>;
};
