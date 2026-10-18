import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy, stagger,
  useSkillRound, guideSetup, useGuide, type PracticeSetup, type RoundQuestion,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { BLOCK_SIZES, REMOVED, SCENE, TOUCH_TARGET, ZONE, type BlockDensity } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, digitsOf, drawDifference, withoutRepeat,
  type Difference, type DifferenceSpec, type Digits, type Place,
} from "../internal/data/subtractionNumbers";
import { ts } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

export type BlockMode =
  | "build_subtract"
  | "multiples_ten"
  | "multiples_hundred"
  | "trade_ten"
  | "trade_hundred";

export interface BlockSetup extends PracticeSetup {
  mode?: BlockMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  questionsPerRound?: number;
}

export interface BlockExchangeParams extends BlockSetup { question?: BlockSetup }

export interface BlockQuestion extends RoundQuestion {
  mode: BlockMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  /** What the desk is built from. */
  start: Digits;
  /** How many of each unit the child must take away. */
  need: Digits;
}

const DEFAULT_SPEC: Record<BlockMode, DifferenceSpec> = {
  build_subtract: { minuendRange: [20, 99], subtrahendRange: [10, 88], exchange: "never", excludeEqual: true },
  multiples_ten: { minuendRange: [20, 100], subtrahendRange: [10, 90], multipleOf: 10, excludeEqual: true },
  multiples_hundred: { minuendRange: [200, 900], subtrahendRange: [100, 900], multipleOf: 100, excludeEqual: true },
  trade_ten: { minuendRange: [20, 99], subtrahendRange: [11, 88], exchange: "ones" },
  trade_hundred: { minuendRange: [200, 999], subtrahendRange: [100, 899], exchange: "tens" },
};

const declared = (setup: BlockSetup): DifferenceSpec => {
  const out: DifferenceSpec = {};
  if (setup.minuendRange) out.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) out.subtrahendRange = setup.subtrahendRange;
  if (setup.differenceRange) out.differenceRange = setup.differenceRange;
  return out;
};

/**
 * A lesson may move the numbers; it may not change what the blocks do.
 *
 * The exchange and multiple constraints are the mode, so they are reapplied
 * after the lesson's ranges: a `trade_ten` round whose numbers never need a
 * trade would teach the opposite of its title.
 */
export const specFor = (mode: BlockMode, setup: BlockSetup): DifferenceSpec => {
  const spec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  if (mode === "build_subtract") { spec.exchange = "never"; spec.excludeEqual = true; }
  if (mode === "multiples_ten") { spec.multipleOf = 10; spec.excludeEqual = true; }
  if (mode === "multiples_hundred") { spec.multipleOf = 100; spec.excludeEqual = true; }
  if (mode === "trade_ten") spec.exchange = "ones";
  if (mode === "trade_hundred") spec.exchange = "tens";
  return spec;
};

