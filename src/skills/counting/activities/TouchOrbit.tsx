import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  SPRING,
  guideSetup,
  useGuide,
  composeHints,
  idleFloat,
  playCopy,
  stagger,
  useMotionOK,
  useSkillRound,
  useSpokenFinish,
  type RoundQuestion,
  isPractice,
  modeAt,
  playChrome,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { PREDEFINED_ASSETS, type PredefinedAsset } from "../internal/data/countingAssets";
import { SvgAsset } from "../../../assets/svg";
import {
  COUNTABLE,
  COUNTABLE_COMPACT,
  COUNT_BADGE,
  SCENE,
} from "../internal/data/countingLayout";
import { isWander, nextTarget, numberWord } from "../internal/guide/countGuide";

/**
 * Touch each thing and count as you go.
 *
 * The one-to-one lessons: a row, a scatter, or two groups to compare. Tapping is
 * the point — a child who counts by pointing is doing the thing the concept is
 * named after, and the tag numbers stop them counting one twice.
 */

export type OrbitMode = "row" | "scatter" | "compare";
type Layout = "cluster" | "line" | "circle" | "pairs" | "scattered" | "column";

export interface OrbitSetup {
  mode?: OrbitMode;
  countRange?: [number, number];
  /** `scatter`: bounds and spacing, in percent. */
  scatter?: {
    top?: [number, number];
    left?: [number, number];
    rotate?: [number, number];
    minDistance?: number;
  };
  /** `compare`: which outcomes may come up, and by how much they differ. */
  compareModes?: ("SAME" | "A_MORE" | "B_MORE")[];
  biasedRange?: [number, number];
  diffRange?: [number, number];
  questionsPerRound?: number;
  /**
   * Pause after the final tap before the round reacts, in ms.
   *
   * Display timing rather than pedagogy, so a lesson may tune it — and a test
   * may set it to 0 rather than spending a real second per question waiting for
   * an animation it is not asserting on.
   */
  settleMs?: number;
}

export interface TouchOrbitParams extends OrbitSetup {
  /** Counting nests a level's generator settings under `question`. */
  question?: OrbitSetup;
}

interface Placement {
  top: string;
  left: string;
  rotate: string;
}

interface OrbitQuestion extends RoundQuestion {
  mode: OrbitMode;
  asset: PredefinedAsset;
  count: number;
  /** `scatter` only. */
  places?: Placement[];
  /** `compare` only. */
  compare?: {
    countA: number;
    countB: number;
    assetA: PredefinedAsset;
    assetB: PredefinedAsset;
    layoutA: Layout;
    layoutB: Layout;
    answer: "A" | "B" | "SAME";
  };
}

const LAYOUTS: Layout[] = ["cluster", "line", "circle", "pairs", "scattered", "column"];

const randomInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const rangeOr = (range: [number, number] | undefined, lo: number, hi: number) =>
  randomInt(range?.[0] ?? lo, range?.[1] ?? hi);
const sample = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/**
 * "Rockets" → "rocket". Asset names are plural; the prompt says "each".
 *
 * The `-ves` rule is not decoration: without it the app asked a child to "touch
 * every leave", and the prompt is also what the recorded voice says, so a wrong
 * form is wrong out loud as well as on screen.
 */
const singular = (name: string): string => {
  const n = name.toLowerCase();
  if (n.endsWith("ies")) return `${n.slice(0, -3)}y`;
  if (n.endsWith("ves")) return `${n.slice(0, -3)}f`;
  if (/(ch|sh|s|x|z)es$/.test(n)) return n.slice(0, -2);
  return n.endsWith("s") ? n.slice(0, -1) : n;
};

/**
 * Placements that do not overlap, so nothing hides behind anything else.
 *
 * A jittered grid rather than random sampling. The scene is divided into as many
 * cells as there are objects, the cells are shuffled, and each object sits near
 * the middle of its own cell — so separation is guaranteed by construction, at
 * any screen width and for any count, while the jitter keeps the arrangement
 * from looking like a spreadsheet.
 *
 * The previous version drew random points and rejected ones that were too close.
 * That reads as the obvious approach and it fails in a way that is easy to miss:
 * when it cannot find a legal spot it has to place the object *somewhere*, and
 * the fallback overlaps. Measuring real rendered boxes showed ten overlapping
 * pairs across five questions at one window size and none at another — the bug
 * was invisible on the machine it was written on.
 *
 * Each point is the object's *centre*; the render translates by -50%.
 */
