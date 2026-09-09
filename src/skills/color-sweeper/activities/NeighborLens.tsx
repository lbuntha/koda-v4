import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { quietWhenPractising } from "../../kit/practice";
import { selectionKey, type Color } from "../internal/board";
import { BoardGrid, tileLabel } from "../internal/BoardGrid";
import { PALETTE } from "../internal/palette";
import { generateLens, LENS_MODES, type Lens, type LensMode } from "../internal/lenses";
import { chime, speechRate, tagLabelsFrom } from "../internal/sweeperChrome";
import { useNudge } from "../internal/useNudge";

/**
 * Reading a board, before anything is painted.
 *
 * Four questions that sound alike and are not: which tiles touch this one,
 * how many of them match its colour, what does this clue actually say, and
 * what does it say about the colour it never mentions. A child who can paint
 * a board but cannot answer the third has been guessing successfully.
 *
 * Nothing here is a deduction, so nothing here consults the solver. The board
 * is the whole question, and in two of the four modes it is deliberately blank
 * apart from one clue — a countable picture answers "what does this clue say"
 * without reading the clue.
 */

interface LensSetup {
  mode?: LensMode;
  modes?: string[];
  practice?: boolean;
  size?: 3 | 4;
  sizes?: (3 | 4)[];
  palette?: Color[];
  anchors?: ("corner" | "edge" | "center")[];
  minSame?: number;
  maxSame?: number;
  questionsPerRound?: number;
}

export interface LensParams extends LensSetup {
  question?: LensSetup;
  play?: unknown;
}

/* `Lens.expected` is always a string; `RoundQuestion` makes it optional. The
   stricter one wins, so a caller never has to null-check an answer key. */
export interface LensQuestion extends Omit<RoundQuestion, "expected">, Lens {}

const DEFAULTS = { size: 3 as const, questionsPerRound: 5 };

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const promptText = (lens: Lens): string => {
  const n = lens.neighborhood.length;
  switch (lens.mode) {
    case "select_neighbors":
      /* Deliberately does not say how many. The count is what the child is
         working out, and a prompt that states it turns the level into
         "tap until the number matches". It is rung three of the hint ladder
         instead, where a child who is stuck can ask for it. */
      return "Tap every tile that touches the outlined one.";
    case "count_same":
      return "How many tiles touching the outlined one are the same colour as it?";
    case "read_clue":
      return "What does this clue say?";
    case "complement": {
      const clue = lens.clue!;
      const named = PALETTE[clue.color].name.toLowerCase();
      const other = PALETTE[lens.otherColor!].name.toLowerCase();
      return `This clue touches ${n} tiles and says ${clue.count} are ${named}. How many are ${other}?`;
    }
  }
};

export function buildQuestion(params: LensParams, index: number, seen?: Set<string>): LensQuestion {
  const setup: LensSetup = { ...params, ...params.question };
  /* `modeAt` counts from one, as a round does; `buildQuestion` counts from
     zero. Passing the raw index asked for `modes[-1]` on the very first
     question of every practice round — undefined, and a throw. Invisible until
     a lesson actually set `modes`, which no teaching lesson does. */
  const mode = modeAt(setup, index + 1, setup.mode ?? "select_neighbors") as LensMode;
  if (!LENS_MODES.includes(mode)) throw new Error(`NeighborLens has no "${mode}" mode`);
  /* The index seeds the draw, so a round is reproducible and question three is
     question three again on a replay of the same lesson. */
  const lens = generateLens(
    {
      mode,
      size: setup.size ?? DEFAULTS.size,
      sizes: setup.sizes,
      palette: setup.palette,
      anchors: setup.anchors,
      minSame: setup.minSame,
      maxSame: setup.maxSame,
    },
    index * 1009 + 17,
    { seen },
  );
  return {
    ...lens,
    taskKind: `sweeper_${mode}`,
    prompt: promptText(lens),
    expected: lens.expected,
    itemCount: lens.neighborhood.length,
  };
}

export const promptFor = (question: LensQuestion): string => question.prompt ?? promptText(question);

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

/** The board as paper needs it: the same picture, nothing to tap. */
export const figureFor = (question: LensQuestion): React.ReactNode => (
  <BoardGrid board={question.board} target={question.target} availableWidth={260} label="Board" />
);

export function printedFor(question: LensQuestion): PrintedQuestion | null {
  const where = tileLabel(question.board, question.target).replace(", the outlined tile", "");
  switch (question.mode) {
    case "select_neighbors":
      return {
        text: `Circle every tile that touches the outlined one (${where}). ____`,
        answer: `${question.neighborhood.length} tiles: ${question.neighborhood
          .map((cell) => tileLabel(question.board, cell))
          .join("; ")}`,
      };
    case "count_same":
      return {
        text: `How many tiles touching the outlined one (${where}) are the same colour as it? ____`,
        answer: String(question.expectedCount),
      };
    case "read_clue":
      return {
        text: `${where}. Write what this clue says. ____`,
        answer: question.expected,
      };
    case "complement":
      return {
        text: `${where}. It touches ${question.neighborhood.length} tiles and ${question.clue!.count} of them are ${PALETTE[question.clue!.color].name.toLowerCase()}. How many are ${PALETTE[question.otherColor!].name.toLowerCase()}? ____`,
        answer: String(question.expectedCount),
      };
  }
}

