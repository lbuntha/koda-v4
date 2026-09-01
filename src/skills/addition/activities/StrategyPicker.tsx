import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { ADDEND_A, ADDEND_B, TOTAL } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import { isPractice, modeAt, type PracticeSetup } from "../../kit";
import { STRATEGIES, byId, fittingFor, type Strategy } from "../internal/data/strategyCards";
import { drawPair, pairKey, shuffle, withoutRepeat, type PairSpec } from "../internal/data/additionNumbers";

/**
 * The last lesson, and the only one with more than one right answer.
 *
 * Every technique before this taught a child *how*. This one asks *which* — and
 * the honest answer is usually "any of these three". So more than one card is
 * accepted, and the feedback names why the one they picked suits these
 * particular numbers, rather than congratulating them for guessing the answer
 * somebody had in mind.
 *
 * Then it asks the question that actually separates strategies: not which is
 * correct, but which took fewer steps. Counting on reaches 67 from 48 + 19 in
 * nineteen moves; rounding and giving back does it in three. Both are right.
 * Seeing the two laid side by side and counted is what "compare strategies"
 * means to an eight-year-old — not an essay.
 */

export type StrategyMode = "compare_paths";

export interface StrategySetup extends PracticeSetup {
  mode?: StrategyMode;
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface StrategyPickerParams extends StrategySetup {
  question?: StrategySetup;
}

export interface StrategyQuestion extends RoundQuestion {
  a: number;
  b: number;
  sum: number;
  /** 1 asks which strategy suits it; 2 compares two of them. */
  step: 1 | 2;
  /** Every strategy worth using here. Any of them is a right answer. */
  fitting: string[];
  /** The cards on offer — the good ones, and ones that do not suit. */
  options: Strategy[];
  /** Step 2: the two routes being compared, worked out. */
  paths?: { id: string; name: string; lines: string[] }[];
  /** Step 2: which of the two took fewer moves. */
  shorter?: string;
}

/** Numbers with at least one clever route, or the lesson has nothing to ask. */
const DEFAULT_SPEC: PairSpec = { addendRange: [6, 48] };

export const specFor = (setup: StrategySetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC };
  if (setup.addendRange) spec.addendRange = setup.addendRange;
  if (setup.aRange) spec.aRange = setup.aRange;
  if (setup.bRange) spec.bRange = setup.bRange;
  if (setup.sumMax !== undefined) spec.sumMax = setup.sumMax;
  return spec;
};

/** Carried between the two halves of one problem. */
export interface ProblemMemory {
  a: number;
  b: number;
  sum: number;
  fitting: string[];
  chosen?: string;
}

export const buildQuestion = (
  setup: StrategySetup,
  index: number,
  seen: Set<string>,
  memory: { current: ProblemMemory | null },
): StrategyQuestion => {
  const step: 1 | 2 = index % 2 === 0 ? 2 : 1;
  let memo = memory.current;

  if (step === 1 || !memo) {
    /*
     * Only numbers where something clever applies.
     *
     * Counting on always fits, so a pair with nothing else available would
     * leave one card correct and the lesson pointless — the whole question is
     * which of several routes is worth taking.
     */
    const drawn = withoutRepeat(
      () => {
        let pair = drawPair(specFor(setup));
        for (let tries = 0; tries < 60 && fittingFor(pair.a, pair.b).length < 2; tries += 1) {
          pair = drawPair(specFor(setup));
        }
        return pair;
      },
      pairKey,
      seen,
    );
    memo = {
      a: drawn.a,
      b: drawn.b,
      sum: drawn.sum,
      fitting: fittingFor(drawn.a, drawn.b).map((s) => s.id),
    };
    memory.current = memo;
  }

  const base = {
    id: `q${index}-${Date.now().toString(36)}`,
    a: memo.a,
    b: memo.b,
    sum: memo.sum,
    fitting: memo.fitting,
    itemCount: memo.sum,
  };

  if (step === 2) {
    // The route they chose against the plainest one there is, unless they chose
    // that — in which case, against the best one available.
    const chosen = memo.chosen ?? memo.fitting[0];
    const other =
      chosen === "count_on"
        ? memo.fitting.find((id) => id !== "count_on") ?? "count_on"
        : "count_on";
    const paths = shuffle([chosen, other]).map((id) => {
      const s = byId(id);
      return { id, name: s.name, lines: s.work(memo!.a, memo!.b) };
    });
    const shorter = paths.reduce((best, p) => (p.lines.length < best.lines.length ? p : best));
    return {
      ...base,
      taskKind: "strategy_compare",
      step: 2,
      options: [],
      paths,
      shorter: shorter.id,
      expected: shorter.id,
    };
  }

  // Four cards: everything that fits, padded with ones that do not.
  const fits = memo.fitting.map(byId);
  const misfits = STRATEGIES.filter((s) => !memo!.fitting.includes(s.id));
  const options = shuffle([...fits, ...misfits].slice(0, Math.max(4, fits.length)));

  return {
    ...base,
    taskKind: "strategy_choose",
    step: 1,
    options,
    // Several right answers, so the log holds all of them rather than one.
    expected: memo.fitting.join("|"),
  };
};

export const promptFor = (q: StrategyQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum));
  if (filled && q.step === 1) return filled;
  return q.step === 2
    ? `Both of these get to ${q.sum}. Which one took fewer steps?`
    : `${q.a} plus ${q.b}. Which strategy would you use?`;
};