const scatterPlaces = (count: number, setup: OrbitSetup["scatter"]): Placement[] => {
  const [topLo, topHi] = setup?.top ?? [16, 84];
  const [leftLo, leftHi] = setup?.left ?? [12, 88];

  /* Wider than tall, so the grid gets more columns than rows — matching the
     shape of the scene keeps the cells nearer to square, and square cells are
     what leave room for a square object. */
  const cols = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * 2))));
  const rows = Math.ceil(count / cols);

  const cellW = (leftHi - leftLo) / cols;
  const cellH = (topHi - topLo) / rows;

  /*
   * How far an object may stray from its cell's centre.
   *
   * An eighth, because two neighbours can each stray *towards* each other: the
   * closest they ever get is `cell - 2 × jitter`, so a jitter of a third leaves
   * them only a third of a cell apart. On an 820px window that was 48px between
   * centres of 80px objects, and they overlapped — a grid does not save you if
   * the jitter is allowed to undo it. An eighth keeps three quarters of the cell
   * as guaranteed clearance, which stays wider than the object at every step of
   * the size ladder.
   */
  const jitterX = cellW / 8;
  const jitterY = cellH / 8;

  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ r, c });

  // Fisher-Yates, so which cells go unused varies — the last row is not always
  // the empty one, and `.sort(() => Math.random() - 0.5)` is not a shuffle.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return cells.slice(0, count).map(({ r, c }) => ({
    left: `${leftLo + cellW * (c + 0.5) + (Math.random() * 2 - 1) * jitterX}%`,
    top: `${topLo + cellH * (r + 0.5) + (Math.random() * 2 - 1) * jitterY}%`,
    rotate: `${rangeOr(setup?.rotate, -12, 12)}deg`,
  }));
};

export const buildQuestion = (setup: OrbitSetup, index: number): OrbitQuestion => {
  const mode = modeAt<OrbitMode>(
    { mode: setup.mode, modes: (setup as { modes?: OrbitMode[] }).modes },
    index,
    "row",
  );
  const asset = sample(PREDEFINED_ASSETS);
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `count_objects_${mode}`, asset };

  if (mode === "compare") {
    const outcome = sample(setup.compareModes ?? ["SAME", "SAME", "A_MORE", "B_MORE"]);
    const [dLo, dHi] = setup.diffRange ?? [1, 2];
    let countA = rangeOr(setup.countRange, 3, 8);
    let countB = countA;

    if (outcome === "A_MORE") {
      countA = rangeOr(setup.biasedRange, 4, 8);
      countB = countA - randomInt(dLo, Math.min(dHi, countA - 2));
    } else if (outcome === "B_MORE") {
      countB = rangeOr(setup.biasedRange, 4, 8);
      countA = countB - randomInt(dLo, Math.min(dHi, countB - 2));
    }

    // Different arrangements on purpose: conservation is the idea that moving
    // things around does not change how many there are.
    const [layoutA, layoutB] = [...LAYOUTS].sort(() => Math.random() - 0.5);
    const assetB = Math.random() > 0.5 ? asset : sample(PREDEFINED_ASSETS);
    const answer = countA === countB ? "SAME" : countA > countB ? "A" : "B";

    return {
      ...base,
      mode,
      count: countA,
      expected: answer,
      compare: { countA, countB, assetA: asset, assetB, layoutA, layoutB, answer },
    };
  }

  const count = rangeOr(setup.countRange, mode === "scatter" ? 5 : 3, mode === "scatter" ? 8 : 7);
  return {
    ...base,
    mode,
    count,
    expected: String(count),
    itemCount: count,
    places: mode === "scatter" ? scatterPlaces(count, setup.scatter) : undefined,
  };
};

