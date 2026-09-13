import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { partWord } from "../internal/data/fractionNumbers";
import { FractionBar, FractionCircle } from "../internal/ui/FractionBar";
import {
  STRIP_REFUSALS,
  explainStrip,
  buildStripQuestion,
  nameOf,
  stripBlockedBecause,
  type StripBlock,
  type StripMode,
  type StripQuestion,
  type StripSetup,
} from "../internal/data/fractionStrip";

/**
 * The folding strip — where a fraction stops being two numbers.
 *
 * One finger action: shade a part, or unshade it. Everything the six techniques
 * differ by is what the child supplies:
 *
 *   equal_or_not   are these parts the same size? — before anything else
 *   name_unit      one part shaded; what is it called?
 *   which_whole    the same fraction of two different wholes
 *   build          shade three copies of one quarter — the level the skill rests on
 *   to_notation    read the picture as a/b
 *   of_a_set       a fraction of twelve marbles rather than of one bar
 *
 * Nothing is read aloud when a round opens: this skill starts at eight. The
 * speaker button is still there for a child who needs it.
 */

interface StripParams {
  question?: StripSetup;
  mode?: StripMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: StripParams, index: number, seen?: Set<string>): StripQuestion {
  const setup: StripSetup = { ...params, ...params.question };
  const mode = modeAt<StripMode>(setup, index + 1, "name_unit");
  return buildStripQuestion(setup, mode, index, seen);
}

export const promptFor = (question: StripQuestion): string => question.prompt;

export function stripHints(question: StripQuestion): string[] {
  const { parts } = question.fraction;
  switch (question.mode) {
    case "equal_or_not":
      return composeHints(
        "Look along the parts, not at how many there are.",
        "A fraction only works when every part is the same size.",
        "One pair that differ is enough to settle it. Look for a widest and a narrowest.",
      );
    case "name_unit":
      return composeHints(
        `Count the parts the whole is cut into. There are ${parts}.`,
        `One of ${parts} equal parts is called one ${partWord(parts)}.`,
        "The number of parts goes underneath. The number shaded goes on top.",
      );
    case "which_whole":
      return composeHints(
        "The same fraction is shaded on both. That is not the question.",
        "Look at how big the two wholes are to start with.",
        "The same fraction of a bigger whole is a bigger amount.",
      );
    case "build":
      return composeHints(
        `Each part is one ${partWord(parts)} of the whole.`,
        `Shade them one at a time and count as you go.`,
        "Stop when you have shaded as many as the question asked for.",
      );
    case "to_notation":
      return composeHints(
        "Count the shaded parts, then count all the parts.",
        "The shaded ones go on top; all of them go underneath.",
        "If you write it the other way up, you have said something bigger than the whole.",
      );
    default:
      return composeHints(
        `The set is split into ${parts} equal groups.`,
        "Work out how many are in one group first.",
        "Then take as many groups as the fraction asks for.",
      );
  }
}

/*
 * The strip and the circle come from `internal/ui`, not from here.
 *
 * The equivalence engine draws the same whole, and the claim it rests on — that
 * the same amount can wear two names — is only visible if both engines draw it
 * identically. Two renderers drift the first time one is nudged.
 */

