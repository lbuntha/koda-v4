import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, SPRING, composeHints, isPractice, modeAt, playCopy, stagger,
  useSkillRound, type PracticeSetup, type RoundQuestion,
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

export const PLACE_NAMES: Record<Place, { one: string; many: string; unit: number }> = {
  ones: { one: "unit", many: "units", unit: 1 },
  tens: { one: "ten-rod", many: "ten-rods", unit: 10 },
  hundreds: { one: "hundred-flat", many: "hundred-flats", unit: 100 },
};

export const totalOf = (blocks: Digits): number =>
  blocks.hundreds * 100 + blocks.tens * 10 + blocks.ones;

/**
 * The exchange this desk still owes, if any.
 *
 * Measured against what is *left* to take away, never the original subtrahend:
 * once the units have been paid the desk owes nothing, even though it now holds
 * fewer units than the question named.
 */
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
  if (q.mode === "multiples_ten") return `${q.minuend} minus ${q.subtrahend}. Take away whole ten-rods.`;
  if (q.mode === "multiples_hundred") return `${q.minuend} minus ${q.subtrahend}. Take away whole hundred-flats.`;
  if (q.mode === "trade_ten") return `${q.minuend} minus ${q.subtrahend}. Break a ten before you take the units.`;
  if (q.mode === "trade_hundred") return `${q.minuend} minus ${q.subtrahend}. Break a hundred before you take the rods.`;
  return `${q.minuend} minus ${q.subtrahend}. Take the blocks away.`;
};

export const printedFor = (q: BlockQuestion): PrintedQuestion => ({
  text: `Cross out ${q.subtrahend} from the blocks. ${q.minuend} − ${q.subtrahend} =`,
  answer: String(q.difference),
});

export const methodFor = (q: BlockQuestion): string[] => {
  const trade = q.mode === "trade_ten" || q.mode === "trade_hundred";
  return [
    `Build ${q.minuend} from hundreds, tens and ones.`,
    trade
      ? q.mode === "trade_ten"
        ? "Break one ten-rod into ten units; the value does not change."
        : "Break one hundred-flat into ten ten-rods; the value does not change."
      : "Take away the blocks named in each column.",
    "Read the value of the blocks that remain.",
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
    state.kidTip ?? "One larger block can become ten smaller ones.",
    owed === "tens"
      ? `You need ${q.need.ones} units but only ${state.held.ones} are on the desk. Break one ten-rod into ten units.`
      : `You need ${q.need.tens} ten-rods but only ${state.held.tens} are on the desk. Break one hundred-flat into ten rods.`,
    "Breaking a block changes how it looks, never how much it is worth.",
  );

  if (short.length > 0) return composeHints(
    state.kidTip ?? "Take away the blocks column by column.",
    `Still to take away: ${short.map((entry) => `${entry.left} ${PLACE_NAMES[entry.place][entry.left === 1 ? "one" : "many"]}`).join(", ")}.`,
    `When the desk is done it will hold ${q.difference}.`,
  );

  return composeHints(
    state.kidTip ?? "Read the blocks that remain.",
    `The desk now holds ${state.held.hundreds} hundreds, ${state.held.tens} tens and ${state.held.ones} ones.`,
    `${q.minuend} minus ${q.subtrahend} is ${q.difference}.`,
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
    role="img" aria-label={`Base-ten blocks for ${q.minuend}; cross out ${q.subtrahend}`} className="text-slate-900">
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
  blocks: Digits; density: BlockDensity; onTake?: (place: Place) => void; gone?: boolean; caption: string;
}> = ({ blocks, density, onTake, gone, caption }) => {
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
        <div key={place} className={`flex flex-wrap items-end gap-x-0.5 gap-y-1 ${place === "ones" ? "max-w-[9.5rem]" : ""}`}>
          {Array.from({ length: count }, (_, i) => <Block key={`${place}-${i}`} place={place} size={className}
            gone={gone} index={i}
            label={`${gone ? "Taken" : "Take"} ${PLACE_NAMES[place].one} ${i + 1}`}
            onClick={onTake ? () => onTake(place) : undefined} />)}
        </div>)}
      {places.every(({ count }) => count === 0) && <span className="text-sm font-bold text-ink/40">nothing here yet</span>}
    </div>
  </div>;
};

