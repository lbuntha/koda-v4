import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps , PrintedQuestion } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  stagger,
  useSkillRound,
  type RoundQuestion,
  playChrome,
  guideSetup,
  useGuide,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { ADDEND_A, CHANGE, TOTAL } from "../internal/data/additionPalette";
import { CHIP, SCENE } from "../internal/data/additionLayout";
import { useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import { isPractice, modeAt, type PracticeSetup } from "../../kit";
import { NumberPad } from "../internal/ui/NumberPad";
import {
  drawChain,
  drawFriendlyChain,
  friendlyPairCount,
  numberWord,
  total as sumOf,
} from "../internal/data/additionNumbers";
import { ta } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * More than two numbers, and the freedom to take them in any order.
 *
 * Every mode here rests on one idea a child has already met — that addition
 * does not care about order — and turns it into a choice worth making. Two
 * numbers that make ten are worth finding first; four numbers are easier in
 * some orders than others; and a total you carry as you go is what makes a long
 * chain possible at all.
 *
 * Chips merge by tap-then-tap, and the merged chip *says* its new value. A
 * child who taps 6 and 4 should see a 10 appear, because the ten is the whole
 * reason those two were worth pairing.
 */

export type ChainMode = "pairs" | "chain" | "compatible" | "running";

export interface ChainSetup extends PracticeSetup {
  mode?: ChainMode;
  /** How many numbers to start with. */
  count?: number;
  addendRange?: [number, number];
  totalMax?: number;
  /** `pairs` and `compatible`: what a friendly pair adds up to. */
  target?: 10 | 100;
  /** `compatible`: how many such pairs are hidden in the chain. */
  pairsWanted?: number;
  questionsPerRound?: number;
}

export interface ChainBoardParams extends ChainSetup {
  question?: ChainSetup;
}

/** One number on the board. Merged chips keep the ids they were made from. */
export interface Chip {
  id: string;
  value: number;
  /** True once this chip is the result of a merge. */
  merged: boolean;
}

export interface ChainQuestion extends RoundQuestion {
  mode: ChainMode;
  values: number[];
  sum: number;
  /** `pairs` / `compatible`: what two chips must add up to. */
  target?: number;
  /** `compatible`: how many pairs are there to find. */
  pairsWanted?: number;
}

const chipsFrom = (values: number[]): Chip[] =>
  values.map((value, i) => ({ id: `c${i}`, value, merged: false }));

export const buildQuestion = (
  setup: ChainSetup,
  index: number,
  seen: Set<string>,
): ChainQuestion => {
  const mode = modeAt<ChainMode>(setup, index, "pairs");
  const target = setup.target ?? 10;
  const count = setup.count ?? (mode === "compatible" ? 5 : mode === "running" ? 4 : 4);
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `chain_${mode}` };

  const values =
    mode === "pairs" || mode === "compatible"
      ? drawFriendlyChain(count, target, mode === "compatible" ? (setup.pairsWanted ?? 2) : 1)
      : drawChain(count, {
          addendRange: setup.addendRange ?? [2, 15],
          totalMax: setup.totalMax ?? 60,
        });

  const key = values.slice().sort((a, b) => a - b).join("+");
  if (seen.has(key)) {
    // The chain is drawn from a small pool, so a repeat is likely enough to be
    // worth one more try — and cheap enough not to be worth more than that.
    const retry = mode === "pairs" || mode === "compatible"
      ? drawFriendlyChain(count, target, mode === "compatible" ? (setup.pairsWanted ?? 2) : 1)
      : drawChain(count, { addendRange: setup.addendRange ?? [2, 15], totalMax: setup.totalMax ?? 60 });
    if (retry.slice().sort((a, b) => a - b).join("+") !== key) values.splice(0, values.length, ...retry);
  }
  seen.add(values.slice().sort((a, b) => a - b).join("+"));

  const sum = sumOf(values);
  return {
    ...base,
    mode,
    values,
    sum,
    target: mode === "pairs" || mode === "compatible" ? target : undefined,
    pairsWanted: mode === "compatible" ? (setup.pairsWanted ?? 2) : undefined,
    expected: String(sum),
    itemCount: values.length,
  };
};

