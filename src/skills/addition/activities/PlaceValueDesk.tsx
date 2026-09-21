import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps , PrintedQuestion } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  useSkillRound,
  type RoundQuestion,
  playChrome,
  guideSetup,
  useGuide,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { ADDEND_A, ADDEND_B, TOTAL } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import { isPractice, modeAt, type PracticeSetup } from "../../kit";
import {
  digitsOf,
  drawPair,
  pairKey,
  withoutRepeat,
  type PairSpec,
} from "../internal/data/additionNumbers";

/**
 * The chart, where a number is written down one column at a time.
 *
 * Blocks show what a number *is*; the chart is where a child starts writing it
 * — and every written strategy in this skill is a different way of using these
 * columns. Adding them straight down, spelling each number out as hundreds plus
 * tens plus ones, adding a column at a time and keeping the partials, or
 * working left to right and adjusting. Same grid, different order of work.
 *
 * Typed rather than tapped, because writing the digit in the right column *is*
 * the skill: an interface that placed it for the child would be teaching
 * something else.
 */

export type DeskMode = "chart_add" | "chart_three" | "expanded" | "partial_sums" | "left_right";
export type Place = "hundreds" | "tens" | "ones";

export interface DeskSetup extends PracticeSetup {
  mode?: DeskMode;
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface PlaceValueDeskParams extends DeskSetup {
  question?: DeskSetup;
}

/** One cell: a number the child reads, or a box they fill. */
export interface DeskCell {
  value?: number;
  blank?: string;
  /** Shown instead of a plain number — "300" in expanded form, "+" in a gap. */
  text?: string;
}

export interface DeskRow {
  label: string;
  cells: DeskCell[];
  /** Drawn with a rule above it: this row is a total. */
  total?: boolean;
  /**
   * One box across the whole chart, rather than one box per column.
   *
   * A running total is a *number*, not a digit in a place. Left to right drew
   * it as a single box sitting in the first cell — which, on a chart that grows
   * a hundreds column when the total needs one, put a box wanting "105" under
   * the heading "H", with a screen reader calling it "After +40, Hundreds".
   * Every other row in this engine is one digit per column, so the one row that
   * is not has to look different rather than look like a wrong digit.
   */
  span?: boolean;
}

export interface DeskQuestion extends RoundQuestion {
  mode: DeskMode;
  a: number;
  b: number;
  sum: number;
  /** Column headings, left to right. */
  places: Place[];
  rows: DeskRow[];
  blanks: string[];
  answers: number[];
}

const DEFAULT_SPEC: Record<DeskMode, PairSpec> = {
  chart_add: { addendRange: [11, 88], regroup: "never" },
  chart_three: { addendRange: [111, 888], regroup: "never" },
  expanded: { addendRange: [111, 888], regroup: "never" },
  // The first two modes that allow a carry. A silently non-regrouping
  // partial-sums lesson teaches nothing and looks completely fine.
  partial_sums: { addendRange: [11, 89], regroup: "ones" },
  left_right: { addendRange: [11, 89], regroup: "ones" },
};

const declared = (setup: DeskSetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: DeskMode, setup: DeskSetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  if (mode === "chart_add" || mode === "chart_three" || mode === "expanded") {
    spec.regroup = "never";
  }
  if (mode === "partial_sums" || mode === "left_right") spec.regroup = "ones";
  return spec;
};

const digitsFor = (n: number, places: Place[]): number[] => {
  const d = digitsOf(n);
  return places.map((p) => d[p]);
};

export const buildQuestion = (
  setup: DeskSetup,
  index: number,
  seen: Set<string>,
): DeskQuestion => {
  const mode = modeAt<DeskMode>(setup, index, "chart_add");
  const { a, b, sum } = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `desk_${mode}`, mode, a, b, sum };
  const threeDigit = mode === "chart_three" || mode === "expanded";
  const places: Place[] = threeDigit ? ["hundreds", "tens", "ones"] : ["tens", "ones"];

