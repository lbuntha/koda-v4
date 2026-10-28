import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { withArticle } from "../internal/data/fractionNumbers";
import { printBar } from "../internal/ui/printFigures";
import type { Fraction } from "../internal/data/fractionNumbers";
import { FractionBar } from "../internal/ui/FractionBar";
import {
  BENCHMARK_WORDS,
  explainCompare,
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
import { tf } from "../internal/i18n";
import { useT } from "../../../lib/i18n";
import { wholeName } from "../internal/data/fractionNumbers";

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
        tf("cmp.hintSameDen1"),
        tf("cmp.hintSameDen2"),
        tf("cmp.hintSameDen3"),
      );
    case "same_numerator":
      return composeHints(
        tf("cmp.hintNum1"),
        tf("cmp.hintNum2"),
        tf("cmp.hintNum3", { piece: withArticle(Math.max(left.parts, right.parts)).replace(/^./, (ch) => ch.toUpperCase()) }),
      );
    case "different_wholes":
      return composeHints(
        tf("cmp.hintWh1"),
        tf("cmp.hintWh2"),
        tf("cmp.hintWh3"),
      );
    case "benchmark_half":
      return composeHints(
        tf("cmp.hintHalf1"),
        tf("cmp.hintHalf2", { parts: left.parts, half: left.parts / 2 }),
        tf("cmp.hintHalf3", { half: left.parts / 2 }),
      );
    default:
      return composeHints(
        tf("cmp.hintCommon1"),
        tf("cmp.hintCommon2"),
        tf("cmp.hintCommon3", { a: left.parts, b: right.parts }),
      );
  }
}

export const CompareBar: React.FC<ActivityProps<CompareParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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
  /*
   * Which question's pieces have been cut — not a plain "yes, cut".
   *
   * A boolean reset by an effect is true for the gap between a new question
   * rendering and that effect running, and in that gap the strip will accept an
   * answer for a question whose pieces are still different sizes. Keyed to the
   * question, there is no gap: a new question has not been cut because its id is
   * not the one recorded.
   */
  const [matchedFor, setMatchedFor] = useState<string | null>(null);
  const [refused, setRefused] = useState<CompareBlock>(null);

  useEffect(() => {
    if (!question) return;
    setMatchedFor(null);
    setRefused(null);
  }, [question]);

  const hints = !question || practising ? [] : compareHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
    progress: matchedFor ? 1 : 0,
  });

  if (!question) return null;

  /** Cut to match — for *this* question, not for whichever one came before. */
  const matchedYet = !question.mustMatch || matchedFor === question.id;

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
    setMatchedFor(question.id);
    guide.moved();
  };

  const answer = (verdict: Verdict): void => {
    const block = compareBlockedBecause(question, matchedYet);
    if (block) {
      setRefused(block);
      guide.stumbled();
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
      title: correct ? tf("cmp.yes") : tf("cmp.notThat"),
      message: explainCompare(question, correct, verdict),
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tf("cmp.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
      onStartOver={
        matchedYet && question.mustMatch && !round.feedback
          ? () => {
              setMatchedFor(null);
              setRefused(null);
            }
          : undefined
      }
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
              label={tf("cmp.topBar", { taken: shown.left.taken, parts: shown.left.parts })}
            />
            <span className="text-sm font-bold text-ink">
              {shown.left.taken}/{shown.left.parts}
              {labelsEnabled && !practising ? (
                <span className="pl-2 text-xs font-normal text-muted">{tf("cmp.ofWhole", { whole: wholeName(question.left.whole) })}</span>
              ) : null}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <FractionBar
              parts={shown.right.parts}
              shaded={shadedOf(shown.right)}
              scale={rightScale}
              label={tf("cmp.bottomBar", { taken: shown.right.taken, parts: shown.right.parts })}
            />
            <span className="text-sm font-bold text-ink">
              {shown.right.taken}/{shown.right.parts}
              {labelsEnabled && !practising ? (
                <span className="pl-2 text-xs font-normal text-muted">{tf("cmp.ofWhole", { whole: wholeName(question.right.whole) })}</span>
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
            {tf("cmp.makeMatch")}
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

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/** `3/4`. Local because comparing never needs to name a fraction on screen. */
const nameOf = (f: Fraction): string => `${f.taken}/${f.parts}`;

/**
 * Comparing prints well, and one of these prints better than it plays.
 *
 * Level 19 shows two fractions of *different* wholes and the honest answer is
 * "you cannot tell". On paper that is a sentence to write, which is a better
 * record of the thought than tapping a third button.
 */
export function printedFor(question: CompareQuestion): { text: string; answer: string } | null {
  const words = question.mode === "benchmark_half" ? BENCHMARK_WORDS : VERDICT_WORDS;
  if (question.mode === "benchmark_half") {
    return {
      text: tf("cmp.printHalf", { fraction: nameOf(question.left) }),
      answer: words[question.expected],
    };
  }
  if (question.mode === "different_wholes") {
    return {
      text: tf("cmp.printWholes", { a: nameOf(question.left), b: nameOf(question.right) }),
      answer: words[question.expected],
    };
  }
  return {
    text: tf("cmp.printSign", { a: nameOf(question.left), b: nameOf(question.right) }),
    answer: question.expected === "less" ? "<" : question.expected === "more" ? ">" : "=",
  };
}

/** Two bars to compare, except where the question is about a half. */
export const figureFor = (question: CompareQuestion): React.ReactNode | null => {
  if (question.mode === "benchmark_half") return printBar(question.left.parts, question.left.taken);
  if (question.mode === "different_wholes") {
    return (
      <div className="flex flex-col gap-1">
        {printBar(question.left.parts, question.left.taken, { width: 220 })}
        {printBar(question.right.parts, question.right.taken, { width: 130 })}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {printBar(question.left.parts, question.left.taken)}
      {printBar(question.right.parts, question.right.taken)}
    </div>
  );
};

export function methodFor(question: CompareQuestion): string[] | null {
  switch (question.mode) {
    case "same_denominator":
      return [tf("cmp.methodSameDen")];
    case "same_numerator":
      return [
        tf("cmp.methodNum1"),
        tf("cmp.methodNum2"),
      ];
    case "different_wholes":
      return [
        tf("cmp.methodWh1"),
        tf("cmp.methodWh2"),
      ];
    case "benchmark_half":
      return [
        tf("cmp.methodHalf1"),
        tf("cmp.methodHalf2"),
      ];
    default:
      return [
        tf("cmp.methodCommon1"),
        tf("cmp.methodCommon2"),
      ];
  }
}
