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
import { ADDEND_A, ADDEND_B, CHANGE, TOTAL } from "../internal/data/additionPalette";
import { SCENE } from "../internal/data/additionLayout";
import { useNudge } from "../internal/ui/useNudge";
import { speechRate, tagLabelsFrom } from "../internal/data/additionChrome";
import { isPractice, modeAt, type PracticeSetup } from "../../kit";
import { NumberPad } from "../internal/ui/NumberPad";
import {
  digitsOf,
  drawPair,
  pairKey,
  withoutRepeat,
  type PairSpec,
} from "../internal/data/additionNumbers";

/**
 * A whole above its parts.
 *
 * The one picture that carries every decomposition this skill teaches: what a
 * number is made of, which part is missing, and how an addend can be broken so
 * it reaches a ten. Four modes, all the same diagram with a different box left
 * blank — which is the point. A child who learns to read the picture once can
 * answer all four.
 *
 * Every mode submits **once**, on Check, however many boxes it has. One submit
 * per box would file four answers for one question and wreck first-try accuracy.
 */

export type BondMode = "whole_unknown" | "split_one" | "split_both" | "part_unknown";

export interface BondSetup extends PracticeSetup {
  mode?: BondMode;
  addendRange?: [number, number];
  aRange?: [number, number];
  bRange?: [number, number];
  sumMax?: number;
  questionsPerRound?: number;
}

export interface BondTreeParams extends BondSetup {
  question?: BondSetup;
}

/** One box in the diagram: a number the child can read, or one they must give. */
export interface Slot {
  /** Set when the number is given. */
  value?: number;
  /** Set when the child fills it. Unique within a question. */
  blank?: string;
}

export interface BondSpec {
  whole: Slot;
  parts: [Slot, Slot];
  /** Shown above the bond when there is more than one. */
  caption?: string;
}

export interface BondQuestion extends RoundQuestion {
  mode: BondMode;
  a: number;
  b: number;
  sum: number;
  bonds: BondSpec[];
  /** Blank ids, in the order they are read and answered. */
  blanks: string[];
  /** What each blank should hold, in the same order. */
  answers: number[];
}

const DEFAULT_SPEC: Record<BondMode, PairSpec> = {
  whole_unknown: { addendRange: [1, 9], sumMax: 10 },
  // Bridging: a below ten, and the two together crossing it. That shape is what
  // makes "break the second one apart to reach ten" the sensible move.
  split_one: { aRange: [6, 9], bRange: [3, 9], bridging: true },
  split_both: { addendRange: [11, 88], regroup: "never" },
  part_unknown: { addendRange: [1, 9], sumMax: 20 },
};

const declared = (setup: BondSetup): PairSpec => {
  const out: PairSpec = {};
  if (setup.addendRange) out.addendRange = setup.addendRange;
  if (setup.aRange) out.aRange = setup.aRange;
  if (setup.bRange) out.bRange = setup.bRange;
  if (setup.sumMax !== undefined) out.sumMax = setup.sumMax;
  return out;
};

export const specFor = (mode: BondMode, setup: BondSetup): PairSpec => {
  const spec: PairSpec = { ...DEFAULT_SPEC[mode], ...declared(setup) };
  // What the mode *is*, which no lesson may relax: without the bridge there is
  // nothing to break apart, and with a carry the tens-and-ones split is wrong.
  if (mode === "split_one") spec.bridging = true;
  if (mode === "split_both") spec.regroup = "never";
  return spec;
};

export const buildQuestion = (
  setup: BondSetup,
  index: number,
  seen: Set<string>,
): BondQuestion => {
  const mode = modeAt<BondMode>(setup, index, "whole_unknown");
  const { a, b, sum } = withoutRepeat(() => drawPair(specFor(mode, setup)), pairKey, seen);
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `bond_${mode}`, mode, a, b, sum };

  if (mode === "split_one") {
    // b is broken into what completes the ten, and the remainder.
    const toTen = 10 - a;
    const rest = b - toTen;
    return {
      ...base,
      bonds: [{ whole: { value: b }, parts: [{ blank: "p1" }, { blank: "p2" }] }],
      blanks: ["p1", "p2"],
      answers: [toTen, rest],
      expected: `${toTen},${rest}`,
      itemCount: sum,
    };
  }

  if (mode === "split_both") {
    const da = digitsOf(a);
    const db = digitsOf(b);
    return {
      ...base,
      bonds: [
        { whole: { value: a }, parts: [{ blank: "a-tens" }, { blank: "a-ones" }], caption: "First number" },
        { whole: { value: b }, parts: [{ blank: "b-tens" }, { blank: "b-ones" }], caption: "Second number" },
      ],
      blanks: ["a-tens", "a-ones", "b-tens", "b-ones"],
      answers: [da.tens * 10, da.ones, db.tens * 10, db.ones],
      expected: `${da.tens * 10},${da.ones},${db.tens * 10},${db.ones}`,
      itemCount: sum,
    };
  }

  if (mode === "part_unknown") {
    // Either part may be the missing one, so a child cannot learn a position.
    const hideLeft = Math.random() < 0.5;
    return {
      ...base,
      bonds: [
        {
          whole: { value: sum },
          parts: hideLeft ? [{ blank: "p" }, { value: b }] : [{ value: a }, { blank: "p" }],
        },
      ],
      blanks: ["p"],
      answers: [hideLeft ? a : b],
      expected: String(hideLeft ? a : b),
      itemCount: sum,
    };
  }

  return {
    ...base,
    bonds: [{ whole: { blank: "w" }, parts: [{ value: a }, { value: b }] }],
    blanks: ["w"],
    answers: [sum],
    expected: String(sum),
    itemCount: sum,
  };
};

