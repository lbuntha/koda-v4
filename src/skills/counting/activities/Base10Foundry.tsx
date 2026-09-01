import React, { useCallback, useEffect, useState } from "react";
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
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";

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

const buildQuestion = (setup: Base10Setup, index: number): BuildQuestion => {
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
    parts.hundreds > 0 && `${parts.hundreds} hundred${parts.hundreds === 1 ? "" : "s"}`,
    parts.tens > 0 && `${parts.tens} ten${parts.tens === 1 ? "" : "s"}`,
    parts.ones > 0 && `${parts.ones} one${parts.ones === 1 ? "" : "s"}`,
  ].filter((part): part is string => typeof part === "string");
  if (said.length === 0) return "nothing at all";
  if (said.length === 1) return said[0];
  return `${said.slice(0, -1).join(", ")} and ${said[said.length - 1]}`;
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
      ? `You have ${built.ones} single ones. Ten of those are worth exactly one ten, so press "Make a Ten" — the total does not change, it just gets written properly.`
      : setup.bundleTens && built.tens >= 10
        ? `You have ${built.tens} ten rods. Ten of those are worth one hundred, so press "Make a Hundred" — the total stays the same, it is only tidied up.`
        : short === 0
          ? `The columns hold ${saidAsPlaces(built)}, which is ${question.target}. Press Check.`
          : short > 0
            ? value === 0
              ? `The columns are still empty. Drag in ${saidAsPlaces(
                  placesOf(question.target, showHundreds),
                )} to make ${question.target}.`
              : `You have built ${value} so far, which is ${saidAsPlaces(built)}. Drag in ${saidAsPlaces(
                  placesOf(short, showHundreds),
                )} more to reach ${question.target}.`
            : `You have built ${value}, which is ${Math.abs(short)} too many. Drag ${saidAsPlaces(
                placesOf(Math.abs(short), showHundreds),
              )} back out of the columns.`;

  return composeHints(
    state.kidTip ?? "Use the big blocks first, then the small ones.",
    `Read ${question.target} in places: it is ${saidAsPlaces(want)}. Each column takes one kind of block, and a block only goes in its own column.`,
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

const PLACES: Place[] = [
  { key: "hundreds", label: "Hundreds", one: "hundred flat", worth: 100, max: 9, tone: "text-rose-700 dark:text-rose-400" },
  { key: "tens", label: "Tens", one: "ten rod", worth: 10, max: 19, tone: "text-amber-700 dark:text-amber-400" },
  { key: "ones", label: "Ones", one: "one cube", worth: 1, max: 19, tone: "text-cyan-700 dark:text-cyan-400" },
];

/* -------------------------------------------------------------------------- */
/* The blocks                                                                  */
/* -------------------------------------------------------------------------- */

const BLOCK_TONE: Record<PlaceKey, string> = {
  ones: "bg-cyan-400 border-cyan-600",
  tens: "bg-amber-400 border-amber-600",
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

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (koda.config.isEnabled("sound_chimes", true)) koda.sound.play(type);
  };

  const adjust = (key: Place["key"], delta: number, max: number) => {
    chime("pop");
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
    chime("pop");
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
      chime("error");
    } else if (result.change) {
      setBuilt(result.built);
      chime(result.change === "added" ? "clink" : "pop");
      koda.haptics.tap();
    }

    setHeld(null);
    setGhost(null);
    setHover(null);
  };

  /** A block already in a column, which can be dragged back out to remove it. */
  const blocksIn = (key: PlaceKey) => Math.min(built[key], 12);

  const bundle = (from: "ones" | "tens") => {
    chime("clink");
    setBuilt((prev) =>
      from === "ones"
        ? { ...prev, ones: prev.ones - 10, tens: prev.tens + 1 }
        : { ...prev, tens: prev.tens - 10, hundreds: prev.hundreds + 1 },
    );
    if (!practising && koda.config.isEnabled("audio_speech", true)) {
      void koda.speech.say(from === "ones" ? "10 ones make 1 ten" : "10 tens make 1 hundred");
    }
  };

  const check = () => {
    const say = (correct: boolean, title: string, message: string, place = false) => {
      chime(correct ? "success" : "error");
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
        "Try a different number",
        `Your current total is ${value} blocks, but you need to build exactly ${question.target}.`,
      );
    }
    if (setup.bundleOnes && built.ones >= 10) {
      return say(
        false,
        "Group your ones",
        `Great total! But you have ${built.ones} Ones. Put 10 of them together to make a Ten.`,
        true,
      );
    }
    if (setup.bundleTens && built.tens >= 10) {
      return say(
        false,
        "Group your tens",
        `Great total! But you have ${built.tens} Tens. Put 10 of them together to make a Hundred.`,
        true,
      );
    }
    // Name only the columns this lesson actually shows, so a lesson without a
    // hundreds column never reports "0 Hundreds".
    const name = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
    const parts = [
      setup.hundreds ? name(built.hundreds, "Hundred", "Hundreds") : null,
      name(built.tens, "Ten", "Tens"),
      name(built.ones, "One", "Ones"),
    ].filter(Boolean) as string[];
    const built_as = parts.length > 2
      ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
      : parts.join(" and ");
    return say(true, "Great counting!", `Built ${question.target} as ${built_as}.`);
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
      ? `Make ${question.target}. You have ${value}. Add ${short} more!`
      : short < 0
        ? `Make ${question.target}. You have ${value}. Take away ${Math.abs(short)}!`
        : `You made ${question.target}! Press Check.`;

  const spokenPrompt =
    short > 0
      ? "Add more blocks to make the number."
      : short < 0
        ? "Take some blocks away."
        : "That's the number! Press Check.";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Base-10 Foundry"
      round={round}
      totalQuestions={total}
      prompt={prompt}
      iconName="boxes"
      iconTone="emerald"
      hints={practising ? [] : base10Hints(question, { built, setup, kidTip: copy.kidTip })}
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
              Your job
            </span>
            <h3 className="text-sm font-bold text-ink">Make this number: {question.target}</h3>
          </div>
          <div className="px-4 py-2 bg-teal-500/10 border border-teal-500/30 rounded-xl flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                MAKE
              </div>
              <div className="text-xl font-black text-ink tabular-nums">{question.target}</div>
            </div>
            <div className="h-8 w-px bg-teal-500/20" />
            <div>
              <div className="text-[11px] font-bold text-muted">You have</div>
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
              Drag a block into its column
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
                  aria-label={`Add one ${place.one}`}
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
                className={`bg-canvas rounded-2xl border-2 p-4 space-y-3 text-center transition ${
                  refused === place.key
                    ? "border-rose-500 bg-rose-500/10"
                    : hover === place.key && held?.kind === place.key
                      ? "border-emerald-500 bg-emerald-500/10"
                      : hover === place.key && held
                        ? "border-rose-400/60"
                        : "border-line"
                }`}
              >
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
                      aria-label={`${place.one} in ${place.label}, drag out to remove`}
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
                    aria-label={`One fewer ${place.label}`}
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
                    aria-label={`One more ${place.label}`}
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
          {setup.hundreds && `${built.hundreds} Hundreds + `}
          {built.tens} Tens + {built.ones} Ones ={" "}
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
              Make a Ten
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
              Make a Hundred
            </motion.button>
          )}
          <motion.button
            onClick={check}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={SPRING.tap}
            className={themeSystem.button("primary", "lg")}
          >
            Check
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
