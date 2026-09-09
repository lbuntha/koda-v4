import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { quietWhenPractising } from "../../kit/practice";
import type { Assignment, Board, Color } from "../internal/board";
import { isSolution } from "../internal/validation";
import { deduce } from "../internal/deduction";
import { BoardGrid, tileLabel } from "../internal/BoardGrid";
import { PALETTE } from "../internal/palette";
import { BOARD_MODES, generatePuzzle, type BoardMode, type PatternKind } from "../internal/puzzles";
import { chime, speechRate, tagLabelsFrom } from "../internal/sweeperChrome";
import { useNudge } from "../internal/useNudge";

/**
 * Painting a board, with a reason for every tile.
 *
 * One interaction — choose a colour, touch a blank tile — across every
 * technique this skill teaches. What changes between levels is the board the
 * generator was asked for, never the controls, which is what lets levels 9
 * onward ship as JSON.
 *
 * Two rules the round depends on. A completed board is **one** answer, so
 * painting a tile scores nothing and cannot be got wrong; and pressing Check
 * before every tile is decided is a refusal, not a wrong answer, because a
 * child who has not finished has not answered.
 *
 * The hidden solution never reaches this component. Grading asks
 * `isSolution`, which recounts the clues from the visible board, and hints ask
 * `deduce` about the board as it stands now.
 */

type Brush = Color | "erase";

interface SweeperSetup {
  mode?: BoardMode;
  modes?: string[];
  practice?: boolean;
  size?: 3 | 4;
  palette?: Color[];
  anchor?: "corner" | "edge" | "center";
  /**
   * Positions to cycle the clue through, one per question.
   *
   * The zero and full generators build 3x3 boards only, so a lesson pinned to
   * one anchor has just a handful of distinct puzzles and a three-question
   * round starts repeating. Moving the clue keeps the technique identical and
   * the board new, which is the variety that matters.
   */
  anchors?: ("corner" | "edge" | "center")[];
  remainingCase?: "met" | "one" | "all";
  patternKind?: string;
  patterns?: string[];
  /**
   * Ask what the clues settle, rather than for a finished board.
   *
   * Two clues that overlap often decide some tiles and leave others genuinely
   * open. A lesson that demanded a complete board there would be asking a
   * child to guess the rest, and teaching that guessing is how you finish.
   * With this on, the answer is the tiles the reduction settles and the rest
   * must stay blank — "we need another clue" is the correct move, not a
   * failure to finish.
   */
  partial?: "reduction" | "decidable";
  questionsPerRound?: number;
}

export interface SweeperParams extends SweeperSetup {
  question?: SweeperSetup;
  play?: unknown;
}

export interface SweeperQuestion extends Omit<RoundQuestion, "expected"> {
  mode: BoardMode;
  board: Board;
  /** Canonical answer key. The solution itself is deliberately not carried. */
  expected: string;
  /** Blank tiles, in reading order. */
  blanks: readonly number[];
  /**
   * The tiles this question asks for. Every blank, or — in a partial
   * question — only the ones the reduction settles.
   */
  asked: readonly number[];
  partial: boolean;
}

const DEFAULTS = { questionsPerRound: 3 };

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const promptText = (board: Board, partial: boolean): string => {
  const names = board.palette.map((c) => PALETTE[c].name.toLowerCase()).join(" and ");
  return partial
    ? `Colour only the tiles these clues can settle, and leave the rest blank. Use ${names}.`
    : `Colour every blank tile so all the clues are true. Use ${names}.`;
};

