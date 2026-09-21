import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import {
  SkillRound,
  answerChoices,
  composeHints,
  guideSetup,
  isPractice,
  modeAt,
  openWith,
  playCopy,
  useGuide,
  useSkillRound,
} from "../../kit";
import { NumberPad } from "../internal/ui/NumberPad";
import {
  PAIR_REFUSALS,
  answerFor,
  buildRemainderQuestion,
  pairBlockedBecause,
  type PairBlock,
  type RemainderMode,
  type RemainderQuestion,
  type RemainderSetup,
} from "../internal/data/divisionRemainder";

/**
 * The remainder: written down, bounded, and read for what it means.
 *
 * Level 8 let a child *see* a leftover. This is where it gets a notation, a
 * rule, and — the part that decides whether any of it was worth doing — four
 * different right answers depending on what was asked.
 *
 * The `r < divisor` rule is a refusal, not a mark. A remainder that is too big
 * is an unfinished answer rather than a wrong one, and the difference is exactly
 * what level 23 has to get across.
 */

interface RemainderParams {
  question?: RemainderSetup;
  mode?: RemainderMode;
  questionsPerRound?: number;
}

export function buildQuestion(
  params: RemainderParams,
  index: number,
  seen?: Set<string>,
): RemainderQuestion {
  const setup: RemainderSetup = { ...params, ...params.question };
  const mode = modeAt<RemainderMode>(setup, index + 1, "record");
  return buildRemainderQuestion(setup, mode, index, seen);
}

export const promptFor = (question: RemainderQuestion): string => question.prompt;

/**
 * The ladder, opening with the lesson's own words.
 *
 * All fifty-six division lessons author a `kidTip` and, until this, not one
 * was read: these ladders took the question and nothing else. `openWith`
 * puts it back as rung one without costing the worked step — see the kit.
 */
export function remainderHints(question: RemainderQuestion, kidTip?: string): string[] {
  return openWith(kidTip, remainderHintsRungs(question));
}

function remainderHintsRungs(question: RemainderQuestion): string[] {
  switch (question.mode) {
    case "record":
      return composeHints(
        `How many whole ${question.divisor}s fit inside ${question.dividend}?`,
        "Take those away. What is left is the remainder.",
        `The remainder is always smaller than ${question.divisor}.`,
      );
    case "too_big":
      return composeHints(
        "Look at the leftover. Could another whole group still come out of it?",
        `If the leftover is ${question.divisor} or more, one more group fits.`,
        "Move the extra groups across, and the answer fixes itself.",
      );
    case "choose_form":
      return composeHints(
        "Work the division out first. Then read the question again.",
        "Does the question want the full ones, one more, what is left, or both?",
      );
    default:
      return composeHints(
        "Do the division. Then decide which part of it the question wants.",
        question.reading === "round-up"
          ? "Nobody can be left behind, so the leftover still needs one of its own."
          : question.reading === "the-remainder"
            ? "The question is about what did not fit."
            : "The question is about the ones that are complete.",
      );
  }
}

