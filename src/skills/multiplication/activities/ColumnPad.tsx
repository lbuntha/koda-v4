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
  columnSteps,
  drawColumnProduct,
  placeValueSplit,
  shuffle,
  withoutRepeat,
  type ColumnStep,
} from "../internal/data/multiplicationNumbers";
import { chime } from "../internal/data/multiplicationSound";
import { speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { DIGIT_CELL, SCROLL_BOX, TOUCH_TARGET } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";
import { NumberPad } from "../internal/ui/NumberPad";

/**
 * The written method, done in the order it is written.
 *
 * Right to left, one digit at a time, carries in their own boxes above the
 * column they are carried into — and the last carry is not a carry at all, it
 * is the leading digit of the answer.
 *
 * The two-digit mode asks one question before it lets a child write anything:
 * what does the second row multiply by? A child who answers "four" is refused
 * and told why. `46 × 23` has a second row of `46 × 20`, and the zero at the
 * end of it is the *consequence* of multiplying by twenty — not a keystroke
 * that goes there first (§12 trap 12). That rule is the reason children stop
 * being able to explain the algorithm the moment it grows a third row.
 */

export type ColumnMode = "no_regroup" | "regroup" | "two_digit";

interface ColumnSetup {
  mode?: ColumnMode;
  modes?: string[];
  practice?: boolean;
  digitsA?: 2 | 3;
  questionsPerRound?: number;
}

export interface ColumnParams extends ColumnSetup {
  question?: ColumnSetup;
  play?: unknown;
}

export interface PartialRow {
  /** What this row multiplies the top number by: 3, then 20. */
  multiplier: number;
  value: number;
}

export interface ColumnQuestion extends RoundQuestion {
  mode: ColumnMode;
  a: number;
  b: number;
  product: number;
  /** `no_regroup` / `regroup`: the digits and carries, in writing order. */
  steps: ColumnStep[];
  /** `two_digit`: the two partial rows, and what each multiplies by. */
  rows: PartialRow[];
  /** `two_digit`: what the second row could be multiplying by. */
  multiplierChoices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

export function buildQuestion(params: ColumnParams, index: number, seen?: Set<string>): ColumnQuestion {
  const setup: ColumnSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "no_regroup");

  const draw = () => drawColumnProduct({
    digitsA: setup.digitsA ?? 2,
    digitsB: mode === "two_digit" ? 2 : 1,
    carries: mode === "no_regroup" ? "never" : mode === "regroup" ? "some" : "any",
    /* `46 × 30` has only one partial row, so there is no second row to ask
       about — and asking about it is the entire content of this level. */
    bNoZeroDigit: mode === "two_digit",
  });
  const { a, b, product } = seen ? withoutRepeat(draw, (v) => `${v.a}x${v.b}`, seen) : draw();
  const id = `column-${mode}-${index}-${a}x${b}`;

  /* The second row multiplies by the tens — twenty, not two. The wrong option
     is the bare digit, because writing `× 2` and adding a zero afterwards is
     the misunderstanding this level exists to correct. */
  const bParts = placeValueSplit(b);
  const rows: PartialRow[] = mode === "two_digit"
    ? bParts.slice().reverse().map((part) => ({ multiplier: part, value: a * part }))
    : [];
  const tens = rows[1]?.multiplier ?? 0;

  const base: Omit<ColumnQuestion, "prompt" | "expected" | "taskKind"> = {
    id, mode, a, b, product,
    steps: mode === "two_digit" ? [] : columnSteps(a, b),
    rows,
    multiplierChoices: mode === "two_digit" ? shuffle([tens, tens / 10, tens * 10]) : [],
    itemCount: product,
  };

  switch (mode) {
    case "regroup":
      return {
        ...base,
        taskKind: "column_with_regrouping",
        prompt: `${a} × ${b}. Work right to left, and write each carry in its box.`,
        expected: String(product),
      };
    case "two_digit":
      return {
        ...base,
        taskKind: "two_digit_column",
        prompt: `${a} × ${b}. One row for the ones, one for the tens, then add them.`,
        expected: String(product),
      };
    case "no_regroup":
    default:
      return {
        ...base,
        taskKind: "column_no_regrouping",
        prompt: `${a} × ${b}. Start with the ones and work left.`,
        expected: String(product),
      };
  }
}

export const promptFor = (question: ColumnQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: ColumnQuestion): PrintedQuestion | null {
  const { a, b, product, rows } = question;
  if (question.mode === "two_digit") {
    return {
      text: `${a} × ${b} in columns. Write the ones row, then the tens row, then add them. ${a} × ${b} = ____`,
      answer: `${rows.map((r) => `${a} × ${r.multiplier} = ${r.value}`).join(", ")} — total ${product}`,
    };
  }
  return {
    text: `${a} × ${b} in columns, working right to left. ${a} × ${b} = ____`,
    answer: String(product),
  };
}

export function methodFor(question: ColumnQuestion): string[] | null {
  const { a, b, rows } = question;
  switch (question.mode) {
    case "regroup":
      return [
        "Start with the ones column and work left.",
        "When a column comes to ten or more, write the ones digit and carry the rest.",
        "Add the carry into the next column before writing it down.",
      ];
    case "two_digit":
      return [
        `The first row is ${a} × ${rows[0]?.multiplier ?? 0}.`,
        // §12 trap 12: the second row is × the tens, and the zero follows.
        `The second row is ${a} × ${rows[1]?.multiplier ?? 0} — the tens, not the digit on its own.`,
        "That is why it ends in a zero. Add the two rows.",
      ];
    case "no_regroup":
    default:
      return [
        "Start with the ones column.",
        `Multiply each digit of ${a} by ${b} in turn, working left.`,
        "Write each answer under its own column.",
      ];
  }
}

/** The ruled frame, with the carry row left blank for a pencil. */
export function figureFor(question: ColumnQuestion): React.ReactNode | null {
  const { a, b } = question;
  const cell = 26;
  const width = String(question.product).length + 1;
  const right = width * cell;
  const line = (y: number) => (
    <line x1={right - width * cell} y1={y} x2={right} y2={y} stroke="#334155" strokeWidth="1.2" />
  );
  const digits = (value: number, y: number) =>
    String(value).split("").map((d, i) => (
      <text
        key={`${y}-${i}`}
        x={right - (String(value).length - i) * cell + cell / 2}
        y={y}
        textAnchor="middle"
        fontSize="16"
        fill="#334155"
      >
        {d}
      </text>
    ));

  return (
    <svg viewBox={`0 0 ${right + 4} 96`} width="100%" role="img" aria-label={`A column frame for ${a} times ${b}`}>
      {/* A blank row of boxes for the carries, above everything. */}
      {Array.from({ length: width }, (_, i) => (
        <rect
          key={i}
          x={i * cell + 3}
          y={4}
          width={cell - 6}
          height={cell - 8}
          rx="2"
          fill="none"
          stroke="#94a3b8"
          strokeDasharray="3 2"
          strokeWidth="1"
        />
      ))}
      {digits(a, 48)}
      <text x={right - (String(b).length + 1) * cell + cell / 2} y={72} textAnchor="middle" fontSize="16" fill="#334155">×</text>
      {digits(b, 72)}
      {line(80)}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  done: number;
  chosen?: number;
}

export function columnHints(
  question: ColumnQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { a, rows } = question;
  switch (question.mode) {
    case "regroup": {
      const next = question.steps[state.done];
      return composeHints(
        kidTip,
        next?.kind === "carry"
          ? `That column came to ten or more. The extra tens go in the carry box.`
          : `Multiply the next digit, then add anything waiting in the carry box.`,
        "A column only ever holds one digit. Everything above nine moves left.",
      );
    }
    case "two_digit":
      return composeHints(
        kidTip,
        state.chosen === undefined
          ? `The bottom number is ${placeValueSplit(question.b).join(" and ")}. The second row uses the tens.`
          : `The second row is ${a} × ${rows[1]?.multiplier}. Work it out like any other row.`,
        // Names why the zero is there rather than telling anyone to type one.
        `Multiplying by ${rows[1]?.multiplier} lands on a whole number of tens, which is why that row ends in a zero.`,
      );
    case "no_regroup":
    default:
      return composeHints(
        kidTip,
        `Start at the right. Every digit of ${a} gets multiplied in turn.`,
        "Each answer goes under the column it came from.",
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const ColumnPad: React.FC<ActivityProps<ColumnParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: ColumnSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const refuse = (writtenText: string, spoken: string) => {
    nudge.refuse(writtenText);
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
  const question = round.question as ColumnQuestion;

  /** What has been written into each step, in writing order. */
  const [written, setWritten] = useState<(number | undefined)[]>([]);
  /** `two_digit`: what the child says the second row multiplies by. */
  const [chosen, setChosen] = useState<number | undefined>(undefined);
  /** `two_digit`: the two row totals and the sum, as typed. */
  const [typed, setTyped] = useState<string[]>(["", "", ""]);
  /*
   * Which row the pad is filling.
   *
   * Held rather than derived. Deriving it from "the first empty row" moved the
   * cursor the instant a row got its first digit, so `115` went in as a 1, a 1
   * and a 5 across three different rows. A row is finished when the child says
   * it is, by tapping the next one.
   */
  const [activeRow, setActiveRow] = useState(0);

  useEffect(() => {
    if (!question) return;
    setWritten(question.steps.map(() => undefined));
    setChosen(undefined);
    setTyped(["", "", ""]);
    setActiveRow(0);
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { mode, a, b, steps, rows } = question;
  const wide = mode === "two_digit";
  const done = written.findIndex((v) => v === undefined);
  const nextStep = done === -1 ? steps.length : done;

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  /* ---- writing a digit, right to left ---- */
  const writeDigit = (digit: number) => {
    if (round.feedback || nextStep >= steps.length) return;
    setWritten((current) => {
      const next = [...current];
      next[nextStep] = digit;
      return next;
    });
    nudge.clear();
    chime(koda, "placed");
    if (hapticsEnabled) koda.haptics.tap();
  };

  const rubOut = () => {
    if (round.feedback) return;
    const last = written.reduce((found, v, i) => (v !== undefined ? i : found), -1);
    if (last < 0) return;
    setWritten((current) => {
      const next = [...current];
      next[last] = undefined;
      return next;
    });
    chime(koda, "undone");
  };

  const checkColumn = () => {
    if (round.feedback) return;
    if (nextStep < steps.length) {
      const remaining = steps.length - nextStep;
      refuse(
        `${remaining} more to write. Work right to left until the columns run out.`,
        "Finish the columns first.",
      );
      return;
    }
    /* Read the answer off the digit cells, exactly as it is written. A child
       whose carries are wrong writes a wrong number, and is told which column
       it went wrong in rather than only that the total missed. */
    const value = steps
      .map((step, i) => ({ step, given: written[i]! }))
      .filter(({ step }) => step.kind === "digit")
      .reduce((sum, { step, given }) => sum + given * step.place, 0);
    const firstWrong = steps.findIndex((step, i) => step.value !== written[i]);
    const correct = value === question.product && firstWrong === -1;
    judge(
      correct,
      String(value),
      correct ? "That is the method" : "Check the columns",
      firstWrong >= 0
        ? `The ${placeName(steps[firstWrong].place)} ${steps[firstWrong].kind === "carry" ? "carry" : "column"} should be ${steps[firstWrong].value}.`
        : `${a} × ${b} = ${question.product}.`,
    );
  };

  /* ---- the two-digit method ---- */
  const chooseMultiplier = (value: number) => {
    if (round.feedback) return;
    const wanted = rows[1].multiplier;
    if (value !== wanted) {
      // §12 trap 12, said out loud rather than marked.
      refuse(
        value * 10 === wanted
          ? `The ${value} in ${b} is worth ${wanted}, not ${value}. The second row multiplies by ${wanted} — that is where its zero comes from.`
          : `${value} is not one of the parts of ${b}. It splits into ${placeValueSplit(b).join(" and ")}.`,
        "That is not what the second row multiplies by.",
      );
      return;
    }
    setChosen(value);
    nudge.clear();
    chime(koda, "reached");
    if (hapticsEnabled) koda.haptics.success();
  };

  const setTypedAt = (index: number, next: string) =>
    setTyped((current) => current.map((v, i) => (i === index ? next : v)));

  const checkRows = () => {
    if (round.feedback) return;
    if (chosen === undefined) {
      refuse("Say what the second row multiplies by first.", "Choose the multiplier first.");
      return;
    }
    if (typed.some((v) => v === "")) {
      refuse("Both rows and the total need filling in.", "Fill both rows first.");
      return;
    }
    const [one, ten, sum] = typed.map(Number);
    const correctRows = one === rows[0].value && ten === rows[1].value;
    const correct = correctRows && sum === question.product;
    judge(
      correct,
      String(sum),
      correct ? "That is the method" : "Check the rows",
      !correctRows
        ? `${a} × ${rows[0].multiplier} is ${rows[0].value}, and ${a} × ${rows[1].multiplier} is ${rows[1].value}.`
        : `${rows[0].value} + ${rows[1].value} = ${question.product}.`,
    );
  };

  /* ---- the column ---- */
  const digitSteps = steps.filter((step) => step.kind === "digit");
  const places = digitSteps.map((step) => step.place).sort((x, y) => y - x);

  const cell = (content: React.ReactNode, tone: string, key: string, label?: string) => (
    <span
      key={key}
      aria-label={label}
      className={`${DIGIT_CELL} flex items-center justify-center rounded-lg border-2 text-2xl font-black tabular-nums ${tone}`}
    >
      {content}
    </span>
  );

  const narrowColumn = (
    <div className={SCROLL_BOX}>
      <div className="mx-auto flex w-fit flex-col items-end gap-1">
        {/* Carries, above the column they are carried into. */}
        <div className="flex gap-1">
          {places.map((place) => {
            const index = steps.findIndex((s) => s.kind === "carry" && s.place === place);
            if (index === -1) return cell("", "border-transparent", `carry-${place}`);
            const value = written[index];
            const active = index === nextStep;
            return cell(
              value ?? "",
              value !== undefined
                ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft} ${ADJUSTMENT.text} !text-base`
                : active
                  ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft} animate-pulse`
                  : `${NEUTRAL.border} border-dashed bg-surface`,
              `carry-${place}`,
              value === undefined
                ? `Carry into the ${placeName(place)}, empty`
                : `Carry into the ${placeName(place)}, ${value}`,
            );
          })}
        </div>

        <p className={`text-3xl font-black tabular-nums ${GROUPS.text}`}>{a}</p>
        <p className={`text-3xl font-black tabular-nums ${EACH.text}`}>× {b}</p>
        <div className={`h-0.5 w-full ${NEUTRAL.text} bg-current opacity-40`} />

        <div className="flex gap-1">
          {places.map((place) => {
            const index = steps.findIndex((s) => s.kind === "digit" && s.place === place);
            const value = written[index];
            const active = index === nextStep;
            return cell(
              value ?? "",
              value !== undefined
                ? `${PRODUCT.border} ${PRODUCT.soft} ${PRODUCT.text}`
                : active
                  ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft} animate-pulse`
                  : `${NEUTRAL.border} border-dashed bg-surface`,
              `digit-${place}`,
              value === undefined
                ? `The ${placeName(place)}, empty`
                : `The ${placeName(place)}, ${value}`,
            );
          })}
        </div>
      </div>
    </div>
  );

  /** Each row is its own target; tapping one moves the pad to it. */
  const rowBox = (index: number, label: string, tone: string) => (
    <button
      type="button"
      aria-label={`${label}, ${typed[index] || "empty"}`}
      aria-pressed={activeRow === index}
      onClick={() => {
        if (round.feedback) return;
        setActiveRow(index);
        nudge.clear();
      }}
      disabled={!!round.feedback}
      className="flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <span className={`text-sm font-bold tabular-nums ${NEUTRAL.text}`}>{label}</span>
      <span
        className={`flex min-h-11 min-w-24 items-center justify-end rounded-xl border-2 px-3 py-1 text-2xl font-black tabular-nums ${
          activeRow === index ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft}` : tone
        }`}
      >
        {typed[index] || "—"}
      </span>
    </button>
  );

  const wideColumn = (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <p className={`text-right text-3xl font-black tabular-nums ${GROUPS.text}`}>{a}</p>
      <p className={`text-right text-3xl font-black tabular-nums ${EACH.text}`}>× {b}</p>
      <div className={`h-0.5 w-full ${NEUTRAL.text} bg-current opacity-40`} />
      {chosen === undefined ? (
        <div className="flex flex-col items-stretch gap-2">
          <p className={`text-center text-sm font-bold ${NEUTRAL.text}`}>
            What does the second row multiply {a} by?
          </p>
          {question.multiplierChoices.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`The second row multiplies by ${value}`}
              onClick={() => chooseMultiplier(value)}
              disabled={!!round.feedback}
              className={`${TOUCH_TARGET} rounded-2xl border-2 ${EACH.border} bg-surface px-4 py-3 text-lg font-bold tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
            >
              × {value}
            </button>
          ))}
        </div>
      ) : (
        <>
          {rowBox(0, `${a} × ${rows[0].multiplier}`, `${PRODUCT.border} bg-surface`)}
          {rowBox(1, `${a} × ${rows[1].multiplier}`, `${PRODUCT.border} bg-surface`)}
          <div className={`h-0.5 w-full ${NEUTRAL.text} bg-current opacity-40`} />
          {rowBox(2, "Total", `${PRODUCT.border} ${PRODUCT.soft}`)}
        </>
      )}
    </div>
  );

  /*
   * No pad until there is somewhere for a digit to go.
   *
   * The two-digit method asks which multiplier the second row uses before it
   * lets anything be written, so while that question is up every key on the
   * pad is refused — a control that can do nothing should not be on screen at
   * all. The refusal stays as the safety net; this is the front door.
   */
  const canWrite = !wide || chosen !== undefined;

  const pad = (
    <NumberPad
      onDigit={(digit) => {
        if (wide) {
          if (chosen === undefined) {
            refuse("Say what the second row multiplies by first.", "Choose the multiplier first.");
            return;
          }
          setTypedAt(activeRow, (typed[activeRow] + digit).slice(0, 5));
        } else {
          writeDigit(Number(digit));
        }
      }}
      onDelete={() => {
        if (wide) setTypedAt(activeRow, typed[activeRow].slice(0, -1));
        else rubOut();
      }}
      disabled={!!round.feedback}
    />
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Column Method"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : columnHints(question, copy.kidTip, { done: nextStep, chosen })}
      iconName="layers"
      iconTone="indigo"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {wide ? wideColumn : narrowColumn}

        {scaffold && !wide && (
          <p className={`text-center text-sm font-bold ${GROUPS.text}`} aria-live="polite">
            {nextStep >= steps.length
              ? "Every column is written"
              : steps[nextStep].kind === "carry"
                ? `Now the carry into the ${placeName(steps[nextStep].place)}`
                : `Now the ${placeName(steps[nextStep].place)}`}
          </p>
        )}

        {canWrite && pad}

        {canWrite && (
          <button
            type="button"
            onClick={wide ? checkRows : checkColumn}
            disabled={!!round.feedback}
            className={themeSystem.button("primary", "md")}
          >
            Check
          </button>
        )}
      </div>
    </SkillRound>
  );
};

/** "ones", "tens", "hundreds" — what a column is called when it is talked about. */
function placeName(place: number): string {
  if (place === 1) return "ones";
  if (place === 10) return "tens";
  if (place === 100) return "hundreds";
  return "thousands";
}
