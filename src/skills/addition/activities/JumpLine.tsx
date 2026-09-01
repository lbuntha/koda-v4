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
import { ADDEND_B, CHANGE } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { NumberPad } from "../internal/ui/NumberPad";
import {
  digitsOf,
  drawPair,
  numberWord,
  pairKey,
  shuffle,
  withoutRepeat,
  type PairSpec,
} from "../internal/data/additionNumbers";

/**
 * A number line you jump along, and the arcs stay where you put them.
 *
 * **Why this is not `counting/numberline`.** The registry rule says to check for
 * an existing interaction before writing a second one, so here is the answer.
 * `FroggySkip` hops a fixed step towards a target and speaks each pad it lands
 * on: the line is the scenery and the counting is the lesson. This records
 * *jumps of a size the child chooses*, keeps every arc on screen, and asks
 * questions about the arcs — which one reaches the next ten, whether two of
 * them together land on the answer, what happens if you jump too far and come
 * back. The line is the lesson. Sharing one component would mean one of the two
 * carrying a mode it never uses.
 *
 * Six modes on two kinds of line, and which kind decides how a child answers:
 *
 * - **A ticked line** shows the numbers, so the answer is produced by jumping —
 *   arrive at the total, or choose the jump that reaches the next ten.
 * - **An open line** has no numbers to read off, so after the jumps the child
 *   says where they landed. That is the whole skill: on an open line you have
 *   to know, because nothing on screen will tell you.
 */

export type JumpMode =
  | "path"
  | "open"
  | "bridge_ten"
  | "bridge_hundred"
  | "compensate"
  | "jump_tens_ones";

/** How a mode is answered. Follows from the line, not from the mode's name. */
type AnswerKind = "arrival" | "jump" | "landing";

export interface JumpSetup {
  mode?: JumpMode;
  aRange?: [number, number];
  bRange?: [number, number];
  addendRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface JumpLineParams extends JumpSetup {
  question?: JumpSetup;
}

export interface JumpQuestion extends RoundQuestion {
  mode: JumpMode;
  a: number;
  b: number;
  sum: number;
  /** Where the marker starts. */
  from: number;
  /** The stretch of line on screen. */
  min: number;
  max: number;
  /** Spacing of labelled ticks. 0 is an open line — no numbers to read off. */
  ticks: number;
  /** The jumps offered, in the order they are shown. Negative jumps go back. */
  offered: number[];
  /** The jumps that must be made, in any order. */
  required: number[];
  answerKind: AnswerKind;
}

const DEFAULT_SPEC: Record<JumpMode, PairSpec> = {
  path: { aRange: [1, 10], bRange: [1, 5], sumMax: 20 },
  open: { aRange: [10, 40], bRange: [2, 9] },
  // Not already on a ten, or there is nothing to reach for.
  bridge_ten: { aRange: [11, 89], bRange: [1, 9] },
  bridge_hundred: { aRange: [110, 890], bRange: [1, 99] },
  compensate: { aRange: [21, 79], bRange: [11, 89], endsIn: [8, 9] },
  jump_tens_ones: { addendRange: [11, 88], regroup: "never" },
};

const declared = (setup: JumpSetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: JumpMode, setup: JumpSetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  // What each mode *is*, which a lesson may narrow but not remove.
  if (mode === "compensate") spec.endsIn = [8, 9];
  if (mode === "jump_tens_ones") spec.regroup = "never";
  if (mode === "bridge_ten") spec.exclude = [];
  return spec;
};

/** Round up to the next whole unit above `n`, never `n` itself. */
const nextMultiple = (n: number, unit: number): number => (Math.floor(n / unit) + 1) * unit;

export const buildQuestion = (
  setup: JumpSetup,
  index: number,
  seen: Set<string>,
): JumpQuestion => {
  const mode = setup.mode ?? "path";
  const spec = specFor(mode, setup);
  const pair = withoutRepeat(
    () => {
      const drawn = drawPair(spec);
      // A number already sitting on a ten has nothing to bridge to.
      if (mode === "bridge_ten" && drawn.a % 10 === 0) return drawPair({ ...spec, aRange: [11, 89] });
      if (mode === "bridge_hundred" && drawn.a % 100 === 0) return drawPair(spec);
      return drawn;
    },
    pairKey,
    seen,
  );
  const { a, b, sum } = pair;
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `line_${mode}`, mode, a, b, sum };

