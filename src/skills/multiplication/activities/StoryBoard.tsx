import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  composeHints,
  isPractice,
  modeAt,
  playCopy,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { quietWhenPractising } from "../../kit/practice";
import { themeSystem } from "../../../lib/themeSystem";
import {
  drawMultiplicationStory,
  productDistractors,
  shuffle,
  withoutRepeat,
  type StoryKind,
  type StoryStep,
} from "../internal/data/multiplicationNumbers";
import { castFor, count, type StoryCast } from "../internal/data/storyCast";
import { chime } from "../internal/data/multiplicationSound";
import { speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { SCROLL_BOX, TOUCH_TARGET } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";

/**
 * Multiplication in words, and the bar that shows what the words mean.
 *
 * Six shapes over one fixed cast: the total of equal groups, either factor
 * missing, a comparison, a rate, and a two-step problem. The bar model is what
 * turns a sentence into a structure — equal groups become equal segments, and
 * a comparison becomes two bars where one is a whole number of copies of the
 * other.
 *
 * §12 trap 14 is why the unknown moves around rather than the keyword changing:
 * "each", "times" and "altogether" do not decide the operation, the position of
 * the unknown does. And §12 trap 15 is why every comparison offers the additive
 * reading as a choice — "four times as many" misread as "four more" is the
 * whole content of level 53, and a round that never offers it never tests it.
 */

export type StoryMode = StoryKind;

interface StorySetup {
  mode?: StoryMode;
  modes?: string[];
  practice?: boolean;
  groupRange?: [number, number];
  sizeRange?: [number, number];
  smallerRange?: [number, number];
  multiplierRange?: [number, number];
  changeRange?: [number, number];
  questionsPerRound?: number;
}

export interface StoryParams extends StorySetup {
  question?: StorySetup;
  play?: unknown;
}

export interface StoryQuestion extends RoundQuestion {
  mode: StoryMode;
  values: number[];
  answer: number;
  intermediate?: number;
  steps?: StoryStep[];
  additiveAnswer?: number;
  cast: StoryCast;
  /** The bar model: how many segments, and what each is worth. */
  segments: number;
  segmentValue: number;
  /** `times_as_many`: the shorter bar, in segments of the same size. */
  compareTo?: number;
  choices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

/** The sentence, told about this cast with these numbers. */
export function sentenceFor(
  kind: StoryKind,
  values: number[],
  cast: StoryCast,
  steps?: StoryStep[],
): string {
  const { actor, other, container, item } = cast;
  switch (kind) {
    case "groups_unknown":
      return `${actor} has ${count(values[0], item)}, packed ${values[1]} to a ${container.one}. How many ${container.many} is that?`;
    case "size_unknown":
      return `${actor} shares ${count(values[0], item)} equally between ${count(values[1], container)}. How many ${item.many} in each one?`;
    case "times_as_many":
      return `${actor} has ${count(values[0], item)}. ${other} has ${values[1]} times as many. How many ${item.many} does ${other} have?`;
    case "rate":
      return `One ${container.one} holds ${count(values[0], item)}. How many ${item.many} are in ${count(values[1], container)}?`;
    case "multi_step": {
      const second = steps?.[1];
      const adds = second?.operation === "add";
      return `${actor} has ${count(values[0], container)} with ${values[1]} ${item.many} in each, then ${
        adds ? `finds ${values[2]} more` : `gives ${values[2]} away`
      }. How many ${item.many} now?`;
    }
    case "equal_groups_total":
    default:
      return `${actor} has ${count(values[0], container)} of ${item.many}, with ${values[1]} in each. How many ${item.many} altogether?`;
  }
}

/**
 * Four answers, each wrong one an answer this shape of story actually produces.
 *
 * The wrong answers cannot come from the numbers in the sentence blindly: in
 * "how many groups", the two stated numbers are a total and a group size, and
 * their product is nothing anyone would ever answer. So each shape names its
 * own mistakes — reaching for the other number in the sentence, stopping after
 * the first step, taking a comparison additively.
 *
 * §12 trap 15 rides on top of that: a child who reads "four times as many" as
 * "four more" has to be able to give that answer. A round that never offers it
 * has not tested the confusion the level exists to correct.
 */
function wrongAnswersFor(kind: StoryKind, values: number[], answer: number, drawn: {
  intermediate?: number;
  additiveAnswer?: number;
}): number[] {
  switch (kind) {
    case "groups_unknown":
    case "size_unknown":
      /* The commonest miss is answering with the other number the sentence
         gave — the size when asked for the count, and the other way round. */
      return [values[1], answer + 1, answer - 1, answer * 2, answer + 2];
    case "multi_step":
      return [
        // Stopping after the multiplication is the error of a two-step story.
        drawn.intermediate ?? 0,
        // And doing the second step the other way round.
        (drawn.intermediate ?? 0) * 2 - answer,
        answer + values[2],
        answer + 1,
      ];
    case "times_as_many":
      return [
        drawn.additiveAnswer ?? 0,
        ...productDistractors({ a: values[0], b: values[1], product: answer }, 3),
      ];
    case "equal_groups_total":
    case "rate":
    default:
      return productDistractors({ a: values[0], b: values[1], product: answer }, 3);
  }
}

function choicesFor(kind: StoryKind, values: number[], answer: number, drawn: {
  intermediate?: number;
  additiveAnswer?: number;
}): number[] {
  const seen = new Set<number>([answer]);
  const wrong: number[] = [];
  for (const candidate of wrongAnswersFor(kind, values, answer, drawn)) {
    if (wrong.length === 3) break;
    if (!Number.isInteger(candidate) || candidate <= 0 || seen.has(candidate)) continue;
    seen.add(candidate);
    wrong.push(candidate);
  }
  // A short list would mean a question with fewer than four options; widen
  // outward from the answer rather than ship one.
  for (let away = 2; wrong.length < 3; away += 1) {
    for (const candidate of [answer + away, answer - away]) {
      if (wrong.length === 3) break;
      if (candidate <= 0 || seen.has(candidate)) continue;
      seen.add(candidate);
      wrong.push(candidate);
    }
  }
  return shuffle([answer, ...wrong]);
}

export function buildQuestion(params: StoryParams, index: number, seen?: Set<string>): StoryQuestion {
  const setup: StorySetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "equal_groups_total");
  const spec = {
    groupRange: setup.groupRange,
    sizeRange: setup.sizeRange,
    smallerRange: setup.smallerRange,
    multiplierRange: setup.multiplierRange,
    changeRange: setup.changeRange,
  };

  const draw = () => drawMultiplicationStory(mode, spec);
  const drawn = seen ? withoutRepeat(draw, (v) => `${mode}-${v.values.join(".")}`, seen) : draw();
  const id = `story-${mode}-${index}-${drawn.values.join("x")}`;
  const cast = castFor(id);

  /* What the bar shows. For the two unknown-factor shapes the bar is drawn from
     what the child is told, so the missing number is a gap in the picture too. */
  const [segments, segmentValue, compareTo] = ((): [number, number, number | undefined] => {
    switch (mode) {
      case "groups_unknown":
        return [drawn.answer, drawn.values[1], undefined];
      case "size_unknown":
        return [drawn.values[1], drawn.answer, undefined];
      case "times_as_many":
        return [drawn.values[1], drawn.values[0], 1];
      case "rate":
        return [drawn.values[1], drawn.values[0], undefined];
      case "multi_step":
        return [drawn.values[0], drawn.values[1], undefined];
      case "equal_groups_total":
      default:
        return [drawn.values[0], drawn.values[1], undefined];
    }
  })();

  const base: Omit<StoryQuestion, "prompt" | "expected" | "taskKind"> = {
    id,
    mode,
    ...drawn,
    cast,
    segments,
    segmentValue,
    compareTo,
    choices: choicesFor(mode, drawn.values, drawn.answer, drawn),
    itemCount: drawn.answer,
  };

  return {
    ...base,
    taskKind: `story_${mode}`,
    prompt: sentenceFor(mode, drawn.values, cast, drawn.steps),
    expected: String(drawn.answer),
  };
}

export const promptFor = (question: StoryQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: StoryQuestion): PrintedQuestion | null {
  return { text: `${question.prompt} ____`, answer: String(question.answer) };
}

export function methodFor(question: StoryQuestion): string[] | null {
  const { values } = question;
  switch (question.mode) {
    case "groups_unknown":
      return [
        "The total and the size of each group are known.",
        `How many ${values[1]}s make ${values[0]}?`,
        "That is the number of groups.",
      ];
    case "size_unknown":
      return [
        "The total and the number of groups are known.",
        `Share ${values[0]} equally between ${values[1]}.`,
        "That is the size of each group.",
      ];
    case "times_as_many":
      return [
        // §12 trap 15, said plainly on paper too.
        `"${values[1]} times as many" means ${values[1]} lots of the first amount — not ${values[1]} more than it.`,
        `${values[0]} × ${values[1]}.`,
      ];
    case "rate":
      return [
        `Every one holds the same amount: ${values[0]}.`,
        `So ${values[1]} of them hold ${values[1]} lots of ${values[0]}.`,
      ];
    case "multi_step":
      return [
        `First the multiplication: ${values[0]} × ${values[1]} = ${question.intermediate}.`,
        `Then ${question.steps?.[1].operation === "add" ? "add" : "subtract"} ${values[2]}.`,
      ];
    case "equal_groups_total":
    default:
      return [
        `${values[0]} groups with ${values[1]} in each.`,
        "Multiply the number of groups by the size of a group.",
      ];
  }
}

/** A bar of equal segments, drawn empty for a pencil. */
export function figureFor(question: StoryQuestion): React.ReactNode | null {
  const segments = Math.min(question.segments, 12);
  const width = 280;
  const seg = width / segments;
  return (
    <svg viewBox={`0 0 ${width + 4} 40`} width="100%" role="img" aria-label="A bar split into equal parts">
      {Array.from({ length: segments }, (_, i) => (
        <rect
          key={i}
          x={2 + i * seg}
          y={8}
          width={seg - 3}
          height={24}
          rx="3"
          fill="none"
          stroke="#334155"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

export function storyHints(question: StoryQuestion, kidTip: string | undefined): string[] {
  const { values, cast } = question;
  switch (question.mode) {
    case "groups_unknown":
      return composeHints(
        kidTip,
        `Every ${cast.container.one} holds the same: ${values[1]}.`,
        `Count up in ${values[1]}s until you reach ${values[0]}, and count how many that took.`,
      );
    case "size_unknown":
      return composeHints(
        kidTip,
        `${values[0]} split into ${values[1]} equal parts.`,
        `What number, ${values[1]} times over, makes ${values[0]}?`,
      );
    case "times_as_many":
      return composeHints(
        kidTip,
        `Look at the two bars. The second is ${values[1]} whole copies of the first.`,
        // Names the trap without naming the answer.
        `"Times as many" is copies, not extra. ${values[1]} more would be a much shorter bar.`,
      );
    case "rate":
      return composeHints(
        kidTip,
        `The ${values[0]} is the same for every ${cast.container.one}.`,
        `So it is ${values[1]} lots of ${values[0]}.`,
      );
    case "multi_step":
      return composeHints(
        kidTip,
        "There are two steps. Do the multiplication first.",
        `${values[0]} × ${values[1]} first, then ${
          question.steps?.[1].operation === "add" ? "add" : "take away"
        } ${values[2]}.`,
      );
    case "equal_groups_total":
    default:
      return composeHints(
        kidTip,
        `${values[0]} equal groups, ${values[1]} in each.`,
        "Multiply the two numbers the sentence gives you.",
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const StoryBoard: React.FC<ActivityProps<StoryParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: StorySetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
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
  const question = round.question as StoryQuestion;

  /** `multi_step`: whether the first step has been worked out. */
  const [firstStep, setFirstStep] = useState(false);

  useEffect(() => {
    if (!question) return;
    setFirstStep(false);
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { mode, values, cast } = question;
  const twoStep = mode === "multi_step";
  const comparing = mode === "times_as_many";

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  const answer = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.answer;
    /* Reading "times as many" as "more than" gets its own words. It is the
       misunderstanding level 53 is named for, and "not quite" teaches nothing
       about it (§12 trap 15). */
    const readAdditively = !correct && comparing && value === question.additiveAnswer;
    judge(
      correct,
      String(value),
      correct ? "That is it" : readAdditively ? "Times, not more" : "Not quite",
      readAdditively
        ? `${values[1]} more than ${values[0]} would be ${question.additiveAnswer}. ${values[1]} times as many is ${values[1]} whole copies: ${question.answer}.`
        : twoStep
          ? `${values[0]} × ${values[1]} = ${question.intermediate}, then ${
            question.steps?.[1].operation === "add" ? "add" : "take away"
          } ${values[2]} to get ${question.answer}.`
          : `${question.answer}.`,
    );
  };

  const workFirstStep = () => {
    if (firstStep || round.feedback) return;
    setFirstStep(true);
    round.useSupport("walkthrough");
    chime(koda, "reached");
    speak(`${values[0]} times ${values[1]} is ${question.intermediate}.`);
  };

  /* ---- the bar model ---- */
  const bar = (segments: number, label: string, role: typeof GROUPS, unknown = false) => (
    <div className="flex items-center gap-2">
      <div className={`flex gap-0.5`} role="img" aria-label={label}>
        {Array.from({ length: Math.min(segments, 12) }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`flex h-9 min-w-8 items-center justify-center rounded border-2 text-xs font-black tabular-nums sm:h-10 sm:min-w-10 ${role.border} ${role.soft} ${role.text}`}
          >
            {unknown ? "?" : question.segmentValue}
          </span>
        ))}
      </div>
    </div>
  );

  const model = (() => {
    if (comparing) {
      return (
        <div className={SCROLL_BOX}>
          <div className="mx-auto flex w-fit flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-14 text-right text-xs font-bold ${NEUTRAL.text}`}>{cast.actor}</span>
              {bar(1, `${cast.actor} has one bar of ${values[0]}`, GROUPS)}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-14 text-right text-xs font-bold ${NEUTRAL.text}`}>{cast.other}</span>
              {bar(values[1], `${cast.other} has ${values[1]} bars of ${values[0]}`, EACH)}
            </div>
          </div>
        </div>
      );
    }
    const unknown = mode === "size_unknown";
    return (
      <div className={SCROLL_BOX}>
        <div className="mx-auto w-fit">
          {bar(
            question.segments,
            unknown
              ? `A bar of ${question.segments} equal parts, each unknown`
              : `A bar of ${question.segments} parts of ${question.segmentValue}`,
            GROUPS,
            unknown,
          )}
        </div>
      </div>
    );
  })();

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Story Problems"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : storyHints(question, copy.kidTip)}
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
        {scaffold && model}

        {twoStep && (
          firstStep ? (
            <p className={`text-base font-black tabular-nums ${PRODUCT.text}`} aria-live="polite">
              {values[0]} × {values[1]} = {question.intermediate}
            </p>
          ) : (
            <button
              type="button"
              onClick={workFirstStep}
              disabled={!!round.feedback}
              aria-label={`Work out ${values[0]} times ${values[1]} first`}
              className={themeSystem.button("secondary", "md")}
            >
              Do the first step
            </button>
          )
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {question.choices.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value}`}
              onClick={() => answer(value)}
              disabled={!!round.feedback}
              className={themeSystem.button("secondary", "choice")}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
