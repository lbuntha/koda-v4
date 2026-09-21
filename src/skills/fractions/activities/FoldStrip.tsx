import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import { fractionGuideMethod, useFractionGuide } from "../internal/useFractionGuide";
import { partWord } from "../internal/data/fractionNumbers";
import { printBar, printCircle, printSet } from "../internal/ui/printFigures";
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

  /** How the strip looks before the child touches it. */
  const opening = useCallback(
    (q: StripQuestion): number[] =>
      q.shadesIt
        ? []
        : Array.from({ length: q.mode === "equal_or_not" ? 0 : q.fraction.taken }, (_, i) => i),
    [],
  );

  useEffect(() => {
    if (!question) return;
    // Only `build` starts blank; the rest show the picture they are about.
    setShaded(opening(question));
    setRefused(null);
  }, [question, opening]);

  const hints = !question || practising ? [] : stripHints(question);
  const guide = useFractionGuide({
    params, koda, practising, questionId: question?.id ?? "loading", rungs: hints, round,
    progress: question?.shadesIt ? shaded.length : 0,
    /*
     * The next part to shade: the lowest one not shaded yet.
     *
     * This was `Math.max(0, shaded.length)` — which is just `shaded.length`,
     * because a length is never negative, and which is a *count* used as an
     * *index*. It happened to name the right part while a child shaded left to
     * right, and pointed past the end of the strip on the last one. Nothing
     * drew it, so nothing ever showed.
     */
    target:
      question?.shadesIt
        ? Array.from({ length: question.fraction.parts }, (_, i) => i).find(
            (i) => !shaded.includes(i),
          ) ?? -1
        : -1,
  });

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
    guide.moved();
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
      guide.stumbled();
      say(STRIP_REFUSALS[block]);
      return;
    }
    submit(nameOf(fraction), true, explainStrip(question, true));
  };

  const drawWhole = (f: typeof fraction, marks: number[], scale = 1, onToggle?: (i: number) => void) => {
    /* Only the strip the child is actually shading carries the light — the
       ghosts and the "before" pictures beside it are not theirs to touch. */
    const lit = onToggle && guide.target >= 0 ? guide.target : undefined;
    return f.whole.kind === "circle" ? (
      <FractionCircle
        parts={f.parts}
        shaded={marks}
        onToggle={onToggle}
        disabled={!!round.feedback}
        lit={lit}
      />
    ) : (
      <FractionBar
        parts={f.parts}
        shaded={marks}
        widths={question.unequal}
        scale={scale}
        onToggle={onToggle}
        disabled={!!round.feedback}
        lit={lit}
      />
    );
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Equal Parts"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={fractionGuideMethod(params)}
      onStartOver={
        question.shadesIt && shaded.length > 0 && !round.feedback
          ? () => {
              setShaded(opening(question));
              setRefused(null);
            }
          : undefined
      }
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

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every one of these prints, and every one of them needs its picture.
 *
 * "Write the fraction for the shaded part" above nothing is not a question.
 * These are the levels where the figure *is* the question, so the printed text
 * is deliberately short and the drawing carries it.
 */
export function printedFor(question: StripQuestion): { text: string; answer: string } | null {
  const { fraction } = question;
  switch (question.mode) {
    case "equal_or_not":
      return {
        text: "Is this cut into equal parts? Write yes or no.",
        answer: question.expected,
      };
    case "name_unit":
      return {
        text: `One part of this is shaded. Write what that one part is called.`,
        answer: question.expected,
      };
    case "which_whole":
      return {
        text: "Both ribbons have half of them shaded. Which shaded half is bigger — the long ribbon or the short one?",
        answer: "the long ribbon",
      };
    case "build":
      return {
        text: `Shade ${question.target} of the ${fraction.parts} parts.`,
        answer: `${question.target} of ${fraction.parts}`,
      };
    case "of_a_set":
      return {
        text: `Circle ${nameOf(fraction)} of these ${fraction.whole.size ?? 12}. How many did you circle?`,
        answer: question.expected,
      };
    default:
      return { text: "Write the fraction for the shaded part.", answer: question.expected };
  }
}

/** The apparatus, with whatever the child fills in left empty. */
export const figureFor = (question: StripQuestion): React.ReactNode | null => {
  const { fraction } = question;
  if (question.mode === "of_a_set") return printSet(fraction.whole.size ?? 12);
  if (question.mode === "which_whole") {
    return (
      <div className="flex flex-col gap-1">
        {printBar(fraction.parts, fraction.taken, { width: 220, label: "the long ribbon" })}
        {printBar(fraction.parts, fraction.taken, { width: 120, label: "the short ribbon" })}
      </div>
    );
  }
  // `build` arrives blank: shading it in is the question.
  const shaded = question.shadesIt ? 0 : fraction.taken;
  if (fraction.whole.kind === "circle") return printCircle(fraction.parts, shaded);
  return printBar(fraction.parts, shaded, { widths: question.unequal });
};

export function methodFor(question: StripQuestion): string[] | null {
  switch (question.mode) {
    case "equal_or_not":
      return [
        "Equal parts means every piece is the same size as every other one.",
        "Cut into four pieces is not the same as cut into quarters.",
      ];
    case "which_whole":
      return [
        "A fraction is always a fraction of something.",
        "Half of a long ribbon is longer than half of a short one, even though both are halves.",
      ];
    case "of_a_set":
      return [
        "The bottom number says how many equal groups to make.",
        "The top number says how many of those groups to take.",
      ];
    default:
      return [
        "The bottom number says how many equal parts the whole is cut into.",
        "The top number says how many of those parts you have.",
      ];
  }
}