  if (mode === "expanded") {
    // Each number spelled out as the values it is made of, then totalled.
    const da = digitsOf(a);
    const db = digitsOf(b);
    return {
      ...base,
      places,
      rows: [
        {
          label: String(a),
          cells: [
            { text: String(da.hundreds * 100) },
            { text: String(da.tens * 10) },
            { text: String(da.ones) },
          ],
        },
        {
          label: String(b),
          cells: [
            { text: String(db.hundreds * 100) },
            { text: String(db.tens * 10) },
            { text: String(db.ones) },
          ],
        },
        {
          label: "Add each column",
          total: true,
          cells: [{ blank: "h" }, { blank: "t" }, { blank: "o" }],
        },
      ],
      blanks: ["h", "t", "o"],
      answers: [
        (da.hundreds + db.hundreds) * 100,
        (da.tens + db.tens) * 10,
        da.ones + db.ones,
      ],
      expected: `${(da.hundreds + db.hundreds) * 100},${(da.tens + db.tens) * 10},${da.ones + db.ones}`,
      itemCount: sum,
    };
  }

  const da = digitsOf(a);
  const db = digitsOf(b);
  const tensPart = (da.tens + db.tens) * 10;
  const onesPart = da.ones + db.ones;

  if (mode === "partial_sums") {
    /*
     * Each column worked out on its own and *kept*, then put together at the
     * end. Nothing is carried; the partials do that job in the open.
     *
     * Two tens columns that make ten tens is the whole point of the lesson, so
     * the total needs somewhere to put the hundred: 52 and 88 gives partials of
     * 130 and 10, and an Altogether row of only T and O cannot hold 140. The
     * hundreds column is drawn when the sum reaches one, and left off when it
     * does not — an empty H column on a two-digit total invites a child to
     * write a 0 in front of their answer.
     */
    const ds = digitsOf(sum);
    const hundred = sum >= 100;
    /** Keeps the addends and partials under T and O when H is drawn. */
    const lead: DeskCell[] = hundred ? [{ text: "" }] : [];
    const answers = hundred
      ? [tensPart, onesPart, ds.hundreds, ds.tens, ds.ones]
      : [tensPart, onesPart, ds.tens, ds.ones];

    return {
      ...base,
      places: hundred ? ["hundreds", "tens", "ones"] : places,
      rows: [
        { label: String(a), cells: [...lead, ...digitsFor(a, places).map((value) => ({ value }))] },
        { label: String(b), cells: [...lead, ...digitsFor(b, places).map((value) => ({ value }))] },
        { label: "Tens", total: true, cells: [...lead, { blank: "tens" }, { text: "" }] },
        { label: "Ones", cells: [...lead, { text: "" }, { blank: "ones" }] },
        {
          label: "Altogether",
          total: true,
          cells: hundred
            ? [{ blank: "sum-h" }, { blank: "sum-t" }, { blank: "sum-o" }]
            : [{ blank: "sum-t" }, { blank: "sum-o" }],
        },
      ],
      blanks: hundred
        ? ["tens", "ones", "sum-h", "sum-t", "sum-o"]
        : ["tens", "ones", "sum-t", "sum-o"],
      answers,
      expected: answers.join(","),
      itemCount: sum,
    };
  }