export function methodFor(): string[] | null {
  return [
    "A tile touches the tiles beside it, above it, below it, and the four corners.",
    "At an edge or a corner, only the tiles inside the board count.",
    "A clue never counts its own tile.",
  ];
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

export function lensHints(question: LensQuestion, kidTip: string | undefined, state: { chosen: number }): string[] {
  const n = question.neighborhood.length;
  switch (question.mode) {
    case "select_neighbors":
      return composeHints(
        kidTip,
        state.chosen === 0
          ? "Start with the tiles directly above, below, left and right."
          : `You have ${state.chosen} of them. The corner-touching tiles count too.`,
        `An outlined tile ${question.anchor === "center" ? "in the middle" : `at ${question.anchor === "corner" ? "a corner" : "an edge"}`} touches ${n} tiles — the ones off the board do not exist.`,
      );
    case "count_same":
      return composeHints(
        kidTip,
        "Look at the outlined tile's own colour first. Then check each tile around it.",
        "Each tile counts once, and the outlined one is left out.",
      );
    case "read_clue":
      return composeHints(
        kidTip,
        "A clue has two parts: which colour it counts, and how many.",
        `It counts the ${n} tiles it touches. Not itself, and all four corners count.`,
      );
    case "complement":
      return composeHints(
        kidTip,
        `The clue touches ${n} tiles altogether.`,
        `Some of those ${n} are ${PALETTE[question.clue!.color].name.toLowerCase()}. There are only two colours, so the rest are the other one.`,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const NeighborLens: React.FC<ActivityProps<LensParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: LensSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? DEFAULTS.questionsPerRound;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const badgesEnabled = koda.config.isEnabled("counting_badges", true);

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
  const question = round.question as LensQuestion;

  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (!question) return;
    setPicked([]);
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const finish = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled && correct) koda.haptics.success();
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  const toggle = (cell: number) => {
    if (round.feedback) return;
    if (cell === question.target) {
      /* Not a wrong answer. The child touched the tile the question is about,
         which is the commonest first move and is worth explaining rather than
         scoring. */
      nudge.refuse("That is the outlined tile itself. A tile never touches itself.");
      speak("That is the tile we are asking about.");
      return;
    }
    setPicked((current) => {
      const already = current.includes(cell);
      chime(koda, already ? "unchosen" : "chosen");
      return already ? current.filter((c) => c !== cell) : [...current, cell];
    });
  };

  const checkSelection = () => {
    if (round.feedback) return;
    if (!picked.length) {
      nudge.refuse("Choose the tiles that touch the outlined one first.");
      return;
    }
    const correct = selectionKey(picked, question.board.size) === question.expected;
    finish(
      correct,
      `${picked.length} tiles`,
      correct ? "Every one of them" : "Not quite that set",
      correct
        ? `All ${question.neighborhood.length} tiles that touch it, and nothing else.`
        : `It touches ${question.neighborhood.length} tiles — the four beside it and the four corners, minus any off the board.`,
    );
  };

  const answerCount = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.expectedCount;
    finish(
      correct,
      String(value),
      correct ? "That is the count" : "Count again",
      question.mode === "complement"
        ? `${question.neighborhood.length} tiles touch it and ${question.clue!.count} are ${PALETTE[question.clue!.color].name.toLowerCase()}, so ${question.expectedCount} are ${PALETTE[question.otherColor!].name.toLowerCase()}.`
        : `${question.expectedCount} of the ${question.neighborhood.length} tiles touching it match.`,
    );
  };

  const answerStatement = (id: string) => {
    if (round.feedback) return;
    const statement = question.statements!.find((s) => s.id === id)!;
    finish(
      statement.correct,
      statement.text,
      statement.correct ? "That is what it says" : "Read it once more",
      statement.correct
        ? "The colour it counts, and how many of the tiles it touches."
        : statement.trap === "counts-itself"
          ? "A clue never counts its own tile."
          : statement.trap === "skips-diagonals"
            ? "The corner-touching tiles count too."
            : "Check which colour the clue is counting.",
    );
  };

  const choiceButton =
    "min-h-11 min-w-11 rounded-2xl border-2 border-ink/20 bg-surface px-5 py-3 text-xl font-black tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Neighbours and Clues"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : lensHints(question, copy.kidTip, { chosen: picked.length })}
      iconName="grid-3x3"
      iconTone="purple"
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
          target={question.target}
          availableWidth={question.board.size === 4 ? 380 : 320}
          selected={question.mode === "select_neighbors" ? picked : []}
          onTap={question.mode === "select_neighbors" ? toggle : undefined}
          locked={Boolean(round.feedback)}
          showBadges={badgesEnabled}
          label={question.mode === "read_clue" || question.mode === "complement" ? "Board with one clue" : "Board"}
        />

        {question.mode === "select_neighbors" && (
          <button
            type="button"
            onClick={checkSelection}
            disabled={Boolean(round.feedback)}
            className="min-h-11 rounded-2xl border-2 border-violet-500 bg-violet-500/10 px-6 py-3 text-base font-black text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Check {picked.length ? `(${picked.length})` : ""}
          </button>
        )}

        {question.choices && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {question.choices.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => answerCount(value)}
                disabled={Boolean(round.feedback)}
                aria-label={String(value)}
                className={choiceButton}
              >
                {value}
              </button>
            ))}
          </div>
        )}

        {question.statements && (
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-2">
            {question.statements.map((statement) => (
              <button
                key={statement.id}
                type="button"
                onClick={() => answerStatement(statement.id)}
                disabled={Boolean(round.feedback)}
                aria-label={statement.text}
                className="min-h-11 rounded-2xl border-2 border-ink/20 bg-surface px-4 py-3 text-left text-base font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {statement.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </SkillRound>
  );
};
