import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { NumberPad } from "../internal/ui/NumberPad";
import {
  DIGIT_REFUSALS,
  answerMatches,
  buildColumnQuestion,
  judgeDigit,
  type ColumnMode,
  type ColumnQuestion,
  type ColumnSetup,
  type DigitVerdict,
} from "../internal/data/divisionColumn";

/**
 * Short division, long division, and the first step past the point.
 *
 * Digits are judged where they are written rather than at the end. That is not
 * strictness — it is the difference between a method and a guess. A child who
 * puts 6 where 7 belongs and carries on spends four more steps on an answer that
 * stopped being recoverable at the first one, and the cross at the bottom tells
 * them nothing about where. Here the place tells them: *another whole one fits
 * there*, and the working in front of them shows why.
 *
 * Long division is the same loop with a wider divisor. The estimate stops being
 * free — "how many 23s in 147" is a guess a child checks and revises — so the
 * refusals do real work there, and the same two sentences cover both.
 */

interface ColumnParams {
  question?: ColumnSetup;
  mode?: ColumnMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: ColumnParams, index: number, seen?: Set<string>): ColumnQuestion {
  const setup: ColumnSetup = { ...params, ...params.question };
  const mode = modeAt<ColumnMode>(setup, index + 1, "short_exact");
  return buildColumnQuestion(setup, mode, index, seen);
}

export const promptFor = (question: ColumnQuestion): string => question.prompt;

/**
 * A ladder per mode, because the modes go wrong in different places.
 *
 * These five levels used to share one ladder, and it was the worst writing in
 * the skill: rungs two and three said the same thing twice, and it offered
 * `short_exact` — the mode that never carries — advice about what to do with a
 * carry. A child stuck on level 33 was being told about a step their question
 * does not contain.
 *
 * This is also the place where hint quality matters most. From here on the
 * lessons are the hard ones, and with no prompt read aloud the ladder is the
 * only support left.
 */
export function columnHints(question: ColumnQuestion): string[] {
  const { divisor, dividend } = question;
  const first = question.dividendDigits[0];

  switch (question.mode) {
    case "short_exact":
      return composeHints(
        "Start at the left-hand digit. Division is the one written method that begins at the big end.",
        `Each digit of ${dividend} divides by ${divisor} exactly, so every column gives a clean answer.`,
        "Work one column at a time to the right. Every digit gets an answer written above it.",
      );
    case "short_exchange":
      return composeHints(
        `Start at the left. How many ${divisor}s fit into ${first}?`,
        `It will not go evenly. Write what is left small, in front of the next digit.`,
        "Then divide that whole new number — the small carry and the digit read together.",
      );
    case "short_remainder":
      return composeHints(
        `Start at the left and carry leftovers along as usual.`,
        "Keep going all the way to the last digit.",
        `At the last digit there is nowhere left to carry to. Whatever is left there is the remainder, and it is smaller than ${divisor}.`,
      );
    case "zero_digit":
      return composeHints(
        "Work along the places one at a time, and do not skip one because it looks too small.",
        `When ${divisor} does not go into a place at all, the answer for that place is zero.`,
        "A zero above the line is a real digit holding a place open. Leaving it out makes the answer ten times too small.",
      );
    case "long_exact":
    case "long_remainder":
      return composeHints(
        `${divisor} is too big to fit into one digit, so take the first two or three digits together.`,
        `Guess how many ${divisor}s fit, then multiply your guess out to check it.`,
        question.mode === "long_remainder"
          ? `Too much left means the guess was too small; going past means it was too big. What is left at the very end is the remainder — check it is under ${divisor}.`
          : "Too much left means the guess was too small; going past means it was too big. Fix it, take it away, and bring the next digit down.",
      );
    default:
      return composeHints(
        "Work out the whole part first, and see what is left.",
        "Put a point after the answer and a zero after the total, then carry on exactly as before.",
        "What was left becomes tenths, then hundredths. Nothing about the method changes at the point.",
      );
  }
}

