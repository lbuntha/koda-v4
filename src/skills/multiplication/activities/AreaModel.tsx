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
  drawPartialProduct,
  drawProduct,
  partialProductsOf,
  placeValueSplit,
  shuffle,
  withoutRepeat,
} from "../internal/data/multiplicationNumbers";
import { chime } from "../internal/data/multiplicationSound";
import { speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { GRID_SIZES, SCROLL_BOX, TOUCH_TARGET, densityFor } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";

/**
 * Multiplication as a rectangle, and the rectangle cut into pieces.
 *
 * Four modes on one shape: read the area of a labelled rectangle, cut a
 * two-digit side at its place-value boundary, write the same cut as a column of
 * partial products, and do it again with both sides split into four parts.
 *
 * Three things this engine is careful about, all of them §12:
 *
 * - The rectangle is **not to true scale** — 23 × 46 cannot be at 360px — but
 *   the parts are ordered honestly and none may collapse below a readable
 *   floor. A `20 × 3` piece never renders the same size as a `3 × 3` piece
 *   (trap 10).
 * - Every part carries its own label, always.
 * - The child **places** each partial product in its own cell rather than
 *   typing a total (trap 11). `20 × 40` is eight hundred, and putting eighty
 *   there is the mistake worth catching.
 */

export type AreaMode = "rect_area" | "area_2x1" | "partial_products" | "area_2x2";

interface AreaSetup {
  mode?: AreaMode;
  modes?: string[];
  practice?: boolean;
  sideRange?: [number, number];
  /** How many opening questions of a round still show the unit squares. */
  unitsUntil?: number;
  questionsPerRound?: number;
}

export interface AreaParams extends AreaSetup {
  question?: AreaSetup;
  play?: unknown;
}

export interface AreaPart {
  left: number;
  right: number;
  product: number;
}

export interface AreaQuestion extends RoundQuestion {
  mode: AreaMode;
  a: number;
  b: number;
  product: number;
  /** The place-value pieces of each side, in the order they are drawn. */
  leftParts: number[];
  rightParts: number[];
  /** One per cell of the model, row-major. */
  parts: AreaPart[];
  /** The numbers offered to place into those cells. */
  pool: number[];
  /** `rect_area`: whether the unit squares are still showing. */
  showUnits: boolean;
  choices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The numbers offered to fill the cells.
 *
 * Every right answer, plus one place-value slip for each — the product with its
 * digits shifted a column. That slip *is* the error of a partial-product
 * lesson: a child who writes eighty where eight hundred belongs has done the
 * multiplication and lost the place, which is trap 11 exactly. Offering it is
 * what makes placing the part mean something.
 */
function poolFor(parts: AreaPart[]): number[] {
  /*
   * Distinct values, and a value may be used more than once.
   *
   * `12 × 12` cuts into 10×10, 10×2, 2×10 and 2×2 — and two of those pieces
   * are both twenty. Listing the products straight gave the pool a repeated
   * button (and React two children with the same key). A child placing twenty
   * in two pieces is doing the right thing, so the pool holds one of each and
   * nothing is consumed by being placed.
   */
  const right = [...new Set(parts.map((part) => part.product))];
  const taken = new Set(right);
  const slips: number[] = [];
  for (const product of right) {
    for (const slip of [product / 10, product * 10]) {
      if (slips.length >= parts.length) break;
      if (!Number.isInteger(slip) || slip <= 0 || taken.has(slip)) continue;
      taken.add(slip);
      slips.push(slip);
    }
  }
  return shuffle([...right, ...slips]);
}

export function buildQuestion(params: AreaParams, index: number, seen?: Set<string>): AreaQuestion {
  const setup: AreaSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "rect_area");

  const drawn = (() => {
    if (mode === "rect_area") {
      const draw = () => drawProduct({
        aRange: setup.sideRange ?? [2, 12],
        bRange: setup.sideRange ?? [2, 12],
      });
      return seen ? withoutRepeat(draw, (v) => `${v.a}x${v.b}`, seen) : draw();
    }
    const draw = () => drawPartialProduct({
      digitsA: 2,
      digitsB: mode === "area_2x2" ? 2 : 1,
      // A zero digit collapses the model and hides the structure the lesson is.
      allPartsNonzero: true,
    });
    return seen ? withoutRepeat(draw, (v) => `${v.a}x${v.b}`, seen) : draw();
  })();

  const { a, b, product } = drawn;
  const id = `area-${mode}-${index}-${a}x${b}`;
  const split = mode === "rect_area";
  const leftParts = split ? [a] : placeValueSplit(a);
  const rightParts = split ? [b] : placeValueSplit(b);
  const parts = split ? [] : partialProductsOf(a, b);

  const base: Omit<AreaQuestion, "prompt" | "expected" | "taskKind"> = {
    id, mode, a, b, product, leftParts, rightParts, parts,
    pool: parts.length > 0 ? poolFor(parts) : [],
    /* Concrete first, then the labels alone. The squares are there to be
       counted while the idea is new and gone once it is not. */
    showUnits: mode === "rect_area" && index < (setup.unitsUntil ?? 2),
    choices: split ? answerChoices(product, id, { min: 1, max: 200 }) : [],
    itemCount: product,
  };

  switch (mode) {
    case "area_2x1":
      return {
        ...base,
        taskKind: "area_model_two_by_one",
        prompt: `${a} × ${b}. Fill in each piece of the rectangle.`,
        expected: String(product),
      };
    case "partial_products":
      return {
        ...base,
        taskKind: "record_partial_products",
        prompt: `${a} × ${b}. Write each partial product on its own row.`,
        expected: String(product),
      };
    case "area_2x2":
      return {
        ...base,
        taskKind: "area_model_two_by_two",
        prompt: `${a} × ${b}. Both sides split, so there are four pieces to fill.`,
        expected: String(product),
      };
    case "rect_area":
    default:
      return {
        ...base,
        taskKind: "area_of_a_rectangle",
        prompt: `A rectangle ${a} across and ${b} down. How many squares does it cover?`,
        expected: String(product),
      };
  }
}

export const promptFor = (question: AreaQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

const written = (parts: AreaPart[]): string =>
  parts.map((p) => `${p.left} × ${p.right} = ${p.product}`).join(", ");

export function printedFor(question: AreaQuestion): PrintedQuestion | null {
  const { a, b, product, parts } = question;
  switch (question.mode) {
    case "area_2x1":
    case "area_2x2":
      return {
        text: `${a} × ${b}. Split the rectangle by place value, label every piece, then add them. ${a} × ${b} = ____`,
        answer: `${written(parts)} — total ${product}`,
      };
    case "partial_products":
      return {
        text: `${a} × ${b}. Write out the partial products and total them. ${a} × ${b} = ____`,
        answer: `${written(parts)} — total ${product}`,
      };
    case "rect_area":
    default:
      return {
        text: `A rectangle is ${a} squares across and ${b} squares down. What is its area? ____`,
        answer: String(product),
      };
  }
}

export function methodFor(question: AreaQuestion): string[] | null {
  const { a, b, parts } = question;
  switch (question.mode) {
    case "rect_area":
      return [
        "The area of a rectangle is its width times its height.",
        `${a} across and ${b} down covers ${a} × ${b} squares.`,
      ];
    case "partial_products":
      return [
        `Split ${a} into ${placeValueSplit(a).join(" and ")}.`,
        "Multiply each piece separately and write each answer on its own row.",
        "Add the rows.",
      ];
    default:
      return [
        `Split ${a} into ${placeValueSplit(a).join(" and ")}${
          placeValueSplit(b).length > 1 ? `, and ${b} into ${placeValueSplit(b).join(" and ")}` : ""
        }.`,
        `That makes ${parts.length} rectangles: ${written(parts)}.`,
        "Add every piece together.",
      ];
  }
}

/**
 * The model, drawn for a pencil.
 *
 * The figure is essential here — without it the task changes into a different
 * question (§9) — so the parts are drawn with their labels and their answers
 * left blank. Widths follow the place-value split so the pieces are honestly
 * ordered, with a floor so the small one stays readable.
 */
export function figureFor(question: AreaQuestion): React.ReactNode | null {
  const { leftParts, rightParts } = question;
  if (question.mode === "partial_products") return null;

  const W = 300;
  const H = 120;
  const floor = 44;
  const scale = (values: number[], total: number): number[] => {
    const sum = values.reduce((t, v) => t + v, 0);
    const raw = values.map((v) => (v / sum) * total);
    // Nothing collapses: give every piece a floor, then take it back off the
    // pieces that can spare it (§12 trap 10).
    const short = raw.map((v) => Math.max(floor, v));
    const over = short.reduce((t, v) => t + v, 0) - total;
    const spare = short.filter((v) => v > floor);
    return short.map((v) => (v > floor ? v - over / spare.length : v));
  };

  const widths = scale(leftParts, W);
  const heights = scale(rightParts, H);
  let y = 0;

  return (
    <svg viewBox={`-24 -16 ${W + 32} ${H + 32}`} width="100%" role="img" aria-label="An area model to fill in">
      {rightParts.map((right, r) => {
        const rowY = y;
        y += heights[r];
        let x = 0;
        return (
          <g key={right}>
            <text x={-6} y={rowY + heights[r] / 2 + 4} textAnchor="end" fontSize="11" fill="#334155">{right}</text>
            {leftParts.map((left, c) => {
              const cellX = x;
              x += widths[c];
              return (
                <g key={left}>
                  {r === 0 && (
                    <text x={cellX + widths[c] / 2} y={-4} textAnchor="middle" fontSize="11" fill="#334155">{left}</text>
                  )}
                  <rect
                    x={cellX}
                    y={rowY}
                    width={widths[c] - 2}
                    height={heights[r] - 2}
                    rx="3"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1.2"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  filled: (number | undefined)[];
}

export function areaHints(
  question: AreaQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { a, b, parts } = question;
  const empty = state.filled.filter((v) => v === undefined).length;
  switch (question.mode) {
    case "rect_area":
      return composeHints(
        kidTip,
        `Count along the top, then down the side.`,
        `The area is ${a} rows of ${b} — the two sides multiplied.`,
      );
    case "partial_products":
      return composeHints(
        kidTip,
        empty > 0
          ? `Each row is one piece of ${a} multiplied by ${b}. ${empty} still to write.`
          : `Every row is written. Now add them.`,
        `Split ${a} into ${placeValueSplit(a).join(" and ")}, and multiply each one by ${b}.`,
      );
    default:
      return composeHints(
        kidTip,
        empty > 0
          ? `${empty} piece${empty === 1 ? "" : "s"} still empty. Read the two numbers on that piece's edges.`
          : `Every piece is filled. Check the total.`,
        // Names the structure, never a cell's value.
        `Each piece is its own multiplication, and the ${parts.length} of them add up to the whole rectangle.`,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const AreaModel: React.FC<ActivityProps<AreaParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: AreaSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
  const question = round.question as AreaQuestion;

  /** What has been put in each cell, in the question's own part order. */
  const [filled, setFilled] = useState<(number | undefined)[]>([]);
  /** Which cell the next number from the pool goes into. */
  const [target, setTarget] = useState(0);

  useEffect(() => {
    if (!question) return;
    setFilled(question.parts.map(() => undefined));
    setTarget(0);
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { mode, a, b, parts } = question;
  const reading = mode === "rect_area";
  const filledTotal = filled.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const allFilled = parts.length > 0 && filled.every((v) => v !== undefined);

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  const answerArea = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.product;
    judge(
      correct,
      String(value),
      correct ? "That is the area" : "Not quite",
      `${a} across and ${b} down covers ${a} × ${b} = ${question.product} squares.`,
    );
  };

  /** Put a number from the pool into the cell currently being filled. */
  const place = (value: number) => {
    if (round.feedback) return;
    setFilled((current) => {
      const next = [...current];
      next[target] = value;
      return next;
    });
    // Move on to the next empty cell, so a child never has to aim twice.
    const nextEmpty = filled.findIndex((v, i) => i !== target && v === undefined);
    setTarget(nextEmpty === -1 ? target : nextEmpty);
    nudge.clear();
    chime(koda, "placed");
    if (hapticsEnabled) koda.haptics.tap();
  };

  const clearCell = (index: number) => {
    if (round.feedback) return;
    setFilled((current) => {
      const next = [...current];
      next[index] = undefined;
      return next;
    });
    setTarget(index);
    chime(koda, "undone");
  };

  const checkParts = () => {
    if (round.feedback) return;
    if (!allFilled) {
      const empty = filled.filter((v) => v === undefined).length;
      refuse(
        `${empty} piece${empty === 1 ? " is" : "s are"} still empty. Every piece needs its own answer.`,
        "Fill every piece first.",
      );
      return;
    }
    /* Judged on the total the pieces add up to, and reported piece by piece:
       a child who put eighty where eight hundred belongs has done the
       multiplication and lost the place, and deserves to be told which. */
    const correct = filledTotal === question.product;
    const wrong = parts
      .map((part, i) => ({ part, given: filled[i]! }))
      .filter(({ part, given }) => part.product !== given);
    judge(
      correct,
      String(filledTotal),
      correct ? "Every piece" : "Check the pieces",
      wrong.length > 0
        ? `${wrong[0].part.left} × ${wrong[0].part.right} is ${wrong[0].part.product}, not ${wrong[0].given}.`
        : `${written(parts)}. Together that is ${question.product}.`,
    );
  };

  /* ---- the rectangle ---- */
  const density = densityFor(a, b);
  const grid = GRID_SIZES[density];

  const unitRectangle = (
    <div className={SCROLL_BOX}>
      <div className="mx-auto flex w-fit items-start gap-2">
        <span className={`self-center text-sm font-black tabular-nums ${GROUPS.text}`} aria-hidden="true">{b}</span>
        <div className="flex flex-col items-center gap-1">
          <span className={`text-sm font-black tabular-nums ${EACH.text}`} aria-hidden="true">{a}</span>
          <div role="img" aria-label={`A rectangle ${a} across and ${b} down`} className={`flex flex-col ${grid.gap}`}>
            {Array.from({ length: b }, (_, r) => (
              <div key={r} className={`flex ${grid.gap}`}>
                {Array.from({ length: a }, (_, c) => (
                  <span key={c} aria-hidden="true" className={`${grid.cell} rounded border-2 ${EACH.border} ${EACH.soft}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const plainRectangle = (
    <div className="flex items-start gap-2">
      <span className={`self-center text-base font-black tabular-nums ${GROUPS.text}`}>{b}</span>
      <div className="flex flex-col items-center gap-1">
        <span className={`text-base font-black tabular-nums ${EACH.text}`}>{a}</span>
        <div
          role="img"
          aria-label={`A rectangle ${a} across and ${b} down`}
          className={`h-24 w-56 rounded-xl border-2 ${EACH.border} ${EACH.soft}`}
        />
      </div>
    </div>
  );

  /**
   * The split model.
   *
   * Column and row sizes follow the place-value pieces, so a twenty is wider
   * than a three — but `minmax` gives every piece a floor, so the three never
   * shrinks to a sliver. Honest ordering without a misleading scale.
   */
  const splitModel = (
    <div className={SCROLL_BOX}>
      {/* The model lives in a fixed box.
          `fr` units with nothing to divide up let a `70 × 30` piece grow to
          560 by 336 — honest proportions and far more screen than a phone has.
          Inside a bounded box the same ratios hold and the whole model fits. */}
      <div className="mx-auto w-full max-w-sm">
        {/* The column headings share the grid's own track sizes, so each one
            sits over the piece it names however the pieces are proportioned. */}
        <div
          className="grid gap-1 pl-9"
          style={{ gridTemplateColumns: question.leftParts.map((v) => `minmax(3.5rem, ${v}fr)`).join(" ") }}
        >
          {question.leftParts.map((left) => (
            <span key={left} className={`text-center text-sm font-black tabular-nums ${EACH.text}`}>
              {left}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <div
            className="grid pr-1"
            style={{
              height: question.rightParts.length > 1 ? "11rem" : "5rem",
              gridTemplateRows: question.rightParts.map((v) => `minmax(2.5rem, ${v}fr)`).join(" "),
              gap: "0.25rem",
            }}
          >
            {question.rightParts.map((right) => (
              <span
                key={right}
                className={`flex w-8 items-center justify-end text-sm font-black tabular-nums ${GROUPS.text}`}
              >
                {right}
              </span>
            ))}
          </div>
          <div
            className="grid flex-1 gap-1"
            style={{
              height: question.rightParts.length > 1 ? "11rem" : "5rem",
              gridTemplateColumns: question.leftParts.map((v) => `minmax(3.5rem, ${v}fr)`).join(" "),
              gridTemplateRows: question.rightParts.map((v) => `minmax(2.5rem, ${v}fr)`).join(" "),
            }}
          >
            {parts.map((part, i) => {
              const value = filled[i];
              const isTarget = i === target && value === undefined;
              return (
                <button
                  key={`${part.left}x${part.right}`}
                  type="button"
                  aria-label={
                    value === undefined
                      ? `${part.left} times ${part.right}, empty`
                      : `${part.left} times ${part.right}, holding ${value}`
                  }
                  onClick={() => (value === undefined ? setTarget(i) : clearCell(i))}
                  disabled={!!round.feedback}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    value === undefined
                      ? isTarget
                        ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft}`
                        : `${NEUTRAL.border} bg-surface`
                      : `${PRODUCT.border} ${PRODUCT.soft}`
                  }`}
                >
                  {/* Every piece is labelled, always (§12 trap 10). */}
                  <span className={`text-[10px] font-bold tabular-nums ${NEUTRAL.text} opacity-70`}>
                    {part.left} × {part.right}
                  </span>
                  <span className={`text-lg font-black tabular-nums ${value === undefined ? "opacity-30" : PRODUCT.text}`}>
                    {value ?? "?"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  /** The same cut, written as a column of rows. */
  const columnModel = (
    <div className="flex flex-col items-center gap-1">
      <p className={`text-2xl font-black tabular-nums ${NEUTRAL.text}`}>{a} × {b}</p>
      <div className="flex flex-col gap-1">
        {parts.map((part, i) => {
          const value = filled[i];
          const isTarget = i === target && value === undefined;
          return (
            <button
              key={`${part.left}x${part.right}`}
              type="button"
              aria-label={
                value === undefined
                  ? `${part.left} times ${part.right}, empty`
                  : `${part.left} times ${part.right}, holding ${value}`
              }
              onClick={() => (value === undefined ? setTarget(i) : clearCell(i))}
              disabled={!!round.feedback}
              className={`${TOUCH_TARGET} flex items-center justify-between gap-4 rounded-lg border-2 px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                value === undefined
                  ? isTarget
                    ? `${ADJUSTMENT.border} ${ADJUSTMENT.soft}`
                    : `${NEUTRAL.border} bg-surface`
                  : `${PRODUCT.border} ${PRODUCT.soft}`
              }`}
            >
              <span className={`text-sm font-bold tabular-nums ${NEUTRAL.text}`}>
                {part.left} × {part.right}
              </span>
              <span className={`min-w-12 text-right text-lg font-black tabular-nums ${value === undefined ? "opacity-30" : PRODUCT.text}`}>
                {value ?? "?"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const board = reading
    ? (question.showUnits ? unitRectangle : plainRectangle)
    : mode === "partial_products"
      ? columnModel
      : splitModel;

  const controls = reading ? (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {question.choices.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`${value} squares`}
          onClick={() => answerArea(value)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          {value}
        </button>
      ))}
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {question.pool.map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`Put ${value} in`}
            onClick={() => place(value)}
            disabled={!!round.feedback}
            className={themeSystem.button("secondary", "choice")}
          >
            {value}
          </button>
        ))}
      </div>
      <button type="button" onClick={checkParts} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
        Check
      </button>
    </div>
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Area Model"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : areaHints(question, copy.kidTip, { filled })}
      iconName="boxes"
      iconTone="emerald"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {board}

        {scaffold && !reading && (
          <p className={`text-center text-base font-black tabular-nums ${EACH.text}`} aria-live="polite">
            {allFilled
              ? `${filled.join(" + ")} = ${filledTotal}`
              : `${filled.filter((v) => v !== undefined).length} of ${parts.length} pieces filled`}
          </p>
        )}

        {controls}
      </div>
    </SkillRound>
  );
};
