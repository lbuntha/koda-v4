import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
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
        `Both are ${partWord(left.parts, true)}, so the pieces are already the same size.`,
        "That means you can simply count them together.",
        "The bottom number does not change — you have not cut anything.",
      );
    case "subtract_like":
      return composeHints(
        `Both are ${partWord(left.parts, true)}, so you can take one count from the other.`,
        "Count what is left on the strip.",
        "The bottom number stays put. Only how many you have changes.",
      );
    case "refute":
      return composeHints(
        "Lay both fractions along the strip, one after the other.",
        `Cut them both into ${piece} so the pieces are the same size.`,
        "Now count. The claimed answer is smaller than one of the pieces you started with — so it cannot be their total.",
      );
    case "add_nested":
      return composeHints(
        `One bottom number goes into the other, so only one bar needs cutting.`,
        `Cut the ${partWord(Math.min(left.parts, right.parts), true)} into ${partWord(Math.max(left.parts, right.parts), true)}.`,
        "Now both are the same size, so count them together.",
      );
    case "add_mixed":
      return composeHints(
        "Deal with the whole ones first, then the parts.",
        `Cut both fraction parts to ${piece} so they match.`,
        "If the parts make more than one whole, that whole joins the others.",
      );
    case "subtract_mixed":
      return composeHints(
        "There are not enough loose parts to take that many away.",
        `Break one whole up — it gives you ${common} more ${piece}.`,
        "Now take them away, and count the whole ones that are left.",
      );
    default:
      return composeHints(
        "The pieces are different sizes, so counting them now would mean nothing.",
        `Find a size both fit into — ${common} works for these.`,
        "Cut both bars to that size, then count.",
      );
  }
}

export const AddStrip: React.FC<ActivityProps<AddParams>> = ({ params, koda, onComplete, lesson }) => {
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
  };

  const answer = (text: string): void => {
    const block = addBlockedBecause(question, matchedYet);
    if (block) {
      setRefused(block);
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
      title: correct ? "Yes!" : "Not yet",
      message: explainAdd(question, correct),
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Adding Pieces"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : addHints(question)}
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
            Cut them to match
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
