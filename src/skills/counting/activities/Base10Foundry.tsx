import React, { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  SPRING,
  composeHints,
  playCopy,
  useSkillRound,
  type RoundQuestion,
  isPractice,
  playChrome,
  guideSetup,
  useGuide,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { listAnd, tc } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * Build a number out of hundreds, tens and ones — then bundle it.
 *
 * Getting the total right is only half of it: ten ones have to become a ten, and
 * ten tens a hundred, or the number is right and the place value is not. Which
 * bundling a lesson asks for is a parameter, so the three lessons differ by data
 * rather than by level number.
 *
 * Blocks are dragged, because that is what base-ten blocks are: the child moves
 * a rod into the tens column and sees that it is worth ten of the cubes next to
 * it. A pair of +/- buttons can produce the same number but teaches nothing
 * about size, so the buttons stay as the keyboard and screen-reader path rather
 * than as the interaction.
 *
 * Dragging is built on Pointer Events, not HTML5 drag-and-drop, which does not
 * fire at all on iOS Safari — where this is actually used.
 */

export interface Base10Setup {
  /** Smallest and largest number to build. */
  targetRange?: [number, number];
  /** Whether ten ones must be bundled into a ten before the answer counts. */
  bundleOnes?: boolean;
  /** Whether ten tens must be bundled into a hundred. */
  bundleTens?: boolean;
  /** Show the hundreds column. Off for lessons that stay under 100. */
  hundreds?: boolean;
  questionsPerRound?: number;
}

export interface Base10FoundryParams extends Base10Setup {
  /** Counting nests a level's generator settings under `question`. */
  question?: Base10Setup;
}

export interface BuildQuestion extends RoundQuestion {
  target: number;
}

const randomInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

export const buildQuestion = (setup: Base10Setup, index: number): BuildQuestion => {
  const [lo, hi] = setup.targetRange ?? [11, 35];
  const target = randomInt(lo, hi);
  return {
    id: `q${index}-${Date.now().toString(36)}`,
    taskKind: "place_value_build",
    target,
    expected: String(target),
    itemCount: target,
  };
};

/** What the child is holding: a block of one place, taken from somewhere. */
export interface Held {
  kind: PlaceKey;
  /** "supply" for a fresh block, or the column it was lifted out of. */
  from: "supply" | PlaceKey;
}

export type PlaceKey = "hundreds" | "tens" | "ones";
export type Built = Record<PlaceKey, number>;

export interface DropResult {
  built: Built;
  /** False when the block goes back where it came from — a wrong column. */
  accepted: boolean;
  /** Set when the drop changed the number, for the sound and the log. */
  change?: "added" | "removed";
}

/**
 * Where a dragged block lands.
 *
 * Pure, and exported, because this is the whole rule of the manipulative and it
 * is the part worth testing: a drop is judged by place value, so a ten cannot be
 * dropped into the ones column just because that column is nearer.
 */
export function resolveDrop(
  built: Built,
  held: Held,
  target: PlaceKey | null,
  limits: Record<PlaceKey, number>,
): DropResult {
  // Dropped outside every column: a block lifted out of a column is discarded,
  // a fresh one from the supply simply never arrived.
  if (target === null) {
    if (held.from === "supply") return { built, accepted: true };
    return {
      built: { ...built, [held.from]: Math.max(0, built[held.from] - 1) },
      accepted: true,
      change: "removed",
    };
  }

  // A block only belongs in its own place. This is the lesson, not a validation.
  if (target !== held.kind) return { built, accepted: false };

  if (held.from === target) return { built, accepted: true }; // put back where it was

  if (held.from === "supply") {
    if (built[target] >= limits[target]) return { built, accepted: false };
    return { built: { ...built, [target]: built[target] + 1 }, accepted: true, change: "added" };
  }

  // Moved between columns of the same kind cannot happen; treated as a no-op.
  return { built, accepted: true };
}

/** A number split the way the columns split it. */
function placesOf(n: number, hundreds: boolean): Built {
  if (!hundreds) return { hundreds: 0, tens: Math.floor(n / 10), ones: n % 10 };
  return {
    hundreds: Math.floor(n / 100),
    tens: Math.floor((n % 100) / 10),
    ones: n % 10,
  };
}

/** "1 hundred, 2 tens and 3 ones" — empty places left unsaid. */
function saidAsPlaces(parts: Built): string {
  const said = [
    parts.hundreds > 0 && tc("base10.hundreds", { count: parts.hundreds }),
    parts.tens > 0 && tc("base10.tens", { count: parts.tens }),
    parts.ones > 0 && tc("base10.ones", { count: parts.ones }),
  ].filter((part): part is string => typeof part === "string");
  if (said.length === 0) return tc("base10.nothing");
  return listAnd(said);
}

/**
 * What to say to a child stuck building a number.
 *
 * Place value is the lesson, so the hints are said in places rather than in
 * totals: "23 is 2 tens and 3 ones" is the idea, and "you need 5 more" is a
 * shopping list. The last rung reads the columns as they stand and names the
 * one move to make next — including the bundling move, which is the part
 * children skip and the part `check` refuses the answer for.
 *
 * Pure and exported so the place-value arithmetic in the wording is tested.
 */
/**
 * The question in words.
 *
 * Not the round's own line, which counts what the child has built so far
 * ("Make 34. You have 20. Add 14 more!") and so cannot be asked before they
 * have started. This is the question the round is asking underneath that.
 */
export const promptFor = (q: BuildQuestion): string => tc("base10.prompt", { target: q.target });

/**
 * On paper.
 *
 * The answer is the *bundling*, not the number — a child who writes "34" has
 * not shown they know it is three tens and four ones, which is the whole
 * lesson. So the key holds both.
 */
export const printedFor = (q: BuildQuestion): PrintedQuestion => {
  const hundreds = Math.floor(q.target / 100);
  const tens = Math.floor((q.target % 100) / 10);
  const ones = q.target % 10;

  /* Named singly or plurally, and zeroes left out: "1 tens and 0 ones" is not
     English and not what a child would write. */
  const parts = [
    hundreds > 0 ? tc("base10.hundreds", { count: hundreds }) : "",
    tens > 0 ? tc("base10.tens", { count: tens }) : "",
    ones > 0 ? tc("base10.ones", { count: ones }) : "",
  ].filter(Boolean);

  return {
    /* Above a hundred the answer is not "fifteen tens". Bundling ten tens into
       a hundred is the whole lesson at that size, and a sheet that asks for
       rods only would be teaching against it. */
    text:
      hundreds > 0
        ? tc("base10.printedHundreds", { target: q.target })
        : tc("base10.printedTens", { target: q.target }),
    answer: parts.join(", "),
  };
};

/** How the technique goes, in paper words. */
export const methodFor = (q: BuildQuestion): string[] =>
  q.target >= 100
    ? [tc("base10.methodHundreds1"), tc("base10.methodHundreds2"), tc("base10.methodHundreds3")]
    : [tc("base10.methodTens1"), tc("base10.methodTens2"), tc("base10.methodTens3")];

/**
 * Somewhere to draw it.
 *
 * A ruled workspace rather than a picture of the answer: the child draws the
 * rods and the ones themselves, which is the doing. Headed so the two columns
 * cannot be muddled, because muddling them is exactly the mistake.
 */
export const figureFor = (q: BuildQuestion): React.ReactNode => (
  <span className="inline-flex">
    {(q.target >= 100
      ? [tc("base10.columnHundreds"), tc("base10.columnTens"), tc("base10.columnOnes")]
      : [tc("base10.columnTens"), tc("base10.columnOnes")]
    ).map((label) => (
      <span key={label} className="inline-flex w-28 flex-col border border-slate-900">
        <span className="border-b border-slate-900 py-0.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <span className="block h-14" />
      </span>
    ))}
  </span>
);

export function base10Hints(
  question: BuildQuestion,
  state: {
    built: Built;
    setup: Pick<Base10Setup, "bundleOnes" | "bundleTens" | "hundreds">;
    kidTip?: string;
  },
): string[] {
  const { built, setup } = state;
  const value = built.hundreds * 100 + built.tens * 10 + built.ones;
  const showHundreds = Boolean(setup.hundreds);
  const want = placesOf(question.target, showHundreds);
  const short = question.target - value;

  /*
   * The move to make right now.
   *
   * Bundling comes first when it is owed, because that is what `check` will
   * refuse: a child holding 13 ones has the right total and the wrong number,
   * and being told to add more blocks would send them further from the answer.
   */
  const nextMove =
    setup.bundleOnes && built.ones >= 10
      ? tc("base10.hintBundleOnes", { ones: built.ones })
      : setup.bundleTens && built.tens >= 10
        ? tc("base10.hintBundleTens", { tens: built.tens })
        : short === 0
          ? tc("base10.hintReady", { places: saidAsPlaces(built), target: question.target })
          : short > 0
            ? value === 0
              ? tc("base10.hintDragIn", { places: saidAsPlaces(placesOf(question.target, showHundreds)) })
              : tc("base10.hintDragMore", { value, places: saidAsPlaces(placesOf(short, showHundreds)) })
            : tc("base10.hintTooMany", { value, over: Math.abs(short) });

  return composeHints(
    state.kidTip ?? tc("base10.hintTip"),
    tc("base10.hintRead", { target: question.target, places: saidAsPlaces(want) }),
    nextMove,
  );
}

interface Place {
  key: PlaceKey;
  label: string;
  /** Singular name of one block, for the label a screen reader reads. */
  one: string;
  worth: number;
  max: number;
  tone: string;
}

/**
 * Where each place sits, for the coach to point at.
 *
 * Off `PLACES` rather than off the rendered list, because a lesson without
 * hundreds renders two columns and the rendered index would then mean "tens" in
 * one lesson and "hundreds" in another — a light on the wrong column being
 * worse than no light at all.
 */
const PLACE_INDEX: Record<PlaceKey, number> = { hundreds: 0, tens: 1, ones: 2 };

const PLACES: Place[] = [
  /* Getters, so the names follow the language on screen. */
  { key: "hundreds", get label() { return tc("base10.columnHundreds"); }, get one() { return tc("base10.blockHundreds"); }, worth: 100, max: 9, tone: "text-rose-700 dark:text-rose-400" },
  /* Violet, not amber: the label is small type on the canvas, which is exactly
     where yellow stops being readable, and violet stays clear of both the rose
     hundreds and the cyan ones. */
  { key: "tens", get label() { return tc("base10.columnTens"); }, get one() { return tc("base10.blockTens"); }, worth: 10, max: 19, tone: "text-violet-700 dark:text-violet-400" },
  { key: "ones", get label() { return tc("base10.columnOnes"); }, get one() { return tc("base10.blockOnes"); }, worth: 1, max: 19, tone: "text-cyan-700 dark:text-cyan-400" },
];

/* -------------------------------------------------------------------------- */
/* The blocks                                                                  */
/* -------------------------------------------------------------------------- */

const BLOCK_TONE: Record<PlaceKey, string> = {
  ones: "bg-cyan-400 border-cyan-600",
  tens: "bg-violet-400 border-violet-600",
  hundreds: "bg-rose-400 border-rose-600",
};

/**
 * A base-ten block drawn to scale: a cube, a rod of ten cubes, a flat of a
 * hundred. The size *is* the teaching — a rod has to look like ten cubes, or
 * the child is only matching colours.
 */
const Block: React.FC<{ kind: PlaceKey; small?: boolean }> = ({ kind, small }) => {
  const unit = small ? "w-1.5 h-1.5" : "w-2 h-2";
  const tone = BLOCK_TONE[kind];
  if (kind === "ones") {
    return <span className={`block rounded-sm border ${tone} ${small ? "w-3 h-3" : "w-4 h-4"}`} />;
  }
  if (kind === "tens") {
    return (
      <span className={`flex flex-col gap-px p-px rounded-sm border ${tone}`}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`${unit} bg-white/40 rounded-[1px]`} />
        ))}
      </span>
    );
  }
  return (
    <span className={`grid grid-cols-10 gap-px p-px rounded-sm border ${tone}`}>
      {Array.from({ length: 100 }, (_, i) => (
        <span key={i} className={`${small ? "w-1 h-1" : "w-1.5 h-1.5"} bg-white/40 rounded-[1px]`} />
      ))}
    </span>
  );
};

