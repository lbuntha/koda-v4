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
  productDistractors,
  randInt,
  shuffle,
  withoutRepeat,
} from "../internal/data/multiplicationNumbers";
import {
  PARTNER_MAX,
  PARTNER_MIN,
  applyAdjust,
  availableAt,
  factsForStrategy,
  productOf,
  strategiesFor,
  type Adjust,
  type Fact,
  type FactStrategy,
  type HelperFact,
} from "../internal/data/helperFacts";
import { chime } from "../internal/data/multiplicationSound";
import { answerInput, speechRate, tableCeiling, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, HELPER, PRODUCT } from "../internal/data/multiplicationPalette";
import { SCENE, TOUCH_TARGET } from "../internal/data/multiplicationLayout";
import { TimesTableChart } from "../internal/ui/TimesTableChart";
import { useNudge } from "../internal/ui/useNudge";
import { NumberPad } from "../internal/ui/NumberPad";

/**
 * Facts, and the facts that get you to them.
 *
 * Recall is not the lesson — the *relationship* is. A child who knows five
 * eights can have six eights for almost nothing, and the whole point of this
 * deck is that the helper fact is on screen, named, and visibly one move away.
 * A card that only asked "what is 6 × 8?" would be a flashcard, and a flashcard
 * teaches whoever already knew.
 *
 * So naming the helper is a **support**, not a question. The child is not
 * scored for saying ten eights is eighty; they are scored on what they do with
 * it. Reporting it as an answer would put a second answer against a question
 * that has one, and mark a child down for using the strategy being taught.
 *
 * Every derived mode is driven entirely by `helperFacts.ts` — which helper, in
 * which order, and what to do with its product. No mode holds a table of its
 * own and none of them branch on a level number. That is what lets Phase 6's
 * nine derived-fact lessons ship as JSON rather than as nine components.
 */

export type FactMode =
  | "doubles"
  | "tens"
  | "fives"
  | "double_double"
  | "triple_double"
  | "add_a_group"
  | "subtract_a_group"
  | "break_apart"
  | "near_square"
  | "known_fact";

/** The modes that read a row out of the ladder. `known_fact` picks its own. */
const STRATEGY_OF: Partial<Record<FactMode, FactStrategy>> = {
  fives: "fives",
  double_double: "double_double",
  triple_double: "triple_double",
  add_a_group: "add_a_group",
  subtract_a_group: "subtract_a_group",
  break_apart: "break_apart",
  near_square: "near_square",
};

interface FactSetup {
  mode?: FactMode;
  modes?: string[];
  practice?: boolean;
  /**
   * Which tables within the strategy this lesson drills.
   *
   * `add_a_group` derives both the threes (from the twos) and the sixes (from
   * the fives); `break_apart` derives the sevens, the elevens and the twelves.
   * Level 26 wants the threes and level 27 the sixes, so the lesson names its
   * driving factor here rather than the engine asking which level it is.
   */
  drivers?: number[];
  /** The partner range each table is drilled across. */
  partnerRange?: [number, number];
  /** What `known_fact` may assume the child already holds. */
  level?: number;
  questionsPerRound?: number;
}

export interface FactDeckParams extends FactSetup {
  question?: FactSetup;
  play?: unknown;
}

export interface ShownFact {
  a: number;
  b: number;
  product: number;
}

