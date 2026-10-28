import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
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
import { tf } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
        tf("line.hintUnit1", { parts, word: partWord(parts) }),
        tf("line.hintUnit2"),
        tf("line.hintUnit3"),
      );
    case "place_any":
      return composeHints(
        tf("line.hintAny1", { word: partWord(parts) }),
        tf("line.hintAny2", { taken }),
        tf("line.hintAny3"),
      );
    case "read_point":
      return composeHints(
        tf("line.hintRead1"),
        tf("line.hintRead2", { parts }),
        tf("line.hintRead3"),
      );
    case "makes_one":
      return composeHints(
        tf("line.hintOne1"),
        tf("line.hintOne2", { words: partWord(parts, true) }),
        tf("line.hintOne3"),
      );
    default:
      return composeHints(
        tf("line.hintImp1"),
        tf("line.hintImp2", { taken, word: partWord(parts) }),
        tf("line.hintImp3"),
      );
  }
}

export const FractionLine: React.FC<ActivityProps<LineParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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

  const hints = !question || practising ? [] : lineHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
    progress: marker === null ? 0 : 1,
  });

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
    guide.moved();
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? tf("line.yes") : tf("line.notYet"), message });
  };

  const checkPlacement = (): void => {
    const block = lineBlockedBecause(question, marker);
    if (block) {
      setRefused(block);
      guide.stumbled();
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
      fallbackTitle={tf("line.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
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
          aria-label={tf("line.ariaLine", { intervals, state: marker === null ? tf("line.notPlacedState") : tf("line.onJump", { marker }) })}
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
            {tf("line.thatIs")}
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
      return { text: tf("line.printRead"), answer: question.expected };
    case "makes_one":
      return {
        text: tf("line.printOne", { fraction: nameOf(fraction) }),
        answer: question.expected,
      };
    case "improper":
      return { text: tf("line.printImproper", { fraction: nameOf(fraction) }), answer: question.expected };
    default:
      return { text: tf("line.printMark", { fraction: nameOf(fraction) }), answer: nameOf(fraction) };
  }
}

export const figureFor = (question: LineQuestion): React.ReactNode =>
  printLine(question.span, question.intervals);

export function methodFor(question: LineQuestion): string[] | null {
  if (question.mode === "makes_one") {
    return [
      tf("line.methodOne1"),
      tf("line.methodOne2"),
    ];
  }
  return [
    tf("line.method1"),
    tf("line.method2"),
    tf("line.method3"),
  ];
}
