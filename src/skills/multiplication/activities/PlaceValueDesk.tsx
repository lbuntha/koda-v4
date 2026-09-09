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
  PLACE_ABBREV,
  PLACE_NAMES,
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
        prompt: `${a} × ${b}. How many tens is that, and where do they go?`,
        expected: String(product),
      };
    case "tens_times_tens":
      return {
        ...base,
        taskKind: "tens_times_tens",
        prompt: `${a} × ${b}. How many, and of what?`,
        expected: String(product),
      };
    case "times_ten_hundred":
    default:
      return {
        ...base,
        taskKind: "scale_by_ten_or_hundred",
        prompt: `${a} × ${b}. Move the digits to the left.`,
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
  const name = PLACE_NAMES[place];
  switch (question.mode) {
    case "multiples_of_ten":
      return {
        text: `${a} × ${b}. Write it as a number of tens, then as a number. ${a} × ${b} = ____`,
        answer: `${count} tens = ${product}`,
      };
    case "tens_times_tens":
      return {
        text: `${a} × ${b}. How many hundreds is that? ${a} × ${b} = ____`,
        answer: `${count} hundreds = ${product}`,
      };
    case "times_ten_hundred":
    default:
      return {
        text: `${a} × ${b}. Move each digit ${question.places === 1 ? "one place" : "two places"} to the left. ${a} × ${b} = ____`,
        answer: `${product} — ${count} ${name}`,
      };
  }
}

export function methodFor(question: DeskQuestion): string[] | null {
  const { a, b, count, place } = question;
  switch (question.mode) {
    case "multiples_of_ten":
      return [
        `${b} is ${b / 10} tens.`,
        `So ${a} × ${b} is ${a} × ${b / 10} tens, which is ${count} tens.`,
        `${count} tens is ${question.product}.`,
      ];
    case "tens_times_tens":
      return [
        `${a} is ${a / 10} tens and ${b} is ${b / 10} tens.`,
        `A ten of a ten is a hundred, so this is ${count} hundreds.`,
        `${count} hundreds is ${question.product}.`,
      ];
    case "times_ten_hundred":
    default:
      return [
        `Multiplying by ${b} makes every digit worth ${b} times as much.`,
        `Each one moves ${question.places === 1 ? "one column" : "two columns"} to the left.`,
        // Never "add a zero" (§12 trap 5).
        `The ${PLACE_NAMES[1]} column is left with nothing in it, so a zero is written there.`,
      ];
  }
}

/** The columns, drawn empty, for a child to fill in with a pencil. */
export function figureFor(question: DeskQuestion): React.ReactNode | null {
  const cell = 34;
  const labels = ["Th", "H", "T", "O"];
  return (
    <svg
      viewBox={`0 0 ${cell * 4 + 4} 56`}
      width="100%"
      role="img"
      aria-label="A place value chart with thousands, hundreds, tens and ones"
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
  const { a, b, count } = question;
  switch (question.mode) {
    case "multiples_of_ten":
      return composeHints(
        kidTip,
        `${b} is ${b / 10} tens, so this is ${a} lots of ${b / 10} tens.`,
        `Work out ${a} × ${b / 10}, then put that many in the tens column.`,
      );
    case "tens_times_tens":
      return composeHints(
        kidTip,
        `${a} is ${a / 10} tens and ${b} is ${b / 10} tens.`,
        // The place is the question, so this names the rule and not the column.
        `A ten multiplied by a ten is a hundred, so the answer counts hundreds.`,
      );
    case "times_ten_hundred":
    default:
      return composeHints(
        kidTip,
        state.moved === 0
          ? `Every digit becomes worth ${b} times as much. Move them left.`
          : `You have moved them ${state.moved} place${state.moved === 1 ? "" : "s"}.`,
        `Multiplying by ${b} moves each digit ${question.places === 1 ? "one column" : "two columns"}. Watch what is left in the ones.`,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const PlaceValueDesk: React.FC<ActivityProps<DeskParams>> = ({ params, koda, onComplete, lesson }) => {
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
      refuse("The digits are back where they started.", "They are back at the start.");
      return;
    }
    // Four columns, and the leading digit has to stay on the desk.
    if (String(a * 10 ** next).length > COLUMNS.length) {
      refuse("There is no room to move them any further left.", "There is no more room.");
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
      refuse("Move the digits first.", "Move the digits first.");
      return;
    }
    if (!moving && (count === undefined || place === undefined)) {
      refuse(
        count === undefined ? "Choose how many first." : "Now choose which column they go in.",
        count === undefined ? "Choose how many first." : "Choose a column.",
      );
      return;
    }
    const correct = shown === question.product;
    const name = PLACE_NAMES[question.place];
    judge(
      correct,
      String(shown),
      correct ? "That is it" : "Not quite",
      moving
        // The zero is named as a consequence, never as a keystroke.
        ? `${a} × ${b} is ${question.count} ${name}. Every digit moved ${question.places === 1 ? "one place" : "two places"} left, and the ones column was left empty — that is where the zero comes from.`
        : `${a} × ${b} is ${question.count} ${name}, which is ${question.product}.`,
    );
  };

  /* ---- the desk ---- */
  const digitsOn = String(shown === 0 ? "" : shown).padStart(COLUMNS.length, " ").split("");

  const desk = (
    <div className={SCROLL_BOX}>
      <div
        role="img"
        aria-label={shown === 0 ? "The desk is empty" : `The desk reads ${shown}`}
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
          aria-label="Move the digits one place left"
          onClick={() => move(1)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          ←
        </button>
        <span className={`min-w-32 text-center text-sm font-bold ${GROUPS.text}`}>
          moved {moved} place{moved === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          aria-label="Move the digits back to the right"
          onClick={() => move(-1)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          →
        </button>
      </div>
      <button type="button" onClick={checkDesk} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
        Check
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
            aria-label={`${n} of them`}
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
            aria-label={PLACE_NAMES[p]}
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
            {PLACE_NAMES[p]}
          </button>
        ))}
      </div>
      <button type="button" onClick={checkDesk} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
        Check
      </button>
    </div>
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Place Value Desk"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : deskHints(question, copy.kidTip, { moved, count, place })}
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
                ? "How many?"
                : place === undefined
                  ? `${count} of what?`
                  : `${count} ${PLACE_NAMES[place]} = ${shown}`}
          </p>
        )}

        {controls}
      </div>
    </SkillRound>
  );
};