export const promptFor = (q: BondQuestion, template?: string): string => {
  const filled = template
    ?.replaceAll("{a}", String(q.a))
    .replaceAll("{b}", String(q.b))
    .replaceAll("{sum}", String(q.sum));
  if (filled) return filled;

  switch (q.mode) {
    case "split_one":
      return `Break ${q.b} apart so ${q.a} can reach ten.`;
    case "split_both":
      return "Split each number into its tens and its ones.";
    case "part_unknown":
      return `${q.sum} is the whole. What is the missing part?`;
    default:
      return `What do ${q.a} and ${q.b} make altogether?`;
  }
};

export function bondHints(
  q: BondQuestion,
  state: { entries: Record<string, string>; kidTip?: string },
): string[] {
  const done = q.blanks.filter((id) => (state.entries[id] ?? "") !== "").length;
  const left = q.blanks.length - done;

  switch (q.mode) {
    case "split_one": {
      const toTen = 10 - q.a;
      return composeHints(
        state.kidTip ?? "Give the first number just enough to reach ten, then add what is left.",
        `${q.a} needs ${toTen} more to reach ten. Take that much out of ${q.b} and see what is left over.`,
        `${q.b} splits into ${toTen} and ${q.b - toTen}.`,
      );
    }
    case "split_both":
      return composeHints(
        state.kidTip ?? "Every two-digit number is some tens and some ones.",
        left === 0
          ? "All four boxes are filled. Check that each pair adds back up to the number above it."
          : `${left} ${left === 1 ? "box is" : "boxes are"} still empty. The left box is the tens — write it as a whole ten, like 40, not 4.`,
        `${q.a} is ${digitsOf(q.a).tens * 10} and ${digitsOf(q.a).ones}. ${q.b} is ${digitsOf(q.b).tens * 10} and ${digitsOf(q.b).ones}.`,
      );
    case "part_unknown":
      return composeHints(
        state.kidTip ?? "The two parts have to make the whole. One is missing.",
        `The whole is ${q.sum}, and one part is ${q.bonds[0].parts.find((p) => p.value !== undefined)?.value}. Count on from that part until you reach ${q.sum}.`,
        // Stops short: counting on is how the child produces this answer.
        `Ask yourself: what goes with that part to make ${q.sum}?`,
      );
    default:
      return composeHints(
        state.kidTip ?? "The two parts underneath make the whole on top.",
        `Put ${q.a} and ${q.b} together. Start at ${q.a} and count on ${q.b}.`,
        `${q.a} and ${q.b} make ${q.sum}.`,
      );
  }
}

/** One box in the diagram. A box nobody can type in is not a button. */
const Box: React.FC<{
  slot: Slot;
  entry?: string;
  active?: boolean;
  tone: "whole" | "left" | "right";
  onSelect?: () => void;
}> = ({ slot, entry, active, tone, onSelect }) => {
  const role = tone === "whole" ? TOTAL : tone === "left" ? ADDEND_A : ADDEND_B;
  const shell = `w-20 h-16 sm:w-24 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black tabular-nums ${role.soft} ${role.text}`;

  if (slot.blank === undefined) {
    return (
      <div className={shell} role="img" aria-label={`${tone === "whole" ? "Whole" : "Part"} ${slot.value}`}>
        {slot.value}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.95 }}
      transition={SPRING.tap}
      aria-label={`Box ${slot.blank}${entry ? `, ${entry}` : ", empty"}`}
      aria-pressed={Boolean(active)}
      className={`${shell} border-2 border-dashed ${
        active ? `${CHANGE.border} ring-4 ring-rose-400/40 border-solid` : "border-line"
      }`}
    >
      {entry || <span className="text-ink/25">?</span>}
    </motion.button>
  );
};

