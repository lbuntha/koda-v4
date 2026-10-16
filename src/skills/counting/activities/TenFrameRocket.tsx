import React, { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Rocket } from "lucide-react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  useSkillRound,
  type RoundQuestion,
  isPractice,
  modeAt,
  playChrome,
  guideSetup,
  useGuide,
} from "../../kit";
import { FRAME_CELL, SCENE } from "../internal/data/countingLayout";
import { nextCell, numberWord, skippedTopRow } from "../internal/guide/countGuide";
import { themeSystem } from "../../../lib/themeSystem";
import { tc } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * Ten-frames: build a number in a frame of ten.
 *
 * Three lessons, three jobs — fill a frame to a target, name what is missing
 * from ten, or build a teen out of a full frame plus ones. Which one is a lesson
 * parameter, so the activity never asks what level it is.
 */

export type TenFrameMode = "fill" | "complement" | "teen";

export interface TenFrameSetup {
  mode?: TenFrameMode;
  /** `fill`: how many cells to light. */
  targetRange?: [number, number];
  /** `complement`: how many arrive already filled. */
  initialRange?: [number, number];
  /** `teen`: the number to build, 11–19. */
  teenRange?: [number, number];
  questionsPerRound?: number;
}

export interface TenFrameRocketParams extends TenFrameSetup {
  /** Counting nests a level's generator settings under `question`. */
  question?: TenFrameSetup;
}

export interface FrameQuestion extends RoundQuestion {
  mode: TenFrameMode;
  /** What the child is aiming for: cells to fill, ones to add, or the total. */
  target: number;
  /** `complement` only: how many cells arrive filled. */
  initial?: number;
}

const rangeOr = (range: [number, number] | undefined, lo: number, hi: number) => {
  const [min, max] = range ?? [lo, hi];
  return min + Math.floor(Math.random() * (max - min + 1));
};

export const buildQuestion = (setup: TenFrameSetup, index: number): FrameQuestion => {
  const mode = modeAt<TenFrameMode>(
    { mode: setup.mode, modes: (setup as { modes?: TenFrameMode[] }).modes },
    index,
    "fill",
  );
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `tenframe_${mode}` };

  if (mode === "complement") {
    const initial = rangeOr(setup.initialRange, 2, 8);
    return { ...base, mode, initial, target: 10 - initial, expected: String(10 - initial) };
  }
  if (mode === "teen") {
    const teen = rangeOr(setup.teenRange, 11, 19);
    return { ...base, mode, target: teen, expected: String(teen), itemCount: teen };
  }
  const target = rangeOr(setup.targetRange, 5, 9);
  return { ...base, mode, target, expected: String(target), itemCount: target };
};

/**
 * What to say to a child stuck on a ten-frame.
 *
 * The ten-frame teaches by its shape — five on top, five below, ten in all — so
 * every rung here is said in terms of that shape rather than in arithmetic. "7
 * is a full top row and 2 more" is the thing being taught; "7 minus 5 is 2" is
 * the thing a child who already understood it would say.
 *
 * The middle rung reads the frame as it stands, so a child who has filled four
 * is told what to do from four. Pure and exported, so the arithmetic in the
 * wording is tested rather than eyeballed.
 */
/** The question in words, as the round says it. */
export const promptFor = (q: FrameQuestion): string =>
  q.mode === "complement"
    ? tc("tenframe.promptComplement", { initial: q.initial ?? 0 })
    : q.mode === "teen"
      ? tc("tenframe.promptTeen", { target: q.target })
      : tc("tenframe.promptFill", { target: q.target });

/**
 * On paper.
 *
 * `fill` and `teen` ask the child to *make* a number, which a pencil does as
 * well as a finger — so the printed question asks them to draw it, and the key
 * says what a finished frame looks like. `complement` is the one that asks for
 * a number back, and it is printed as the question it is.
 */
export const printedFor = (q: FrameQuestion): PrintedQuestion => {
  switch (q.mode) {
    case "complement":
      return {
        text: tc("tenframe.printedComplement", { initial: q.initial ?? 0 }),
        answer: String(q.target),
      };
    case "teen":
      return {
        text: tc("tenframe.printedTeen", { target: q.target }),
        answer: tc("tenframe.printedTeenAnswer", { target: q.target, ones: q.target - 10 }),
      };
    default:
      return {
        text: tc("tenframe.printedFill", { target: q.target }),
        answer:
          q.target > 5
            ? tc("tenframe.printedFillAnswerBelow", { target: q.target, top: 5, below: q.target - 5 })
            : tc("tenframe.printedFillAnswer", { target: q.target, top: q.target }),
      };
  }
};