export const FoldStrip: React.FC<ActivityProps<StripParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: StripSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
    /*
     * Nothing is read to the child when a round opens. This skill starts at
     * eight; reading the question aloud to a reader takes the reading out of it.
     * The speaker button is still there. See `voice.json`.
     */
    intro: undefined,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildQuestion(params, i - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as StripQuestion;

  const [shaded, setShaded] = useState<number[]>([]);
  const [refused, setRefused] = useState<StripBlock>(null);

  useEffect(() => {
    if (!question) return;
    // Only `build` starts blank; the rest show the picture they are about.
    setShaded(
      question.shadesIt
        ? []
        : Array.from({ length: question.mode === "equal_or_not" ? 0 : question.fraction.taken }, (_, i) => i),
    );
    setRefused(null);
  }, [question]);

  if (!question) return null;

  const { fraction } = question;
  const block = stripBlockedBecause(question, shaded.length);

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const toggle = (i: number): void => {
    if (!question.shadesIt || round.feedback) return;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
    setRefused(null);
    setShaded((current) => (current.includes(i) ? current.filter((n) => n !== i) : [...current, i]));
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? "Yes!" : "Not yet", message });
  };

  const answerYesNo = (said: boolean): void => {
    const correct = said === question.areEqual;
    submit(said ? "yes" : "no", correct, explainStrip(question, correct));
  };

  const answerName = (text: string): void => {
    const correct = text === question.expected;
    submit(text, correct, explainStrip(question, correct, text));
  };

  const answerCount = (value: number): void => {
    const correct = String(value) === question.expected;
    submit(String(value), correct, explainStrip(question, correct, String(value)));
  };

  const answerWhich = (side: "left" | "right"): void => {
    const correct = side === question.bigger;
    submit(side, correct, explainStrip(question, correct, side));
  };

  const confirmBuild = (): void => {
    if (block) {
      setRefused(block);
      say(STRIP_REFUSALS[block]);
      return;
    }
    submit(nameOf(fraction), true, explainStrip(question, true));
  };

  const drawWhole = (f: typeof fraction, marks: number[], scale = 1, onToggle?: (i: number) => void) =>
    f.whole.kind === "circle" ? (
      <FractionCircle parts={f.parts} shaded={marks} onToggle={onToggle} disabled={!!round.feedback} />
    ) : (
      <FractionBar
        parts={f.parts}
        shaded={marks}
        widths={question.unequal}
        scale={scale}
        onToggle={onToggle}
        disabled={!!round.feedback}
      />
    );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Equal Parts"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : stripHints(question)}
      iconName="PieChart"
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
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 text-ink">
        {question.mode === "of_a_set" ? (
          <div
            data-testid="set"
            aria-label={`${fraction.whole.size} things`}
            className="flex flex-wrap justify-center gap-2 rounded-2xl bg-surface p-3"
          >
            {Array.from({ length: fraction.whole.size ?? 12 }, (_, i) => (
              <span key={i} className="h-6 w-6 rounded-full bg-sky-400" />
            ))}
          </div>
        ) : question.mode === "which_whole" ? (
          <div className="flex flex-col items-center gap-3" data-testid="two-wholes">
            {drawWhole(fraction, Array.from({ length: fraction.taken }, (_, i) => i), 1)}
            {drawWhole(fraction, Array.from({ length: fraction.taken }, (_, i) => i), 0.5)}
          </div>
        ) : (
          <div data-testid="whole" className="flex flex-col items-center gap-1">
            {drawWhole(fraction, shaded, 1, question.shadesIt ? toggle : undefined)}
            {labelsEnabled && !practising && question.mode !== "equal_or_not" ? (
              <span className="text-xs text-muted">
                each part is 1/{fraction.parts} of {fraction.whole.name}
              </span>
            ) : null}
          </div>
        )}

        {refused ? (
          <p role="status" className="text-center text-sm text-muted">
            {STRIP_REFUSALS[refused]}
          </p>
        ) : null}

        {question.mode === "equal_or_not" ? (
          <div className="flex gap-3">
            {(["yes", "no"] as const).map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => answerYesNo(word === "yes")}
                disabled={!!round.feedback}
                className="min-h-11 min-w-24 rounded-2xl bg-surface px-6 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {word === "yes" ? "Yes" : "No"}
              </button>
            ))}
          </div>
        ) : null}

        {question.mode === "which_whole" ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => answerWhich("left")}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-5 py-3 text-base font-bold text-ink shadow-sm"
            >
              The long one
            </button>
            <button
              type="button"
              onClick={() => answerWhich("right")}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-5 py-3 text-base font-bold text-ink shadow-sm"
            >
              The short one
            </button>
          </div>
        ) : null}

        {question.options ? (
          <div className="flex flex-wrap justify-center gap-3">
            {question.options.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => answerName(text)}
                disabled={!!round.feedback}
                className="min-h-11 min-w-16 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {text}
              </button>
            ))}
          </div>
        ) : null}

        {question.choices ? (
          <div className="flex flex-wrap justify-center gap-3">
            {question.choices.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => answerCount(value)}
                disabled={!!round.feedback}
                className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm"
              >
                {value}
              </button>
            ))}
          </div>
        ) : null}

        {question.shadesIt ? (
          <>
            <p className="text-sm text-muted" data-testid="count">
              {shaded.length} shaded
            </p>
            <button
              type="button"
              onClick={confirmBuild}
              disabled={shaded.length === 0 || !!round.feedback}
              className="min-h-11 rounded-2xl bg-violet-600 px-6 py-2 text-base font-bold text-white shadow-sm disabled:opacity-40"
            >
              That is {question.target} of them
            </button>
          </>
        ) : null}
      </div>
    </SkillRound>
  );
};
