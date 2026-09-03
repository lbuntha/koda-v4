import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { DIGIT_CELL, SCENE, TOUCH_TARGET } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, digitsOf, drawDifference, exchangesIn, withoutRepeat,
  type Difference, type DifferenceSpec,
} from "../internal/data/subtractionNumbers";

export type ColumnMode = "standard" | "cascade" | "across_zero";

export interface ColumnSetup extends PracticeSetup {
  mode?: ColumnMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  questionsPerRound?: number;
}

export interface ColumnPadParams extends ColumnSetup { question?: ColumnSetup }

export interface ColumnQuestion extends RoundQuestion {
  mode: ColumnMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  /** Ones first, so index 0 is the column entered first. */
  top: number[];
  bottom: number[];
  answer: number[];
  /** Columns that must borrow before they can be subtracted. */
  borrows: number[];
}

const DEFAULT_SPEC: Record<ColumnMode, DifferenceSpec> = {
  standard: { minuendRange: [21, 999], subtrahendRange: [10, 899], exchange: "ones" },
  cascade: { minuendRange: [200, 999], subtrahendRange: [111, 899], exchange: "both" },
  across_zero: { minuendRange: [200, 909], subtrahendRange: [101, 899], exchange: "across_zero" },
};

const declared = (setup: ColumnSetup): DifferenceSpec => {
  const out: DifferenceSpec = {};
  if (setup.minuendRange) out.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) out.subtrahendRange = setup.subtrahendRange;
  return out;
};

/** The exchange shape is the mode; a lesson may move the numbers, not the method. */
export const specFor = (mode: ColumnMode, setup: ColumnSetup): DifferenceSpec => ({
  ...DEFAULT_SPEC[mode], ...declared(setup), exchange: DEFAULT_SPEC[mode].exchange,
});

const PLACES = ["ones", "tens", "hundreds"] as const;

/** Digits ones-first, padded to the width the question needs. */
const columnsOf = (value: number, width: number): number[] => {
  const d = digitsOf(value);
  return PLACES.slice(0, width).map((place) => d[place]);
};

