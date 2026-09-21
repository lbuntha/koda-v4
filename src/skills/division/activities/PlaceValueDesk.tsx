import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import {
  SkillRound,
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
  buildPlaceQuestion,
  placeSplit,
  type PlaceMode,
  type PlaceQuestion,
  type PlaceSetup,
} from "../internal/data/divisionPlace";

/**
 * Division by place value — the year before the algorithm.
 *
 * The child divides one part at a time and the parts are added up for them. That
 * is deliberate: the technique being taught is *choosing the split*, and making
 * them also add 30 and 2 turns a place-value lesson into an addition lesson at
 * the exact moment they are trying to hold a new idea.
 *
 * Levels 29 and 30 are one screen apart and a year apart in difficulty. 96 ÷ 3
 * splits the way the digits read. 84 ÷ 6 does not, and watching the split refuse
 * to be 80 and 4 is the whole lesson.
 */

interface PlaceParams {
  question?: PlaceSetup;
  mode?: PlaceMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: PlaceParams, index: number, seen?: Set<string>): PlaceQuestion {
  const setup: PlaceSetup = { ...params, ...params.question };
  const mode = modeAt<PlaceMode>(setup, index + 1, "split_exact");
  return buildPlaceQuestion(setup, mode, index, seen);
}

export const promptFor = (question: PlaceQuestion): string => question.prompt;

/**
 * The ladder, opening with the lesson's own words.
 *
 * All fifty-six division lessons author a `kidTip` and, until this, not one
 * was read: these ladders took the question and nothing else. `openWith`
 * puts it back as rung one without costing the worked step — see the kit.
 */
export function placeHints(question: PlaceQuestion, kidTip?: string): string[] {
  return openWith(kidTip, placeHintsRungs(question));
}

function placeHintsRungs(question: PlaceQuestion): string[] {
  switch (question.mode) {
    case "tens_quotient":
      return composeHints(
        `${question.dividend} is ${question.dividend / 10} tens.`,
        `Share ${question.dividend / 10} tens between ${question.divisor}. How many tens each?`,
        "Then say how many that is altogether.",
      );
    case "scale_down":
      return composeHints(
        `Dividing by ${question.divisor} asks how many ${question.divisor}s are inside.`,
        "Every digit moves one place to the right for a ten, two for a hundred.",
        "The digits move a place right. The zero goes because nothing holds it.",
      );
    case "tens_into_tens":
      return composeHints(
        "Both numbers are a whole number of tens.",
        `${question.dividend / 10} tens divided by ${question.divisor / 10} tens is just ${question.dividend / 10} ÷ ${question.divisor / 10}.`,
        "The tens on each side cancel out.",
      );
    case "split_exact":
      return composeHints(
        `Split ${question.dividend} into its places: ${placeSplit(question.dividend).join(" + ")}.`,
        `Divide each part by ${question.divisor} on its own.`,
        "Add what you get. That is the answer.",
      );
    default:
      return composeHints(
        `Try splitting ${question.dividend} by its digits. Does each part divide by ${question.divisor}?`,
        `It does not — so take the biggest lot of ${question.divisor} tens that fits instead.`,
        `${question.parts.join(" and ")} both divide by ${question.divisor}. That is the split you want.`,
      );
  }
}

