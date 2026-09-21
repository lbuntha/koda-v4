import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { partWord } from "../internal/data/fractionNumbers";
import { printLine } from "../internal/ui/printFigures";
import { FractionBar } from "../internal/ui/FractionBar";
import {
  MIXED_REFUSALS,
  boardTotal,
  breakOne,
  buildMixedQuestion,
  canBreak,
  canGroup,
  explainMixed,
  groupOne,
  improperName,
  mixedBlockedBecause,
  mixedName,
  startingBoard,
  type Board,
  type MixedBlock,
  type MixedMode,
  type MixedQuestion,
  type MixedSetup,
} from "../internal/data/fractionMixed";

/**
 * Loose parts, and whole ones, and the fact that they are the same amount.
 *
 * One action: group enough loose parts into a whole, or break a whole back into
 * parts. Both directions are the same action run backwards, and the running
 * total of parts is shown throughout — because the claim being made is that
 * nothing is added or taken away while the notation changes, and a child who
 * cannot see that has been told it instead.
 */

interface MixedParams {
  question?: MixedSetup;
  mode?: MixedMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: MixedParams, index: number, seen?: Set<string>): MixedQuestion {
  const setup: MixedSetup = { ...params, ...params.question };
  const mode = modeAt<MixedMode>(setup, index + 1, "to_mixed");
  return buildMixedQuestion(setup, mode, index, seen);
}

export const promptFor = (question: MixedQuestion): string => question.prompt;

export function mixedHints(question: MixedQuestion): string[] {
  const { improper: f, mixed: m } = question;
  const piece = partWord(f.parts, true);
  switch (question.mode) {
    case "to_mixed":
      return composeHints(
        `It takes ${f.parts} ${piece} to make one whole.`,
        `So group them ${f.parts} at a time, and count how many whole ones you get.`,
        "Whatever is left over when you cannot make another whole is the fraction part.",
      );
    case "to_improper":
      return composeHints(
        `Each whole one you break up gives you ${f.parts} ${piece}.`,
        `${m.ones} whole ${m.ones === 1 ? "one" : "ones"} gives you ${m.ones * f.parts} of them.`,
        "Add the ones that were already loose, and that is the whole answer.",
      );
    default:
      return composeHints(
        "Find the whole number first and go to that mark.",
        `Then count on in ${piece} from there.`,
        "The two names sit on exactly the same mark, because they are the same number.",
      );
  }
}

/** The same arrangement, not merely the same amount. */
const sameBoard = (a: Board, b: Board): boolean =>
  a.ones === b.ones && a.loose === b.loose && a.parts === b.parts;