export const buildQuestion = (setup: BlockSetup, index: number, seen: Set<string>): BlockQuestion => {
  const mode = modeAt<BlockMode>(setup, index, "build_subtract");
  const value = withoutRepeat<Difference>(() => drawDifference(specFor(mode, setup)), differenceKey, seen);
  return {
    id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_blocks_${mode}`,
    mode, ...value, start: digitsOf(value.minuend), need: digitsOf(value.subtrahend),
    expected: String(value.difference), itemCount: value.minuend,
  };
};

/** Block names come from the catalog (`blocks.name.*`), so each language writes its own. */
const placeName = (place: Place, unit: number) => ({
  get one() {
    return ts(`blocks.name.${place}.one`);
  },
  get many() {
    return ts(`blocks.name.${place}.many`);
  },
  unit,
});

export const PLACE_NAMES: Record<Place, { readonly one: string; readonly many: string; unit: number }> = {
  ones: placeName("ones", 1),
  tens: placeName("tens", 10),
  hundreds: placeName("hundreds", 100),
};

/** "3 ten-rods, 2 units". */
const stillToTake = (short: { place: Place; left: number }[]): string =>
  short.map((entry) => `${entry.left} ${PLACE_NAMES[entry.place][entry.left === 1 ? "one" : "many"]}`).join(", ");

export const totalOf = (blocks: Digits): number =>
  blocks.hundreds * 100 + blocks.tens * 10 + blocks.ones;

/**
 * The exchange this desk still owes, if any.
 *
 * Measured against what is *left* to take away, never the original subtrahend:
 * once the units have been paid the desk owes nothing, even though it now holds
 * fewer units than the question named.
 */
/** Where each place sits, so the coach can point at a column. */
const PLACE_INDEX: Record<Place, number> = { hundreds: 0, tens: 1, ones: 2 };

export const owedExchange = (held: Digits, remaining: Digits): "tens" | "hundreds" | undefined => {
  if (remaining.ones > held.ones && held.tens > 0) return "tens";
  if (remaining.tens > held.tens && held.hundreds > 0) return "hundreds";
  return undefined;
};

export const remainingNeed = (need: Digits, taken: Digits): Digits => ({
  ones: need.ones - taken.ones,
  tens: need.tens - taken.tens,
  hundreds: need.hundreds - taken.hundreds,
});

export const promptFor = (q: BlockQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  if (filled) return filled;
  if (q.mode === "multiples_ten") return ts("blocks.promptTens", { a: q.minuend, b: q.subtrahend });
  if (q.mode === "multiples_hundred") return ts("blocks.promptHundreds", { a: q.minuend, b: q.subtrahend });
  if (q.mode === "trade_ten") return ts("blocks.promptTradeTen", { a: q.minuend, b: q.subtrahend });
  if (q.mode === "trade_hundred") return ts("blocks.promptTradeHundred", { a: q.minuend, b: q.subtrahend });
  return ts("blocks.prompt", { a: q.minuend, b: q.subtrahend });
};

export const printedFor = (q: BlockQuestion): PrintedQuestion => ({
  text: ts("blocks.printed", { a: q.minuend, b: q.subtrahend }),
  answer: String(q.difference),
});

export const methodFor = (q: BlockQuestion): string[] => {
  const trade = q.mode === "trade_ten" || q.mode === "trade_hundred";
  return [
    ts("blocks.method1", { a: q.minuend }),
    trade
      ? q.mode === "trade_ten"
        ? ts("blocks.method2Ten")
        : ts("blocks.method2Hundred")
      : ts("blocks.method2"),
    ts("blocks.method3"),
  ];
};

export function blockHints(
  q: BlockQuestion,
  state: { held: Digits; taken: Digits; kidTip?: string },
): string[] {
  const remaining = remainingNeed(q.need, state.taken);
  const owed = owedExchange(state.held, remaining);
  const short = (["ones", "tens", "hundreds"] as const)
    .map((place) => ({ place, left: remaining[place] }))
    .filter((entry) => entry.left > 0);

  if (owed) return composeHints(
    state.kidTip ?? ts("blocks.hTradeTip"),
    owed === "tens"
      ? ts("blocks.hNeedUnits", { need: q.need.ones, held: state.held.ones })
      : ts("blocks.hNeedRods", { need: q.need.tens, held: state.held.tens }),
    ts("blocks.hSameWorth"),
  );

  if (short.length > 0) return composeHints(
    state.kidTip ?? ts("blocks.hColumnTip"),
    ts("blocks.stillToTake", { list: stillToTake(short) }),
    ts("blocks.hWillHold", { difference: q.difference }),
  );

  /*
   * The last rung is the technique, not the answer.
   *
   * Six lessons on this engine and the column pad all ended on the same
   * sentence — "72 minus 35 is 37" — which is true of every one of them and is
   * the method of none. Taking whole tens away is not the same move as trading
   * one ten for ten ones, and the rung a child reads last is where that
   * difference either lands or is lost.
   */
  const asUnits = q.mode === "multiples_ten" || q.mode === "multiples_hundred";
  const traded = q.mode === "trade_ten" || q.mode === "trade_hundred";
  const unit = q.mode === "multiples_hundred" ? 100 : 10;

  return composeHints(
    state.kidTip ?? ts("blocks.hReadTip"),
    ts("blocks.hHolds", { hundreds: state.held.hundreds, tens: state.held.tens, ones: state.held.ones }),
    asUnits
      ? ts(unit === 100 ? "blocks.hUnitsHundreds" : "blocks.hUnitsTens", {
          a: q.minuend / unit,
          b: q.subtrahend / unit,
          left: q.difference / unit,
          difference: q.difference,
        })
      : traded
        ? ts("blocks.hTraded", { difference: q.difference })
        : ts("blocks.hCountLeft", { difference: q.difference }),
  );
}

export const figureFor = (q: BlockQuestion): React.ReactNode => {
  const cell = 8;
  const rodH = cell * 10;
  const gap = 5;
  const flats = q.start.hundreds;
  const rods = q.start.tens;
  const ones = q.start.ones;
  const flatSide = cell * 10;
  const width = flats * (flatSide + gap) + rods * (cell + gap) + Math.min(ones, 10) * (cell + gap) + 4;
  return <svg viewBox={`0 0 ${Math.max(width, 40)} ${rodH + 4}`} width={Math.max(width, 40)} height={rodH + 4}
    role="img" aria-label={ts("blocks.figure", { a: q.minuend, b: q.subtrahend })} className="text-slate-900">
    <g stroke="currentColor" strokeWidth="1" fill="none">
      {Array.from({ length: flats }, (_, i) => <rect key={`f${i}`} x={2 + i * (flatSide + gap)} y="2" width={flatSide} height={flatSide} />)}
      {Array.from({ length: rods }, (_, i) => <rect key={`r${i}`} x={2 + flats * (flatSide + gap) + i * (cell + gap)} y="2" width={cell} height={rodH} />)}
      {Array.from({ length: ones }, (_, i) => <rect key={`o${i}`} x={2 + flats * (flatSide + gap) + rods * (cell + gap) + i * (cell + gap)} y={2 + rodH - cell} width={cell} height={cell} />)}
    </g>
  </svg>;
};

/**
 * The scored lines that make a flat a hundred and a rod a ten.
 *
 * Without them the three blocks differ only in size, and "the big square is one
 * hundred" is a convention to memorise rather than something the child can
 * count. Ten stripes down a rod and a ten-by-ten grid on a flat are the whole
 * argument for the apparatus.
 */
const rule = "rgba(255,255,255,.45)";
const GRID: Partial<Record<Place, React.CSSProperties>> = {
  hundreds: {
    backgroundImage:
      `repeating-linear-gradient(to right, ${rule} 0 1px, transparent 1px 10%),` +
      `repeating-linear-gradient(to bottom, ${rule} 0 1px, transparent 1px 10%)`,
  },
  tens: { backgroundImage: `repeating-linear-gradient(to bottom, ${rule} 0 1px, transparent 1px 10%)` },
};

const Block: React.FC<{
  place: Place; size: string; gone?: boolean; onClick?: () => void; label: string; index: number;
}> = ({ place, size, gone, onClick, label, index }) => {
  const tone = gone ? REMOVED_PART : WHOLE;
  const body = `${size} rounded-[3px] border-2 ${tone.border} ${gone ? `${tone.soft} ${REMOVED}` : tone.solid} relative`;
  const grid = gone ? undefined : GRID[place];
  if (!onClick) return <span className={body} style={grid} aria-hidden="true" />;
  return <motion.button type="button" onClick={onClick} aria-label={label}
    className={`${TOUCH_TARGET} inline-flex items-center justify-center`}
    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
    transition={{ ...SPRING.enter, delay: stagger(index) }} whileTap={{ scale: 0.9 }}>
    <span className={body} style={grid} />
  </motion.button>;
};

const Desk: React.FC<{
  /** The place the coach is pointing at, or undefined. */
  lit?: Place;
  blocks: Digits; density: BlockDensity; onTake?: (place: Place) => void; gone?: boolean; caption: string;
}> = ({ blocks, density, onTake, gone, caption, lit }) => {
  const size = BLOCK_SIZES[density];
  const places: Array<{ place: Place; count: number; className: string }> = [
    { place: "hundreds", count: blocks.hundreds, className: size.flat },
    { place: "tens", count: blocks.tens, className: size.rod },
    { place: "ones", count: blocks.ones, className: size.unit },
  ];
  return <div className={`${ZONE} w-full`} aria-label={caption} role="group">
    <div className="text-[10px] font-bold uppercase tracking-wide text-ink/55 mb-1.5">{caption}</div>
    {/* One group per place, never one wrapping row: a row that breaks mid-way
        drops units under rods and leaves the columns the lesson is about
        indistinguishable from each other. */}
    <div className="flex flex-wrap items-end justify-center gap-x-4 gap-y-2">
      {places.filter(({ count }) => count > 0).map(({ place, count, className }) =>
        /* The coach points at a *column*, not one cube: the work is "deal with
           the ones", and lighting a single unit inside them would answer a
           smaller question than the one the child is stuck on. */
        <div key={place} className={`flex flex-wrap items-end gap-x-0.5 gap-y-1 rounded-xl ${place === "ones" ? "max-w-[9.5rem]" : ""} ${
          lit === place ? "ring-4 ring-indigo-500 p-1" : ""
        }`}>
          {lit === place && <span className="sr-only">{ts("blocks.workColumn")}</span>}
          {Array.from({ length: count }, (_, i) => <Block key={`${place}-${i}`} place={place} size={className}
            gone={gone} index={i}
            label={ts(gone ? "blocks.taken" : "blocks.take", { block: PLACE_NAMES[place].one, n: i + 1 })}
            onClick={onTake ? () => onTake(place) : undefined} />)}
        </div>)}
      {places.every(({ count }) => count === 0) && <span className="text-sm font-bold text-ink/40">{ts("blocks.nothingYet")}</span>}
    </div>
  </div>;
};

const ZERO: Digits = { ones: 0, tens: 0, hundreds: 0 };

export const BlockExchange: React.FC<ActivityProps<BlockExchangeParams>> = ({ params, koda, onComplete, lesson }) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: BlockSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [held, setHeld] = useState<Digits>(ZERO);
  const [taken, setTaken] = useState<Digits>(ZERO);
  const [entry, setEntry] = useState("");
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 27,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as BlockQuestion;

  useEffect(() => { setHeld(q.start); setTaken(ZERO); setEntry(""); nudge.clear(); }, [q.id, q.start, nudge.clear]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    setHeld(q.start);
    setTaken(ZERO);
    setEntry("");
    nudge.clear();
  };


  const badges = koda.config.isEnabled("counting_badges", true);
  const showsDifference = koda.config.isEnabled("running_difference_badge", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const prompt = promptFor(q, copy.prompts?.default);
  const density: BlockDensity = q.start.hundreds > 4 || q.start.tens > 6 ? "dense" : "roomy";
  const remaining = remainingNeed(q.need, taken);
  const owed = owedExchange(held, remaining);
  const done = (["ones", "tens", "hundreds"] as const).every((place) => remaining[place] === 0);

  const take = (place: Place) => {
    if (round.feedback) return;
    if (taken[place] >= q.need[place]) {
      nudge.refuse(
        q.need[place] === 0
          ? ts("blocks.refuseNone", { blocks: PLACE_NAMES[place].many })
          : ts("blocks.refuseOnly", { n: q.need[place], blocks: PLACE_NAMES[place].many }),
      );
      /* The desk already shakes off a block that does not belong. What it never
         did was notice a child doing it again and again, which is the
         difference between a slip and not knowing which column is which. */
      guide.stumbled();
      return;
    }
    guide.moved();
    setHeld((current) => ({ ...current, [place]: current[place] - 1 }));
    setTaken((current) => ({ ...current, [place]: current[place] + 1 }));
    chime(koda, "moved");
    koda.haptics.tap();
  };

  /**
   * One larger block becomes ten smaller ones and the desk is worth the same.
   *
   * The conservation is the lesson, so it is asserted here rather than trusted:
   * a trade that changed the total would teach that regrouping loses value.
   */
  const breakOne = (from: "tens" | "hundreds") => {
    if (round.feedback) return;
    setHeld((current) => {
      if (current[from] < 1) return current;
      const into = from === "tens" ? "ones" : "tens";
      const next = { ...current, [from]: current[from] - 1, [into]: current[into] + 10 };
      return totalOf(next) === totalOf(current) ? next : current;
    });
    chime(koda, "changed");
    koda.haptics.tap();
  };

  const check = () => {
    if (owed) {
      nudge.refuse(owed === "tens"
        ? ts("blocks.refuseUnits")
        : ts("blocks.refuseRods"));
      return;
    }
    if (!done) {
      const short = (["hundreds", "tens", "ones"] as const)
        .map((place) => ({ place, left: remaining[place] }))
        .filter((entry) => entry.left > 0);
      nudge.refuse(ts("blocks.stillToTake", { list: stillToTake(short) }));
      return;
    }
    if (!entry) { nudge.refuse(ts("blocks.refuseType")); return; }
    const given = Number(entry);
    const correct = given === q.difference;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({
      correct, given: entry, expected: q.expected,
      errorKind: correct ? undefined : digitsOf(given).ones === digitsOf(q.difference).ones ? "place_value" : "off_by_more",
      title: correct ? ts("blocks.rightTitle") : ts("blocks.wrongTitle"),
      message: practising ? undefined : ts("aMinusBIs", { a: q.minuend, b: q.subtrahend, difference: q.difference }),
    });
  };

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : blockHints(q, { held, taken, kidTip: copy.kidTip });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: q.id,
    rungs: hints,
    /*
     * The place to work in: the one that owes an exchange, or the next place
     * still short. An owed trade wins, because that is the move `check`
     * refuses — taking more blocks first only digs the column deeper.
     */
    target: owed
      ? PLACE_INDEX[owed]
      : (["hundreds", "tens", "ones"] as const).findIndex((place) => remaining[place] > 0),
    progress: taken.hundreds + taken.tens + taken.ones,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle={ts("blocks.title")} round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="boxes" iconTone="purple"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={hints}
    guide={practising ? undefined : guide}
    guideMethod={copy.stepByStep}
    onStartOver={
      !round.feedback && (entry !== "" || JSON.stringify(held) !== JSON.stringify(q.start) || JSON.stringify(taken) !== JSON.stringify(ZERO)) ? restart : undefined
    }
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-3 sm:p-5 space-y-3`}>
        <Desk
          blocks={held}
          density={density}
          onTake={take}
          lit={(["hundreds", "tens", "ones"] as const)[guide.target]}
          caption={ts("blocks.onDesk")}
        />
        <Desk blocks={taken} density={density} gone caption={ts("blocks.takenAway")} />
        {showsDifference && <div aria-live="polite" className={`text-center text-3xl font-black tabular-nums ${DIFFERENCE.text}`}>
          {totalOf(held)}<span className="ml-2 text-[10px] uppercase text-ink/50">{ts("blocks.onDeskShort")}</span>
        </div>}
        {badges && <div className="text-center text-xs font-bold text-ink/55 tabular-nums">
          {ts("blocks.takenOf", { taken: totalOf(taken), b: q.subtrahend })}
        </div>}
        {scaffold && !practising && <div className="text-center text-sm font-bold text-ink/60">
          {owed
            ? owed === "tens" ? ts("blocks.helpUnits") : ts("blocks.helpRods")
            : done ? ts("blocks.helpDone") : ts("blocks.hColumnTip")}
        </div>}
      </div>

      {(held.tens > 0 || held.hundreds > 0) && !round.feedback && <div className="flex flex-wrap justify-center gap-2.5">
        {held.tens > 0 && <button type="button" onClick={() => breakOne("tens")} className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}>{ts("blocks.breakTen")}</button>}
        {held.hundreds > 0 && <button type="button" onClick={() => breakOne("hundreds")} className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}>{ts("blocks.breakHundred")}</button>}
      </div>}

      {done && !owed && <div className="flex justify-center">
        <label className="flex items-center gap-2 text-sm font-bold text-ink/70">
          {ts("blocks.whatLeft")}
          <span className="w-24 shrink-0"><input inputMode="numeric" pattern="[0-9]*" value={entry} disabled={Boolean(round.feedback)}
            onChange={(event) => setEntry(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            aria-label={ts("blocks.valueLeft")} className={themeSystem.field("md", "w-full text-center text-2xl font-black tabular-nums")} /></span>
        </label>
      </div>}

      <div className="flex justify-center"><button type="button" onClick={check} className={themeSystem.button("primary", "lg")}>{ts("check")}</button></div>
    </div>
  </SkillRound>;
};