export const promptFor = (q: ChainQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{sum}", String(q.sum))
    .replaceAll("{count}", String(q.values.length))
    .replaceAll("{target}", String(q.target ?? 10))
    .replaceAll("{list}", q.values.join(" + "));
  if (filled) return filled;

  switch (q.mode) {
    case "pairs":
      return ta("chain.promptPairs", { target: q.target ?? 10 });
    case "compatible":
      return ta("chain.promptCompatible", { target: q.target ?? 10 });
    case "running":
      return ta("chain.promptRunning");
    default:
      return ta("chain.prompt");
  }
};


/**
 * On paper.
 *
 * The chain is the question, and the round's prompt never said it: "Add these
 * in whatever order is easiest" printed beside a blank line is the clearest
 * example in this skill of a caption standing in for a question. The numbers go
 * on the page.
 */
export const printedFor = (q: ChainQuestion): PrintedQuestion => {
  const chain = q.values.join(" + ");
  const answer = String(q.sum);
  switch (q.mode) {
    case "pairs":
      return { text: ta("chain.printedPairs", { chain, target: q.target ?? 10 }), answer };
    case "compatible":
      return { text: ta("chain.printedCompatible", { chain, target: q.target ?? 10 }), answer };
    case "running":
      return { text: ta("chain.printedRunning", { chain }), answer };
    default:
      return { text: `${chain} =`, answer };
  }
};

/**
 * How this technique goes, for a sheet that has to teach it.
 *
 * Written for paper: no control is named, nothing is tapped, and each line is
 * something a child could do with a pencil or in their head. See `method` on
 * `WorksheetSource` for why this is not the lesson's own `stepByStep`.
 */
export const methodFor = (q: ChainQuestion): string[] => {
  const target = q.target ?? 10;
  switch (q.mode) {
    case "pairs":
      return [ta("chain.methodPairs1", { target }), ta("chain.methodPairs2"), ta("chain.methodPairs3")];
    case "compatible":
      return [ta("chain.methodCompatible1", { target }), ta("chain.methodCompatible2")];
    case "running":
      return [ta("chain.methodRunning1"), ta("chain.methodRunning2")];
    default:
      return [ta("chain.method1"), ta("chain.method2")];
  }
};

export function chainHints(
  q: ChainQuestion,
  state: { chips: Chip[]; step: number; kidTip?: string },
): string[] {
  const left = state.chips.length;
  const friendly = q.target ? friendlyPairCount(state.chips.map((c) => c.value), q.target) : 0;

  switch (q.mode) {
    case "pairs":
    case "compatible":
      return composeHints(
        state.kidTip ?? ta("chain.hintPairsTip", { target: q.target ?? 10 }),
        friendly > 0
          ? ta("chain.hintPairsLeft", { count: friendly, target: q.target ?? 10 })
          : left > 1
            ? ta("chain.hintNoPairs")
            : ta("chain.hintOneChip"),
        // The pairs are the technique, and the two lessons want different
        // things of them: one pair to spot, or every pair on the board.
        q.mode === "compatible"
          ? ta("chain.hintJoinEvery", { target: q.target ?? 10, sum: q.sum })
          : ta("chain.hintJoinPair", { target: q.target ?? 10, sum: q.sum }),
      );
    case "running":
      return composeHints(
        state.kidTip ?? ta("chain.hintRunningTip"),
        state.step === 0
          ? ta("chain.hintStart", { first: q.values[0], second: q.values[1] })
          : ta("chain.hintAt", {
              at: q.values.slice(0, state.step + 1).reduce((t, n) => t + n, 0),
              next: q.values[state.step + 1] ?? 0,
            }),
        ta("chain.hintRunningOn", {
          run: q.values.map((_, i) => q.values.slice(0, i + 1).reduce((t, n) => t + n, 0)).join(", "),
        }),
      );
    default:
      return composeHints(
        state.kidTip ?? ta("chain.hintTip"),
        left > 1 ? ta("chain.hintTapTwo", { left }) : ta("chain.hintHoldsTotal"),
        ta("chain.hintJoined", { sum: q.sum }),
      );
  }
}

