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
  isPractice,
  modeAt,
  playChrome,
  answerChoices,
  guideSetup,
  useGuide,
} from "../../kit";
import { SCENE } from "../internal/data/countingLayout";
import { themeSystem } from "../../../lib/themeSystem";
import { DUAL_COLOR_PAIRS } from "../internal/data/countingAssets";
import { numberWord } from "../internal/guide/countGuide";

/**
 * Subitizing: a set is flashed, then named — without counting.
 *
 * The first level extracted from the fifteen-level counting component. Its three
 * lessons differ only in how the set is drawn, so `display` is a lesson
 * parameter rather than a level number: the activity has no idea which level it
 * is, which is what lets a sixteenth lesson reuse it by writing JSON.
 */

export type SubitizingDisplay = "grid" | "scatter" | "twoColor";

export interface SubitizingSetup {
  /** How the flashed set is drawn. */
  display?: SubitizingDisplay;
  /** Total dots, for `grid` and `scatter`. */
  countRange?: [number, number];
  /** Size of each group, for `twoColor`. The total is the two added. */
  partRange?: [number, number];
  /** Percent bounds for scatter placement. */
  jitterRange?: [number, number];
  /** How long the set stays visible. Shorter forces a glance, not a count. */
  flashMs?: number;
  questionsPerRound?: number;
}

export interface SubitizingRushParams extends SubitizingSetup {
  /**
   * Counting nests a level's generator settings under `question`, beside its
   * `play` block. Read both so a lesson can write them either way — flat is
   * what a new skill would do, nested is what counting already has.
   */
  question?: SubitizingSetup;
}

export interface SubitizingQuestion extends RoundQuestion {
  total: number;
  /** Set for `twoColor`: the two groups the total is made of. */
  parts?: { a: number; b: number; colors: (typeof DUAL_COLOR_PAIRS)[number] };
  /** Set for `scatter`: where each dot sits, in percent. */
  points?: { x: number; y: number }[];
}

const rangeOr = (range: [number, number] | undefined, lo: number, hi: number) => {
  const [min, max] = range ?? [lo, hi];
  return min + Math.floor(Math.random() * (max - min + 1));
};

const sample = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export const buildQuestion = (params: SubitizingSetup, index: number): SubitizingQuestion => {
  const display = modeAt<SubitizingDisplay>(
    { mode: params.display, modes: (params as { modes?: SubitizingDisplay[] }).modes },
    index,
    "grid",
  );
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `subitize_${display}` };

  if (display === "twoColor") {
    const a = rangeOr(params.partRange, 2, 4);
    const b = rangeOr(params.partRange, 2, 4);
    const total = a + b;
    return {
      ...base,
      total,
      expected: String(total),
      itemCount: total,
      parts: { a, b, colors: sample(DUAL_COLOR_PAIRS) },
    };
  }

  const total = rangeOr(params.countRange, 2, 6);
  return {
    ...base,
    total,
    expected: String(total),
    itemCount: total,
    points:
      display === "scatter"
        ? Array.from({ length: total }, () => ({
            x: rangeOr(params.jitterRange, 15, 85),
            y: rangeOr(params.jitterRange, 15, 85),
          }))
        : undefined,
  };
};

/** Five choices centred on the answer, clamped to what this lesson generates. */
/**
 * Five near misses inside the lesson's own range, ordered by the question.
 *
 * The ascending window put the answer third almost every time, which in a game
 * built on a flash the child cannot re-count is the easiest tell in the skill.
 */
const choicesFor = (total: number, params: SubitizingSetup, seed: string): number[] => {
  const [lo, hi] = params.countRange ?? [2, 8];
  return answerChoices(total, seed, { count: 5, min: lo, max: hi + 1 });
};

/**
 * What to say to a child who did not catch the flash.
 *
 * Subitizing is seeing a quantity without counting it, so a hint cannot simply
 * say "count them" — the set is not on screen to count. Each rung instead gives
 * the child a *structure* to look for on the next flash, which is the skill
 * itself: three in a row, two small groups, one colour then the other.
 *
 * Pure and exported, so the wording is tested against the set it describes.
 */
