import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  answerChoices,
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
  MAX_ARRAY_SIDE,
  drawArray,
  drawFactSplit,
  numberWord,
  randInt,
  shuffle,
} from "../internal/data/multiplicationNumbers";
import { chime } from "../internal/data/multiplicationSound";
import { answerInput, speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, PRODUCT } from "../internal/data/multiplicationPalette";
import {
  EDGE_LABEL,
  GRID_SIZES,
  SCROLL_BOX,
  TOUCH_TARGET,
  WORD_CHOICE,
  densityFor,
} from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";
import { NumberPad } from "../internal/ui/NumberPad";

/**
 * The array — equal groups, stood in rows and columns.
 *
 * Six modes on one apparatus: build it to a stated shape, read a shape someone
 * else built, turn it and find the total unchanged, write both equations it
 * satisfies, find a missing side, and cut it into two easier pieces.
 *
 * The array is *resized*, never redrawn. A child who has added a row and
 * watched the total jump by six has seen where multiplication comes from; a
 * child shown a fresh picture each question has seen six pictures. That is the
 * one thing this engine does that a static image could not.
 *
 * Rows and columns keep different colours everywhere, which is what makes
 * `commute` a discovery: the two numbers have to be visibly different things
 * before swapping them can be surprising.
 */

export type ArrayMode =
  | "build_array"
  | "read_array"
  | "commute"
  | "array_to_equation"
  | "missing_dimension"
  | "split_array";

interface ArraySetup {
  mode?: ArrayMode;
  modes?: string[];
  practice?: boolean;
  rowRange?: [number, number];
  colRange?: [number, number];
  maxCells?: number;
  questionsPerRound?: number;
}

export interface ArrayParams extends ArraySetup {
  question?: ArraySetup;
  play?: unknown;
}

interface Choice {
  text: string;
  correct: boolean;
}

export interface ArrayQuestion extends RoundQuestion {
  mode: ArrayMode;
  rows: number;
  cols: number;
  total: number;
  /** `missing_dimension`: the side the child must find, and the one they are given. */
  unknown: "rows" | "cols";
  shown: number;
  answer: number;
  /** `commute`: what turning the array did, and why. */
  reasons: Choice[];
  /** `array_to_equation`: options, exactly two of which describe this array. */
  equations: Choice[];
  /** `split_array`: where the array may be cut, along the rows. */
  cuts: number[];
  choices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULTS: Record<ArrayMode, { rowRange: [number, number]; colRange: [number, number] }> = {
  build_array: { rowRange: [2, 6], colRange: [2, 6] },
  read_array: { rowRange: [2, 10], colRange: [2, 10] },
  commute: { rowRange: [2, 10], colRange: [2, 10] },
  array_to_equation: { rowRange: [2, 10], colRange: [2, 10] },
  missing_dimension: { rowRange: [2, 10], colRange: [2, 10] },
  split_array: { rowRange: [6, 10], colRange: [2, 12] },
};

/** Modes where `rows === cols` makes the task answer itself. */
const NEEDS_DIFFERENT_SIDES: ArrayMode[] = ["commute", "array_to_equation"];

/**
 * Why the total did or did not change when the array was turned.
 *
 * The wrong reasons are the ones children actually give: that turning makes it
 * bigger, and that different rows must mean a different total. Both are true
 * statements about the *shape* and false about the count, which is exactly the
 * confusion the lesson exists to settle.
 */
const reasonsFor = (rows: number, cols: number): Choice[] =>
  shuffle([
    { text: "No — the same squares, just turned round.", correct: true },
    { text: `Yes — ${rows} rows of ${cols} holds more than ${cols} rows of ${rows}.`, correct: false },
    { text: "Yes — the rows changed, so the total changed.", correct: false },
    { text: "No — turning always makes an array smaller.", correct: false },
  ]);

/**
 * Six sentences, exactly two of which describe this array.
 *
 * Both orders are right and must be chosen together: picking one and being told
 * would hand the child the other for free, and the pair *is* the idea.
 */
const equationsFor = (rows: number, cols: number): Choice[] => {
  const total = rows * cols;
  const wrong = [
    `${rows} × ${rows} = ${rows * rows}`,
    `${cols} × ${cols} = ${cols * cols}`,
    `${rows} + ${cols} = ${rows + cols}`,
    `${rows + 1} × ${cols} = ${(rows + 1) * cols}`,
  ].filter((text) => !text.endsWith(`= ${total}`));

  return shuffle([
    { text: `${rows} × ${cols} = ${total}`, correct: true },
    { text: `${cols} × ${rows} = ${total}`, correct: true },
    ...wrong.slice(0, 3).map((text) => ({ text, correct: false })),
  ]);
};

export function buildQuestion(params: ArrayParams, index: number): ArrayQuestion {
  const setup: ArraySetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "build_array");
  const fallback = DEFAULTS[mode];

