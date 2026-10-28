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
  guideSetup,
  useGuide,
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
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
    { text: tm("array.reasonSame"), correct: true },
    { text: tm("array.reasonMore", { rows, cols }), correct: false },
    { text: tm("array.reasonChanged"), correct: false },
    { text: tm("array.reasonSmaller"), correct: false },
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
        prompt: tm("array.promptRead", { rows, cols }),
        expected: String(total),
      };
    case "commute":
      return {
        ...base,
        taskKind: "turn_the_array",
        prompt: tm("array.promptCommute"),
        expected: "No — the same squares, just turned round.",
      };
    case "array_to_equation":
      return {
        ...base,
        taskKind: "write_both_equations",
        prompt: tm("array.promptEquation"),
        expected: `${rows} × ${cols} = ${total} and ${cols} × ${rows} = ${total}`,
      };
    case "missing_dimension":
      return {
        ...base,
        taskKind: "find_the_missing_side",
        prompt: unknown === "rows"
          ? tm("array.promptMissingRows", { total, cols })
          : tm("array.promptMissingCols", { total, rows }),
        expected: String(answer),
      };
    case "split_array":
      return {
        ...base,
        taskKind: "split_the_array",
        prompt: tm("array.promptSplit"),
        expected: String(total),
      };
    case "build_array":
    default:
      return {
        ...base,
        taskKind: "build_an_array",
        prompt: tm("array.promptBuild", { rows, cols }),
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
        text: tm("array.printedCommute", { rows, cols }),
        answer: tm("array.bothEquations", { rows, cols, total }),
      };
    case "array_to_equation":
      return {
        text: tm("array.printedBoth", { rows, cols }),
        answer: tm("array.bothEquations", { rows, cols, total }),
      };
    case "missing_dimension":
      return question.unknown === "rows"
        ? { text: tm("array.printedMissingRows", { total, cols }), answer: String(rows) }
        : { text: tm("array.printedMissingCols", { total, rows }), answer: String(cols) };
    case "split_array": {
      const cut = question.cuts[0] || 2;
      return {
        text: tm("array.printedSplit", { rows, cols, cut, rest: rows - cut }),
        answer: `${cut * cols} + ${(rows - cut) * cols} = ${total}`,
      };
    }
    case "read_array":
    case "build_array":
    default:
      return {
        text: tm("array.printedDraw", { rows, cols }),
        answer: String(total),
      };
  }
}