export function subitizeHints(
  question: SubitizingQuestion,
  state: { seen: boolean; kidTip?: string },
): string[] {
  /*
   * No "press Show me again" in any of these any more.
   *
   * The coach re-shows the set itself when it reaches rung two, and holds it on
   * screen at rung three — so a rung spent telling a child to press a button is
   * a rung spent on something that has already happened. What is left is the
   * only thing words can do here: name the grouping to look for.
   */
  if (question.parts) {
    const { a, b } = question.parts;
    return composeHints(
      state.kidTip ?? "Count one colour, then keep going with the other.",
      "Take in one colour as a group, then the other.",
      // The two parts, not the total: putting them together is the question.
      `${a} of one colour, ${b} of the other. Put them together.`,
    );
  }

  const total = question.total;

  if (question.points) {
    // The split is read off where the dots actually were, not invented. A hint
    // that describes a grouping the child did not see is a hint that teaches
    // them their eyes were wrong.
    const left = question.points.filter((pt) => pt.x < 50).length;
    const right = total - left;
    return composeHints(
      state.kidTip ?? "Look for small groups inside the big group.",
      "Do not chase every dot. Take in one clump, then count on.",
      left === 0 || right === 0
        ? "They were all bunched together. Split them into two smaller groups."
        : `${left} on the left and ${right} on the right. Put them together.`,
    );
  }

  // The grid is drawn three to a row, so "rows of three" is what was on screen.
  const rows = Math.floor(total / 3);
  const spare = total % 3;
  const threes = Array.from({ length: rows }, (_, i) => (i + 1) * 3).join(", ");
  return composeHints(
    state.kidTip ?? "Try to see the pattern without counting.",
    "Look at the middle of the box, not at one dot.",
    rows === 0
      ? `One short row of ${total}. Read it like a domino.`
      : rows === 1
        ? `One row of three${spare > 0 ? `, and ${spare} more underneath.` : " and nothing else."}`
        : `${rows} rows of three: ${threes}${spare > 0 ? `, then ${spare} more.` : "."}`,
  );
}

/**
 * One dot. Deliberately plain, and deliberately large.
 *
 * Subitizing is reading a pattern at a glance, so the mark carries no detail of
 * its own — decorated dots are harder to grasp as a group, which is why this is
 * the one place in the skill that does *not* use the artwork. Size is the part
 * that was wrong: 32px flashed for under a second is a squint.
 */
const Dot: React.FC<{ className: string }> = ({ className }) => (
  <div className={`w-11 h-11 rounded-full ${className}`} />
);

/** The question in words, as the round says it. */
export const promptFor = (): string => "Look fast! How many did you see?";

/**
 * Not on paper.
 *
 * Subitizing is recognising a quantity *without* counting it, and the round
 * enforces that the only way it can be enforced: the dots are shown for a
 * fraction of a second and then taken away. A printed sheet cannot take
 * anything away. The same dots on a page are a counting exercise — the exact
 * thing this lesson exists to make unnecessary — so it prints nothing rather
 * than printing its own opposite.
 */
export const printedFor = (): null => null;