/** The diagram: a whole, two strokes, two parts. */
const Bond: React.FC<{
  spec: BondSpec;
  entries: Record<string, string>;
  active: string | null;
  onSelect(id: string): void;
}> = ({ spec, entries, active, onSelect }) => (
  <div className="flex flex-col items-center gap-1">
    {spec.caption && (
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/45">
        {spec.caption}
      </span>
    )}
    <Box
      slot={spec.whole}
      tone="whole"
      entry={spec.whole.blank ? entries[spec.whole.blank] : undefined}
      active={Boolean(spec.whole.blank && active === spec.whole.blank)}
      onSelect={spec.whole.blank ? () => onSelect(spec.whole.blank!) : undefined}
    />
    {/* The two strokes. Drawn rather than implied: the join is what makes this a
        bond and not two numbers stacked above two others. */}
    <svg width="120" height="26" viewBox="0 0 120 26" aria-hidden="true" className="text-line">
      <path d="M 60 2 L 18 24 M 60 2 L 102 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
    <div className="flex items-center gap-3 sm:gap-5">
      {spec.parts.map((part, i) => (
        <Box
          key={i}
          slot={part}
          tone={i === 0 ? "left" : "right"}
          entry={part.blank ? entries[part.blank] : undefined}
          active={Boolean(part.blank && active === part.blank)}
          onSelect={part.blank ? () => onSelect(part.blank!) : undefined}
        />
      ))}
    </div>
  </div>
);

export const BondTree: React.FC<ActivityProps<BondTreeParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: BondSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());

  const [entries, setEntries] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const nudge = useNudge(koda);
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
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

  const question = round.question as BondQuestion;

  /**
   * Report an answer.
   *
   * In practice the verdict stands on its own — a child working unaided is not
   * being walked through what happened, and an explanation after every question
   * would put the scaffolding back one sentence at a time.
   */
  const submit = (outcome: Parameters<typeof round.submit>[0]) =>
    round.submit(practising ? { ...outcome, message: undefined } : outcome);

  // A new question starts blank, with its first box already chosen so the pad
  // has somewhere to type without a child having to discover that it needs one.
  useEffect(() => {
    setEntries({});
    setActive(question.blanks[0] ?? null);
    nudge.clear();
  }, [question.id, question.blanks]);


  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };


  const typeDigit = (digit: string) => {
    if (!active || round.feedback) return;
    setEntries((prev) => {
      const next = `${prev[active] ?? ""}${digit}`.slice(0, 3);
      return { ...prev, [active]: next };
    });
    if (vibrates) koda.haptics.tap();
    chime("pop");
  };

  const deleteDigit = () => {
    if (!active || round.feedback) return;
    setEntries((prev) => ({ ...prev, [active]: (prev[active] ?? "").slice(0, -1) }));
  };

  const check = () => {
    if (round.feedback) return;
    const missing = question.blanks.filter((id) => (entries[id] ?? "") === "");
    if (missing.length > 0) {
      nudge.refuse(
        missing.length === question.blanks.length
          ? "Tap a box, then use the numbers below to fill it in."
          : `${missing.length} ${missing.length === 1 ? "box is" : "boxes are"} still empty.`,
      );
      return;
    }

    const given = question.blanks.map((id) => entries[id] ?? "");
    // One submit, however many boxes. Reported as the joined string so the log
    // holds what the child actually built, not just whether it was right.
    const correct = given.join(",") === question.answers.join(",");
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();

    const swapped =
      given.length === 2 && given.slice().reverse().join(",") === question.answers.join(",");

    submit({
      correct,
      given: given.join(","),
      errorKind: correct ? undefined : swapped ? "reversed" : "off_by_more",
      title: correct ? "That is right!" : "Not quite",
      message: correct
        ? question.mode === "split_one"
          ? `${question.b} splits into ${question.answers[0]} and ${question.answers[1]}, so ${question.a} reaches ten first.`
          : `The parts make ${question.sum}.`
        : swapped
          ? "The right two numbers, the other way round. Read the boxes left to right."
          : `The answer is ${question.answers.join(" and ")}.`,
    });
  };

  const prompt = promptFor(question, copy.prompts?.default);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Number Bonds"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="gem"
      iconTone="emerald"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message}
      hints={practising ? [] : bondHints(question, { entries, kidTip: copy.kidTip })}
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
        <div className={`${SCENE} p-5 sm:p-7 flex flex-wrap items-start justify-center gap-8`}>
          {question.bonds.map((spec, i) => (
            <Bond
              key={i}
              spec={spec}
              entries={entries}
              active={active}
              onSelect={(id) => {
                setActive(id);
                chime("clink");
              }}
            />
          ))}
        </div>

        <NumberPad onDigit={typeDigit} onDelete={deleteDigit} disabled={!active || Boolean(round.feedback)} />

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
    </SkillRound>
  );
};
