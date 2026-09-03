import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  stagger,
  useSkillRound,
  useSpokenFinish,
  type RoundQuestion,
  playChrome,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { SvgAsset } from "../../../assets/svg";
import { COUNTABLES, type Countable } from "../internal/data/additionAssets";
import { ADDEND_A, ADDEND_B, TOTAL } from "../internal/data/additionPalette";
import { BIN, COUNT_BADGE, SCENE, TOKEN_COMPACT } from "../internal/data/additionLayout";
import { useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import { isPractice, modeAt, type PracticeSetup } from "../../kit";
import {
  drawPair,
  numberWord as say,
  pairKey,
  pick,
  withoutRepeat,
  type Pair,
  type PairSpec,
} from "../internal/data/additionNumbers";

/**
 * Two groups, and every way of counting them that does not yet need a fact.
 *
 * The seven techniques a child meets before any strategy: count all of it,
 * push the groups together, keep the first number in your head, keep the
 * *bigger* number in your head, add nothing, add one, and use the manipulative
 * every child already owns.
 *
 * They are one activity because they are one interaction — objects in two bins
 * and a finger — and `mode` is a lesson parameter, so this component never asks
 * which level it is. All seven modes ship now; the lessons for `count_on`
 * onwards arrive in the same phase, but the rule holds for the engines after
 * this one, where the later modes wait several phases for their lesson.
 */

export type TrayMode =
  | "count_all"
  | "combine"
  | "count_on"
  | "count_on_larger"
  | "add_zero"
  | "add_one"
  | "fingers";

export interface TraySetup extends PracticeSetup {
  mode?: TrayMode;
  /** Bounds for both addends, unless overridden per side. */
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  /**
   * How often the special addend comes first — `0 + 7` rather than `7 + 0`.
   *
   * A lesson that only ever shows the zero on the right teaches the position,
   * not the rule, and a child who has learned "the answer is the first number"
   * is right every time until the day they are not.
   */
  flipChance?: number;
  questionsPerRound?: number;
  /** Pause after the final tap, so the last number is seen and heard. 0 in tests. */
  settleMs?: number;
}

export interface CountTrayParams extends TraySetup {
  /** A lesson nests its generator settings under `question`, beside `play`. */
  question?: TraySetup;
}

export interface TrayQuestion extends RoundQuestion {
  mode: TrayMode;
  a: number;
  b: number;
  sum: number;
  /**
   * One kind of object for both groups.
   *
   * Four apples and three beads is seven *things*, and a five-year-old asked
   * "how many altogether" has a fair reason to hesitate. The groups differ by
   * colour, which is a property of the group; what they hold is the same.
   */
  asset: Countable;
}

/**
 * The numbers each mode is made of, before a lesson says anything.
 *
 * Held per mode rather than blended into one expression, because two bugs live
 * in the blend and both are silent:
 *
 *  - An *absent* lesson key must not erase a mode's own default. Spreading a
 *    setup object straight over these writes `aRange: undefined` for every key
 *    the lesson left out, so Count On — which means "start from four to nine" —
 *    quietly became "start from one to nine" for any lesson that did not
 *    restate its range.
 *  - A default belongs to the *mode*, not to the activity. When these lived in
 *    `defaultParams`, every mode inherited count-all's `sumMax: 10`, so Adding
 *    One's declared range of 1 to 15 could never produce anything above nine.
 *    Nothing failed; the lesson simply did not teach what it said.
 *
 * So: the mode's own numbers, then only the keys a lesson actually declared.
 */
const DEFAULT_SPEC: Record<TrayMode, PairSpec> = {
  count_all: { addendRange: [1, 5], sumMax: 10 },
  combine: { addendRange: [1, 5], sumMax: 10 },
  count_on: { aRange: [4, 9], bRange: [1, 3] },
  // The smaller addend is drawn first on purpose: if the bigger number were
  // already on the left there would be nothing to choose, and the lesson is the
  // choosing. `minGap` is not a lesson's to relax — with the two equal there is
  // no bigger number to start from.
  count_on_larger: { aRange: [1, 3], bRange: [5, 9], minGap: 2 },
  add_zero: { aRange: [1, 10], bRange: [0, 0] },
  add_one: { aRange: [1, 15], bRange: [1, 1] },
  fingers: { addendRange: [1, 5], sumMax: 10 },
};

/** Only the keys a lesson actually set. An absent key changes nothing. */
const declared = (setup: TraySetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: TrayMode, setup: TraySetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  // What a mode *is*, which no lesson may override: adding zero adds zero.
  if (mode === "add_zero") spec.bRange = [0, 0];
  if (mode === "add_one") spec.bRange = [1, 1];
  return spec;
};

export const buildQuestion = (
  setup: TraySetup,
  index: number,
  seen: Set<string>,
): TrayQuestion => {
  const mode = modeAt<TrayMode>(setup, index, "count_all");
  const spec = specFor(mode, setup);
  const flip = setup.flipChance ?? 0;

  const drawn = withoutRepeat<Pair>(
    () => {
      const p = drawPair(spec);
      // `add_zero` and `add_one` put the special addend on either side; every
      // other mode means something by which side is which.
      return (mode === "add_zero" || mode === "add_one") && Math.random() < flip
        ? { a: p.b, b: p.a, sum: p.sum }
        : p;
    },
    pairKey,
    seen,
  );

  return {
    id: `q${index}-${Date.now().toString(36)}`,
    taskKind: `add_${mode}`,
    mode,
    a: drawn.a,
    b: drawn.b,
    sum: drawn.sum,
    asset: pick(COUNTABLES),
    expected: String(drawn.sum),
    itemCount: drawn.sum,
  };
};

/** The question in words, with the lesson's own wording where it gave one. */
export const promptFor = (q: TrayQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum))
    .replaceAll("{item}", q.asset.name);
  if (filled) return filled;

  switch (q.mode) {
    case "combine":
      return "Put the groups together, then count them all.";
    case "count_on":
      return `Start at ${q.a} and count on.`;
    case "count_on_larger":
      return "Start with the bigger number, then count on.";
    case "add_zero":
    case "add_one":
      return `What is ${q.a} plus ${q.b}?`;
    case "fingers":
      return `Show ${q.a} on one hand and ${q.b} on the other. How many fingers altogether?`;
    default:
      return "Count them all. How many altogether?";
  }
};