export function buildQuestion(params: SweeperParams, index: number, seen?: Set<string>): SweeperQuestion {
  const setup: SweeperSetup = { ...params, ...params.question };
  /* `modeAt` counts from one, as a round does; `buildQuestion` counts from
     zero. Passing the raw index asked for `modes[-1]` on the very first
     question of every practice round — undefined, and a throw. Invisible until
     a lesson actually set `modes`, which no teaching lesson does. */
  const mode = modeAt(setup, index + 1, setup.mode ?? "zero") as BoardMode;
  if (!BOARD_MODES.includes(mode)) throw new Error(`SweeperBoard has no "${mode}" mode`);
  /*
   * Options only reach the modes that accept them.
   *
   * A practice round cycles several techniques under one set of lesson
   * parameters, and the generator refuses an option a technique has no use
   * for — an anchor on a chain board, a wall pattern on an overlap board. The
   * lesson says "cycle these modes, and use these anchors where anchors
   * apply"; sorting out where they apply is this engine's job, not the lesson
   * author's, and getting it wrong throws mid-round rather than at build time.
   */
  const anchored = ["zero", "full", "remaining"].includes(mode);
  const anchor = !anchored ? undefined
    : setup.anchors?.length ? setup.anchors[index % setup.anchors.length] : setup.anchor;
  const patternKind = mode !== "pattern" ? undefined : (setup.patterns?.length
    ? setup.patterns[index % setup.patterns.length]
    : setup.patternKind) as PatternKind | undefined;
  const puzzle = generatePuzzle(
    { mode, size: mode === "mixed" ? undefined : setup.size, palette: setup.palette, anchor,
      remainingCase: mode === "remaining" ? setup.remainingCase : undefined, patternKind },
    index * 1009 + 17,
    /* A mixed board is drawn at random and kept only if it certifies, so it
       needs a wider search than a board built from a fixed template. */
    { seen, maxAttempts: mode === "mixed" ? 64 : undefined },
  );
  const blanks = puzzle.board.givens.flatMap((c, i) => (c === null ? [i] : []));
  /*
   * What the question asks for, read off the proof rather than the answer.
   *
   * `reduction` is a lesson's choice: level 13 narrows a board that *could* be
   * finished down to what one comparison settles, because that is its point.
   *
   * Everything else follows the board. If the rules cannot settle every tile —
   * levels 17 and 24, where some tiles genuinely have no answer yet — the
   * question asks for the ones they can and requires the rest to stay blank.
   * Deciding this per board rather than per lesson is what lets a practice
   * round mix a complement board with a region board: `Check` means the same
   * thing in both, "colour everything the clues decide".
   */
  const solved = deduce(puzzle.board);
  const undecided = blanks.filter((cell) => solved.domains[cell].length > 1);
  const asked = setup.partial === "reduction"
    ? (solved.steps.find((s) => s.rule.startsWith("overlap"))?.changes ?? [])
        .filter((c) => c.after.length === 1).map((c) => c.cell)
    : undecided.length
      ? blanks.filter((cell) => solved.domains[cell].length === 1)
      : blanks;
  const partial = asked.length !== blanks.length;
  if (setup.partial === "reduction" && (!asked.length || asked.length === blanks.length)) {
    throw new Error("A partial question needs a reduction that settles some tiles and not others");
  }
  if (!asked.length) throw new Error("This board decides nothing at all");
  return {
    id: puzzle.id,
    mode,
    board: puzzle.board,
    expected: asked.map((cell) => `${cell}:${puzzle.expected.split(",").find((p) => p.startsWith(`${cell}:`))!.split(":")[1]}`).join(","),
    blanks,
    asked,
    partial,
    taskKind: partial ? `sweeper_${mode}_partial` : `sweeper_${mode}`,
    prompt: promptText(puzzle.board, partial),
    itemCount: asked.length,
  };
}

export const promptFor = (question: SweeperQuestion): string => question.prompt ?? promptText(question.board, question.partial);

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export const figureFor = (question: SweeperQuestion): React.ReactNode => (
  <BoardGrid board={question.board} availableWidth={260} label="Board" />
);

export function printedFor(question: SweeperQuestion): PrintedQuestion | null {
  /* Read back off the answer key rather than a stored solution, so the printed
     sheet cannot be the one place a hidden answer escapes. */
  const answer = question.expected
    .split(",")
    .map((pair) => {
      const [cell, color] = pair.split(":");
      return `${tileLabel(question.board, Number(cell))} → ${PALETTE[color as Color].name}`;
    })
    .join("; ");
  return {
    text: `Colour every blank tile so all the clues are true. Each clue counts the tiles it touches, including corners, and never itself. ____`,
    answer,
  };
}

export function methodFor(): string[] | null {
  return [
    "Read each clue: which colour it counts, and how many.",
    "A clue that has all its matches already leaves nothing else that colour.",
    "A clue that needs as many as there are spaces left fills every one of them.",
  ];
}

/* -------------------------------------------------------------------------- */
/* Hints — read off the board as it stands, never off an answer                 */
/* -------------------------------------------------------------------------- */

