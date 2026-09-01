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
import { ADDEND_A, ADDEND_B } from "../internal/data/additionPalette";
import { FRAME_CELL, SCENE } from "../internal/data/additionLayout";
import { NudgeLine, useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import { isPractice, modeAt, type PracticeSetup } from "../../kit";
import {
  drawPair,
  numberWord,
  pairKey,
  withoutRepeat,
  type PairSpec,
} from "../internal/data/additionNumbers";

/**
 * A five- or ten-frame: the first structure a child adds inside.
 *
 * A frame is not decoration around the counters — it is the thing being
 * taught. Five in a row is seen rather than counted, and ten as two rows of
 * five is what makes "how many more to ten" a question with a shape. So the
 * grid stays, and it is the one container on the screen.
 *
 * Four modes, two of which ask a different question from the other two, and
 * the difference is the entire lesson: `five` and `ten` ask for the **total**,
 * `make_five` and `make_ten` ask **how many more were needed**. Getting that
 * backwards is the likeliest bug in this engine, so the prompt, the `expected`
 * and the feedback are all derived from one place.
 */

export type FrameMode = "five" | "ten" | "make_five" | "make_ten";

export interface FrameSetup extends PracticeSetup {
  mode?: FrameMode;
  /** How many arrive already in the frame. */
  aRange?: [number, number];
  /** `five` / `ten`: how many the child adds. */
  bRange?: [number, number];
  addendRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface FrameFillParams extends FrameSetup {
  question?: FrameSetup;
}

export interface FrameQuestion extends RoundQuestion {
  mode: FrameMode;
  /** Cells that arrive filled, in the first addend's colour. */
  given: number;
  /** What the child adds. For the make modes this is the answer. */
  added: number;
  /** 5 or 10 — how many cells the frame has. */
  size: 5 | 10;
  /** What the child is asked for: the whole frame, or the part they added. */
  asks: "total" | "added";
}

/** How big the frame is, and what it is for. Held per mode, never inherited. */
const DEFAULT_SPEC: Record<FrameMode, PairSpec> = {
  five: { addendRange: [1, 4], sumMax: 5 },
  ten: { addendRange: [1, 9], sumMax: 10 },
  make_five: { aRange: [1, 4], bRange: [1, 4], sumMin: 5, sumMax: 5 },
  make_ten: { aRange: [1, 9], bRange: [1, 9], sumMin: 10, sumMax: 10 },
};

const SIZE: Record<FrameMode, 5 | 10> = {
  five: 5,
  ten: 10,
  make_five: 5,
  make_ten: 10,
};

/** Only the keys a lesson actually set. An absent key changes nothing. */
const declared = (setup: FrameSetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: FrameMode, setup: FrameSetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  // A make-question is only a make-question if the two parts reach the frame
  // exactly. A lesson may narrow the ranges; it may not change the target.
  if (mode === "make_five") {
    spec.sumMin = 5;
    spec.sumMax = 5;
  }
  if (mode === "make_ten") {
    spec.sumMin = 10;
    spec.sumMax = 10;
  }
  return spec;
};

export const buildQuestion = (
  setup: FrameSetup,
  index: number,
  seen: Set<string>,
): FrameQuestion => {
  const mode = modeAt<FrameMode>(setup, index, "ten");
  const pair = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
  const asks = mode === "make_five" || mode === "make_ten" ? "added" : "total";

  return {
    id: `q${index}-${Date.now().toString(36)}`,
    taskKind: `frame_${mode}`,
    mode,
    size: SIZE[mode],
    given: pair.a,
    added: pair.b,
    asks,
    // The one place the two questions diverge. Everything else — the prompt,
    // the feedback, the hint — reads it from here rather than re-deciding.
    expected: String(asks === "total" ? pair.sum : pair.b),
    itemCount: pair.sum,
  };
};

export const promptFor = (q: FrameQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.given))
    .replaceAll("{b}", String(q.added))
    .replaceAll("{size}", String(q.size))
    .replaceAll("{sum}", String(q.given + q.added));
  if (filled) return filled;

  return q.asks === "added"
    ? `You have ${q.given}. How many more to make ${q.size}?`
    : `Fill in ${q.added} more. How many are there altogether?`;
};

export function frameHints(
  q: FrameQuestion,
  state: { filled: number; kidTip?: string },
): string[] {
  const empty = q.size - state.filled;
  const placed = state.filled - q.given;

  if (q.asks === "added") {
    return composeHints(
      state.kidTip ?? `Fill the frame right up. Count only the ones you put in.`,
      placed <= 0
        ? `${q.given} spaces are already taken. Tap the empty ones until the frame is full — there ${empty === 1 ? "is 1" : `are ${empty}`} left.`
        : `You have put in ${placed} and there ${empty === 1 ? "is 1 space" : `are ${empty} spaces`} still empty. Keep going until the frame is full, then count only the ones you added.`,
      // Stops at the method: the child produces this answer by filling, so
      // naming it would do the filling for them.
      `A full frame holds ${q.size}. ${q.given} were there to start with, so the answer is however many you had to add.`,
    );
  }

  return composeHints(
    state.kidTip ?? "The frame is already counted. Count on from the number in it.",
    state.filled <= q.given
      ? `There ${q.given === 1 ? "is 1 counter" : `are ${q.given} counters`} in the frame. Tap ${q.added} more empty spaces.`
      : `You have added ${placed} of ${q.added}. Do not count the frame again — carry on from ${q.given}.`,
    `Start at ${q.given} and count on ${q.added}: ${Array.from({ length: q.added }, (_, i) => q.given + i + 1).join(", ")}.`,
  );
}