export const RemainderYard: React.FC<ActivityProps<RemainderParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: RemainderSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const notation = koda.config.get("remainderNotation", "r");

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
  const question = round.question as RemainderQuestion;

  /** The two halves of a typed answer, and which one the pad is filling. */
  const [quotient, setQuotient] = useState("");
  const [remainder, setRemainder] = useState("");
  const [slot, setSlot] = useState<"quotient" | "remainder">("quotient");
  const [refused, setRefused] = useState<PairBlock>(null);

  useEffect(() => {
    if (!question) return;
    setQuotient("");
    setRemainder("");
    setSlot("quotient");
    setRefused(null);
  }, [question]);

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const copy = playCopy(params);
  const hints = practising ? [] : remainderHints(question, copy.kidTip);
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* Two boxes, filled in order: how many whole groups, then what is left. */
    target: quotient === "" ? 0 : remainder === "" ? 1 : -1,
    progress: 0,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  if (!question) return null;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };
  const chime = (correct: boolean): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    chime(correct);
    round.submit({ correct, given, expected: question.expected, title: correct ? "Yes!" : "Not yet", message });
  };

  const digit = (n: number): void => {
    setRefused(null);
    if (slot === "quotient") setQuotient((v) => (v.length >= 3 ? v : v + String(n)));
    else setRemainder((v) => (v.length >= 2 ? v : v + String(n)));
  };
  const backspace = (): void => {
    setRefused(null);
    if (slot === "quotient") setQuotient((v) => v.slice(0, -1));
    else setRemainder((v) => v.slice(0, -1));
  };

  const submitPair = (): void => {
    const block = pairBlockedBecause(question, quotient, remainder);
    if (block) {
      guide.stumbled();
      setRefused(block);
      say(PAIR_REFUSALS[block]);
      return;
    }
    const correct = Number(quotient) === question.quotient && Number(remainder) === question.remainder;
    submit(
      `${quotient} ${notation} ${remainder}`,
      correct,
      correct
        ? `${question.quotient} whole ${question.divisor}s, and ${question.remainder} over.`
        : `Check how many whole ${question.divisor}s fit first.`,
    );
  };

  const answerWith = (value: number): void => {
    const wanted = answerFor(question, question.reading);
    const correct = value === wanted;
    submit(
      String(value),
      correct,
      correct
        ? "That is what the question asked for."
        : value === question.quotient && question.reading === "round-up"
          ? "That many would leave some behind. One more is needed."
          : "Read the question once more. Which part of the answer does it want?",
    );
  };

  const answerOption = (text: string): void => {
    const correct = text === question.expected;
    submit(text, correct, correct ? "That is the one the question wants." : "Which part of the answer was asked for?");
  };

  const choices = useMemo(
    () => answerChoices(answerFor(question, question.reading), question.id, { min: 0 }),
    [question],
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="What Is Left"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      iconName="Inbox"
      iconTone="pink"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              say(question.story ? `${question.story} ${promptFor(question)}` : promptFor(question));
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {question.story ? (
          <p className="border-l-4 border-rose-400/60 px-4 py-1 text-left text-base leading-relaxed text-ink">
            {question.story}
          </p>
        ) : null}

        {question.wrong ? (
          <p className="rounded-2xl bg-surface px-4 py-3 text-center text-lg text-ink">
            Somebody wrote:{" "}
            <span className="font-bold">
              {question.dividend} ÷ {question.divisor} = {question.wrong.quotient} {notation}{" "}
              {question.wrong.remainder}
            </span>
          </p>
        ) : null}

        {question.wantsPair ? (
          <>
            <div className="flex items-center justify-center gap-3 text-2xl font-bold text-ink">
              <button
                type="button"
                onClick={() => setSlot("quotient")}
                aria-label={`How many whole groups: ${quotient || "empty"}${
            guide.target === 0 ? ", fill this one next" : ""
          }`}
                className={`min-h-14 min-w-16 rounded-xl border-2 px-3 py-2 ${
                  slot === "quotient" ? "border-indigo-500 bg-surface" : "border-line/30 bg-surface"
                }`}
              >
                {quotient || " "}
              </button>
              <span className="text-base text-muted">{notation}</span>
              <button
                type="button"
                onClick={() => setSlot("remainder")}
                aria-label={`Left over: ${remainder || "empty"}${
            guide.target === 1 ? ", fill this one next" : ""
          }`}
                className={`min-h-14 min-w-16 rounded-xl border-2 px-3 py-2 ${
                  slot === "remainder" ? "border-rose-500 bg-surface" : "border-line/30 bg-surface"
                }`}
              >
                {remainder || " "}
              </button>
            </div>

            {refused ? (
              <p role="status" className="text-center text-sm text-muted">
                {PAIR_REFUSALS[refused]}
              </p>
            ) : null}

            <NumberPad
              onDigit={digit}
              onBackspace={backspace}
              onSubmit={submitPair}
              disabled={!!round.feedback}
              canSubmit={quotient !== "" && remainder !== ""}
            />
          </>
        ) : question.options ? (
          <div className="flex flex-col gap-2">
            {question.options.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => answerOption(text)}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                {text}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {choices.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => answerWith(value)}
                disabled={!!round.feedback}
                className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                {value}
              </button>
            ))}
          </div>
        )}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: RemainderQuestion): { text: string; answer: string } | null {
  if (question.story) {
    return {
      text: `${question.story} ${question.prompt}`,
      answer: question.expected,
    };
  }
  if (question.wrong) {
    return {
      text: `Somebody wrote ${question.dividend} ÷ ${question.divisor} = ${question.wrong.quotient} r ${question.wrong.remainder}. Write it properly.`,
      answer: question.expected,
    };
  }
  return { text: `${question.dividend} ÷ ${question.divisor} =`, answer: question.expected };
}

export function methodFor(): string[] {
  return [
    "Work out how many whole groups fit.",
    "What is left over is the remainder, and it is always smaller than the number you divided by.",
    "Read the question again to see which part of the answer it wants.",
  ];
}