export const MixedBoard: React.FC<ActivityProps<MixedParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: MixedSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as MixedQuestion;

  const [board, setBoard] = useState<Board | null>(null);
  const [marker, setMarker] = useState<number | null>(null);
  const [refused, setRefused] = useState<MixedBlock>(null);

  useEffect(() => {
    if (!question) return;
    setBoard(startingBoard(question));
    setMarker(null);
    setRefused(null);
  }, [question]);

  const hints = !question || practising ? [] : mixedHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
    progress:
      (question && board && !sameBoard(board, startingBoard(question)) ? 1 : 0) +
      (marker === null ? 0 : 1),
  });

  if (!question || !board) return null;

  const { improper: f } = question;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const move = (next: Board): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setBoard(next);
    guide.moved();
  };

  const submit = (given: string, correct: boolean): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given,
      expected: question.expected,
      title: correct ? "Yes!" : "Not yet",
      message: explainMixed(question, correct),
    });
  };

  const checkBoard = (): void => {
    const block = mixedBlockedBecause(question, board);
    if (block) {
      setRefused(block);
      guide.stumbled();
      say(MIXED_REFUSALS[block]);
      return;
    }
    submit(
      question.direction === "group" ? `${board.ones} ${board.loose}/${board.parts}` : String(board.loose),
      true,
    );
  };

  const checkPlacement = (): void => {
    if (marker === null) {
      setRefused("not-placed");
      guide.stumbled();
      say(MIXED_REFUSALS["not-placed"]);
      return;
    }
    submit(`tick ${marker}`, marker === question.tick);
  };

  const shadedOf = (n: number) => Array.from({ length: n }, (_, i) => i);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Wholes and Parts"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
      onStartOver={
        !round.feedback && (marker !== null || (board && !sameBoard(board, startingBoard(question))))
          ? () => {
              setBoard(startingBoard(question));
              setMarker(null);
              setRefused(null);
            }
          : undefined
      }
      iconName="Boxes"
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
        {question.mode === "on_line" ? (
          <>
            <div
              data-testid="line"
              aria-label={`Line in ${question.intervals} jumps, marker ${marker === null ? "not placed" : `on ${marker}`}`}
              className="w-full overflow-x-auto rounded-2xl bg-surface p-3"
            >
              <svg viewBox="-14 0 328 64" width={328} height={64} className="mx-auto text-ink">
                <line x1={0} y1={26} x2={300} y2={26} stroke="currentColor" strokeWidth="1.6" />
                {Array.from({ length: (question.intervals ?? 0) + 1 }, (_, i) => {
                  const x = (i / (question.intervals ?? 1)) * 300;
                  const isWhole = i % f.parts === 0;
                  return (
                    <g key={i}>
                      <line x1={x} y1={isWhole ? 14 : 19} x2={x} y2={33} stroke="currentColor" strokeWidth={isWhole ? 2.2 : 1.1} />
                      {isWhole ? (
                        <text x={x} y={48} fontSize="11" textAnchor="middle" fill="currentColor">
                          {i / f.parts}
                        </text>
                      ) : null}
                      <circle
                        cx={x}
                        cy={26}
                        r={9}
                        fill="transparent"
                        style={{ cursor: round.feedback ? undefined : "pointer" }}
                        onClick={() => {
                          if (round.feedback) return;
                          setMarker(i);
                          guide.moved();
                        }}
                      />
                    </g>
                  );
                })}
                {marker !== null ? <circle cx={(marker / (question.intervals ?? 1)) * 300} cy={26} r={7} className="fill-violet-500" /> : null}
              </svg>
            </div>
            {refused ? (
              <p role="status" className="text-center text-sm text-muted">
                {MIXED_REFUSALS[refused]}
              </p>
            ) : null}
            <button
              type="button"
              onClick={checkPlacement}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-emerald-600 px-6 py-2 text-base font-bold text-white shadow-sm"
            >
              That is where it goes
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2" data-testid="board">
              {Array.from({ length: board.ones }, (_, i) => (
                <div key={`w${i}`} className="flex flex-col items-center">
                  <FractionBar parts={1} shaded={[0]} scale={0.3} label="one whole" />
                  <span className="text-xs text-muted">1</span>
                </div>
              ))}
              {board.loose > 0 ? (
                <div className="flex flex-col items-center">
                  <FractionBar parts={f.parts} shaded={shadedOf(board.loose)} scale={0.7} label={`${board.loose} loose parts`} />
                  <span className="text-xs text-muted">
                    {board.loose}/{f.parts}
                  </span>
                </div>
              ) : null}
            </div>

            <p className="text-sm font-semibold text-ink" data-testid="total">
              {board.ones > 0 ? `${board.ones} and ` : ""}
              {board.loose}/{f.parts}
            </p>
            {labelsEnabled && !practising ? (
              <p className="text-xs text-muted" data-testid="running">
                still {boardTotal(board)} {partWord(f.parts, true)} altogether
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => move(groupOne(board))}
                disabled={!canGroup(board) || !!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-30"
              >
                make a whole
              </button>
              <button
                type="button"
                onClick={() => move(breakOne(board))}
                disabled={!canBreak(board) || !!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-30"
              >
                break one up
              </button>
            </div>

            {refused ? (
              <p role="status" className="text-center text-sm text-muted">
                {MIXED_REFUSALS[refused]}
              </p>
            ) : null}

            <button
              type="button"
              onClick={checkBoard}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-emerald-600 px-6 py-2 text-base font-bold text-white shadow-sm"
            >
              That is it
            </button>
            {/* Only once they have answered. Shown before, it is the answer. */}
            {round.feedback ? (
              <p className="text-xs text-muted">
                {improperName(f)} is the same as {mixedName(question.mixed)}
              </p>
            ) : null}
          </>
        )}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/** Both names of one amount, written out. */
export function printedFor(question: MixedQuestion): { text: string; answer: string } | null {
  switch (question.mode) {
    case "to_mixed":
      return {
        text: `Write ${improperName(question.improper)} as a whole number and a fraction.`,
        answer: question.expected,
      };
    case "to_improper":
      return {
        text: `Write ${mixedName(question.mixed)} as one fraction.`,
        answer: question.expected,
      };
    default:
      return {
        text: `Mark ${mixedName(question.mixed)} on the line, and write its other name.`,
        answer: improperName(question.improper),
      };
  }
}

/** Only the line level draws: the other two are written both ways. */
export const figureFor = (question: MixedQuestion): React.ReactNode | null =>
  question.mode === "on_line"
    ? printLine(question.span ?? 1, question.intervals ?? question.improper.parts)
    : null;

export function methodFor(question: MixedQuestion): string[] | null {
  if (question.mode === "to_improper") {
    return [
      "Every whole one breaks into as many parts as the bottom number says.",
      "Break them all up, then add the parts that were already loose.",
    ];
  }
  if (question.mode === "to_mixed") {
    return [
      "Gather the parts into whole ones: one whole for every full set of them.",
      "Whatever is left over stays as a fraction.",
    ];
  }
  return [
    "Find the whole number first and go to that mark.",
    "Then count on in parts from there.",
    "Both names belong to the same mark, because they are the same number.",
  ];
}