/**
 * This engine's questions on paper. The reference implementation — see
 * `PrintedQuestion` and `lib/worksheet.ts`.
 *
 * Each mode is decided on its own, because each one keeps its question in a
 * different place:
 *
 *  - `count_all` and `combine` keep it in the objects. Two bins of things to
 *    touch is the question, and there is nothing to write down — the round's
 *    prompt ("Count them all. How many altogether?") is a caption for a picture
 *    that will not be printed. `null`, and the lesson stays out of the printer.
 *  - `count_on` keeps *half* of it in the objects: the round says "Start at 6
 *    and count on" because the three things to count on are on the screen. On
 *    paper the 3 has to be said, or the question has no answer. This is the case
 *    that started all of this.
 *  - `count_on_larger` is a choice, and the choice has to survive: the paper
 *    version names both numbers and asks for the bigger one to be found, which
 *    is the technique.
 *  - `add_zero` and `add_one` are already written arithmetic. They print as the
 *    sum they are, because dressing a rule up in a sentence is how a worksheet
 *    stops looking like the maths it is teaching.
 *  - `fingers` is an instruction the child carries out with their own hands, and
 *    those come with them. It prints as it is said.
 */
export const printedFor = (q: TrayQuestion): PrintedQuestion | null => {
  const answer = String(q.sum);
  switch (q.mode) {
    case "count_on":
      return { text: `Start at ${q.a} and count on ${q.b}. What number do you reach?`, answer };
    case "count_on_larger":
      return {
        text: `${q.a} and ${q.b}. Start from the bigger number and count on. How many altogether?`,
        answer,
      };
    case "add_zero":
    case "add_one":
      return { text: `${q.a} + ${q.b} =`, answer };
    case "fingers":
      return {
        text: `Show ${q.a} on one hand and ${q.b} on the other. How many fingers altogether?`,
        answer,
      };
    default:
      return null;
  }
};

