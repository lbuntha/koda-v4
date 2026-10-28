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
import {
  drawFactorNumber,
  drawHalveDouble,
  drawTriple,
  factorPairsOf,
  isPrime,
  productDistractors,
  shuffle,
  withoutRepeat,
} from "../internal/data/multiplicationNumbers";
import { chime } from "../internal/data/multiplicationSound";
import { answerInput, speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { ADJUSTMENT, EACH, GROUPS, NEUTRAL, PRODUCT } from "../internal/data/multiplicationPalette";
import { CANDIDATE, FACTOR_TILE, SCROLL_BOX, TOUCH_TARGET } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";
import { NumberPad } from "../internal/ui/NumberPad";
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * Factors, taken apart and put back together.
 *
 * Four modes on one board: group three factors either way round and find the
 * total unmoved, halve one factor and double the other to make a hard product
 * easy, find every pair that makes a number, and decide whether a number has
 * any pair at all.
 *
 * The last two are the same act — trying divisors on a board — and that is
 * deliberate. A child who has never heard the word "prime" can still answer
 * level 37 correctly by doing exactly what level 36 taught them, which is what
 * makes it a discovery rather than a definition to memorise.
 */

export type FactorMode = "associative" | "halve_double" | "factor_pairs" | "prime_composite";

/**
 * The numbers a child tries against a total.
 *
 * One to ten, and no further. Every factor pair of a number up to a hundred has
 * its *smaller* member at or below ten — the smaller half cannot exceed the
 * square root — so every pair is reachable from this board and none can be
 * missed for want of a bigger button.
 *
 * What the board cannot do is treat a tap as a pair. Ten divisors are offered
 * and some of them are the *larger* half of a pair that is already on screen:
 * 7 divides 28, but 4 × 7 is the same pair a tap on 4 already found. So a tap
 * contributes the pair it belongs to rather than itself, and tapping either end
 * of a pair finds it. Getting this wrong would have marked a child wrong for
 * spotting a factor.
 */
const CANDIDATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * The same board, without the one.
 *
 * `1` belongs in a hunt for factor pairs — `1 × 45` is a pair — but it has no
 * business in a primality test, where it is excluded by the definition. A child
 * who tapped it saw "1 divides 47" in the same green as a real find, which
 * points at exactly the wrong conclusion. Every composite below 101 still has a
 * divisor in this range, so nothing is lost by leaving it out.
 */
const DIVISOR_CANDIDATES = CANDIDATES.filter((n) => n > 1);

interface FactorSetup {
  mode?: FactorMode;
  modes?: string[];
  practice?: boolean;
  /** `associative`: how big the three tiles may be. */
  tileRange?: [number, number];
  productMax?: number;
  /** `halve_double`: the factor that gets halved. */
  aRange?: [number, number];
  /** `factor_pairs` / `prime_composite`: the number being taken apart. */
  range?: [number, number];
  questionsPerRound?: number;
}

export interface FactorParams extends FactorSetup {
  question?: FactorSetup;
  play?: unknown;
}

export interface FactorQuestion extends RoundQuestion {
  mode: FactorMode;
  /** `associative`: the three tiles, in the order they are shown. */
  a: number;
  b: number;
  c: number;
  /** `halve_double`: the pair as given, and the pair it rewrites to. */
  halved: number;
  doubled: number;
  /** `factor_pairs` and `prime_composite`: the number in question. */
  value: number;
  prime: boolean;
  /** Every candidate on the board that divides `value`. */
  factors: number[];
  /** The pairs themselves — the answer `factor_pairs` is checked against. */
  pairs: [number, number][];
  product: number;
  choices: number[];
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const choicesFor = (a: number, b: number, near?: number): number[] =>
  shuffle([a * b, ...productDistractors({ a, b, product: a * b }, 3, near)]);

export function buildQuestion(params: FactorParams, index: number, seen?: Set<string>): FactorQuestion {
  const setup: FactorSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "associative");

  const drawn = (() => {
    if (mode === "associative") {
      const draw = () => drawTriple({
        range: setup.tileRange ?? [2, 6],
        productMax: setup.productMax ?? 120,
      });
      const t = seen ? withoutRepeat(draw, (v) => `${v.a}.${v.b}.${v.c}`, seen) : draw();
      return { ...t, halved: 0, doubled: 0, value: t.product, prime: false, factors: [], pairs: [] };
    }

    if (mode === "halve_double") {
      const draw = () => drawHalveDouble({ aRange: setup.aRange ?? [4, 30], productMax: setup.productMax });
      const h = seen ? withoutRepeat(draw, (v) => `${v.a}x${v.b}`, seen) : draw();
      return {
        a: h.a, b: h.b, c: 1, product: h.product,
        halved: h.halved, doubled: h.doubled,
        value: h.product, prime: false, factors: [], pairs: [],
      };
    }

    /* Both board modes take a number apart with the same ten candidates. A
       composite needs at least two pairs, or "find every pair" is one tap. */
    const draw = () => drawFactorNumber({
      range: setup.range ?? (mode === "factor_pairs" ? [12, 100] : [2, 100]),
      kind: mode === "factor_pairs" ? "composite" : "either",
      minPairs: mode === "factor_pairs" ? 2 : 1,
    });
    const value = seen ? withoutRepeat(draw, String, seen) : draw();
    return {
      a: value, b: 1, c: 1, product: value,
      halved: 0, doubled: 0,
      value,
      prime: isPrime(value),
      factors: CANDIDATES.filter((n) => value % n === 0),
      pairs: factorPairsOf(value),
    };
  })();

  const { a, b, c, product, value, prime, factors, pairs, halved, doubled } = drawn;
  const id = `factors-${mode}-${index}-${value}`;

  const base: Omit<FactorQuestion, "prompt" | "expected" | "taskKind"> = {
    id, mode, a, b, c, halved, doubled, value, prime, factors, pairs, product,
    choices: mode === "associative"
      ? choicesFor(a * b, c)
      : mode === "halve_double"
        ? choicesFor(halved, doubled)
        : [],
    itemCount: product,
  };

  switch (mode) {
    case "halve_double":
      return {
        ...base,
        taskKind: "halve_and_double",
        prompt: tm("factor.promptHalve", { a, b }),
        expected: String(product),
      };
    case "factor_pairs":
      return {
        ...base,
        taskKind: "find_factor_pairs",
        prompt: tm("factor.promptPairs", { value }),
        expected: pairs.map(([x, y]) => `${x} × ${y}`).join(", "),
      };
    case "prime_composite":
      return {
        ...base,
        taskKind: "prime_or_composite",
        prompt: tm("factor.promptPrime", { value }),
        expected: prime ? "Prime" : "Composite",
      };
    case "associative":
    default:
      return {
        ...base,
        taskKind: "multiply_three_numbers",
        prompt: tm("factor.promptThree", { a, b, c }),
        expected: String(product),
      };
  }
}

export const promptFor = (question: FactorQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: FactorQuestion): PrintedQuestion | null {
  const { a, b, c, value, product } = question;
  switch (question.mode) {
    case "halve_double":
      return {
        text: tm("factor.printedHalve", { a, b }),
        answer: `${question.halved} × ${question.doubled} = ${product}`,
      };
    case "factor_pairs":
      return {
        text: tm("factor.printedPairs", { value }),
        answer: factorPairsOf(value).map(([x, y]) => `${x} × ${y}`).join(", "),
      };
    case "prime_composite":
      return {
        text: tm("factor.printedPrime", { value }),
        answer: question.prime ? tm("factor.printedPrimeYes", { value }) : tm("factor.printedPrimeNo", { pair: factorPairsOf(value)[1].join(" × "), value }),
      };
    case "associative":
    default:
      return {
        text: tm("factor.printedThree", { a, b, c }),
        answer: String(product),
      };
  }
}

export function methodFor(question: FactorQuestion): string[] | null {
  switch (question.mode) {
    case "halve_double":
      return [
        tm("factor.methodHalve1"),
        tm("factor.methodHalve2", { a: question.a, b: question.b, halved: question.halved, doubled: question.doubled }),
        tm("factor.methodHalve3"),
      ];
    case "factor_pairs":
      return [
        tm("factor.methodPairs1"),
        tm("factor.methodPairs2", { value: question.value }),
        tm("factor.methodPairs3"),
      ];
    case "prime_composite":
      return [
        tm("factor.methodPrime1", { value: question.value }),
        tm("factor.methodPrime2"),
        tm("factor.methodPrime3"),
      ];
    case "associative":
    default:
      return [
        tm("factor.methodThree1"),
        tm("factor.methodThree2"),
        tm("factor.methodThree3"),
      ];
  }
}

/** Facts and factor lists are written arithmetic; there is nothing to draw. */
export const figureFor = (): React.ReactNode | null => null;

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  grouped?: "ab" | "bc";
  rewritten: boolean;
  picked: number[];
  tried: number[];
}