/**
 * One cell.
 *
 * Labelled exactly as counting's ten-frame labels its cells, so a test driver
 * written for one works on the other and a child moving between the two skills
 * meets the same control.
 */
const Cell: React.FC<{
  position: number;
  state: "given" | "added" | "empty";
  onTap?: () => void;
  delay: number;
}> = ({ position, state, onTap, delay }) => {
  const filled = state !== "empty";
  const role = state === "given" ? ADDEND_A : ADDEND_B;
  return (
    <motion.button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      whileHover={onTap ? { scale: 1.05 } : undefined}
      whileTap={onTap ? { scale: 0.9 } : undefined}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING.enter, delay }}
      aria-label={`Space ${position}${filled ? ", filled" : ", empty"}`}
      className={`${FRAME_CELL} rounded-2xl border-2 flex items-center justify-center transition-colors ${
        filled ? `${role.solid} ${role.border} shadow-lg` : "bg-surface/70 border-line"
      }`}
    >
      {filled && (
        /* A plain disc, deliberately. A frame works because ten identical
           counters in a fixed 5+5 grid can be read as a quantity without
           counting; a picture with its own outline is what stops that. */
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={SPRING.celebrate}
          className="block w-2/3 aspect-square rounded-full bg-white/95 shadow-inner"
        />
      )}
    </motion.button>
  );
};

export const FrameFill: React.FC<ActivityProps<FrameFillParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: FrameSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());

  const [filled, setFilled] = useState(0);
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

  const question = round.question as FrameQuestion;

  /**
   * Report an answer.
   *
   * In practice the verdict stands on its own — a child working unaided is not
   * being walked through what happened, and an explanation after every question
   * would put the scaffolding back one sentence at a time.
   */
  const submit = (outcome: Parameters<typeof round.submit>[0]) =>
    round.submit(practising ? { ...outcome, message: undefined } : outcome);

  // Each question arrives with its given counters already in the frame.
  useEffect(() => {
    setFilled(question.given);
    nudge.clear();
  }, [question.id, question.given]);


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


  const fillNext = () => {
    if (round.feedback || filled >= question.size) return;
    const next = filled + 1;
    setFilled(next);
    if (vibrates) koda.haptics.tap();
    chime("pop");
    if (speaks) {
      // The number the counter just made, which is the whole point of the tap.
      void koda.speech.say(numberWord(next), speechRate(koda));
    }
  };

  const check = () => {
    if (round.feedback) return;
    const added = filled - question.given;
    if (added <= 0) {
      nudge.refuse(
        question.asks === "added"
          ? `Nothing has been added yet. Tap the empty spaces until the frame is full.`
          : `Tap ${question.added} empty spaces to add them to the frame.`,
      );
      return;
    }

    const given = question.asks === "added" ? added : filled;
    const correct = String(given) === question.expected;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();

    submit({
      correct,
      given: String(given),
      errorKind: correct
        ? undefined
        : Math.abs(given - Number(question.expected)) === 1
          ? "off_by_one"
          : "off_by_more",
      title: correct ? "That is right!" : "Not quite",
      message: correct
        ? question.asks === "added"
          ? `${question.given} and ${question.added} fill the frame — ${question.given} needs ${question.added} more to make ${question.size}.`
          : `${question.given} and ${question.added} altogether is ${filled}.`
        : question.asks === "added"
          ? `The frame holds ${question.size}. With ${question.given} already in it, ${question.added} more fill it.`
          : `${question.given} and ${question.added} is ${question.given + question.added}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const rows = question.size === 5 ? 1 : 2;
  const emptyLeft = question.size - filled;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Five and Ten Frames"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName={question.size === 5 ? "layers" : "boxes"}
      iconTone="purple"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      hints={practising ? [] : frameHints(question, { filled, kidTip: copy.kidTip })}
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
        <div className={`${SCENE} p-5 sm:p-7 flex flex-col items-center justify-center gap-4`}>
          {/* The frame itself is the one container on this screen, and it is
              the manipulative rather than a box drawn around one. */}
          <div
            className="grid gap-2 sm:gap-2.5"
            style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", width: "min(100%, 26rem)" }}
          >
            {Array.from({ length: rows * 5 }, (_, i) => {
              const state = i < question.given ? "given" : i < filled ? "added" : "empty";
              return (
                <Cell
                  key={i}
                  position={i + 1}
                  state={state}
                  onTap={state === "empty" && !round.feedback ? fillNext : undefined}
                  delay={stagger(i)}
                />
              );
            })}
          </div>

          {scaffold && (
            /* What the frame is showing, in numbers, under the frame it is
               showing it in. Off, the child answers from the counters alone. */
            <p className="text-sm font-bold text-ink/60 tabular-nums">
              {question.given} in the frame
              {filled > question.given ? ` · ${filled - question.given} added` : ""}
              {emptyLeft > 0 ? ` · ${emptyLeft} empty` : " · full"}
            </p>
          )}

          {showsTotal && (
            <motion.span
              key={filled}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.celebrate}
              aria-live="polite"
              className="text-4xl font-black tabular-nums leading-none text-emerald-700 dark:text-emerald-400"
            >
              {question.asks === "added" ? filled - question.given : filled}
            </motion.span>
          )}
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
      </div>
    </SkillRound>
  );
};