export interface FactQuestion extends RoundQuestion {
  mode: FactMode;
  a: number;
  b: number;
  product: number;
  /** The table this fact belongs to, and the partner it is drilled against. */
  driver: number;
  partner: number;
  /** The helper chain, in the order the card shows it. Empty for the two known outright. */
  helpers: ShownFact[];
  /** What to do with the helper products, in words a child can act on. */
  adjustment: string;
  /** `known_fact`: four true facts, exactly one of which helps. */
  candidates: (ShownFact & { helps: boolean })[];
  choices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const shown = ([a, b]: Fact): ShownFact => ({ a, b, product: a * b });

/** Order-free identity: `3 × 4` and `4 × 3` are one fact. */
const key = (a: number, b: number): string => (a <= b ? `${a}x${b}` : `${b}x${a}`);

/**
 * The move, in words a child can carry out.
 *
 * Read off the ladder's own `adjust` rather than written per mode, so a
 * strategy that changes its adjustment cannot leave its wording behind.
 */
export const adjustmentWords = (adjust: Adjust): string => {
  switch (adjust.kind) {
    case "double":
      return "Now double it.";
    case "halve":
      return "Now halve it.";
    case "add_group":
      return `Now add one more ${adjust.of}.`;
    case "subtract_group":
      return `Now take one ${adjust.of} away.`;
    case "sum":
      return "Now add them together.";
  }
};

/**
 * Every row this lesson may draw from.
 *
 * An empty result is an authoring error and throws rather than quietly
 * widening: a lesson that asked for the sevens out of `double_double` has a
 * mistake in it, and silently handing back the fours would hide it.
 */
export function rowsFor(strategy: FactStrategy, setup: FactSetup): HelperFact[] {
  const [lo, hi] = setup.partnerRange ?? [PARTNER_MIN, PARTNER_MAX];
  const rows = factsForStrategy(strategy).filter((row) => {
    if (setup.drivers && !setup.drivers.includes(row.target[0])) return false;
    const partner = row.target[1];
    return partner >= lo && partner <= hi;
  });
  if (rows.length === 0) {
    throw new Error(
      `multiplication FactDeck: no ${strategy} fact has a driver in ${JSON.stringify(setup.drivers ?? "any")} and a partner in ${lo}–${hi}`,
    );
  }
  return rows;
}

/**
 * Four candidate helpers, exactly one of which is worth choosing.
 *
 * The other three are *true* facts — an obviously silly option would let a
 * child choose correctly without thinking about which fact helps. None of them
 * derives the target, and none shares its product, so neither route nor
 * arithmetic can pick one by accident.
 */
function candidatesFor(target: Fact, helper: Fact): (ShownFact & { helps: boolean })[] {
  const product = productOf(target);
  const helping = new Set<string>();
  for (const row of strategiesFor(target)) {
    for (const [a, b] of row.helpers) helping.add(key(a, b));
  }
  helping.add(key(target[0], target[1]));

  const taken = new Set<string>([key(helper[0], helper[1])]);
  const others: ShownFact[] = [];
  for (let i = 0; i < 400 && others.length < 3; i += 1) {
    const a = randInt(PARTNER_MIN, PARTNER_MAX);
    const b = randInt(PARTNER_MIN, PARTNER_MAX);
    const id = key(a, b);
    if (helping.has(id) || taken.has(id) || a * b === product) continue;
    taken.add(id);
    others.push({ a, b, product: a * b });
  }
  // A deterministic sweep, for the rare target whose neighbourhood is crowded.
  for (let a = PARTNER_MIN; a <= PARTNER_MAX && others.length < 3; a += 1) {
    for (let b = a; b <= PARTNER_MAX && others.length < 3; b += 1) {
      const id = key(a, b);
      if (helping.has(id) || taken.has(id) || a * b === product) continue;
      taken.add(id);
      others.push({ a, b, product: a * b });
    }
  }
  return shuffle([
    { ...shown(helper), helps: true },
    ...others.map((fact) => ({ ...fact, helps: false })),
  ]);
}

/**
 * Wrong answers this strategy actually produces.
 *
 * The helper's own product is offered *every* time, not sometimes. Stopping at
 * the helper and forgetting the adjustment is **the** error of a derived-fact
 * lesson, and a child who makes it should be told what they answered rather
 * than marked wrong against a number they never considered — which cannot
 * happen if the number is only on the table when a shuffle puts it there.
 *
 * `productDistractors` already treats the helper as one candidate among ten and
 * picks three at random, so it offers it about a third of the time. Forcing it
 * in costs a mild tell — a child may learn one option is never the answer — and
 * a child who can pick the helper's product out of four has already done the
 * strategy's first step. Naming the error is worth more.
 *
 * Never `± 1` (§12 trap 13): a choice list built that way lets near squares,
 * added groups and subtracted groups be solved by arithmetic on the options.
 */
const choicesFor = (a: number, b: number, helperProduct?: number): number[] => {
  const product = a * b;
  const wrong = productDistractors({ a, b, product }, 3, helperProduct);
  const wanted = helperProduct !== undefined
    && helperProduct > 0
    && helperProduct !== product
    && Math.abs(helperProduct - product) !== 1
    && !wrong.includes(helperProduct);
  if (wanted) wrong[randInt(0, wrong.length - 1)] = helperProduct;
  return shuffle([product, ...wrong]);
};

export function buildQuestion(params: FactDeckParams, index: number, seen?: Set<string>): FactQuestion {
  const setup: FactSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "doubles");
  const [lo, hi] = setup.partnerRange ?? [PARTNER_MIN, PARTNER_MAX];

