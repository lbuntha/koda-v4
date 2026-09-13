import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { partWord } from "../internal/data/fractionNumbers";
import { printLine } from "../internal/ui/printFigures";
import {
  LINE_REFUSALS,
  explainLine,
  buildLineQuestion,
  lineBlockedBecause,
  nameOf,
  wholeTicks,
  type LineBlock,
  type LineMode,
  type LineQuestion,
  type LineSetup,
} from "../internal/data/fractionLine";

/**
 * A fraction with a place of its own.
 *
 * The strip says a fraction is part of a thing. This says it is a *number*, and
 * the two together are what let a child eventually compare, add and divide with
 * fractions rather than only shade them. It is also where "3/4 is a 3 and a 4"
 * finally becomes untenable: two numbers do not have one place on a line.
 *
 * The line is ruled in the denominator, so every tick is somewhere the marker
 * can land. Ruling it in ones and asking a child to judge three quarters of the
 * gap would be a different, harder task than the one being taught.
 */

interface LineParams {
  question?: LineSetup;
  mode?: LineMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: LineParams, index: number, seen?: Set<string>): LineQuestion {
  const setup: LineSetup = { ...params, ...params.question };
  const mode = modeAt<LineMode>(setup, index + 1, "place_unit");
  return buildLineQuestion(setup, mode, index, seen);
}

export const promptFor = (question: LineQuestion): string => question.prompt;

export function lineHints(question: LineQuestion): string[] {
  const { parts, taken } = question.fraction;
  switch (question.mode) {
    case "place_unit":
      return composeHints(
        `The line from 0 to 1 is cut into ${parts} equal jumps, each one ${partWord(parts)}.`,
        "One of those jumps is the fraction you want.",
        "Count one jump from zero and stop there.",
      );
    case "place_any":
      return composeHints(
        `Every jump along this line is one ${partWord(parts)}.`,
        `Count ${taken} jumps from zero.`,
        "The number on top tells you how many jumps, not where to stop guessing.",
      );
    case "read_point":
      return composeHints(
        "Count the jumps from zero to the marker.",
        `The line is cut into ${parts} jumps altogether, so ${parts} goes underneath.`,
        "Count the jumps, not the marks. There is always one more mark than jump.",
      );
    case "makes_one":
      return composeHints(
        "Count the jumps from 0 all the way to 1.",
        `However many jumps that is, that many ${partWord(parts, true)} make one whole.`,
        "Any fraction with the same number top and bottom is one whole.",
      );
    default:
      return composeHints(
        "This line goes past 1, so the fraction can too.",
        `Count ${taken} jumps of one ${partWord(parts)} from zero, straight past the 1.`,
        "A fraction bigger than one is still one number with one place.",
      );
  }
}

export const FractionLine: React.FC<ActivityProps<LineParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: LineSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as LineQuestion;

  const [marker, setMarker] = useState<number | null>(null);
  const [refused, setRefused] = useState<LineBlock>(null);

  useEffect(() => {
    if (!question) return;
    // Where the picture is given, the marker is already on the answer.
    setMarker(question.placesIt ? null : question.tick);
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const { intervals } = question;
  const W = 300;
  const at = (i: number) => (i / Math.max(1, intervals)) * W;
  const wholes = wholeTicks(question);

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const place = (i: number): void => {
    if (!question.placesIt || round.feedback) return;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setMarker(i);
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? "Yes!" : "Not yet", message });
  };

  const checkPlacement = (): void => {
    const block = lineBlockedBecause(question, marker);
    if (block) {
      setRefused(block);
      say(LINE_REFUSALS[block]);
      return;
    }
    const correct = marker === question.tick;
    submit(`tick ${marker}`, correct, explainLine(question, correct));
  };

  const answerName = (text: string): void => {
    const correct = text === question.expected;
    submit(text, correct, explainLine(question, correct, text));
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="On the Line"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : lineHints(question)}
      onStartOver={
        marker !== null && !round.feedback
          ? () => {
              setMarker(null);
              setRefused(null);
            }
          : undefined
      }
      iconName="MoveHorizontal"
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
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
        <div
          data-testid="line"
          aria-label={`Number line in ${intervals} jumps, marker ${marker === null ? "not placed" : `on jump ${marker}`}`}
          className="w-full overflow-x-auto rounded-2xl bg-surface p-3"
        >
          <svg viewBox="-14 0 328 64" width={328} height={64} className="mx-auto text-ink">
            <line x1={0} y1={26} x2={W} y2={26} stroke="currentColor" strokeWidth="1.6" />
            {Array.from({ length: intervals + 1 }, (_, i) => {
              const isWhole = wholes.includes(i);
              return (
                <g key={i}>
                  <line
                    x1={at(i)}
                    y1={isWhole ? 14 : 19}
                    x2={at(i)}
                    y2={33}
                    stroke="currentColor"
                    strokeWidth={isWhole ? 2.2 : 1.1}
                  />
                  {isWhole ? (
                    <text x={at(i)} y={48} fontSize="11" textAnchor="middle" fill="currentColor">
                      {i / question.fraction.parts}
                    </text>
                  ) : null}
                  {question.placesIt ? (
                    <circle
                      cx={at(i)}
                      cy={26}
                      r={9}
                      fill="transparent"
                      style={{ cursor: round.feedback ? undefined : "pointer" }}
                      onClick={() => place(i)}
                    />
                  ) : null}
                </g>
              );
            })}
            {marker !== null ? (
              <circle cx={at(marker)} cy={26} r={7} className="fill-violet-500" />
            ) : null}
          </svg>
        </div>

        {labelsEnabled && !practising ? (
          <p className="text-xs text-muted">every jump is 1/{question.fraction.parts}</p>
        ) : null}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {LINE_REFUSALS[refused]}
          </p>
        ) : null}

        {question.options ? (
          <div className="flex flex-wrap justify-center gap-3">
            {question.options.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => answerName(text)}
                disabled={!!round.feedback}
                className="min-h-11 min-w-16 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                {text}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={checkPlacement}
            disabled={!!round.feedback}
            className="min-h-11 rounded-2xl bg-violet-600 px-6 py-2 text-base font-bold text-white shadow-sm"
          >
            That is where it goes
          </button>
        )}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A number-line lesson on paper needs a line to mark.
 *
 * Printing "put the marker on 3/4" beside nothing is a caption, not a question,
 * so every one of these carries a ruled but unmarked line. The mark is never
 * drawn — a line that arrives with the answer on it is a picture of the answer.
 */
export function printedFor(question: LineQuestion): { text: string; answer: string } | null {
  const { fraction } = question;
  switch (question.mode) {
    case "read_point":
      return { text: "A cross is marked on the line. Write the fraction it sits on.", answer: question.expected };
    case "makes_one":
      return {
        text: `Start at ${nameOf(fraction)} and mark where one whole is. How much further is it?`,
        answer: question.expected,
      };
    case "improper":
      return { text: `Mark ${nameOf(fraction)} on the line. Write it as a mixed number.`, answer: question.expected };
    default:
      return { text: `Mark ${nameOf(fraction)} on the line.`, answer: nameOf(fraction) };
  }
}

export const figureFor = (question: LineQuestion): React.ReactNode =>
  printLine(question.span, question.intervals);

export function methodFor(question: LineQuestion): string[] | null {
  if (question.mode === "makes_one") {
    return [
      "One whole is where every part has been counted.",
      "Count the parts still to go from where you are to the whole number.",
    ];
  }
  return [
    "The bottom number says how many jumps there are between one whole number and the next.",
    "The top number says how many of those jumps to count from zero.",
    "Land on a mark, not between two.",
  ];
}