  if (mode === "bridge_ten" || mode === "bridge_hundred") {
    const unit = mode === "bridge_ten" ? 10 : 100;
    const target = nextMultiple(a, unit);
    const needed = target - a;
    const step = unit === 10 ? 1 : 10;
    // Two near misses beside the right jump: overshooting and undershooting are
    // the two things that actually go wrong, so those are the choices offered.
    const choices = shuffle(
      [needed, Math.max(step, needed - step), needed + step].filter(
        (v, i, all) => v > 0 && all.indexOf(v) === i,
      ),
    );
    return {
      ...base,
      from: a,
      min: Math.max(0, a - (a % unit) - unit),
      max: target + unit,
      ticks: unit,
      offered: choices,
      required: [needed],
      answerKind: "jump",
      expected: String(needed),
      itemCount: sum,
    };
  }

  if (mode === "compensate") {
    const rounded = nextMultiple(b, 10);
    const given = rounded - b;
    return {
      ...base,
      from: a,
      min: a - 5,
      max: a + rounded + 5,
      ticks: 0,
      offered: [rounded, -given],
      required: [rounded, -given],
      answerKind: "landing",
      expected: String(sum),
      itemCount: sum,
    };
  }

  if (mode === "jump_tens_ones") {
    const { tens, ones } = digitsOf(b);
    const parts = [tens * 10, ones].filter((v) => v > 0);
    return {
      ...base,
      from: a,
      min: a - 5,
      max: sum + 10,
      ticks: 0,
      offered: shuffle(parts),
      required: parts,
      answerKind: "landing",
      expected: String(sum),
      itemCount: sum,
    };
  }

  if (mode === "open") {
    return {
      ...base,
      from: a,
      min: a - 5,
      max: sum + 6,
      ticks: 0,
      offered: [b],
      required: [b],
      answerKind: "landing",
      expected: String(sum),
      itemCount: sum,
    };
  }

  return {
    ...base,
    from: a,
    min: 0,
    max: Math.max(20, sum + 2),
    ticks: 1,
    offered: [1],
    // One square at a time, b times. The answer is arriving.
    required: Array.from({ length: b }, () => 1),
    answerKind: "arrival",
    expected: String(sum),
    itemCount: sum,
  };
};

export const promptFor = (q: JumpQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum));
  if (filled) return filled;

  switch (q.mode) {
    case "open":
      return `Start at ${q.a} and jump ${q.b}. Where do you land?`;
    case "bridge_ten":
      return `Which jump takes ${q.a} to the next ten?`;
    case "bridge_hundred":
      return `Which jump takes ${q.a} to the next hundred?`;
    case "compensate":
      return `${q.a} plus ${q.b}. Jump a round number, then give back what you overshot.`;
    case "jump_tens_ones":
      return `${q.a} plus ${q.b}. Jump the tens, then the ones.`;
    default:
      return `Start at ${q.a} and hop forward ${q.b}.`;
  }
};