/** One number on the board. Held state is a ring and a lift, never colour alone. */
const ChipButton: React.FC<{
  chip: Chip;
  /** 1-based place on the board, so two chips of the same value are tellable. */
  position: number;
  held: boolean;
  onTap: () => void;
  delay: number;
  disabled: boolean;
}> = ({ chip, position, held, onTap, delay, disabled }) => (
  <motion.button
    type="button"
    onClick={onTap}
    disabled={disabled}
    layout
    initial={{ opacity: 0, scale: 0.7 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ ...SPRING.enter, delay }}
    whileHover={disabled ? undefined : { scale: 1.06, y: -2 }}
    whileTap={disabled ? undefined : { scale: 0.92 }}
    /* Position as well as value: a board can hold two fives, and "Chip 5"
       twice leaves a screen-reader user with no way to say which one they
       mean — nor any way to pick the second. */
    aria-label={ta("chain.chipLabel", { position, value: chip.value })}
    aria-pressed={held}
    className={`${CHIP} rounded-2xl text-2xl font-black tabular-nums flex items-center justify-center border-2 ${
      held
        ? `${CHANGE.soft} ${CHANGE.border} ring-4 ring-rose-400/50 -translate-y-1 shadow-xl`
        : chip.merged
          ? `${TOTAL.soft} ${TOTAL.border} ${TOTAL.text}`
          : `${ADDEND_A.soft} ${ADDEND_A.border} ${ADDEND_A.text}`
    }`}
  >
    {chip.value}
  </motion.button>
);

