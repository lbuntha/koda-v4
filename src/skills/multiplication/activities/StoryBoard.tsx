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
  guideSetup,
  useGuide,
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
import { EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { SCROLL_BOX } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
      return tm("story.groupsUnknown", { actor, items: count(values[0], item), size: values[1], container: container.one, containers: container.many });
    case "size_unknown":
      return tm("story.sizeUnknown", { actor, items: count(values[0], item), containers: count(values[1], container), many: item.many });
    case "times_as_many":
      return tm("story.timesAsMany", { actor, items: count(values[0], item), other, times: values[1], many: item.many });
    case "rate":
      return tm("story.rate", { container: container.one, items: count(values[0], item), many: item.many, containers: count(values[1], container) });
    case "multi_step": {
      const second = steps?.[1];
      const adds = second?.operation === "add";
      return tm(adds ? "story.multiAdd" : "story.multiSubtract", { actor, containers: count(values[0], container), size: values[1], many: item.many, extra: values[2] });
    }
    case "equal_groups_total":
    default:
      return tm("story.equalTotal", { actor, containers: count(values[0], container), many: item.many, size: values[1] });
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
        tm("story.methodGroups1"),
        tm("story.methodGroups2", { size: values[1], total: values[0] }),
        tm("story.methodGroups3"),
      ];
    case "size_unknown":
      return [
        tm("story.methodSize1"),
        tm("story.methodSize2", { total: values[0], groups: values[1] }),
        tm("story.methodSize3"),
      ];
    case "times_as_many":
      return [
        // §12 trap 15, said plainly on paper too.
        tm("story.methodTimes1", { times: values[1] }),
        tm("story.methodTimes2", { a: values[0], b: values[1] }),
      ];
    case "rate":
      return [
        tm("story.methodRate1", { a: values[0] }),
        tm("story.methodRate2", { a: values[0], b: values[1] }),
      ];
    case "multi_step":
      return [
        tm("story.methodMulti1", { a: values[0], b: values[1], mid: question.intermediate ?? 0 }),
        tm(question.steps?.[1].operation === "add" ? "story.methodMultiAdd" : "story.methodMultiSubtract", { c: values[2] }),
      ];
    case "equal_groups_total":
    default:
      return [
        tm("story.methodTotal1", { a: values[0], b: values[1] }),
        tm("story.methodTotal2"),
      ];
  }
}

/** A bar of equal segments, drawn empty for a pencil. */
export function figureFor(question: StoryQuestion): React.ReactNode | null {
  const segments = Math.min(question.segments, 12);
  const width = 280;
  const seg = width / segments;
  return (
    <svg viewBox={`0 0 ${width + 4} 40`} width="100%" role="img" aria-label={tm("story.figureLabel")}>
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
        tm("story.hintGroups1", { container: cast.container.one, size: values[1] }),
        tm("story.hintGroups2", { size: values[1], total: values[0] }),
      );
    case "size_unknown":
      return composeHints(
        kidTip,
        tm("story.hintSize1", { total: values[0], groups: values[1] }),
        tm("story.hintSize2", { groups: values[1], total: values[0] }),
      );
    case "times_as_many":
      return composeHints(
        kidTip,
        tm("story.hintTimes1", { times: values[1] }),
        // Names the trap without naming the answer.
        tm("story.hintTimes2", { times: values[1] }),
      );
    case "rate":
      return composeHints(
        kidTip,
        tm("story.hintRate1", { a: values[0], container: cast.container.one }),
        /* A rate is "so many each, this many times" — naming the *per* is what
           makes it a rate rather than a row of things, and the rows-and-columns
           story was being handed this same sentence. */
        tm("story.hintRate2", { a: values[0], container: cast.container.one, b: values[1] }),
      );
    case "multi_step":
      return composeHints(
        kidTip,
        tm("story.hintMulti1"),
        tm(question.steps?.[1].operation === "add" ? "story.hintMultiAdd" : "story.hintMultiSubtract", { a: values[0], b: values[1], c: values[2] }),
      );
    case "equal_groups_total":
    default:
      return composeHints(
        kidTip,
        tm("story.hintTotal1", { a: values[0], b: values[1] }),
        tm("story.hintTotal2"),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const StoryBoard: React.FC<ActivityProps<StoryParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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
      correct ? tm("story.thatIsIt") : readAdditively ? tm("story.timesNotMore") : tm("story.notQuite"),
      readAdditively
        ? tm("story.additive", { a: values[0], b: values[1], additive: question.additiveAnswer ?? 0, answer: question.answer })
        : twoStep
          ? tm(question.steps?.[1].operation === "add" ? "story.twoStepAdd" : "story.twoStepSubtract", { a: values[0], b: values[1], mid: question.intermediate ?? 0, c: values[2], answer: question.answer })
          : tm("story.answerOnly", { answer: question.answer }),
    );
  };

  const workFirstStep = () => {
    if (firstStep || round.feedback) return;
    setFirstStep(true);
    round.useSupport("walkthrough");
    chime(koda, "reached");
    speak(tm("story.saidFirst", { a: values[0], b: values[1], mid: question.intermediate ?? 0 }));
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
              {bar(1, tm("story.barLabel1", { actor: cast.actor, a: values[0] }), GROUPS)}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-14 text-right text-xs font-bold ${NEUTRAL.text}`}>{cast.other}</span>
              {bar(values[1], tm("story.barLabelN", { actor: cast.other, n: values[1], a: values[0] }), EACH)}
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
              ? tm("story.barUnknown", { n: question.segments })
              : tm("story.barKnown", { n: question.segments, value: question.segmentValue }),
            GROUPS,
            unknown,
          )}
        </div>
      </div>
    );
  })();

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : storyHints(question, copy.kidTip);
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    target: -1,
    progress: 0,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("story.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
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
              aria-label={tm("story.workLabel", { a: values[0], b: values[1] })}
              className={themeSystem.button("secondary", "md")}
            >
              {tm("story.doFirst")}
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
