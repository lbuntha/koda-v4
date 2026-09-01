import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  stagger,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { ADDEND_A, CHANGE, TOTAL } from "../internal/data/additionPalette";
import { CHIP, SCENE } from "../internal/data/additionLayout";
import { NudgeLine, useNudge } from "../internal/ui/useNudge";
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
      return `Two of these make ${q.target}. Put those together first.`;
    case "compatible":
      return `Find the pairs that make ${q.target}, then add the rest.`;
    case "running":
      return "Add them one at a time, keeping the total as you go.";
    default:
      return "Add these in whatever order is easiest.";
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
        state.kidTip ?? `Look for two that make ${q.target} and put those together first.`,
        friendly > 0
          ? `There ${friendly === 1 ? "is still a pair" : `are still ${friendly} pairs`} that make ${q.target}. Tap one number, then the number that finishes it.`
          : left > 1
            ? `No pairs left to find. Add what is on the board in any order.`
            : `One chip left. That is the total.`,
        `Altogether they make ${q.sum}.`,
      );
    case "running":
      return composeHints(
        state.kidTip ?? "Keep the total in your head and add the next one to it.",
        state.step === 0
          ? `Start with ${q.values[0]}, then add ${q.values[1]}.`
          : `You are at ${q.values.slice(0, state.step + 1).reduce((t, n) => t + n, 0)}. Add ${q.values[state.step + 1] ?? 0} to that.`,
        `Running on: ${q.values.map((_, i) => q.values.slice(0, i + 1).reduce((t, n) => t + n, 0)).join(", ")}.`,
      );
    default:
      return composeHints(
        state.kidTip ?? "Add them in whatever order is easiest — the total is the same.",
        left > 1
          ? `Tap two numbers to put them together. ${left} chips left.`
          : `One chip left, and it holds the total.`,
        `Altogether they make ${q.sum}.`,
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
    aria-label={`Chip ${position}, value ${chip.value}`}
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

  // Practice says nothing at all, on top of the family's own voice switch.
  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const showsTotal = koda.config.isEnabled("running_total_badge", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };

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
      chime("clink");
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
    if (vibrates) koda.haptics.tap();
    chime(question.target && merged === question.target ? "success" : "pop");
    // The merged chip says what it became — the ten is the reason the pair was
    // worth finding, so it should be heard as well as seen.
    if (speaks) void koda.speech.say(numberWord(merged), speechRate(koda));
  };

  const submitTotal = (given: number) => {
    const correct = given === question.sum;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    submit({
      correct,
      given: String(given),
      errorKind: correct ? undefined : Math.abs(given - question.sum) === 1 ? "off_by_one" : "off_by_more",
      title: correct ? "That is the total!" : "Not quite",
      message: `${question.values.join(" + ")} is ${question.sum}.`,
    });
  };

  const checkBoard = () => {
    if (round.feedback) return;
    if (chips.length > 1) {
      nudge.refuse(
        `${chips.length} numbers are still on the board. Tap two at a time to put them together.`,
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
      nudge.refuse(`Step ${missing + 1} is still empty. Add each number in turn.`);
      return;
    }
    const wanted = question.values
      .slice(1)
      .map((_, i) => question.values.slice(0, i + 2).reduce((t, n) => t + n, 0));
    const correct = entries.join(",") === wanted.map(String).join(",");
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    const firstWrong = entries.findIndex((e, i) => e !== String(wanted[i]));
    submit({
      correct,
      // Every step, so the log holds where a long chain actually went wrong.
      given: entries.join(","),
      errorKind: correct ? undefined : "off_by_more",
      title: correct ? "You kept the total!" : "Check the steps",
      message: correct
        ? `${question.values.join(" + ")} is ${question.sum}.`
        : `Step ${firstWrong + 1} should be ${wanted[firstWrong]}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const running = question.mode === "running";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Chains and Pairs"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="waves"
      iconTone="cyan"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      hints={practising ? [] : chainHints(question, { chips, step, kidTip: copy.kidTip })}
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
                        aria-label={`Total after adding ${value}`}
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
                ? `There is still a pair that makes ${question.target}.`
                : `No pairs left — add what is on the board.`}
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
              {chips.length === 1 ? "One number left" : `${chips.length} numbers on the board`}
            </motion.p>
          )}
        </div>

        <NudgeLine nudge={nudge} />

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
            Check
          </motion.button>
        </div>
      </div>
    </SkillRound>
  );
};
