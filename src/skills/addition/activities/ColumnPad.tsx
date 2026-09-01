import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { ADDEND_A, ADDEND_B, CHANGE } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import { isPractice, modeAt, type PracticeSetup } from "../../kit";
import {
  carriesIn,
  digitsOf,
  drawPair,
  pairKey,
  withoutRepeat,
  type PairSpec,
  type Place,
} from "../internal/data/additionNumbers";

/**
 * The vertical algorithm, with the carry written down.
 *
 * This is the compact form of everything before it: the exchange from the block
 * yard, the columns from the chart, the partials from written strategies — all
 * of it folded into one procedure where the only thing kept on paper is a small
 * digit above the next column.
 *
 * Which is exactly why that digit is not optional here. A child who adds the
 * ones, gets fifteen, writes the five and *remembers* the ten has done the
 * arithmetic and skipped the algorithm; the next column is where it costs them.
 * So a column is not accepted until its carry is written, and leaving it out is
 * refused rather than marked wrong — the sum in their head was right.
 */

export type ColumnMode = "standard" | "cascade";

/** Columns, widest first. Only ever as many as the numbers need. */
const ORDER: Place[] = ["hundreds", "tens", "ones"];
const HEADING: Record<Place, string> = { hundreds: "H", tens: "T", ones: "O" };
/** Where a carry out of this column lands. */
const CARRIES_INTO: Partial<Record<Place, Place>> = { ones: "tens", tens: "hundreds" };

export interface ColumnSetup extends PracticeSetup {
  mode?: ColumnMode;
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface ColumnPadParams extends ColumnSetup {
  question?: ColumnSetup;
}

export interface ColumnQuestion extends RoundQuestion {
  mode: ColumnMode;
  a: number;
  b: number;
  sum: number;
  /** Columns on screen, widest first. */
  places: Place[];
  /** The answer digit for each column, in `places` order. */
  answerDigits: number[];
  /** Columns that receive a carry, and must have it written above them. */
  carryInto: Place[];
}

const DEFAULT_SPEC: Record<ColumnMode, PairSpec> = {
  /*
   * Exactly one carry. `regroup: "ones"` guarantees the ones column carries;
   * the sum ceiling is what stops the tens carrying as well — two-digit addends
   * whose total stays under a hundred cannot carry out of the tens, so the
   * ceiling does the work without a second constraint to keep in step.
   */
  standard: { addendRange: [15, 89], regroup: "ones", sumMax: 99 },
  /*
   * Two carries, one feeding the next. The ceiling again: three-digit addends
   * totalling under a thousand cannot carry out of the hundreds, so the board
   * never needs a fourth column.
   */
  cascade: { addendRange: [111, 889], regroup: "both", sumMax: 999 },
};

const declared = (setup: ColumnSetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: ColumnMode, setup: ColumnSetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  // What the mode is. A lesson may narrow the numbers, not remove the carries.
  spec.regroup = DEFAULT_SPEC[mode].regroup;
  spec.sumMax = Math.min(spec.sumMax ?? Infinity, DEFAULT_SPEC[mode].sumMax!);
  return spec;
};

/** The smallest number that reaches into each column. */
const REACHES: Record<Place, number> = { ones: 0, tens: 10, hundreds: 100 };

/**
 * The digit a number shows in one column, or nothing where it does not reach.
 *
 * 47 written under 265 has an empty hundreds column, not a nought — a nought
 * there is a different number, and a child reading the sum has to see the
 * shorter one as shorter.
 */
const digitIn = (n: number, p: Place): string => (n >= REACHES[p] ? String(digitsOf(n)[p]) : "");

/**
 * The columns these numbers occupy, widest first.
 *
 * Decided by magnitude, not by which digits happen to be non-zero. Reading it
 * off the digits dropped a column whenever one of them was a nought — a sum of
 * 420 came out with no ones column at all, so there was nowhere to write the
 * last digit and nothing on screen said why.
 */
const placesFor = (widest: number): Place[] => ORDER.filter((p) => widest >= REACHES[p]);

export const buildQuestion = (
  setup: ColumnSetup,
  index: number,
  seen: Set<string>,
): ColumnQuestion => {
  const mode = modeAt<ColumnMode>(setup, index, "standard");
  const { a, b, sum } = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
  const places = placesFor(Math.max(a, b, sum));
  const d = digitsOf(sum);

  return {
    id: `q${index}-${Date.now().toString(36)}`,
    taskKind: `column_${mode}`,
    mode,
    a,
    b,
    sum,
    places,
    answerDigits: places.map((p) => d[p]),
    // A carry out of the ones lands on the tens, and so on. Only the columns
    // that receive one need it written.
    carryInto: carriesIn(a, b)
      .map((from) => CARRIES_INTO[from])
      .filter((p): p is Place => Boolean(p) && places.includes(p!)),
    expected: String(sum),
    itemCount: sum,
  };
};

export const promptFor = (q: ColumnQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum));
  if (filled) return filled;
  return q.mode === "cascade"
    ? `${q.a} plus ${q.b}. Two columns carry — write each one down.`
    : `${q.a} plus ${q.b}. Add each column, and write the carry.`;
};

