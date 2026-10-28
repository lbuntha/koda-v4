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
import { tf } from "../internal/i18n";
import { useT } from "../../../lib/i18n";
import { wholeName } from "../internal/data/fractionNumbers";

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
        tf("strip.hintEqual1"),
        tf("strip.hintEqual2"),
        tf("strip.hintEqual3"),
      );
    case "name_unit":
      return composeHints(
        tf("strip.hintName1", { parts }),
        tf("strip.hintName2", { parts, word: partWord(parts) }),
        tf("strip.hintName3"),
      );
    case "which_whole":
      return composeHints(
        tf("strip.hintWhich1"),
        tf("strip.hintWhich2"),
        tf("strip.hintWhich3"),
      );
    case "build":
      return composeHints(
        tf("strip.hintBuild1", { word: partWord(parts) }),
        tf("strip.hintBuild2"),
        tf("strip.hintBuild3"),
      );
    case "to_notation":
      return composeHints(
        tf("strip.hintNotation1"),
        tf("strip.hintNotation2"),
        tf("strip.hintNotation3"),
      );
    default:
      return composeHints(
        tf("strip.hintSet1", { parts }),
        tf("strip.hintSet2"),
        tf("strip.hintSet3"),
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
  useT();
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
    round.submit({ correct, given, expected: question.expected, title: correct ? tf("strip.yes") : tf("strip.notYet"), message });
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
      fallbackTitle={tf("strip.title")}
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
            aria-label={tf("strip.setLabel", { count: fraction.whole.size ?? 12 })}
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
                {tf("strip.eachPart", { parts: fraction.parts, whole: wholeName(fraction.whole) })}
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
                {word === "yes" ? tf("strip.yesWord") : tf("strip.noWord")}
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
              {tf("strip.longOne")}
            </button>
            <button
              type="button"
              onClick={() => answerWhich("right")}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-5 py-3 text-base font-bold text-ink shadow-sm"
            >
              {tf("strip.shortOne")}
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
              {tf("strip.shadedCount", { count: shaded.length })}
            </p>
            <button
              type="button"
              onClick={confirmBuild}
              disabled={shaded.length === 0 || !!round.feedback}
              className="min-h-11 rounded-2xl bg-violet-600 px-6 py-2 text-base font-bold text-white shadow-sm disabled:opacity-40"
            >
              {tf("strip.thatIs", { target: question.target })}
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
        text: tf("strip.printEqual"),
        answer: question.expected,
      };
    case "name_unit":
      return {
        text: tf("strip.printName"),
        answer: question.expected,
      };
    case "which_whole":
      return {
        text: tf("strip.printWhich"),
        answer: tf("strip.printWhichAnswer"),
      };
    case "build":
      return {
        text: tf("strip.printBuild", { target: question.target, parts: fraction.parts }),
        answer: tf("strip.printBuildAnswer", { target: question.target, parts: fraction.parts }),
      };
    case "of_a_set":
      return {
        text: tf("strip.printSet", { fraction: nameOf(fraction), size: fraction.whole.size ?? 12 }),
        answer: question.expected,
      };
    default:
      return { text: tf("strip.printNotation"), answer: question.expected };
  }
}

/** The apparatus, with whatever the child fills in left empty. */
export const figureFor = (question: StripQuestion): React.ReactNode | null => {
  const { fraction } = question;
  if (question.mode === "of_a_set") return printSet(fraction.whole.size ?? 12);
  if (question.mode === "which_whole") {
    return (
      <div className="flex flex-col gap-1">
        {printBar(fraction.parts, fraction.taken, { width: 220, label: tf("strip.longRibbon") })}
        {printBar(fraction.parts, fraction.taken, { width: 120, label: tf("strip.shortRibbon") })}
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
        tf("strip.methodEqual1"),
        tf("strip.methodEqual2"),
      ];
    case "which_whole":
      return [
        tf("strip.methodWhich1"),
        tf("strip.methodWhich2"),
      ];
    case "of_a_set":
      return [
        tf("strip.methodSet1"),
        tf("strip.methodSet2"),
      ];
    default:
      return [
        tf("strip.methodDefault1"),
        tf("strip.methodDefault2"),
      ];
  }
}