/**
 * How this technique goes, for a sheet that has to teach it.
 *
 * Written for paper: no control is named, nothing is tapped, and each line is
 * something a child could do with a pencil or in their head. See `method` on
 * `WorksheetSource` for why this is not the lesson's own `stepByStep`.
 */
export const methodFor = (q: TrayQuestion): string[] | null => {
  switch (q.mode) {
    case "count_on":
      return [
        "Say the first number out loud. You do not need to count it.",
        "Count on the second number, one at a time.",
        "The last number you say is the answer.",
      ];
    case "count_on_larger":
      return [
        "Find the bigger of the two numbers.",
        "Say it, then count on the smaller one.",
        "Starting from the bigger number leaves less to count.",
      ];
    case "add_zero":
      return ["Zero means nothing was added.", "The answer is the number you started with."];
    case "add_one":
      return ["One more is the next counting number.", "Say the number, then say the one after it."];
    case "fingers":
      return [
        "Hold up the first number on one hand.",
        "Hold up the second number on the other.",
        "Count every raised finger.",
      ];
    default:
      return null;
  }
};

/**
 * Four answers to choose between, centred on the right one.
 *
 * Never below zero, and never a list so wide that scanning it is harder than
 * the addition. The modes that use this — adding zero and adding one — are
 * about a *rule*, so the neighbours are what make the rule visible: the answer
 * sits beside the number the child started from.
 */
export const choicesFor = (answer: number): number[] => {
  const start = Math.max(0, answer - 2);
  return Array.from({ length: 4 }, (_, i) => start + i);
};

/**
 * What to say to a child who is stuck, read off what they have actually done.
 *
 * Pure and exported, so the wording is tested against the state it describes.
 * Rung 1 is the lesson's own tip; rung 2 says what to do *next from here*; rung
 * 3 works the method through with this question's numbers — and stops one step
 * short wherever the child is choosing between answers rather than producing
 * one by counting.
 */