  if (mode === "left_right") {
    /*
     * One number that grows, rather than partials that are added up at the end.
     *
     * That is the whole difference from partial sums, and it is the lesson: you
     * start with the biggest column, and every column after it *adjusts* the
     * number you are already holding. Written with the same rows as partial
     * sums it was the same exercise under a different name — which it was, until
     * the lesson for it came to be written.
     */
    /*
     * The running total starts at the first number, not at zero.
     *
     * It used to start at zero, so the first box wanted `(1+2)*10` — thirty —
     * for 15 plus 28. Thirty is not a total anybody is holding: it is partial
     * sums' tens line, which is the *previous* lesson and a prerequisite of
     * this one. So the first box rewarded the wrong method, confirmed it, and
     * only the second box objected — by which point the child had written 13
     * and been told to "check the columns". Reported from a real session, and
     * the same confusion a comment below already records somebody trying to fix
     * by renaming the rows. Renaming cannot fix it: while the first step is
     * numerically identical under both methods, nothing on screen can tell them
     * apart.
     *
     * Holding 15 and adding the tens gives 35, which partial sums never writes.
     * The two methods now diverge at the first box, and this one finally
     * matches its own title, its concept line and the pedagogy note under it:
     * one number that grows.
     */
    const afterTens = a + db.tens * 10;

    /*
     * A tens column that makes ten tens needs somewhere to put the hundred.
     *
     * 57 and 88: you hold 137, then 145 — and the addend rows were being drawn
     * under a two-column header while the running total ran past it. Partial
     * sums already had this fix and this mode never got it, which is what a
     * mode written by copying half of its neighbour looks like a year later.
     */
    const hundred = sum >= 100;
    /** Keeps the addends under T and O when H is drawn. */
    const lead: DeskCell[] = hundred ? [{ text: "" }] : [];
    /** And keeps the running rows the same width as the header. */
    const tail: DeskCell[] = hundred ? [{ text: "" }, { text: "" }] : [{ text: "" }];

    return {
      ...base,
      places: hundred ? ["hundreds", "tens", "ones"] : places,
      rows: [
        { label: String(a), cells: [...lead, ...digitsFor(a, places).map((value) => ({ value }))] },
        { label: String(b), cells: [...lead, ...digitsFor(b, places).map((value) => ({ value }))] },
        /*
         * Both rows hold a running total, and the labels have to say so.
         *
         * They used to read "Tens first" and "Then the ones", which name what
         * you *add* at each step rather than what you are left holding — so a
         * child on the second row wrote the ones they had just added (11) into
         * a box that wanted the total after adding them (61). The label and the
         * expected answer were describing two different numbers, and the child
         * was right about the one the label named.
         */
        /*
         * The labels name the amount, because "the tens" does not.
         *
         * "After the tens" reads two ways — after adding the other number's
         * tens, or after adding both tens columns together — and a child
         * arriving from partial sums reads it the second way, writes 130 for
         * 77 plus 67, and is marked wrong. Naming the step it has just taken
         * ("After +60") cannot be read the other way. It gives away no answer:
         * splitting 67 into 60 and 7 *is* the technique, and the arithmetic —
         * 77 and 60 — is still the child's to do.
         */
        { label: `After +${db.tens * 10}`, total: true, span: true, cells: [{ blank: "run-1" }] },
        { label: `After +${db.ones}`, total: true, span: true, cells: [{ blank: "run-2" }] },
      ],
      blanks: ["run-1", "run-2"],
      answers: [afterTens, sum],
      expected: `${afterTens},${sum}`,
      itemCount: sum,
    };
  }

  // chart_add and chart_three: write the two numbers in their columns, then the
  // total underneath, one column at a time.
  const answers = digitsFor(sum, places);
  const blanks = places.map((p) => p[0]);
  return {
    ...base,
    places,
    rows: [
      { label: String(a), cells: digitsFor(a, places).map((value) => ({ value })) },
      { label: String(b), cells: digitsFor(b, places).map((value) => ({ value })) },
      { label: "Total", total: true, cells: blanks.map((blank) => ({ blank })) },
    ],
    blanks,
    answers,
    expected: answers.join(","),
    itemCount: sum,
  };
};

export const promptFor = (q: DeskQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum));
  if (filled) return filled;

  switch (q.mode) {
    case "expanded":
      return `${q.a} plus ${q.b}, written out in hundreds, tens and ones.`;
    case "partial_sums":
      return `${q.a} plus ${q.b}. Add the tens, add the ones, then put them together.`;
    case "left_right":
      return `${q.a} plus ${q.b}. Start with the biggest column and work right.`;
    default:
      return `${q.a} plus ${q.b}. Fill in the total, one column at a time.`;
  }
};


