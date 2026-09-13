import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { FractionBar } from "../internal/ui/FractionBar";
import {
  BENCHMARK_WORDS,
  COMPARE_REFUSALS,
  VERDICT_WORDS,
  buildCompareQuestion,
  compareBlockedBecause,
  matched,
  verdictsFor,
  type CompareBlock,
  type CompareMode,
  type CompareQuestion,
  type CompareSetup,
  type Verdict,
} from "../internal/data/fractionCompare";

/**
 * Which is more — and the two levels where that is the wrong question.
 *
 * Comparing is where "3/4 is a 3 and a 4" does its worst damage, because it is
 * right about half the time: a child comparing bottom numbers gets `3/8 < 5/8`
 * right and `1/8 > 1/4` wrong, and a round of like denominators will never tell
 * them. Level 18 exists for exactly that, and level 19's right answer is that
 * the question cannot be answered.
 *
 * The bars are drawn the same length everywhere except level 19, which is what
 * makes looking at them a valid method — and level 19 breaks it on purpose, so
 * that "look at the bars" stops being a method a child can use without thinking
 * about what the bars are of.
 */

interface CompareParams {
  question?: CompareSetup;
  mode?: CompareMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: CompareParams, index: number, seen?: Set<string>): CompareQuestion {
  const setup: CompareSetup = { ...params, ...params.question };
  const mode = modeAt<CompareMode>(setup, index + 1, "same_denominator");
  return buildCompareQuestion(setup, mode, index, seen);
}

export const promptFor = (question: CompareQuestion): string => question.prompt;

export function compareHints(question: CompareQuestion): string[] {
  const { left, right } = question;
  switch (question.mode) {
    case "same_denominator":
      return composeHints(
        "Both bars are cut the same way, so every piece is the same size.",
        "That means you can just count the coloured pieces.",
        "More pieces of the same size is more.",
      );
    case "same_numerator":
      return composeHints(
        "Count the coloured pieces on each. There are the same number.",
        "So the pieces themselves must be doing the work. Look at how big they are.",
        `Cutting a whole into ${Math.max(left.parts, right.parts)} makes smaller pieces than cutting it into ${Math.min(left.parts, right.parts)}. A bigger bottom number means smaller pieces.`,
      );
    case "different_wholes":
      return composeHints(
        "Look at the two wholes before you look at the colour.",
        "They are not the same size to start with.",
        "A fraction of one thing cannot be compared with a fraction of a different thing. There is no answer.",
      );
    case "benchmark_half":
      return composeHints(
        "You are not comparing it with another fraction, but with one half.",
        `Half of ${left.parts} is ${left.parts / 2}.`,
        `So more than ${left.parts / 2} pieces is more than a half, and fewer is less.`,
      );
    default:
      return composeHints(
        "The pieces are different sizes, so counting them tells you nothing yet.",
        "Cut both bars until every piece is the same size.",
        `Both ${left.parts} and ${right.parts} go into the number you are looking for.`,
      );
  }
}

export const CompareBar: React.FC<ActivityProps<CompareParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: CompareSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const labelsEnabled = koda.config.isEnabled("part_labels", true);

  const seen = useMemo(() => new Set<string>(), []);
  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    // A skill for readers: nothing is spoken when the round opens.
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildQuestion(params, i - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as CompareQuestion;

  /** Whether the child has re-cut both bars to a shared denominator. */
  const [matchedYet, setMatchedYet] = useState(false);
  const [refused, setRefused] = useState<CompareBlock>(null);

  useEffect(() => {
    if (!question) return;
    setMatchedYet(false);
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const shown = matchedYet ? matched(question) : { left: question.left, right: question.right };
  const shadedOf = (f: typeof shown.left) => Array.from({ length: f.taken }, (_, i) => i);
  const words = question.mode === "benchmark_half" ? BENCHMARK_WORDS : VERDICT_WORDS;

  /*
   * Level 19 is the only place the two bars are drawn at different lengths, and
   * it is drawn that way because the wholes genuinely differ. Everywhere else
   * they match, which is what makes comparing them by eye a real method.
   */
  const rightScale = question.mode === "different_wholes" ? 0.55 : 1;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const makeMatch = (): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setMatchedYet(true);
  };

  const answer = (verdict: Verdict): void => {
    const block = compareBlockedBecause(question, matchedYet);
    if (block) {
      setRefused(block);
      say(COMPARE_REFUSALS[block]);
      return;
    }
    const correct = verdict === question.expected;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: verdict,
      expected: question.expected,
      title: correct ? "Yes!" : "Not that one",
      message: correct
        ? question.mode === "different_wholes"
          ? "They are fractions of two different things, so there is nothing to compare."
          : question.mode === "same_numerator"
            ? "The same number of pieces — but a bigger bottom number means smaller pieces."
            : "That is right."
        : question.mode === "same_numerator" && verdict !== "same"
          ? "Careful: a bigger bottom number makes the pieces smaller, not bigger."
          : question.mode === "different_wholes"
            ? "Look at the two wholes. They are not the same size."
            : "Look at the bars again.",
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Which Is More?"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : compareHints(question)}
      iconName="Scale"
      iconTone="cyan"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              say(promptFor(question));
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-2" data-testid="bars">
          <div className="flex flex-col items-center gap-0.5">
            <FractionBar
              parts={shown.left.parts}
              shaded={shadedOf(shown.left)}
              label={`top bar, ${shown.left.taken} of ${shown.left.parts}`}
            />
            <span className="text-sm font-bold text-ink">
              {shown.left.taken}/{shown.left.parts}
              {labelsEnabled && !practising ? (
                <span className="pl-2 text-xs font-normal text-muted">of {question.left.whole.name}</span>
              ) : null}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <FractionBar
              parts={shown.right.parts}
              shaded={shadedOf(shown.right)}
              scale={rightScale}
              label={`bottom bar, ${shown.right.taken} of ${shown.right.parts}`}
            />
            <span className="text-sm font-bold text-ink">
              {shown.right.taken}/{shown.right.parts}
              {labelsEnabled && !practising ? (
                <span className="pl-2 text-xs font-normal text-muted">of {question.right.whole.name}</span>
              ) : null}
            </span>
          </div>
        </div>

        {question.mustMatch && !matchedYet ? (
          <button
            type="button"
            onClick={makeMatch}
            disabled={!!round.feedback}
            className="min-h-11 rounded-2xl bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            Make the pieces match
          </button>
        ) : null}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {COMPARE_REFUSALS[refused]}
          </p>
        ) : null}

        <div className="flex w-full flex-col gap-2">
          {verdictsFor(question).map((verdict) => (
            <button
              key={verdict}
              type="button"
              onClick={() => answer(verdict)}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {words[verdict]}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