const ZERO: Digits = { ones: 0, tens: 0, hundreds: 0 };

export const BlockExchange: React.FC<ActivityProps<BlockExchangeParams>> = ({ params, koda, onComplete, lesson }) => {
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
      nudge.refuse(`${q.need[place] === 0 ? "No" : `Only ${q.need[place]}`} ${PLACE_NAMES[place].many} come off this desk.`);
      return;
    }
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
        ? `There are not enough units yet. Break one ten-rod into ten units first.`
        : `There are not enough ten-rods yet. Break one hundred-flat into ten rods first.`);
      return;
    }
    if (!done) {
      const short = (["hundreds", "tens", "ones"] as const)
        .map((place) => ({ place, left: remaining[place] }))
        .filter((entry) => entry.left > 0);
      nudge.refuse(`Still to take away: ${short.map((entry) => `${entry.left} ${PLACE_NAMES[entry.place][entry.left === 1 ? "one" : "many"]}`).join(", ")}.`);
      return;
    }
    if (!entry) { nudge.refuse("Type the value of the blocks that remain."); return; }
    const given = Number(entry);
    const correct = given === q.difference;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({
      correct, given: entry, expected: q.expected,
      errorKind: correct ? undefined : digitsOf(given).ones === digitsOf(q.difference).ones ? "place_value" : "off_by_more",
      title: correct ? "The blocks agree!" : "Read the blocks again",
      message: practising ? undefined : `${q.minuend} minus ${q.subtrahend} is ${q.difference}.`,
    });
  };

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle="Base-Ten Blocks" round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName="boxes" iconTone="purple"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={practising ? [] : blockHints(q, { held, taken, kidTip: copy.kidTip })}
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-3 sm:p-5 space-y-3`}>
        <Desk blocks={held} density={density} onTake={take} caption="On the desk" />
        <Desk blocks={taken} density={density} gone caption="Taken away" />
        {showsDifference && <div aria-live="polite" className={`text-center text-3xl font-black tabular-nums ${DIFFERENCE.text}`}>
          {totalOf(held)}<span className="ml-2 text-[10px] uppercase text-ink/50">on the desk</span>
        </div>}
        {badges && <div className="text-center text-xs font-bold text-ink/55 tabular-nums">
          taken away {totalOf(taken)} of {q.subtrahend}
        </div>}
        {scaffold && !practising && <div className="text-center text-sm font-bold text-ink/60">
          {owed
            ? owed === "tens" ? "Not enough units. Break a ten first." : "Not enough rods. Break a hundred first."
            : done ? "Every block is off. Read what is left." : "Take away the blocks column by column."}
        </div>}
      </div>

      {(held.tens > 0 || held.hundreds > 0) && !round.feedback && <div className="flex flex-wrap justify-center gap-2.5">
        {held.tens > 0 && <button type="button" onClick={() => breakOne("tens")} className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}>Break 1 ten into 10 ones</button>}
        {held.hundreds > 0 && <button type="button" onClick={() => breakOne("hundreds")} className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "md")}`}>Break 1 hundred into 10 tens</button>}
      </div>}

      {done && !owed && <div className="flex justify-center">
        <label className="flex items-center gap-2 text-sm font-bold text-ink/70">
          What is left?
          <span className="w-24 shrink-0"><input inputMode="numeric" pattern="[0-9]*" value={entry} disabled={Boolean(round.feedback)}
            onChange={(event) => setEntry(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            aria-label="Value left on the desk" className={themeSystem.field("md", "w-full text-center text-2xl font-black tabular-nums")} /></span>
        </label>
      </div>}

      <div className="flex justify-center"><button type="button" onClick={check} className={themeSystem.button("primary", "lg")}>Check</button></div>
    </div>
  </SkillRound>;
};