const where = (board: Board, cell: number) => {
  const [row, col] = [Math.floor(cell / board.size) + 1, (cell % board.size) + 1];
  return `row ${row}, column ${col}`;
};

/** The next move the supported rules can justify, in words. */
export function nextStep(board: Board, assignment: Assignment): { name: string; worked: string } | null {
  const result = deduce(board, assignment);
  const step = result.steps[0];
  if (!step) return null;
  const [evidence] = step.evidence;
  const clue = board.clues.find((c) => c.id === evidence.clueId)!;
  const colour = PALETTE[step.color].name.toLowerCase();
  const name = `Look at the ${colour} ${clue.count} at ${where(board, clue.cell)}.`;
  const cells = step.changes.map((c) => where(board, c.cell)).join(" and ");
  const worked =
    step.rule === "zero"
      ? `It allows no ${colour} neighbours at all, so every blank tile it touches is the other colour.`
      : step.rule === "full"
        ? `It needs every tile it touches to be ${colour}, so ${cells} must be ${colour}.`
        : step.rule === "remaining-exclude"
          ? `Its ${clue.count} ${colour} tiles are already there, so nothing else it touches is ${colour} — ${cells}.`
          : step.rule === "remaining-fill"
            ? `It still needs ${evidence.remaining} more ${colour}, and only ${cells} can be. So they are.`
            : step.rule === "overlap-exclude"
              ? `Compare it with the other clue over the same tiles: the shared ones account for all of them, so ${cells} cannot be ${colour}.`
              : `Compare it with the other clue over the same tiles: what is left over must be ${colour} — ${cells}.`;
  return { name, worked };
}