  const drawn = (() => {
    /* The two known outright. Neither has a helper, because neither is derived —
       and `tens` must never be presented as "add a zero" (§12 trap 5). */
    if (mode === "doubles" || mode === "tens") {
      const driver = mode === "doubles" ? 2 : 10;
      /*
       * `n × 10`, never `10 × n`.
       *
       * The master table says `10 × n`, but it was written before decision 4
       * fixed `a × b` to mean *a groups of b*. Under that convention `10 × 2`
       * is ten twos, and the model this lesson needs — two sticks of ten — is
       * `2 × 10`. Drawing the place-value picture under the other sentence is
       * §12 trap 2 happening in the one lesson whose whole content is which
       * number counts what.
       */
      const tensOrder = (partner: number): Fact => [partner, 10];
      /*
       * The drill starts at two even where a lesson asks for one.
       *
       * `1 × 2` is the identity, which has its own lesson at level 6 — and its
       * product is too small to carry four distinct options that are not the
       * answer plus or minus one, so `productDistractors` refuses it and is
       * right to. Clamping here rather than letting the round throw, because a
       * lesson asking for the easiest double is not an authoring mistake.
       */
      const floor = Math.max(lo, PARTNER_MIN);
      const draw = (): Fact => {
        const partner = randInt(floor, hi);
        if (mode === "tens") return tensOrder(partner);
        // Doubles keep both orders, per the master table: two sevens and seven
        // twos are the same product read from opposite ends, and a child should
        // meet both. The picture follows the sentence either way.
        return randInt(0, 1) === 0 ? [driver, partner] : [partner, driver];
      };
      const target = seen ? withoutRepeat(draw, (f) => `${f[0]}x${f[1]}`, seen) : draw();
      return { target, helpers: [] as Fact[], adjust: undefined, driver, candidates: [] };
    }

    if (mode === "known_fact") {
      const level = setup.level ?? 32;
      const draw = (): HelperFact => {
        for (let i = 0; i < 200; i += 1) {
          const fact: Fact = [randInt(lo, hi), randInt(lo, hi)];
          const routes = availableAt(fact, level);
          if (routes.length > 0) return routes[randInt(0, routes.length - 1)];
        }
        // Every table from the threes up is derivable, so this is unreachable
        // for any sane range — but a range of nothing but twos would find no
        // route, and an authoring error should say so rather than hang.
        const fallback = availableAt([6, 8], level);
        if (fallback.length === 0) {
          throw new Error(`multiplication FactDeck: no fact in ${lo}–${hi} can be derived by level ${level}`);
        }
        return fallback[0];
      };
      const row = seen ? withoutRepeat(draw, (r) => key(r.target[0], r.target[1]), seen) : draw();
      return {
        target: row.target,
        helpers: row.helpers,
        adjust: row.adjust,
        driver: row.target[0],
        candidates: candidatesFor(row.target, row.helpers[0]),
      };
    }

    const rows = rowsFor(STRATEGY_OF[mode]!, setup);
    const row = seen
      ? withoutRepeat(() => rows[randInt(0, rows.length - 1)], (r) => key(r.target[0], r.target[1]), seen)
      : rows[randInt(0, rows.length - 1)];
    return {
      target: row.target,
      helpers: row.helpers,
      adjust: row.adjust,
      driver: row.target[0],
      candidates: [],
    };
  })();