export const buildQuestion = (setup: ColumnSetup, index: number, seen: Set<string>): ColumnQuestion => {
  const mode = modeAt<ColumnMode>(setup, index, "standard");
  const value = withoutRepeat<Difference>(() => drawDifference(specFor(mode, setup)), differenceKey, seen);
  const width = value.minuend >= 100 ? 3 : 2;
  const top = columnsOf(value.minuend, width);
  const bottom = columnsOf(value.subtrahend, width);
  // A column borrows when its own digits cannot pay, which is exactly the
  // condition `exchangesIn` walks; reading it from there keeps the pad and the
  // generator agreeing about what the question requires.
  const borrows = top.map((digit, i) => (digit < bottom[i] ? i : -1)).filter((i) => i >= 0);
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_column_${mode}`,
    mode, ...value, top, bottom, answer: columnsOf(value.difference, width), borrows,
    expected: String(value.difference), itemCount: value.minuend,
  };
};

export const promptFor = (q: ColumnQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  if (filled) return filled;
  if (q.mode === "cascade") return `${q.minuend} minus ${q.subtrahend}. This one needs two exchanges.`;
  if (q.mode === "across_zero") return `${q.minuend} minus ${q.subtrahend}. Exchange through the zero.`;
  return `${q.minuend} minus ${q.subtrahend}. Write it in columns and exchange once.`;
};

export const printedFor = (q: ColumnQuestion): PrintedQuestion => ({
  text: `${q.minuend} − ${q.subtrahend} = (set it out in columns and show every exchange)`,
  answer: String(q.difference),
});

export const methodFor = (q: ColumnQuestion): string[] => [
  "Line the digits up by place.",
  q.mode === "across_zero"
    ? "There is nothing to take from the tens, so open a hundred into ten tens first, then one of those tens into ten ones."
    : "Where the top digit is too small, exchange one from the column to its left.",
  "Subtract each column from the ones end.",
];

/** How an exchange is written: the old value struck out, the new one above it. */
export interface ExchangeMark { from: number; oldValue: number; newValue: number; toValue: number }

export const markFor = (top: number[], column: number): ExchangeMark | undefined => {
  let donor = column + 1;
  while (donor < top.length && top[donor] === 0) donor += 1;
  if (donor >= top.length) return undefined;
  return { from: donor, oldValue: top[donor], newValue: top[donor] - 1, toValue: top[column] + 10 };
};

export function columnHints(
  q: ColumnQuestion,
  state: { top: number[]; filled: number; kidTip?: string },
): string[] {
  const owed = q.top.map((_, i) => i).find((i) => state.top[i] < q.bottom[i]);
  if (owed !== undefined) {
    const name = PLACES[owed];
    const mark = markFor(state.top, owed);
    return composeHints(
      state.kidTip ?? "When the top digit is too small, exchange from the left.",
      `The ${name} column has ${state.top[owed]} and needs to give ${q.bottom[owed]}.`,
      mark && mark.oldValue === 0
        ? `The next column is empty, so open the one beyond it first, then take a ten from there.`
        : `Exchange one from the ${PLACES[(mark?.from ?? owed + 1)]} column: it becomes ${mark?.newValue}, and the ${name} become ${mark?.toValue}.`,
    );
  }
  return composeHints(
    state.kidTip ?? "Subtract each column from the ones end.",
    `${state.filled} of ${q.answer.length} columns are written. Every column can pay now.`,
    `${q.minuend} minus ${q.subtrahend} is ${q.difference}.`,
  );
}

export const figureFor = (q: ColumnQuestion): React.ReactNode => (
  <span className="inline-flex flex-col items-end text-slate-900 font-bold" role="img"
    aria-label={`Column subtraction ${q.minuend} minus ${q.subtrahend} with room to show exchanges`}>
    <span className="inline-flex gap-0.5 h-4" />
    <span className="inline-flex gap-0.5">{[...q.top].reverse().map((digit, i) => <span key={i} className="inline-flex h-7 w-7 items-center justify-center">{digit}</span>)}</span>
    <span className="inline-flex gap-0.5 border-b-2 border-slate-900 pb-0.5">
      <span className="inline-flex h-7 w-4 items-center justify-center">−</span>
      {[...q.bottom].reverse().map((digit, i) => <span key={i} className="inline-flex h-7 w-7 items-center justify-center">{digit}</span>)}
    </span>
    <span className="inline-flex gap-0.5 pt-0.5">{q.answer.map((_, i) => <span key={i} className="inline-flex h-7 w-7 border-2 border-slate-900" />)}</span>
  </span>
);

export const ColumnPad: React.FC<ActivityProps<ColumnPadParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: ColumnSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [top, setTop] = useState<number[]>([]);
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [written, setWritten] = useState<Record<number, string>>({});
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 38,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as ColumnQuestion;

  useEffect(() => { setTop(q.top); setMarks({}); setWritten({}); nudge.clear(); }, [q.id, q.top, nudge.clear]);

  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);
  const width = q.answer.length;
  const filled = q.answer.filter((_, i) => (written[i] ?? "") !== "").length;
  const nextColumn = q.answer.findIndex((_, i) => (written[i] ?? "") === "");
  const owed = top.map((_, i) => i).find((i) => top[i] < q.bottom[i]);

  /**
   * Exchange one unit from the nearest column that has something to give.
   *
   * Across a zero this runs twice by hand, which is the point of level 40: the
   * hundred opens into ten tens, and one of *those* tens opens into ten ones.
   * Doing it in one silent step would hide the very move the lesson is named
   * after.
   */
  const exchangeInto = (column: number) => {
    if (round.feedback) return;
    setTop((current) => {
      const mark = markFor(current, column);
      if (!mark) return current;
      const next = [...current];
      next[mark.from] -= 1;
      // Every column the request passed through gains ten and gives one onward.
      for (let at = mark.from - 1; at > column; at -= 1) next[at] += 9;
      next[column] += 10;
      return next;
    });
    setMarks((current) => ({ ...current, [column]: (current[column] ?? 0) + 1 }));
    chime(koda, "changed");
    koda.haptics.tap();
  };

  const check = () => {
    if (filled < width) { nudge.refuse(`Write the ${PLACES[nextColumn]} column before you check.`); return; }
    const given = q.answer.map((_, i) => written[i]).reverse().join("").replace(/^0+(?=\d)/, "");
    const correct = given === String(q.difference);
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    // A dropped exchange is a place-value slip, not a random miss: the child
    // took the smaller digit from the larger one and called it subtraction.
    const droppedExchange = q.borrows.some((column) => !marks[column]);
    round.submit({
      correct, given, expected: q.expected,
      errorKind: correct ? undefined : droppedExchange ? "place_value" : "off_by_more",
      title: correct ? "Every column balances!" : droppedExchange ? "An exchange is missing" : "Check the columns again",
      message: practising ? undefined : `${q.minuend} minus ${q.subtrahend} is ${q.difference}.`,
    });
  };

  const label = (i: number) => `${PLACES[i]} column`;

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Column Subtraction" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="layers" iconTone="indigo"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : columnHints(q, { top, filled, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-6`}>
        <div className="mx-auto w-fit">
          {/* The exchange row. A struck-out old value with its new value beside
              it, never a tiny unexplained "1" tucked against a digit. */}
          <div className="flex justify-end gap-1.5 h-8">
            {[...Array(width)].map((_, i) => {
              const column = width - 1 - i;
              const changed = top[column] !== q.top[column];
              return <span key={column} className={`${DIGIT_CELL} h-8 flex items-center justify-center gap-1 text-xs font-black tabular-nums`}>
                {changed && <>
                  <span className="text-ink/40 line-through">{q.top[column]}</span>
                  <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.enter}
                    className={DIFFERENCE.text}>{top[column]}</motion.span>
                </>}
              </span>;
            })}
          </div>

          <div className="flex justify-end gap-1.5">
            {[...Array(width)].map((_, i) => {
              const column = width - 1 - i;
              return <span key={column} className={`${DIGIT_CELL} flex items-center justify-center text-3xl font-black tabular-nums ${top[column] !== q.top[column] ? "text-ink/35 line-through" : WHOLE.text}`}>{q.top[column]}</span>;
            })}
          </div>

          <div className="flex justify-end items-center gap-1.5 border-b-4 border-ink/30 pb-1.5">
            <span className="text-2xl font-black text-ink/40 pr-1">−</span>
            {[...Array(width)].map((_, i) => {
              const column = width - 1 - i;
              return <span key={column} className={`${DIGIT_CELL} flex items-center justify-center text-3xl font-black tabular-nums ${REMOVED_PART.text}`}>{q.bottom[column]}</span>;
            })}
          </div>

          <div className="flex justify-end gap-1.5 pt-2">
            {[...Array(width)].map((_, i) => {
              const column = width - 1 - i;
              // Right to left: only the next unwritten column accepts a digit.
              const open = column === nextColumn;
              return <span key={column} className={`${DIGIT_CELL} shrink-0`}>
                <input inputMode="numeric" pattern="[0-9]*" value={written[column] ?? ""} disabled={!open || Boolean(round.feedback)}
                  onChange={(event) => setWritten((current) => ({ ...current, [column]: event.target.value.replace(/[^0-9]/g, "").slice(-1) }))}
                  aria-label={label(column)} className={themeSystem.field("md", "w-full text-center text-2xl font-black tabular-nums")} />
              </span>;
            })}
          </div>
        </div>

        {scaffold && !practising && <div className="mt-3 text-center text-sm font-bold text-ink/60">
          {owed !== undefined
            ? `The ${PLACES[owed]} column cannot pay yet. Exchange one from the left.`
            : filled < width ? `Write the ${PLACES[nextColumn]} column next.` : "Every column is written."}
        </div>}
      </div>

      <div className="flex flex-wrap justify-center gap-2.5">
        {[...Array(width - 1)].map((_, i) => {
          const column = i;
          const possible = markFor(top, column) !== undefined && top[column] < 10;
          return possible ? <button key={column} type="button" onClick={() => exchangeInto(column)}
            className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}>
            Exchange into the {PLACES[column]}
          </button> : null;
        })}
      </div>

      <div className="flex justify-center"><button type="button" onClick={check} className={themeSystem.button("primary", "lg")}>Check</button></div>
    </div>
  </SkillRound>;
};

/** Exported for the exchange test: the shape `exchangesIn` says a question needs. */
export const requiredExchanges = (q: ColumnQuestion): number => exchangesIn(q.minuend, q.subtrahend).length;
