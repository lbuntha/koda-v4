import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import {
  SkillRound,
  composeHints,
  guideSetup,
  isPractice,
  modeAt,
  openWith,
  playCopy,
  useGuide,
  useSkillRound,
} from "../../kit";
import {
  buildFactorQuestion,
  isPrime,
  splitOptions,
  type FactorMode,
  type FactorQuestion,
  type FactorSetup,
} from "../internal/data/divisionFactors";

/**
 * Does it go? — division answering a yes-or-no question.
 *
 * Six techniques and one idea: a division you do not have to finish still tells
 * you something. The tests come with their evidence on screen — the last digit,
 * the digit sum — because a rule taught without its reason is a rule applied to
 * the wrong number a year later.
 *
 * The factor tree at level 45 is built by the child rather than revealed. Every
 * composite leaf offers the ways it can be split; a prime has none and is
 * marked done. When nothing is left to split, the tree is the answer.
 */

interface FactorParams {
  question?: FactorSetup;
  mode?: FactorMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: FactorParams, index: number): FactorQuestion {
  const setup: FactorSetup = { ...params, ...params.question };
  const mode = modeAt<FactorMode>(setup, index + 1, "last_digit");
  return buildFactorQuestion(setup, mode, index);
}

export const promptFor = (question: FactorQuestion): string => question.prompt;

/**
 * The ladder, opening with the lesson's own words.
 *
 * All fifty-six division lessons author a `kidTip` and, until this, not one
 * was read: these ladders took the question and nothing else. `openWith`
 * puts it back as rung one without costing the worked step — see the kit.
 */
export function factorHints(question: FactorQuestion, kidTip?: string): string[] {
  return openWith(kidTip, factorHintsRungs(question));
}

function factorHintsRungs(question: FactorQuestion): string[] {
  switch (question.mode) {
    case "last_digit":
      return composeHints(
        "You do not need to divide. Look at the last digit.",
        question.tester === 2
          ? "Even last digits mean it divides by 2."
          : question.tester === 5
            ? "A last digit of 0 or 5 means it divides by 5."
            : "Only a last digit of 0 means it divides by 10.",
      );
    case "digit_sum":
      return composeHints(
        "Add all the digits up.",
        question.tester === 3
          ? "If that total divides by 3, so does the whole number."
          : "If that total divides by 9, so does the whole number.",
      );
    case "combined_test":
      return composeHints(
        question.tester === 4 ? "Look at just the last two digits." : "Test it twice: by 2, and by 3.",
        question.tester === 4
          ? "If those two digits make a number that divides by 4, the whole thing does."
          : "A number divides by 6 only if it divides by both 2 and 3.",
      );
    case "factor_pairs":
      return composeHints(
        "Try dividing by 1, then 2, then 3, and so on.",
        "Every time one goes exactly, you have found a pair — that number and its partner.",
        `You can stop at ${question.stopAt}. Past there you only meet the partners again.`,
      );
    case "common_factors":
      return composeHints(
        "A number has to divide into both, not just one.",
        "Test each candidate against both numbers before you tap it.",
      );
    default:
      return composeHints(
        "Split it into any two numbers that multiply to make it.",
        "Keep splitting the parts that can still be split.",
        "A prime cannot be split. When they are all prime, you are finished.",
      );
  }
}

