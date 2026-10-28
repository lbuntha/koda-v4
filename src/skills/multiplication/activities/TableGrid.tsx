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
import { drawProduct, randInt, withoutRepeat } from "../internal/data/multiplicationNumbers";
import {
  drawPatternHunt,
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
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

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
        prompt: tm("table.promptHunt", { a, asks: base.ruleAsks ?? "" }),
        expected: base.matches.map((partner) => a * partner).join(", "),
      };
    case "squares":
      return {
        ...base,
        taskKind: "table_squares",
        prompt: tm("table.promptSquares", { a }),
        expected: String(product),
      };
    case "commutative_pairs":
      return {
        ...base,
        taskKind: "table_commutative_pairs",
        prompt: tm("table.promptPairs", { a, b }),
        expected: `${b} × ${a}`,
      };
    case "find_cell":
    default:
      return {
        ...base,
        taskKind: "table_find_cell",
        prompt: tm("table.promptFind", { a, b }),
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
      return { text: tm("table.printedSquare", { a }), answer: String(product) };
    case "commutative_pairs":
      return {
        text: tm("table.printedPairs", { a, b, product }),
        answer: tm("table.printedPairsAnswer", { a, b, product }),
      };
    case "find_cell":
    default:
      return {
        text: tm("table.printedFind", { a, b }),
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
        tm("table.methodSquare1"),
        tm("table.methodSquare2", { a: question.a }),
        tm("table.methodSquare3"),
      ];
    case "commutative_pairs":
      return [
        tm("table.methodPairs1"),
        tm("table.methodPairs2"),
        tm("table.methodPairs3"),
      ];
    case "find_cell":
    default:
      return [
        tm("table.methodFind1", { a: question.a }),
        tm("table.methodFind2", { b: question.b }),
        tm("table.methodFind3"),
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
      aria-label={tm("table.squareLabel", { a })}
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
          ? tm("table.hintHunt1", { a })
          : tm("table.hintHuntSoFar", { count: state.picked.length }),
        // Stops short of naming a cell: which ones fit is the question.
        tm("table.hintHunt2"),
      );
    case "squares":
      return composeHints(
        kidTip,
        tm("table.hintSquare1", { a }),
        tm("table.hintSquare2", { a }),
      );
    case "commutative_pairs":
      return composeHints(
        kidTip,
        tm("table.hintPairs1", { a, b }),
        tm("table.hintPairs2", { a, b }),
      );
    case "find_cell":
    default:
      return composeHints(
        kidTip,
        tm("table.hintFind1", { a, b }),
        tm("table.hintFind2"),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const TableGrid: React.FC<ActivityProps<TableParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
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
    setPicked([]);
    setTyped("");
    clearNudge();
  };


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
  const withNote = (text: string) => {
    const note = noteFor(a);
    return note ? `${text} ${note}` : text;
  };
  const asks = question.rule ? ruleById(question.rule).asks : "";

  const tapCell = (row: number, col: number) => {
    if (round.feedback) return;

    if (mode === "pattern_hunt") {
      if (row !== a) {
        refuse(tm("table.stayRow", { a, row }), tm("table.stayRowSay"));
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
        refuse(tm("table.alreadyShaded"), tm("table.alreadyShadedSay"));
        return;
      }
      const correct = row === b && col === a;
      judge(
        correct,
        `${row} × ${col}`,
        correct ? tm("table.twinTitle") : tm("table.notTwinTitle"),
        tm("table.twinMessage", { a, b, product: question.product }),
      );
      return;
    }

    // `find_cell` and `squares`: the cell itself is the answer.
    const correct = row * col === question.product;
    judge(
      correct,
      `${row} × ${col}`,
      correct ? tm("table.cellTitle") : tm("table.notCellTitle"),
      mode === "squares"
        ? tm("table.squareMessage", { a, product: question.product })
        : tm("table.meetMessage", { a, b, product: question.product }),
    );
  };

  const checkHunt = () => {
    if (round.feedback) return;
    if (picked.length === 0) {
      refuse(tm("table.tapFirst"), tm("table.tapCell"));
      return;
    }
    const wanted = question.matches.map((partner) => cellId(a, partner)).sort((x, y) => x - y);
    const given = [...picked].sort((x, y) => x - y);
    const correct = wanted.length === given.length && wanted.every((id, i) => id === given[i]);
    judge(
      correct,
      given.map((id) => `${Math.floor(id / 100)} × ${id % 100}`).join(", "),
      correct ? tm("table.huntRightTitle") : tm("table.huntWrongTitle"),
      withNote(
        correct
          ? tm("table.huntAll", { count: wanted.length })
          : tm("table.huntCount", { count: wanted.length, asks }),
      ),
    );
  };

  const answerProduct = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.product;
    judge(
      correct,
      String(value),
      correct ? tm("table.rightTitle") : tm("table.wrongTitle"),
      tm("table.answerLine", { a, b, product: question.product }),
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse(tm("table.typeFirst"), tm("table.typeFirst"));
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
      label={tm("chart.upTo", { ceiling: question.ceiling })}
    />
  );

  const squareFigure = mode === "squares" && (
    <div
      role="img"
      aria-label={tm("table.rowsOf", { a })}
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
        aria-label={tm("table.yourAnswer")}
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
        {tm("table.check")}
      </button>
    </div>
  ) : null;

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : tableHints(question, copy.kidTip, { picked });
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
    progress: picked.length,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("table.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (picked.length > 0 || typed !== "") ? restart : undefined
      }
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
                {tm("table.chosen", { count: picked.length, a })}
              </p>
            )}
            <button type="button" onClick={checkHunt} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
              {tm("table.check")}
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
