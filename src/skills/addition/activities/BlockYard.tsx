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
import { BLOCK_FLAT, BLOCK_ROD, BLOCK_UNIT, SCENE } from "../internal/data/additionLayout";
import { NudgeLine, useNudge } from "../internal/ui/useNudge";
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
 * Flats, rods and units — the size of a number, made of things you can move.
 *
 * The blocks are in proportion to each other rather than to the screen: a rod
 * is visibly ten units and a flat is visibly ten rods, because a picture whose
 * pieces are not in that ratio is a diagram of place value rather than a model
 * of it, and a child can only *see* the exchange if the ten really is ten.
 *
 * Five modes on one yard. Two of them are about building a number; two are
 * about the tens and hundreds you can build with one kind of block alone; and
 * two are the exchange itself — the moment ten of one thing becomes one of the
 * next, which is the whole of regrouping and the reason the column algorithm
 * later works at all.
 */

export type BlockMode =
  | "build_add"
  | "multiples_ten"
  | "multiples_hundred"
  | "trade_ones"
  | "trade_tens";

export type Place = "hundreds" | "tens" | "ones";

export interface Built {
  hundreds: number;
  tens: number;
  ones: number;
}

export interface BlockSetup extends PracticeSetup {
  mode?: BlockMode;
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface BlockYardParams extends BlockSetup {
  question?: BlockSetup;
}

export interface BlockQuestion extends RoundQuestion {
  mode: BlockMode;
  a: number;
  b: number;
  sum: number;
  /** Which blocks the tray offers. A tens lesson offers only rods. */
  offers: Place[];
  /** What the yard starts with. Empty when the child builds it themselves. */
  start: Built;
  /** Whether the yard arrives holding ten of something that must be exchanged. */
  trades: boolean;
}

const VALUE: Record<Place, number> = { hundreds: 100, tens: 10, ones: 1 };
const valueOf = (b: Built): number => b.hundreds * 100 + b.tens * 10 + b.ones;
const EMPTY: Built = { hundreds: 0, tens: 0, ones: 0 };

const DEFAULT_SPEC: Record<BlockMode, PairSpec> = {
  build_add: { addendRange: [11, 88], regroup: "never" },
  multiples_ten: { addendRange: [10, 90], multipleOf: 10, sumMax: 100 },
  multiples_hundred: { addendRange: [100, 900], multipleOf: 100, sumMax: 1000 },
  trade_ones: { addendRange: [15, 89], regroup: "ones" },
  trade_tens: { addendRange: [150, 890], regroup: "tens" },
};

const OFFERS: Record<BlockMode, Place[]> = {
  build_add: ["tens", "ones"],
  multiples_ten: ["tens"],
  multiples_hundred: ["hundreds"],
  trade_ones: ["tens", "ones"],
  trade_tens: ["hundreds", "tens"],
};

const declared = (setup: BlockSetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: BlockMode, setup: BlockSetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  // What each mode *is*. A lesson may narrow the numbers; it may not remove the
  // exchange from an exchange lesson, or put one into a lesson without it.
  if (mode === "build_add") spec.regroup = "never";
  if (mode === "trade_ones") spec.regroup = "ones";
  if (mode === "trade_tens") spec.regroup = "tens";
  if (mode === "multiples_ten") spec.multipleOf = 10;
  if (mode === "multiples_hundred") spec.multipleOf = 100;
  return spec;
};

export const buildQuestion = (
  setup: BlockSetup,
  index: number,
  seen: Set<string>,
): BlockQuestion => {
  const mode = modeAt<BlockMode>(setup, index, "build_add");
  const { a, b, sum } = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
  const trades = mode === "trade_ones" || mode === "trade_tens";
  const da = digitsOf(a);
  const db = digitsOf(b);

  return {
    id: `q${index}-${Date.now().toString(36)}`,
    taskKind: `blocks_${mode}`,
    mode,
    a,
    b,
    sum,
    offers: OFFERS[mode],
    /*
     * An exchange lesson starts with both numbers already tipped into the yard,
     * column by column and deliberately un-carried — twelve ones sitting in the
     * ones column is the thing the lesson is about. A building lesson starts
     * empty, because there the work is making the number at all.
     */
    start: trades
      ? { hundreds: da.hundreds + db.hundreds, tens: da.tens + db.tens, ones: da.ones + db.ones }
      : EMPTY,
    trades,
    expected: String(sum),
    itemCount: sum,
  };
};

export const promptFor = (q: BlockQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum));
  if (filled) return filled;

  switch (q.mode) {
    case "trade_ones":
      return `${q.a} plus ${q.b}. Bundle ten ones into a ten, then read the answer.`;
    case "trade_tens":
      return `${q.a} plus ${q.b}. Bundle ten tens into a hundred, then read the answer.`;
    case "multiples_ten":
      return `${q.a} plus ${q.b}. Build the answer out of tens.`;
    case "multiples_hundred":
      return `${q.a} plus ${q.b}. Build the answer out of hundreds.`;
    default:
      return `Build ${q.a} plus ${q.b} out of blocks.`;
  }
};