/**
 * On paper.
 *
 * The grid is the round's scaffolding; on a sheet the child writes the columns
 * out themselves, so the printed answer is the total rather than the round's
 * per-column `expected`. The instruction keeps the route — adding column by
 * column and adding left to right are different lessons about the same sum.
 */
export const printedFor = (q: DeskQuestion): PrintedQuestion => {
  const answer = String(q.sum);
  switch (q.mode) {
    case "expanded":
      return { text: `${q.a} + ${q.b}. Write each number out in hundreds, tens and ones, then add.`, answer };
    case "partial_sums":
      return { text: `${q.a} + ${q.b}. Add the tens, add the ones, then put them together.`, answer };
    case "left_right":
      return { text: `${q.a} + ${q.b}. Start with the biggest column and work right.`, answer };
    default:
      return { text: `${q.a} + ${q.b}. Add one column at a time.`, answer };
  }
};

/**
 * How this technique goes, for a sheet that has to teach it.
 *
 * Written for paper: no control is named, nothing is tapped, and each line is
 * something a child could do with a pencil or in their head. See `method` on
 * `WorksheetSource` for why this is not the lesson's own `stepByStep`.
 */
export const methodFor = (q: DeskQuestion): string[] => {
  switch (q.mode) {
    case "expanded":
      return [
        "Write each number as hundreds, tens and ones.",
        "Add each place on its own.",
        "Put the places back together.",
      ];
    case "partial_sums":
      return [
        "Add the tens and write that answer down.",
        "Add the ones and write that one down too.",
        "Add your two answers for the total.",
      ];
    case "left_right":
      return [
        "Start with the biggest place and work right.",
        "Keep a running total, adjusting it as you go.",
      ];
    default:
      return ["Line the numbers up by place.", "Add one column at a time, ones first."];
  }
};


/**
 * The chart, drawn for a pencil.
 *
 * The grid is the technique: what it teaches is that a column of ones and a
 * column of tens are added separately and never mixed. Printed without it, the
 * child sets the sum out however they like and the lesson has not happened.
 * Headed to whatever places the numbers actually use, so a two-digit lesson does
 * not print an empty hundreds column to confuse things.
 */
export const figureFor = (q: DeskQuestion): React.ReactNode => {
  const width = Math.max(String(q.a).length, String(q.b).length, String(q.sum).length);
  const heads = ["H", "T", "O"].slice(-width);
  const cells = (n?: number) => {
    const digits = n === undefined ? [] : String(n).split("");
    return Array.from({ length: width }, (_, i) => digits[digits.length - width + i] ?? "");
  };

  const Row: React.FC<{ label: string; values: string[]; head?: boolean }> = ({
    label,
    values,
    head,
  }) => (
    <tr>
      <td className="pr-1 text-right text-[13px]">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`h-7 w-9 border border-slate-900 text-center text-[15px] tabular-nums ${
            head ? "text-[11px] font-black text-slate-500" : "font-bold"
          }`}
        >
          {v}
        </td>
      ))}
    </tr>
  );

  return (
    <table className="border-collapse">
      <tbody>
        <Row label="" values={heads} head />
        <Row label="" values={cells(q.a)} />
        <Row label="+" values={cells(q.b)} />
        <Row label="" values={Array.from({ length: width }, () => "")} />
      </tbody>
    </table>
  );
};

