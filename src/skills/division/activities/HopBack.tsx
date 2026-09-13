import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import {
  LINE_REFUSALS,
  buildLineQuestion,
  lineBlockedBecause,
  lineChoices,
  type LineBlock,
  type LineMode,
  type LineQuestion,
  type LineSetup,
} from "../internal/data/divisionLine";
import { TONE_CLASS } from "../internal/data/divisionTray";

/**
 * Division as repeated subtraction, walked along a line.
 *
 * This is the engine that makes `48 ÷ 6` a thing you *do* rather than a fact you
 * either have or have not got: start at 48, take 6 away, and keep taking 6 away
 * until there is nothing left. The number of times you could do it is the
 * answer, and a child who has done it once has a way back into every division
 * fact they have not learned yet.
 *
 * Every question here is a grouping question, enforced by the type of
 * `drawGroupQuotient`. See `divisionLine.ts` for why that matters.
 */

interface LineParams {
  question?: LineSetup;
  mode?: LineMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: LineParams, index: number, seen?: Set<string>): LineQuestion {
  const setup: LineSetup = { ...params, ...params.question };
  const mode = modeAt<LineMode>(setup, index + 1, "back_to_zero");
  return buildLineQuestion(setup, mode, index, seen);
}

export const promptFor = (question: LineQuestion): string => question.prompt;

export function lineHints(question: LineQuestion): string[] {
  switch (question.mode) {
    case "back_to_zero":
      return composeHints(
        `Every hop takes away ${question.divisor}.`,
        "Keep hopping until the marker is sitting on 0. Do not stop part way.",
        "Now count the hops you made — not the numbers you landed on.",
      );
    case "count_hops":
      return composeHints(
        "Count the arrows, not the numbers under them.",
        "Where you finished is not the answer. How many jumps it took is.",
      );
    case "forward_to_total":
      return composeHints(
        `Count on in ${question.divisor}s: ${question.divisor}, ${question.divisor * 2}, ${question.divisor * 3}…`,
        "Stop when you land exactly on the total.",
        "The answer is how many times you counted on.",
      );
    default:
      return composeHints("Look at the line.");
  }
}

export const HopBack: React.FC<ActivityProps<LineParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: LineSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const badgesEnabled = koda.config.isEnabled("counting_badges", true);

  const seen = useMemo(() => new Set<string>(), []);
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
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as LineQuestion;

  /** Where the marker is, and every place it has landed. */
  const [position, setPosition] = useState(0);
  const [landings, setLandings] = useState<number[]>([]);
  const [refused, setRefused] = useState<LineBlock>(null);

  useEffect(() => {
    if (!question) return;
    setPosition(question.prefilled ? (question.direction === "back" ? 0 : question.dividend) : question.start);
    setLandings([]);
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const block = lineBlockedBecause(question, position);
  const step = question.direction === "back" ? -question.divisor : question.divisor;
  /** Every hop drawn: the child's own, or the whole run when it is prefilled. */
  const hops = question.prefilled ? question.quotient : landings.length;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const hop = (): void => {
    if (question.prefilled) return;
    const next = position + step;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setPosition(next);
    setLandings((l) => [...l, next]);
  };

  const undoHop = (): void => {
    if (question.prefilled || landings.length === 0) return;
    setRefused(null);
    setPosition(position - step);
    setLandings((l) => l.slice(0, -1));
  };

  const answerWith = (value: number): void => {
    if (block) {
      setRefused(block);
      say(LINE_REFUSALS[block]);
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
      title: correct ? "Yes!" : "Not yet",
      message: correct
        ? `${question.divisor} goes into ${question.dividend} exactly ${question.quotient} times.`
        : value === question.dividend || value === question.dividend - question.divisor
          ? "That is a number you landed on. The answer is how many hops it took."
          : "Count the hops once more.",
    });
  };

  const choices = useMemo(() => lineChoices(question), [question]);
  /** Ticks are every divisor, so a hop is always one tick. */
  const ticks = useMemo(
    () => Array.from({ length: question.quotient + 1 }, (_, i) => i * question.divisor),
    [question],
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Hop Back"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : lineHints(question)}
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
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        <div
          data-testid="line"
          aria-label={`Marker on ${position}, ${hops} hops made`}
          className="flex flex-col gap-2 rounded-2xl bg-surface p-3"
        >
          <div className="flex items-end justify-between gap-1 overflow-x-auto">
            {ticks.map((value) => {
              const landed = question.prefilled ? true : landings.includes(value) || value === question.start;
              const here = value === position;
              return (
                <div key={value} className="flex min-w-8 flex-col items-center gap-1">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      here ? TONE_CLASS[question.tone] : landed ? "bg-ink-soft/50" : "bg-ink-soft/15"
                    }`}
                  />
                  <span className={`text-xs ${here ? "font-bold text-ink" : "text-ink-soft"}`}>{value}</span>
                </div>
              );
            })}
          </div>
          {badgesEnabled ? (
            <p className="text-center text-xs text-ink-soft">
              {hops} hop{hops === 1 ? "" : "s"} of {question.divisor}
            </p>
          ) : null}
        </div>

        {question.prefilled ? null : (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={hop}
              disabled={!!round.feedback}
              aria-label={question.direction === "back" ? `Hop back ${question.divisor}` : `Hop on ${question.divisor}`}
              className="min-h-11 rounded-2xl bg-surface px-5 py-2 text-base font-semibold text-ink shadow-sm"
            >
              {question.direction === "back" ? `− ${question.divisor}` : `+ ${question.divisor}`}
            </button>
            <button
              type="button"
              onClick={undoHop}
              disabled={landings.length === 0 || !!round.feedback}
              aria-label="Undo the last hop"
              className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm text-ink-soft shadow-sm disabled:opacity-30"
            >
              ↩
            </button>
          </div>
        )}

        {refused ? (
          <p role="status" className="text-center text-sm text-ink-soft">
            {LINE_REFUSALS[refused]}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          {choices.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => answerWith(value)}
              disabled={!!round.feedback}
              className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