  const shape = mode === "split_array"
    // A split needs a side big enough to cut into a friendly part and a rest.
    ? (() => {
      const split = drawFactSplit({
        aRange: setup.rowRange ?? fallback.rowRange,
        bRange: setup.colRange ?? fallback.colRange,
      });
      return { rows: split.factor, cols: split.other, total: split.product, cut: split.partA };
    })()
    : { ...drawArray({
      rowRange: setup.rowRange ?? fallback.rowRange,
      colRange: setup.colRange ?? fallback.colRange,
      maxCells: setup.maxCells,
      distinctSides: NEEDS_DIFFERENT_SIDES.includes(mode),
    }), cut: 0 };

  const { rows, cols, total } = shape;
  const unknown: "rows" | "cols" = randInt(0, 1) === 0 ? "rows" : "cols";
  const answer = unknown === "rows" ? rows : cols;
  const id = `array-${mode}-${index}-${rows}x${cols}`;

  const base: Omit<ArrayQuestion, "prompt" | "expected" | "taskKind"> = {
    id,
    mode,
    rows,
    cols,
    total,
    unknown,
    shown: unknown === "rows" ? cols : rows,
    answer,
    reasons: reasonsFor(rows, cols),
    equations: equationsFor(rows, cols),
    // Both a friendly cut and its partner, so the child chooses where to break it.
    cuts: shape.cut > 0 ? shuffle([shape.cut, rows - shape.cut]).slice(0, 2) : [],
    choices: answerChoices(total, id, { min: 1, max: MAX_ARRAY_SIDE * MAX_ARRAY_SIDE }),
    itemCount: total,
  };

  switch (mode) {
    case "read_array":
      return {
        ...base,
        taskKind: "read_an_array",
        prompt: `${rows} rows of ${cols}. How many squares altogether?`,
        expected: String(total),
      };
    case "commute":
      return {
        ...base,
        taskKind: "turn_the_array",
        prompt: `Turn the array, then say whether the total changed — and why.`,
        expected: "No — the same squares, just turned round.",
      };
    case "array_to_equation":
      return {
        ...base,
        taskKind: "write_both_equations",
        prompt: `Choose both sentences that describe this array.`,
        expected: `${rows} × ${cols} = ${total} and ${cols} × ${rows} = ${total}`,
      };
    case "missing_dimension":
      return {
        ...base,
        taskKind: "find_the_missing_side",
        prompt: unknown === "rows"
          ? `${total} squares in rows of ${cols}. How many rows?`
          : `${total} squares in ${rows} rows. How many in each row?`,
        expected: String(answer),
      };
    case "split_array":
      return {
        ...base,
        taskKind: "split_the_array",
        prompt: `Cut the array into two easier pieces, then add them.`,
        expected: String(total),
      };
    case "build_array":
    default:
      return {
        ...base,
        taskKind: "build_an_array",
        prompt: `Make an array with ${rows} rows of ${cols}, then say how many squares.`,
        expected: String(total),
      };
  }
}

