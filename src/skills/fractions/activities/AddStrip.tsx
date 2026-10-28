import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { printBar } from "../internal/ui/printFigures";
import { FractionBar } from "../internal/ui/FractionBar";
import { partWord } from "../internal/data/fractionNumbers";
import {
  ADD_REFUSALS,
  addBlockedBecause,
  buildAddQuestion,
  explainAdd,
  isAddCorrect,
  matchedPair,
  mixedText,
  nameOf,
  type AddBlock,
  type AddMode,
  type AddQuestion,
  type AddSetup,
} from "../internal/data/fractionAdd";
import type { Fraction } from "../internal/data/fractionNumbers";
import { tf } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * Adding and taking away — which is counting, once the pieces match.
 *
 * The whole engine is one sentence: you can only add things that are the same
 * size. Three eighths and two eighths are five eighths because both are
 * eighths; a half and a third are not five sixths, because a half and a third
 * are not the same thing. Every level is that sentence at a different stage.
 *
 * So the strip refuses to take an answer while the pieces differ. A child who
 * has not matched them has not made a mistake yet — they have not started, and
 * accepting a guess would confirm the method the level exists to remove.
 */

interface AddParams {
  question?: AddSetup;
  mode?: AddMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: AddParams, index: number, seen?: Set<string>): AddQuestion {
  const setup: AddSetup = { ...params, ...params.question };
  const mode = modeAt<AddMode>(setup, index + 1, "add_like");
  return buildAddQuestion(setup, mode, index, seen);
}

export const promptFor = (question: AddQuestion): string => question.prompt;

export function addHints(question: AddQuestion): string[] {
  const { left, right, common } = question;
  const piece = partWord(common, true);
  switch (question.mode) {
    case "add_like":
      return composeHints(
        tf("add.hintLike1", { words: partWord(left.parts, true) }),
        tf("add.hintLike2"),
        tf("add.hintLike3"),
      );
    case "subtract_like":
      return composeHints(
        tf("add.hintSub1", { words: partWord(left.parts, true) }),
        tf("add.hintSub2"),
        tf("add.hintSub3"),
      );
    case "refute":
      return composeHints(
        tf("add.hintRef1"),
        tf("add.hintRef2", { words: piece }),
        tf("add.hintRef3"),
      );
    case "add_nested":
      return composeHints(
        tf("add.hintNest1"),
        tf("add.hintNest2", { small: partWord(Math.min(left.parts, right.parts), true), big: partWord(Math.max(left.parts, right.parts), true) }),
        tf("add.hintNest3"),
      );
    case "add_mixed":
      return composeHints(
        tf("add.hintMix1"),
        tf("add.hintMix2", { words: piece }),
        tf("add.hintMix3"),
      );
    case "subtract_mixed":
      return composeHints(
        tf("add.hintSM1"),
        tf("add.hintSM2", { common, words: piece }),
        tf("add.hintSM3"),
      );
    case "subtract_unlike":
      return composeHints(
        tf("add.hintSU1"),
        tf("add.hintSU2", { words: piece, common }),
        tf("add.hintSU3"),
      );
    default:
      return composeHints(
        tf("add.hintUn1"),
        tf("add.hintUn2", { common }),
        tf("add.hintUn3"),
      );
  }
}