export function sweeperHints(
  question: SweeperQuestion,
  kidTip: string | undefined,
  assignment: Assignment,
): string[] {
  const step = nextStep(question.board, assignment);
  return composeHints(
    kidTip,
    step ? step.name : "Every clue that can still say something has said it. Check what you have.",
    step ? step.worked : "Read each clue again and count the tiles it touches.",
  );
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const SweeperBoard: React.FC<ActivityProps<SweeperParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: SweeperSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as SweeperQuestion;

  /*
   * What has been painted, and which board it was painted on.
   *
   * The pair is the point. Holding the tiles alone let them outlive their
   * board for one render: a new question arrives, the effect that resets them
   * has not run yet, and the hint is computed from the previous puzzle's
   * colours against the new puzzle's clues. `deduce` validates strictly and
   * threw. Carrying the id makes a stale assignment unusable rather than
   * merely wrong — anything that does not belong to this board reads as a
   * board nobody has touched.
   */
  const [painted, setPainted] = useState<{ id: string; cells: Assignment }>(
    () => ({ id: question?.id ?? "", cells: question?.board.givens ?? [] }),
  );
  const [history, setHistory] = useState<Assignment[]>([]);
  const [brush, setBrush] = useState<Brush>(() => question?.board.palette[0] ?? "orange");

  useEffect(() => {
    if (!question) return;
    setHistory([]);
    setBrush(question.board.palette[0]);
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { board } = question;
  const assignment: Assignment = painted.id === question.id ? painted.cells : board.givens;
  const setAssignment = (cells: Assignment) => setPainted({ id: question.id, cells });
  const remaining = assignment.filter((c) => c === null).length;

  const paint = (cell: number) => {
    /*
     * Only blank tiles arrive here.
     *
     * `BoardGrid` renders a fixed tile as an image rather than a button in
     * paint mode, so a clue cannot be pressed at all — which is the plan's
     * rule and better than a button that exists to say no. This guard is the
     * belt to that braces; it does not explain itself to the child, because a
     * child cannot reach it.
     */
    if (round.feedback || board.givens[cell] !== null) return;
    const next = [...assignment];
    next[cell] = brush === "erase" ? null : brush;
    if (next[cell] === assignment[cell]) return;
    setHistory((h) => [...h, assignment]);
    setAssignment(next);
    chime(koda, brush === "erase" ? "unchosen" : "chosen");
  };

  const undo = () => {
    if (round.feedback || !history.length) return;
    setAssignment(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    chime(koda, "unchosen");
  };

  const check = () => {
    if (round.feedback) return;
    if (question.partial) {
      /* Right when the settled tiles are right and nothing else was guessed.
         Painting a tile the clues cannot decide is the mistake this lesson
         exists to name, so it is a wrong answer with an explanation — not a
         refusal, and not silently accepted. */
      const given = question.asked.map((cell) => `${cell}:${assignment[cell]}`).join(",");
      const guessed = question.blanks.filter((c) => !question.asked.includes(c) && assignment[c] !== null);
      const missing = question.asked.filter((c) => assignment[c] === null);
      if (missing.length) {
        nudge.refuse(`${missing.length} tile${missing.length === 1 ? "" : "s"} the clues do settle ${missing.length === 1 ? "is" : "are"} still blank.`);
        return;
      }
      const correct = given === question.expected && guessed.length === 0;
      chime(koda, correct ? "right" : "wrong");
      if (hapticsEnabled && correct) koda.haptics.success();
      round.submit({
        correct, given, expected: question.expected,
        title: correct ? "Exactly what they settle" : guessed.length ? "One of those was a guess" : "Not quite",
        message: correct
          ? "And you left the rest blank, because these clues cannot decide them yet."
          : guessed.length
            ? "These two clues cannot decide every tile. Where they cannot, the answer is to leave it blank and look for another clue."
            : "Compare what the two clues share against what only one of them touches.",
      });
      return;
    }
    if (remaining > 0) {
      /* Not a wrong answer: an unfinished board is not an answer at all, and
         scoring it would cost a child a star for not having finished. */
      nudge.refuse(`${remaining} tile${remaining === 1 ? "" : "s"} still to colour.`);
      return;
    }
    /* Recounts the clues from the visible board. Nothing here consults a
       stored solution. */
    const correct = isSolution(board, assignment);
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled && correct) koda.haptics.success();
    const broken = deduce(board, assignment).violatedClueIds;
    const clue = board.clues.find((c) => c.id === broken[0]);
    round.submit({
      correct,
      given: assignment.map((c, i) => (board.givens[i] === null ? `${i}:${c}` : null)).filter(Boolean).join(","),
      expected: question.expected,
      title: correct ? "Every clue is true" : "One clue is not true yet",
      message: correct
        ? "Each tile has a reason, and all the clues agree."
        : clue
          ? `Count around the ${PALETTE[clue.color].name.toLowerCase()} ${clue.count} at ${where(board, clue.cell)} and compare it with what it says.`
          : "Check each clue against the tiles it touches.",
    });
  };

  const brushButton = (value: Brush, label: string, symbol: string) => {
    const active = brush === value;
    const paintColor = value === "erase" ? undefined : PALETTE[value];
    return (
      <button
        key={value}
        type="button"
        aria-pressed={active}
        aria-label={label}
        onClick={() => setBrush(value)}
        disabled={Boolean(round.feedback)}
        className={`min-h-11 min-w-11 rounded-2xl border-2 px-4 py-2 text-base font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
          active ? "border-violet-500 ring-2 ring-violet-500" : "border-ink/20"
        }`}
        style={paintColor ? { background: paintColor.fill, color: paintColor.ink } : undefined}
      >
        <span aria-hidden>{symbol}</span> {label}
      </button>
    );
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Colour the Board"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : sweeperHints(question, copy.kidTip, assignment)}
      iconName="layers"
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
          board={board}
          mode="paint"
          assignment={assignment}
          onTap={paint}
          locked={Boolean(round.feedback)}
          availableWidth={board.size === 4 ? 380 : 320}
          label="Board to colour"
        />

        <div className="flex flex-wrap items-center justify-center gap-2">
          {board.palette.map((c) => brushButton(c, PALETTE[c].name, PALETTE[c].symbol))}
          {brushButton("erase", "Erase", "⌫")}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={Boolean(round.feedback) || !history.length}
            className="min-h-11 rounded-2xl border-2 border-ink/20 px-5 py-2 text-base font-bold text-ink disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={check}
            disabled={Boolean(round.feedback)}
            className="min-h-11 rounded-2xl border-2 border-violet-500 bg-violet-500/10 px-6 py-2 text-base font-black text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            Check {!question.partial && remaining ? `(${remaining} left)` : ""}
          </button>
        </div>
      </div>
    </SkillRound>
  );
};
