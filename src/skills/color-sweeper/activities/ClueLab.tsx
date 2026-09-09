import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { quietWhenPractising } from "../../kit/practice";
import type { Color } from "../internal/board";
import { BoardGrid, tileLabel } from "../internal/BoardGrid";
import { PALETTE } from "../internal/palette";
import type { BoardMode } from "../internal/puzzles";
import { clueName, forces, generateLab, LAB_MODES, type Lab, type LabMode } from "../internal/reasons";
import { chime, speechRate, tagLabelsFrom } from "../internal/sweeperChrome";
import { useNudge } from "../internal/useNudge";

/**
 * Judging a deduction instead of making one.
 *
 * Three questions about somebody else's reasoning: which clues were enough,
 * why the move works, and which clue a finished board breaks. All three are
 * marked by re-doing the work — a chosen set of clues is re-solved to see
 * whether it forces the tile, and a clue is broken only if recounting the
 * painted board says so. Nothing here compares an answer against a key.
 *
 * More than one answer can be right, and that is the point of two of these
 * levels: a reason said differently is the same reason, and a board painted
 * wrong can break more than one clue.
 */

interface LabSetup {
  mode?: LabMode;
  modes?: string[];
  practice?: boolean;
  source?: BoardMode;
  palette?: Color[];
  questionsPerRound?: number;
}

export interface LabParams extends LabSetup {
  question?: LabSetup;
  play?: unknown;
}

export interface LabQuestion extends Omit<RoundQuestion, "expected">, Lab {}

const DEFAULTS = { questionsPerRound: 5 };

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const promptText = (lab: Lab): string => {
  switch (lab.mode) {
    case "compare_clues":
      return `Which clues are enough, on their own, to decide the outlined tile?`;
    case "choose_reason":
      return `The outlined tile has been worked out. Which of these says why?`;
    case "find_error":
      return `Somebody coloured this board and one tile is wrong. Tap a clue that is not true.`;
  }
};

export function buildQuestion(params: LabParams, index: number, seen?: Set<string>): LabQuestion {
  const setup: LabSetup = { ...params, ...params.question };
  /* `modeAt` counts from one, as a round does; `buildQuestion` counts from
     zero. Passing the raw index asked for `modes[-1]` on the very first
     question of every practice round — undefined, and a throw. Invisible until
     a lesson actually set `modes`, which no teaching lesson does. */
  const mode = modeAt(setup, index + 1, setup.mode ?? "compare_clues") as LabMode;
  if (!LAB_MODES.includes(mode)) throw new Error(`ClueLab has no "${mode}" mode`);
  const lab = generateLab({ mode, source: setup.source, palette: setup.palette }, index * 1009 + 17, { seen });
  return {
    ...lab,
    taskKind: `sweeper_${mode}`,
    prompt: promptText(lab),
    itemCount: lab.board.clues.length,
  };
}

export const promptFor = (question: LabQuestion): string => question.prompt ?? promptText(question);

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export const figureFor = (question: LabQuestion): React.ReactNode => (
  <BoardGrid board={question.board} assignment={question.assignment} target={question.target}
    availableWidth={260} label="Board" />
);

export function printedFor(question: LabQuestion): PrintedQuestion | null {
  const spot = question.target === undefined ? "" : ` (${tileLabel(question.board, question.target).replace(", the outlined tile", "")})`;
  if (question.mode === "find_error") {
    return {
      text: "One tile in this board is the wrong colour. Write down a clue that is not true, and why. ____",
      answer: `Any of: ${question.expected}`,
    };
  }
  return {
    text: question.mode === "compare_clues"
      ? `Which clues are enough on their own to decide the outlined tile${spot}? ____`
      : `Write down why the outlined tile${spot} must be the colour it is. ____`,
    answer: question.expected,
  };
}

