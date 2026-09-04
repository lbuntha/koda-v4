import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { COMPARISON, DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { SCENE, TOUCH_TARGET } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  cardFor, comparisonPair, strategiesFor, STRATEGY_CARDS,
  type StrategyCard, type StrategyId,
} from "../internal/data/strategyCards";
import {
  differenceKey, drawDifference, shuffle, withoutRepeat,
  type Difference, type DifferenceSpec,
} from "../internal/data/subtractionNumbers";

export type StrategyMode = "compare_paths";

export interface StrategySetup extends PracticeSetup {
  mode?: StrategyMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  questionsPerRound?: number;
}

export interface StrategyPickerParams extends StrategySetup { question?: StrategySetup }

export interface StrategyQuestion extends RoundQuestion {
  mode: StrategyMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  /** Every strategy that genuinely fits — all of them are accepted. */
  fits: StrategyId[];
  offered: StrategyId[];
  /** The two worked paths compared after a choice is made. */
  pair: [StrategyCard, StrategyCard];
}

const DEFAULT_SPEC: DifferenceSpec = { minuendRange: [20, 99], subtrahendRange: [2, 89], excludeEqual: true };

export const specFor = (setup: StrategySetup): DifferenceSpec => ({
  ...DEFAULT_SPEC,
  ...(setup.minuendRange ? { minuendRange: setup.minuendRange } : {}),
  ...(setup.subtrahendRange ? { subtrahendRange: setup.subtrahendRange } : {}),
  excludeEqual: true,
});

export const buildQuestion = (setup: StrategySetup, index: number, seen: Set<string>): StrategyQuestion => {
  modeAt<StrategyMode>(setup, index, "compare_paths");
  // A question worth asking has at least two paths; one fit means there is no
  // choice to make and the lesson is a quiz about a single method.
  const value = withoutRepeat<Difference>(() => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const drawn = drawDifference(specFor(setup));
      if (strategiesFor(drawn).length >= 2) return drawn;
    }
    return drawDifference(specFor(setup));
  }, differenceKey, seen);

  const fits = strategiesFor(value);
  const misfits = STRATEGY_CARDS.map((card) => card.id).filter((id) => !fits.includes(id));
  const offered = shuffle([...fits.slice(0, 3), ...misfits.slice(0, 2)]);
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: "subtract_strategy_compare",
    mode: "compare_paths", ...value, fits, offered, pair: comparisonPair(value, fits),
    expected: fits.join("|"), itemCount: value.minuend,
  };
};

export const promptFor = (q: StrategyQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  return filled ?? `${q.minuend} minus ${q.subtrahend}. Which way would you do it?`;
};

export const printedFor = (q: StrategyQuestion): PrintedQuestion => ({
  text: `${q.minuend} − ${q.subtrahend} = □. Name a strategy that suits these numbers and say why.`,
  answer: `${q.difference} — any of: ${q.fits.map((id) => cardFor(id).name).join(", ")}`,
});

export const methodFor = (q: StrategyQuestion): string[] => [
  "Look at the numbers before choosing a method.",
  `Here, ${cardFor(q.pair[0].id).name.toLowerCase()} takes about ${q.pair[0].steps(q)} steps.`,
  "More than one way is right; prefer the one with fewer steps.",
];

export function strategyHints(
  q: StrategyQuestion,
  state: { chosen?: StrategyId; kidTip?: string },
): string[] {
  return composeHints(
    state.kidTip ?? "Look at the numbers before you choose a method.",
    state.chosen
      ? `${cardFor(state.chosen).name} fits. Now compare it with another way that also works.`
      : q.difference <= 5
        ? `${q.subtrahend} and ${q.minuend} are close together, so counting up is short.`
        : `${q.subtrahend} is the part being taken away. Ask what shape it has before you start.`,
    `More than one strategy fits here: ${q.fits.map((id) => cardFor(id).name).join(", ")}.`,
  );
}

export const StrategyPicker: React.FC<ActivityProps<StrategyPickerParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: StrategySetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [chosen, setChosen] = useState<StrategyId>();
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 52,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as StrategyQuestion;

  useEffect(() => { setChosen(undefined); nudge.clear(); }, [q.id, nudge.clear]);

  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);

  /**
   * Every fitting strategy is right.
   *
   * Marking one "the" answer would teach that methods have owners rather than
   * uses, so the answer is scored on whether the chosen strategy suits these
   * numbers — and the comparison afterwards is about steps, between two paths
   * that both work.
   */
  const choose = (id: StrategyId) => {
    if (round.feedback) return;
    const correct = q.fits.includes(id);
    setChosen(id);
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({
      correct, given: id, expected: q.expected, errorKind: correct ? undefined : "off_by_more",
      title: correct ? "That way works here!" : "That one fights the numbers",
      message: practising ? undefined
        : correct
          ? `${cardFor(id).name} suits ${q.minuend} minus ${q.subtrahend}. So would: ${q.fits.filter((other) => other !== id).map((other) => cardFor(other).name).join(", ") || "nothing else here"}.`
          : `${cardFor(id).name} works in general, but not well here. These numbers suit ${q.fits.map((other) => cardFor(other).name).join(" or ")}.`,
    });
  };

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Choose a Strategy" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="scale" iconTone="emerald"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : strategyHints(q, { chosen, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-7 space-y-4`}>
        <div className="text-center text-4xl font-black tabular-nums">
          <span className={WHOLE.text}>{q.minuend}</span><span className="text-ink/30"> − </span><span className={REMOVED_PART.text}>{q.subtrahend}</span>
        </div>

        {round.feedback && <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.enter}
          className="mx-auto max-w-md space-y-2" role="group" aria-label="Two worked paths compared">
          {q.pair.map((card, i) => <div key={card.id} className={`rounded-2xl border-2 p-3 ${i === 0 ? `${DIFFERENCE.soft} ${DIFFERENCE.border}` : `${COMPARISON.soft} ${COMPARISON.border}`}`}>
            <div className={`text-sm font-black ${i === 0 ? DIFFERENCE.text : COMPARISON.text}`}>{card.name} · about {card.steps(q)} steps</div>
            <div className="text-xs font-bold text-ink/60">{card.how}</div>
          </div>)}
          <p className="text-center text-xs font-bold text-ink/55">Both are correct. The shorter path is not the only right one — it is the one these numbers reward.</p>
        </motion.div>}

        {scaffold && !practising && !round.feedback && <div className="text-center text-sm font-bold text-ink/60">
          More than one of these fits. Choose the one the numbers suit.
        </div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {q.offered.map((id) => {
          const card = cardFor(id);
          return <button key={id} type="button" onClick={() => choose(id)} disabled={Boolean(round.feedback)}
            aria-label={`${card.name}: ${card.how}`}
            className={`${TOUCH_TARGET} text-left ${themeSystem.button("secondary", "md")} ${chosen === id ? "ring-4 ring-violet-400/60" : ""}`}>
            {/* One column inside the button, not two `block` children of it:
                `themeSystem.button` is `inline-flex … justify-center`, so the
                name and the description became columns side by side and
                "Count up" was squeezed into a two-line sliver at 360px. */}
            <span className="flex w-full flex-col items-start gap-0.5 text-left">
              <span className="text-sm font-black leading-tight">{card.name}</span>
              <span className="text-[11px] font-bold leading-snug opacity-70">{card.how}</span>
            </span>
          </button>;
        })}
      </div>
    </div>
  </SkillRound>;
};
