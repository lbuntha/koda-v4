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
import { ADDEND_A, ADDEND_B, TOTAL } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { NudgeLine, useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
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

export interface DeskSetup {
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
  const mode = setup.mode ?? "chart_add";
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
    // Each column worked out on its own and *kept*, then put together at the
    // end. Nothing is carried; the partials do that job in the open.
    return {
      ...base,
      places,
      rows: [
        { label: String(a), cells: digitsFor(a, places).map((value) => ({ value })) },
        { label: String(b), cells: digitsFor(b, places).map((value) => ({ value })) },
        { label: "Tens", total: true, cells: [{ blank: "tens" }, { text: "" }] },
        { label: "Ones", cells: [{ text: "" }, { blank: "ones" }] },
        { label: "Altogether", total: true, cells: [{ blank: "sum-t" }, { blank: "sum-o" }] },
      ],
      blanks: ["tens", "ones", "sum-t", "sum-o"],
      answers: [tensPart, onesPart, digitsOf(sum).tens, digitsOf(sum).ones],
      expected: `${tensPart},${onesPart},${digitsOf(sum).tens},${digitsOf(sum).ones}`,
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
    return {
      ...base,
      places,
      rows: [
        { label: String(a), cells: digitsFor(a, places).map((value) => ({ value })) },
        { label: String(b), cells: digitsFor(b, places).map((value) => ({ value })) },
        { label: "Tens first", total: true, cells: [{ blank: "run-1" }, { text: "" }] },
        { label: "Then the ones", cells: [{ blank: "run-2" }, { text: "" }] },
      ],
      blanks: ["run-1", "run-2"],
      answers: [tensPart, sum],
      expected: `${tensPart},${sum}`,
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
        ? `The tens are ${da.tens * 10} and ${db.tens * 10}. Add those first and write the answer on the Tens row.`
        : `You have both parts. Put them together for the last row.`,
      `${da.tens * 10} and ${db.tens * 10} is ${(da.tens + db.tens) * 10}. ${da.ones} and ${db.ones} is ${da.ones + db.ones}. Together that is ${q.sum}.`,
    );
  }

  if (q.mode === "left_right") {
    const afterTens = (da.tens + db.tens) * 10;
    return composeHints(
      state.kidTip ?? "Start with the biggest column, then let each one after it change the number you are holding.",
      empty > 1
        ? `Start with the tens: ${da.tens * 10} and ${db.tens * 10}. Write what you are holding after that.`
        : `You are holding ${afterTens}. Now add the ones — ${da.ones} and ${db.ones} — to that.`,
      `${afterTens} and ${da.ones + db.ones} is ${q.sum}.`,
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
  const seen = useRef(new Set<string>());

  const [entries, setEntries] = useState<Record<string, string>>({});
  const nudge = useNudge(koda);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
    totalQuestions,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: copy.audioPrompt,
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

  useEffect(() => {
    setEntries({});
    nudge.clear();
  }, [question.id]);


  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };

  const check = () => {
    if (round.feedback) return;
    const missing = question.blanks.filter((id) => (entries[id] ?? "") === "");
    if (missing.length > 0) {
      nudge.refuse(
        missing.length === question.blanks.length
          ? "Fill in the boxes, then check."
          : `${missing.length} ${missing.length === 1 ? "box is" : "boxes are"} still empty.`,
      );
      return;
    }

    const given = question.blanks.map((id) => entries[id] ?? "");
    const correct = given.join(",") === question.answers.map(String).join(",");
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();

    // A digit in the wrong column is the mistake this chart exists to surface,
    // so it is reported as one rather than as a generic slip.
    const rightDigitsWrongOrder =
      given.slice().sort().join(",") === question.answers.map(String).slice().sort().join(",");

    round.submit({
      correct,
      given: given.join(","),
      errorKind: correct ? undefined : rightDigitsWrongOrder ? "place_value" : "off_by_more",
      title: correct ? "Every column is right!" : "Check the columns",
      message: correct
        ? `${question.a} and ${question.b} is ${question.sum}.`
        : rightDigitsWrongOrder
          ? "The right digits, in the wrong columns. Ones go under ones."
          : `${question.a} and ${question.b} is ${question.sum}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);

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
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      hints={deskHints(question, { entries, kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={() => {
        round.useSupport("audio_replay");
        void koda.speech.say(prompt, speechRate(koda));
      }}
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
                    <td key={c} className="px-1.5 py-1.5">
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
                          aria-label={`${question.rows[r].label}, ${HEADING[question.places[c]] ?? "column"}`}
                          className={themeSystem.field(
                            "lg",
                            "w-16 sm:w-20 text-center text-2xl font-black tabular-nums",
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

        <NudgeLine nudge={nudge} />

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