export const SubitizingRush: React.FC<ActivityProps<SubitizingRushParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: SubitizingSetup = { ...params, ...params.question };
  const total = setup.questionsPerRound ?? 5;
  const flashMs = setup.flashMs ?? 1000;
  /** The lesson's own child-facing copy: the spoken intro, and hint rung one. */
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup as { practice?: boolean });

  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();
  /** The set is shown only after the child asks, so their eyes are on it. */
  const [phase, setPhase] = useState<"waiting" | "flashing" | "answering">("waiting");
  const timer = useRef<number | null>(null);

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

  const question = round.question as SubitizingQuestion;

  /**
   * Report an answer.
   *
   * In practice the verdict stands on its own — a child working unaided is not
   * being walked through what happened, and an explanation after every question
   * would put the scaffolding back one sentence at a time.
   */
  const submit = (outcome: Parameters<typeof round.submit>[0]) =>
    round.submit(practising ? { ...outcome, message: undefined } : outcome);

  /**
   * Show the set.
   *
   * `hold` is what the coach's top rung uses: the dots stay until the child
   * answers instead of vanishing after a second. A glance is the skill being
   * taught, so holding is the strongest help this engine has — and it is the
   * only honest one, because the alternative, lighting two of the answer
   * buttons, turns counting into a coin toss.
   */
  const flash = useCallback(
    (hold = false) => {
      playChrome(koda, "pop");
      setPhase("flashing");
      if (timer.current) window.clearTimeout(timer.current);
      if (hold) return;
      timer.current = window.setTimeout(() => setPhase("answering"), flashMs);
    },
    [koda, flashMs],
  );

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

  const hints = practising
    ? []
    : subitizeHints(question, { seen: phase !== "waiting", kidTip: copy.kidTip });

  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* Nothing on this screen is touched to answer — the child taps a number —
       so the coach never lights a thing. What its rungs do instead is give the
       glance back: see the effect below. */
    target: -1,
    progress: phase === "waiting" ? 0 : 1,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  /*
   * The rungs that do something rather than say something.
   *
   * Words are the weakest help here: a child who cannot say how many dots there
   * were does not need the strategy described, they need to see the dots again.
   * So rung two re-shows them, and rung three holds them on screen until the
   * question is answered.
   */
  /** The top rung holds the set on screen rather than flashing it. */
  const held = (guide.cue?.level ?? 0) >= 3 && phase === "flashing";

  const actedOn = useRef(0);
  useEffect(() => {
    const level = guide.cue?.level ?? 0;
    if (level < 2 || actedOn.current >= level) {
      if (level === 0) actedOn.current = 0;
      return;
    }
    actedOn.current = level;
    flash(level >= 3);
  }, [guide.cue?.level, flash]);

  // A new question starts hidden again, and a pending flash must not land on it.
  useEffect(() => {
    setPhase("waiting");
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [question.id]);

  const guess = (choice: number) => {
    const correct = choice === question.total;
    playChrome(koda, correct ? "success" : "error");
    correct ? koda.haptics.success() : koda.haptics.tap();

    submit({
      correct,
      given: String(choice),
      expected: String(question.total),
      title: correct ? "Great counting!" : "So close!",
      message: correct
        ? question.parts
          ? `${question.parts.a} and ${question.parts.b} makes ${question.total}.`
          : `Recognised instantly: ${question.total}!`
        : `You said ${choice}. There were ${question.total}. Have another look!`,
    });
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Subitizing Rush"
      round={round}
      totalQuestions={total}
      prompt="Look fast! How many did you see?"
      iconName="dice"
      iconTone="purple"
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onExit={koda.ui.exit}
      onReadAloud={
        practising
          ? undefined
          : () => {
            round.useSupport("audio_replay");
            void koda.speech.say("Look fast! How many did you see?");
            }
      }
      recommendation={nextStep}
    >
      <div className="space-y-4 text-center">
        <div className="relative w-full h-[200px] bg-canvas rounded-2xl border border-line flex items-center justify-center overflow-hidden">
          {phase === "waiting" && (
            <div className="text-center space-y-3">
              <p className="text-base font-bold text-slate-700 dark:text-body">
                Ready? Watch closely!
              </p>
              <motion.button
                /* Wrapped, not passed: `flash` now takes a `hold` flag, and
                   handing it straight to onClick fed it the click event —
                   truthy — so the set stayed on screen and the round never
                   reached the answering phase. */
                onClick={() => flash()}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9, y: 2 }}
                transition={SPRING.enter}
                className={themeSystem.button("primary", "lg")}
                autoFocus
              >
                Show me
              </motion.button>
            </div>
          )}

          {phase === "answering" && (
            <div className="text-center space-y-2.5">
              <span className="text-3xl" aria-hidden="true">
                ?
              </span>
              <p className="text-sm font-bold text-slate-700 dark:text-body">
                How many dots did you see?
              </p>
              <motion.button
                onClick={() => {
                  // Re-showing a flashed set is the strongest support here: the
                  // whole point is that the glance was enough.
                  round.useSupport("reveal");
                  flash();
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING.tap}
                className={themeSystem.button("secondary", "sm")}
              >
                Show me again
              </motion.button>
            </div>
          )}

          {phase === "flashing" && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.enter}
              className="flex items-center justify-center"
            >
              {/*
                * The top rung: the set held still, and broken at five.
                *
                * Five is the benchmark the whole skill is built on, so the
                * grouping shown is the one a child is being taught to see —
                * not an arbitrary split, and not the answer. They still have to
                * put "five and two" together and name it.
                *
                * The two-colour sets are left alone: they arrive already
                * grouped, and regrouping them at five would take away the very
                * structure that question is about.
                */}
              {held && !question.parts ? (
                <div
                  className={`flex flex-wrap items-center justify-center gap-3 px-5 py-5 sm:gap-4 sm:px-7 ${SCENE}`}
                >
                  {[Math.min(5, question.total), Math.max(0, question.total - 5)]
                    .filter((n) => n > 0)
                    .map((n, group) => (
                      <React.Fragment key={group}>
                        {group > 0 && (
                          <span className="text-lg font-black text-ink/60">and</span>
                        )}
                        <span className="flex flex-col items-center gap-1.5">
                          <span className="grid grid-cols-5 gap-2 rounded-2xl border-2 border-indigo-400 bg-indigo-500/10 p-2">
                            {Array.from({ length: n }, (_, i) => (
                              <Dot
                                key={i}
                                className="bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.9)]"
                              />
                            ))}
                          </span>
                          <span className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                            {numberWord(n)}
                          </span>
                        </span>
                      </React.Fragment>
                    ))}
                </div>
              ) : question.parts ? (
                <div className={`flex items-center gap-5 sm:gap-8 px-6 sm:px-8 py-5 sm:py-6 ${SCENE}`}>
                  <div className="flex gap-2">
                    {Array.from({ length: question.parts.a }, (_, i) => (
                      <Dot key={i} className={`${question.parts!.colors.colorA} shadow-md`} />
                    ))}
                  </div>
                  <span className="text-3xl font-black text-slate-400">+</span>
                  <div className="flex gap-2">
                    {Array.from({ length: question.parts.b }, (_, i) => (
                      <Dot key={i} className={`${question.parts!.colors.colorB} shadow-md`} />
                    ))}
                  </div>
                </div>
              ) : question.points ? (
                <div className={`relative w-64 h-40 sm:w-80 sm:h-48 ${SCENE}`}>
                  {question.points.map((pt, i) => (
                    <div
                      key={i}
                      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                      /* The same dot the grid question draws.
                         These were amber — a pale yellow disc on a pale
                         sky-and-meadow scene, in the one task whose difficulty
                         is meant to be *how many*, not whether they can be made
                         out. It also meant a child met two different dots
                         inside one lesson depending on which question came up. */
                      className="absolute w-11 h-11 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.9)] -translate-x-1/2 -translate-y-1/2"
                    />
                  ))}
                </div>
              ) : (
                <div className={`grid grid-cols-3 gap-3 sm:gap-4 px-5 sm:px-7 py-5 sm:py-6 ${SCENE}`}>
                  {Array.from({ length: question.total }, (_, i) => (
                    <Dot
                      key={i}
                      className="bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.9)]"
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {choicesFor(question.total, setup, question.id).map((num) => (
            <motion.button
              key={num}
              onClick={() => guess(num)}
              disabled={phase !== "answering"}
              whileHover={phase === "answering" ? { scale: 1.08, y: -2 } : undefined}
              whileTap={phase === "answering" ? { scale: 0.88, y: 2 } : undefined}
              transition={SPRING.tap}
              className={themeSystem.button("secondary", "choice")}
            >
              {num}
            </motion.button>
          ))}
        </div>
      </div>
    </SkillRound>
  );
};