export const Base10Foundry: React.FC<ActivityProps<Base10FoundryParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: Base10Setup = { ...params, ...params.question };
  const total = setup.questionsPerRound ?? 5;
  /** The lesson's own child-facing copy: the spoken intro, and hint rung one. */
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup as { practice?: boolean });
  const places = PLACES.filter((p) => p.key !== "hundreds" || setup.hundreds);

  const [built, setBuilt] = useState({ hundreds: 0, tens: 0, ones: 0 });
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

  const question = round.question as BuildQuestion;

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

  /**
   * Report an answer.
   *
   * In practice the verdict stands on its own — a child working unaided is not
   * being walked through what happened, and an explanation after every question
   * would put the scaffolding back one sentence at a time.
   */
  const submit = (outcome: Parameters<typeof round.submit>[0]) =>
    round.submit(practising ? { ...outcome, message: undefined } : outcome);
  const value = built.hundreds * 100 + built.tens * 10 + built.ones;

  useEffect(() => {
    setBuilt({ hundreds: 0, tens: 0, ones: 0 });
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
    setBuilt({ hundreds: 0, tens: 0, ones: 0 });
  };



  const adjust = (key: Place["key"], delta: number, max: number) => {
    playChrome(koda, "pop");
    koda.haptics.tap();
    setBuilt((prev) => ({ ...prev, [key]: Math.max(0, Math.min(max, prev[key] + delta)) }));
  };

  /* ---------------------------------------------------------------- drag -- */

  const [held, setHeld] = useState<Held | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<PlaceKey | null>(null);
  /** Column that just refused a block, for a brief nudge. */
  const [refused, setRefused] = useState<PlaceKey | null>(null);
  /** Whether the pointer travelled far enough for this to be a drag, not a tap. */
  const draggedRef = React.useRef(false);
  const startedAt = React.useRef({ x: 0, y: 0 });

  const limits = React.useMemo(
    () => Object.fromEntries(PLACES.map((p) => [p.key, p.max])) as Record<PlaceKey, number>,
    [],
  );

  /** Which column is under the pointer, found by hit-testing the real layout. */
  const placeUnder = (x: number, y: number): PlaceKey | null => {
    const el = document.elementFromPoint(x, y);
    const zone = el?.closest("[data-place]");
    return (zone?.getAttribute("data-place") as PlaceKey | undefined) ?? null;
  };

  const startDrag = (e: React.PointerEvent, next: Held) => {
    // Only the primary pointer drags: a second finger landing mid-drag would
    // otherwise take over the block and drop it somewhere the child did not aim.
    if (held) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setHeld(next);
    setGhost({ x: e.clientX, y: e.clientY });
    draggedRef.current = false;
    startedAt.current = { x: e.clientX, y: e.clientY };
    playChrome(koda, "pop");
    koda.haptics.tap();
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!held) return;
    const { x, y } = startedAt.current;
    if (Math.hypot(e.clientX - x, e.clientY - y) > 8) draggedRef.current = true;
    setGhost({ x: e.clientX, y: e.clientY });
    setHover(placeUnder(e.clientX, e.clientY));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!held) return;
    const target = placeUnder(e.clientX, e.clientY);
    const result = resolveDrop(built, held, target, limits);

    if (!result.accepted) {
      setRefused(target);
      window.setTimeout(() => setRefused(null), 600);
      playChrome(koda, "error");
      /* This engine already refuses a block that does not belong in a column,
         with a shake and a sound. What it never did was notice a child doing it
         repeatedly, which is the difference between a slip and not knowing
         which column is which. */
      guide.stumbled();
    } else if (result.change) {
      guide.moved();
      setBuilt(result.built);
      playChrome(koda, result.change === "added" ? "clink" : "pop");
      koda.haptics.tap();
    }

    setHeld(null);
    setGhost(null);
    setHover(null);
  };

  const hints = practising ? [] : base10Hints(question, { built, setup, kidTip: copy.kidTip });

  /**
   * The column to light.
   *
   * A bundle that is owed comes first, because that is the move `check` will
   * refuse — a child holding thirteen ones has the right total and the wrong
   * number, and pointing them at the next place to fill would send them further
   * from the answer. Otherwise: the place still short of the target.
   */
  const guideTarget = (() => {
    if (setup.bundleOnes && built.ones >= 10) return PLACE_INDEX.ones;
    if (setup.bundleTens && built.tens >= 10) return PLACE_INDEX.tens;
    const want = placesOf(question.target, Boolean(setup.hundreds));
    if (setup.hundreds && built.hundreds < want.hundreds) return PLACE_INDEX.hundreds;
    if (built.tens < want.tens) return PLACE_INDEX.tens;
    if (built.ones < want.ones) return PLACE_INDEX.ones;
    return -1;
  })();

  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    target: guideTarget,
    progress: built.hundreds * 100 + built.tens * 10 + built.ones,
    /* Built is not finished: every question here ends at Check, and the last
       rung's job is to say so once the columns are right. */
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  /** A block already in a column, which can be dragged back out to remove it. */
  const blocksIn = (key: PlaceKey) => Math.min(built[key], 12);

  const bundle = (from: "ones" | "tens") => {
    playChrome(koda, "clink");
    setBuilt((prev) =>
      from === "ones"
        ? { ...prev, ones: prev.ones - 10, tens: prev.tens + 1 }
        : { ...prev, tens: prev.tens - 10, hundreds: prev.hundreds + 1 },
    );
    if (!practising && koda.config.isEnabled("audio_speech", true)) {
      void koda.speech.say(tc(from === "ones" ? "base10.saidBundleOnes" : "base10.saidBundleTens"));
    }
  };

  const check = () => {
    const say = (correct: boolean, title: string, message: string, place = false) => {
      playChrome(koda, correct ? "success" : "error");
      correct ? koda.haptics.success() : koda.haptics.tap();
      submit({
        correct,
        given: String(value),
        expected: String(question.target),
        errorKind: correct ? undefined : place ? "place_value" : undefined,
        title,
        message,
      });
    };

    if (value !== question.target) {
      return say(
        false,
        tc("base10.tryDifferent"),
        tc("base10.wrongTotal", { value, target: question.target }),
      );
    }
    if (setup.bundleOnes && built.ones >= 10) {
      return say(
        false,
        tc("base10.groupOnes"),
        tc("base10.groupOnesMsg", { ones: built.ones }),
        true,
      );
    }
    if (setup.bundleTens && built.tens >= 10) {
      return say(
        false,
        tc("base10.groupTens"),
        tc("base10.groupTensMsg", { tens: built.tens }),
        true,
      );
    }
    // Name only the columns this lesson actually shows, so a lesson without a
    // hundreds column never reports "0 Hundreds".
    const parts = [
      setup.hundreds ? tc("base10.builtHundreds", { count: built.hundreds }) : null,
      tc("base10.builtTens", { count: built.tens }),
      tc("base10.builtOnes", { count: built.ones }),
    ].filter(Boolean) as string[];
    return say(true, tc("greatCounting"), tc("base10.builtAs", { target: question.target, parts: listAnd(parts) }));
  };

  const short = question.target - value;

  /*
   * What is shown, and what is said, are not the same sentence.
   *
   * The written prompt names the numbers because they are the work: a child
   * building 23 needs to see 23, and how far off they are. The *spoken* line
   * cannot say them — target, current value and difference are three variables
   * over targets up to 385, which is tens of thousands of sentences and so can
   * never be a recording. Left dynamic it fell through to whatever voice the
   * browser ships, in the middle of a lesson whose other lines are recorded.
   *
   * So the voice says the instruction and the screen carries the numbers, which
   * is the right division anyway — this is a place-value lesson for a child who
   * reads numerals, and the panel above states all three plainly.
   */
  const prompt =
    short > 0
      ? tc("base10.promptAdd", { target: question.target, value, short })
      : short < 0
        ? tc("base10.promptRemove", { target: question.target, value, over: Math.abs(short) })
        : tc("base10.promptDone", { target: question.target });

  const spokenPrompt =
    short > 0
      ? tc("base10.spokenAdd")
      : short < 0
        ? tc("base10.spokenRemove")
        : tc("base10.spokenDone");

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tc("base10.title")}
      round={round}
      totalQuestions={total}
      prompt={prompt}
      iconName="boxes"
      iconTone="emerald"
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (built.hundreds > 0 || built.tens > 0 || built.ones > 0) ? restart : undefined
      }
      onExit={koda.ui.exit}
      onReadAloud={
        practising
          ? undefined
          : () => {
            round.useSupport("audio_replay");
            void koda.speech.say(spokenPrompt);
            }
      }
      recommendation={nextStep}
    >
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
              {tc("base10.yourJob")}
            </span>
            <h3 className="text-sm font-bold text-ink">{tc("base10.makeThis", { target: question.target })}</h3>
          </div>
          <div className="px-4 py-2 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                {tc("base10.make")}
              </div>
              <div className="text-xl font-black text-ink tabular-nums">{question.target}</div>
            </div>
            <div className="h-8 w-px bg-teal-500/20" />
            <div>
              <div className="text-[11px] font-bold text-muted">{tc("base10.youHave")}</div>
              <div
                className={`text-xl font-black tabular-nums ${
                  value === question.target
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-body"
                }`}
              >
                {value}
              </div>
            </div>
          </div>
        </div>

        <div
          className="space-y-4"
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* The supply. Blocks are taken from here, never used up. */}
          <div className="bg-canvas rounded-2xl border border-line p-3">
            <div className="text-xs font-bold text-muted mb-2 text-center">
              {tc("base10.dragHint")}
            </div>
            <div className="flex items-end justify-center gap-6 min-h-[72px]">
              {places.map((place) => (
                <motion.button
                  key={place.key}
                  onPointerDown={(e) => startDrag(e, { kind: place.key, from: "supply" })}
                  onClick={() => {
                    // A drag already placed (or discarded) the block; a plain tap
                    // has not, so it adds one. Dragging is the teaching, but a
                    // five-year-old on a tablet — or anyone on a keyboard —
                    // should not be locked out by it.
                    if (draggedRef.current) return;
                    adjust(place.key, 1, place.max);
                  }}
                  whileHover={{ scale: 1.1, y: -4 }}
                  whileTap={{ scale: 0.85, y: 2 }}
                  transition={SPRING.tap}
                  aria-label={tc("base10.addOne", { block: place.one })}
                  // touch-action:none stops iOS scrolling the page instead of
                  // dragging the block.
                  className="flex flex-col items-center gap-1 touch-none select-none cursor-grab active:cursor-grabbing transition"
                >
                  <Block kind={place.key} />
                  <span className={`text-xs font-black ${place.tone}`}>
                    {place.worth}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* The columns. Each is a drop zone for its own place only. */}
          <div className="grid gap-3 sm:grid-cols-3">
            {places.map((place) => (
              <div
                key={place.key}
                data-place={place.key}
                /* A refusal and a drag-over both say something about *this*
                   moment and win over the coach's light, which is about the
                   next move. */
                className={`bg-canvas rounded-2xl border-2 p-4 space-y-3 text-center transition ${
                  refused === place.key
                    ? "border-rose-500 bg-rose-500/10"
                    : hover === place.key && held?.kind === place.key
                      ? "border-emerald-500 bg-emerald-500/10"
                      : hover === place.key && held
                        ? "border-rose-400/60"
                        : guide.target === PLACE_INDEX[place.key]
                          ? "border-indigo-500 bg-indigo-500/10 ring-4 ring-indigo-500/30"
                          : "border-line"
                }`}
              >
                {guide.target === PLACE_INDEX[place.key] && (
                  <span className="sr-only">{tc("base10.workColumn")}</span>
                )}
                <div className={`text-sm font-black ${place.tone}`}>{place.label}</div>

                <div className="min-h-[64px] flex flex-wrap items-end justify-center gap-1">
                  {Array.from({ length: blocksIn(place.key) }, (_, i) => (
                    <motion.span
                      key={i}
                      onPointerDown={(e) => startDrag(e, { kind: place.key, from: place.key })}
                      role="button"
                      tabIndex={-1}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.8 }}
                      transition={SPRING.tap}
                      aria-label={tc("base10.blockIn", { block: place.one, column: place.label })}
                      className="touch-none select-none cursor-grab active:cursor-grabbing"
                    >
                      <Block kind={place.key} small />
                    </motion.span>
                  ))}
                  {built[place.key] > 12 && (
                    <span className="text-xs font-bold text-muted self-center">
                      +{built[place.key] - 12}
                    </span>
                  )}
                </div>

                <div className="text-3xl font-black text-ink tabular-nums">{built[place.key]}</div>

                {/* The same moves without a pointer: keyboard, switch, screen
                    reader. Dragging is the teaching, not the only way in. */}
                <div className="flex items-center justify-center gap-3">
                  <motion.button
                    onClick={() => adjust(place.key, -1, place.max)}
                    disabled={built[place.key] === 0}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.85 }}
                    transition={SPRING.tap}
                    aria-label={tc("base10.oneFewer", { column: place.label })}
                    className={themeSystem.button("secondary", "step")}
                  >
                    −
                  </motion.button>
                  <motion.button
                    onClick={() => adjust(place.key, 1, place.max)}
                    disabled={built[place.key] >= place.max}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.85 }}
                    transition={SPRING.tap}
                    aria-label={tc("base10.oneMore", { column: place.label })}
                    className={themeSystem.button("secondary", "step")}
                  >
                    +
                  </motion.button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-surface-muted/60 text-sm text-center text-muted">
          {setup.hundreds
            ? tc("base10.summaryHundreds", { hundreds: built.hundreds, tens: built.tens, ones: built.ones })
            : tc("base10.summary", { tens: built.tens, ones: built.ones })}{" "}
          <strong className="text-emerald-700 dark:text-emerald-400 text-base">{value}</strong>
        </div>

        {/*
          * One wrapping row, at `lg`.
          *
          * These were `sm`: a 27px-tall button with 12px type, which is a
          * toolbar control, not something a five-year-old aims a thumb at. `lg`
          * is 54px and reads at arm's length. It is also the ceiling — a full
          * width block was worse, not better: it made Check the largest object
          * on a screen whose subject is the blocks being counted.
          *
          * Left wrapping rather than forced into rows or columns. On the widest
          * lesson all three appear, and "Make a Ten" + "Make a Hundred" fill
          * 330px of the 342px a 390px phone has between its gutters — so they
          * hold one line and Check drops below them on its own, without a
          * breakpoint having to guess which lesson is running.
          */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {setup.bundleOnes && (
            <motion.button
              onClick={() => bundle("ones")}
              disabled={built.ones < 10}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING.tap}
              className={themeSystem.button("secondary", "lg")}
            >
              {tc("base10.makeTen")}
            </motion.button>
          )}
          {setup.bundleTens && (
            <motion.button
              onClick={() => bundle("tens")}
              disabled={built.tens < 10}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING.tap}
              className={themeSystem.button("secondary", "lg")}
            >
              {tc("base10.makeHundred")}
            </motion.button>
          )}
          <motion.button
            onClick={check}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={SPRING.tap}
            className={themeSystem.button("primary", "lg")}
          >
            {tc("base10.check")}
          </motion.button>
        </div>
      </div>

      {held && ghost && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2 scale-110 drop-shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden="true"
        >
          <Block kind={held.kind} />
        </div>
      )}
    </SkillRound>
  );
};