export const AddStrip: React.FC<ActivityProps<AddParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup: AddSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as AddQuestion;

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
  const [refused, setRefused] = useState<AddBlock>(null);

  useEffect(() => {
    if (!question) return;
    setMatchedFor(null);
    setRefused(null);
  }, [question]);

  const hints = !question || practising ? [] : addHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
    progress: matchedFor ? 1 : 0,
  });

  if (!question) return null;

  /** Cut to match — for *this* question, not for whichever one came before. */
  const matchedYet = !question.mustMatch || matchedFor === question.id;

  const options = question.options ?? [];
  const shown = matchedYet ? matchedPair(question) : { left: question.left, right: question.right };
  const shadedOf = (n: number) => Array.from({ length: n }, (_, i) => i);

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

  const answer = (text: string): void => {
    const block = addBlockedBecause(question, matchedYet);
    if (block) {
      setRefused(block);
      guide.stumbled();
      say(ADD_REFUSALS[block]);
      return;
    }
    const correct = isAddCorrect(question, text);
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: text,
      expected: question.expected,
      title: correct ? tf("add.yes") : tf("add.notYet"),
      message: explainAdd(question, correct),
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tf("add.title")}
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
      iconName="Plus"
      iconTone="emerald"
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
        <div className="flex flex-col items-center gap-2" data-testid="strips">
          {[shown.left, shown.right].map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <FractionBar
                parts={f.parts}
                shaded={shadedOf(f.taken)}
                label={`${i === 0 ? "first" : "second"} strip, ${f.taken} of ${f.parts}`}
              />
              <span className="text-sm font-bold text-ink">
                {(i === 0 ? question.leftOnes : question.rightOnes) > 0
                  ? mixedText(i === 0 ? question.leftOnes : question.rightOnes, f)
                  : nameOf(f)}
              </span>
            </div>
          ))}
        </div>

        {question.claim ? (
          <p className="rounded-2xl bg-surface px-4 py-2 text-center text-base text-ink">
            Somebody says the answer is <span className="font-bold">{nameOf(question.claim)}</span>.
          </p>
        ) : null}

        {question.mustMatch && !matchedYet ? (
          <button
            type="button"
            onClick={makeMatch}
            disabled={!!round.feedback}
            className="min-h-11 rounded-2xl bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {tf("add.cutMatch")}
          </button>
        ) : null}

        {labelsEnabled && !practising && matchedYet && question.mustMatch ? (
          <p className="text-xs text-muted">both are {partWord(question.common, true)} now</p>
        ) : null}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {ADD_REFUSALS[refused]}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          {options.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => answer(text)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-16 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {text}
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

/**
 * Adding prints as arithmetic, with the strips beside it where they help.
 *
 * The refutation at level 27 prints as the best question on the sheet: the
 * claim is written out and the child has to say what is wrong with it in their
 * own hand, which is a harder and better task than choosing a button.
 */
export function printedFor(question: AddQuestion): { text: string; answer: string } | null {
  if (question.mode === "refute") {
    return {
      text: tf("add.printRefute", { left: nameOf(question.left), right: nameOf(question.right), claim: nameOf(question.claim as Fraction) }),
      answer: tf("add.printRefuteAnswer", { expected: question.expected, left: nameOf(question.left) }),
    };
  }
  const sign = question.operation === "add" ? "+" : "−";
  const left = question.leftOnes > 0 ? mixedText(question.leftOnes, question.left) : nameOf(question.left);
  const right = question.rightOnes > 0 ? mixedText(question.rightOnes, question.right) : nameOf(question.right);
  return { text: `${left} ${sign} ${right} =`, answer: question.expected };
}

/** The two strips, drawn as they are written — uncut, because cutting is the work. */
export const figureFor = (question: AddQuestion): React.ReactNode | null => {
  if (!question.mustMatch) return null;
  return (
    <div className="flex flex-col gap-1">
      {printBar(question.left.parts, question.left.taken)}
      {printBar(question.right.parts, question.right.taken)}
    </div>
  );
};

export function methodFor(question: AddQuestion): string[] | null {
  if (question.mode === "refute") {
    return [
      tf("add.methodRef1"),
      tf("add.methodRef2"),
    ];
  }
  if (question.mode === "subtract_mixed") {
    return [
      tf("add.methodSM1"),
      tf("add.methodSM2"),
      tf("add.methodSM3"),
    ];
  }
  if (!question.mustMatch) {
    return [
      tf("add.methodLike1"),
      tf("add.methodLike2"),
    ];
  }
  return [
    tf("add.methodDef1"),
    tf("add.methodDef2"),
    tf("add.methodDef3"),
  ];
}