/** Arrangements, widened for 56px objects — the old maxima were set for 40px. */
const LAYOUT_CLASS: Record<Layout, string> = {
  cluster: "flex flex-wrap gap-2 justify-center max-w-[240px]",
  line: "flex gap-2.5 items-center justify-center flex-wrap max-w-[280px]",
  circle: "flex flex-wrap gap-3 justify-center max-w-[250px]",
  pairs: "grid grid-cols-2 gap-2.5 justify-center",
  scattered: "flex flex-wrap gap-3 justify-center max-w-[260px]",
  column: "flex flex-col gap-2 items-center justify-center",
};

/** One group of things to tap, in whichever arrangement the question chose. */
const TapGroup: React.FC<{
  count: number;
  asset: PredefinedAsset;
  layout: Layout;
  tapped: number[];
  onTap: (index: number) => void;
  tone: "orange" | "cyan";
}> = ({ count, asset, layout, tapped, onTap, tone }) => (
  <div className={LAYOUT_CLASS[layout]}>
    {Array.from({ length: count }, (_, i) => {
      const on = tapped.includes(i);
      return (
        <motion.button
          key={i}
          onClick={() => onTap(i)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.85, rotate: i % 2 === 0 ? -4 : 4 }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING.enter, delay: stagger(i) }}
          aria-label={`${singular(asset.name)} ${i + 1}${on ? ", counted" : ""}`}
          /* Same treatment as the scattered scene: the object is the target, not
             a chip around it, and 56px is what a small hand can hit reliably in
             a two-column comparison. */
          className={`relative ${COUNTABLE_COMPACT} flex items-center justify-center`}
        >
          <span
            className={`block w-full h-full transition-[filter,opacity] duration-200 ${
              on ? "opacity-55 saturate-[0.35]" : "drop-shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
            }`}
          >
            <SvgAsset id={asset.id} size="100%" title={singular(asset.name)} />
          </span>
          {on && (
            <motion.span
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={SPRING.celebrate}
              className={`${COUNT_BADGE} text-white ${
                tone === "orange" ? "bg-orange-500" : "bg-cyan-600"
              }`}
            >
              {tapped.indexOf(i) + 1}
            </motion.span>
          )}
        </motion.button>
      );
    })}
  </div>
);

/**
 * What to say to a child who is stuck on this question.
 *
 * Pure and exported so the wording can be tested against the question it is
 * about — a hint that says "you have touched 3" when four are tagged is worse
 * than no hint, and that is exactly the kind of drift a rendered test misses.
 *
 * Written off live tap counts rather than off the question alone: the second
 * rung's job is to tell the child what to do *next*, and next depends on what
 * they have already done.
 */
/** The question in words, as the round says it. */
export const promptFor = (q: OrbitQuestion): string =>
  q.mode === "compare"
    ? q.compare!.answer === "SAME"
      ? "Count both groups. Do they have the same?"
      : "Count both groups. Which one has more?"
    : q.mode === "scatter"
      ? `Touch every ${singular(q.asset.name)}. Do not miss any!`
      : `Touch each ${singular(q.asset.name)}. Count as you go!`;

/**
 * On paper.
 *
 * "Touch every fish" is an instruction to a finger. What survives is the
 * question underneath it — how many are there — and that only works because the
 * fish come with it: see `figureFor`. Without the objects printed this would be
 * the emptiest sheet in the app, which is why counting could not print at all
 * until the figures existed.
 */
export const printedFor = (q: OrbitQuestion): PrintedQuestion => {
  if (q.mode === "compare") {
    const { answer } = q.compare!;
    return {
      text: "Count both groups. Which has more?",
      answer:
        answer === "SAME" ? "They are the same" : answer === "A" ? "The first group" : "The second group",
    };
  }
  return { text: `How many ${q.asset.name.toLowerCase()} are there?`, answer: String(q.count) };
};

/** How the technique goes, in paper words. */
export const methodFor = (q: OrbitQuestion): string[] =>
  q.mode === "compare"
    ? [
        "Count the first group and write the number down.",
        "Count the second group.",
        "The bigger number is the group with more — even if it takes up less room.",
      ]
    : [
        "Count them one at a time, saying each number out loud.",
        "Cross each one off as you count it, so none is counted twice.",
        "The last number you say is how many there are.",
      ];

/**
 * The objects, printed to be counted.
 *
 * The skill's own artwork, which is drawn in `currentColor` — so on paper it
 * comes out as black line art rather than as eight colours a school printer
 * would charge for.
 *
 * Laid out in a wrapped row rather than scattered as the round scatters them:
 * on screen the scatter is the difficulty, and on paper it is a page a child
 * cannot mark off in order and an adult cannot check.
 */