export function deskHints(
  q: DeskQuestion,
  state: { entries: Record<string, string>; kidTip?: string },
): string[] {
  const empty = q.blanks.filter((id) => (state.entries[id] ?? "") === "").length;
  const da = digitsOf(q.a);
  const db = digitsOf(q.b);

  if (q.mode === "partial_sums") {
    return composeHints(
      state.kidTip ?? "Add one column at a time, and keep each answer before putting them together.",
      empty > 2
        ? `Tens first: ${da.tens * 10} and ${db.tens * 10}. Write that on the Tens row.`
        : `You have both parts. Put them together for the last row.`,
      `${da.tens * 10} and ${db.tens * 10} is ${(da.tens + db.tens) * 10}. ${da.ones} and ${db.ones} is ${da.ones + db.ones}. Together that is ${q.sum}.`,
    );
  }

  if (q.mode === "left_right") {
    // The number in your head, which starts as the first addend — see
    // `buildQuestion` for why it is not the sum of the tens column.
    const afterTens = q.a + db.tens * 10;
    return composeHints(
      state.kidTip ?? "Hold the first number. Each column after it adjusts what you hold.",
      empty > 1
        ? `Hold ${q.a}. Add the tens of ${q.b}, which is ${db.tens * 10}.`
        : `You are holding ${afterTens}. Now add the ones, ${db.ones}.`,
      /*
       * "50 and 11 is 61" is partial-sums language: two parts, put together.
       * Here there is one number being adjusted, and the sentence has to keep
       * that shape — otherwise the most helpful rung on the ladder is the one
       * that teaches the other lesson.
       */
      `${q.a} and ${db.tens * 10} is ${afterTens}; ${afterTens} and ${db.ones} is ${q.sum}.`,
    );
  }

  if (q.mode === "expanded") {
    return composeHints(
      state.kidTip ?? "Every number is some hundreds, some tens and some ones.",
      `Add each column on its own: the hundreds with the hundreds, the tens with the tens.`,
      `${da.hundreds * 100} and ${db.hundreds * 100} is ${(da.hundreds + db.hundreds) * 100}; ${da.tens * 10} and ${db.tens * 10} is ${(da.tens + db.tens) * 10}; ${da.ones} and ${db.ones} is ${da.ones + db.ones}.`,
    );
  }

  return composeHints(
    state.kidTip ?? "Add each column on its own. Ones with ones, tens with tens.",
    empty === q.blanks.length
      ? `Start with the ones column on the right: ${da.ones} and ${db.ones}.`
      : `${empty} ${empty === 1 ? "column is" : "columns are"} still empty. Add the digits that sit above each one.`,
    `Ones: ${da.ones} and ${db.ones} is ${da.ones + db.ones}. Tens: ${da.tens} and ${db.tens} is ${da.tens + db.tens}.`,
  );
}

/* -------------------------------------------------------------------------- */
/* The chart                                                                   */
/* -------------------------------------------------------------------------- */

const HEADING: Record<Place, string> = { hundreds: "H", tens: "T", ones: "O" };