/** Ten of something waiting to become one of the next thing up. */
export const readyToBundle = (built: Built): Place | null => {
  if (built.ones >= 10) return "ones";
  if (built.tens >= 10) return "tens";
  return null;
};

export function blockHints(
  q: BlockQuestion,
  state: { built: Built; kidTip?: string },
): string[] {
  const bundle = readyToBundle(state.built);
  const have = valueOf(state.built);

  if (q.trades) {
    return composeHints(
      state.kidTip ?? "Ten of one block always becomes one of the next block up.",
      bundle === "ones"
        ? `There are ${state.built.ones} ones in the yard, and a column only holds nine. Bundle ten of them into a single ten.`
        : bundle === "tens"
          ? `There are ${state.built.tens} tens in the yard. Bundle ten of them into one hundred.`
          : `Nothing is left to bundle. Read the blocks: ${state.built.hundreds ? `${state.built.hundreds} hundreds, ` : ""}${state.built.tens} tens and ${state.built.ones} ones.`,
      `${q.a} and ${q.b} is ${q.sum}.`,
    );
  }

  return composeHints(
    state.kidTip ?? "Build each number out of blocks, then read what you have.",
    have === 0
      ? `Start with ${q.a}. Tap blocks in the tray to drop them into the yard.`
      : have < q.sum
        ? `The yard holds ${have}. You need ${q.sum - have} more.`
        : have > q.sum
          ? `The yard holds ${have}, which is ${have - q.sum} too many. Tap a block in the yard to take it back.`
          : `The yard holds ${q.sum}. That is the answer — check it.`,
    `${q.a} and ${q.b} is ${q.sum}.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                      */
/* -------------------------------------------------------------------------- */

const BLOCK_CLASS: Record<Place, string> = {
  hundreds: BLOCK_FLAT,
  tens: BLOCK_ROD,
  ones: BLOCK_UNIT,
};

const BLOCK_NAME: Record<Place, string> = {
  hundreds: "Hundred flat",
  tens: "Ten rod",
  ones: "One unit",
};

/**
 * One block, drawn so its value can be counted rather than taken on trust.
 *
 * A rod shows its ten segments and a flat shows its ten rods. Without that a
 * child is told the rod is ten; with it, they can check.
 */
const Block: React.FC<{ place: Place; tone: string; onTap?: () => void; label: string }> = ({
  place,
  tone,
  onTap,
  label,
}) => (
  <motion.button
    type="button"
    onClick={onTap}
    disabled={!onTap}
    whileHover={onTap ? { scale: 1.06 } : undefined}
    whileTap={onTap ? { scale: 0.9 } : undefined}
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={SPRING.enter}
    aria-label={label}
    className={`${BLOCK_CLASS[place]} rounded-md border-2 ${tone} relative overflow-hidden shrink-0`}
  >
    {place === "tens" &&
      Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="absolute left-0 right-0 border-t border-white/40"
          style={{ top: `${((i + 1) / 10) * 100}%` }}
        />
      ))}
    {place === "hundreds" &&
      Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 bottom-0 border-l border-white/40"
          style={{ left: `${((i + 1) / 10) * 100}%` }}
        />
      ))}
  </motion.button>
);

export const BlockYard: React.FC<ActivityProps<BlockYardParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: BlockSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());

  const [built, setBuilt] = useState<Built>(EMPTY);
  const nudge = useNudge(koda);
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

  const question = round.question as BlockQuestion;

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
    setBuilt(question.start);
    nudge.clear();
  }, [question.id, question.start]);


  // Practice says nothing at all, on top of the family's own voice switch.
  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const showsTotal = koda.config.isEnabled("running_total_badge", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };

  const place = (p: Place) => {
    if (round.feedback) return;
    setBuilt((prev) => ({ ...prev, [p]: prev[p] + 1 }));
    if (vibrates) koda.haptics.tap();
    chime("clink");
  };

  const takeBack = (p: Place) => {
    if (round.feedback) return;
    setBuilt((prev) => ({ ...prev, [p]: Math.max(0, prev[p] - 1) }));
    chime("pop");
  };

  const bundle = () => {
    const ready = readyToBundle(built);
    if (!ready || round.feedback) return;
    setBuilt((prev) =>
      ready === "ones"
        ? { ...prev, ones: prev.ones - 10, tens: prev.tens + 1 }
        : { ...prev, tens: prev.tens - 10, hundreds: prev.hundreds + 1 },
    );
    chime("success");
    if (vibrates) koda.haptics.success();
    if (speaks) {
      void koda.speech.say(
        ready === "ones" ? "10 ones make 1 ten" : "10 tens make 1 hundred",
        speechRate(koda),
      );
    }
  };

  const check = () => {
    if (round.feedback) return;
    const ready = readyToBundle(built);
    if (ready) {
      /*
       * Refused rather than marked wrong. The value in the yard is already the
       * right number — twelve ones *is* twelve — but the child has not finished
       * the thing the lesson is about, and scoring it would say they got the
       * arithmetic wrong when they got the exchange unfinished.
       */
      nudge.refuse(
        ready === "ones"
          ? `There are ${built.ones} ones in the yard. Bundle ten of them into a ten first.`
          : `There are ${built.tens} tens in the yard. Bundle ten of them into a hundred first.`,
      );
      return;
    }

    const have = valueOf(built);
    if (have === 0) {
      nudge.refuse("The yard is empty. Tap blocks in the tray to build the answer.");
      return;
    }

    const correct = have === question.sum;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    submit({
      correct,
      given: String(have),
      errorKind: correct
        ? undefined
        : Math.abs(have - question.sum) % 10 === 0
          ? "place_value"
          : "off_by_more",
      title: correct ? "That is the number!" : "Not quite",
      message: correct
        ? `${question.a} and ${question.b} is ${question.sum}.`
        : `The yard holds ${have}. ${question.a} and ${question.b} is ${question.sum}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const ready = readyToBundle(built);
  const columns: Place[] = ["hundreds", "tens", "ones"];
  const visible = columns.filter(
    (p) => question.offers.includes(p) || built[p] > 0 || p === "hundreds",
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Base-Ten Blocks"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="boxes"
      iconTone="purple"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      hints={practising ? [] : blockHints(question, { built, kidTip: copy.kidTip })}
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
        {scaffold && !question.trades && (
          <p className="text-center text-sm font-bold text-ink/60 tabular-nums">
            <span className={ADDEND_A.text}>{question.a}</span> and{" "}
            <span className={ADDEND_B.text}>{question.b}</span>
          </p>
        )}

        <div className={`${SCENE} p-4 sm:p-6 space-y-4`}>
          {/* The yard: one column per place, so a block can only ever sit where
              its value belongs. */}
          {/* Three columns of blocks, and a hundred-flat is 104px wide on its
              own — on a 360px screen that is the whole width once the scene's
              padding is counted. The yard scrolls sideways rather than the
              page, which is the rule for any content this wide. */}
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 min-h-[150px] min-w-[19rem]">
            {columns.map((p) => (
              <div key={p} className="flex flex-col items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink/45">
                  {p}
                </span>
                <div className="flex flex-wrap items-end justify-center gap-1 min-h-[120px] content-end">
                  {Array.from({ length: built[p] }, (_, i) => (
                    <Block
                      key={i}
                      place={p}
                      tone={
                        p === "hundreds"
                          ? "bg-violet-500 border-violet-300"
                          : p === "tens"
                            ? "bg-sky-500 border-sky-300"
                            : "bg-emerald-500 border-emerald-300"
                      }
                      label={`${BLOCK_NAME[p]} ${i + 1} in the yard`}
                      onTap={round.feedback ? undefined : () => takeBack(p)}
                    />
                  ))}
                </div>
                <span className={`text-lg font-black tabular-nums ${TOTAL.text}`}>{built[p]}</span>
                </div>
              ))}
            </div>
          </div>

          {showsTotal && (
            <motion.p
              key={valueOf(built)}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.celebrate}
              aria-live="polite"
              className={`text-center text-4xl font-black tabular-nums ${TOTAL.text}`}
            >
              {valueOf(built)}
            </motion.p>
          )}
        </div>

        <NudgeLine nudge={nudge} />

        {/* The tray. An exchange lesson has nothing to add — its blocks are
            already in the yard, and the work is turning ten into one. */}
        {!question.trades && (
          <div className="flex flex-wrap items-end justify-center gap-4">
            {question.offers.map((p) => (
              <div key={p} className="flex flex-col items-center gap-1">
                <Block
                  place={p}
                  tone={
                    p === "hundreds"
                      ? "bg-violet-400 border-violet-200"
                      : p === "tens"
                        ? "bg-sky-400 border-sky-200"
                        : "bg-emerald-400 border-emerald-200"
                  }
                  label={`Add a ${BLOCK_NAME[p].toLowerCase()}`}
                  onTap={round.feedback ? undefined : () => place(p)}
                />
                <span className="text-xs font-bold text-ink/50 tabular-nums">+{VALUE[p]}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {ready && (
            <motion.button
              type="button"
              onClick={bundle}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING.tap}
              aria-label={ready === "ones" ? "Bundle ten ones" : "Bundle ten tens"}
              className={themeSystem.button("success", "lg", CHANGE.border)}
            >
              {ready === "ones" ? "Bundle ten ones" : "Bundle ten tens"}
            </motion.button>
          )}
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