export const figureFor = (q: OrbitQuestion): React.ReactNode => {
  const group = (asset: PredefinedAsset, count: number, key: string) => (
    <span key={key} className="inline-flex max-w-[16rem] flex-wrap gap-1.5 rounded border border-slate-300 p-2">
      {Array.from({ length: count }, (_, i) => (
        <SvgAsset key={i} id={asset.id} className="h-6 w-6 text-slate-900" />
      ))}
    </span>
  );

  if (q.mode === "compare") {
    const { assetA, countA, assetB, countB } = q.compare!;
    return (
      <span className="inline-flex items-start gap-4">
        {group(assetA, countA, "a")}
        {group(assetB, countB, "b")}
      </span>
    );
  }
  return group(q.asset, q.count, "one");
};

export function orbitHints(
  question: OrbitQuestion,
  state: { tapped: number; tappedA: number; tappedB: number; kidTip?: string },
): string[] {
  const one = singular(question.asset.name);
  const many = question.asset.name.toLowerCase();

  if (question.mode === "compare") {
    const c = question.compare!;
    const counted = state.tappedA > 0 || state.tappedB > 0;
    return composeHints(
      state.kidTip ?? "Spreading things out does not make more.",
      counted
        ? `You have ${state.tappedA} on the left and ${state.tappedB} on the right. Finish both.`
        : "Touch the left group one at a time, then do the right.",
      // The two counts, not the verdict: counting is the work and deciding
      // which is bigger is the question. A rung that answered it would leave
      // nothing to answer.
      `Left has ${c.countA}. Right has ${c.countB}. Which number is bigger?`,
    );
  }

  const left = question.count - state.tapped;
  const next = numberWord(state.tapped + 1);

  if (question.mode === "scatter") {
    return composeHints(
      state.kidTip ?? "Go in order so you do not miss any.",
      state.tapped === 0
        ? `Start at the top and work down. Each ${one} keeps its number.`
        : `${state.tapped} have numbers now. Touch a plain one and say "${next}".`,
      // Reaching the total is the answer here — the round is scored by touching
      // every one, not by naming a number — so the last rung may say it.
      left === 1
        ? `One ${one} is still plain. Touch it and say "${numberWord(question.count)}".`
        : `${left} ${many} still need a number. Keep counting on to ${question.count}.`,
    );
  }

  return composeHints(
    state.kidTip ?? "Say one number for each one you touch.",
    state.tapped === 0
      ? `Start at the far-left ${one}. Touch it and say "one".`
      : `You have counted ${state.tapped}. Touch the next ${one} and say "${next}".`,
    `Touch every ${one} in order. The last number, ${question.count}, is how many.`,
  );
}