export function methodFor(): string[] | null {
  return [
    "A set of clues is enough when it decides the tile without any other help.",
    "A reason names the clue, the colour it counts, and what that leaves.",
    "To check a board, count each clue's colour around it and compare with its number.",
  ];
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

export function labHints(question: LabQuestion, kidTip: string | undefined): string[] {
  switch (question.mode) {
    case "compare_clues":
      return composeHints(kidTip,
        "Take one option at a time and ask: with only these clues, could I still work the tile out?",
        // Never names the sufficient set — choosing it is the question.
        "A clue that is true but says nothing about this tile is not evidence for it.");
    case "choose_reason":
      return composeHints(kidTip,
        "A reason has to name a clue, and say what that clue leaves for this tile.",
        "More than one of these is a fair way of saying it. What makes the others wrong is what they claim a clue counts.");
    case "find_error":
      return composeHints(kidTip,
        "Take one clue and count its colour around it. Compare that with its number.",
        "Work through the clues in turn. The wrong tile may break more than one.");
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const ClueLab: React.FC<ActivityProps<LabParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: LabSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? DEFAULTS.questionsPerRound;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);

  const seen = useMemo(() => new Set<string>(), []);
  const nudge = useNudge(koda);
  const clearNudge = nudge.clear;

  const speakAloud = (text: string) => {
    if (!koda.config.isEnabled("audio_speech", true)) return;
    void koda.speech.say(text, speechRate(koda)).catch(() => {});
  };
  const speak = quietWhenPractising(speakAloud, practising);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    /* `useSkillRound` counts from one; `buildQuestion` counts from zero. */
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as LabQuestion;

  useEffect(() => { clearNudge(); }, [question, clearNudge]);

  if (!question) return null;

  const finish = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled && correct) koda.haptics.success();
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  const answerOption = (id: string) => {
    if (round.feedback) return;
    const option = question.options!.find((o) => o.id === id)!;
    /* Re-solved rather than looked up: a set of clues is right when it works,
       whoever thought of it. */
    const correct = question.mode === "compare_clues"
      ? forces(question.board, option.clueIds!, question.target!)
      : option.correct;
    finish(correct, option.text,
      correct
        ? question.mode === "compare_clues" ? "Enough on their own" : "That is a fair reason"
        : question.mode === "compare_clues" ? "Not enough yet" : "Not why it works",
      correct
        ? question.mode === "compare_clues"
          ? "With only those clues the tile still comes out."
          : "It names a clue and says what that clue leaves."
        : option.trap === "not-enough"
          ? "That clue is true, but on its own it leaves the tile open."
          : option.trap === "unrelated"
            ? "That clue says nothing about this tile."
            : option.trap === "counts-itself"
              ? "A clue never counts its own tile."
              : option.trap === "skips-diagonals"
                ? "The corner-touching tiles count too."
                : "Check which colour the clue counts, and where.");
  };

  const answerClue = (cell: number) => {
    if (round.feedback) return;
    const clue = question.board.clues.find((c) => c.cell === cell);
    if (!clue) {
      /* Not a wrong answer: the child pointed at a tile, not at a clue. */
      nudge.refuse("That tile has no clue on it. Tap one with a number.");
      speak("Tap a clue.");
      return;
    }
    /* Every clue the painted board actually breaks is a right answer, not just
       the one nearest the mistake. */
    const correct = question.violated!.includes(clue.id);
    finish(correct, clueName(question.board, clue),
      correct ? "That one is not true" : "That clue holds",
      correct
        ? `Count its colour around it and compare with its number — they do not match.`
        : `Count around it: it says ${clue.count}, and that is what is there. Try another.`);
  };

  const optionButton =
    "min-h-11 rounded-2xl border-2 border-ink/20 bg-surface px-4 py-3 text-left text-base font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Give a Reason"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : labHints(question, copy.kidTip)}
      iconName="search"
      iconTone="emerald"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <BoardGrid
          board={question.board}
          assignment={question.assignment}
          target={question.target}
          onTap={question.mode === "find_error" ? answerClue : undefined}
          locked={Boolean(round.feedback)}
          label={question.mode === "find_error" ? "Board somebody has coloured" : "Board"}
        />

        {question.options && (
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-2">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => answerOption(option.id)}
                disabled={Boolean(round.feedback)}
                aria-label={option.text}
                className={optionButton}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </SkillRound>
  );
};
