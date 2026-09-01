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
import { ADDEND_A, ADDEND_B, CHANGE, TOTAL } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { NumberPad } from "../internal/ui/NumberPad";
import {
  drawDouble,
  drawNearDouble,
  drawPair,
  pairKey,
  shuffle,
  withoutRepeat,
  type PairSpec,
} from "../internal/data/additionNumbers";

/**
 * Facts, and the facts that get you to them.
 *
 * Recall is not the lesson here — the *relationship* is. A child who knows six
 * and six can have seven and six for almost nothing, and the whole point of
 * this deck is that the helper fact is on screen, named, and visibly one step
 * away. A card that only asked "what is 7 + 6?" would be a flashcard, and a
 * flashcard teaches whoever already knew.
 *
 * So naming the double is a **support**, not a question. The child is not
 * scored for saying six and six is twelve; they are scored on what they do with
 * it. Reporting it as an answer would put a second answer against a question
 * that has one, and mark a child down for using the strategy being taught.
 */

export type FactMode = "doubles" | "near_up" | "near_down" | "known_fact" | "family" | "commute";

export interface Fact {
  a: number;
  b: number;
  sum: number;
}

export interface FactSetup {
  mode?: FactMode;
  /** `doubles` and the near doubles: which n to build the fact from. */
  nRange?: [number, number];
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface FactDeckParams extends FactSetup {
  question?: FactSetup;
}

export interface FactQuestion extends RoundQuestion {
  mode: FactMode;
  a: number;
  b: number;
  sum: number;
  /** The fact this one leans on, where there is one. */
  helper?: Fact;
  /** `known_fact`: the helper offered beside two that do not help. */
  helpers?: Fact[];
  /** `commute`: the switched fact, and the ones it is offered beside. */
  choices?: Fact[];
  /** `family`: the four members, each answered. */
  members?: { text: string; answer: number }[];
  /** How the answer is given. */
  answerShape: "number" | "fact" | "members";
}

const factOf = (a: number, b: number): Fact => ({ a, b, sum: a + b });
const sameFact = (x: Fact, y: Fact) => x.a === y.a && x.b === y.b;

const DEFAULT_SPEC: Record<FactMode, PairSpec> = {
  doubles: { addendRange: [1, 10] },
  near_up: { addendRange: [1, 9] },
  near_down: { addendRange: [2, 10] },
  /* The helper has to be near the target or it helps with nothing: 3 + 9 beside
     the double 3 + 3 is six steps away, and a lesson full of those teaches that
     the strategy does not work. */
  known_fact: { addendRange: [3, 9], sumMax: 18, maxGap: 2 },
  family: { addendRange: [1, 9], sumMax: 18, distinct: true },
  // A gap worth switching for: 2 + 9 is worth reordering, 4 + 5 is not.
  commute: { aRange: [1, 4], bRange: [6, 9], minGap: 3 },
};

const declared = (setup: FactSetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: FactMode, setup: FactSetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  if (mode === "commute") spec.minGap = DEFAULT_SPEC.commute.minGap;
  if (mode === "family") spec.distinct = true;
  // A helper fact that is not close is not a helper.
  if (mode === "known_fact") spec.maxGap = DEFAULT_SPEC.known_fact.maxGap;
  return spec;
};

export const buildQuestion = (
  setup: FactSetup,
  index: number,
  seen: Set<string>,
): FactQuestion => {
  const mode = setup.mode ?? "doubles";
  const nRange = setup.nRange ?? (DEFAULT_SPEC[mode].addendRange as [number, number]);
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `fact_${mode}`, mode };

  if (mode === "doubles") {
    const { a, b, sum } = withoutRepeat(() => drawDouble(nRange), pairKey, seen);
    return { ...base, a, b, sum, answerShape: "number", expected: String(sum), itemCount: sum };
  }

  if (mode === "near_up" || mode === "near_down") {
    const drawn = withoutRepeat(
      () => drawNearDouble(nRange, mode === "near_up" ? 1 : -1),
      pairKey,
      seen,
    );
    return {
      ...base,
      a: drawn.a,
      b: drawn.b,
      sum: drawn.sum,
      helper: factOf(drawn.a, drawn.a),
      answerShape: "number",
      expected: String(drawn.sum),
      itemCount: drawn.sum,
    };
  }

  if (mode === "known_fact") {
    const { a, b, sum } = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
    /*
     * The helper is one step away, and the two beside it are not.
     *
     * A double the child is likely to hold, one away from the target. The
     * distractors are real facts too — an obviously silly option would let a
     * child choose correctly without thinking about which fact helps.
     */
    const helper = factOf(a, a);
    const others = [factOf(b, b), factOf(a + 1, a + 1)].filter((f) => !sameFact(f, helper));
    return {
      ...base,
      a,
      b,
      sum,
      helper,
      helpers: shuffle([helper, ...others.slice(0, 2)]),
      answerShape: "number",
      expected: String(sum),
      itemCount: sum,
    };
  }