export const promptFor = (question: ArrayQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: ArrayQuestion): PrintedQuestion | null {
  const { rows, cols, total } = question;
  switch (question.mode) {
    case "commute":
      // Turning is the interaction, so paper asks for the pair of sentences the
      // turn produces rather than pretending a page can be rotated.
      return {
        text: `An array has ${rows} rows of ${cols}. Write the two multiplication sentences it shows.`,
        answer: `${rows} × ${cols} = ${total} and ${cols} × ${rows} = ${total}`,
      };
    case "array_to_equation":
      return {
        text: `Write both multiplication sentences for an array of ${rows} rows of ${cols}.`,
        answer: `${rows} × ${cols} = ${total} and ${cols} × ${rows} = ${total}`,
      };
    case "missing_dimension":
      return question.unknown === "rows"
        ? { text: `${total} squares are arranged in rows of ${cols}. How many rows? ____`, answer: String(rows) }
        : { text: `${total} squares are arranged in ${rows} equal rows. How many in each row? ____`, answer: String(cols) };
    case "split_array": {
      const cut = question.cuts[0] || 2;
      return {
        text: `Split ${rows} × ${cols} into ${cut} × ${cols} and ${rows - cut} × ${cols}, then add the two products. ${rows} × ${cols} = ____`,
        answer: `${cut * cols} + ${(rows - cut) * cols} = ${total}`,
      };
    }
    case "read_array":
    case "build_array":
    default:
      return {
        text: `Draw an array with ${rows} rows of ${cols}. ${rows} × ${cols} = ____`,
        answer: String(total),
      };
  }
}

export function methodFor(question: ArrayQuestion): string[] | null {
  switch (question.mode) {
    case "commute":
    case "array_to_equation":
      return [
        "Count the rows, then count how many are in one row.",
        "Rows times row-length gives the total.",
        "The same array read the other way gives the same total.",
      ];
    case "missing_dimension":
      return ["The total is the rows times the row length.", "Divide the total by the side you know."];
    case "split_array":
      return [
        "Cut the rows into two easier groups.",
        "Multiply each group by the row length.",
        "Add the two products.",
      ];
    default:
      return ["Count the rows.", "Count how many are in one row.", "Multiply the two."];
  }
}

export function figureFor(question: ArrayQuestion): React.ReactNode | null {
  const { rows, cols } = question;
  const cell = 16;
  const pad = 26;
  return (
    <svg
      viewBox={`0 0 ${cols * cell + pad * 2} ${rows * cell + pad * 2}`}
      width="100%"
      role="img"
      aria-label={`An array of ${rows} rows of ${cols}`}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={pad + c * cell}
            y={pad + r * cell}
            width={cell - 3}
            height={cell - 3}
            rx="2"
            fill="none"
            stroke="#334155"
            strokeWidth="1.2"
          />
        )),
      )}
      <text x={pad - 8} y={pad + (rows * cell) / 2} textAnchor="end" fontSize="12" fill="#334155">{rows}</text>
      <text x={pad + (cols * cell) / 2} y={pad - 8} textAnchor="middle" fontSize="12" fill="#334155">{cols}</text>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  rows: number;
  cols: number;
  turned: boolean;
  cutAt?: number;
  picked: string[];
}