export function jumpHints(
  q: JumpQuestion,
  state: { at: number; made: number[]; entry: string; kidTip?: string },
): string[] {
  const left = q.required.length - state.made.length;

  switch (q.mode) {
    case "bridge_ten":
    case "bridge_hundred": {
      const unit = q.mode === "bridge_ten" ? 10 : 100;
      const target = nextMultiple(q.a, unit);
      return composeHints(
        state.kidTip ?? `Jump to the round number, not past it.`,
        `${q.a} is between ${target - unit} and ${target}. You want to land exactly on ${target}.`,
        // Stops one step short: the child is choosing between jumps.
        `Count on from ${q.a} to ${target} and that is the jump you need.`,
      );
    }
    case "compensate": {
      const rounded = nextMultiple(q.b, 10);
      return composeHints(
        state.kidTip ?? "Jump a round number, then give back what you took too much of.",
        state.made.length === 0
          ? `${q.b} is nearly ${rounded}, and ${rounded} is an easy jump. Take that jump first.`
          : left > 0
            ? `You jumped ${rounded}, which is ${rounded - q.b} too far. Now jump back ${rounded - q.b}.`
            : `You are at ${state.at}. Say that number to answer.`,
        `${q.a} and ${rounded} is ${q.a + rounded}. Give back ${rounded - q.b} and you have ${q.sum}.`,
      );
    }
    case "jump_tens_ones": {
      const { tens, ones } = digitsOf(q.b);
      return composeHints(
        state.kidTip ?? "Add the tens first, then the ones.",
        state.made.length === 0
          ? `${q.b} is ${tens * 10} and ${ones}. Jump the ${tens * 10} first — the ones are easier once you are there.`
          : left > 0
            ? `You are at ${state.at}. There ${left === 1 ? "is one jump" : `are ${left} jumps`} left.`
            : `You landed on ${state.at}. Say that number to answer.`,
        `${q.a} and ${tens * 10} is ${q.a + tens * 10}, and ${ones} more is ${q.sum}.`,
      );
    }
    case "open":
      return composeHints(
        state.kidTip ?? "There are no numbers on this line, so keep the count in your head.",
        state.made.length === 0
          ? `Take the jump first. It goes forward ${q.b} from ${q.a}.`
          : `You jumped ${q.b} from ${q.a}. Nothing on the line will tell you where that is — count on from ${q.a}.`,
        `Start at ${q.a} and count on ${q.b}.`,
      );
    default: {
      const remaining = q.sum - state.at;
      return composeHints(
        state.kidTip ?? "One hop is one number. Say each number as you land on it.",
        remaining <= 0
          ? `You have arrived at ${q.sum}.`
          : `You are on ${state.at}. ${remaining === 1 ? "One more hop" : `${remaining} more hops`} to go — the next one lands on ${numberWord(state.at + 1)}.`,
        `From ${q.a}, hop ${q.b} times: ${Array.from({ length: q.b }, (_, i) => q.a + i + 1).join(", ")}.`,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* The line                                                                    */
/* -------------------------------------------------------------------------- */

const W = 1000;
const H = 150;
const BASE = 112;

/** One arc, kept on screen. The record of the jumps is the working. */
const Arc: React.FC<{ x1: number; x2: number; label: number }> = ({ x1, x2, label }) => {
  const back = x2 < x1;
  const mid = (x1 + x2) / 2;
  const lift = Math.min(58, Math.max(26, Math.abs(x2 - x1) * 0.45));
  return (
    <g>
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45 }}
        d={`M ${x1} ${BASE} Q ${mid} ${BASE - lift} ${x2} ${BASE}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className={back ? "text-rose-500" : "text-sky-500"}
      />
      <text
        x={mid}
        y={BASE - lift * 0.72}
        textAnchor="middle"
        className={`text-[26px] font-black ${back ? "fill-rose-500" : "fill-sky-500"}`}
      >
        {back ? "−" : "+"}
        {Math.abs(label)}
      </text>
    </g>
  );
};

export const JumpLine: React.FC<ActivityProps<JumpLineParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: JumpSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());

  const [at, setAt] = useState(0);
  const [made, setMade] = useState<number[]>([]);
  const [entry, setEntry] = useState("");
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

  const question = round.question as JumpQuestion;

  useEffect(() => {
    setAt(question.from);
    setMade([]);
    setEntry("");
    setNudge(null);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
  }, [question.id, question.from]);

  useEffect(() => () => {
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
  }, []);

  const speaks = koda.config.isEnabled("audio_speech", true);
  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };
  const refuse = (why: string) => {
    chime("hint");
    setNudge(why);
    if (nudgeTimer.current !== null) window.clearTimeout(nudgeTimer.current);
    nudgeTimer.current = window.setTimeout(() => setNudge(null), 4000);
  };

  const x = (value: number) =>
    ((value - question.min) / Math.max(1, question.max - question.min)) * W;

  const submitTotal = (given: number) => {
    const correct = given === question.sum;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    round.submit({
      correct,
      given: String(given),
      errorKind: correct ? undefined : Math.abs(given - question.sum) === 1 ? "off_by_one" : "off_by_more",
      title: correct ? "That is where you land!" : "Not quite",
      message: correct
        ? `${question.a} and ${question.b} lands on ${question.sum}.`
        : `Count the jumps again from ${question.a} — they land on ${question.sum}.`,
    });
  };

  const jump = (size: number) => {
    if (round.feedback) return;

    // Choosing the jump *is* the answer on a ticked line, so it is scored
    // rather than performed and then judged.
    if (question.answerKind === "jump") {
      const correct = size === question.required[0];
      setAt(question.from + size);
      setMade([size]);
      chime(correct ? "success" : "error");
      if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
      const unit = question.mode === "bridge_ten" ? 10 : 100;
      const target = nextMultiple(question.a, unit);
      round.submit({
        correct,
        given: String(size),
        errorKind: correct ? undefined : "off_by_more",
        title: correct ? "Straight onto the ten!" : "That jump misses",
        message: correct
          ? `${question.a} and ${size} lands exactly on ${target}.`
          : `${question.a} and ${size} lands on ${question.a + size}. You want ${target}.`,
      });
      return;
    }

    const next = at + size;
    setAt(next);
    setMade((prev) => [...prev, size]);
    if (vibrates) koda.haptics.tap();
    chime(size < 0 ? "clink" : "pop");
    // A ticked line names where you land; an open one deliberately does not.
    if (speaks && question.ticks > 0) {
      void koda.speech.say(numberWord(next), { rate: koda.config.get("speechRate", 0.95) });
    }

    if (question.answerKind === "arrival" && next === question.sum) {
      chime("success");
      if (vibrates) koda.haptics.success();
      round.submit({
        correct: true,
        given: String(next),
        title: "You landed on it!",
        message: `${question.a} and ${question.b} hops lands on ${question.sum}.`,
      });
    }
  };

  const undo = () => {
    if (round.feedback || made.length === 0) return;
    const last = made[made.length - 1];
    setAt((v) => v - last);
    setMade((prev) => prev.slice(0, -1));
    chime("clink");
  };

  const check = () => {
    if (round.feedback) return;
    if (made.length < question.required.length) {
      refuse(
        made.length === 0
          ? "Take the jumps first, then say where you landed."
          : `One more jump to take before you answer.`,
      );
      return;
    }
    if (entry === "") {
      refuse("Type where you landed, using the numbers below.");
      return;
    }
    submitTotal(Number(entry));
  };

  const prompt = promptFor(question, copy.prompts?.default);
  const tickValues =
    question.ticks > 0
      ? Array.from(
          { length: Math.floor((question.max - question.min) / question.ticks) + 1 },
          (_, i) => question.min + i * question.ticks,
        )
      : [];

  let travelled = question.from;

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Number Line Jumps"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="footprints"
      iconTone="cyan"
      contextTag={framesSteps ? undefined : null}
      tagLabels={{
        warmup: koda.config.get("warmupLabel", "") || undefined,
        activity: koda.config.get("activityLabel", "") || undefined,
        guided: koda.config.get("guidedLabel", "") || undefined,
        milestone: koda.config.get("milestoneLabel", "") || undefined,
      }}
      hints={jumpHints(question, { at, made, entry, kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={() => {
        round.useSupport("audio_replay");
        void koda.speech.say(prompt, { rate: koda.config.get("speechRate", 0.95) });
      }}
      recommendation={nextStep}
    >
      <div className="space-y-4">
        <div className={`${SCENE} p-4 sm:p-6`}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Number line">
            <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="currentColor" strokeWidth="4" className="text-ink/25" />

            {tickValues.map((value) => (
              <g key={value}>
                <line
                  x1={x(value)}
                  y1={BASE - 9}
                  x2={x(value)}
                  y2={BASE + 9}
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-ink/30"
                />
                <text x={x(value)} y={BASE + 38} textAnchor="middle" className="text-[24px] font-bold fill-current text-ink/55">
                  {value}
                </text>
              </g>
            ))}

            {/* An open line still shows where you started — you have to have
                somewhere to count on from. It does not show where you are. */}
            {question.ticks === 0 && (
              <g>
                <line x1={x(question.from)} y1={BASE - 9} x2={x(question.from)} y2={BASE + 9} stroke="currentColor" strokeWidth="3" className="text-ink/40" />
                <text x={x(question.from)} y={BASE + 38} textAnchor="middle" className="text-[24px] font-bold fill-current text-ink/55">
                  {question.from}
                </text>
              </g>
            )}

            {made.map((size, i) => {
              const start = travelled;
              travelled += size;
              return <Arc key={i} x1={x(start)} x2={x(travelled)} label={size} />;
            })}

            <motion.circle
              animate={{ cx: x(at) }}
              transition={SPRING.enter}
              cy={BASE}
              r="13"
              className="fill-emerald-500"
            />
          </svg>

          <p aria-live="polite" className="sr-only">
            {question.ticks > 0 ? `On ${at}` : `${made.length} jumps taken`}
          </p>

          {scaffold && question.ticks === 0 && made.length > 0 && (
            <p className="text-center text-sm font-bold text-ink/60 tabular-nums">
              Jumped {made.map((m) => (m < 0 ? `back ${-m}` : `on ${m}`)).join(", then ")}
            </p>
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

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {question.offered.map((size, i) => {
            const spent = made.filter((m) => m === size).length;
            const wanted = question.required.filter((m) => m === size).length;
            const done = question.answerKind !== "arrival" && spent >= wanted;
            return (
              <motion.button
                key={`${size}-${i}`}
                type="button"
                onClick={() => jump(size)}
                disabled={done || Boolean(round.feedback)}
                whileHover={done ? undefined : { scale: 1.06, y: -2 }}
                whileTap={done ? undefined : { scale: 0.9 }}
                transition={SPRING.tap}
                aria-label={size < 0 ? `Jump back ${-size}` : `Jump forward ${size}`}
                className={themeSystem.button(size < 0 ? "secondary" : "primary", "choice")}
              >
                {size < 0 ? `−${-size}` : `+${size}`}
              </motion.button>
            );
          })}
          {made.length > 0 && question.answerKind !== "jump" && (
            <motion.button
              type="button"
              onClick={undo}
              whileTap={{ scale: 0.92 }}
              transition={SPRING.tap}
              aria-label="Undo last jump"
              className={themeSystem.button("ghost", "sm")}
            >
              Undo
            </motion.button>
          )}
        </div>

        {question.answerKind === "landing" && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm font-bold uppercase tracking-wide text-ink/50">
                Landed on
              </span>
              <span
                className={`min-w-[5rem] h-14 px-4 rounded-2xl border-2 border-dashed ${CHANGE.border} ${ADDEND_B.soft} flex items-center justify-center text-3xl font-black tabular-nums text-ink`}
                aria-label={`Landed on ${entry || "empty"}`}
              >
                {entry || <span className="text-ink/25">?</span>}
              </span>
            </div>
            <NumberPad
              onDigit={(d) => setEntry((v) => `${v}${d}`.slice(0, 4))}
              onDelete={() => setEntry((v) => v.slice(0, -1))}
              disabled={Boolean(round.feedback)}
            />
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
        )}
      </div>
    </SkillRound>
  );
};