export const FactorLab: React.FC<ActivityProps<FactorParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: FactorSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const scaffoldEnabled = koda.config.isEnabled("inverse_scaffold", true);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    /*
     * Nothing is read to the child when a round opens.
     *
     * The opening line exists because a five-year-old cannot read the
     * instruction. This skill starts at seven, and reading the question aloud
     * to a reader takes the reading out of the question — which in levels 49
     * to 55 is most of the work. The speaker button is still there for a child
     * who needs it; it is pull, not push. See `voice.json`.
     */
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1), [params]),
    onComplete,
  });
  const question = round.question as FactorQuestion;

  /** Divisors the child has claimed, and the leaves of the tree. */
  const [picked, setPicked] = useState<number[]>([]);
  const [leaves, setLeaves] = useState<number[]>([]);
  const [splitting, setSplitting] = useState<number | null>(null);

  useEffect(() => {
    if (!question) return;
    setPicked([]);
    setLeaves(question.mode === "prime_factors" ? [question.value] : []);
    setSplitting(null);
  }, [question]);

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const copy = playCopy(params);
  const hints = practising ? [] : factorHints(question, copy.kidTip);
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    target: -1,
    progress: 0,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  if (!question) return null;

  const chime = (ok: boolean): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(ok ? "clink" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (ok) koda.haptics.tap();
      else koda.haptics.pulse("error");
    }
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? "Yes!" : "Not yet", message });
  };

  const answerYesNo = (said: boolean): void => {
    const correct = said === question.divides;
    submit(
      said ? "yes" : "no",
      correct,
      correct
        ? `${question.evidence} So it ${question.divides ? "does" : "does not"}.`
        : `Use the test: ${question.evidence}`,
    );
  };

  const toggle = (value: number): void => {
    chime(true);
    setPicked((current) =>
      current.includes(value) ? current.filter((n) => n !== value) : [...current, value],
    );
  };

  const submitSet = (): void => {
    const wanted = question.wanted;
    const correct = wanted.length === picked.length && wanted.every((n) => picked.includes(n));
    const missed = wanted.filter((n) => !picked.includes(n));
    const extra = picked.filter((n) => !wanted.includes(n));
    submit(
      [...picked].sort((a, b) => a - b).join(", "),
      correct,
      correct
        ? `All of them: ${wanted.join(", ")}.`
        : extra.length > 0
          ? `${extra[0]} does not go exactly. Check it again.`
          : `There ${missed.length === 1 ? "is one" : `are ${missed.length}`} still to find.`,
    );
  };

  const split = (leaf: number, pair: [number, number]): void => {
    chime(true);
    setSplitting(null);
    setLeaves((current) => {
      const at = current.indexOf(leaf);
      return [...current.slice(0, at), pair[0], pair[1], ...current.slice(at + 1)];
    });
  };

  const treeDone = leaves.length > 0 && leaves.every(isPrime);

  const submitTree = (): void => {
    const sorted = [...leaves].sort((a, b) => a - b);
    const correct = treeDone && sorted.join(" × ") === question.expected;
    submit(sorted.join(" × "), correct, correct ? "All primes." : "Keep splitting until nothing can be split.");
  };

  const testing = question.mode === "last_digit" || question.mode === "digit_sum" || question.mode === "combined_test";
  const collecting = question.mode === "factor_pairs" || question.mode === "common_factors";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Does It Go?"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (picked.length > 0 || splitting !== null || leaves.length > (question.mode === "prime_factors" ? 1 : 0))
          ? () => {
              setPicked([]);
              setLeaves(question.mode === "prime_factors" ? [question.value] : []);
              setSplitting(null);
            }
          : undefined
      }
      iconName="Sigma"
      iconTone="emerald"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {testing ? (
          <>
            {scaffoldEnabled && !practising ? (
              <p className="rounded-2xl border border-emerald-400/40 px-4 py-2 text-center text-base text-muted">
                {question.evidence}
              </p>
            ) : null}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => answerYesNo(true)}
                disabled={!!round.feedback}
                className="min-h-11 min-w-24 rounded-2xl bg-surface px-6 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => answerYesNo(false)}
                disabled={!!round.feedback}
                className="min-h-11 min-w-24 rounded-2xl bg-surface px-6 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                No
              </button>
            </div>
          </>
        ) : null}

        {collecting ? (
          <>
            {question.stopAt && scaffoldEnabled && !practising ? (
              <p className="text-center text-sm text-muted">
                Nothing new past {question.stopAt} — after that you only meet the partners again.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-center gap-2">
              {question.candidates.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggle(value)}
                  disabled={!!round.feedback}
                  aria-pressed={picked.includes(value)}
                  className={`min-h-11 min-w-11 rounded-xl px-3 py-2 text-base font-semibold shadow-sm ${
                    picked.includes(value) ? "bg-emerald-500 text-white" : "bg-surface text-ink"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={submitSet}
              disabled={picked.length === 0 || !!round.feedback}
              className="mx-auto min-h-11 rounded-2xl bg-emerald-600 px-6 py-2 text-base font-bold text-white shadow-sm disabled:opacity-40"
            >
              That is all of them
            </button>
          </>
        ) : null}

        {question.mode === "prime_factors" ? (
          <>
            <div className="flex flex-wrap justify-center gap-2" data-testid="tree">
              {leaves.map((leaf, i) => (
                <button
                  key={`${leaf}-${i}`}
                  type="button"
                  onClick={() => setSplitting(isPrime(leaf) ? null : leaf)}
                  disabled={isPrime(leaf) || !!round.feedback}
                  aria-label={isPrime(leaf) ? `${leaf}, prime` : `Split ${leaf}`}
                  className={`min-h-11 min-w-11 rounded-xl px-3 py-2 text-base font-bold shadow-sm ${
                    isPrime(leaf) ? "bg-emerald-500 text-white" : "bg-surface text-ink"
                  }`}
                >
                  {leaf}
                </button>
              ))}
            </div>

            {splitting !== null ? (
              <div className="flex flex-wrap justify-center gap-2">
                {splitOptions(splitting).map(([a, b]) => (
                  <button
                    key={`${a}x${b}`}
                    type="button"
                    onClick={() => split(splitting, [a, b])}
                    className="min-h-11 rounded-xl bg-surface px-4 py-2 text-base font-semibold text-ink shadow-sm"
                  >
                    {a} × {b}
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={submitTree}
              disabled={!treeDone || !!round.feedback}
              className="mx-auto min-h-11 rounded-2xl bg-emerald-600 px-6 py-2 text-base font-bold text-white shadow-sm disabled:opacity-40"
            >
              All primes
            </button>
          </>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: FactorQuestion): { text: string; answer: string } | null {
  switch (question.mode) {
    case "factor_pairs":
      return { text: `Write every factor of ${question.value}.`, answer: question.wanted.join(", ") };
    case "common_factors":
      return {
        text: `Write every number that divides into both ${question.value} and ${question.other}.`,
        answer: question.wanted.join(", "),
      };
    case "prime_factors":
      return { text: `Write ${question.value} as a product of primes.`, answer: question.expected };
    default:
      return {
        text: `Does ${question.tester} divide into ${question.value} exactly?   yes / no`,
        answer: question.expected,
      };
  }
}

export function methodFor(question: FactorQuestion): string[] {
  switch (question.mode) {
    case "last_digit":
      return ["Look at the last digit.", "Even means 2. A 0 or 5 means 5. Only a 0 means 10."];
    case "digit_sum":
      return ["Add all the digits together.", "If that total divides by 3 or 9, so does the whole number."];
    case "combined_test":
      return ["For 4, look at the last two digits.", "For 6, test by 2 and by 3. Both have to pass."];
    case "factor_pairs":
      return [
        "Divide by 1, then 2, then 3, and keep going.",
        "Each one that goes exactly gives you a pair.",
        "Stop where the two halves of a pair meet.",
      ];
    case "common_factors":
      return ["Find the factors of the first number.", "Keep only the ones that divide the second as well."];
    default:
      return ["Split the number into two factors.", "Keep splitting until every part is prime."];
  }
}