  const [a, b] = drawn.target;
  const product = a * b;
  const helpers = drawn.helpers.map(shown);
  const id = `facts-${mode}-${index}-${a}x${b}`;
  /* The last helper is the one the adjustment operates on, and the one a child
     stops at when they forget to adjust. */
  const stopShort = helpers.length > 0 ? helpers[helpers.length - 1].product : undefined;

  const base: Omit<FactQuestion, "prompt" | "expected" | "taskKind"> = {
    id,
    mode,
    a,
    b,
    product,
    driver: drawn.driver,
    partner: a === drawn.driver ? b : a,
    helpers,
    adjustment: drawn.adjust ? adjustmentWords(drawn.adjust) : "",
    candidates: drawn.candidates,
    choices: choicesFor(a, b, stopShort),
    itemCount: product,
  };

  const n = base.partner;
  const fact = `${a} × ${b}`;

  switch (mode) {
    case "tens":
      return { ...base, taskKind: "fact_tens", prompt: `${fact}. What is ${a} tens?`, expected: String(product) };
    case "fives":
      return { ...base, taskKind: "fact_fives", prompt: `${fact}. Halve the ten times fact.`, expected: String(product) };
    case "double_double":
      return { ...base, taskKind: "fact_double_double", prompt: `${fact}. Double, then double again.`, expected: String(product) };
    case "triple_double":
      return { ...base, taskKind: "fact_triple_double", prompt: `${fact}. Double three times over.`, expected: String(product) };
    case "add_a_group":
      return { ...base, taskKind: "fact_add_a_group", prompt: `${fact}. One group more than a fact you know.`, expected: String(product) };
    case "subtract_a_group":
      return { ...base, taskKind: "fact_subtract_a_group", prompt: `${fact}. One group less than the ten times fact.`, expected: String(product) };
    case "break_apart":
      return { ...base, taskKind: "fact_break_apart", prompt: `${fact}. Break it into two facts you know.`, expected: String(product) };
    case "near_square":
      return { ...base, taskKind: "fact_near_square", prompt: `${fact}. One more ${a} than ${a} × ${a}.`, expected: String(product) };
    case "known_fact":
      return { ...base, taskKind: "fact_known_fact", prompt: `${fact}. Which fact would help?`, expected: String(product) };
    case "doubles":
    default:
      return {
        ...base,
        taskKind: "fact_doubles",
        // Said the way the fact reads. `2 × 7` is two sevens, which is double
        // seven; `7 × 2` is seven twos, which comes to the same total by a
        // route the child met at level 10. Calling both of them "double 7"
        // would quietly drop the difference the skill spent a lesson on.
        prompt: a === 2
          ? `${fact}. What is double ${b}?`
          : `${fact}. What is ${a} twos — the same as double ${a}?`,
        expected: String(product),
      };
  }
}

