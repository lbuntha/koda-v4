import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps } from "../../types";
import {
  SkillRound,
  SPRING,
  idleFloat,
  stagger,
  useMotionOK,
  useSkillRound,
  type RoundQuestion,
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

const NUMBER_WORDS = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

const LAYOUTS: Layout[] = ["cluster", "line", "circle", "pairs", "scattered", "column"];

/**
 * How long the last number gets before the round congratulates the child.
 *
 * Long enough for the recorded number word to be said and for the float to
 * clear the object — the number clips run about a second, and the word itself
 * sits at the front of that. Shorter and the final item is not counted; much
 * longer and the praise stops feeling like a response to the tap.
 */
const COUNT_SETTLE_MS = 900;

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

const buildQuestion = (setup: OrbitSetup, index: number): OrbitQuestion => {
  const mode = setup.mode ?? "row";
  const asset = sample(PREDEFINED_ASSETS);
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: "count_objects", asset };

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
  tone: "amber" | "cyan";
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
                tone === "amber" ? "bg-orange-500" : "bg-cyan-600"
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

export const TouchOrbit: React.FC<ActivityProps<TouchOrbitParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: OrbitSetup = { ...params, ...params.question };
  const total = setup.questionsPerRound ?? 5;

  const [tapped, setTapped] = useState<number[]>([]);
  const [tappedA, setTappedA] = useState<number[]>([]);
  const [tappedB, setTappedB] = useState<number[]>([]);
  const [showTip, setShowTip] = useState(false);
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
  const motionOK = useMotionOK();
  /** Pending finish, so leaving mid-count cannot submit for an unmounted round. */
  const finishTimer = useRef<number | null>(null);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    // The lesson's own spoken instruction, said once as the round opens.
    intro: (params as { play?: { audioPrompt?: string } }).play?.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index: number) => buildQuestion(setup, index), [params]),
    onComplete: (result) => {
      void koda.progress.nextStep().then((r) => setNextStep(r ?? undefined));
      onComplete(result);
    },
  });

  const question = round.question as OrbitQuestion;

  useEffect(() => {
    setTapped([]);
    setTappedA([]);
    setTappedB([]);
    setShowTip(false);
    setLastTap(null);
    if (finishTimer.current !== null) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
  }, [question.id]);

  useEffect(
    () => () => {
      if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);
    },
    [],
  );

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (koda.config.isEnabled("sound_chimes", true)) koda.sound.play(type);
  };

  /** Say the running count aloud — the number word is the point of the tap. */
  const countAloud = (n: number) => {
    if (koda.config.isEnabled("audio_speech", true)) {
      void koda.speech.say(NUMBER_WORDS[n] ?? String(n), {
        rate: koda.config.get("speechRate", 1.0),
      });
    }
  };

  const tap = (index: number) => {
    if (tapped.includes(index)) return;
    const next = [...tapped, index];
    setTapped(next);
    koda.haptics.tap();
    chime(question.mode === "scatter" ? "clink" : "pop");
    countAloud(next.length);
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
      chime("success");
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
      const settle = setup.settleMs ?? COUNT_SETTLE_MS;
      if (settle <= 0) finish(next.length);
      else finishTimer.current = window.setTimeout(() => finish(next.length), settle);
    }
  };

  /** The round's own reaction, once the count has been seen and heard. */
  const finish = (counted: number) => {
    round.submit({
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
    const next = on ? list.filter((i) => i !== index) : [...list, index];
    set(next);
    chime("pop");
    if (!on) countAloud(next.length);
  };

  const answerCompare = (choice: "A" | "B" | "SAME") => {
    const c = question.compare!;
    const correct = choice === c.answer;
    chime(correct ? "success" : "error");
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

    round.submit({
      correct,
      given: choice,
      expected: c.answer,
      // Picking the wrong side is a direction error, not an arithmetic slip.
      errorKind: correct ? undefined : "reversed",
      title: correct ? "Great counting!" : "Count them again",
      message,
    });
  };

  const prompt =
    question.mode === "compare"
      ? question.compare!.answer === "SAME"
        ? "Count both groups. Do they have the same?"
        : "Count both groups. Which one has more?"
      : question.mode === "scatter"
        ? `Touch every ${singular(question.asset.name)}. Do not miss any!`
        : `Touch each ${singular(question.asset.name)}. Count as you go!`;

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
      showTip={showTip}
      onExit={koda.ui.exit}
      onToggleTip={() => {
        if (!showTip) round.useSupport("hint", 1);
        setShowTip((v) => !v);
      }}
      onReadAloud={() => {
        round.useSupport("audio_replay");
        void koda.speech.say(prompt);
      }}
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
                  className={`${SCENE} p-4 sm:p-5 min-h-[200px] sm:min-h-[230px] flex flex-col items-center justify-center gap-3 ring-2 ${
                    isA ? "ring-orange-300/70" : "ring-cyan-300/70"
                  }`}
                >
                  <span className="text-sm font-extrabold text-ink/70">
                    {isA ? "Left" : "Right"}
                  </span>
                  <TapGroup
                    count={isA ? c.countA : c.countB}
                    asset={isA ? c.assetA : c.assetB}
                    layout={isA ? c.layoutA : c.layoutB}
                    tapped={isA ? tappedA : tappedB}
                    onTap={(i) => tapGroup(side, i)}
                    tone={isA ? "amber" : "cyan"}
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
                  aria-label={`${singular(question.asset.name)} ${i + 1}${on ? ", counted" : ""}`}
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
                  className={`relative ${COUNTABLE} flex items-center justify-center rounded-full`}
                >
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