export const DivisionPad: React.FC<ActivityProps<ColumnParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: ColumnSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const scaffoldEnabled = koda.config.isEnabled("inverse_scaffold", true);
  const notation = koda.config.get("remainderNotation", "r");

  const seen = useMemo(() => new Set<string>(), []);
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
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as ColumnQuestion;

  /** Quotient digits written so far, then the decimals, then the remainder. */
  const [digits, setDigits] = useState<number[]>([]);
  const [decimals, setDecimals] = useState<number[]>([]);
  const [remainder, setRemainder] = useState("");
  const [refused, setRefused] = useState<Exclude<DigitVerdict, "ok"> | null>(null);

  useEffect(() => {
    if (!question) return;
    setDigits([]);
    setDecimals([]);
    setRemainder("");
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const wholeDone = digits.length === question.dividendDigits.length;
  const decimalsDone = !question.hasDecimal || decimals.length === question.decimalDigits.length;
  /** What is left once every whole place has been worked. */
  const leftOver = question.steps[question.steps.length - 1]?.carry ?? 0;
  const ready = wholeDone && decimalsDone && (!question.wantsRemainder || remainder !== "");

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };
  const chime = (ok: boolean): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(ok ? "clink" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (ok) koda.haptics.tap();
      else koda.haptics.pulse("error");
    }
  };

  /**
   * Take one digit, at whichever place is next.
   *
   * Whole places are judged as they are written. The decimal tail and the
   * remainder are not: by then the division is done and the child is recording
   * it, not deciding it.
   */
  const digit = (n: number): void => {
    if (!wholeDone) {
      const verdict = judgeDigit(question.steps[digits.length].working, question.divisor, n);
      if (verdict !== "ok") {
        chime(false);
        setRefused(verdict);
        say(DIGIT_REFUSALS[verdict]);
        return;
      }
      chime(true);
      setRefused(null);
      setDigits((current) => [...current, n]);
      return;
    }
    if (question.hasDecimal && decimals.length < question.decimalDigits.length) {
      chime(true);
      setDecimals((current) => [...current, n]);
      return;
    }
    if (question.wantsRemainder) {
      setRemainder((v) => (v.length >= 2 ? v : v + String(n)));
    }
  };

  const backspace = (): void => {
    setRefused(null);
    if (question.wantsRemainder && remainder !== "") {
      setRemainder((v) => v.slice(0, -1));
      return;
    }
    if (decimals.length > 0) {
      setDecimals((current) => current.slice(0, -1));
      return;
    }
    setDigits((current) => current.slice(0, -1));
  };

  const check = (): void => {
    const correct = answerMatches(question, digits, remainder, decimals);
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    const given = question.hasDecimal
      ? `${Number(digits.join(""))}.${decimals.join("")}`
      : question.wantsRemainder
        ? `${Number(digits.join(""))} ${notation} ${remainder}`
        : String(Number(digits.join("")));
    round.submit({
      correct,
      given,
      expected: question.expected,
      title: correct ? "Yes!" : "Not yet",
      message: correct
        ? `${question.dividend} ÷ ${question.divisor} = ${question.expected}.`
        : question.wantsRemainder && Number(remainder) !== question.remainder
          ? "The digits above the line are right. Check what is left at the end."
          : "Work back along the places and check each one.",
    });
  };

  const working = wholeDone ? null : question.steps[digits.length];

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="The Written Method"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : columnHints(question)}
      iconName="Divide"
      iconTone="indigo"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              say(promptFor(question));
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {/* The bus stop: answer above the line, total inside it. */}
        <div className="mx-auto font-mono text-xl" data-testid="bus-stop">
          <div className="flex items-end">
            <span className="invisible pr-1">{question.divisor}</span>
            <span className="border-b-2 border-ink px-1 pb-1">
              {question.dividendDigits.map((_, i) => (
                <span key={i} className="inline-block min-w-7 text-center font-bold text-ink">
                  {digits[i] ?? " "}
                </span>
              ))}
              {question.hasDecimal ? (
                <>
                  <span className="font-bold text-ink">.</span>
                  {question.decimalDigits.map((_, i) => (
                    <span key={`d${i}`} className="inline-block min-w-7 text-center font-bold text-ink">
                      {decimals[i] ?? " "}
                    </span>
                  ))}
                </>
              ) : null}
            </span>
          </div>
          <div className="flex items-start">
            <span className="pr-1 text-muted">{question.divisor}</span>
            <span className="border-l-2 border-ink px-1 pt-1">
              {question.dividendDigits.map((value, i) => (
                <span key={i} className="relative inline-block min-w-7 text-center text-ink">
                  {/* The carry, written small in front of the next digit —
                      exactly where a child writes it on paper. */}
                  {i > 0 && digits.length >= i && question.steps[i - 1].carry > 0 ? (
                    <sup className="absolute -left-0.5 -top-1 text-[0.6em] text-rose-500">
                      {question.steps[i - 1].carry}
                    </sup>
                  ) : null}
                  {value}
                </span>
              ))}
              {question.hasDecimal ? <span className="text-muted">.0</span> : null}
            </span>
          </div>
        </div>

        {working && scaffoldEnabled && !practising ? (
          <p className="text-center text-sm text-muted" data-testid="working">
            How many {question.divisor}s in {working.working}?
          </p>
        ) : null}

        {question.wantsRemainder && wholeDone ? (
          <div className="flex items-center justify-center gap-2 text-lg">
            <span className="text-muted">left over</span>
            <span
              data-testid="remainder-slot"
              aria-label={`Left over: ${remainder || "empty"}`}
              className="min-h-11 min-w-14 rounded-xl border-2 border-rose-500 px-3 py-1 text-center font-bold text-ink"
            >
              {remainder || " "}
            </span>
          </div>
        ) : null}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {DIGIT_REFUSALS[refused]}
          </p>
        ) : null}

        <NumberPad
          onDigit={digit}
          onBackspace={backspace}
          onSubmit={check}
          disabled={!!round.feedback}
          canSubmit={ready}
        />

        {leftOver > 0 && !question.wantsRemainder && !question.hasDecimal && wholeDone ? (
          <p className="text-center text-xs text-muted">Something is left over — check your digits.</p>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: ColumnQuestion): { text: string; answer: string } | null {
  return { text: `${question.divisor} ) ${question.dividend}`, answer: question.expected };
}

export function methodFor(question: ColumnQuestion): string[] {
  /*
   * The mode decides, not the divisor.
   *
   * `decimal_tail` draws divisors either side of ten — 4 and 50 are both in its
   * pool — so branching on `divisor > 9` gave one sheet the long-division
   * method and another the short one, for the same lesson.
   */
  if (question.mode === "decimal_tail") {
    return [
      "Divide the whole part first and see what is left.",
      "Put a point in the answer, and a zero after the total.",
      "Carry on exactly as before: what was left becomes tenths.",
    ];
  }
  return question.mode === "long_exact" || question.mode === "long_remainder"
    ? [
        "Guess how many fit into the first part, then check by multiplying.",
        "Take it away, and bring the next digit down.",
        "Keep going to the last digit. What is left at the end is the remainder.",
      ]
    : [
        "Start at the left-hand digit and work right.",
        "Write what is left over small, in front of the next digit.",
        "Every place gets a digit above the line, even when that digit is zero.",
      ];
}