export const TouchOrbit: React.FC<ActivityProps<TouchOrbitParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: OrbitSetup = { ...params, ...params.question };
  const total = setup.questionsPerRound ?? 5;
  /** The lesson's own child-facing copy: the spoken intro, and hint rung one. */
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup as { practice?: boolean });

  const [tapped, setTapped] = useState<number[]>([]);
  const [tappedA, setTappedA] = useState<number[]>([]);
  const [tappedB, setTappedB] = useState<number[]>([]);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  /**
   * The count-along: which object was last touched, and what number it made.
   *
   * The point of this activity is one-to-one correspondence — that *this* fish
   * is number four — and a badge that simply appears does not show the child the
   * link being made. Floating the number up out of the object they just touched,
   * at the same moment the voice says it, is the correspondence made visible.
   */
  const [lastTap, setLastTap] = useState<{ index: number; n: number; key: number } | null>(null);
  const tapSeq = useRef(0);
  /** Hops across the scene on this question. One is a shrug; two is a signal. */
  const wanders = useRef(0);
  const motionOK = useMotionOK();
  /*
   * The last number has to be *heard* before the round reacts to it.
   *
   * See `useSpokenFinish`. Cancelled whenever the scene resets, so a clip that
   * resolves late cannot finish a question that is no longer on screen.
   */
  const finishing = useSpokenFinish({ floorMs: setup.settleMs });

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

  const question = round.question as OrbitQuestion;

  /**
   * The offline coach.
   *
   * Off unless the lesson asks for it, and off in practice — practice is the
   * lesson with the scaffolding taken away, and a tutor that leans in uninvited
   * is the largest piece of scaffolding this activity has. Row mode only: every
   * line it says is about a left-to-right route through a row, and the scatter
   * has no such thing.
   */
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
    !practising &&
    (guideCfg.enabled ?? false) &&
    // A parent's switch, in the Skill Manager beside the badges and the voice.
    // Some children find being interrupted worse than being stuck.
    koda.config.isEnabled("guide_coach", true);

  /*
   * Where the coach points, per mode.
   *
   * A row or a scatter has a next object; a comparison has a next *group*, so
   * the target is a side — 0 for the left, 1 for the right — and the scene
   * rings the whole group rather than one butterfly inside it. Different index
   * spaces, but the same promise: whatever rung two lights is the thing to
   * touch next.
   */
  const guideTarget =
    question.mode === "compare"
      ? tappedA.length < (question.compare?.countA ?? 0)
        ? 0
        : tappedB.length < (question.compare?.countB ?? 0)
          ? 1
          : -1
      : nextTarget(question.count, tapped);

  const counted =
    question.mode === "compare" ? tappedA.length + tappedB.length : tapped.length;

  const hints = practising
    ? []
    : orbitHints(question, {
        tapped: tapped.length,
        tappedA: tappedA.length,
        tappedB: tappedB.length,
        kidTip: copy.kidTip,
      });

  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    target: guideTarget,
    progress: counted,
    /* A comparison is not finished by touching everything — the child still has
       to say which side has more — so only the counting modes are ever done. */
    done: question.mode === "compare" ? false : guideTarget < 0,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  /** One tap, weighed: a step onward, a repeat, or a hop across the scene. */
  const noteTap = (index: number, already: boolean, list: number[]) => {
    if (already) {
      // A second tap on an object that already carries a number is this
      // activity's clearest signal that one-to-one has come apart.
      guide.stumbled();
      return;
    }
    if (question.mode !== "compare" && isWander(list, index)) {
      wanders.current += 1;
      // One hop is a shrug; two in a question is a child with no route through
      // the row, which is how objects get missed.
      if (wanders.current >= 2) guide.stumbled();
      return;
    }
    guide.moved();
  };

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
    setTapped([]);
    setTappedA([]);
    setTappedB([]);
    setLastTap(null);
    wanders.current = 0;
  }, [question.id, finishing]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    finishing.cancel();
    setTapped([]);
    setTappedA([]);
    setTappedB([]);
    setLastTap(null);
    wanders.current = 0;
  };



  /**
   * Say the running count aloud — the number word is the point of the tap.
   *
   * Resolves when the word has been said, so the last tap can wait for it. A
   * rejection resolves too: a round must not stall on a sound.
   */
  const countAloud = (n: number): Promise<void> => {
    if (!!practising && koda.config.isEnabled("audio_speech", true)) return Promise.resolve();
    return koda.speech
      .say(numberWord(n), { rate: koda.config.get("speechRate", 1.0) })
      .catch(() => {});
  };

  const tap = (index: number) => {
    /*
     * Weighed before the guard, not after.
     *
     * The line below has always thrown a repeat tap away without a sound, and
     * a repeat tap is the loudest thing this activity ever sees. The coach is
     * the first thing that has wanted to know.
     */
    noteTap(index, tapped.includes(index), tapped);
    if (tapped.includes(index)) return;
    const next = [...tapped, index];
    setTapped(next);
    koda.haptics.tap();
    playChrome(koda, question.mode === "scatter" ? "clink" : "pop");
    const spoken = countAloud(next.length);
    /*
     * The number the child just reached, tied to the object they just touched.
     *
     * `key` is a counter rather than the value, because two taps can produce the
     * same number across questions and React would then reuse the element and
     * skip the animation — the count would go silent visually while the voice
     * kept speaking.
     */
    setLastTap({ index, n: next.length, key: tapSeq.current++ });

    if (next.length === question.count) {
      playChrome(koda, "success");
      koda.haptics.success();
      /*
       * Let the last number land before the round reacts.
       *
       * Submitting here synchronously meant the final item was never actually
       * counted: the praise clip starts by stopping whatever is playing, so it
       * cut "eight" off mid-word, and the feedback panel replaced the scene
       * before the last number had finished floating. The child tapped the
       * eighth rocket and got congratulated *instead of* being told it was
       * eight — losing the one repetition that closes the count.
       */
      const counted = next.length;
      finishing.after(spoken, () => finish(counted));
    }
  };

  /** The round's own reaction, once the count has been seen and heard. */
  const finish = (counted: number) => {
    submit({
      correct: true,
      given: String(counted),
      expected: String(question.count),
      title: "Great counting!",
      message:
        question.mode === "scatter"
          ? `Terrific tracking! You tagged all ${question.count} scattered objects without missing any.`
          : `You counted ${question.count} ${question.asset.name.toLowerCase()}. The last number you said is how many!`,
    });
  };

  const tapGroup = (group: "A" | "B", index: number) => {
    const [list, set] = group === "A" ? [tappedA, setTappedA] : [tappedB, setTappedB];
    const on = list.includes(index);
    /* Untapping is how a child corrects themselves here, so it is a move like
       any other rather than a stumble — the groups toggle, unlike the row. */
    noteTap(index, false, list as number[]);
    const next = on ? list.filter((i) => i !== index) : [...list, index];
    set(next);
    playChrome(koda, "pop");
    if (!on) void countAloud(next.length);
  };

  const answerCompare = (choice: "A" | "B" | "SAME") => {
    const c = question.compare!;
    const correct = choice === c.answer;
    playChrome(koda, correct ? "success" : "error");
    correct ? koda.haptics.success() : koda.haptics.tap();

    // Said the way the screen says it — the buttons are left and right, so the
    // hint is too. "Group A is greater" is the grown-up version.
    const message = correct
      ? c.answer === "SAME"
        ? `Both groups have ${c.countA}. Moving things around does not change how many!`
        : c.answer === "A"
          ? `The left group has ${c.countA}. The right group has ${c.countB}. Left has more!`
          : `The right group has ${c.countB}. The left group has ${c.countA}. Right has more!`
      : c.answer === "SAME"
        ? `They look different, but count one by one. Left has ${c.countA} and right has ${c.countB}. The same!`
        : `Count one by one. Left has ${c.countA} ${c.assetA.name.toLowerCase()} and right has ${c.countB} ${c.assetB.name.toLowerCase()}.`;

    submit({
      correct,
      given: choice,
      expected: c.answer,
      // Picking the wrong side is a direction error, not an arithmetic slip.
      errorKind: correct ? undefined : "reversed",
      title: correct ? "Great counting!" : "Count them again",
      message,
    });
  };

  const prompt = promptFor(question);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Touch and Count"
      round={round}
      totalQuestions={total}
      prompt={prompt}
      iconName={question.mode === "compare" ? "scale" : "star"}
      iconTone="amber"
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (tapped.length > 0 || tappedA.length > 0 || tappedB.length > 0) ? restart : undefined
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
      {question.mode === "compare" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {(["A", "B"] as const).map((side) => {
              const c = question.compare!;
              const isA = side === "A";
              return (
                <div
                  key={side}
                  /* The two groups get the same meadow the scattered scene has,
                     tinted apart so "left" and "right" are tellable at a glance
                     without reading either label. */
                  /* Both groups share the one play scene; the side is told by
                     the ring and the counter colour, not by a second palette. */
                  /* The coach points at a *group* here, not at one butterfly:
                     the work is "count this side", so lighting a single object
                     inside it would answer a smaller question than the one the
                     child is stuck on. */
                  className={`${SCENE} p-4 sm:p-5 min-h-[200px] sm:min-h-[230px] flex flex-col items-center justify-center gap-3 transition-shadow duration-300 ${
                    guide.target === (isA ? 0 : 1)
                      ? "ring-4 ring-indigo-500 shadow-[0_0_0_6px_rgba(99,102,241,0.15)]"
                      : `ring-2 ${isA ? "ring-orange-300/70" : "ring-cyan-300/70"}`
                  }`}
                >
                  {guide.target === (isA ? 0 : 1) && (
                    <span className="sr-only">Count this group next</span>
                  )}
                  <span className="text-sm font-extrabold text-ink/70">
                    {isA ? "Left" : "Right"}
                  </span>
                  <TapGroup
                    count={isA ? c.countA : c.countB}
                    asset={isA ? c.assetA : c.assetB}
                    layout={isA ? c.layoutA : c.layoutB}
                    tapped={isA ? tappedA : tappedB}
                    onTap={(i) => tapGroup(side, i)}
                    tone={isA ? "orange" : "cyan"}
                  />
                  {/* The running count, big enough to be the thing compared. */}
                  <span className="text-3xl font-black text-ink tabular-nums leading-none h-8">
                    {(isA ? tappedA : tappedB).length || ""}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {(
              [
                ["A", "Left has more"],
                ["SAME", "Same!"],
                ["B", "Right has more"],
              ] as const
            ).map(([choice, label]) => (
              <motion.button
                key={choice}
                onClick={() => answerCompare(choice)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                transition={SPRING.tap}
                className={themeSystem.button("secondary", "lg")}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/*
           * A place, not a panel.
           *
           * This was a white box with a hairline border — correct for a form,
           * wrong for a scene a five-year-old is meant to count things in. The
           * warm sky-to-meadow wash gives the objects somewhere to be, and the
           * ground band gives them something to stand on, which is what makes
           * the drop shadows the artwork already carries read as real.
           */}
          <div
            className={`relative overflow-hidden ${SCENE} ${
              question.mode === "scatter"
                ? "h-[380px] sm:h-[400px] lg:h-[420px]"
                : "flex flex-wrap items-center justify-center gap-4 sm:gap-5 p-5 sm:p-8 min-h-[220px]"
            }`}
          >
            {/* The ground the objects sit on. Decorative, so it is hidden from
                a screen reader rather than announced as an empty region. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-emerald-200/70 to-transparent dark:from-emerald-900/40"
            />
            {Array.from({ length: question.count }, (_, i) => {
              const on = tapped.includes(i);
              const place = question.places?.[i];
              /** The one the coach is pointing at. */
              const lit = guide.target === i;
              /* While the coach is walking a child through, everything that is
                 not the next object steps back. Not hidden and not disabled —
                 a child who wants to count their own way still can, and the
                 coach follows them rather than the other way round. */
              const hushed = guide.walking && !lit && !on;
              return (
                <motion.button
                  key={i}
                  onClick={() => tap(i)}
                  /*
                   * Arrives, then breathes. The staggered entry stops the set
                   * appearing as one painted frame, and the idle drift keeps
                   * untouched objects looking touchable — a perfectly still
                   * scene reads as a picture to a young child. A counted object
                   * stops moving, which is itself part of the feedback.
                   */
                  /* Reduced motion means no entrance either. The idle drift
                     already respected it; the staggered arrival did not, so
                     somebody who asked for less movement still got eight objects
                     springing in one after another. */
                  initial={motionOK ? { opacity: 0, scale: 0.6 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={motionOK ? { ...SPRING.enter, delay: stagger(i) } : { duration: 0 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.85, rotate: i % 2 === 0 ? -6 : 6 }}
                  /* The spotlight is a glow, and a glow is nothing to a screen
                     reader — so the object the coach is pointing at says so. */
                  aria-label={`${singular(question.asset.name)} ${i + 1}${
                    on ? ", counted" : lit ? ", touch this one next" : ""
                  }`}
                  style={
                    place
                      ? {
                          position: "absolute",
                          top: place.top,
                          left: place.left,
                          // The placement is a centre point, so pull the object
                          // back by half itself before rotating it.
                          transform: `translate(-50%, -50%) rotate(${place.rotate})`,
                        }
                      : undefined
                  }
                  /*
                   * No card, no border. The chip framing made each object read
                   * as a button rather than as a thing to be counted, and at
                   * 64px the target was below what a five-year-old's finger
                   * reliably hits. The counted state is carried by the object
                   * itself — dimmed and settled back — plus the number badge.
                   */
                  className={`relative ${COUNTABLE} flex items-center justify-center rounded-full transition-opacity duration-300 ${
                    hushed ? "opacity-40" : "opacity-100"
                  }`}
                >
                  {/*
                   * The pointing finger, drawn as light.
                   *
                   * The coach's words name the number; this names the object,
                   * and a child who cannot yet read the words still gets the
                   * whole instruction from it. A ring plus an arrow rather than
                   * either alone: the ring says *this one* and survives being
                   * looked at sideways on a tablet, the arrow says *here* from
                   * across a room.
                   */}
                  {lit && (
                    <>
                      <motion.span
                        aria-hidden="true"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={
                          motionOK
                            ? { opacity: [0.9, 0.35, 0.9], scale: [1, 1.1, 1] }
                            : { opacity: 0.9, scale: 1 }
                        }
                        transition={
                          motionOK
                            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0 }
                        }
                        className="pointer-events-none absolute -inset-2 rounded-full bg-indigo-400/20 ring-4 ring-indigo-500"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-9 left-0 right-0 flex justify-center text-indigo-600 dark:text-indigo-300"
                      >
                        <motion.span
                          animate={motionOK ? { y: [0, 6, 0] } : { y: 0 }}
                          transition={
                            motionOK
                              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
                              : { duration: 0 }
                          }
                        >
                          <ChevronDown className="h-7 w-7 drop-shadow-[0_2px_4px_rgba(255,255,255,0.9)]" strokeWidth={3} />
                        </motion.span>
                      </span>
                    </>
                  )}
                  {/*
                   * The dim marks the object as counted and must stay off the
                   * badge. Applied to the button, it faded the number too — and
                   * the number is the one thing on screen the child has to read.
                   */}
                  <motion.span
                    {...idleFloat(i, motionOK && !on)}
                    className={`block w-full h-full transition-[filter,opacity] duration-200 ${
                      on
                        ? "opacity-55 saturate-[0.35]"
                        : "drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
                    }`}
                  >
                    <SvgAsset
                      id={question.asset.id}
                      size="100%"
                      title={singular(question.asset.name)}
                    />
                  </motion.span>
                  {/*
                    * The count-along number, rising out of the object just
                    * touched. Rendered inside the button so it follows the
                    * object in both the scattered and the row layout without
                    * either of them having to know where anything is.
                    *
                    * Timed to the recorded number word (~1s), so the child sees
                    * "4" and hears "four" as one event rather than two.
                    */}
                  {lastTap?.index === i && (
                    <motion.span
                      key={lastTap.key}
                      aria-hidden="true"
                      initial={{ opacity: 0, scale: 0.3, y: 0 }}
                      animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.5, 1.35, 1.2], y: [0, -52, -64, -76] }}
                      transition={{ duration: 1, times: [0, 0.22, 0.62, 1], ease: "easeOut" }}
                      className="pointer-events-none absolute inset-x-0 top-0 text-center text-5xl font-black text-orange-500 drop-shadow-[0_2px_6px_rgba(255,255,255,0.9)] tabular-nums"
                    >
                      {lastTap.n}
                    </motion.span>
                  )}
                  {on && koda.config.isEnabled("counting_badges", true) && (
                    <motion.span
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={SPRING.celebrate}
                      /*
                       * The number is the lesson, so it has to be the most
                       * legible thing on screen. Amber-on-pale washed out
                       * against the meadow — this is a saturated disc with white
                       * text and a white ring, which holds up over any part of
                       * the scene and over the artwork itself.
                       */
                      className={`${COUNT_BADGE} bg-orange-500 text-white`}
                    >
                      {tapped.indexOf(i) + 1}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/*
           * The running count only.
           *
           * This used to read "Tapped: 0 / 6" on a lesson whose whole task is to
           * work out that there are six — so any child who can read numerals got
           * the answer before touching anything. The total is the thing being
           * learned and must not be printed.
           */}
          <div className="flex items-center justify-center h-16" aria-live="polite">
            {tapped.length > 0 && (
              // Keyed on the value so each new number mounts and pops, rather
              // than the text quietly swapping underneath a child's eyes.
              <motion.span
                key={tapped.length}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING.enter}
                className="text-5xl font-black text-ink tabular-nums"
              >
                {tapped.length}
              </motion.span>
            )}
            <span className="sr-only">{tapped.length} counted</span>
          </div>
        </div>
      )}
    </SkillRound>
  );
};
