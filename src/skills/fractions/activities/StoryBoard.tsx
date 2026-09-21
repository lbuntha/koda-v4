import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { printBar } from "../internal/ui/printFigures";
import {
  buildStoryQuestion,
  explainStory,
  isStoryCorrect,
  type StoryMode,
  type StoryQuestion,
  type StorySetup,
} from "../internal/data/fractionStory";

/**
 * Fractions in words, on a bar.
 *
 * The arithmetic is the easy part. What these six levels are for is deciding
 * what the words are asking, and the reliable way to get that wrong is to grab
 * the two numbers and guess an operation — which works often enough to feel
 * like a method.
 *
 * So the bar is cut before there is anything to answer. A child who has cut the
 * bar into three and shaded two of them has already made the decision the
 * question was really about; the number is what falls out of it.
 */

interface BoardParams {
  question?: StorySetup;
  mode?: StoryMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: BoardParams, index: number, seen?: Set<string>): StoryQuestion {
  const setup: StorySetup = { ...params, ...params.question };
  const mode = modeAt<StoryMode>(setup, index + 1, "of_amount");
  return buildStoryQuestion(setup, mode, index, seen);
}

export const promptFor = (question: StoryQuestion): string => question.story;

export function storyHints(question: StoryQuestion): string[] {
  switch (question.mode) {
    case "of_amount":
      return composeHints(
        "The bottom number says how many equal groups the whole amount makes.",
        "Cut the bar into that many, and work out how many are in one group.",
        "Then take as many groups as the top number asks for.",
      );
    case "share_leftover":
      return composeHints(
        "Give everybody a whole one first, and see what is left over.",
        "The leftover does not stay left over — it gets cut up and shared too.",
        "So each person gets some whole ones and a fraction of one more.",
      );
    case "add_context":
      return composeHints(
        "Two amounts of the same bottle, so they can be added — once they match.",
        "Cut both into the same-sized pieces first.",
        "Then count the pieces that are gone.",
      );
    case "scale":
      return composeHints(
        "Both bits of the amount get multiplied: the whole cups and the part cups.",
        "Do the whole cups first, then the parts.",
        "If the parts make more than a whole cup, that cup joins the others.",
      );
    case "compare_context":
      return composeHints(
        "This asks how many times as much, which is a dividing question.",
        "Ask how many of the smaller amount fit inside the bigger one.",
        "Taking one away from the other answers a different question — how much more.",
      );
    default:
      return composeHints(
        "There are two things happening here, one after the other.",
        "Work out the fraction step first and write down what is left.",
        "Then do the second step to that answer, not to the number you started with.",
      );
  }
}

export const StoryBoard: React.FC<ActivityProps<BoardParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: StorySetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as StoryQuestion;

  /** How many pieces the child has cut the bar into, for this question. */
  const [cutFor, setCutFor] = useState<{ id: string; parts: number } | null>(null);

  useEffect(() => {
    if (!question) return;
    setCutFor(null);
  }, [question]);

  const hints = !question || practising ? [] : storyHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
    progress: cutFor ? 1 : 0,
  });

  if (!question) return null;

  const cut = cutFor?.id === question.id ? cutFor.parts : 1;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const answer = (text: string): void => {
    const correct = isStoryCorrect(question, text);
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
      message: explainStory(question, correct),
    });
  };

  /** The bar, cut into however many pieces the child has asked for. */
  const bar = (): React.ReactNode => (
    <div className="flex w-full max-w-sm flex-col gap-1" data-testid="bar">
      <div
        role="img"
        aria-label={`A bar in ${cut} ${cut === 1 ? "piece" : "pieces"}`}
        className="flex h-8 w-full overflow-hidden rounded-xl border-2 border-line"
      >
        {Array.from({ length: cut }).map((_, i) => (
          <span
            key={i}
            className={`h-full flex-1 border-r border-line last:border-r-0 ${
              cut > 1 && i < question.shaded ? "bg-violet-400" : "bg-surface-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted">
        {cut === 1
          ? `the whole thing — ${question.whole} ${question.unit}`
          : `${cut} equal parts of ${question.whole} ${question.unit}`}
      </p>
    </div>
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="In Words"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
      onStartOver={
        cut > 1 && !round.feedback
          ? () => {
              setCutFor(null);
            }
          : undefined
      }
      iconName="BookOpen"
      iconTone="purple"
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
        {/* Left-ruled, so a paragraph of words is not mistaken for a button.
            Division's story level shipped with this looking tappable. */}
        <p className="w-full border-l-4 border-violet-300 px-3 py-1 text-left text-base leading-snug text-ink">
          {question.story}
        </p>

        {bar()}

        <div className="flex flex-wrap justify-center gap-2" data-testid="cutters">
          {[2, 3, 4, 5, 6, 8].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
                setCutFor({ id: question.id, parts: n });
                guide.moved();
              }}
              disabled={!!round.feedback}
              aria-pressed={cut === n}
              className={`min-h-11 min-w-11 rounded-2xl px-3 py-2 text-sm font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                cut === n ? "bg-violet-500 text-white" : "bg-surface text-ink"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {labelsEnabled && !practising ? (
          <p className="text-xs text-muted">cut the bar to match the story, then answer</p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3" data-testid="answers">
          {question.options.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => answer(text)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-16 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/** Word problems print as themselves. The bar is offered blank to model on. */
export function printedFor(question: StoryQuestion): { text: string; answer: string } | null {
  return { text: question.story, answer: question.expected };
}

/** An empty bar, ruled into nothing: the cutting is the child's decision. */
export const figureFor = (question: StoryQuestion): React.ReactNode | null =>
  printBar(1, 0, { width: 220, label: "an empty bar to model the story on" });

export function methodFor(question: StoryQuestion): string[] | null {
  switch (question.mode) {
    case "share_leftover":
      return [
        "Give everybody a whole one first.",
        "Then cut what is left between them — the leftover does not stay left over.",
      ];
    case "compare_context":
      return [
        "How many times as much is a dividing question.",
        "How much more is a taking-away question. Read which one is being asked.",
      ];
    case "multi_step":
      return [
        "Do the fraction step first and write the middle number down.",
        "Then do the second step to that number.",
      ];
    default:
      return [
        "Draw the bar as the whole amount, then cut it as the fraction says.",
        "Work out one part before taking several.",
      ];
  }
}