export const ChainBoard: React.FC<ActivityProps<ChainBoardParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: ChainSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());
  const nudge = useNudge(koda);

  const [chips, setChips] = useState<Chip[]>([]);
  const [held, setHeld] = useState<string | null>(null);
  /** `running`: which addend the child is up to. */
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState<string[]>([]);
  const [active, setActive] = useState(0);
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

  const question = round.question as ChainQuestion;

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
    setChips(chipsFrom(question.values));
    setHeld(null);
    setStep(0);
    setActive(0);
    setEntries(Array(Math.max(0, question.values.length - 1)).fill(""));
    nudge.clear();
    // `nudge` is stable per mount; listing it would reset the board on a refusal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, question.values]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    setChips(chipsFrom(question.values));
    setHeld(null);
    setStep(0);
    setActive(0);
    setEntries(Array(Math.max(0, question.values.length - 1)).fill(""));
    nudge.clear();
  };


  // Practice says nothing at all, on top of the family's own voice switch.
  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const showsTotal = koda.config.isEnabled("running_total_badge", true);


  /**
   * Tap one chip, then another, and the two become one.
   *
   * The same grammar as every other placement in this skill: the first tap
   * holds, the second acts, and tapping the held chip again puts it down.
   */
  const tapChip = (chip: Chip) => {
    if (round.feedback) return;
    if (held === null) {
      setHeld(chip.id);
      playChrome(koda, "clink");
      return;
    }
    if (held === chip.id) {
      setHeld(null);
      return;
    }

    const first = chips.find((c) => c.id === held)!;
    const merged = first.value + chip.value;
    setChips((prev) => [
      ...prev.filter((c) => c.id !== held && c.id !== chip.id),
      { id: `${first.id}+${chip.id}`, value: merged, merged: true },
    ]);
    setHeld(null);
    koda.haptics.tap();
    playChrome(koda, question.target && merged === question.target ? "success" : "pop");
    // The merged chip says what it became — the ten is the reason the pair was
    // worth finding, so it should be heard as well as seen.
    if (speaks) void koda.speech.say(numberWord(merged), speechRate(koda));
  };

  const submitTotal = (given: number) => {
    const correct = given === question.sum;
    playChrome(koda, correct ? "success" : "error");
    correct ? koda.haptics.success() : koda.haptics.tap();
    submit({
      correct,
      given: String(given),
      errorKind: correct ? undefined : Math.abs(given - question.sum) === 1 ? "off_by_one" : "off_by_more",
      title: correct ? ta("chain.totalTitle") : ta("notQuite"),
      message: ta("chain.listIs", { list: question.values.join(" + "), sum: question.sum }),
    });
  };

  const checkBoard = () => {
    if (round.feedback) return;
    if (chips.length > 1) {
      guide.stumbled();
      nudge.refuse(
        ta("chain.refuseBoard", { count: chips.length }),
      );
      return;
    }
    submitTotal(chips[0]?.value ?? 0);
  };

  /** `running`: every partial is checked, but the round hears one answer. */
  const checkRunning = () => {
    if (round.feedback) return;
    const missing = entries.findIndex((e) => e === "");
    if (missing !== -1) {
      guide.stumbled();
      nudge.refuse(ta("chain.refuseStep", { step: missing + 1 }));
      return;
    }
    const wanted = question.values
      .slice(1)
      .map((_, i) => question.values.slice(0, i + 2).reduce((t, n) => t + n, 0));
    const correct = entries.join(",") === wanted.map(String).join(",");
    playChrome(koda, correct ? "success" : "error");
    correct ? koda.haptics.success() : koda.haptics.tap();
    const firstWrong = entries.findIndex((e, i) => e !== String(wanted[i]));
    submit({
      correct,
      // Every step, so the log holds where a long chain actually went wrong.
      given: entries.join(","),
      errorKind: correct ? undefined : "off_by_more",
      title: correct ? ta("chain.keptTitle") : ta("chain.checkSteps"),
      message: correct
        ? ta("chain.listIs", { list: question.values.join(" + "), sum: question.sum })
        : ta("chain.stepShould", { step: firstWrong + 1, value: wanted[firstWrong] ?? 0 }),
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const running = question.mode === "running";

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived, rather than two systems with two vocabularies.
   */
  const hints = practising ? [] : chainHints(question, { chips, step, kidTip: copy.kidTip });
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
    target: -1,
    progress: step + (question.values?.length ?? 0) - chips.length,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={ta("chain.title")}
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="waves"
      iconTone="cyan"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (step > 0 || held !== null || entries.some((e) => e !== "")) ? restart : undefined
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
        <div className={`${SCENE} p-5 sm:p-7 space-y-4`}>
          {running ? (
            <div className="space-y-2.5">
              {question.values.map((value, i) => (
                <div key={i} className="flex items-center justify-center gap-3">
                  <span className={`${CHIP} rounded-2xl border-2 ${ADDEND_A.soft} ${ADDEND_A.border} ${ADDEND_A.text} text-2xl font-black tabular-nums flex items-center justify-center`}>
                    {value}
                  </span>
                  {i > 0 && (
                    <>
                      <span className="text-xl font-black text-ink/35">=</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={entries[i - 1] ?? ""}
                        onFocus={() => setActive(i - 1)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                          setEntries((prev) => prev.map((v, j) => (j === i - 1 ? digits : v)));
                          setStep(i - 1);
                        }}
                        disabled={Boolean(round.feedback)}
                        aria-label={ta("chain.totalAfter", { value })}
                        className={themeSystem.field("md", "w-20 text-center text-xl font-black tabular-nums")}
                      />
                    </>
                  )}
                  {i === 0 && (
                    <span className="text-sm font-bold uppercase tracking-wide text-ink/45">
                      start here
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 min-h-[5rem]">
              {chips.map((chip, i) => (
                <ChipButton
                  key={chip.id}
                  chip={chip}
                  position={i + 1}
                  held={held === chip.id}
                  disabled={Boolean(round.feedback)}
                  onTap={() => tapChip(chip)}
                  delay={stagger(i)}
                />
              ))}
            </div>
          )}

          {scaffold && question.target && chips.length > 1 && (
            <p className="text-center text-sm font-bold text-ink/55">
              {friendlyPairCount(chips.map((c) => c.value), question.target) > 0
                ? ta("chain.stillPair", { target: question.target })
                : ta("chain.noPairsLeft")}
            </p>
          )}

          {showsTotal && !running && (
            <motion.p
              key={chips.length}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.celebrate}
              aria-live="polite"
              className={`text-center text-sm font-bold ${TOTAL.text}`}
            >
              {ta("chain.onBoard", { count: chips.length })}
            </motion.p>
          )}
        </div>

        {running && (
          <NumberPad
            onDigit={(d) =>
              setEntries((prev) => prev.map((v, j) => (j === active ? `${v}${d}`.slice(0, 4) : v)))
            }
            onDelete={() =>
              setEntries((prev) => prev.map((v, j) => (j === active ? v.slice(0, -1) : v)))
            }
            disabled={Boolean(round.feedback)}
          />
        )}

        <div className="flex justify-center">
          <motion.button
            type="button"
            onClick={running ? checkRunning : checkBoard}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            transition={SPRING.tap}
            className={themeSystem.button("primary", "lg")}
          >
            {ta("check")}
          </motion.button>
        </div>
      </div>
    </SkillRound>
  );
};