export function columnHints(
  q: ColumnQuestion,
  state: { digits: Record<string, string>; carries: Record<string, string>; kidTip?: string },
): string[] {
  const da = digitsOf(q.a);
  const db = digitsOf(q.b);
  const onesSum = da.ones + db.ones;
  const missingCarry = q.carryInto.find((p) => (state.carries[p] ?? "") === "");
  const filled = q.places.filter((p) => (state.digits[p] ?? "") !== "").length;

  return composeHints(
    state.kidTip ?? "Start at the ones. When a column makes ten or more, write the carry above the next one.",
    filled === 0
      ? `Start on the right: ${da.ones} and ${db.ones} is ${onesSum}. ${
          onesSum >= 10
            ? `That is more than nine, so write the ${onesSum % 10} underneath and carry the one.`
            : `Write it underneath.`
        }`
      : missingCarry
        ? `A column made ten or more, so it has a carry to go above the ${missingCarry}. Write the small one in before you add that column.`
        : `Keep going left. Remember to add the carry into the column as well as the two digits.`,
    `${q.a} and ${q.b} is ${q.sum}.`,
  );
}

/** One small box. A box nobody can type in is not rendered as one. */
const Cell: React.FC<{
  value: string;
  onChange(v: string): void;
  label: string;
  disabled: boolean;
  carry?: boolean;
}> = ({ value, onChange, label, disabled, carry }) => (
  <input
    inputMode="numeric"
    pattern="[0-9]*"
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 1))}
    disabled={disabled}
    aria-label={label}
    className={themeSystem.field(
      carry ? "sm" : "lg",
      carry
        ? `w-9 h-9 text-center text-base font-black tabular-nums ${CHANGE.text}`
        : "w-12 sm:w-14 text-center text-3xl font-black tabular-nums",
    )}
  />
);

