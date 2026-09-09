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
import { drawProduct, randInt, withoutRepeat } from "../internal/data/multiplicationNumbers";
import {
  drawPatternHunt,
  matchesIn,
  noteFor,
  ruleById,
  type PatternRuleId,
} from "../internal/data/tablePatterns";
import { chime } from "../internal/data/multiplicationSound";
import { answerInput, speechRate, tableCeiling, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { EACH, GROUPS, PRODUCT } from "../internal/data/multiplicationPalette";
import { GRID_SIZES } from "../internal/data/multiplicationLayout";
import { TimesTableChart, type CellTone } from "../internal/ui/TimesTableChart";
import { useNudge } from "../internal/ui/useNudge";
import { NumberPad } from "../internal/ui/NumberPad";

/**
 * The whole table at once.
 *
 * Four modes on one chart: find a product by tracing a row and a column, hunt
 * every cell that fits a stated pattern, meet the squares along the diagonal,
 * and pair a fact with the twin it has on the other side of that diagonal.
 *
 * The chart is the first thing in this skill that cannot be shrunk to fit a
 * phone — thirteen columns at a real touch size is about 470px — so it scrolls
 * inside its own container and the page never does (§12 trap 16). Squeezing
 * 12 × 12 into 360px would put 26px targets under a seven-year-old's finger,
 * which is a worse answer than a sideways scroll.
 */

export type TableMode = "find_cell" | "pattern_hunt" | "squares" | "commutative_pairs";

interface TableSetup {
  mode?: TableMode;
  modes?: string[];
  practice?: boolean;
  /** Rows a pattern hunt may draw from. */
  drivers?: number[];
  /** Overrides the `tableCeiling` setting, for a lesson that wants a smaller chart. */
  ceiling?: number;
  questionsPerRound?: number;
}

export interface TableParams extends TableSetup {
  question?: TableSetup;
  play?: unknown;
}

export interface TableQuestion extends RoundQuestion {
  mode: TableMode;
  ceiling: number;
  a: number;
  b: number;
  product: number;
  /** `pattern_hunt`: the row, the rule, and the partners that satisfy it. */
  rule?: PatternRuleId;
  ruleAsks?: string;
  matches: number[];
  /** The thing worth noticing about this row, said either way. */
  note?: string;
  choices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const key = (a: number, b: number): string => (a <= b ? `${a}x${b}` : `${b}x${a}`);

export function buildQuestion(params: TableParams, index: number, seen?: Set<string>): TableQuestion {
  const setup: TableSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "find_cell");
  const ceiling = setup.ceiling ?? 12;

  const drawn = (() => {
    if (mode === "pattern_hunt") {
      const draw = () => drawPatternHunt(ceiling, setup.drivers);
      const hunt = seen
        ? withoutRepeat(draw, (h) => `${h.driver}-${h.rule.id}`, seen)
        : draw();
      return {
        a: hunt.driver,
        b: hunt.matches[0],
        rule: hunt.rule.id,
        ruleAsks: hunt.rule.asks,
        matches: hunt.matches,
      };
    }

    if (mode === "squares") {
      const draw = (): { a: number; b: number } => {
        const n = randInt(2, ceiling);
        return { a: n, b: n };
      };
      const { a, b } = seen ? withoutRepeat(draw, (f) => key(f.a, f.b), seen) : draw();
      return { a, b, matches: [] as number[] };
    }

    /* `find_cell` and `commutative_pairs` both want two different factors: a
       square has no partner across the diagonal, and tracing to one is tracing
       to the same row twice. */
    const draw = () => drawProduct({
      aRange: [2, ceiling],
      bRange: [2, ceiling],
      distinctFactors: true,
      allowOne: false,
    });
    const value = seen ? withoutRepeat(draw, (v) => key(v.a, v.b), seen) : draw();
    return { a: value.a, b: value.b, matches: [] as number[] };
  })();

  const { a, b } = drawn;
  const product = a * b;
  const id = `table-${mode}-${index}-${a}x${b}`;

  const base: Omit<TableQuestion, "prompt" | "expected" | "taskKind"> = {
    id,
    mode,
    ceiling,
    a,
    b,
    product,
    rule: "rule" in drawn ? drawn.rule : undefined,
    ruleAsks: "ruleAsks" in drawn ? drawn.ruleAsks : undefined,
    matches: drawn.matches,
    note: noteFor(a),
    choices: [],
    itemCount: product,
  };

  switch (mode) {
    case "pattern_hunt":
      return {
        ...base,
        taskKind: "table_pattern_hunt",
        prompt: `In the ${a} times row, tap every answer that ${base.ruleAsks}.`,
        expected: base.matches.map((partner) => a * partner).join(", "),
      };
    case "squares":
      return {
        ...base,
        taskKind: "table_squares",
        prompt: `${a} × ${a}. Find the square on the diagonal.`,
        expected: String(product),
      };
    case "commutative_pairs":
      return {
        ...base,
        taskKind: "table_commutative_pairs",
        prompt: `${a} × ${b} is shaded. Tap the other cell that holds the same answer.`,
        expected: `${b} × ${a}`,
      };
    case "find_cell":
    default:
      return {
        ...base,
        taskKind: "table_find_cell",
        prompt: `Find ${a} × ${b}. Go along row ${a} and down column ${b}.`,
        expected: String(product),
      };
  }
}

export const promptFor = (question: TableQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: TableQuestion): PrintedQuestion | null {
  const { a, b, product } = question;
  switch (question.mode) {
    case "pattern_hunt":
      // A hunt is a selection across a printed chart the sheet does not carry,
      // and rewriting it as "list them" would be different arithmetic (§9).
      return null;
    case "squares":
      return { text: `${a} × ${a} = ____`, answer: String(product) };
    case "commutative_pairs":
      return {
        text: `${a} × ${b} = ${product}. Write the other multiplication that gives ${product}.`,
        answer: `${b} × ${a} = ${product}`,
      };
    case "find_cell":
    default:
      return {
        text: `Use a times table. Go along row ${a} and down column ${b}. ${a} × ${b} = ____`,
        answer: String(product),
      };
  }
}

export function methodFor(question: TableQuestion): string[] | null {
  switch (question.mode) {
    case "pattern_hunt":
      return null;
    case "squares":
      return [
        `A square number is a number times itself.`,
        `${question.a} rows of ${question.a} makes a true square.`,
        "They sit on the diagonal of the times table.",
      ];
    case "commutative_pairs":
      return [
        "Every fact in the table appears twice.",
        "Swap the two numbers over and the answer does not change.",
        "The two cells sit either side of the diagonal.",
      ];
    case "find_cell":
    default:
      return [
        `Find row ${question.a} down the side.`,
        `Find column ${question.b} along the top.`,
        "The answer is where they meet.",
      ];
  }
}

/** A true square of unit cells, so a square number is seen to be square. */
export function figureFor(question: TableQuestion): React.ReactNode | null {
  if (question.mode !== "squares") return null;
  const { a } = question;
  const cell = 14;
  const pad = 8;
  return (
    <svg
      viewBox={`0 0 ${a * cell + pad * 2} ${a * cell + pad * 2}`}
      width="100%"
      role="img"
      aria-label={`A square of ${a} rows of ${a}`}
    >
      {Array.from({ length: a }, (_, r) =>
        Array.from({ length: a }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={pad + c * cell}
            y={pad + r * cell}
            width={cell - 2}
            height={cell - 2}
            rx="2"
            fill="none"
            stroke="#334155"
            strokeWidth="1.1"
          />
        )),
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  picked: number[];
}

export function tableHints(
  question: TableQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { a, b } = question;
  switch (question.mode) {
    case "pattern_hunt":
      return composeHints(
        kidTip,
        state.picked.length === 0
          ? `Read along the ${a} times row and check each answer against the rule.`
          : `You have ${state.picked.length} so far. Keep going to the end of the row.`,
        // Stops short of naming a cell: which ones fit is the question.
        `Work along the row one cell at a time rather than looking for a shape.`,
      );
    case "squares":
      return composeHints(
        kidTip,
        `A square number is a number times itself: ${a} rows of ${a}.`,
        `Follow row ${a} across until it meets column ${a}. That cell is on the diagonal.`,
      );
    case "commutative_pairs":
      return composeHints(
        kidTip,
        `The partner of ${a} × ${b} has the same two numbers the other way round.`,
        `Look in row ${b}, and go across to column ${a}.`,
      );
    case "find_cell":
    default:
      return composeHints(
        kidTip,
        `Put one finger on row ${a} at the side, and one on column ${b} at the top.`,
        "Slide them together. The answer is the cell where they meet.",
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const TableGrid: React.FC<ActivityProps<TableParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: TableSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const usePad = answerInput(koda) === "pad";
  /** The setting reaches the chart *and* the numbers drawn for it. */
  const ceiling = setup.ceiling ?? tableCeiling(koda);

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
    /*
     * `useSkillRound` counts questions from one; `buildQuestion` counts from
     * zero, because that is how the worksheet builder calls it. Reconciled
     * here rather than inside the engine, so one index means one thing.
     */
    nextQuestion: useCallback(
      (index: number) => buildQuestion({ ...params, ceiling }, index - 1, seen),
      [params, ceiling, seen],
    ),
    onComplete,
  });
  const question = round.question as TableQuestion;

  /** Cells the child has tapped, as `row * 100 + col`. */
  const [picked, setPicked] = useState<number[]>([]);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!question) return;
    setPicked([]);
    setTyped("");
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { mode, a, b } = question;
  const cellId = (row: number, col: number) => row * 100 + col;
  const isPicked = (row: number, col: number) => picked.includes(cellId(row, col));

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  /** Right or wrong, the pattern gets said. A round that only says "correct" has taught tapping. */
  const withNote = (text: string) => (question.note ? `${text} ${question.note}` : text);

  const tapCell = (row: number, col: number) => {
    if (round.feedback) return;

    if (mode === "pattern_hunt") {
      if (row !== a) {
        refuse(`This hunt is the ${a} times row. That cell is in row ${row}.`, "Stay in the row.");
        return;
      }
      setPicked((current) =>
        current.includes(cellId(row, col))
          ? current.filter((id) => id !== cellId(row, col))
          : [...current, cellId(row, col)],
      );
      chime(koda, "placed");
      if (hapticsEnabled) koda.haptics.tap();
      return;
    }

    if (mode === "commutative_pairs") {
      if (row === a && col === b) {
        refuse("That is the cell already shaded. Its partner is the other way round.", "That is the one you were given.");
        return;
      }
      const correct = row === b && col === a;
      judge(
        correct,
        `${row} × ${col}`,
        correct ? "That is its twin" : "Not its twin",
        `${a} × ${b} and ${b} × ${a} both hold ${question.product}. They sit either side of the diagonal.`,
      );
      return;
    }

    // `find_cell` and `squares`: the cell itself is the answer.
    const correct = row * col === question.product;
    judge(
      correct,
      `${row} × ${col}`,
      correct ? "That is the cell" : "Not that cell",
      mode === "squares"
        ? `${a} × ${a} = ${question.product}. Squares sit on the diagonal.`
        : `Row ${a} and column ${b} meet at ${question.product}. Row ${b}, column ${a} holds it too.`,
    );
  };

  const checkHunt = () => {
    if (round.feedback) return;
    if (picked.length === 0) {
      refuse("Tap the answers that fit the rule first.", "Tap a cell first.");
      return;
    }
    const wanted = question.matches.map((partner) => cellId(a, partner)).sort((x, y) => x - y);
    const given = [...picked].sort((x, y) => x - y);
    const correct = wanted.length === given.length && wanted.every((id, i) => id === given[i]);
    judge(
      correct,
      given.map((id) => `${Math.floor(id / 100)} × ${id % 100}`).join(", "),
      correct ? "Every one of them" : "Not the whole set",
      withNote(
        correct
          ? `All ${wanted.length} of them.`
          : `${wanted.length} answers in this row ${question.ruleAsks}.`,
      ),
    );
  };

  const answerProduct = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.product;
    judge(
      correct,
      String(value),
      correct ? "That is it" : "Not quite",
      `${a} × ${b} = ${question.product}.`,
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse("Type a number first.", "Type a number first.");
      return;
    }
    answerProduct(Number(typed));
    setTyped("");
  };

  /* ---- how each cell looks ---- */
  const toneOf = (row: number, col: number): CellTone => {
    if (mode === "pattern_hunt") {
      if (isPicked(row, col)) return "chosen";
      return row === a ? "traced" : "plain";
    }
    if (mode === "commutative_pairs") {
      if (row === a && col === b) return "given";
      return "plain";
    }
    if (mode === "squares") return row === col ? "traced" : "plain";
    // `find_cell` traces the row and the column the child is looking for.
    if (scaffold && (row === a || col === b)) return "traced";
    return "plain";
  };

  const board = (
    <TimesTableChart
      ceiling={question.ceiling}
      toneOf={toneOf}
      onCell={tapCell}
      disabled={!!round.feedback}
      label={`Times table up to ${question.ceiling}`}
    />
  );

  const squareFigure = mode === "squares" && (
    <div
      role="img"
      aria-label={`${a} rows of ${a}`}
      className={`flex flex-col ${GRID_SIZES.dense.gap}`}
    >
      {Array.from({ length: a }, (_, r) => (
        <div key={r} className={`flex ${GRID_SIZES.dense.gap}`}>
          {Array.from({ length: a }, (_, c) => (
            <span
              key={c}
              aria-hidden="true"
              className={`${GRID_SIZES.dense.cell} rounded border-2 ${PRODUCT.border} ${PRODUCT.soft}`}
            />
          ))}
        </div>
      ))}
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
  ) : null;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Times Table"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : tableHints(question, copy.kidTip, { picked })}
      iconName="boxes"
      iconTone="cyan"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {squareFigure}
        {board}

        {mode === "pattern_hunt" && (
          <div className="flex flex-col items-center gap-3">
            {scaffold && (
              <p className={`text-center text-sm font-bold ${GROUPS.text}`} aria-live="polite">
                {picked.length} chosen in the {a} times row
              </p>
            )}
            <button type="button" onClick={checkHunt} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
              Check
            </button>
          </div>
        )}

        {/* The chart answers `find_cell` and `squares` by being tapped. The pad
            is offered alongside for a family who set `answerInput` to it. */}
        {(mode === "find_cell" || mode === "squares") && numericAnswer}

        {scaffold && mode === "commutative_pairs" && (
          <p className={`text-center text-sm font-bold ${EACH.text}`} aria-live="polite">
            {a} × {b} = {question.product}
          </p>
        )}
      </div>
    </SkillRound>
  );
};