export const PlaceValueDesk: React.FC<ActivityProps<PlaceValueDeskParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: DeskSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());

  const [entries, setEntries] = useState<Record<string, string>>({});
  const nudge = useNudge(koda);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
    resumable: practising,
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

  const question = round.question as DeskQuestion;

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
    setEntries({});
    nudge.clear();
  }, [question.id]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    setEntries({});
    nudge.clear();
  };





  const check = () => {
    if (round.feedback) return;
    const missing = question.blanks.filter((id) => (entries[id] ?? "") === "");
    if (missing.length > 0) {
      guide.stumbled();
      nudge.refuse(
        missing.length === question.blanks.length
          ? "Fill in the boxes, then check."
          : `${missing.length} ${missing.length === 1 ? "box is" : "boxes are"} still empty.`,
      );
      return;
    }

    const given = question.blanks.map((id) => entries[id] ?? "");
    const correct = given.join(",") === question.answers.map(String).join(",");
    playChrome(koda, correct ? "success" : "error");
    correct ? koda.haptics.success() : koda.haptics.tap();

    // A digit in the wrong column is the mistake this chart exists to surface,
    // so it is reported as one rather than as a generic slip.
    const rightDigitsWrongOrder =
      given.slice().sort().join(",") === question.answers.map(String).slice().sort().join(",");

    /*
     * The mistake this lesson actually produces, named rather than graded.
     *
     * A child arriving here has just finished partial sums, so the wrong answer
     * is almost never a slip — it is the other method: they write the ones they
     * added rather than the total they are holding. "15 and 28 is 43" is true
     * and tells them nothing about that, so the round said the right answer to
     * somebody who needed to know which question they were answering.
     */
    const wroteThePart =
      question.mode === "left_right" &&
      !correct &&
      given[1] === String(digitsOf(question.a).ones + digitsOf(question.b).ones);

    submit({
      correct,
      given: given.join(","),
      errorKind: correct
        ? undefined
        : rightDigitsWrongOrder
          ? "place_value"
          : wroteThePart
            ? "place_value"
            : "off_by_more",
      title: correct
        ? "Every column is right!"
        : wroteThePart
          ? "That is the part, not the total"
          : "Check the columns",
      message: correct
        ? `${question.a} and ${question.b} is ${question.sum}.`
        : rightDigitsWrongOrder
          ? "The right digits, in the wrong columns. Ones go under ones."
          : wroteThePart
            ? `Add the ones to what you were holding: ${question.answers[0]} and ${digitsOf(question.b).ones}.`
            : `${question.a} and ${question.b} is ${question.sum}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived, rather than two systems with two vocabularies.
   */
  const hints = practising ? [] : deskHints(question, { entries, kidTip: copy.kidTip });
  /*
   * Two different questions, so two different conditions.
   *
   * `guided` is whether Koda steps in *by itself* — the clock and the stumbles
   * — and that is what the parent's switch turns off. Whether the help *looks
   * like* the coach is not a setting at all: the Hint button shows the same
   * bubble, the same rungs and the same "Got it" either way. It used to fall
   * back to the old hint card when the switch was off, so turning off the
   * interruptions also changed what help looked like, and a child had two
   * panels to learn for one ladder.
   */
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* The next empty box, in the order the chart reads. */
    target: question.blanks.findIndex((id) => (entries[id] ?? "") === ""),
    progress: Object.values(entries).filter(Boolean).length,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Place-Value Chart"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="layers"
      iconTone="indigo"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (Object.values(entries).some((v) => v !== "")) ? restart : undefined
      }
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
        <div className={`${SCENE} p-4 sm:p-6 overflow-x-auto`}>
          <table className="mx-auto border-collapse">
            <thead>
              <tr>
                <th className="w-24" />
                {question.places.map((p) => (
                  <th
                    key={p}
                    scope="col"
                    className="px-2 pb-2 text-sm font-black uppercase tracking-wide text-ink/50"
                  >
                    {HEADING[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {question.rows.map((row, r) => (
                <tr key={r} className={row.total ? "border-t-4 border-ink/25" : ""}>
                  <th
                    scope="row"
                    className={`pr-3 py-1.5 text-right text-sm font-bold tabular-nums ${
                      r === 0 ? ADDEND_A.text : r === 1 ? ADDEND_B.text : "text-ink/55"
                    }`}
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell, c) => (
                    <td
                      key={c}
                      colSpan={row.span ? question.places.length : undefined}
                      className="px-1.5 py-1.5"
                    >
                      {cell.blank ? (
                        <input
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={entries[cell.blank] ?? ""}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                            setEntries((prev) => ({ ...prev, [cell.blank!]: digits }));
                          }}
                          disabled={Boolean(round.feedback)}
                          /* A spanning row has no column, so it must not claim
                             one: "After +40, Hundreds" described a box that
                             wants a whole number as a hundreds digit. */
                          aria-label={`${
                            row.span
                              ? question.rows[r].label
                              : `${question.rows[r].label}, ${HEADING[question.places[c]] ?? "column"}`
                          }${question.blanks[guide.target] === cell.blank ? ", fill this one next" : ""}`}
                          className={themeSystem.field(
                            "lg",
                            `w-16 sm:w-20 text-center text-2xl font-black tabular-nums${
                              question.blanks[guide.target] === cell.blank
                                ? " ring-4 ring-indigo-500"
                                : ""
                            }`,
                          )}
                        />
                      ) : (
                        <span className="block w-16 sm:w-20 text-center text-2xl font-black tabular-nums text-ink">
                          {cell.text ?? cell.value ?? ""}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

        <p className={`text-center text-xs font-semibold ${TOTAL.text}`} aria-hidden="true">
          Ones go under ones. Tens go under tens.
        </p>
      </div>
    </SkillRound>
  );
};