  if (mode === "commute") {
    const { a, b, sum } = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
    const switched = factOf(b, a);
    return {
      ...base,
      a,
      b,
      sum,
      // The original sits among the choices on purpose: choosing it is the
      // mistake this lesson is about, and it has to be available to make.
      choices: shuffle([switched, factOf(a, b), factOf(b, a + 1)]),
      answerShape: "fact",
      expected: `${switched.a}+${switched.b}`,
      itemCount: sum,
    };
  }

  const { a, b, sum } = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
  return {
    ...base,
    a,
    b,
    sum,
    members: [
      { text: `${a} + ${b} =`, answer: sum },
      { text: `${b} + ${a} =`, answer: sum },
      { text: `${sum} − ${a} =`, answer: b },
      { text: `${sum} − ${b} =`, answer: a },
    ],
    answerShape: "members",
    expected: [sum, sum, b, a].join(","),
    itemCount: sum,
  };
};

export const promptFor = (q: FactQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum))
    .replaceAll("{double}", String(q.helper?.sum ?? ""));
  if (filled) return filled;

  switch (q.mode) {
    case "near_up":
    case "near_down":
      return `${q.a} plus ${q.b}. It is one away from a double you know.`;
    case "known_fact":
      return `${q.a} plus ${q.b}. Which fact would help?`;
    case "family":
      return `${q.a}, ${q.b} and ${q.sum} make a family. Fill in all four.`;
    case "commute":
      return `${q.a} plus ${q.b}. Which is the same fact the other way round?`;
    default:
      return `Double ${q.a}. What is the total?`;
  }
};

export function factHints(
  q: FactQuestion,
  state: { revealed: boolean; kidTip?: string },
): string[] {
  switch (q.mode) {
    case "near_up":
    case "near_down": {
      const delta = q.mode === "near_up" ? "one more than" : "one less than";
      return composeHints(
        state.kidTip ?? "A near double is one step from a double you already know.",
        state.revealed
          ? `You have the double: ${q.a} and ${q.a} is ${q.helper!.sum}. This fact is ${delta} that.`
          : `Tap the double first. ${q.a} and ${q.a} is a fact you know, and this one sits right beside it.`,
        `${q.helper!.sum} ${q.mode === "near_up" ? "and one more" : "take one away"} is ${q.sum}.`,
      );
    }
    case "known_fact":
      return composeHints(
        state.kidTip ?? "Pick a fact you already know that is close to this one.",
        `${q.a} and ${q.a} is a double, and doubles are the easiest facts to hold. That one is closest to ${q.a} plus ${q.b}.`,
        `${q.helper!.sum} is the double. Count on from there to reach ${q.a} plus ${q.b}.`,
      );
    case "family":
      return composeHints(
        state.kidTip ?? "The same three numbers make four different facts.",
        `${q.a}, ${q.b} and ${q.sum} are the family. Two of the facts add and two take away.`,
        `${q.a} and ${q.b} is ${q.sum}, and ${q.sum} take away ${q.a} is ${q.b}.`,
      );
    case "commute":
      return composeHints(
        state.kidTip ?? "You can add in either order and the total does not change.",
        `The same fact the other way round starts with the other number: it begins with ${q.b}.`,
        // Stops short of pointing at a tile: choosing is the question.
        `Swapping the two numbers never changes the total.`,
      );
    default:
      return composeHints(
        state.kidTip ?? "A double is the same number twice.",
        `Two rows of ${q.a}. Count one row, then the other — or count them in twos.`,
        `${q.a} and ${q.a} is ${q.sum}.`,
      );
  }
}

/** Four answers around the right one, never below zero. */
export const choicesFor = (answer: number): number[] =>
  Array.from({ length: 4 }, (_, i) => Math.max(0, answer - 2) + i);

