import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound,
  answerChoices,
  composeHints,
  isPractice,
  modeAt,
  playCopy,
  useSkillRound,
  type RoundQuestion,
  guideSetup,
  useGuide,
} from "../../kit";
// Exported by the practice module rather than the kit barrel.
import { quietWhenPractising } from "../../kit/practice";
import { SvgAsset } from "../../../assets/svg";
import { themeSystem } from "../../../lib/themeSystem";
import {
  drawProduct,
  numberWord,
  pick,
  productKey,
  randInt,
  shuffle,
  withoutRepeat,
} from "../internal/data/multiplicationNumbers";
import { CONTAINERS, COUNTABLES, type Container, type Countable } from "../internal/data/multiplicationAssets";
import { chime } from "../internal/data/multiplicationSound";
import { answerInput, speechRate, tagLabelsFrom } from "../internal/data/multiplicationChrome";
import { EACH, GROUPS, PRODUCT } from "../internal/data/multiplicationPalette";
import { COUNT_BADGE, GROUP_BIN, TOKEN_COMPACT, TOUCH_TARGET, WORD_CHOICE } from "../internal/data/multiplicationLayout";
import { useNudge } from "../internal/ui/useNudge";
import { NumberPad } from "../internal/ui/NumberPad";
import { tm } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * Equal groups — where multiplication starts.
 *
 * Seven modes, one apparatus: a row of containers and a supply of things to put
 * in them. Making four groups of three, deciding whether groups are equal,
 * counting them by repeated addition, matching them to an equation, saying
 * which factor counts what, and the two properties.
 *
 * The two factors are drawn in different colours throughout. A child about to
 * be told that four baskets of six and six baskets of four both make
 * twenty-four needs to have seen which number was which first, or
 * commutativity is not a discovery — it is a coincidence.
 */

export type GroupMode =
  | "make_groups"
  | "equal_or_not"
  | "repeated_addition"
  | "groups_to_equation"
  | "factor_roles"
  | "times_one"
  | "times_zero";

interface GroupSetup {
  mode?: GroupMode;
  modes?: string[];
  practice?: boolean;
  groupRange?: [number, number];
  sizeRange?: [number, number];
  productMax?: number;
  questionsPerRound?: number;
}

export interface GroupParams extends GroupSetup {
  question?: GroupSetup;
  play?: unknown;
}

interface Equation {
  text: string;
  correct: boolean;
}

