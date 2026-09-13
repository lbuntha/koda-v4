import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { FractionBar } from "../internal/ui/FractionBar";
import { gcd, partWord } from "../internal/data/fractionNumbers";
import {
  MULTIPLY_REFUSALS,
  buildMultiplyQuestion,
  explainMultiply,
  isCorrectAnswer,
  multiplyBlockedBecause,
  nameOf,
  type MultiplyBlock,
  type MultiplyMode,
  type MultiplyQuestion,
  type MultiplySetup,
} from "../internal/data/fractionMultiply";

/**
 * Multiplying — three pictures, because they are three different ideas.
 *
 * `2/3 of 18` shares an amount out. `4 × 2/5` makes copies. `2/3 × 3/4` takes a
 * piece of a piece, and only the last one needs a grid: the first fraction is
 * shaded across, the second down, and the answer is the squares covered twice.
 *
 * The grid refuses an answer until both shadings are made, for the same reason
 * the adding strip refuses an unmatched sum. The overlap *is* the answer — a
 * child who has not made it has not looked at the question, and rewarding a
 * guess here teaches that the picture is decoration.
 */

interface AreaParams {
  question?: MultiplySetup;
  mode?: MultiplyMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: AreaParams, index: number, seen?: Set<string>): MultiplyQuestion {
  const setup: MultiplySetup = { ...params, ...params.question };
  const mode = modeAt<MultiplyMode>(setup, index + 1, "of_whole");
  return buildMultiplyQuestion(setup, mode, index, seen);
}

export const promptFor = (question: MultiplyQuestion): string => question.prompt;

export function multiplyHints(question: MultiplyQuestion): string[] {
  const { fraction, other, total, copies } = question;
  switch (question.mode) {
    case "of_whole":
      /*
       * No numbers in these three rungs.
       *
       * They all read perfectly well without them, and printing the denominator
       * as a count meant a hint sometimes said the answer out loud by accident —
       * "how many equal groups to make: 5" above a question whose answer is 5.
       */
      return composeHints(
        "The bottom number says how many equal groups to make.",
        "Share the whole amount out into that many groups, and see how many land in one group.",
        "The top number says how many of those groups to take.",
      );
    case "whole_times":
      return composeHints(
        `This is ${copies} copies of the same amount, laid end to end.`,
        "Adding the same thing over and over is what multiplying is, so count the shaded pieces.",
        "The pieces never changed size, so the bottom number never changes either.",
      );
    case "area_model":
      return composeHints(
        `Shade ${nameOf(fraction)} across the grid, then ${nameOf(other!)} down it.`,
        "Look at the squares that got shaded twice. That is the answer.",
        `Count them, out of all ${fraction.parts * other!.parts} squares in the grid.`,
      );
    case "simplify_first": {
      const across = gcd(fraction.parts, other!.taken) * gcd(fraction.taken, other!.parts);
      return composeHints(
        "You could multiply straight away, but the numbers get big and then need cutting down.",
        `Look diagonally: a number on the top and a number on the bottom share a factor of ${across}.`,
        "Divide both of them by it first. The answer is the same and the numbers are small.",
      );
    }
    default:
      return composeHints(
        "Do not work it out yet. Just look at the fraction doing the multiplying.",
        "Less than one whole means you are taking a part of the amount, so the answer is less.",
        "More than one whole means more than all of it. Exactly one means nothing changes.",
      );
  }
}

/** The three words level 37 answers with. */
const VERDICT_WORDS: Record<string, string> = {
  bigger: "Bigger than it was",
  smaller: "Smaller than it was",
  same: "Exactly the same",
};