export function trayHints(
  q: TrayQuestion,
  state: {
    counted: number;
    merged: boolean;
    startPicked: number | null;
    fingers: { left: number; right: number };
    kidTip?: string;
  },
): string[] {
  const many = q.asset.name;
  const one = q.asset.one;

  switch (q.mode) {
    case "combine":
      return composeHints(
        state.kidTip ?? "Adding means putting groups together. Then you count once.",
        state.merged
          ? state.counted === 0
            ? `They are one pile now. Touch each ${one} in turn and say the numbers out loud.`
            : `You have counted ${state.counted}. Keep going with the ${many} that have no number on them yet.`
          : `The two groups are still apart. Tap "Put them together" first — that is what adding does.`,
        `There were ${q.a} and ${q.b}. Together that is one pile of ${q.sum} ${many}.`,
      );

    case "count_on": {
      const left = q.b - state.counted;
      return composeHints(
        state.kidTip ?? "The closed box is already counted. Start from its number.",
        state.counted === 0
          ? `The box holds ${q.a}. Do not count it again — say "${say(q.a)}", then touch the first ${one} outside it and say "${say(q.a + 1)}".`
          : `You are at ${q.a + state.counted}. There ${left === 1 ? "is 1" : `are ${left}`} still to touch — say ${say(q.a + state.counted + 1)} for the next one.`,
        `Start at ${q.a} and count on ${q.b}: ${Array.from({ length: q.b }, (_, i) => q.a + i + 1).join(", ")}.`,
      );
    }

    case "count_on_larger": {
      const bigger = Math.max(q.a, q.b);
      const smaller = Math.min(q.a, q.b);
      return composeHints(
        state.kidTip ?? "You can add in any order, so start from the bigger number.",
        state.startPicked === null
          ? `${bigger} is bigger than ${smaller}. Start from ${bigger} and you only have ${smaller} more to count — starting from ${smaller} would mean counting ${bigger}.`
          : `You started at ${state.startPicked}. Touch the ${many} in the other group one at a time, counting on.`,
        `Start at ${bigger} and count on ${smaller}: ${Array.from({ length: smaller }, (_, i) => bigger + i + 1).join(", ")}.`,
      );
    }

    case "add_zero": {
      const some = q.a === 0 ? q.b : q.a;
      return composeHints(
        state.kidTip ?? "Zero means none. The number stays the same.",
        `One group is empty. Nothing is going in and nothing is coming out, so the ${some} ${many} are still there.`,
        // Stops at the rule rather than the number: the child is choosing
        // between answers here, so saying the total would answer it for them.
        `Adding zero always leaves a number exactly as it was.`,
      );
    }

    case "add_one": {
      const some = q.b === 1 ? q.a : q.b;
      return composeHints(
        state.kidTip ?? "Adding one is just saying the next number.",
        `You have ${some}, and one more is going in. Count on just once from ${some}.`,
        `The number straight after ${some} when you count is the answer.`,
      );
    }

    case "fingers":
      return composeHints(
        state.kidTip ?? "One number on each hand. Then count every finger that is up.",
        state.fingers.left + state.fingers.right === 0
          ? `Put ${q.a} up on the left hand and ${q.b} up on the right hand.`
          : `You have ${state.fingers.left} up on the left and ${state.fingers.right} on the right. You need ${q.a} and ${q.b}.`,
        `Count every raised finger, starting on the left: ${Array.from({ length: q.sum }, (_, i) => i + 1).join(", ")}.`,
      );

    default: {
      const left = q.sum - state.counted;
      return composeHints(
        state.kidTip ?? "Do not start again at the second group. Keep counting on.",
        state.counted === 0
          ? `Start at the left-hand group. Touch a ${one} and say "one", and keep a number for each one you touch.`
          : `You have counted ${state.counted}. There ${left === 1 ? "is 1 left" : `are ${left} left`} — carry straight on into the other group, saying ${say(state.counted + 1)} next.`,
        `There are ${q.a} in one group and ${q.b} in the other. Counted straight through, that is ${q.sum} ${many} altogether.`,
      );
    }
  }
}

/**
 * The bar's icon, per mode rather than per lesson.
 *
 * The lesson carries its own icon for the places a lesson is *listed*; this is
 * what sits above the question while it is being played, and it belongs to the
 * mode — the same picture every time a child meets counting on, whichever
 * lesson brought them there.
 */
const ICONS: Record<TrayMode, string> = {
  count_all: "boxes",
  combine: "layers",
  count_on: "footprints",
  count_on_larger: "scale",
  add_zero: "circleDot",
  add_one: "zap",
  fingers: "sparkles",
};

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

/** One tappable object. The whole thing is the target, not a chip around it. */
const Token: React.FC<{
  asset: Countable;
  label: string;
  order: number | null;
  badges: boolean;
  tone: "a" | "b";
  onTap?: () => void;
  delay: number;
}> = ({ asset, label, order, badges, tone, onTap, delay }) => (
  <motion.button
    type="button"
    onClick={onTap}
    disabled={!onTap}
    whileHover={onTap ? { scale: 1.08 } : undefined}
    whileTap={onTap ? { scale: 0.85 } : undefined}
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ ...SPRING.enter, delay }}
    aria-label={label}
    className={`relative ${TOKEN_COMPACT} flex items-center justify-center rounded-2xl`}
  >
    <span
      className={`block w-full h-full transition-[filter,opacity] duration-200 ${
        order !== null ? "opacity-55 saturate-[0.35]" : "drop-shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
      }`}
    >
      <SvgAsset id={asset.id} size="100%" title={asset.one} />
    </span>
    {order !== null && badges && (
      <motion.span
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={SPRING.celebrate}
        className={`${COUNT_BADGE} text-white ${tone === "a" ? "bg-violet-600" : "bg-sky-600"}`}
      >
        {order}
      </motion.span>
    )}
  </motion.button>
);