export const promptFor = (question: FactQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

/** The helper chain as one written line, for a sheet with no card to turn over. */
const helperLine = (question: FactQuestion): string =>
  question.helpers.map((h) => `${h.a} × ${h.b} = ${h.product}`).join(" and ");

export function printedFor(question: FactQuestion): PrintedQuestion | null {
  const { a, b, product } = question;
  if (question.mode === "known_fact") {
    return {
      text: `${a} × ${b} = ____. Write down the fact you used to work it out.`,
      answer: `${product}, using ${helperLine(question)}`,
    };
  }
  if (question.helpers.length === 0) {
    return { text: `${a} × ${b} = ____`, answer: String(product) };
  }
  return {
    text: `You know ${helperLine(question)}. ${question.adjustment} ${a} × ${b} = ____`,
    answer: String(product),
  };
}

export function methodFor(question: FactQuestion): string[] | null {
  switch (question.mode) {
    case "doubles":
      return question.a === 2
        ? [
          `Two ${question.b}s is ${question.b} twice over.`,
          "Doubles are the facts worth knowing by heart.",
        ]
        : [
          `${question.a} twos is two counted ${question.a} times.`,
          `It comes to the same as double ${question.a}.`,
        ];
    case "tens":
      // §12 trap 5. The digits move one place; the zero is what is left behind.
      return [
        `${question.a} tens is ${question.a} sticks of ten.`,
        "Each one moves up a place: ones become tens.",
        "The zero appears because the ones column emptied, not because a rule said to write one.",
      ];
    case "known_fact":
      return [
        "Look for a fact you already know inside this one.",
        `Here it is ${helperLine(question)}.`,
        `${question.adjustment.replace(/^Now /, "").replace(/^./, (c) => c.toUpperCase())}`,
      ];
    default:
      return [
        `Start from a fact you know: ${helperLine(question)}.`,
        question.adjustment.replace(/^Now /, "").replace(/^./, (c) => c.toUpperCase()),
        `That gives ${question.a} × ${question.b}.`,
      ];
  }
}

/** Facts are already written arithmetic; there is no picture to draw. */
export const figureFor = (): React.ReactNode | null => null;

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  revealed: boolean;
}

