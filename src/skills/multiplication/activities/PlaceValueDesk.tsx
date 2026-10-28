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
  PLACE_ABBREV,
  PLACE_NAMES,
  PLACE_UNITS,
  drawScaledProduct,
  productDistractors,
  shuffle,
  withoutRepeat,
  type ScaleKind,
} from "../internal/data/multiplicationNumbers";
import { chime } from "../internal/data/multiplicationSound";
import { speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { DIGIT_CELL, SCROLL_BOX, TOUCH_TARGET } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * The place-value desk — where the zero comes from.
 *
 * Three modes, one sentence with a different place in it each time: `34 × 10`
 * is thirty-four tens, `3 × 40` is twelve tens, `30 × 40` is twelve hundreds.
 * All three are `count × place`, and the desk's whole job is to show the count
 * landing in a column and the ones column being left empty behind it.
 *
 * Nowhere in this file does anything add a zero. §12 trap 5 is the most
 * installed false rule in the topic — it is the rule that breaks the first time
 * a child meets 0.7 × 10, and this is the age it gets taught. So the digits
 * move and the zero *appears*, and the engine says as much in the feedback.
 */

export type DeskMode = ScaleKind;

/** Thousands to ones. `90 × 90` is 8100, so four columns is the ceiling. */
const COLUMNS = [1000, 100, 10, 1] as const;

interface DeskSetup {
  mode?: DeskMode;
  modes?: string[];
  practice?: boolean;
  valueRange?: [number, number];
  digitRange?: [number, number];
  scales?: number[];
  questionsPerRound?: number;
}

export interface DeskParams extends DeskSetup {
  question?: DeskSetup;
  play?: unknown;
}

export interface DeskQuestion extends RoundQuestion {
  mode: DeskMode;
  a: number;
  b: number;
  product: number;
  /** The product read as a count of a place: twelve *tens*. */
  count: number;
  place: number;
  /** How many columns the digits move, for the mode that moves them. */
  places: number;
  /** `multiples_of_ten` and `tens_times_tens`: how many, offered as four. */
  counts: number[];
  /** The places a child may drop that count into. */
  places_offered: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

export function buildQuestion(params: DeskParams, index: number, seen?: Set<string>): DeskQuestion {
  const setup: DeskSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "times_ten_hundred");

  const draw = () => drawScaledProduct(mode, {
    valueRange: setup.valueRange,
    digitRange: setup.digitRange,
    scales: setup.scales,
  });
  const drawn = seen ? withoutRepeat(draw, (v) => `${v.a}x${v.b}`, seen) : draw();
  const { a, b, product, count, place, places, digitA, digitB } = drawn;
  const id = `chart-${mode}-${index}-${a}x${b}`;

  const base: Omit<DeskQuestion, "prompt" | "expected" | "taskKind"> = {
    id, mode, a, b, product, count, place, places,
    /* The count is `a × b` on the digits, so its near misses are the ones a
       digit product actually produces — never the answer nudged by one. */
    counts: mode === "times_ten_hundred"
      ? []
      : shuffle([count, ...productDistractors({ a: digitA, b: digitB, product: count }, 3)]),
    // Ones is offered throughout: choosing it is the mistake these levels are
    // about, and a child has to be able to make it.
    places_offered: mode === "times_ten_hundred" ? [] : [1, 10, 100],
    itemCount: product,
  };

  switch (mode) {
    case "multiples_of_ten":
      return {
        ...base,
        taskKind: "multiply_a_multiple_of_ten",
        prompt: tm("desk.promptTens", { a, b }),
        expected: String(product),
      };
    case "tens_times_tens":
      return {
        ...base,
        taskKind: "tens_times_tens",
        prompt: tm("desk.promptTensTens", { a, b }),
        expected: String(product),
      };
    case "times_ten_hundred":
    default:
      return {
        ...base,
        taskKind: "scale_by_ten_or_hundred",
        prompt: tm("desk.promptMove", { a, b }),
        expected: String(product),
      };
  }
}

export const promptFor = (question: DeskQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: DeskQuestion): PrintedQuestion | null {
  const { a, b, product, count, place } = question;
  const name = PLACE_UNITS[place];
  switch (question.mode) {
    case "multiples_of_ten":
      return {
        text: tm("desk.printedTens", { a, b }),
        answer: tm("desk.printedTensAnswer", { count, product }),
      };
    case "tens_times_tens":
      return {
        text: tm("desk.printedTensTens", { a, b }),
        answer: tm("desk.printedTensTensAnswer", { count, product }),
      };
    case "times_ten_hundred":
    default:
      return {
        text: tm("desk.printedMove", { a, b, places: question.places === 1 ? tm("desk.onePlace") : tm("desk.twoPlaces") }),
        answer: tm("desk.printedMoveAnswer", { product, count, name }),
      };
  }
}

export function methodFor(question: DeskQuestion): string[] | null {
  const { a, b, count } = question;
  switch (question.mode) {
    case "multiples_of_ten":
      return [
        tm("desk.methodTens1", { b, tens: b / 10 }),
        tm("desk.methodTens2", { a, b, tens: b / 10, count }),
        tm("desk.methodTens3", { count, product: question.product }),
      ];
    case "tens_times_tens":
      return [
        tm("desk.methodTT1", { a, b, ta: a / 10, tb: b / 10 }),
        tm("desk.methodTT2", { count }),
        tm("desk.methodTT3", { count, product: question.product }),
      ];
    case "times_ten_hundred":
    default:
      return [
        tm("desk.methodMove1", { b }),
        tm("desk.methodMove2", { columns: question.places === 1 ? tm("desk.oneColumn") : tm("desk.twoColumns") }),
        // Never "add a zero" (§12 trap 5).
        tm("desk.methodMove3", { place: PLACE_NAMES[1] }),
      ];
  }
}

/** The columns, drawn empty, for a child to fill in with a pencil. */
export function figureFor(_question: DeskQuestion): React.ReactNode | null {
  const cell = 34;
  const labels = [1000, 100, 10, 1].map((place) => PLACE_ABBREV[place]);
  return (
    <svg
      viewBox={`0 0 ${cell * 4 + 4} 56`}
      width="100%"
      role="img"
      aria-label={tm("desk.figureLabel")}
    >
      {labels.map((label, i) => (
        <g key={label}>
          <text x={2 + i * cell + cell / 2} y={12} textAnchor="middle" fontSize="10" fill="#334155">{label}</text>
          <rect
            x={2 + i * cell}
            y={18}
            width={cell - 4}
            height={34}
            rx="3"
            fill="none"
            stroke="#334155"
            strokeWidth="1.2"
          />
        </g>
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  moved: number;
  count?: number;
  place?: number;
}

export function deskHints(
  question: DeskQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { a, b } = question;
  switch (question.mode) {
    case "multiples_of_ten":
      return composeHints(
        kidTip,
        tm("desk.hintTens1", { a, b, tens: b / 10 }),
        tm("desk.hintTens2", { a, tens: b / 10 }),
      );
    case "tens_times_tens":
      return composeHints(
        kidTip,
        tm("desk.hintTT1", { a, b, ta: a / 10, tb: b / 10 }),
        // The place is the question, so this names the rule and not the column.
        tm("desk.hintTT2"),
      );
    case "times_ten_hundred":
    default:
      return composeHints(
        kidTip,
        state.moved === 0
          ? tm("desk.hintMoveStart", { b })
          : tm("desk.hintMoved", { count: state.moved }),
        tm("desk.hintMove2", { b, columns: question.places === 1 ? tm("desk.oneColumn") : tm("desk.twoColumns") }),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const PlaceValueDesk: React.FC<ActivityProps<DeskParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup: DeskSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
    /* `useSkillRound` counts from one; `buildQuestion` counts from zero. */
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as DeskQuestion;

  /** How many columns the digits have been moved. */
  const [moved, setMoved] = useState(0);
  /** The count and the place a child has put it in. */
  const [count, setCount] = useState<number | undefined>(undefined);
  const [place, setPlace] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!question) return;
    setMoved(0);
    setCount(undefined);
    setPlace(undefined);
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
    setMoved(0);
    setCount(undefined);
    setPlace(undefined);
    clearNudge();
  };


  if (!question) return null;

  const { mode, a, b } = question;
  const moving = mode === "times_ten_hundred";

  /** What the desk currently reads. */
  const shown = moving
    ? a * 10 ** moved
    : count !== undefined && place !== undefined
      ? count * place
      : 0;

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  const move = (by: 1 | -1) => {
    if (round.feedback) return;
    const next = moved + by;
    if (next < 0) {
      refuse(tm("desk.backStart"), tm("desk.backStartSay"));
      return;
    }
    // Four columns, and the leading digit has to stay on the desk.
    if (String(a * 10 ** next).length > COLUMNS.length) {
      refuse(tm("desk.noRoom"), tm("desk.noRoomSay"));
      return;
    }
    setMoved(next);
    nudge.clear();
    chime(koda, by > 0 ? "counted" : "undone");
    if (hapticsEnabled) koda.haptics.tap();
  };

  const checkDesk = () => {
    if (round.feedback) return;
    if (moving && moved === 0) {
      refuse(tm("desk.moveFirst"), tm("desk.moveFirst"));
      return;
    }
    if (!moving && (count === undefined || place === undefined)) {
      refuse(
        count === undefined ? tm("desk.howManyFirst") : tm("desk.chooseColumn"),
        count === undefined ? tm("desk.howManyFirst") : tm("desk.chooseColumnSay"),
      );
      return;
    }
    const correct = shown === question.product;
    const name = PLACE_UNITS[question.place];
    judge(
      correct,
      String(shown),
      correct ? tm("desk.rightTitle") : tm("desk.wrongTitle"),
      moving
        // The zero is named as a consequence, never as a keystroke.
        ? tm("desk.moveMessage", { a, b, count: question.count, name, places: question.places === 1 ? tm("desk.onePlace") : tm("desk.twoPlaces") })
        : tm("desk.countMessage", { a, b, count: question.count, name, product: question.product }),
    );
  };

  /* ---- the desk ---- */
  const digitsOn = String(shown === 0 ? "" : shown).padStart(COLUMNS.length, " ").split("");

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : deskHints(question, copy.kidTip, { moved, count, place });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* The count the desk is waiting for: pick how many before placing them. */
    target: count === undefined ? question.b : -1,
    progress: moved,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  const desk = (
    <div className={SCROLL_BOX}>
      <div
        role="img"
        aria-label={shown === 0 ? tm("desk.empty") : tm("desk.reads", { shown })}
        className="mx-auto flex w-fit gap-1"
      >
        {COLUMNS.map((column, i) => {
          const digit = digitsOn[i];
          const filled = digit !== " ";
          /* The column the answer counts, and the ones column it empties: the
             two the child is meant to be watching. */
          const isTarget = !moving && column === place;
          const isEmptied = filled && digit === "0" && column < question.place;
          return (
            <div key={column} className="flex flex-col items-center gap-1">
              <span className={`text-[10px] font-black ${NEUTRAL.text} opacity-60`}>
                {PLACE_ABBREV[column]}
              </span>
              <span
                aria-hidden="true"
                className={`${DIGIT_CELL} flex items-center justify-center rounded-lg border-2 text-2xl font-black tabular-nums ${
                  !filled
                    ? `${NEUTRAL.border} bg-surface ${NEUTRAL.text} opacity-40`
                    : isEmptied
                      ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft} ${ADJUSTMENT.text}`
                      : isTarget
                        ? `${PRODUCT.border} ${PRODUCT.soft} ${PRODUCT.text}`
                        : `${EACH.border} ${EACH.soft} ${EACH.text}`
                }`}
              >
                {filled ? digit : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const controls = moving ? (
    <div className="flex flex-col items-center gap-3">
      {/* Each control sits where its motion goes. Reversed, a child presses the
          button on the right to send the digits left, which is a small lie
          about the one thing this desk is for. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={tm("desk.moveLeft")}
          onClick={() => move(1)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          ←
        </button>
        <span className={`min-w-32 text-center text-sm font-bold ${GROUPS.text}`}>
          {tm("desk.moved", { count: moved })}
        </span>
        <button
          type="button"
          aria-label={tm("desk.moveBack")}
          onClick={() => move(-1)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          →
        </button>
      </div>
      <button type="button" onClick={checkDesk} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
        {tm("desk.check")}
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {question.counts.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={count === n}
            aria-label={tm("desk.ofThem", { n, next: guide.target === n ? tm("desk.chooseNext") : "" })}
            onClick={() => {
              if (round.feedback) return;
              setCount(n);
              nudge.clear();
              chime(koda, "placed");
            }}
            disabled={!!round.feedback}
            className={`${TOUCH_TARGET} rounded-2xl border-2 px-4 py-2 text-lg font-black tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              count === n ? `${PRODUCT.border} ${PRODUCT.soft}` : `${EACH.border} bg-surface`
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {question.places_offered.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={place === p}
            aria-label={PLACE_UNITS[p]}
            onClick={() => {
              if (round.feedback) return;
              setPlace(p);
              nudge.clear();
              chime(koda, "counted");
            }}
            disabled={!!round.feedback}
            className={`${TOUCH_TARGET} rounded-2xl border-2 px-4 py-2 text-base font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
              place === p ? `${PRODUCT.border} ${PRODUCT.soft}` : `${EACH.border} bg-surface`
            }`}
          >
            {PLACE_UNITS[p]}
          </button>
        ))}
      </div>
      <button type="button" onClick={checkDesk} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
        {tm("desk.check")}
      </button>
    </div>
  );


  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("desk.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (moved !== 0 || count !== undefined || place !== undefined) ? restart : undefined
      }
      iconName="layers"
      iconTone="cyan"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {desk}

        {scaffold && (
          <p className={`text-center text-base font-black tabular-nums ${EACH.text}`} aria-live="polite">
            {moving
              ? `${a} × ${b}`
              : count === undefined
                ? tm("desk.howMany")
                : place === undefined
                  ? tm("desk.ofWhat", { count })
                  : tm("desk.equals", { count, name: PLACE_UNITS[place], shown })}
          </p>
        )}

        {controls}
      </div>
    </SkillRound>
  );
};