export function arrayHints(question: ArrayQuestion, kidTip: string | undefined, state: LiveState): string[] {
  const { rows, cols, total } = question;
  switch (question.mode) {
    case "build_array":
      return composeHints(
        kidTip,
        state.rows === rows && state.cols === cols
          ? `Your array is right. Count the rows: ${rows} rows of ${cols}.`
          : `You have ${state.rows} rows of ${state.cols}. You need ${rows} rows of ${cols}.`,
        `${rows} rows of ${cols} is ${rows} lots of ${cols}.`,
      );
    case "read_array":
      return composeHints(
        kidTip,
        `Count down the side: ${rows} rows. Count along the top: ${cols}.`,
        `So it is ${rows} lots of ${cols}.`,
      );
    case "commute":
      return composeHints(
        kidTip,
        state.turned ? "Look at the squares. Were any added or taken away?" : "Turn the array first, then compare.",
        "Turning moves the squares around. It cannot make more of them.",
      );
    case "array_to_equation":
      return composeHints(
        kidTip,
        state.picked.length === 0
          ? "Count the rows, then count along one row."
          : `You have chosen ${state.picked.length}. This array needs two.`,
        `Both ${rows} × ${cols} and ${cols} × ${rows} describe it.`,
      );
    case "missing_dimension":
      return composeHints(
        kidTip,
        question.unknown === "rows"
          ? `Each row holds ${cols}. How many rows of ${cols} make ${total}?`
          : `There are ${rows} rows. How many in each row makes ${total}?`,
        `Count up in ${question.shown}s until you reach ${total}.`,
      );
    case "split_array":
    default:
      return composeHints(
        kidTip,
        state.cutAt
          ? `You cut it into ${state.cutAt} rows and ${rows - state.cutAt} rows. Work out each piece.`
          : "Cut the rows into two groups you already know.",
        state.cutAt
          ? `${state.cutAt} × ${cols} and ${rows - state.cutAt} × ${cols}, added together.`
          : `${rows} rows is harder than two smaller pieces of it.`,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const ArrayGrid: React.FC<ActivityProps<ArrayParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: ArraySetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const badgesEnabled = koda.config.isEnabled("counting_badges", true);
  const runningTotal = koda.config.isEnabled("running_product_badge", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const usePad = answerInput(koda) === "pad";

  const nudge = useNudge(koda);
  const clearNudge = nudge.clear;

  const speakAloud = (text: string) => {
    if (!koda.config.isEnabled("audio_speech", true)) return;
    void koda.speech.say(text, speechRate(koda)).catch(() => {});
  };
  const speak = quietWhenPractising(speakAloud, practising);
  const sayNumber = (n: number) => speak(numberWord(n));
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
    /*
     * `useSkillRound` counts questions from one; `buildQuestion` counts from
     * zero, because that is how the worksheet builder calls it. Reconciled
     * here rather than inside the engine, so one index means one thing.
     */
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1), [params]),
    onComplete,
  });
  const question = round.question as ArrayQuestion;

  /* The array the child is working on. For the modes that show a finished
     array this is the question's own shape; for the two that build one it
     starts small and grows. Reset on every question, including a replay. */
  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(1);
  const [turned, setTurned] = useState(false);
  const [cutAt, setCutAt] = useState<number | undefined>(undefined);
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState("");

  const builds = question?.mode === "build_array";
  const findsSide = question?.mode === "missing_dimension";

  useEffect(() => {
    if (!question) return;
    if (question.mode === "build_array") {
      setRows(1);
      setCols(1);
    } else if (question.mode === "missing_dimension") {
      // The known side is fixed; the unknown one starts at one and is grown.
      setRows(question.unknown === "rows" ? 1 : question.rows);
      setCols(question.unknown === "cols" ? 1 : question.cols);
    } else {
      setRows(question.rows);
      setCols(question.cols);
    }
    setTurned(false);
    setCutAt(undefined);
    setPicked([]);
    setTyped("");
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { mode } = question;
  const shownRows = turned ? cols : rows;
  const shownCols = turned ? rows : cols;
  const liveTotal = rows * cols;
  const density = densityFor(shownRows, shownCols);
  const grid = GRID_SIZES[density];

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

  /* ---- resizing ---- */
  const resize = (side: "rows" | "cols", by: 1 | -1) => {
    if (round.feedback) return;
    const current = side === "rows" ? rows : cols;
    const next = current + by;
    if (next < 1) {
      refuse("An array needs at least one row and one column.", "It cannot get smaller.");
      return;
    }
    if (next > MAX_ARRAY_SIDE) {
      refuse(`An array here goes up to ${MAX_ARRAY_SIDE} a side.`, "That is as big as it goes.");
      return;
    }
    if (side === "rows") setRows(next);
    else setCols(next);
    nudge.clear();
    chime(koda, "placed");
    if (hapticsEnabled) koda.haptics.tap();
    // The product as it changes is the thing an array teaches that a picture
    // cannot: add a row, and the total jumps by a whole row.
    sayNumber(side === "rows" ? next * cols : rows * next);
  };

  /* ---- turning ---- */
  const turn = () => {
    if (round.feedback) return;
    setTurned((was) => !was);
    nudge.clear();
    chime(koda, "counted");
    if (hapticsEnabled) koda.haptics.tap();
  };

  /* ---- cutting ---- */
  const cut = (at: number) => {
    if (round.feedback) return;
    setCutAt(at);
    nudge.clear();
    chime(koda, "reached");
    if (hapticsEnabled) koda.haptics.tap();
  };

  /* ---- choosing equations ---- */
  const toggleEquation = (text: string) => {
    if (round.feedback) return;
    setPicked((current) =>
      current.includes(text) ? current.filter((t) => t !== text) : [...current, text],
    );
    chime(koda, "placed");
  };

  const checkEquations = () => {
    if (picked.length !== 2) {
      refuse(
        `An array shows two sentences. You have chosen ${picked.length}.`,
        "Choose two.",
      );
      return;
    }
    const wanted = question.equations.filter((e) => e.correct).map((e) => e.text);
    // Both together, once: knowing one order and being told is not knowing the pair.
    const correct = wanted.every((text) => picked.includes(text));
    judge(
      correct,
      [...picked].sort().join(" and "),
      correct ? "Both of them" : "Not both",
      correct
        ? `${question.rows} × ${question.cols} and ${question.cols} × ${question.rows} are the same array.`
        : "One sentence for the rows, one for the columns.",
    );
  };

  /* ---- answering ---- */
  const answerTotal = (value: number) => {
    if (round.feedback) return;
    if (builds && (rows !== question.rows || cols !== question.cols)) {
      refuse(
        `Your array is ${rows} rows of ${cols}. You need ${question.rows} rows of ${question.cols}.`,
        "Build the array first.",
      );
      return;
    }
    if (mode === "split_array" && cutAt === undefined) {
      refuse("Cut the array into two pieces first.", "Cut it first.");
      return;
    }
    const correct = value === question.total;
    judge(
      correct,
      String(value),
      correct ? "Yes!" : "Not quite",
      correct
        ? `${question.rows} rows of ${question.cols} is ${question.total}.`
        : `Count the rows, then count along one row.`,
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse("Type a number first.", "Type a number first.");
      return;
    }
    answerTotal(Number(typed));
    setTyped("");
  };

  const checkSide = () => {
    if (round.feedback) return;
    const given = question.unknown === "rows" ? rows : cols;
    const correct = given === question.answer;
    judge(
      correct,
      String(given),
      correct ? "That is the side" : "Not that many",
      correct
        ? `${question.rows} rows of ${question.cols} is ${question.total}.`
        : `Count up in ${question.shown}s until you reach ${question.total}.`,
    );
  };

  const answerReason = (reason: Choice) => {
    if (round.feedback) return;
    if (!turned) {
      refuse("Turn the array before you answer.", "Turn it first.");
      return;
    }
    judge(
      reason.correct,
      reason.text,
      reason.correct ? "Exactly" : "Look again",
      reason.correct
        ? `${question.rows} × ${question.cols} and ${question.cols} × ${question.rows} both make ${question.total}.`
        : "Nothing was added or taken away — only turned.",
    );
  };

  /* ---- the grid ---- */
  const cutRow = cutAt !== undefined && !turned ? cutAt : undefined;
  const gridLabel = `${shownRows} rows of ${shownCols}`;

  const board = (
    <div className={SCROLL_BOX}>
      <div className="mx-auto flex w-fit items-start gap-2">
        <span
          className={`${EDGE_LABEL} ${GROUPS.text} self-center`}
          aria-hidden="true"
        >
          {shownRows}
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className={`${EDGE_LABEL} ${EACH.text}`} aria-hidden="true">{shownCols}</span>
          <div role="img" aria-label={gridLabel} className={`flex flex-col ${grid.gap}`}>
            {Array.from({ length: shownRows }, (_, r) => (
              <div
                key={r}
                className={`flex ${grid.gap} ${
                  cutRow !== undefined && r === cutRow ? `mt-2 border-t-4 ${ADJUSTMENT.border} pt-2` : ""
                }`}
              >
                {Array.from({ length: shownCols }, (_, c) => {
                  const inSecondPiece = cutRow !== undefined && r >= cutRow;
                  return (
                    <span
                      key={c}
                      aria-hidden="true"
                      className={`${grid.cell} ${grid.text} flex items-center justify-center rounded border-2 font-black tabular-nums ${
                        inSecondPiece ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft} ${ADJUSTMENT.text}` : `${EACH.border} ${EACH.soft} ${EACH.text}`
                      }`}
                    >
                      {badgesEnabled && density === "roomy" ? r * shownCols + c + 1 : ""}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const sideControls = (side: "rows" | "cols", label: string) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Remove a ${label}`}
        onClick={() => resize(side, -1)}
        disabled={!!round.feedback}
        className={themeSystem.button("secondary", "choice")}
      >
        −
      </button>
      <span className={`min-w-16 text-center text-sm font-bold ${side === "rows" ? GROUPS.text : EACH.text}`}>
        {side === "rows" ? rows : cols} {label}{(side === "rows" ? rows : cols) === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        aria-label={`Add a ${label}`}
        onClick={() => resize(side, 1)}
        disabled={!!round.feedback}
        className={themeSystem.button("secondary", "choice")}
      >
        +
      </button>
    </div>
  );

  const numericAnswer = usePad ? (
    <div className="flex flex-col items-center gap-3">
      <output
        aria-label="Your answer"
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
        Check
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {question.choices.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`${value} squares`}
          onClick={() => answerTotal(value)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          {value}
        </button>
      ))}
    </div>
  );

  const controls = (() => {
    switch (mode) {
      case "commute":
        return (
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-2">
            <button
              type="button"
              aria-label="Turn the array"
              aria-pressed={turned}
              onClick={turn}
              disabled={!!round.feedback}
              className={themeSystem.button("primary", "md")}
            >
              {turned ? "Turn it back" : "Turn the array"}
            </button>
            {question.reasons.map((reason) => (
              <button
                key={reason.text}
                type="button"
                onClick={() => answerReason(reason)}
                disabled={!!round.feedback}
                className={`${TOUCH_TARGET} rounded-2xl border-2 ${EACH.border} bg-surface px-4 py-3 text-left text-base font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
              >
                {reason.text}
              </button>
            ))}
          </div>
        );
      case "array_to_equation":
        return (
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-2">
            {question.equations.map((equation) => (
              <button
                key={equation.text}
                type="button"
                aria-pressed={picked.includes(equation.text)}
                onClick={() => toggleEquation(equation.text)}
                disabled={!!round.feedback}
                className={`${TOUCH_TARGET} rounded-2xl border-2 px-4 py-3 text-lg font-bold tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  picked.includes(equation.text) ? `${PRODUCT.border} ${PRODUCT.soft}` : `${EACH.border} bg-surface`
                }`}
              >
                {equation.text}
              </button>
            ))}
            <button type="button" onClick={checkEquations} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
              Check
            </button>
          </div>
        );
      case "missing_dimension":
        return (
          <div className="flex flex-col items-center gap-3">
            {sideControls(question.unknown, question.unknown === "rows" ? "row" : "column")}
            <button type="button" onClick={checkSide} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
              Check
            </button>
          </div>
        );
      case "split_array":
        return (
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {question.cuts.map((at) => (
                <button
                  key={at}
                  type="button"
                  aria-label={`Cut after row ${at}`}
                  aria-pressed={cutAt === at}
                  onClick={() => cut(at)}
                  disabled={!!round.feedback}
                  className={`${WORD_CHOICE} ${cutAt === at ? `${PRODUCT.border} ${PRODUCT.soft}` : `${EACH.border} bg-surface`}`}
                >
                  Cut after row {at}
                </button>
              ))}
            </div>
            {scaffold && cutAt !== undefined && (
              <p className={`text-center text-base font-black tabular-nums ${ADJUSTMENT.text}`} aria-live="polite">
                {cutAt} × {question.cols} + {question.rows - cutAt} × {question.cols}
              </p>
            )}
            {numericAnswer}
          </div>
        );
      case "build_array":
        return (
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-4">
              {sideControls("rows", "row")}
              {sideControls("cols", "column")}
            </div>
            {numericAnswer}
          </div>
        );
      case "read_array":
      default:
        return numericAnswer;
    }
  })();

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Rows and Columns"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : arrayHints(question, copy.kidTip, { rows, cols, turned, cutAt, picked })}
      iconName="Grid3x3"
      iconTone="cyan"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {board}

        {scaffold && builds && (
          <p className={`text-center text-sm font-bold ${GROUPS.text}`} aria-live="polite">
            You need {question.rows} rows of {question.cols}
          </p>
        )}

        {runningTotal && (builds || findsSide) && (
          <p className={`text-sm font-black tabular-nums ${PRODUCT.text}`} aria-live="polite">
            So far: {liveTotal} squares
          </p>
        )}

        {controls}
      </div>
    </SkillRound>
  );
};