export function strategyHints(
  q: StrategyQuestion,
  state: { kidTip?: string },
): string[] {
  if (q.step === 2) {
    return composeHints(
      state.kidTip ?? "More than one way is right. Some ways are shorter than others.",
      "Count the lines in each one. The shorter list is the shorter way.",
      // Stops at the method: counting them is the question.
      "Both reach the same answer, so the only difference is how much work it took.",
    );
  }
  const fits = q.fitting.map(byId);
  return composeHints(
    state.kidTip ?? "Look at the numbers before you choose. Some strategies only suit some numbers.",
    fits.length > 1
      ? `More than one of these would work here. Ask what is special about ${q.a} and ${q.b}.`
      : `Ask what is special about ${q.a} and ${q.b}.`,
    fits[0]!.why(q.a, q.b),
  );
}

export const StrategyPicker: React.FC<ActivityProps<StrategyPickerParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: StrategySetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 6;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());
  const memory = useRef<ProblemMemory | null>(null);
  const nudge = useNudge(koda);

  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
    totalQuestions,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback(
      (index: number) => buildQuestion(setup, index, seen.current, memory),
      [params],
    ),
    onComplete: (result) => {
      void koda.progress.nextStep().then((r) => setNextStep(r ?? undefined));
      onComplete(result);
    },
  });

  const question = round.question as StrategyQuestion;

  /**
   * Report an answer.
   *
   * In practice the verdict stands on its own — a child working unaided is not
   * being walked through what happened, and an explanation after every question
   * would put the scaffolding back one sentence at a time.
   */
  const submit = (outcome: Parameters<typeof round.submit>[0]) =>
    round.submit(practising ? { ...outcome, message: undefined } : outcome);

  useEffect(() => {
    nudge.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };

  const chooseStrategy = (s: Strategy) => {
    if (round.feedback) return;
    const correct = question.fitting.includes(s.id);
    if (correct && memory.current) memory.current.chosen = s.id;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();

    const others = question.fitting.filter((id) => id !== s.id).map(byId);
    submit({
      correct,
      given: s.id,
      errorKind: correct ? undefined : "unknown",
      title: correct ? "That is a good choice" : "Not for these numbers",
      message: correct
        ? `${s.why(question.a, question.b)}${
            others.length > 0
              ? ` ${others.map((o) => o.name).join(" and ")} would work too.`
              : ""
          }`
        : `${s.name} does not suit ${question.a} and ${question.b}. ${byId(question.fitting[0]).why(question.a, question.b)}`,
    });
  };

  const judgePath = (id: string) => {
    if (round.feedback) return;
    const correct = id === question.shorter;
    const short = question.paths!.find((p) => p.id === question.shorter)!;
    const long = question.paths!.find((p) => p.id !== question.shorter)!;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    submit({
      correct,
      given: id,
      errorKind: correct ? undefined : "unknown",
      title: correct ? "Fewer steps!" : "Count them again",
      message: `${short.name} took ${short.lines.length} ${short.lines.length === 1 ? "step" : "steps"}; ${long.name} took ${long.lines.length}. Both reach ${question.sum}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Which Strategy?"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="sparkles"
      iconTone="purple"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message}
      hints={practising ? [] : strategyHints(question, { kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={
        practising
          ? undefined
          : () => {
            round.useSupport("audio_replay");
            void koda.speech.say(prompt, speechRate(koda));
            }
      }
      recommendation={nextStep}
    >
      <div className="space-y-4">
        <div className={`${SCENE} p-5 sm:p-7 space-y-4`}>
          <p className="text-center text-4xl sm:text-5xl font-black tabular-nums text-ink">
            <span className={ADDEND_A.text}>{question.a}</span>
            <span className="text-ink/35"> + </span>
            <span className={ADDEND_B.text}>{question.b}</span>
            {question.step === 2 && (
              <>
                <span className="text-ink/35"> = </span>
                <span className={TOTAL.text}>{question.sum}</span>
              </>
            )}
          </p>

          {question.step === 2 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {question.paths!.map((path) => (
                <motion.button
                  key={path.id}
                  type="button"
                  onClick={() => judgePath(path.id)}
                  disabled={Boolean(round.feedback)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING.tap}
                  aria-label={`${path.name}, ${path.lines.length} steps`}
                  className={`${themeSystem.card("bordered")} text-left space-y-1.5`}
                >
                  <span className="block text-sm font-black uppercase tracking-wide text-ink/60">
                    {path.name}
                  </span>
                  <ol className="space-y-0.5">
                    {path.lines.map((line, i) => (
                      <li key={i} className="text-sm font-semibold text-ink/80 tabular-nums">
                        {i + 1}. {line}
                      </li>
                    ))}
                  </ol>
                  {scaffold && (
                    <span className="block text-xs font-bold text-ink/45">
                      {path.lines.length} {path.lines.length === 1 ? "step" : "steps"}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>
          ) : (
            scaffold && (
              <p className="text-center text-sm font-bold text-ink/55">
                More than one of these can be right. Pick the one that suits these numbers.
              </p>
            )
          )}
        </div>

        {question.step === 1 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {question.options.map((s) => (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => chooseStrategy(s)}
                disabled={Boolean(round.feedback)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING.tap}
                aria-label={s.name}
                className={themeSystem.button("secondary", "md", "justify-start text-left")}
              >
                {s.name}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </SkillRound>
  );
};