export interface GroupQuestion extends RoundQuestion {
  mode: GroupMode;
  /** How many containers. */
  groups: number;
  /** How many objects belong in each. */
  size: number;
  total: number;
  asset: Countable;
  container: Container;
  /** `equal_or_not`: what each container actually holds. */
  bins: number[];
  equal: boolean;
  oddBin: number;
  choices: number[];
  equations: Equation[];
  /** `times_one`: whether the one is the group count or the group size. */
  singleGroup: boolean;
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULTS: Record<GroupMode, { groupRange: [number, number]; sizeRange: [number, number]; productMax: number }> = {
  make_groups: { groupRange: [2, 6], sizeRange: [2, 6], productMax: 36 },
  equal_or_not: { groupRange: [3, 5], sizeRange: [2, 6], productMax: 30 },
  repeated_addition: { groupRange: [2, 6], sizeRange: [2, 9], productMax: 40 },
  groups_to_equation: { groupRange: [2, 8], sizeRange: [2, 9], productMax: 60 },
  factor_roles: { groupRange: [2, 8], sizeRange: [2, 9], productMax: 60 },
  times_one: { groupRange: [1, 12], sizeRange: [1, 12], productMax: 12 },
  times_zero: { groupRange: [1, 12], sizeRange: [0, 0], productMax: 0 },
};

/**
 * Four equations, one of which describes the picture.
 *
 * Every option is arithmetically true, so the task is reading the picture
 * rather than checking the sums. The commuted form is deliberately absent: at
 * this level it describes a different arrangement of the same objects, which is
 * level five's question and would make this one unanswerable.
 */
function equationsFor(groups: number, size: number): Equation[] {
  const answer = groups * size;
  /*
   * The "+" option is only offered above two groups.
   *
   * Two groups of two is 2 + 2, so `2 + 2 = 4` is a true repeated addition of
   * the very picture on screen — a distractor a child would be marked wrong for
   * reading correctly. Above two groups the sum of the factors is never the
   * repeated addition, so the option means what it is meant to mean.
   */
  const candidates: string[] = [
    `${groups + 1} × ${size} = ${(groups + 1) * size}`,
    `${groups} × ${size + 1} = ${groups * (size + 1)}`,
    ...(groups > 2 ? [`${groups} + ${size} = ${groups + size}`] : []),
    `${groups + 1} × ${size + 1} = ${(groups + 1) * (size + 1)}`,
    `${Math.max(2, groups - 1)} × ${size} = ${Math.max(2, groups - 1) * size}`,
  ];

  const correct = `${groups} × ${size} = ${answer}`;
  const seen = new Set<string>([correct]);
  const wrong: Equation[] = [];
  for (const text of candidates) {
    if (wrong.length === 3) break;
    // Never a second sentence that also totals the answer: two right options is
    // not a harder question, it is a broken one.
    if (seen.has(text) || text.endsWith(`= ${answer}`)) continue;
    seen.add(text);
    wrong.push({ text, correct: false });
  }
  return shuffle([{ text: correct, correct: true }, ...wrong]);
}

export function buildQuestion(params: GroupParams, index: number, seen?: Set<string>): GroupQuestion {
  const setup: GroupSetup = { ...params, ...params.question };
  const mode = modeAt(setup, index + 1, "make_groups");
  const fallback = DEFAULTS[mode];
  const groupRange = setup.groupRange ?? fallback.groupRange;
  const sizeRange = setup.sizeRange ?? fallback.sizeRange;
  const asset = pick(COUNTABLES);
  const container = pick(CONTAINERS);

  let groups: number;
  let size: number;

  if (mode === "times_zero") {
    groups = randInt(Math.max(1, groupRange[0]), groupRange[1]);
    size = 0;
  } else if (mode === "times_one") {
    // Both orders, because "one group of six" and "six groups of one" are the
    // same fact seen from opposite ends and a child should meet both.
    const other = randInt(2, Math.max(2, Math.min(12, groupRange[1])));
    const singleGroup = randInt(0, 1) === 0;
    groups = singleGroup ? 1 : other;
    size = singleGroup ? other : 1;
  } else {
    const draw = () =>
      drawProduct({
        aRange: groupRange,
        bRange: sizeRange,
        productMax: setup.productMax ?? fallback.productMax,
        /*
         * Three groups of three has no wrong way round.
         *
         * `factor_roles` asks which factor counts the containers and which
         * counts their contents; when the two are equal, both assignments are
         * right and the question teaches nothing while still scoring. The other
         * modes are unharmed by a square — a picture of three groups of three
         * still matches exactly one sentence.
         */
        distinctFactors: mode === "factor_roles",
      });
    const value = seen ? withoutRepeat(draw, productKey, seen) : draw();
    groups = value.a;
    size = value.b;
  }

  const total = groups * size;
  const id = `groups-${mode}-${index}-${groups}x${size}`;

  // `equal_or_not` shows a tray that is already filled; half the draws have one
  // container holding a different number.
  const shouldBeEqual = randInt(0, 1) === 0;
  const oddBin = shouldBeEqual ? -1 : randInt(0, groups - 1);
  const wrongCount = Math.max(1, size + (randInt(0, 1) === 0 ? -1 : 1));
  const bins = Array.from({ length: groups }, (_, i) =>
    i === oddBin && wrongCount !== size ? wrongCount : size,
  );
  const equal = bins.every((count) => count === bins[0]);

  const base: Omit<GroupQuestion, "prompt" | "expected" | "taskKind"> = {
    id,
    mode,
    groups,
    size,
    total,
    asset,
    container,
    bins,
    equal,
    oddBin: equal ? -1 : oddBin,
    choices: answerChoices(total, id, { min: 0, max: 200 }),
    equations: equationsFor(groups, size),
    singleGroup: groups === 1,
    itemCount: total,
  };

  switch (mode) {
    case "equal_or_not":
      return {
        ...base,
        taskKind: "judge_equal_groups",
        prompt: tm("group.promptEqual", { container: base.container.name, asset: base.asset.name }),
        expected: equal ? "equal" : "not equal",
      };
    case "repeated_addition":
      return {
        ...base,
        taskKind: "add_equal_groups",
        prompt: tm("group.promptRepeated", { groups, container: base.container.name, size, asset: base.asset.name }),
        expected: String(total),
      };
    case "groups_to_equation":
      return {
        ...base,
        taskKind: "match_multiplication_equation",
        prompt: tm("group.promptEquation", { groups, container: base.container.name, size, asset: base.asset.name }),
        expected: `${groups} × ${size} = ${total}`,
      };
    case "factor_roles":
      return {
        ...base,
        taskKind: "label_the_factors",
        prompt: tm("group.promptRoles", { groups, size, container: base.container.name, asset: base.asset.name }),
        expected: `${groups} groups, ${size} in each`,
      };
    case "times_one":
      return {
        ...base,
        taskKind: "multiply_by_one",
        prompt: tm("group.promptTimesOne", { groups, size, asset: base.asset.name }),
        expected: String(total),
      };
    case "times_zero":
      return {
        ...base,
        taskKind: "multiply_by_zero",
        prompt: tm("group.promptTimesZero", { groups, container: base.container.name, asset: base.asset.name }),
        expected: "0",
      };
    case "make_groups":
    default:
      return {
        ...base,
        taskKind: "make_equal_groups",
        prompt: tm("group.promptMake", { groups, container: base.container.name, size, asset: base.asset.name }),
        expected: String(total),
      };
  }
}

export const promptFor = (question: GroupQuestion): string => question.prompt ?? "";

/* -------------------------------------------------------------------------- */
/* Worksheet                                                                   */
/* -------------------------------------------------------------------------- */

export function printedFor(question: GroupQuestion): PrintedQuestion | null {
  const { groups, size, total, container, asset } = question;
  switch (question.mode) {
    case "equal_or_not":
      return {
        text: tm("group.printedEqual", { container: container.name, bins: question.bins.join(", "), asset: asset.name }),
        answer: question.equal ? tm("group.yes") : tm("group.no"),
      };
    case "repeated_addition":
      return {
        text: tm("group.printedRepeated", { groups, container: container.name, size, asset: asset.name }),
        answer: `${Array.from({ length: groups }, () => size).join(" + ")} = ${total}`,
      };
    case "groups_to_equation":
      return {
        text: tm("group.printedEquation", { groups, container: container.name, size, asset: asset.name }),
        answer: `${groups} × ${size} = ${total}`,
      };
    case "factor_roles":
      return {
        text: tm("group.printedRoles", { groups, size, container: container.name, asset: asset.name }),
        answer: tm("group.printedRolesAnswer", { groups, size, container: container.name, asset: asset.name }),
      };
    case "times_zero":
      return {
        text: tm("group.printedZero", { groups, container: container.name }),
        answer: "0",
      };
    case "times_one":
    case "make_groups":
    default:
      return {
        text: tm("group.printedPlain", { groups, container: container.name, size, asset: asset.name }),
        answer: String(total),
      };
  }
}

export function methodFor(question: GroupQuestion): string[] | null {
  switch (question.mode) {
    case "equal_or_not":
      return [tm("group.methodEqual1"), tm("group.methodEqual2")];
    case "repeated_addition":
      return [
        tm("group.methodRep1"),
        tm("group.methodRep2"),
        tm("group.methodRep3"),
      ];
    case "factor_roles":
      return [tm("group.methodRoles1"), tm("group.methodRoles2")];
    case "times_zero":
      return [tm("group.methodZero1"), tm("group.methodZero2")];
    case "times_one":
      return [tm("group.methodOne1"), tm("group.methodOne2")];
    default:
      return [tm("group.methodPlain1"), tm("group.methodPlain2"), tm("group.methodPlain3")];
  }
}

export function figureFor(question: GroupQuestion): React.ReactNode | null {
  const counts = question.mode === "equal_or_not" ? question.bins : Array.from({ length: question.groups }, () => question.size);
  const width = Math.min(counts.length, 6) * 62 + 16;
  return (
    <svg viewBox={`0 0 ${width} 86`} width="100%" role="img" aria-label={tm("group.figureLabel", { count: counts.length })}>
      {counts.slice(0, 6).map((count, i) => (
        <g key={i} transform={`translate(${12 + i * 62}, 10)`}>
          <rect x="0" y="0" width="50" height="50" rx="8" fill="none" stroke="#334155" strokeWidth="2" />
          {Array.from({ length: Math.min(count, 9) }, (_, dot) => (
            <circle
              key={dot}
              cx={12 + (dot % 3) * 13}
              cy={12 + Math.floor(dot / 3) * 13}
              r="4"
              fill="#334155"
            />
          ))}
          <text x="25" y="70" textAnchor="middle" fontSize="12" fill="#334155">{count}</text>
        </g>
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Hints                                                                       */
/* -------------------------------------------------------------------------- */

interface LiveState {
  placed: number[];
  counted: boolean[];
  slotGroups?: number;
  slotEach?: number;
}

/** Three rungs, read off what is actually on screen. */
export function groupHints(question: GroupQuestion, kidTip: string | undefined, state: LiveState): string[] {
  const { groups, size, container, asset } = question;
  const built = state.placed.reduce((sum, count) => sum + count, 0);
  const fullBins = state.placed.filter((count) => count === size).length;

  switch (question.mode) {
    case "make_groups":
      return composeHints(
        kidTip,
        built === 0
          ? tm("group.hintMakeTap", { asset: asset.one, container: container.one })
          : tm("group.hintMakeFilled", { full: fullBins, groups, containers: container.name }),
        fullBins === groups
          ? tm("group.hintMakeAll", { container: container.one, size, groups })
          : tm("group.hintMakeNeed", { container: container.one, size, groups }),
      );
    case "equal_or_not":
      return composeHints(
        kidTip,
        tm("group.hintEqual1", { container: container.one }),
        question.equal
          ? tm("group.hintEqualYes", { container: container.one, count: question.bins[0] })
          : tm("group.hintEqualNo", { container: container.one }),
      );
    case "repeated_addition": {
      const done = state.counted.filter(Boolean).length;
      return composeHints(
        kidTip,
        done === 0
          ? tm("group.hintRepStart", { container: container.one })
          : tm("group.hintRepDone", { done, groups, containers: container.name }),
        tm("group.hintRepAdd", { sum: Array.from({ length: groups }, () => size).join(" + ") }),
      );
    }
    case "groups_to_equation":
      return composeHints(
        kidTip,
        tm("group.hintEq1", { groups, containers: container.name, size }),
        tm("group.hintEq2", { containers: container.name }),
      );
    case "factor_roles":
      return composeHints(
        kidTip,
        state.slotGroups === undefined && state.slotEach === undefined
          ? tm("group.hintRolesTap")
          : tm("group.hintRolesOne"),
        tm("group.hintRoles2", { containers: container.name, groups, size }),
      );
    case "times_one":
      return composeHints(
        kidTip,
        question.singleGroup
          ? tm("group.hintOneSingle", { container: container.one })
          : tm("group.hintOneEvery", { container: container.one, asset: asset.one }),
        tm("group.hintOneAnswer", { answer: question.singleGroup ? size : groups }),
      );
    case "times_zero":
    default:
      return composeHints(
        kidTip,
        tm("group.hintZero1", { containers: container.name }),
        tm("group.hintZero2", { groups }),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* The engine                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One countable thing, optionally numbered.
 *
 * The number goes on the artwork's own title as well as on the badge, so a
 * child using a screen reader hears "apple three" where a sighted child sees
 * the badge. The badge itself is then hidden from the reader, or the count
 * would be announced twice.
 */
const Thing: React.FC<{ asset: Countable; badge?: number }> = ({ asset, badge }) => (
  <span className={`relative inline-flex ${TOKEN_COMPACT} items-center justify-center`}>
    <SvgAsset
      id={asset.id}
      size="100%"
      title={badge === undefined ? asset.one : `${asset.one} ${badge}`}
    />
    {badge !== undefined && (
      <span aria-hidden="true" className={`${COUNT_BADGE} ${PRODUCT.solid} text-white`}>{badge}</span>
    )}
  </span>
);

export const GroupTray: React.FC<ActivityProps<GroupParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup: GroupSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const badgesEnabled = koda.config.isEnabled("counting_badges", true);
  const runningTotal = koda.config.isEnabled("running_product_badge", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const usePad = answerInput(koda) === "pad";

  const seen = useMemo(() => new Set<string>(), []);
  const nudge = useNudge(koda);
  const clearNudge = nudge.clear;

  /*
   * Everything this activity says, behind both gates at once.
   *
   * The kit speaks the opening line, the hint and the answer reaction; none of
   * those cover a count said as a child taps, so this activity has to gate its
   * own `audio_speech` or the switch is half-connected. `quietWhenPractising`
   * is the second gate: retrieval is the point of practice, and a voice
   * counting along with it is help.
   */
  const speakAloud = (text: string) => {
    if (!koda.config.isEnabled("audio_speech", true)) return;
    void koda.speech.say(text, speechRate(koda)).catch(() => {});
  };
  const speak = quietWhenPractising(speakAloud, practising);
  /** Count out loud, the way a child counts on their fingers. */
  const sayNumber = (n: number) => speak(numberWord(n));

  /**
   * Refuse a move in both channels.
   *
   * The written nudge names the numbers, because it can. The spoken line is one
   * fixed sentence per kind of refusal, because it has to be recordable — and
   * because a six-year-old who cannot read was, until now, given a buzz and a
   * chime and no way at all to find out what was wrong.
   */
  const refuse = (written: string, spoken: string) => {
    nudge.refuse(written);
    speak(spoken);
    /*
     * A refused move is this engine already knowing the move was wrong.
     *
     * What it never did was notice a child doing it repeatedly, which is the
     * difference between a slip and not having the technique. Safe to call a
     * coach declared further down: this only ever runs from a handler, long
     * after the render that created it.
     */
    guide.stumbled();
  };

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    /*
     * `useSkillRound` counts questions from one; `buildQuestion` counts from
     * zero, because that is how the worksheet builder calls it. Reconciled
     * here rather than inside the engine, so one index means one thing.
     */
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as GroupQuestion;

  /* Per-question working state. Reset whenever the question changes, including
     on a replay — a tray still holding the last question's objects would let a
     child answer without building anything. */
  const [placed, setPlaced] = useState<number[]>([]);
  const [counted, setCounted] = useState<boolean[]>([]);
  const [holding, setHolding] = useState(false);
  const [slotGroups, setSlotGroups] = useState<number | undefined>(undefined);
  const [slotEach, setSlotEach] = useState<number | undefined>(undefined);
  const [held, setHeld] = useState<number | undefined>(undefined);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setPlaced(Array.from({ length: question?.groups ?? 0 }, () => 0));
    setCounted(Array.from({ length: question?.groups ?? 0 }, () => false));
    setHolding(false);
    setSlotGroups(undefined);
    setSlotEach(undefined);
    setHeld(undefined);
    setTyped("");
    clearNudge();
    /*
     * `clearNudge` rather than `nudge`.
     *
     * `useNudge` returns a fresh object every render, so depending on it made
     * this effect run on every render, set state, and render again — a loop
     * that hangs the round rather than failing it. The callback inside is
     * stable, and it is the only part this needs.
     */
  }, [question?.id, question?.groups, clearNudge]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    setPlaced(Array.from({ length: question?.groups ?? 0 }, () => 0));
    setCounted(Array.from({ length: question?.groups ?? 0 }, () => false));
    setHolding(false);
    setSlotGroups(undefined);
    setSlotEach(undefined);
    setHeld(undefined);
    setTyped("");
    clearNudge();
  };


  if (!question) return null;

  const { mode, groups, size, asset, container } = question;
  const builtTotal = placed.reduce((sum, count) => sum + count, 0);
  const trayComplete = placed.length === groups && placed.every((count) => count === size);
  const countedTotal = counted.filter(Boolean).length * size;
  const allCounted = counted.length === groups && counted.every(Boolean);

  const feel = (correct: boolean) => {
    chime(koda, correct ? "right" : "wrong");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
  };

  const judge = (correct: boolean, given: string, title: string, message: string) => {
    feel(correct);
    round.submit({ correct, given, expected: question.expected, title, message });
  };

  /* ---- placing objects (make_groups) ---- */
  const takeOne = () => {
    if (round.feedback) return;
    setHolding(true);
    chime(koda, "placed");
    if (hapticsEnabled) koda.haptics.tap();
  };

  const dropInto = (bin: number) => {
    if (round.feedback) return;
    if (!holding) {
      refuse(tm("group.tapFirst", { asset: asset.one, container: container.one }), tm("group.takeFirst"));
      return;
    }
    if (placed[bin] >= size) {
      refuse(
        tm("group.binFull", { container: container.one, size }),
        tm("group.sameNumber"),
      );
      return;
    }
    const next = placed.slice();
    next[bin] += 1;
    setPlaced(next);
    setHolding(false);
    nudge.clear();
    const done = next.every((count) => count === size);
    chime(koda, done ? "reached" : "placed");
    // One-to-one, inside the group the object landed in: this is the count that
    // makes the groups equal rather than merely the same colour.
    sayNumber(next[bin]);
    if (hapticsEnabled) koda.haptics.tap();
  };

  /* ---- counting groups into the sum (repeated_addition) ---- */
  const countGroup = (bin: number) => {
    if (round.feedback) return;
    if (counted[bin]) {
      refuse(tm("group.alreadyCounted", { container: container.one }), tm("group.alreadyCountedSay"));
      return;
    }
    const next = counted.slice();
    next[bin] = true;
    setCounted(next);
    nudge.clear();
    chime(koda, next.every(Boolean) ? "reached" : "counted");
    // The running total, which is the skip count this lesson is teaching.
    sayNumber(next.filter(Boolean).length * size);
    if (hapticsEnabled) koda.haptics.tap();
  };

  /* ---- naming the factors (factor_roles) ---- */
  const holdFactor = (value: number) => {
    if (round.feedback) return;
    setHeld(value);
    chime(koda, "placed");
  };

  const fillSlot = (slot: "groups" | "each") => {
    if (round.feedback) return;
    if (held === undefined) {
      refuse(tm("group.tapNumber"), tm("group.tapNumberSay"));
      return;
    }
    const occupied = slot === "groups" ? slotGroups : slotEach;
    if (occupied !== undefined) {
      refuse(
        tm("group.slotFilled"),
        tm("group.slotFilledSay"),
      );
      return;
    }
    if (slot === "groups") setSlotGroups(held);
    else setSlotEach(held);
    setHeld(undefined);
    nudge.clear();
    chime(koda, "placed");
  };

  const clearSlot = (slot: "groups" | "each") => {
    if (round.feedback) return;
    if (slot === "groups") setSlotGroups(undefined);
    else setSlotEach(undefined);
    chime(koda, "undone");
  };

  const checkRoles = () => {
    if (slotGroups === undefined || slotEach === undefined) {
      refuse(tm("group.fillBoth"), tm("group.fillBothSay"));
      return;
    }
    // Checked together, once: which number counts what is one idea, and
    // scoring the halves separately would turn it into two guesses.
    const correct = slotGroups === groups && slotEach === size;
    judge(
      correct,
      `${slotGroups} groups, ${slotEach} in each`,
      correct ? tm("group.rightTitle") : tm("group.swapTitle"),
      correct
        ? tm("group.rolesRight", { groups, container: container.name, size })
        : tm("group.rolesWrong", { container: container.name }),
    );
  };

  /* ---- answering a total ---- */
  const answerTotal = (value: number) => {
    if (round.feedback) return;
    if (mode === "make_groups" && !trayComplete) {
      refuse(
        tm("group.finishFirst", { container: container.name, ready: placed.filter((c) => c === size).length, groups }),
        tm("group.finishFirstSay"),
      );
      return;
    }
    if (mode === "repeated_addition" && !allCounted) {
      refuse(
        tm("group.countFirst", { container: container.one, done: counted.filter(Boolean).length, groups }),
        tm("group.countFirstSay"),
      );
      return;
    }
    const correct = value === question.total;
    judge(
      correct,
      String(value),
      correct ? tm("group.yesTitle") : tm("group.notQuite"),
      correct
        ? tm("group.groupsOf", { groups, size, total: question.total })
        : tm("group.countAgain", { groups, size }),
    );
  };

  const submitTyped = () => {
    if (typed === "") {
      refuse(tm("group.typeFirst"), tm("group.typeFirst"));
      return;
    }
    answerTotal(Number(typed));
    setTyped("");
  };

  const answerEqual = (saysEqual: boolean) => {
    if (round.feedback) return;
    const correct = saysEqual === question.equal;
    judge(
      correct,
      saysEqual ? "equal" : "not equal",
      correct ? tm("group.spottedTitle") : tm("group.lookAgain"),
      question.equal
        ? tm("group.allHold", { container: container.one, count: question.bins[0] })
        : tm("group.oddHolds", { container: container.one, n: question.oddBin + 1, count: question.bins[question.oddBin], size }),
    );
  };

  const answerEquation = (equation: Equation) => {
    if (round.feedback) return;
    judge(
      equation.correct,
      equation.text,
      equation.correct ? tm("group.oneTitle") : tm("group.notSentence"),
      equation.correct
        ? tm("group.equationRight", { groups, size })
        : tm("group.equationWrong", { container: container.name }),
    );
  };

  const hints = practising
    ? []
    : groupHints(question, copy.kidTip, { placed, counted, slotGroups, slotEach });

  /* ---- the tray ---- */
  const binCounts =
    mode === "make_groups" ? placed
      : mode === "equal_or_not" ? question.bins
        : Array.from({ length: groups }, () => size);

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    /* The next bin: the first one not yet filled, or not yet counted. */
    target:
      slotGroups === undefined || slotEach === undefined
        ? placed.findIndex((n) => n !== question.size)
        : counted.findIndex((c) => !c),
    progress: placed.reduce((t, n) => t + n, 0) + counted.filter(Boolean).length,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  const tray = (
    <div className="flex flex-wrap items-start justify-center gap-3">
      {binCounts.map((count, bin) => {
        const isCounted = mode === "repeated_addition" && counted[bin];
        const clickable = mode === "make_groups" || mode === "repeated_addition";
        const label =
          mode === "make_groups"
            ? tm("group.binHolding", { container: container.one, n: bin + 1, count, size })
            : mode === "repeated_addition"
              ? tm(isCounted ? "group.binCounted" : "group.binPlain", { container: container.one, n: bin + 1, count, asset: asset.name })
              : tm("group.binPlain", { container: container.one, n: bin + 1, count, asset: asset.name });
        return (
          <button
            key={bin}
            type="button"
            aria-label={`${label}${guide.target === bin ? tm("group.binNext") : ""}`}
            aria-pressed={clickable ? (mode === "make_groups" ? count === size : isCounted) : undefined}
            disabled={!clickable || !!round.feedback}
            onClick={() => (mode === "make_groups" ? dropInto(bin) : countGroup(bin))}
            className={`${GROUP_BIN} ${TOUCH_TARGET} flex flex-col items-center justify-center border-2 ${
              isCounted ? `${PRODUCT.border} ${PRODUCT.soft}` : `${GROUPS.border} ${GROUPS.soft}`
            } ${clickable && !round.feedback ? "cursor-pointer" : ""} ${
              guide.target === bin ? "ring-4 ring-indigo-500" : ""
            } focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}
          >
            <span className="flex flex-wrap items-center justify-center gap-1">
              {Array.from({ length: count }, (_, i) => (
                <Thing key={i} asset={asset} badge={badgesEnabled ? i + 1 : undefined} />
              ))}
              {count === 0 && (
                <span className={`text-xs font-bold ${GROUPS.text}`}>{tm("group.empty")}</span>
              )}
            </span>
            <span className={`mt-1 text-xs font-black tabular-nums ${EACH.text}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );

  const numericAnswer = usePad ? (
    <div className="flex flex-col items-center gap-3">
      <output
        aria-label={tm("group.yourAnswer")}
        className={`min-h-11 min-w-24 rounded-xl border-2 px-4 py-2 text-center text-2xl font-black tabular-nums ${PRODUCT.border} ${PRODUCT.text}`}
      >
        {typed || "—"}
      </output>
      <NumberPad
        onDigit={(digit) => setTyped((current) => (current.length >= 3 ? current : current + digit))}
        onDelete={() => setTyped((current) => current.slice(0, -1))}
        disabled={!!round.feedback}
      />
      <button
        type="button"
        onClick={submitTyped}
        disabled={!!round.feedback}
        className={themeSystem.button("primary", "md")}
      >
        {tm("group.check")}
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {question.choices.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={tm("group.altogether", { value })}
          onClick={() => answerTotal(value)}
          disabled={!!round.feedback}
          className={themeSystem.button("secondary", "choice")}
        >
          {value}
        </button>
      ))}
    </div>
  );

  const controls = (() => {
    switch (mode) {
      case "equal_or_not":
        return (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => answerEqual(true)}
              disabled={!!round.feedback}
              className={`${WORD_CHOICE} ${EACH.border} bg-surface`}
            >
              {tm("group.allEqual")}
            </button>
            <button
              type="button"
              onClick={() => answerEqual(false)}
              disabled={!!round.feedback}
              className={`${WORD_CHOICE} ${EACH.border} bg-surface`}
            >
              {tm("group.oneDifferent")}
            </button>
          </div>
        );
      case "groups_to_equation":
        return (
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-2">
            {question.equations.map((equation) => (
              <button
                key={equation.text}
                type="button"
                onClick={() => answerEquation(equation)}
                disabled={!!round.feedback}
                className={`${TOUCH_TARGET} rounded-2xl border-2 ${EACH.border} bg-surface px-4 py-3 text-lg font-bold tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
              >
                {equation.text}
              </button>
            ))}
          </div>
        );
      case "factor_roles":
        return (
          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <div className="flex items-center justify-center gap-3">
              {[groups, size].map((value, i) => (
                <button
                  key={`${value}-${i}`}
                  type="button"
                  aria-label={tm("group.number", { value })}
                  aria-pressed={held === value}
                  onClick={() => holdFactor(value)}
                  disabled={!!round.feedback}
                  className={`${TOUCH_TARGET} rounded-2xl border-2 px-5 py-3 text-2xl font-black tabular-nums ${
                    held === value ? `${GROUPS.border} ${GROUPS.soft}` : "border-line bg-surface"
                  } text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}
                >
                  {value}
                </button>
              ))}
            </div>
            {([
              ["groups", slotGroups, tm("group.countsContainers", { container: container.name })],
              ["each", slotEach, tm("group.countsAssets", { asset: asset.name, one: container.one })],
            ] as const).map(([slot, value, label]) => (
              <button
                key={slot}
                type="button"
                aria-label={tm("group.slotLabel", { label, value: value ?? tm("group.empty") })}
                onClick={() => (value === undefined ? fillSlot(slot) : clearSlot(slot))}
                disabled={!!round.feedback}
                className={`${TOUCH_TARGET} flex items-center gap-3 rounded-2xl border-2 ${EACH.border} bg-surface px-4 py-3 text-left text-base font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500`}
              >
                <span className={`min-w-11 rounded-xl border-2 ${PRODUCT.border} px-3 py-1 text-center text-xl font-black tabular-nums ${PRODUCT.text}`}>
                  {value ?? "?"}
                </span>
                <span>{label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={checkRoles}
              disabled={!!round.feedback}
              className={themeSystem.button("primary", "md")}
            >
              {tm("group.check")}
            </button>
          </div>
        );
      default:
        return numericAnswer;
    }
  })();

  const runningStrip = (() => {
    if (!scaffold) return null;
    if (mode === "repeated_addition") {
      const parts = counted.map((done) => (done ? String(size) : "?"));
      return (
        <p className={`text-center text-lg font-black tabular-nums ${EACH.text}`} aria-live="polite">
          {parts.join(" + ")}{allCounted ? ` = ${countedTotal}` : ""}
        </p>
      );
    }
    if (mode === "make_groups") {
      return (
        <p className={`text-center text-sm font-bold ${GROUPS.text}`} aria-live="polite">
          {tm("group.ready", { ready: placed.filter((count) => count === size).length, groups, container: container.name })}
        </p>
      );
    }
    return null;
  })();


  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tm("group.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      onStartOver={
        !round.feedback && (placed.some((n) => n > 0) || counted.some(Boolean) || holding || slotGroups !== undefined || slotEach !== undefined || typed !== "") ? restart : undefined
      }
      iconName="Boxes"
      iconTone="purple"
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message ?? null}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), speechRate(koda));
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {mode === "make_groups" && (
          <button
            type="button"
            aria-label={tm("group.takeOne", { asset: asset.one })}
            aria-pressed={holding}
            onClick={takeOne}
            disabled={!!round.feedback}
            className={`${TOUCH_TARGET} flex items-center gap-2 rounded-2xl border-2 ${
              holding ? `${GROUPS.border} ${GROUPS.soft}` : "border-line bg-surface"
            } px-4 py-2 text-sm font-bold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500`}
          >
            <Thing asset={asset} />
            {holding ? tm("group.holding", { asset: asset.one, container: container.one }) : tm("group.takeA", { asset: asset.one })}
          </button>
        )}

        {tray}
        {runningStrip}

        {runningTotal && (mode === "make_groups" || mode === "repeated_addition") && (
          <p className={`text-sm font-black tabular-nums ${PRODUCT.text}`} aria-live="polite">
            {tm("group.soFar", { total: mode === "make_groups" ? builtTotal : countedTotal })}
          </p>
        )}

        {controls}
      </div>
    </SkillRound>
  );
};