/** How the technique goes, in paper words. */
export const methodFor = (q: FrameQuestion): string[] => {
  switch (q.mode) {
    case "complement":
      return [tc("tenframe.methodComplement1"), tc("tenframe.methodComplement2"), tc("tenframe.methodComplement3")];
    case "teen":
      return [tc("tenframe.methodTeen1"), tc("tenframe.methodTeen2"), tc("tenframe.methodTeen3")];
    default:
      return [tc("tenframe.methodFill1"), tc("tenframe.methodFill2"), tc("tenframe.methodFill3")];
  }
};

/**
 * The frame, drawn for a pencil.
 *
 * Empty where the child is doing the filling, and pre-filled only where the
 * lesson gives them a starting point. `teen` gets two frames, with the first
 * already full: the ten a child stops counting is the idea being taught, and
 * making them draw it again would teach the opposite.
 */
export const figureFor = (q: FrameQuestion): React.ReactNode => {
  const CELL = 26;
  const frame = (filled: number, key: string) => (
    <svg
      key={key}
      viewBox={`0 0 ${5 * CELL + 2} ${2 * CELL + 2}`}
      width={5 * CELL + 2}
      height={2 * CELL + 2}
      role="img"
      aria-label={tc("tenframe.frameLabel", { filled })}
      className="text-slate-900"
    >
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            x={(i % 5) * CELL + 1}
            y={Math.floor(i / 5) * CELL + 1}
            width={CELL}
            height={CELL}
          />
        ))}
      </g>
      {Array.from({ length: Math.min(filled, 10) }, (_, i) => (
        <circle
          key={i}
          cx={(i % 5) * CELL + 1 + CELL / 2}
          cy={Math.floor(i / 5) * CELL + 1 + CELL / 2}
          r={CELL / 3}
          fill="currentColor"
        />
      ))}
    </svg>
  );

  if (q.mode === "teen") {
    return (
      <span className="inline-flex items-start gap-3">
        {frame(10, "full")}
        {frame(0, "rest")}
      </span>
    );
  }
  return frame(q.mode === "complement" ? (q.initial ?? 0) : 0, "one");
};

export function tenFrameHints(
  question: FrameQuestion,
  state: { filled: number; kidTip?: string },
): string[] {
  const { filled } = state;

  if (question.mode === "complement") {
    const start = question.initial ?? 0;
    return composeHints(
      state.kidTip ?? tc("tenframe.hintComplementTip"),
      tc("tenframe.hintComplementFull", { count: start }),
      // Counting the empty boxes *is* the method, and the child answers by
      // choosing a number — so the rung stops one step short of saying which.
      tc("tenframe.hintComplementCount"),
    );
  }

  if (question.mode === "teen") {
    const ones = question.target - 10;
    return composeHints(
      state.kidTip ?? tc("tenframe.hintTeenTip"),
      tc("tenframe.hintTeenSplit", { target: question.target, ones }),
      filled === ones
        ? tc("tenframe.hintTeenDone", { filled, target: question.target })
        : filled < ones
          ? tc("tenframe.hintTeenMore", { filled, more: ones - filled })
          : tc("tenframe.hintTeenLess", { filled, less: filled - ones }),
    );
  }

  const extra = question.target - 5;
  return composeHints(
    state.kidTip ?? tc("tenframe.hintFillTip"),
    question.target <= 5
      ? tc("tenframe.hintFillFits", { target: question.target })
      : tc("tenframe.hintFillSplit", { target: question.target, extra }),
    filled === question.target
      ? tc("tenframe.hintFillDone", { target: question.target })
      : filled === 0
        ? tc("tenframe.hintFillStart", { target: question.target })
        : filled < question.target
          ? tc("tenframe.hintFillMore", { filled, more: question.target - filled })
          : tc("tenframe.hintFillLess", { filled, less: filled - question.target }),
  );
}

const EMPTY_FRAME = () => Array<boolean>(10).fill(false);

