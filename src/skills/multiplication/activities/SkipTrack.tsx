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
  drawHopRun,
  drawMultipleQuestion,
  hopKey,
  hopSteps,
  numberWord,
  shuffle,
  withoutRepeat,
  type HopSpec,
} from "../internal/data/multiplicationNumbers";
import { chime } from "../internal/data/multiplicationSound";
import { answerInput, speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import {
  HOP_ARC,
  HOP_LABEL_LIMIT,
  HOP_LINE,
  SCROLL_BOX,
  TOUCH_TARGET,
} from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";
import { NumberPad } from "../internal/ui/NumberPad";
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * The number line — equal groups laid end to end.
 *
 * Four modes on one apparatus: count in equal hops, read a multiplication as a
 * run of hops, work out how many hops reached a landing, and decide whether a
 * number is one a hop of this size lands on.
 *
 * The hops are *placed*, one at a time, and every landing is said out loud as
 * it is reached — five, ten, fifteen, twenty. That count is the lesson; the
 * line is only where it is written down.
 *
 * The last landing is named as the product, in the scaffold and again in the
 * feedback. A skip count that never says what it counted to has taught
 * counting, not multiplying (§12 trap 7), and that is the single easiest thing
 * to leave out of an engine like this.
 */

export type NumberLineMode =
  | "skip_count"
  | "hops_to_product"
  | "missing_hop"
  | "count_multiples";

interface TrackSetup {
  mode?: NumberLineMode;
  modes?: string[];
  practice?: boolean;
  steps?: number[];
  stepRange?: [number, number];
  hopRange?: [number, number];
  max?: number;
  questionsPerRound?: number;
}

export interface TrackParams extends TrackSetup {
  question?: TrackSetup;
  play?: unknown;
}

export interface HopQuestion extends RoundQuestion {
  mode: NumberLineMode;
  /** How long one hop is. */
  step: number;
  /** How many hops the run is made of; the answer `missing_hop` wants. */
  hops: number;
  /** Where the run lands: `hops × step`. */
  landing: number;
  /**
   * The far end of the drawn line.
   *
   * One hop past the run, so a child can overshoot and see that they have —
   * a line that stops exactly on the answer would answer the question.
   */
  lineMax: number;
  /** `count_multiples`: the number asked about, and whether a hop lands on it. */
  value: number;
  isMultiple: boolean;
  choices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Per-mode ranges.
 *
 * `skip_count` counts in the lengths a child actually skip counts in — twos,
 * threes, fours, fives and tens. The sixes to nines are not skip counts at this
 * age; they are derived facts, and they arrive with `FactDeck`.
 *
 * `count_multiples` stops at sixty rather than the hundred and twenty the
 * arithmetic allows. The ceiling here is the apparatus, not the question: this
 * line is hopped, and sixty hops of two is not a lesson.
 */
const DEFAULTS: Record<NumberLineMode, HopSpec> = {
  skip_count: { steps: [2, 3, 4, 5, 10], hopRange: [3, 10], max: 100 },
  hops_to_product: { stepRange: [2, 9], hopRange: [2, 9], max: 81 },
  missing_hop: { stepRange: [2, 10], hopRange: [2, 10], max: 100 },
  count_multiples: { stepRange: [2, 10], max: 60 },
};

const specFor = (setup: TrackSetup, mode: NumberLineMode): HopSpec => {
  const fallback = DEFAULTS[mode];
  return {
    steps: setup.steps ?? fallback.steps,
    stepRange: setup.stepRange ?? fallback.stepRange,
    hopRange: setup.hopRange ?? fallback.hopRange,
    max: setup.max ?? fallback.max,
  };
};

/**
 * Four landings, one of them right.
 *
 * Built from the hops rather than by nudging the answer. A child who hopped one
 * time too few lands a whole `step` short; one who added instead of multiplying
 * lands on `hops + step`. Those are the wrong answers this task actually
 * produces, and `± 1` is not one of them (§12 trap 13) — offering it lets the
 * run be skipped and the choices reasoned over instead.
 *
 * `productDistractors` is the skill's general answer to this and is deliberately
 * not used here: its place-value slip offers ten times the product, which on a
 * line that stops at ninety can be dismissed by size alone.
 */
const landingChoices = (hops: number, step: number): number[] => {
  const landing = hops * step;
  const seen = new Set([landing]);
  const wrong: number[] = [];
  for (const candidate of [landing - step, landing + step, hops + step, landing - 2 * step, landing + 2 * step]) {
    if (candidate <= 0 || seen.has(candidate) || Math.abs(candidate - landing) === 1) continue;
    seen.add(candidate);
    wrong.push(candidate);
    if (wrong.length === 3) break;
  }
  return shuffle([landing, ...wrong]);
};

export function buildQuestion(params: TrackParams, index: number, seen?: Set<string>): HopQuestion {
  const setup: TrackSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "skip_count");
  const spec = specFor(setup, mode);

  const drawn = (() => {
    if (mode === "count_multiples") {
      const draw = () => drawMultipleQuestion({ steps: hopSteps(spec), max: spec.max, nearMissDelta: 2 });
      const question = seen ? withoutRepeat(draw, (q) => `${q.step}m${q.value}`, seen) : draw();
      const { step, value, isMultiple } = question;
      // The line runs to the first landing at or past the number in question,
      // so a child who hops all the way either lands on it or steps over it.
      const lineMax = Math.ceil(value / step) * step;
      return { step, hops: lineMax / step, landing: lineMax, lineMax, value, isMultiple };
    }
    const draw = () => drawHopRun(spec);
    const run = seen ? withoutRepeat(draw, hopKey, seen) : draw();
    return {
      ...run,
      lineMax: run.step * (run.hops + 1),
      value: run.landing,
      isMultiple: true,
    };
  })();

  const { step, hops, landing, lineMax, value, isMultiple } = drawn;
  const id = `numberline-${mode}-${index}-${hops}x${step}`;

  const base: Omit<HopQuestion, "prompt" | "expected" | "taskKind"> = {
    id,
    mode,
    step,
    hops,
    landing,
    lineMax,
    value,
    isMultiple,
    choices: mode === "count_multiples" ? [] : landingChoices(hops, step),
    itemCount: mode === "count_multiples" ? value : landing,
  };

  switch (mode) {
    case "hops_to_product":
      return {
        ...base,
        taskKind: "multiply_on_a_line",
        prompt: tm("skip.promptHops", { hops, step }),
        expected: String(landing),
      };
    case "missing_hop":
      return {
        ...base,
        taskKind: "count_the_hops",
        prompt: tm("skip.promptMissing", { step, landing }),
        expected: String(hops),
      };
    case "count_multiples":
      return {
        ...base,
        taskKind: "spot_the_multiple",
        prompt: tm("skip.promptMultiple", { value, step }),
        expected: isMultiple ? "Yes" : "No",
      };
    case "skip_count":
    default:
      return {
        ...base,
        taskKind: "skip_count_hops",
        prompt: tm("skip.promptSkip", { step, hops }),
        expected: String(landing),
      };
  }
}

export const promptFor = (question: HopQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: HopQuestion): PrintedQuestion | null {
  const { step, hops, landing, value, isMultiple } = question;
  switch (question.mode) {
    case "hops_to_product":
      return {
        text: tm("skip.printedHops", { hops, step }),
        answer: String(landing),
      };
    case "missing_hop":
      return {
        text: tm("skip.printedMissing", { step, landing }),
        answer: String(hops),
      };
    case "count_multiples":
      return {
        text: tm("skip.printedMultiple", { step, value }),
        answer: isMultiple ? tm("skip.yes") : tm("skip.no"),
      };
    case "skip_count":
    default:
      return {
        text: tm("skip.printedSkip", { step, hops }),
        answer: String(landing),
      };
  }
}

export function methodFor(question: HopQuestion): string[] | null {
  switch (question.mode) {
    case "hops_to_product":
      return [
        tm("skip.methodHops1", { hops: question.hops, step: question.step }),
        tm("skip.methodHops2"),
        tm("skip.methodHops3"),
      ];
    case "missing_hop":
      return [
        tm("skip.methodMissing1", { step: question.step }),
        tm("skip.methodMissing2", { landing: question.landing }),
        tm("skip.methodMissing3"),
      ];
    case "count_multiples":
      return [
        tm("skip.methodMultiple1", { step: question.step }),
        tm("skip.methodMultiple2", { value: question.value, step: question.step }),
        tm("skip.methodMultiple3"),
      ];
    case "skip_count":
    default:
      return [
        tm("skip.methodSkip1", { step: question.step }),
        tm("skip.methodSkip2"),
        tm("skip.methodSkip3"),
      ];
  }
}

/**
 * The line, drawn for a pencil.
 *
 * Ticks where the hops can land and nothing else. The landings are what the
 * child is working out, so printing them would be printing the answer — the
 * same call `FroggySkip` makes about its own pads.
 */
export function figureFor(question: HopQuestion): React.ReactNode | null {
  const { step, lineMax } = question;
  const stops = Math.round(lineMax / step);
  const width = 300;
  const at = (n: number) => (n / lineMax) * width;

  return (
    <svg
      viewBox="-14 0 328 34"
      width="100%"
      role="img"
      aria-label={tm("skip.lineLabel", { step })}
    >
      <line x1={0} y1={14} x2={width} y2={14} stroke="#334155" strokeWidth="1.5" />
      {Array.from({ length: stops + 1 }, (_, i) => (
        <line
          key={i}
          x1={at(i * step)}
          y1={i === 0 ? 7 : 10}
          x2={at(i * step)}
          y2={18}
          stroke="#334155"
          strokeWidth={i === 0 ? 2.5 : 1.2}
        />
      ))}
      <text x={0} y={30} textAnchor="middle" fontSize="10" fill="#334155">0</text>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  made: number;
}

export function trackHints(
  question: HopQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { step, hops, landing, value } = question;
  switch (question.mode) {
    case "hops_to_product":
      return composeHints(
        kidTip,
        state.made === hops
          ? tm("skip.hintHopsAll", { hops })
          : tm("skip.hintHopsSome", { hops, step, made: state.made }),
        tm("skip.hintHops2", { step }),
      );
    case "missing_hop":
      return composeHints(
        kidTip,
        state.made === 0
          ? tm("skip.hintMissingStart", { step, landing })
          : tm("skip.hintMissingOn", { on: state.made * step, landing }),
        tm("skip.hintMissing2"),
      );
    case "count_multiples":
      return composeHints(
        kidTip,
        tm("skip.hintMultiple1", { step, value }),
        tm("skip.hintMultiple2", { step }),
      );
    case "skip_count":
    default:
      return composeHints(
        kidTip,
        state.made === hops
          ? tm("skip.hintSkipAll", { hops })
          : tm("skip.hintSkipSome", { made: state.made, step, hops }),
        tm("skip.hintSkip2", { step }),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const SkipTrack: React.FC<ActivityProps<TrackParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup: TrackSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const badgesEnabled = koda.config.isEnabled("counting_badges", true);
  const runningTotal = koda.config.isEnabled("running_product_badge", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const usePad = answerInput(koda) === "pad";

  const seen = useMemo(() => new Set<string>(), []);
  const nudge = useNudge(koda);
  const clearNudge = nudge.clear;

  /*
   * Everything this activity says, behind both gates at once.
   *
   * The count as a child hops is the audio of this lesson — a number line whose
   * landings are silent is a picture. The kit covers the opening line, the hint
   * and the reaction and none of those; `audio_speech` has to be checked here.
   */
  const speakAloud = (text: string) => {
    if (!koda.config.isEnabled("audio_speech", true)) return;
    void koda.speech.say(text, speechRate(koda)).catch(() => {});
  };
  const speak = quietWhenPractising(speakAloud, practising);
  const sayNumber = (n: number) => speak(numberWord(n));
  const refuse = (written: string, spoken: string) => {
    nudge.refuse(written);
    speak(spoken);
    /*
     * A refused move is this engine already knowing the move was wrong.
     *
     * What it never did was notice a child doing it repeatedly, which is the
     * difference between a slip and not having the technique. Safe to call a
     * coach declared further down: this only ever runs from a handler, long
     * after the render that created it.
     */
    guide.stumbled();
  };

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    /*
     * `useSkillRound` counts questions from one; `buildQuestion` counts from
     * zero, because that is how the worksheet builder calls it. Reconciled
     * here rather than inside the engine, so one index means one thing.
     */
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as HopQuestion;

  /** How many hops the child has placed. Reset on every question, replays included. */
  const [made, setMade] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!question) return;
    setMade(0);
    setTyped("");
    clearNudge();
  }, [question, clearNudge]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    if (!question) return;
    setMade(0);
    setTyped("");
    clearNudge();
  };


  if (!question) return null;

  const { mode, step, lineMax } = question;
  const landed = made * step;
  const stops = Math.round(lineMax / step);
  /** The ticks are the apparatus everywhere except where they would be the answer. */
  const showStops = mode !== "count_multiples";
  const labelLandings = badgesEnabled && stops <= HOP_LABEL_LIMIT;
  const target = mode === "missing_hop"
    ? question.landing
    : mode === "count_multiples"
      ? question.value
      : undefined;

  const feel = (correct: boolean) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
  };

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    feel(correct);
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  /* ---- hopping ---- */
  const hop = (by: 1 | -1) => {
    if (round.feedback) return;
    const next = made + by;
    if (next < 0) {
      refuse(tm("skip.atStart"), tm("skip.atStartSay"));
      return;
    }
    if (next > stops) {
      refuse(tm("skip.lineStops", { max: lineMax }), tm("skip.lineStopsSay"));
      return;
    }
    setMade(next);
    nudge.clear();
    chime(koda, by > 0 ? "counted" : "undone");
    if (hapticsEnabled) koda.haptics.tap();
    // The landing said aloud *is* the skip count: five, ten, fifteen, twenty.
    // Never on the way back — an undo must not sound like the thing it reverses.
    if (by > 0) sayNumber(next * step);
  };

  /* ---- answering ---- */
  const answerLanding = (value: number) => {
    if (round.feedback) return;
    if (made !== question.hops) {
      refuse(
        tm("skip.hopsFirst", { count: made, step, hops: question.hops }),
        tm("skip.hopsFirstSay"),
      );
      return;
    }
    const correct = value === question.landing;
    judge(
      correct,
      String(value),
      correct ? tm("skip.landsTitle") : tm("skip.notQuite"),
      // Right or wrong, the run is named as a product. That naming is the
      // whole difference between a skip count and a multiplication.
      tm("skip.landsMessage", { hops: question.hops, step, landing: question.landing }),
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse(tm("skip.typeFirst"), tm("skip.typeFirst"));
      return;
    }
    answerLanding(Number(typed));
    setTyped("");
  };

  const checkHops = () => {
    if (round.feedback) return;
    const correct = made === question.hops;
    judge(
      correct,
      String(made),
      correct ? tm("skip.howManyTitle") : tm("skip.notThatMany"),
      correct
        ? tm("skip.howManyRight", { hops: question.hops, step, landing: question.landing })
        : tm("skip.howManyWrong", { step, landing: question.landing }),
    );
  };

  const answerMultiple = (said: boolean) => {
    if (round.feedback) return;
    const correct = said === question.isMultiple;
    judge(
      correct,
      said ? "Yes" : "No",
      correct ? tm("skip.yesTitle") : tm("skip.notQuite"),
      question.isMultiple
        ? tm("skip.multipleYes", { value: question.value, hops: question.value / step, step })
        : tm("skip.multipleNo", { step, value: question.value }),
    );
  };

  /* ---- the line ---- */
  const at = (n: number) =>
    HOP_LINE.inset + (HOP_LINE.width - HOP_LINE.inset * 2) * (n / lineMax);

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : trackHints(question, copy.kidTip, { made });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* One control does the work here, so the light goes on the hop itself:
       0 is "hop forward", and there is nothing else to point at. */
    target: made < question.hops ? 0 : -1,
    progress: made,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  const board = (
    <div className={SCROLL_BOX}>
      <svg
        viewBox={`0 0 ${HOP_LINE.width} ${HOP_LINE.height}`}
        width="100%"
        className="mx-auto max-w-lg"
        role="img"
        aria-label={tm("skip.numberLine", { made, step, landed })}
      >
        <g className={NEUTRAL.text}>
          <line
            x1={at(0)}
            y1={HOP_LINE.baseline}
            x2={at(lineMax)}
            y2={HOP_LINE.baseline}
            stroke="currentColor"
            strokeWidth="2"
          />
        </g>

        {showStops
          && Array.from({ length: stops + 1 }, (_, i) => (
            <g key={`stop-${i}`} className={i <= made ? EACH.text : `${NEUTRAL.text} opacity-40`}>
              <line
                x1={at(i * step)}
                y1={HOP_LINE.baseline - 6}
                x2={at(i * step)}
                y2={HOP_LINE.baseline + 6}
                stroke="currentColor"
                strokeWidth={i <= made ? 3 : 1.5}
              />
            </g>
          ))}

        {Array.from({ length: made }, (_, i) => {
          const from = at(i * step);
          const to = at((i + 1) * step);
          return (
            <path
              key={`hop-${i}`}
              className={`${GROUPS.text} ${HOP_ARC}`}
              stroke="currentColor"
              d={`M ${from} ${HOP_LINE.baseline - 4} Q ${(from + to) / 2} ${
                HOP_LINE.baseline - HOP_LINE.arcRise
              } ${to} ${HOP_LINE.baseline - 4}`}
            />
          );
        })}

        {labelLandings
          && Array.from({ length: made + 1 }, (_, i) => (
            <text
              key={`landing-${i}`}
              className={i === made && made > 0 ? PRODUCT.text : EACH.text}
              x={at(i * step)}
              y={HOP_LINE.baseline + HOP_LINE.landingLabel}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="currentColor"
            >
              {i * step}
            </text>
          ))}

        {target !== undefined && (
          <g className={ADJUSTMENT.text}>
            <circle cx={at(target)} cy={HOP_LINE.baseline} r="5" fill="currentColor" />
            <text
              x={at(target)}
              y={HOP_LINE.baseline + HOP_LINE.targetLabel}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="currentColor"
            >
              {target}
            </text>
          </g>
        )}
      </svg>
    </div>
  );

  const hopControls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={tm("skip.hopBack")}
        onClick={() => hop(-1)}
        disabled={!!round.feedback}
        className={themeSystem.button("secondary", "choice")}
      >
        −
      </button>
      <span className={`min-w-32 text-center text-sm font-bold ${GROUPS.text}`}>
        {tm("skip.hopCount", { count: made, step })}
      </span>
      <button
        type="button"
        aria-label={tm("skip.hopForward", { next: guide.target === 0 ? tm("skip.takeNext") : "" })}
        onClick={() => hop(1)}
        disabled={!!round.feedback}
        className={`${themeSystem.button("secondary", "choice")}${
          guide.target === 0 ? " ring-4 ring-indigo-500 animate-pulse" : ""
        }`}
      >
        +
      </button>
    </div>
  );

  const numericAnswer = usePad ? (
    <div className="flex flex-col items-center gap-3">
      <output
        aria-label={tm("skip.yourAnswer")}
        className={`min-h-11 min-w-24 rounded-xl border-2 px-4 py-2 text-center text-2xl font-black tabular-nums ${PRODUCT.border} ${PRODUCT.text}`}
      >
        {typed || "—"}
      </output>
      <NumberPad
        onDigit={(digit) => setTyped((current) => (current.length >= 3 ? current : current + digit))}
        onDelete={() => setTyped((current) => current.slice(0, -1))}
        disabled={!!round.feedback}
      />
      <button type="button" onClick={submitTyped} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
        {tm("skip.check")}
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {question.choices.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={tm("skip.landOn", { value })}
          onClick={() => answerLanding(value)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          {value}
        </button>
      ))}
    </div>
  );

  const scaffoldLine = (() => {
    switch (mode) {
      case "hops_to_product":
        return `${made} × ${step} = ${landed}`;
      case "missing_hop":
        return `? × ${step} = ${question.landing}`;
      case "count_multiples":
        return made === 0
          ? tm("skip.scaffoldHop", { step })
          : tm("skip.scaffoldReach", { made, step, landed });
      case "skip_count":
      default:
        // The repeated addition, written as it is built. A route to the answer,
        // never the definition of it (§12 trap 1).
        return made === 0
          ? tm("skip.scaffoldStart", { step })
          : `${Array.from({ length: made }, () => step).join(" + ")} = ${landed}`;
    }
  })();

  const controls = (() => {
    switch (mode) {
      case "missing_hop":
        return (
          <div className="flex flex-col items-center gap-3">
            {hopControls}
            <button type="button" onClick={checkHops} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
              {tm("skip.check")}
            </button>
          </div>
        );
      case "count_multiples":
        return (
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-3">
            {hopControls}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {[true, false].map((said) => (
                <button
                  key={String(said)}
                  type="button"
                  aria-label={said ? tm("skip.ariaYes", { value: question.value, step }) : tm("skip.ariaNo", { value: question.value, step })}
                  onClick={() => answerMultiple(said)}
                  disabled={!!round.feedback}
                  className={`${TOUCH_TARGET} rounded-2xl border-2 px-6 py-3 text-lg font-black text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    said ? `${PRODUCT.border} ${PRODUCT.soft}` : `${ADJUSTMENT.border} ${ADJUSTMENT.soft}`
                  }`}
                >
                  {said ? tm("skip.yes") : tm("skip.no")}
                </button>
              ))}
            </div>
          </div>
        );
      case "hops_to_product":
      case "skip_count":
      default:
        return (
          <div className="flex flex-col items-center gap-3">
            {hopControls}
            {numericAnswer}
          </div>
        );
    }
  })();


  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("skip.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (made !== 0 || typed !== "") ? restart : undefined
      }
      iconName="footprints"
      iconTone="purple"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {board}

        {scaffold && (
          <p className={`text-center text-base font-black tabular-nums ${EACH.text}`} aria-live="polite">
            {scaffoldLine}
          </p>
        )}

        {runningTotal && (
          <p className={`text-sm font-black tabular-nums ${PRODUCT.text}`} aria-live="polite">
            So far: {landed}
          </p>
        )}

        {controls}
      </div>
    </SkillRound>
  );
};
