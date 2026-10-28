import React, { useCallback, useEffect, useMemo } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { quietWhenPractising } from "../../kit/practice";
import type { Color } from "../internal/board";
import { BoardGrid } from "../internal/BoardGrid";
import type { BoardMode } from "../internal/puzzles";
import { clueName, forces, generateLab, LAB_MODES, type Lab, type LabMode } from "../internal/reasons";
import { chime, speechRate, tagLabelsFrom } from "../internal/sweeperChrome";
import { useNudge } from "../internal/useNudge";
import { sweeperGuideMethod, useSweeperGuide } from "../internal/useSweeperGuide";
import { tw, whereLower } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
      return tw("lab.comparePrompt");
    case "choose_reason":
      return tw("lab.choosePrompt");
    case "find_error":
      return tw("lab.findPrompt");
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
    availableWidth={260} label={tw("grid.board")} />
);

export function printedFor(question: LabQuestion): PrintedQuestion | null {
  const spot = question.target === undefined ? "" : tw("lab.spot", { where: whereLower(question.board, question.target) });
  if (question.mode === "find_error") {
    return {
      text: tw("lab.printFind"),
      answer: tw("lab.printAny", { list: question.expected }),
    };
  }
  return {
    text: question.mode === "compare_clues"
      ? tw("lab.printCompare", { spot })
      : tw("lab.printWhy", { spot }),
    answer: question.expected,
  };
}

export function methodFor(): string[] | null {
  return [
    tw("lab.method1"),
    tw("lab.method2"),
    tw("lab.method3"),
  ];
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

export function labHints(question: LabQuestion, kidTip: string | undefined): string[] {
  switch (question.mode) {
    case "compare_clues":
      return composeHints(kidTip,
        tw("lab.hintCompare1"),
        // Never names the sufficient set — choosing it is the question.
        tw("lab.hintCompare2"));
    case "choose_reason":
      return composeHints(kidTip,
        tw("lab.hintChoose1"),
        tw("lab.hintChoose2"));
    case "find_error":
      return composeHints(kidTip,
        tw("lab.hintFind1"),
        tw("lab.hintFind2"));
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const ClueLab: React.FC<ActivityProps<LabParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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

  const hints = !question || practising ? [] : labHints(question, copy.kidTip);
  const guide = useSweeperGuide({
    params,
    koda,
    practising,
    questionId: question?.id ?? "loading",
    rungs: hints,
    round,
    /* Pointing at an option would reveal a proof answer, so this engine never does. */
    target: -1,
  });

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
        ? question.mode === "compare_clues" ? tw("lab.enoughTitle") : tw("lab.fairTitle")
        : question.mode === "compare_clues" ? tw("lab.notEnoughTitle") : tw("lab.notWhyTitle"),
      correct
        ? question.mode === "compare_clues"
          ? tw("lab.enoughMsg")
          : tw("lab.fairMsg")
        : option.trap === "not-enough"
          ? tw("lab.trapNotEnough")
          : option.trap === "unrelated"
            ? tw("lab.trapUnrelated")
            : option.trap === "counts-itself"
              ? tw("lab.trapSelf")
              : option.trap === "skips-diagonals"
                ? tw("lab.trapDiag")
                : tw("lab.trapColor"));
  };

  const answerClue = (cell: number) => {
    if (round.feedback) return;
    const clue = question.board.clues.find((c) => c.cell === cell);
    if (!clue) {
      /* Not a wrong answer: the child pointed at a tile, not at a clue. */
      nudge.refuse(tw("lab.noClueNudge"));
      guide.stumbled();
      speak(tw("lab.noClueSay"));
      return;
    }
    /* Every clue the painted board actually breaks is a right answer, not just
       the one nearest the mistake. */
    const correct = question.violated!.includes(clue.id);
    finish(correct, clueName(question.board, clue),
      correct ? tw("lab.brokenTitle") : tw("lab.holdsTitle"),
      correct
        ? tw("lab.brokenMsg")
        : tw("lab.holdsMsg", { count: String(clue.count) }));
  };

  const optionButton =
    "min-h-11 rounded-2xl border-2 border-ink/20 bg-surface px-4 py-3 text-left text-base font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tw("lab.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={sweeperGuideMethod(params)}
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
          label={question.mode === "find_error" ? tw("grid.coloured") : tw("grid.board")}
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