/**
 * A group given as a number rather than as a pile.
 *
 * Two jobs, and they are the same job: a closed box whose count is already
 * known, and a group too big to be worth drawing. Fifteen objects beside one
 * object is a picture of a blob beside a thing — the child cannot see "fifteen"
 * in it, so nothing is gained by the fifteen shapes, and the screen is busier
 * for them.
 */
const GroupTile: React.FC<{
  value: number;
  tone: "a" | "b";
  caption: string;
  onPick?: () => void;
  picked?: boolean;
}> = ({ value, tone, caption, onPick, picked }) => {
  const role = tone === "a" ? ADDEND_A : ADDEND_B;
  const shell = `${BIN} min-w-[6.5rem] flex flex-col items-center justify-center gap-0.5 ${role.soft} ${
    picked ? "ring-4 ring-emerald-400/70" : ""
  }`;
  const face = (
    <>
      <span className={`text-4xl sm:text-5xl font-black tabular-nums ${role.text}`}>{value}</span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">{caption}</span>
    </>
  );

  /*
   * A tile nobody can press is not a button.
   *
   * It was one — disabled — which reads to a screen reader as a control that
   * exists but is unavailable, when in fact there is nothing to do here at all:
   * it is a group of fourteen, stated as a number. Only the one the child
   * chooses a starting point from is interactive.
   */
  if (!onPick) {
    return (
      <div className={shell} role="img" aria-label={`A group of ${value} ${caption}`}>
        {face}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onPick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      transition={SPRING.tap}
      aria-label={`Start from ${value}`}
      aria-pressed={Boolean(picked)}
      className={shell}
    >
      {face}
    </motion.button>
  );
};

/**
 * Above this many, a group is shown as its number instead of as objects.
 *
 * Only reached by the modes that are answered from tiles rather than by
 * touching — adding one to fourteen is a rule, not a count, and drawing
 * fourteen things invites a child to count them and lose the rule.
 */
const TOO_MANY_TO_DRAW = 10;

/** Five fingers and a palm. Tapping finger n raises n of them, as a hand does. */
const Hand: React.FC<{
  side: "Left" | "Right";
  up: number;
  onSet: (n: number) => void;
}> = ({ side, up, onSet }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex items-end gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const raised = n <= up;
        return (
          <motion.button
            key={n}
            type="button"
            onClick={() => onSet(up === n ? n - 1 : n)}
            whileTap={{ scale: 0.92 }}
            transition={SPRING.tap}
            aria-label={`${side} finger ${n}`}
            aria-pressed={raised}
            className={`w-7 sm:w-8 rounded-t-full border-2 transition-all ${
              raised
                ? `h-16 sm:h-20 ${TOTAL.solid} border-emerald-300 shadow-lg`
                : "h-8 sm:h-10 bg-surface border-line"
            }`}
          />
        );
      })}
    </div>
    <div className="w-full h-9 sm:h-11 rounded-2xl bg-ink/10" />
    <span className="text-xs font-bold uppercase tracking-wide text-ink/55">
      {side} · <span className="tabular-nums">{up}</span>
    </span>
  </div>
);

/* -------------------------------------------------------------------------- */
/* The activity                                                                */
/* -------------------------------------------------------------------------- */