export const PlaceValueDesk: React.FC<ActivityProps<PlaceParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: PlaceSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const scaffoldEnabled = koda.config.isEnabled("inverse_scaffold", true);

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
  const question = round.question as PlaceQuestion;

  /** One typed quotient per part, and which slot the pad is filling. */
  const [entries, setEntries] = useState<string[]>([]);
  const [slot, setSlot] = useState(0);

  useEffect(() => {
    if (!question) return;
    setEntries(question.parts.map(() => ""));
    setSlot(0);
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
  const hints = practising ? [] : placeHints(question, copy.kidTip);
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* The next empty answer box, in the order the chart reads. */
    target: question ? entries.findIndex((e) => e === "") : -1,
    progress: 0,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  if (!question || entries.length !== question.parts.length) return null;

  const running = entries.reduce((sum, value) => sum + (value === "" ? 0 : Number(value)), 0);
  const complete = entries.every((value) => value !== "");

  const digit = (n: number): void => {
    setEntries((current) =>
      current.map((value, i) => (i === slot ? (value.length >= 4 ? value : value + String(n)) : value)),
    );
  };
  const backspace = (): void => {
    setEntries((current) => current.map((value, i) => (i === slot ? value.slice(0, -1) : value)));
  };

  const check = (): void => {
    const correct =
      running === question.quotient &&
      entries.every((value, i) => Number(value) === question.partQuotients[i]);
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: entries.join(" + "),
      expected: question.expected,
      title: correct ? "Yes!" : "Not yet",
      message: correct
        ? question.parts.length > 1
          ? `${question.parts.map((p, i) => `${p} ÷ ${question.divisor} = ${question.partQuotients[i]}`).join(", ")}. Together that is ${question.quotient}.`
          : `${question.dividend} ÷ ${question.divisor} = ${question.quotient}.`
        : running === question.quotient
          ? "The total is right, but one of the parts is not."
          : "Check each part on its own first.",
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Place by Place"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (entries.some((e) => e !== ""))
          ? () => {
              setEntries(question.parts.map(() => ""));
              setSlot(0);
            }
          : undefined
      }
      iconName="Columns3"
      iconTone="emerald"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {question.parts.length > 1 && scaffoldEnabled && !practising ? (
          <p className="text-center text-sm text-muted">
            {question.placeSplitWorks
              ? "Each place divides on its own."
              : `The digits do not split here. ${question.parts.join(" and ")} do.`}
          </p>
        ) : null}

        <div className="flex flex-col gap-2" data-testid="parts">
          {question.parts.map((part, i) => (
            <div key={part} className="flex items-center justify-center gap-2 text-lg text-ink">
              <span className="min-w-24 text-right font-semibold">
                {part} ÷ {question.divisor}
              </span>
              <span className="text-muted">=</span>
              <button
                type="button"
                onClick={() => setSlot(i)}
                aria-label={`Answer for ${part} divided by ${question.divisor}: ${
              entries[i] || "empty"
            }${guide.target === i ? ", fill this one next" : ""}`}
                className={`min-h-11 min-w-16 rounded-xl border-2 px-3 py-1 font-bold ${
                  slot === i ? "border-emerald-500 bg-surface" : "border-line/30 bg-surface"
                }`}
              >
                {entries[i] || " "}
              </button>
            </div>
          ))}
        </div>

        {question.parts.length > 1 ? (
          <p className="text-center text-base font-semibold text-ink" data-testid="running">
            Altogether: {complete ? running : "—"}
          </p>
        ) : null}

        <NumberPad
          onDigit={digit}
          onBackspace={backspace}
          onSubmit={check}
          disabled={!!round.feedback}
          canSubmit={complete}
        />
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: PlaceQuestion): { text: string; answer: string } | null {
  if (question.parts.length > 1) {
    return {
      text: `${question.dividend} ÷ ${question.divisor} = (${question.parts.join(" ÷ _ ) + ( ")} ÷ _ ) =`,
      answer: String(question.quotient),
    };
  }
  return { text: `${question.dividend} ÷ ${question.divisor} =`, answer: String(question.quotient) };
}

export function methodFor(question: PlaceQuestion): string[] {
  /*
   * Branch on the mode, not on the question.
   *
   * A sheet prints one method above all its questions, and this branched on
   * `parts.length` — which varies between draws of the same lesson, so one
   * sheet could describe two different techniques depending on which question
   * happened to be drawn first.
   */
  const splitting = question.mode === "split_exact" || question.mode === "split_exchange";
  return splitting
    ? [
        "Split the total into parts that each divide exactly.",
        "Divide each part on its own.",
        "Add the answers together.",
      ]
    : ["Read the total as a number of tens or hundreds.", "Divide those, then say what it is altogether."];
}