export const AreaGrid: React.FC<ActivityProps<AreaParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: MultiplySetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildQuestion(params, i - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as MultiplyQuestion;

  /*
   * Which question has been shaded, not whether shading has happened.
   *
   * Keyed to the question id so there is no window — however brief — in which a
   * new question inherits the last one's finished grid and accepts an answer
   * nobody worked for.
   */
  const [acrossFor, setAcrossFor] = useState<string | null>(null);
  const [downFor, setDownFor] = useState<string | null>(null);
  const [cancelledFor, setCancelledFor] = useState<string | null>(null);
  const [refused, setRefused] = useState<MultiplyBlock>(null);

  useEffect(() => {
    if (!question) return;
    setAcrossFor(null);
    setDownFor(null);
    setCancelledFor(null);
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const across = acrossFor === question.id;
  const down = downFor === question.id;
  const cancelled = cancelledFor === question.id;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const tick = (): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
  };

  const answer = (text: string): void => {
    const block = multiplyBlockedBecause(question, across, down);
    if (block) {
      setRefused(block);
      say(MULTIPLY_REFUSALS[block]);
      return;
    }
    const correct = isCorrectAnswer(question, text);
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
      message: explainMultiply(question, correct),
    });
  };

  /** The grid for the two `a/b × c/d` levels. */
  const grid = (): React.ReactNode => {
    const columns = question.fraction.parts;
    const rows = question.other!.parts;
    const cell = 26;
    return (
      <svg
        role="img"
        aria-label={`Grid ${columns} across and ${rows} down${
          across ? `, ${question.fraction.taken} columns shaded` : ""
        }${down ? `, ${question.other!.taken} rows shaded` : ""}`}
        viewBox={`0 0 ${columns * cell} ${rows * cell}`}
        width={columns * cell}
        height={rows * cell}
        className="max-w-full"
        data-testid="grid"
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: columns }).map((_, c) => {
            const inColumn = across && c < question.fraction.taken;
            const inRow = down && r < question.other!.taken;
            const both = inColumn && inRow;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cell}
                y={r * cell}
                width={cell}
                height={cell}
                className={
                  both
                    ? "fill-violet-500"
                    : inColumn
                      ? "fill-violet-200"
                      : inRow
                        ? "fill-sky-200"
                        : "fill-surface-muted"
                }
                stroke="currentColor"
                strokeWidth={1}
                opacity={both ? 1 : undefined}
              />
            );
          }),
        )}
      </svg>
    );
  };

  /** The picture for whichever idea this level is about. */
  const picture = (): React.ReactNode => {
    switch (question.mode) {
      case "of_whole": {
        const perGroup = question.total! / question.fraction.parts;
        return (
          <div className="flex flex-wrap justify-center gap-2" data-testid="groups">
            {Array.from({ length: question.fraction.parts }).map((_, g) => (
              <div
                key={g}
                className={`rounded-xl px-2 py-1.5 ${
                  g < question.fraction.taken ? "bg-violet-100 dark:bg-violet-950/40" : "bg-surface-muted"
                }`}
                aria-label={`group ${g + 1} of ${question.fraction.parts}, ${perGroup} in it`}
              >
                <div className="grid grid-cols-5 gap-0.5">
                  {Array.from({ length: perGroup }).map((_, i) => (
                    <span
                      key={i}
                      className={`block h-2 w-2 rounded-full ${
                        g < question.fraction.taken ? "bg-violet-500" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case "whole_times":
        return (
          <div className="flex flex-col items-center gap-1" data-testid="copies">
            {Array.from({ length: question.copies! }).map((_, i) => (
              <FractionBar
                key={i}
                parts={question.fraction.parts}
                shaded={Array.from({ length: question.fraction.taken }, (_, k) => k)}
                scale={0.7}
                label={`copy ${i + 1}, ${nameOf(question.fraction)}`}
              />
            ))}
          </div>
        );
      case "area_model":
        return grid();
      case "simplify_first": {
        const g = gcd(question.fraction.parts, question.other!.taken) *
          gcd(question.fraction.taken, question.other!.parts);
        const a = cancelled
          ? {
              taken: question.fraction.taken / gcd(question.fraction.taken, question.other!.parts),
              parts: question.fraction.parts / gcd(question.fraction.parts, question.other!.taken),
            }
          : question.fraction;
        const b = cancelled
          ? {
              taken: question.other!.taken / gcd(question.fraction.parts, question.other!.taken),
              parts: question.other!.parts / gcd(question.fraction.taken, question.other!.parts),
            }
          : question.other!;
        return (
          <div className="flex flex-col items-center gap-3" data-testid="written">
            <p className="text-2xl font-black tracking-tight text-ink">
              {a.taken}/{a.parts} × {b.taken}/{b.parts}
            </p>
            {cancelled ? (
              <p className="text-sm text-muted">divided top and bottom by {g}</p>
            ) : (
              <button
                type="button"
                onClick={() => {
                  tick();
                  setCancelledFor(question.id);
                }}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Cancel first
              </button>
            )}
          </div>
        );
      }
      default:
        return (
          <div className="flex flex-col items-center gap-2" data-testid="scaling">
            <FractionBar
              parts={question.fraction.parts}
              shaded={Array.from(
                { length: Math.min(question.fraction.taken, question.fraction.parts) },
                (_, i) => i,
              )}
              label={`${nameOf(question.fraction)} of a strip`}
            />
            <p className="text-base text-ink">
              <span className="font-bold">{nameOf(question.fraction)}</span> of{" "}
              <span className="font-bold">{question.total}</span>
            </p>
          </div>
        );
    }
  };

  const choices = question.mode === "scaling"
    ? question.options.map((o) => ({ value: o, label: VERDICT_WORDS[o] }))
    : question.options.map((o) => ({ value: o, label: o }));

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="A Fraction of Something"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : multiplyHints(question)}
      onStartOver={
        !round.feedback && (across || down || cancelled)
          ? () => {
              setAcrossFor(null);
              setDownFor(null);
              setCancelledFor(null);
              setRefused(null);
            }
          : undefined
      }
      iconName="Grid3x3"
      iconTone="violet"
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
        {picture()}

        {question.mustShade ? (
          <div className="flex flex-wrap justify-center gap-2">
            {!across ? (
              <button
                type="button"
                onClick={() => {
                  tick();
                  setAcrossFor(question.id);
                }}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Shade {nameOf(question.fraction)} across
              </button>
            ) : null}
            {across && !down ? (
              <button
                type="button"
                onClick={() => {
                  tick();
                  setDownFor(question.id);
                }}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-5 py-2 text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                Shade {nameOf(question.other!)} down
              </button>
            ) : null}
          </div>
        ) : null}

        {labelsEnabled && !practising && across && down ? (
          <p className="text-xs text-muted">
            the darkest squares are shaded both ways — {question.fraction.taken * question.other!.taken} out of{" "}
            {question.fraction.parts * question.other!.parts}{" "}
            {partWord(question.fraction.parts * question.other!.parts, true)}
          </p>
        ) : null}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {MULTIPLY_REFUSALS[refused]}
          </p>
        ) : null}

        <div className={question.mode === "scaling" ? "flex w-full flex-col gap-2" : "flex flex-wrap justify-center gap-3"}>
          {choices.map((choice) => (
            <button
              key={choice.value}
              type="button"
              onClick={() => answer(choice.value)}
              disabled={!!round.feedback}
              className={
                question.mode === "scaling"
                  ? "min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  : "min-h-11 min-w-16 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              }
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