export const CountTray: React.FC<ActivityProps<CountTrayParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: TraySetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  /** The lesson's own child-facing copy: the spoken intro, and hint rung one. */
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);

  /** Questions already asked this round, so five of them are five questions. */
  const seen = useRef(new Set<string>());

  const [counted, setCounted] = useState<string[]>([]);
  const [merged, setMerged] = useState(false);
  const [startSide, setStartSide] = useState<"a" | "b" | null>(null);
  const [fingers, setFingers] = useState({ left: 0, right: 0 });
  /**
   * A word about a move that was not allowed, shown and then gone.
   *
   * Refusing a move silently reads as the app being broken, and refusing it
   * through the hint ladder would be worse: it files `supportUsed` against a
   * child who never asked for help, and opens the ladder at rung one — the
   * lesson's generic tip — rather than at the sentence that explains this
   * particular no. So it is its own line, and the log stays honest.
   */
  const nudge = useNudge(koda);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  /* The last number has to be *heard* before the round reacts to it — the
     praise clip starts by stopping whatever is speaking, so submitting in the
     same tick congratulates a child instead of telling them the total. */
  const finishing = useSpokenFinish({ floorMs: setup.settleMs });

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

  const question = round.question as TrayQuestion;

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
    finishing.cancel();
    setCounted([]);
    setMerged(false);
    setStartSide(null);
    setFingers({ left: 0, right: 0 });
    nudge.clear();
  }, [question.id, finishing]);

  // A pending nudge must not outlive the activity.

  /* Every feature the manifest declares is read here. A flag nothing checks is
     a lie in the Skill Manager. */
  // Practice says nothing at all, on top of the family's own voice switch.
  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const badges = koda.config.isEnabled("counting_badges", true);
  const showsTotal = koda.config.isEnabled("running_total_badge", true);


  const buzz = (kind: "tap" | "success") => {
    if (kind === "success") koda.haptics.success();
    else koda.haptics.tap();
  };

  /** Say the running count. Resolves once the word is finished, so a tap can wait. */
  const countAloud = (n: number): Promise<void> => {
    if (!speaks) return Promise.resolve();
    return koda.speech
      .say(say(n), speechRate(koda))
      .catch(() => {});
  };

  /* Where the count starts, and how many objects are still to be touched. One
     expression for all four counting modes, rather than a branch per mode. */
  /** The number already counted, which is where the child's count carries on from. */
  const startPicked = startSide === null ? null : question[startSide];
  const base =
    question.mode === "count_on"
      ? question.a
      : question.mode === "count_on_larger"
        ? (startPicked ?? 0)
        : 0;
  const toTap =
    question.mode === "count_on"
      ? question.b
      : question.mode === "count_on_larger"
        ? question.sum - (startPicked ?? question.sum)
        : question.sum;
  const running = base + counted.length;

  const submitTotal = (given: number, correct: boolean, message: string) => {
    submit({
      correct,
      given: String(given),
      expected: String(question.sum),
      errorKind: correct ? undefined : given === question.sum ? undefined : "miscounted_items",
      title: correct ? "That is the total!" : "Count them again",
      message,
    });
  };

  const tapToken = (key: string) => {
    if (counted.includes(key)) return;
    if (round.feedback) return;
    const next = [...counted, key];
    setCounted(next);
    buzz("tap");
    playChrome(koda, "pop");
    const spoken = countAloud(base + next.length);

    if (next.length === toTap) {
      playChrome(koda, "success");
      buzz("success");
      const reached = base + next.length;
      finishing.after(spoken, () =>
        submitTotal(
          reached,
          reached === question.sum,
          question.mode === "count_on" || question.mode === "count_on_larger"
            ? `You started at ${base} and counted on ${toTap}. That makes ${question.sum}.`
            : `${question.a} and ${question.b} counted straight through is ${question.sum}.`,
        ),
      );
    }
  };

  const pickStart = (side: "a" | "b") => {
    const value = question[side];
    const bigger = Math.max(question.a, question.b);
    if (value < bigger) {
      /* Not a wrong answer — a wrong *route*. The child has not said what the
         total is yet, so scoring this would file an answer they never gave. */
      nudge.refuse(
        `Starting at ${value} means counting ${bigger} more. Start at ${bigger} and there are only ${value} to count.`,
      );
      return;
    }
    setStartSide(side);
    playChrome(koda, "clink");
    buzz("tap");
    void countAloud(value);
  };

  const choose = (value: number) => {
    if (round.feedback) return;
    const correct = value === question.sum;
    playChrome(koda, correct ? "success" : "error");
    buzz(correct ? "success" : "tap");
    submit({
      correct,
      given: String(value),
      expected: String(question.sum),
      errorKind: correct ? undefined : Math.abs(value - question.sum) === 1 ? "off_by_one" : "off_by_more",
      title: correct ? "That is the total!" : "Not quite",
      message: correct
        ? question.mode === "add_zero"
          ? `Adding zero left it exactly as it was: ${question.sum}.`
          : `One more than ${question.b === 1 ? question.a : question.b} is ${question.sum}.`
        : `${question.a} plus ${question.b} is ${question.sum}.`,
    });
  };

  const checkFingers = () => {
    if (round.feedback) return;
    const raised = fingers.left + fingers.right;
    if (raised === 0) {
      nudge.refuse(`No fingers are up yet. Put ${question.a} on one hand and ${question.b} on the other.`);
      return;
    }
    const correct = raised === question.sum;
    playChrome(koda, correct ? "success" : "error");
    buzz(correct ? "success" : "tap");
    submitTotal(
      raised,
      correct,
      correct
        ? `${fingers.left} on one hand and ${fingers.right} on the other — ${question.sum} fingers.`
        : `You have ${raised} fingers up. Put ${question.a} on one hand and ${question.b} on the other.`,
    );
  };

  const mergeGroups = () => {
    setMerged(true);
    playChrome(koda, "clink");
    buzz("tap");
    if (speaks) void koda.speech.say("Put them together!", speechRate(koda));
  };

  const prompt = promptFor(question, copy.prompts?.default);

  /* The framing chip's wording, which a family may reword in Settings. Blank
     means "no opinion", so the kit's default applies. */

  const tapsAllowed = !round.feedback;
  /** The bin a child counts on from stays closed; the other one opens. */
  const closedForStart = (side: "a" | "b") =>
    question.mode === "count_on_larger" && (startSide === null || startSide === side);
  const groupATappable =
    tapsAllowed &&
    (question.mode === "count_all" ||
      question.mode === "combine" ||
      (question.mode === "count_on_larger" && startSide === "b"));
  const groupBTappable =
    tapsAllowed &&
    (question.mode === "count_all" ||
      question.mode === "combine" ||
      question.mode === "count_on" ||
      (question.mode === "count_on_larger" && startSide === "a"));

  const orderOf = (key: string): number | null => {
    const at = counted.indexOf(key);
    return at === -1 ? null : base + at + 1;
  };

  const groupTokens = (side: "a" | "b", count: number, tappable: boolean) => (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center max-w-[260px]">
      {Array.from({ length: count }, (_, i) => {
        const key = `${side}${i}`;
        return (
          <Token
            key={key}
            asset={question.asset}
            label={`${side === "a" ? "First" : "Second"} group ${question.asset.one} ${i + 1}${
              orderOf(key) !== null ? ", counted" : ""
            }`}
            order={orderOf(key)}
            badges={badges}
            tone={side}
            onTap={tappable ? () => tapToken(key) : undefined}
            delay={stagger(i)}
          />
        );
      })}
    </div>
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Count and Combine"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName={ICONS[question.mode]}
      iconTone="purple"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message}
      hints={practising ? [] : trayHints(question, {
        counted: counted.length,
        merged,
        startPicked,
        fingers,
        kidTip: copy.kidTip,
      })}
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
        <div className={`${SCENE} p-4 sm:p-6 min-h-[210px] flex flex-col items-center justify-center gap-4`}>
          {question.mode === "fingers" ? (
            <div className="flex items-end gap-6 sm:gap-12">
              <Hand side="Left" up={fingers.left} onSet={(n) => setFingers((f) => ({ ...f, left: n }))} />
              <Hand side="Right" up={fingers.right} onSet={(n) => setFingers((f) => ({ ...f, right: n }))} />
            </div>
          ) : merged ? (
            /* One pile, once the groups have been put together. The objects
               keep their colours, so a child can still see the two groups
               inside the one they now belong to. */
            <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center max-w-[340px]">
              {Array.from({ length: question.a + question.b }, (_, i) => {
                const side = i < question.a ? "a" : "b";
                const key = `${side}${side === "a" ? i : i - question.a}`;
                return (
                  <Token
                    key={key}
                    asset={question.asset}
                    label={`Pile ${question.asset.one} ${i + 1}${orderOf(key) !== null ? ", counted" : ""}`}
                    order={orderOf(key)}
                    badges={badges}
                    tone={side}
                    onTap={tapsAllowed ? () => tapToken(key) : undefined}
                    delay={stagger(i)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 sm:gap-7">
              <div className="min-h-[104px] flex items-center justify-center">
                {question.mode === "count_on" ? (
                  <GroupTile value={question.a} tone="a" caption="in the box" />
                ) : closedForStart("a") ? (
                  <GroupTile
                    value={question.a}
                    tone="a"
                    caption={startSide === "a" ? "counted" : "in the box"}
                    picked={startSide === "a"}
                    onPick={startSide === null ? () => pickStart("a") : undefined}
                  />
                ) : question.a > TOO_MANY_TO_DRAW ? (
                  <GroupTile value={question.a} tone="a" caption={question.asset.name} />
                ) : question.a === 0 ? (
                  <EmptyGroup />
                ) : (
                  groupTokens("a", question.a, groupATappable)
                )}
              </div>

              {/* The only thing dividing the two groups, now that neither sits
                  in a box of its own — so it has to be big enough to do it. */}
              <span aria-hidden="true" className="text-4xl sm:text-5xl font-black text-ink/30 select-none leading-none">
                +
              </span>

              <div className="min-h-[104px] flex items-center justify-center">
                {closedForStart("b") ? (
                  <GroupTile
                    value={question.b}
                    tone="b"
                    caption={startSide === "b" ? "counted" : "in the box"}
                    picked={startSide === "b"}
                    onPick={startSide === null ? () => pickStart("b") : undefined}
                  />
                ) : question.b > TOO_MANY_TO_DRAW ? (
                  <GroupTile value={question.b} tone="b" caption={question.asset.name} />
                ) : question.b === 0 ? (
                  <EmptyGroup />
                ) : (
                  groupTokens("b", question.b, groupBTappable)
                )}
              </div>
            </div>
          )}

          {showsTotal && (running > 0 || counted.length > 0) && (
            <motion.span
              key={running}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.celebrate}
              aria-live="polite"
              className={`text-4xl font-black tabular-nums leading-none ${TOTAL.text}`}
            >
              {running}
            </motion.span>
          )}
        </div>

        {question.mode === "combine" && !merged && (
          <div className="flex justify-center">
            <motion.button
              type="button"
              onClick={mergeGroups}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING.tap}
              className={themeSystem.button("primary", "lg")}
            >
              Put them together
            </motion.button>
          </div>
        )}

        {question.mode === "fingers" && (
          <div className="flex justify-center">
            <motion.button
              type="button"
              onClick={checkFingers}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING.tap}
              className={themeSystem.button("primary", "lg")}
            >
              Check
            </motion.button>
          </div>
        )}

        {(question.mode === "add_zero" || question.mode === "add_one") && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {choicesFor(question.sum).map((n) => (
              <motion.button
                key={n}
                type="button"
                onClick={() => choose(n)}
                disabled={Boolean(round.feedback)}
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.88, y: 2 }}
                transition={SPRING.tap}
                className={themeSystem.button("secondary", "choice")}
              >
                {n}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </SkillRound>
  );
};

/** An empty group is still a group — drawn, not omitted, or zero is invisible. */
const EmptyGroup: React.FC = () => (
  /* The one outline left on the screen, and it is doing real work: with no
     border and no objects there would be nothing there at all, and a child
     cannot add a group they cannot see. */
  <div className="w-24 h-20 rounded-3xl border-2 border-dashed border-line/80 flex items-center justify-center">
    <span className="text-3xl font-black text-ink/25 tabular-nums">0</span>
  </div>
);
