import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import {
  buildStoryQuestion,
  type StoryMode,
  type StoryQuestion,
  type StorySetup,
} from "../internal/data/divisionStory";

/**
 * Division in words, modelled before it is answered.
 *
 * The arithmetic here is easier than the written method's. The difficulty is
 * deciding what to divide by what, and a child who takes the two numbers in the
 * order they appear will be right about half the time — which looks like
 * understanding for as long as nobody checks.
 *
 * So on the modes where it is the point, the bar has to be *cut* before the
 * answer buttons do anything: the child sets how many parts the whole is shared
 * into, and setting it wrong is caught there rather than six seconds later at
 * the bottom of the screen.
 */

interface StoryParams {
  question?: StorySetup;
  mode?: StoryMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: StoryParams, index: number): StoryQuestion {
  const setup: StorySetup = { ...params, ...params.question };
  const mode = modeAt<StoryMode>(setup, index + 1, "size_unknown");
  return buildStoryQuestion(setup, mode, index);
}

export const promptFor = (question: StoryQuestion): string => question.prompt;

export function storyHints(question: StoryQuestion): string[] {
  switch (question.mode) {
    case "size_unknown":
      return composeHints(
        "The story tells you how many people are sharing.",
        "Cut the bar into that many equal parts.",
        "One of those parts is the answer.",
      );
    case "count_unknown":
      return composeHints(
        "The story tells you how big each bag is, not how many bags.",
        "Ask how many of that size fit into the total.",
      );
    case "remainder_context":
      return composeHints(
        "Divide first, and see what is left.",
        "Now read the question: does it want the full ones, or does everything have to fit?",
      );
    case "unit_rate":
      return composeHints(
        "Every box holds the same amount.",
        "Share the total between the boxes to find what one holds.",
      );
    case "times_comparison":
      return composeHints(
        "This is not asking how many more.",
        "It is asking how many of the smaller amount fit into the bigger one.",
        "Try it: how many lots of the small number make the big one?",
      );
    case "multi_step":
      return composeHints(
        "There are two things to do, and the order matters.",
        "Take away what is kept back first.",
        "Only then share out what is left.",
      );
    default:
      return composeHints(
        "Imagine the days were all the same.",
        "Add every day together, then share the total between the days.",
      );
  }
}

export const StoryBoard: React.FC<ActivityProps<StoryParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: StorySetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);

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
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1), [params]),
    onComplete,
  });
  const question = round.question as StoryQuestion;

  /** How many parts the child has cut the bar into. */
  const [cuts, setCuts] = useState(1);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    if (!question) return;
    setCuts(question.setsParts ? 1 : question.parts);
    setRefused(false);
  }, [question]);

  if (!question) return null;

  const modelled = !question.setsParts || cuts === question.parts;

  const setCut = (next: number): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
    setRefused(false);
    setCuts(Math.max(1, Math.min(12, next)));
  };

  const answerWith = (value: number): void => {
    if (!modelled) {
      setRefused(true);
      if (speechEnabled) {
        void koda.speech.say("Cut the bar into the right number of parts first.", {
          rate: koda.config.get("speechRate", 1),
        });
      }
      return;
    }
    const correct = value === question.answer;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: String(value),
      expected: question.expected,
      title: correct ? "Yes!" : "Not that one",
      message: correct
        ? "That is what the story asked for."
        : question.mode === "times_comparison" && value === question.whole - question.whole / question.parts
          ? "That is how many MORE. The question asks how many TIMES as many."
          : "Read the story once more, slowly.",
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="In Words"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : storyHints(question)}
      iconName="BookOpen"
      iconTone="purple"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              void koda.speech.say(`${question.story} ${promptFor(question)}`, {
                rate: koda.config.get("speechRate", 1),
              });
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <p className="border-l-4 border-violet-400/60 px-4 py-1 text-left text-base leading-relaxed text-ink">
          {question.story}
        </p>

        {question.values ? (
          <div className="flex items-end justify-center gap-2" data-testid="bars">
            {question.values.map((value, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className="w-8 rounded-t bg-violet-400"
                  style={{ height: `${(value / Math.max(...(question.values ?? [1]))) * 72 + 8}px` }}
                />
                <span className="text-xs text-ink-soft">{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2" data-testid="bar">
            <div className="flex gap-0.5 overflow-hidden rounded-xl">
              {Array.from({ length: cuts }, (_, i) => (
                <div
                  key={i}
                  className="flex h-12 flex-1 items-center justify-center bg-violet-400 text-xs font-semibold text-white"
                >
                  {cuts === question.parts && question.setsParts ? "?" : ""}
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-ink-soft">
              {question.whole} in {cuts} part{cuts === 1 ? "" : "s"}
            </p>
          </div>
        )}

        {question.setsParts ? (
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setCut(cuts - 1)}
              disabled={cuts <= 1 || !!round.feedback}
              aria-label="One part fewer"
              className="min-h-11 min-w-11 rounded-xl bg-surface text-lg text-ink shadow-sm disabled:opacity-30"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setCut(cuts + 1)}
              disabled={cuts >= 12 || !!round.feedback}
              aria-label="One part more"
              className="min-h-11 min-w-11 rounded-xl bg-surface text-lg text-ink shadow-sm disabled:opacity-30"
            >
              +
            </button>
          </div>
        ) : null}

        {refused ? (
          <p role="status" className="text-center text-sm text-ink-soft">
            Cut the bar into the right number of parts first.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          {question.choices.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => answerWith(value)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