export const ColumnPad: React.FC<ActivityProps<ColumnPadParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: ColumnSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());
  const nudge = useNudge(koda);

  const [digits, setDigits] = useState<Record<string, string>>({});
  const [carries, setCarries] = useState<Record<string, string>>({});
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
    totalQuestions,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback(
      (index: number) => buildQuestion(setup, index, seen.current),
      [params],
    ),
    onComplete: (result) => {
      void koda.progress.nextStep().then((r) => setNextStep(r ?? undefined));
      onComplete(result);
    },
  });

  const question = round.question as ColumnQuestion;

  /**
   * Report an answer.
   *
   * In practice the verdict stands on its own — a child working unaided is not
   * being walked through what happened, and an explanation after every question
   * would put the scaffolding back one sentence at a time.
   */
  const submit = (outcome: Parameters<typeof round.submit>[0]) =>
    round.submit(practising ? { ...outcome, message: undefined } : outcome);

  useEffect(() => {
    setDigits({});
    setCarries({});
    nudge.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };

  const check = () => {
    if (round.feedback) return;

    const emptyDigit = question.places.find((p) => (digits[p] ?? "") === "");
    if (emptyDigit) {
      nudge.refuse("Every column needs an answer underneath it.");
      return;
    }

    /*
     * The carry is part of the method, not decoration.
     *
     * A child who added the ones correctly and kept the ten in their head has
     * the right sum and has skipped the step this lesson is about — so they are
     * asked for it rather than marked wrong for a total that was never taken.
     */
    const emptyCarry = question.carryInto.find((p) => (carries[p] ?? "") === "");
    if (emptyCarry) {
      nudge.refuse(
        `One column made ten or more. Write its carry in the small box above the ${emptyCarry}.`,
      );
      return;
    }

    const given = question.places.map((p) => digits[p] ?? "").join("");
    const wanted = question.answerDigits.join("");
    const carriesRight = question.carryInto.every((p) => carries[p] === "1");
    const correct = given === wanted && carriesRight;

    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();

    // Right digits in the wrong columns is the mistake this layout exists to
    // expose, so it is reported as one rather than as a generic miss.
    const shuffledDigits =
      given !== wanted && given.split("").sort().join("") === wanted.split("").sort().join("");

    submit({
      correct,
      given,
      // A right digit in the wrong column is the mistake this layout exists to
      // expose; everything else here is a miscount, carry included.
      errorKind: correct ? undefined : shuffledDigits ? "place_value" : "off_by_more",
      title: correct ? "Every column, and every carry!" : "Check the columns",
      message: correct
        ? `${question.a} and ${question.b} is ${question.sum}.`
        : shuffledDigits
          ? "The right digits, in the wrong columns."
          : !carriesRight
            ? "A carry is wrong. A column that reaches ten carries exactly one."
            : `${question.a} and ${question.b} is ${question.sum}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const cols = question.places;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Column Add"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="layers"
      iconTone="indigo"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message}
      hints={practising ? [] : columnHints(question, { digits, carries, kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={
        practising
          ? undefined
          : () => {
            round.useSupport("audio_replay");
            void koda.speech.say(prompt, speechRate(koda));
            }
      }
      recommendation={nextStep}
    >
      <div className="space-y-4">
        <div className={`${SCENE} p-5 sm:p-7 flex justify-center overflow-x-auto`}>
          <div
            className="grid gap-x-1.5 sm:gap-x-2.5 gap-y-1 items-center"
            style={{ gridTemplateColumns: `2rem repeat(${cols.length}, auto)` }}
          >
            {/* Carry row. Only the columns that receive one get a box. */}
            <span />
            {cols.map((p) => (
              <div key={`carry-${p}`} className="flex justify-center h-10">
                {question.carryInto.includes(p) ? (
                  <Cell
                    carry
                    value={carries[p] ?? ""}
                    onChange={(v) => setCarries((prev) => ({ ...prev, [p]: v }))}
                    label={`Carry into ${p}`}
                    disabled={Boolean(round.feedback)}
                  />
                ) : null}
              </div>
            ))}

            <span className="text-sm font-bold uppercase tracking-wide text-ink/40 text-right pr-1">
              {cols.map((p) => HEADING[p]).join("")}
            </span>
            {cols.map((p) => (
              <span key={`head-${p}`} className="text-center text-xs font-black uppercase text-ink/40">
                {HEADING[p]}
              </span>
            ))}

            <span />
            {cols.map((p) => (
              <span
                key={`a-${p}`}
                className={`text-center text-3xl font-black tabular-nums ${ADDEND_A.text}`}
              >
                {digitIn(question.a, p)}
              </span>
            ))}

            <span className="text-3xl font-black text-ink/40 text-right pr-1">+</span>
            {cols.map((p) => (
              <span
                key={`b-${p}`}
                className={`text-center text-3xl font-black tabular-nums ${ADDEND_B.text}`}
              >
                {digitIn(question.b, p)}
              </span>
            ))}

            <span
              className="border-t-4 border-ink/30 my-1"
              style={{ gridColumn: `1 / span ${cols.length + 1}` }}
            />

            <span />
            {cols.map((p) => (
              <div key={`ans-${p}`} className="flex justify-center">
                <Cell
                  value={digits[p] ?? ""}
                  onChange={(v) => setDigits((prev) => ({ ...prev, [p]: v }))}
                  label={`Answer, ${p}`}
                  disabled={Boolean(round.feedback)}
                />
              </div>
            ))}
          </div>
        </div>

        {scaffold && (
          <p className="text-center text-xs font-semibold text-ink/50">
            Start at the right. A column that reaches ten carries one to the next.
          </p>
        )}

        <div className="flex justify-center">
          <motion.button
            type="button"
            onClick={check}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            transition={SPRING.tap}
            className={themeSystem.button("primary", "lg")}
          >
            Check
          </motion.button>
        </div>
      </div>
    </SkillRound>
  );
};