export function factHints(
  question: FactQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { a, b, partner } = question;
  const first = question.helpers[0];

  switch (question.mode) {
    case "doubles":
      return composeHints(
        kidTip,
        `${a} groups of ${b}. Count one group, then the next.`,
        a === 2 ? `${b} and another ${b}.` : `Two counted ${a} times is double ${a}.`,
      );
    case "tens":
      return composeHints(
        kidTip,
        `${a} tens. Count the sticks of ten.`,
        // Never "put a zero on the end": the rule breaks the first time a
        // decimal appears, and this is the age it gets installed.
        `The ones move up into the tens column, and the ones column is left empty.`,
      );
    case "known_fact":
      return composeHints(
        kidTip,
        state.revealed
          ? `You have ${helperLine(question)}. ${question.adjustment}`
          : `Look for a fact that is one small move from ${a} × ${b}.`,
        // Stops short of naming the card: choosing it is the question.
        `A fact helps when one move gets you from it to ${a} × ${b}.`,
      );
    default:
      return composeHints(
        kidTip,
        state.revealed
          ? `${helperLine(question)}. ${question.adjustment}`
          : first
            ? `Turn the card over. You already know ${first.a} × ${first.b}.`
            : `Start from a fact you already know.`,
        question.adjustment
          ? `From ${helperLine(question)}: ${question.adjustment.toLowerCase().replace(/^now /, "")}`
          : `Work it out from a fact you know.`,
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The fact drawn as the fact reads: `rows` groups of `cols`.
 *
 * Two fixed rows was the first version, and it drew `2 × 7` under both `2 × 7`
 * and `7 × 2` — a picture of two sevens beneath a sentence that says seven
 * twos. The totals agree, which is exactly why nothing failed; the reading is
 * the thing this skill spends a lesson on, and §12 trap 2 is about it drifting
 * silently. Groups alternate colour so the row structure is visible without
 * relying on colour to carry meaning.
 */
const DotGrid: React.FC<{ rows: number; cols: number }> = ({ rows, cols }) => (
  <div className="flex flex-col gap-1.5" role="img" aria-label={`${rows} groups of ${cols}`}>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="flex justify-center gap-1.5">
        {Array.from({ length: cols }, (_, c) => (
          <span
            key={c}
            className={`h-4 w-4 rounded-full sm:h-5 sm:w-5 ${r % 2 === 0 ? GROUPS.solid : EACH.solid}`}
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * `n` tens, drawn as tens.
 *
 * The model for the ten times table is `n` sticks of ten — not a digit with a
 * zero written after it. A child who has seen seven tens laid out has seen why
 * the answer is seventy; a child taught to add a zero has learned a keystroke
 * that stops working the first time they meet 0.7 × 10.
 */
const TenSticks: React.FC<{ count: number }> = ({ count }) => (
  <div className="flex flex-wrap justify-center gap-1.5" role="img" aria-label={`${count} sticks of ten`}>
    {Array.from({ length: count }, (_, i) => (
      <span
        key={i}
        className={`flex h-14 w-6 items-center justify-center rounded border-2 text-[10px] font-black sm:h-16 sm:w-7 ${EACH.border} ${EACH.soft} ${EACH.text}`}
      >
        10
      </span>
    ))}
  </div>
);

export const FactDeck: React.FC<ActivityProps<FactDeckParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: FactSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const usePad = answerInput(koda) === "pad";
  /*
   * The reference chart, and the one place it is never offered.
   *
   * Practice is retrieval without help, and a lookup table is the most complete
   * help there is — so the switch is read *and* practice is checked, rather
   * than trusting a lesson to leave the feature off. `quietWhenPractising`
   * makes the same argument about the voice.
   */
  const chartOffered = koda.config.isEnabled("times_table_chart", true) && !practising;
  const ceiling = tableCeiling(koda);

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
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as FactQuestion;

  /** Whether the helper card has been turned over. Reset on every question. */
  const [revealed, setRevealed] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!question) return;
    setRevealed(false);
    setChartOpen(false);
    setTyped("");
    clearNudge();
  }, [question, clearNudge]);

  if (!question) return null;

  const { mode, a, b, partner } = question;
  const first = question.helpers[0];
  /** `known_fact` withholds the answer until a route has been chosen. */
  const picking = mode === "known_fact" && !revealed;

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  /**
   * Turn the helper card over.
   *
   * Filed as a support, never as an answer. Fetching the fact the strategy is
   * built on is the behaviour the lesson wants; scoring it would mark a child
   * down for doing exactly the thing they are being taught.
   */
  const reveal = () => {
    if (revealed || round.feedback) return;
    setRevealed(true);
    round.useSupport("walkthrough");
    chime(koda, "reached");
    if (hapticsEnabled) koda.haptics.tap();
    speak(`${first.a} times ${first.b} is ${first.product}.`);
  };

  const chooseCandidate = (candidate: ShownFact & { helps: boolean }) => {
    if (round.feedback) return;
    if (!candidate.helps) {
      // A wrong route, not a wrong answer: the child has not said what the
      // product is, so nothing may be filed against them for it.
      refuse(
        `${candidate.a} × ${candidate.b} = ${candidate.product} is a real fact, but no single move gets from it to ${a} × ${b}.`,
        "That one does not help.",
      );
      return;
    }
    setRevealed(true);
    round.useSupport("walkthrough");
    chime(koda, "reached");
    if (hapticsEnabled) koda.haptics.success();
    speak(`${candidate.a} times ${candidate.b} is ${candidate.product}.`);
  };

  const answer = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.product;
    /* Stopping at the helper is the error this lesson exists to correct, so it
       gets its own words rather than a generic "not quite". */
    const stoppedShort = !correct
      && question.helpers.some((helper) => helper.product === value);
    judge(
      correct,
      String(value),
      correct ? "That is the fact!" : stoppedShort ? "Nearly — one move short" : "Not quite",
      stoppedShort
        ? `${value} is ${question.helpers.find((h) => h.product === value)!.a} × ${question.helpers.find((h) => h.product === value)!.b}. ${question.adjustment}`
        : question.helpers.length > 0
          ? `${helperLine(question)}, so ${a} × ${b} = ${question.product}.`
          : `${a} × ${b} = ${question.product}.`,
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse("Type a number first.", "Type a number first.");
      return;
    }
    answer(Number(typed));
    setTyped("");
  };

  const openChart = () => {
    if (chartOpen || round.feedback) return;
    setChartOpen(true);
    round.useSupport("reveal");
    chime(koda, "counted");
  };

  /* ---- the card ---- */
  const helperCard = (() => {
    if (question.helpers.length === 0 || mode === "known_fact") return null;
    if (!revealed) {
      return (
        <button
          type="button"
          onClick={reveal}
          aria-label={`Turn over the helper card, ${first.a} times ${first.b}`}
          className={themeSystem.button("secondary", "md")}
        >
          I know {first.a} × {first.b}
        </button>
      );
    }
    return (
      <div className="flex flex-col items-center gap-1">
        {question.helpers.map((helper) => (
          <p key={`${helper.a}x${helper.b}`} className={`text-xl font-black tabular-nums ${HELPER.text}`}>
            {helper.a} × {helper.b} = {helper.product}
          </p>
        ))}
        <p className={`text-base font-black ${ADJUSTMENT.text}`}>{question.adjustment}</p>
      </div>
    );
  })();

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
          aria-label={`${value}`}
          onClick={() => answer(value)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          {value}
        </button>
      ))}
    </div>
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Fact Deck"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : factHints(question, copy.kidTip, { revealed })}
      iconName="zap"
      iconTone="purple"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className={`${SCENE} flex min-h-44 w-full flex-col items-center justify-center gap-4 p-5 sm:p-7`}>
          {/* The fact itself, big enough to be the thing on the screen. The two
              factors keep the skill's colours so which is which stays visible. */}
          <p className="text-4xl font-black tabular-nums text-ink sm:text-5xl">
            <span className={GROUPS.text}>{a}</span>
            <span className="text-ink/55"> × </span>
            <span className={EACH.text}>{b}</span>
            <span className="text-ink/55"> = ?</span>
          </p>

          {scaffold && mode === "doubles" && <DotGrid rows={a} cols={b} />}

          {/* `a` is the count of tens, because this mode always draws `n × 10`. */}
          {scaffold && mode === "tens" && <TenSticks count={a} />}

          {helperCard}

          {picking && (
            <div className="flex flex-wrap justify-center gap-2.5">
              {question.candidates.map((candidate) => (
                <button
                  key={`${candidate.a}x${candidate.b}`}
                  type="button"
                  onClick={() => chooseCandidate(candidate)}
                  disabled={!!round.feedback}
                  aria-label={`Use ${candidate.a} times ${candidate.b}`}
                  className={`${TOUCH_TARGET} rounded-2xl border-2 px-4 py-3 text-lg font-bold tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${EACH.border} bg-surface`}
                >
                  {candidate.a} × {candidate.b}
                </button>
              ))}
            </div>
          )}

          {mode === "known_fact" && revealed && (
            <div className="flex flex-col items-center gap-1">
              {question.helpers.map((helper) => (
                <p key={`${helper.a}x${helper.b}`} className={`text-xl font-black tabular-nums ${HELPER.text}`}>
                  {helper.a} × {helper.b} = {helper.product}
                </p>
              ))}
              <p className={`text-base font-black ${ADJUSTMENT.text}`}>{question.adjustment}</p>
            </div>
          )}
        </div>

        {!picking && numericAnswer}

        {chartOffered && (
          chartOpen ? (
            <div className="flex w-full flex-col items-center gap-2">
              <TimesTableChart ceiling={ceiling} label={`Times table up to ${ceiling}`} />
              <button
                type="button"
                onClick={() => setChartOpen(false)}
                className={themeSystem.button("secondary", "md")}
              >
                Hide the times table
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openChart}
              disabled={!!round.feedback}
              className={themeSystem.button("secondary", "md")}
            >
              Show the times table
            </button>
          )
        )}
      </div>
    </SkillRound>
  );
};