export function factorHints(
  question: FactorQuestion,
  kidTip: string | undefined,
  state: LiveState,
): string[] {
  const { a, b, c, value } = question;
  switch (question.mode) {
    case "halve_double":
      return composeHints(
        kidTip,
        state.rewritten
          ? tm("factor.hintHalveDone", { halved: question.halved, doubled: question.doubled })
          : tm("factor.hintHalveStart"),
        tm("factor.hintHalve2"),
      );
    case "factor_pairs":
      return composeHints(
        kidTip,
        state.picked.length === 0
          ? tm("factor.hintPairsStart", { value })
          : tm("factor.hintPairsFound", { count: state.picked.length }),
        // Stops short of naming a factor: finding them is the question.
        tm("factor.hintPairs2", { value }),
      );
    case "prime_composite":
      return composeHints(
        kidTip,
        state.tried.length === 0
          ? tm("factor.hintPrimeStart", { value })
          : tm("factor.hintPrimeTried", { count: state.tried.length }),
        tm("factor.hintPrime2"),
      );
    case "associative":
    default:
      return composeHints(
        kidTip,
        state.grouped
          ? tm("factor.hintThreeDone")
          : tm("factor.hintThreeStart", { a, b, c }),
        tm("factor.hintThree2"),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

export const FactorBoard: React.FC<ActivityProps<FactorParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup: FactorSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const usePad = answerInput(koda) === "pad";

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
     * zero, because that is how the worksheet builder calls it.
     */
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as FactorQuestion;

  /** Which two of the three were multiplied first. */
  const [grouped, setGrouped] = useState<"ab" | "bc" | undefined>(undefined);
  /** Whether the halve-and-double rewrite has been made. */
  const [rewritten, setRewritten] = useState(false);
  /** `factor_pairs`: the candidates chosen as factors. */
  const [picked, setPicked] = useState<number[]>([]);
  /** `prime_composite`: the candidates tried, and what each turned out to be. */
  const [tried, setTried] = useState<number[]>([]);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!question) return;
    setGrouped(undefined);
    setRewritten(false);
    setPicked([]);
    setTried([]);
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
    setGrouped(undefined);
    setRewritten(false);
    setPicked([]);
    setTried([]);
    setTyped("");
    clearNudge();
  };


  if (!question) return null;

  const { mode, a, b, c, value } = question;

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  /* ---- associative ---- */
  const group = (which: "ab" | "bc") => {
    if (round.feedback) return;
    // Neither grouping is wrong — that is the entire lesson — so this is never
    // refused, only recorded.
    setGrouped(which);
    nudge.clear();
    chime(koda, "counted");
    if (hapticsEnabled) koda.haptics.tap();
  };

  /* ---- halve and double ---- */
  const rewrite = (halveFirst: boolean) => {
    if (round.feedback) return;
    const toHalve = halveFirst ? a : b;
    const toDouble = halveFirst ? b : a;
    if (toHalve % 2 !== 0) {
      refuse(
        tm("factor.cannotHalve", { n: toHalve }),
        tm("factor.cannotHalveSay"),
      );
      return;
    }
    /*
     * Halving is not enough; the rewrite has to *help*.
     *
     * When both factors are even — `16 × 50` — halving the fifty gives
     * `32 × 25`, which is honest arithmetic and harder than what it replaced.
     * The move is only worth making when the doubled side lands on a ten.
     */
    if ((toDouble * 2) % 10 !== 0) {
      refuse(
        tm("factor.noEasier", { n: toDouble, doubled: toDouble * 2 }),
        tm("factor.noEasierSay"),
      );
      return;
    }
    setRewritten(true);
    nudge.clear();
    chime(koda, "reached");
    if (hapticsEnabled) koda.haptics.success();
    speak(tm("factor.saidRewrite", { halved: question.halved, doubled: question.doubled }));
  };

  /* ---- the candidate board ---- */
  const tryCandidate = (n: number) => {
    if (round.feedback) return;
    if (mode === "factor_pairs") {
      setPicked((current) => (current.includes(n) ? current.filter((x) => x !== n) : [...current, n]));
      chime(koda, "placed");
      if (hapticsEnabled) koda.haptics.tap();
      return;
    }
    // `prime_composite`: trying is exploration, and it is never scored.
    setTried((current) => (current.includes(n) ? current : [...current, n]));
    chime(koda, value % n === 0 ? "reached" : "counted");
    if (hapticsEnabled) koda.haptics.tap();
  };

  /** The pair a candidate belongs to, smaller half first. */
  const pairOf = (n: number): string => `${Math.min(n, value / n)}x${Math.max(n, value / n)}`;

  const checkPairs = () => {
    if (round.feedback) return;
    if (picked.length === 0) {
      refuse(tm("factor.tapDivide"), tm("factor.tapNumber"));
      return;
    }
    /*
     * Judged on the pairs found, not the buttons pressed.
     *
     * Some candidates are the larger half of a pair another candidate already
     * names — 7 and 4 both name 4 × 7 of 28 — so a tap contributes its pair and
     * either end finds it. Counting taps would mark a child wrong for noticing
     * that 7 goes into 28.
     */
    const wanted = new Set(question.pairs.map(([x, y]) => `${x}x${y}`));
    const found = new Set(picked.filter((n) => value % n === 0).map(pairOf));
    const strays = picked.filter((n) => value % n !== 0);
    const correct = strays.length === 0
      && found.size === wanted.size
      && [...wanted].every((key) => found.has(key));
    const written = question.pairs.map(([x, y]) => `${x} × ${y}`).join(", ");
    judge(
      correct,
      [...found].join(", "),
      correct ? tm("factor.everyPair") : tm("factor.notWhole"),
      strays.length > 0
        ? tm("factor.stray", { n: strays[0], value, written })
        : tm("factor.hasPairs", { value, count: wanted.size, written }),
    );
  };

  const answerPrime = (saidPrime: boolean) => {
    if (round.feedback) return;
    if (tried.length === 0) {
      // §6.L: decided by attempting pairs on the board, not by recall.
      refuse(tm("factor.tryFirst", { value }), tm("factor.tryFirstSay"));
      return;
    }
    const correct = saidPrime === question.prime;
    const pair = factorPairsOf(value).find(([x]) => x > 1);
    judge(
      correct,
      saidPrime ? "Prime" : "Composite",
      correct ? tm("factor.yes") : tm("factor.notQuite"),
      question.prime
        ? tm("factor.isPrime", { value })
        : tm("factor.isComposite", { x: pair![0], y: pair![1], value }),
    );
  };

  const answerProduct = (given: number) => {
    if (round.feedback) return;
    if (mode === "associative" && !grouped) {
      refuse(tm("factor.groupFirst"), tm("factor.groupFirstSay"));
      return;
    }
    if (mode === "halve_double" && !rewritten) {
      refuse(tm("factor.rewriteFirst"), tm("factor.rewriteFirstSay"));
      return;
    }
    const correct = given === question.product;
    judge(
      correct,
      String(given),
      correct ? tm("factor.thatIsIt") : tm("factor.notQuite"),
      mode === "halve_double"
        ? tm("factor.sameHalve", { a, b, halved: question.halved, doubled: question.doubled, product: question.product })
        : tm("factor.sameThree", { a, b, c, product: question.product }),
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse(tm("factor.typeFirst"), tm("factor.typeFirst"));
      return;
    }
    answerProduct(Number(typed));
    setTyped("");
  };

  /* ---- pieces ---- */
  const Tile: React.FC<{ n: number; role: typeof GROUPS }> = ({ n, role }) => (
    <span aria-hidden="true" className={`${FACTOR_TILE} ${role.border} ${role.soft} ${role.text}`}>{n}</span>
  );

  const numericAnswer = usePad ? (
    <div className="flex flex-col items-center gap-3">
      <output
        aria-label={tm("factor.yourAnswer")}
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
        {tm("factor.check")}
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {question.choices.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n}`}
          onClick={() => answerProduct(n)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          {n}
        </button>
      ))}
    </div>
  );

  /** The ten numbers a child tries against the total. */
  const candidateBoard = (
    <div className={SCROLL_BOX}>
      {/* Five to a row, always. Left to wrap, ten buttons put nine on one line
          and a lonely tenth beneath it at desktop width and broke differently
          at every other — two tidy rows also read as 1–5 and 6–10. */}
      <div className="mx-auto grid w-fit grid-cols-5 justify-center gap-2">
        {(mode === "factor_pairs" ? CANDIDATES : DIVISOR_CANDIDATES).map((n) => {
          const divides = value % n === 0;
          const chosen = mode === "factor_pairs" ? picked.includes(n) : tried.includes(n);
          const tone = !chosen
            ? `${NEUTRAL.border} bg-surface text-ink`
            : mode === "factor_pairs"
              ? `${PRODUCT.border} ${PRODUCT.soft} ${PRODUCT.text}`
              : divides
                ? `${PRODUCT.border} ${PRODUCT.soft} ${PRODUCT.text}`
                : `${ADJUSTMENT.border} ${ADJUSTMENT.soft} ${ADJUSTMENT.text}`;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={chosen}
              aria-label={
                mode === "factor_pairs"
                  ? `${n}${chosen ? (divides ? tm("factor.pairChosen", { x: Math.min(n, value / n), y: Math.max(n, value / n) }) : tm("factor.pairBad")) : ""}`
                  : `${tm("factor.try", { n })}${chosen ? (divides ? tm("factor.divides", { value }) : tm("factor.notDivides", { value })) : ""}`
              }
              onClick={() => tryCandidate(n)}
              disabled={!!round.feedback}
              className={`${CANDIDATE} ${tone} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );

  const board = (() => {
    switch (mode) {
      case "associative":
        return (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Tile n={a} role={GROUPS} />
              <span aria-hidden="true" className={`text-xl font-black ${NEUTRAL.text}`}>×</span>
              <Tile n={b} role={EACH} />
              <span aria-hidden="true" className={`text-xl font-black ${NEUTRAL.text}`}>×</span>
              <Tile n={c} role={GROUPS} />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {([["ab", `${a} × ${b}`, a * b], ["bc", `${b} × ${c}`, b * c]] as const).map(([which, label, step]) => (
                <button
                  key={which}
                  type="button"
                  aria-pressed={grouped === which}
                  aria-label={tm("factor.multiplyFirst", { label })}
                  onClick={() => group(which)}
                  disabled={!!round.feedback}
                  className={`${TOUCH_TARGET} rounded-2xl border-2 px-4 py-3 text-base font-bold tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                    grouped === which ? `${PRODUCT.border} ${PRODUCT.soft}` : `${EACH.border} bg-surface`
                  }`}
                >
                  {tm("factor.firstLabel", { label, eq: grouped === which ? ` = ${step}` : "" })}
                </button>
              ))}
            </div>
            {scaffold && grouped && (
              <p className={`text-center text-base font-black tabular-nums ${ADJUSTMENT.text}`} aria-live="polite">
                {grouped === "ab" ? `${a * b} × ${c}` : `${a} × ${b * c}`}
              </p>
            )}
          </div>
        );

      case "halve_double":
        return (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Tile n={rewritten ? question.halved : a} role={GROUPS} />
              <span aria-hidden="true" className={`text-xl font-black ${NEUTRAL.text}`}>×</span>
              <Tile n={rewritten ? question.doubled : b} role={EACH} />
            </div>
            {!rewritten && (
              <div className="flex flex-wrap justify-center gap-2">
                {([[true, a, b], [false, b, a]] as const).map(([halveFirst, toHalve, toDouble]) => (
                  <button
                    key={String(halveFirst)}
                    type="button"
                    aria-label={tm("factor.halveDouble", { half: toHalve, dbl: toDouble })}
                    onClick={() => rewrite(halveFirst)}
                    disabled={!!round.feedback}
                    className={`${TOUCH_TARGET} rounded-2xl border-2 ${EACH.border} bg-surface px-4 py-3 text-base font-bold tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
                  >
                    {tm("factor.halveDoubleButton", { half: toHalve, dbl: toDouble })}
                  </button>
                ))}
              </div>
            )}
            {scaffold && rewritten && (
              <p className={`text-center text-base font-black tabular-nums ${ADJUSTMENT.text}`} aria-live="polite">
                {a} × {b} = {question.halved} × {question.doubled}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center gap-3">
            <p className={`text-4xl font-black tabular-nums sm:text-5xl ${PRODUCT.text}`}>{value}</p>
            {candidateBoard}
            {scaffold && mode === "factor_pairs" && (
              <p className={`text-center text-sm font-bold ${GROUPS.text}`} aria-live="polite">
                {picked.length === 0
                  ? tm("factor.tapOne")
                  : [...new Set(picked.filter((n) => value % n === 0)
                      .map((n) => `${Math.min(n, value / n)} × ${Math.max(n, value / n)}`))].join(",  ")
                    || tm("factor.noneDivides")}
              </p>
            )}
            {scaffold && mode === "prime_composite" && tried.length > 0 && (
              <p className={`text-center text-sm font-bold ${GROUPS.text}`} aria-live="polite">
                {tried.slice().sort((x, y) => x - y)
                  .map((n) => (value % n === 0 ? tm("factor.dividesIt", { n }) : tm("factor.doesNot", { n })))
                  .join(" · ")}
              </p>
            )}
          </div>
        );
    }
  })();

  const controls = (() => {
    switch (mode) {
      case "factor_pairs":
        return (
          <button type="button" onClick={checkPairs} disabled={!!round.feedback} className={themeSystem.button("primary", "md")}>
            {tm("factor.check")}
          </button>
        );
      case "prime_composite":
        return (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {([true, false] as const).map((saidPrime) => (
              <button
                key={String(saidPrime)}
                type="button"
                aria-label={saidPrime ? tm("factor.ariaPrime", { value }) : tm("factor.ariaComposite", { value })}
                onClick={() => answerPrime(saidPrime)}
                disabled={!!round.feedback}
                className={`${TOUCH_TARGET} rounded-2xl border-2 px-6 py-3 text-lg font-black text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  saidPrime ? `${EACH.border} ${EACH.soft}` : `${PRODUCT.border} ${PRODUCT.soft}`
                }`}
              >
                {saidPrime ? tm("factor.prime") : tm("factor.composite")}
              </button>
            ))}
          </div>
        );
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
  const hints = practising ? [] : factorHints(question, copy.kidTip, { grouped, rewritten, picked, tried });
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
    progress: picked.length + tried.length + (rewritten ? 1 : 0),
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("factor.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (grouped !== undefined || rewritten || picked.length > 0 || tried.length > 0 || typed !== "") ? restart : undefined
      }
      iconName="gem"
      iconTone="indigo"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {board}
        {controls}
      </div>
    </SkillRound>
  );
};