const Cell: React.FC<{
  filled: boolean;
  tone: "purple" | "cyan";
  onClick?: () => void;
  height?: string;
  /** 1-based position, so the cell has a name a screen reader can say. */
  position?: number;
  /** The one the coach is pointing at. */
  lit?: boolean;
}> = ({ filled, tone, onClick, height = FRAME_CELL, position, lit = false }) => {
  const on =
    tone === "purple"
      ? "bg-purple-500 border-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-95"
      : "bg-cyan-500 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-95";
  const off = `bg-surface border-line ${onClick ? (tone === "purple" ? "hover:border-purple-400" : "hover:border-cyan-400") : ""}`;
  return (
    <motion.button
      onClick={onClick}
      disabled={!onClick}
      whileHover={onClick ? { scale: 1.05 } : undefined}
      whileTap={onClick ? { scale: 0.88 } : undefined}
      transition={SPRING.tap}
      /* The glow is nothing to a screen reader, so the cell the coach points
         at says so in words. */
      aria-label={tc(
        filled ? (lit ? "tenframe.cellFilledNext" : "tenframe.cellFilled") : lit ? "tenframe.cellEmptyNext" : "tenframe.cellEmpty",
        { position: position ?? "" },
      )}
      className={`${height} rounded-2xl border-2 flex items-center justify-center transition-all ${
        filled ? on : off
      } ${lit ? "ring-4 ring-indigo-500 ring-offset-2 ring-offset-transparent animate-pulse" : ""}`}
    >
      {filled && (
        /*
         * A counter, not a lightning bolt.
         *
         * The ten-frame works because ten identical discs in a fixed 5+5 grid
         * can be read as a quantity without counting. An emoji is a picture
         * with its own detail and its own outline, which is exactly what stops
         * the pattern being seen at a glance — and ⚡ was not even a countable
         * thing, it was decoration in the slot where the maths should be.
         */
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

export const TenFrameRocket: React.FC<ActivityProps<TenFrameRocketParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: TenFrameSetup = { ...params, ...params.question };
  const total = setup.questionsPerRound ?? 5;
  /** The lesson's own child-facing copy: the spoken intro, and hint rung one. */
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup as { practice?: boolean });

  const [frame, setFrame] = useState<boolean[]>(EMPTY_FRAME);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
    resumable: practising,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    // The lesson's own spoken instruction, said once as the round opens.
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index: number) => buildQuestion(setup, index), [params]),
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
  const report = (outcome: Parameters<typeof round.submit>[0]) =>
    round.submit(practising ? { ...outcome, message: undefined } : outcome);
  const filled = frame.filter(Boolean).length;

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

  const hints = practising ? [] : tenFrameHints(question, { filled, kidTip: copy.kidTip });

  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* The next empty box, in reading order. In `complement` the child answers
       with a number button rather than by filling, so there is nothing in the
       frame to touch and nothing is lit. */
    target: question.mode === "complement" ? -1 : nextCell(frame),
    progress: filled,
    /* Never done by building alone: every mode here ends with Check, and the
       last rung's job is to say so. */
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  // Each question starts from an empty frame.
  useEffect(() => {
    setFrame(EMPTY_FRAME());
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
    setFrame(EMPTY_FRAME());
  };



  const toggle = (idx: number) => {
    /* Filling the bottom row while the top has gaps is not an error — the
       total comes out the same — but it throws away what the frame is *for*,
       which makes it the one move here worth a word. */
    if (!frame[idx] && skippedTopRow(frame, idx)) guide.stumbled();
    else guide.moved();
    playChrome(koda, "pop");
    koda.haptics.tap();
    setFrame((prev) => {
      const next = prev.map((v, i) => (i === idx ? !v : v));
      /*
       * Say the running count as the frame fills.
       *
       * Filling a ten-frame in silence is a shape-matching exercise. The number
       * word is what turns it into counting — the same pairing "Count the Row"
       * uses, and the clips are already recorded. Only on the way up: removing
       * a counter is a correction, not a count.
       */
      const count = next.filter(Boolean).length;
      if (count > prev.filter(Boolean).length && !practising && koda.config.isEnabled("audio_speech", true)) {
        void koda.speech.say(numberWord(count), {
          rate: koda.config.get("speechRate", 1.0),
        });
      }
      return next;
    });
  };

  const submit = (given: number, correct: boolean, title: string, message: string) => {
    playChrome(koda, correct ? "success" : "error");
    correct ? koda.haptics.success() : koda.haptics.tap();
    report({
      correct,
      given: String(given),
      expected: String(question.mode === "teen" ? question.target : question.target),
      errorKind: correct ? undefined : question.mode === "teen" ? "place_value" : "miscounted_items",
      title,
      message,
    });
  };

  const checkFill = () =>
    filled === question.target
      ? submit(
          filled,
          true,
          tc("greatCounting"),
          tc("tenframe.fillRight", { extra: question.target - 5, target: question.target }),
        )
      : submit(
          filled,
          false,
          tc("tenframe.tryAgain"),
          tc("tenframe.fillWrong", { filled, target: question.target }),
        );

  const answerComplement = (guess: number) =>
    guess === question.target
      ? submit(
          guess,
          true,
          tc("greatCounting"),
          tc("tenframe.complementRight", { initial: question.initial ?? 0, guess }),
        )
      : submit(
          guess,
          false,
          tc("tenframe.tryAnother"),
          tc("tenframe.complementWrong", { initial: question.initial ?? 0, target: question.target }),
        );

  const checkTeen = () => {
    const built = 10 + filled;
    return built === question.target
      ? submit(
          built,
          true,
          tc("greatCounting"),
          tc("tenframe.teenRight", { filled, target: question.target }),
        )
      : submit(
          built,
          false,
          tc("tenframe.trySecond"),
          tc("tenframe.teenWrong", { filled, built, ones: question.target - 10 }),
        );
  };

  const prompt = promptFor(question);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tc("tenframe.title")}
      round={round}
      totalQuestions={total}
      prompt={prompt}
      iconName="rocket"
      iconTone="purple"
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (frame.some(Boolean)) ? restart : undefined
      }
      onExit={koda.ui.exit}
      onReadAloud={
        practising
          ? undefined
          : () => {
            round.useSupport("audio_replay");
            void koda.speech.say(prompt);
            }
      }
      recommendation={nextStep}
    >
      {question.mode === "fill" && (
        <div className="space-y-4">
          {/* The frame gets the same warm ground the other activities use, and
              the two rows are held apart so the 5-and-5 structure — the whole
              reason a ten-frame teaches anything — is visible before counting. */}
          <div className={`max-w-xl mx-auto ${SCENE} p-4 sm:p-6 space-y-3 sm:space-y-4`}>
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
              {frame.slice(0, 5).map((on, idx) => (
                <Cell key={idx} filled={on} tone="purple" position={idx + 1} lit={guide.target === idx} onClick={() => toggle(idx)} />
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
              {frame.slice(5).map((on, idx) => (
                <Cell key={idx + 5} filled={on} tone="cyan" position={idx + 6} lit={guide.target === idx + 5} onClick={() => toggle(idx + 5)} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <span className="text-2xl font-black text-ink tabular-nums">
              {filled}
              <span className="text-muted font-bold"> / {question.target}</span>
            </span>
            <motion.button
              onClick={checkFill}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING.tap}
              className={themeSystem.button("primary", "lg")}
            >
              <Rocket />
              {tc("tenframe.check")}
            </motion.button>
          </div>
        </div>
      )}

      {question.mode === "complement" && (
        <div className="space-y-4">
          <div className="max-w-md mx-auto bg-canvas p-4 rounded-3xl border-2 border-purple-500/40">
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, idx) => {
                const loaded = idx < (question.initial ?? 0);
                return (
                  <div
                    key={idx}
                    className={`${FRAME_CELL} rounded-2xl border-2 flex items-center justify-center ${
                      loaded
                        ? "bg-purple-500 border-purple-300"
                        : "bg-surface border-dashed border-line"
                    }`}
                  >
                    {loaded ? (
                      <span className="block w-2/3 aspect-square rounded-full bg-white/95 shadow-inner" />
                    ) : (
                      <span className="text-slate-400 text-2xl font-black">?</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm font-bold text-muted">
              {tc("tenframe.selectEmpty")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                <motion.button
                  key={num}
                  onClick={() => answerComplement(num)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88, y: 2 }}
                  transition={SPRING.enter}
                  className={themeSystem.button("secondary", "choice")}
                >
                  {num}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {question.mode === "teen" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-canvas p-3.5 rounded-2xl border border-purple-500/40 space-y-2">
              <span className="text-sm text-purple-600 dark:text-purple-300 font-black">
                {tc("tenframe.frame1")}
              </span>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl bg-purple-500/40 border border-purple-400 flex items-center justify-center"
                  >
                    <span className="block w-1/2 aspect-square rounded-full bg-white/90" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-canvas p-3.5 rounded-2xl border border-cyan-500/40 space-y-2">
              <span className="text-sm text-cyan-700 dark:text-cyan-300 font-black">
                {tc("tenframe.frame2")}
              </span>
              <div className="grid grid-cols-5 gap-2">
                {frame.map((on, idx) => (
                  <Cell
                    key={idx}
                    filled={on}
                    tone="cyan"
                    height="h-10"
                    position={idx + 1}
                    lit={guide.target === idx}
                    onClick={() => toggle(idx)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <span className="text-sm font-bold text-muted">
              {tc("tenframe.total", { filled })} <strong>{10 + filled}</strong>
            </span>
            <motion.button
              onClick={checkTeen}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING.tap}
              className={themeSystem.button("primary", "sm")}
            >
              {tc("tenframe.checkTeen")}
            </motion.button>
          </div>
        </div>
      )}
    </SkillRound>
  );
};