/** A row of dots, so a double can be seen as two of the same thing. */
const DotRow: React.FC<{ count: number; tone: string; label: string }> = ({ count, tone, label }) => (
  <div className="flex flex-wrap gap-1.5 justify-center max-w-[15rem]" role="img" aria-label={label}>
    {Array.from({ length: count }, (_, i) => (
      <span key={i} className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full ${tone}`} />
    ))}
  </div>
);

export const FactDeck: React.FC<ActivityProps<FactDeckParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: FactSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());

  const [revealed, setRevealed] = useState(false);
  const [entry, setEntry] = useState("");
  const [members, setMembers] = useState<Record<number, string>>({});
  const [nudge, setNudge] = useState<string | null>(null);
  const nudgeTimer = useRef<number | null>(null);
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

  const question = round.question as FactQuestion;

  useEffect(() => {
    setRevealed(false);
    setEntry("");
    setMembers({});
    setNudge(null);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
  }, [question.id]);

  useEffect(() => () => {
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
  }, []);

  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  /** A family may prefer four tiles to a pad. Read here, which is what makes it
   *  a setting rather than a line in a manifest. */
  const answerInput = koda.config.get<string>("answerInput", "pad");

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };
  const refuse = (why: string) => {
    chime("hint");
    setNudge(why);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => setNudge(null), 4000);
  };

  /**
   * Show the double this fact leans on.
   *
   * A support, and reported as one. The child is not answering — they are
   * fetching the fact the strategy is built on, which is exactly the behaviour
   * the lesson wants. Scoring it would mark them down for doing the thing.
   */
  const revealHelper = () => {
    if (revealed || round.feedback) return;
    setRevealed(true);
    round.useSupport("walkthrough");
    chime("clink");
  };

  const chooseHelper = (fact: Fact) => {
    if (round.feedback) return;
    if (!sameFact(fact, question.helper!)) {
      // A wrong route, not a wrong answer: the child has not said what the
      // total is, so nothing may be filed against them for it.
      refuse(
        `${fact.a} and ${fact.b} is a real fact, but it is not close to ${question.a} plus ${question.b}. Look for a double.`,
      );
      return;
    }
    setRevealed(true);
    round.useSupport("walkthrough");
    chime("success");
  };

  const submitNumber = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.sum;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    round.submit({
      correct,
      given: String(value),
      errorKind: correct ? undefined : Math.abs(value - question.sum) === 1 ? "off_by_one" : "off_by_more",
      title: correct ? "That is the fact!" : "Not quite",
      message: correct && question.helper
        ? `${question.helper.a} and ${question.helper.a} is ${question.helper.sum}, so ${question.a} and ${question.b} is ${question.sum}.`
        : `${question.a} and ${question.b} is ${question.sum}.`,
    });
  };

  const chooseFact = (fact: Fact) => {
    if (round.feedback) return;
    const correct = `${fact.a}+${fact.b}` === question.expected;
    // Choosing the fact they were shown is not a random miss — it is the
    // misunderstanding this lesson is named after.
    const restated = fact.a === question.a && fact.b === question.b;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    round.submit({
      correct,
      given: `${fact.a}+${fact.b}`,
      errorKind: correct ? undefined : restated ? "reversed" : "off_by_more",
      title: correct ? "Same fact, other way round!" : "Look again",
      message: correct
        ? `${question.b} and ${question.a} is the same as ${question.a} and ${question.b}. Both make ${question.sum}.`
        : restated
          ? "That is the fact you started with. The other way round begins with the other number."
          : `The other way round is ${question.b} plus ${question.a}.`,
    });
  };

  const checkMembers = () => {
    if (round.feedback) return;
    const missing = question.members!.filter((_, i) => (members[i] ?? "") === "");
    if (missing.length > 0) {
      refuse(`${missing.length} ${missing.length === 1 ? "fact is" : "facts are"} still empty.`);
      return;
    }
    const given = question.members!.map((_, i) => members[i] ?? "");
    const correct = given.join(",") === question.members!.map((m) => String(m.answer)).join(",");
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    round.submit({
      correct,
      given: given.join(","),
      errorKind: correct ? undefined : "off_by_more",
      title: correct ? "The whole family!" : "Check them again",
      message: `${question.a}, ${question.b} and ${question.sum} make all four facts.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const needsHelper = question.mode === "near_up" || question.mode === "near_down";
  const picking = question.mode === "known_fact" && !revealed;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Fact Deck"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName={question.mode === "family" ? "gem" : "zap"}
      iconTone="pink"
      contextTag={framesSteps ? undefined : null}
      tagLabels={{
        warmup: koda.config.get("warmupLabel", "") || undefined,
        activity: koda.config.get("activityLabel", "") || undefined,
        guided: koda.config.get("guidedLabel", "") || undefined,
        milestone: koda.config.get("milestoneLabel", "") || undefined,
      }}
      hints={factHints(question, { revealed, kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={() => {
        round.useSupport("audio_replay");
        void koda.speech.say(prompt, { rate: koda.config.get("speechRate", 0.95) });
      }}
      recommendation={nextStep}
    >
      <div className="space-y-4">
        <div className={`${SCENE} p-5 sm:p-7 flex flex-col items-center justify-center gap-4 min-h-[190px]`}>
          {/* The fact itself, big enough to be the thing on the screen. */}
          <p className="text-4xl sm:text-5xl font-black tabular-nums text-ink">
            <span className={ADDEND_A.text}>{question.a}</span>
            <span className="text-ink/35"> + </span>
            <span className={ADDEND_B.text}>{question.b}</span>
            {question.answerShape === "number" && <span className="text-ink/35"> = ?</span>}
          </p>

          {question.mode === "doubles" && scaffold && (
            <div className="flex flex-col gap-2 items-center">
              <DotRow count={question.a} tone={ADDEND_A.solid} label={`${question.a} in the first row`} />
              <DotRow count={question.b} tone={ADDEND_B.solid} label={`${question.b} in the second row`} />
            </div>
          )}

          {needsHelper &&
            (revealed ? (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING.enter}
                className={`text-xl font-black tabular-nums ${TOTAL.text}`}
              >
                {question.helper!.a} + {question.helper!.a} = {question.helper!.sum}
              </motion.p>
            ) : (
              <motion.button
                type="button"
                onClick={revealHelper}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                transition={SPRING.tap}
                aria-label={`Show the double, ${question.a} plus ${question.a}`}
                className={themeSystem.button("secondary", "md")}
              >
                I know {question.a} + {question.a}
              </motion.button>
            ))}

          {picking && (
            <div className="flex flex-wrap justify-center gap-2.5">
              {question.helpers!.map((fact) => (
                <motion.button
                  key={`${fact.a}+${fact.b}`}
                  type="button"
                  onClick={() => chooseHelper(fact)}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                  transition={SPRING.tap}
                  aria-label={`Helper fact ${fact.a} plus ${fact.b}`}
                  className={themeSystem.button("secondary", "choice", "min-w-[6rem]")}
                >
                  {fact.a} + {fact.b}
                </motion.button>
              ))}
            </div>
          )}

          {question.mode === "known_fact" && revealed && (
            <p className={`text-xl font-black tabular-nums ${TOTAL.text}`}>
              {question.helper!.a} + {question.helper!.b} = {question.helper!.sum}
            </p>
          )}

          {question.answerShape === "members" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md">
              {question.members!.map((m, i) => (
                <label key={i} className="flex items-center justify-end gap-2 text-xl font-black tabular-nums text-ink">
                  <span>{m.text}</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={members[i] ?? ""}
                    onChange={(e) =>
                      setMembers((prev) => ({
                        ...prev,
                        [i]: e.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                      }))
                    }
                    disabled={Boolean(round.feedback)}
                    aria-label={`Answer for ${m.text.replace("−", "minus").replace("+", "plus")}`}
                    className={themeSystem.field("md", "w-16 text-center text-xl font-black tabular-nums")}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        {nudge && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.enter}
            role="status"
            className="text-center text-sm font-semibold text-ink/70 px-4"
          >
            {nudge}
          </motion.p>
        )}

        {question.answerShape === "fact" && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {question.choices!.map((fact) => (
              <motion.button
                key={`${fact.a}+${fact.b}`}
                type="button"
                onClick={() => chooseFact(fact)}
                disabled={Boolean(round.feedback)}
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.9 }}
                transition={SPRING.tap}
                aria-label={`${fact.a} plus ${fact.b}`}
                className={themeSystem.button("secondary", "choice", "min-w-[6.5rem]")}
              >
                {fact.a} + {fact.b}
              </motion.button>
            ))}
          </div>
        )}

        {question.answerShape === "members" && (
          <div className="flex justify-center">
            <motion.button
              type="button"
              onClick={checkMembers}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING.tap}
              className={themeSystem.button("primary", "lg")}
            >
              Check
            </motion.button>
          </div>
        )}

        {question.answerShape === "number" && !picking && (
          answerInput === "choices" ? (
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {choicesFor(question.sum).map((n) => (
                <motion.button
                  key={n}
                  type="button"
                  onClick={() => submitNumber(n)}
                  disabled={Boolean(round.feedback)}
                  whileHover={{ scale: 1.08, y: -2 }}
                  whileTap={{ scale: 0.88 }}
                  transition={SPRING.tap}
                  className={themeSystem.button("secondary", "choice")}
                >
                  {n}
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <span
                  className={`min-w-[5rem] h-14 px-4 rounded-2xl border-2 border-dashed ${CHANGE.border} flex items-center justify-center text-3xl font-black tabular-nums text-ink`}
                  aria-label={`Answer ${entry || "empty"}`}
                >
                  {entry || <span className="text-ink/25">?</span>}
                </span>
              </div>
              <NumberPad
                onDigit={(d) => setEntry((v) => `${v}${d}`.slice(0, 3))}
                onDelete={() => setEntry((v) => v.slice(0, -1))}
                disabled={Boolean(round.feedback)}
              />
              <div className="flex justify-center">
                <motion.button
                  type="button"
                  onClick={() => (entry === "" ? refuse("Type your answer first.") : submitNumber(Number(entry)))}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING.tap}
                  className={themeSystem.button("primary", "lg")}
                >
                  Check
                </motion.button>
              </div>
            </div>
          )
        )}
      </div>
    </SkillRound>
  );
};