export function methodFor(question: ArrayQuestion): string[] | null {
  switch (question.mode) {
    case "commute":
    case "array_to_equation":
      return [
        tm("array.methodCount1"),
        tm("array.methodCount2"),
        tm("array.methodCount3"),
      ];
    case "missing_dimension":
      return [tm("array.methodMissing1"), tm("array.methodMissing2")];
    case "split_array":
      return [
        tm("array.methodSplit1"),
        tm("array.methodSplit2"),
        tm("array.methodSplit3"),
      ];
    default:
      return [tm("array.methodPlain1"), tm("array.methodPlain2"), tm("array.methodPlain3")];
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
      aria-label={tm("array.figureLabel", { rows, cols })}
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
          ? tm("array.hintBuildRight", { rows, cols })
          : tm("array.hintBuildNeed", { haveRows: state.rows, haveCols: state.cols, rows, cols }),
        tm("array.hintBuildLots", { rows, cols }),
      );
    case "read_array":
      return composeHints(
        kidTip,
        tm("array.hintReadCount", { rows, cols }),
        tm("array.hintReadLots", { rows, cols }),
      );
    case "commute":
      return composeHints(
        kidTip,
        state.turned ? tm("array.hintCommuteTurned") : tm("array.hintCommuteTurn"),
        /*
         * The commutative fact on these numbers, not the idea again.
         *
         * This rung was word for word the lesson's own kidTip, so
         * `composeHints` dropped it as a duplicate and the ladder was two rungs
         * long: a child who climbed to the top was handed the sentence they
         * had already read. Only a sweep over every lesson catches that.
         */
        tm("array.hintCommuteBoth", { rows, cols, total }),
      );
    case "array_to_equation":
      return composeHints(
        kidTip,
        state.picked.length === 0
          ? tm("array.hintEqCount")
          : tm("array.hintEqChosen", { count: state.picked.length }),
        tm("array.hintEqBoth", { rows, cols }),
      );
    case "missing_dimension":
      return composeHints(
        kidTip,
        question.unknown === "rows"
          ? tm("array.hintMissingRows", { cols, total })
          : tm("array.hintMissingCols", { rows, total }),
        tm("array.hintMissingUp", { shown: question.shown, total }),
      );
    case "split_array":
    default:
      return composeHints(
        kidTip,
        state.cutAt
          ? tm("array.hintSplitCut", { cut: state.cutAt, rest: rows - state.cutAt })
          : tm("array.hintSplitStart"),
        state.cutAt
          ? tm("array.hintSplitSum", { cut: state.cutAt, rest: rows - state.cutAt, cols })
          : tm("array.hintSplitHarder", { rows }),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const ArrayGrid: React.FC<ActivityProps<ArrayParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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
  };


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
      refuse(tm("array.atLeastOne"), tm("array.smallerSay"));
      return;
    }
    if (next > MAX_ARRAY_SIDE) {
      refuse(tm("array.upTo", { max: MAX_ARRAY_SIDE }), tm("array.biggestSay"));
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
        tm("array.twoSentences", { count: picked.length }),
        tm("array.chooseTwo"),
      );
      return;
    }
    const wanted = question.equations.filter((e) => e.correct).map((e) => e.text);
    // Both together, once: knowing one order and being told is not knowing the pair.
    const correct = wanted.every((text) => picked.includes(text));
    judge(
      correct,
      [...picked].sort().join(" and "),
      correct ? tm("array.bothTitle") : tm("array.notBothTitle"),
      correct
        ? tm("array.sameArray", { rows: question.rows, cols: question.cols })
        : tm("array.oneEach"),
    );
  };

  /* ---- answering ---- */
  const answerTotal = (value: number) => {
    if (round.feedback) return;
    if (builds && (rows !== question.rows || cols !== question.cols)) {
      refuse(
        tm("array.buildFirst", { haveRows: rows, haveCols: cols, rows: question.rows, cols: question.cols }),
        tm("array.buildFirstSay"),
      );
      return;
    }
    if (mode === "split_array" && cutAt === undefined) {
      refuse(tm("array.cutFirst"), tm("array.cutFirstSay"));
      return;
    }
    const correct = value === question.total;
    judge(
      correct,
      String(value),
      correct ? tm("array.yes") : tm("array.notQuite"),
      correct
        ? tm("array.isTotal", { rows: question.rows, cols: question.cols, total: question.total })
        : tm("array.countAgain"),
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse(tm("array.typeFirst"), tm("array.typeFirst"));
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
      correct ? tm("array.sideTitle") : tm("array.notThatMany"),
      correct
        ? tm("array.isTotal", { rows: question.rows, cols: question.cols, total: question.total })
        : tm("array.countUp", { shown: question.shown, total: question.total }),
    );
  };

  const answerReason = (reason: Choice) => {
    if (round.feedback) return;
    if (!turned) {
      refuse(tm("array.turnFirst"), tm("array.turnFirstSay"));
      return;
    }
    judge(
      reason.correct,
      reason.text,
      reason.correct ? tm("array.exactly") : tm("array.lookAgain"),
      reason.correct
        ? tm("array.bothMake", { rows: question.rows, cols: question.cols, total: question.total })
        : tm("array.onlyTurned"),
    );
  };

  /* ---- the grid ---- */
  const cutRow = cutAt !== undefined && !turned ? cutAt : undefined;
  const gridLabel = tm("array.gridLabel", { rows: shownRows, cols: shownCols });

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

  const sideControls = (side: "rows" | "cols") => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={tm(side === "rows" ? "array.removeRow" : "array.removeCol")}
        onClick={() => resize(side, -1)}
        disabled={!!round.feedback}
        className={themeSystem.button("secondary", "choice")}
      >
        −
      </button>
      <span className={`min-w-16 text-center text-sm font-bold ${side === "rows" ? GROUPS.text : EACH.text}`}>
        {tm(side === "rows" ? "array.rowCount" : "array.colCount", { count: side === "rows" ? rows : cols })}
      </span>
      <button
        type="button"
        aria-label={tm(side === "rows" ? "array.addRow" : "array.addCol")}
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
        aria-label={tm("array.yourAnswer")}
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
        {tm("array.check")}
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {question.choices.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={tm("array.squares", { value })}
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
              aria-label={tm("array.turnArray")}
              aria-pressed={turned}
              onClick={turn}
              disabled={!!round.feedback}
              className={themeSystem.button("primary", "md")}
            >
              {turned ? tm("array.turnBack") : tm("array.turnArray")}
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
              {tm("array.check")}
            </button>
          </div>
        );
      case "missing_dimension":
        return (
          <div className="flex flex-col items-center gap-3">
            {sideControls(question.unknown)}
            <button type="button" onClick={checkSide} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
              {tm("array.check")}
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
                  aria-label={tm("array.cutAfter", { at })}
                  aria-pressed={cutAt === at}
                  onClick={() => cut(at)}
                  disabled={!!round.feedback}
                  className={`${WORD_CHOICE} ${cutAt === at ? `${PRODUCT.border} ${PRODUCT.soft}` : `${EACH.border} bg-surface`}`}
                >
                  {tm("array.cutAfter", { at })}
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
              {sideControls("rows")}
              {sideControls("cols")}
            </div>
            {numericAnswer}
          </div>
        );
      case "read_array":
      default:
        return numericAnswer;
    }
  })();

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : arrayHints(question, copy.kidTip, { rows, cols, turned, cutAt, picked });
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
    /*
     * Effort, measured against where this mode seeds the grid.
     *
     * A build starts at one by one, a missing-dimension question fixes the
     * known side and starts the other at one, and the rest open on the
     * question's own shape. Subtracting a flat 1 was right for only the first
     * of those, so the other two counted a child who had dragged nothing as
     * already several moves in and were coached early.
     */
    progress: (() => {
      const seedRows =
        question.mode === "build_array"
          ? 1
          : question.mode === "missing_dimension" && question.unknown === "rows"
            ? 1
            : question.rows;
      const seedCols =
        question.mode === "build_array"
          ? 1
          : question.mode === "missing_dimension" && question.unknown === "cols"
            ? 1
            : question.cols;
      return (
        Math.abs(rows - seedRows) +
        Math.abs(cols - seedCols) +
        picked.length +
        (turned ? 1 : 0)
      );
    })(),
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("array.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (turned || cutAt !== undefined || picked.length > 0 || typed !== "") ? restart : undefined
      }
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
            {tm("array.youNeed", { rows: question.rows, cols: question.cols })}
          </p>
        )}

        {runningTotal && (builds || findsSide) && (
          <p className={`text-sm font-black tabular-nums ${PRODUCT.text}`} aria-live="polite">
            {tm("array.soFar", { total: liveTotal })}
          </p>
        )}

        {controls}
      </div>
    </SkillRound>
  );
};
