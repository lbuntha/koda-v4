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
import { THINGS, twoNames, type Thing } from "../internal/data/storyCast";
import { drawStory, pick, type StoryKind, type StoryNumbers } from "../internal/data/additionNumbers";

/**
 * A story, a bar model, and an answer — in that order.
 *
 * Six problem types that are all the same arithmetic and completely different
 * tasks. "Mia had 5 and got 3 more" and "Mia has 8 now, and got 3 of them
 * today" use the same three numbers; which one is missing is the entire
 * difficulty, and it is invisible until somebody draws it.
 *
 * So the child **builds** the bar rather than reading one. They are handed the
 * numbers the story states and have to put each one where it belongs — and
 * putting the total in the box meant for a part is exactly the mistake the
 * model exists to prevent. Only once the bar is right does the answer box
 * appear, because until then there is no question to answer.
 *
 * The sentences live in `lessons.json`. Code fills `{name}`, `{thing}` and the
 * numbers; code never writes a sentence, because the wording of a word problem
 * is curriculum and belongs where a teacher can edit it.
 */

export type StoryMode = StoryKind;

/** One box in the bar. A part, or the one the child is being asked for. */
export interface Slot {
  id: string;
  /** What belongs here. Absent on the box the question is about. */
  value?: number;
  /** What to call it out loud and in a label. */
  label: string;
}

export interface StoryRow {
  /** Whose bar this is, when there are two. */
  label?: string;
  slots: Slot[];
  /** Written above the bar when the whole is known. */
  whole?: number;
}

export interface StorySetup extends PracticeSetup {
  mode?: StoryMode;
  startRange?: [number, number];
  changeRange?: [number, number];
  partRange?: [number, number];
  differenceRange?: [number, number];
  /** The sentences, authored by the lesson. One is picked per question. */
  stories?: string[];
  questionsPerRound?: number;
}

export interface StoryBoardParams extends StorySetup {
  question?: StorySetup;
}

export interface StoryQuestion extends RoundQuestion {
  mode: StoryMode;
  /** The sentence, with everything filled in. */
  text: string;
  rows: StoryRow[];
  /** The numbers the story states, for the child to place. */
  chips: number[];
  answer: number;
  /** `multi_step` only: which of the two questions this is. */
  step?: 1 | 2;
}

/* -------------------------------------------------------------------------- */
/* The sentence                                                                */
/* -------------------------------------------------------------------------- */

/** Wording of last resort. A lesson that authors none still plays. */
const FALLBACK: Record<StoryMode, string> = {
  join: "{name} had {a} {thing}. Then {name} found {b} more. How many {thing} now?",
  ppw: "{name} has {a} red {thing} and {b} blue {thing}. How many {thing} altogether?",
  change_unknown: "{name} had {a} {thing}. Now {name} has {b}. How many more did {name} get?",
  start_unknown:
    "{name} found {a} more {thing}. Now {name} has {b}. How many {thing} did {name} start with?",
  compare: "{name} has {a} {thing}. {other} has {b} more than {name}. How many does {other} have?",
  multi_step:
    "{name} had {a} {thing}. {other} gave {name} {b} more, and then {c} more. How many now?",
};

const fill = (
  template: string,
  parts: { name: string; other: string; thing: Thing; values: number[] },
): string =>
  template
    .replaceAll("{name}", parts.name)
    .replaceAll("{other}", parts.other)
    .replaceAll("{thing}", parts.thing.many)
    .replaceAll("{one}", parts.thing.one)
    .replaceAll("{a}", String(parts.values[0] ?? ""))
    .replaceAll("{b}", String(parts.values[1] ?? ""))
    .replaceAll("{c}", String(parts.values[2] ?? ""));

/* -------------------------------------------------------------------------- */
/* The bar                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What the bar looks like for each kind of story.
 *
 * This is the whole pedagogy of the engine in one function: the same three
 * numbers, arranged so that which one is missing is visible. A join has both
 * parts and asks for the whole; a start-unknown has the whole and one part and
 * asks for the other — and they are told apart by where the empty box sits,
 * not by re-reading the sentence.
 */
const barFor = (
  mode: StoryMode,
  numbers: StoryNumbers,
  names: [string, string],
  step: 1 | 2,
): { rows: StoryRow[]; chips: number[]; answer: number } => {
  const [v0, v1, v2] = numbers.values;

  switch (mode) {
    case "ppw":
      return {
        rows: [{ slots: [{ id: "p1", value: v0, label: "first part" }, { id: "p2", value: v1, label: "second part" }] }],
        chips: [v0, v1],
        answer: numbers.answer,
      };

    case "change_unknown":
      // The whole is known and one part is not: the empty box is the change.
      return {
        rows: [
          {
            whole: v1,
            slots: [{ id: "start", value: v0, label: "what there was" }, { id: "change", label: "what was added" }],
          },
        ],
        chips: [v0],
        answer: numbers.answer,
      };

    case "start_unknown":
      // Same bar, empty box at the other end. That difference is the lesson.
      return {
        rows: [
          {
            whole: v1,
            slots: [{ id: "start", label: "what there was" }, { id: "change", value: v0, label: "what was added" }],
          },
        ],
        chips: [v0],
        answer: numbers.answer,
      };

    case "compare":
      return {
        rows: [
          { label: names[0], slots: [{ id: "small", value: v0, label: "the smaller amount" }] },
          {
            label: names[1],
            slots: [
              { id: "same", value: v0, label: "the same as the smaller amount" },
              { id: "more", value: v1, label: "how many more" },
            ],
          },
        ],
        chips: [v0, v0, v1],
        answer: numbers.answer,
      };

    case "multi_step":
      return step === 1
        ? {
            rows: [{ slots: [{ id: "s1", value: v0, label: "to start with" }, { id: "s2", value: v1, label: "the first lot added" }] }],
            chips: [v0, v1],
            answer: numbers.intermediate!,
          }
        : {
            rows: [
              {
                slots: [
                  { id: "sofar", value: numbers.intermediate!, label: "what there was after the first lot" },
                  { id: "s3", value: v2, label: "the second lot added" },
                ],
              },
            ],
            chips: [numbers.intermediate!, v2],
            answer: numbers.answer,
          };

    case "join":
    default:
      return {
        rows: [{ slots: [{ id: "start", value: v0, label: "to start with" }, { id: "change", value: v1, label: "what was added" }] }],
        chips: [v0, v1],
        answer: numbers.answer,
      };
  }
};

/** Carried between the two halves of a multi-step story. */
export interface StoryMemory {
  /** Which kind of story this is, so a cycle cannot resume the wrong one. */
  mode: StoryMode;
  numbers: StoryNumbers;
  names: [string, string];
  thing: Thing;
  text: string;
}

export const buildQuestion = (
  setup: StorySetup,
  index: number,
  seen: Set<string>,
  memory: { current: StoryMemory | null },
): StoryQuestion => {
  const mode = modeAt<StoryMode>(setup, index, "join");
  /*
   * A multi-step story is two questions of the round, not two answers to one.
   *
   * The first asks what there was after the first change; the second carries
   * that forward. Two submits, two attempts, two rows in the log — which is the
   * honest record, because a child can get the first step right and the second
   * wrong and that is worth knowing.
   */
  /*
   * Step two is only ever the second half of a story that has just had its
   * first half asked.
   *
   * Read off the memory rather than off the index. A practice run cycles
   * modes, so an even-numbered question is not reliably the second half of
   * anything — decided by parity alone it would carry a story from a different
   * mode, or resume one that had never been started.
   */
  const resuming = mode === "multi_step" && memory.current?.mode === "multi_step" && index % 2 === 0;
  const step: 1 | 2 = resuming ? 2 : 1;

  let memo = resuming ? memory.current : null;
  if (!memo) {
    const numbers = drawStory(mode, {
      startRange: setup.startRange,
      changeRange: setup.changeRange,
      partRange: setup.partRange,
      differenceRange: setup.differenceRange,
    });
    const names = twoNames(pick);
    const thing = pick(THINGS);
    const template = setup.stories?.length ? pick(setup.stories) : FALLBACK[mode];
    memo = {
      mode,
      numbers,
      names,
      thing,
      text: fill(template, { name: names[0], other: names[1], thing, values: numbers.values }),
    };
    memory.current = memo;
  }

  const { rows, chips, answer } = barFor(mode, memo.numbers, memo.names, step);
  const key = `${memo.numbers.values.join(",")}:${step}`;
  seen.add(key);

  return {
    id: `q${index}-${Date.now().toString(36)}`,
    taskKind: `story_${mode}${mode === "multi_step" ? `_step${step}` : ""}`,
    mode,
    text: memo.text,
    rows,
    chips,
    answer,
    step: mode === "multi_step" ? step : undefined,
    expected: String(answer),
    itemCount: answer,
  };
};

export const promptFor = (q: StoryQuestion): string =>
  q.step === 2 ? `${q.text} — and after the second lot?` : q.text;

export function storyHints(
  q: StoryQuestion,
  state: { placed: Record<string, number>; kidTip?: string },
): string[] {
  const toPlace = q.rows.flatMap((r) => r.slots).filter((s) => s.value !== undefined);
  const left = toPlace.filter((s) => state.placed[s.id] === undefined);
  const unknown = q.rows.flatMap((r) => r.slots).find((s) => s.value === undefined);

  if (left.length > 0) {
    return composeHints(
      state.kidTip ?? "Put each number the story gives you into the box it belongs in.",
      `The story tells you ${toPlace.map((s) => s.value).join(" and ")}. The next empty box is ${left[0].label} — which number is that?`,
      `Put ${left[0].value} in the box for ${left[0].label}.`,
    );
  }

  return composeHints(
    state.kidTip ?? "The bar shows what you know. The empty box is what you are asked for.",
    unknown
      ? `The bar is built. The empty box is ${unknown.label} — that is what the question wants.`
      : `The bar is built. Add the parts together.`,
    // Stops short: the child produces this by adding what they placed.
    `Add up what is in the bar to find it.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                     */
/* -------------------------------------------------------------------------- */

const SlotBox: React.FC<{
  slot: Slot;
  placed?: number;
  held: boolean;
  onTap?: () => void;
  tone: string;
}> = ({ slot, placed, held, onTap, tone }) => {
  const unknown = slot.value === undefined;
  const content = unknown ? "?" : placed !== undefined ? placed : "";
  return (
    <motion.button
      type="button"
      onClick={onTap}
      disabled={!onTap}
      layout
      whileTap={onTap ? { scale: 0.96 } : undefined}
      transition={SPRING.tap}
      aria-label={`Bar box for ${slot.label}${placed !== undefined ? `, holding ${placed}` : unknown ? ", unknown" : ", empty"}`}
      aria-pressed={held}
      className={`flex-1 min-w-[4.5rem] h-14 sm:h-16 rounded-xl border-2 flex items-center justify-center text-2xl font-black tabular-nums ${
        unknown
          ? `${CHANGE.soft} ${CHANGE.border} ${CHANGE.text} border-dashed`
          : placed !== undefined
            ? `${tone} border-transparent text-white`
            : "bg-surface/60 border-dashed border-line text-ink/25"
      } ${held ? "ring-4 ring-rose-400/50" : ""}`}
    >
      {content || (unknown ? "?" : "")}
    </motion.button>
  );
};

export const StoryBoard: React.FC<ActivityProps<StoryBoardParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: StorySetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  /** Practice takes the scaffolding away: no hints, no explanation, no voice. */
  const practising = isPractice(setup);
  const seen = useRef(new Set<string>());
  const memory = useRef<StoryMemory | null>(null);
  const nudge = useNudge(koda);

  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [usedChips, setUsedChips] = useState<number[]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const [entry, setEntry] = useState("");
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string } | undefined>();

  const round = useSkillRound({
    koda,
    resumable: practising,
    totalQuestions,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback(
      (index: number) => buildQuestion(setup, index, seen.current, memory),
      [params],
    ),
    onComplete: (result) => {
      void koda.progress.nextStep().then((r) => setNextStep(r ?? undefined));
      onComplete(result);
    },
  });

  const question = round.question as StoryQuestion;

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
    setPlaced({});
    setUsedChips([]);
    setHeld(null);
    setEntry("");
    nudge.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  // Practice says nothing at all, on top of the family's own voice switch.
  const speaks = !practising && koda.config.isEnabled("audio_speech", true);
  const chimes = koda.config.isEnabled("sound_chimes", true);
  const vibrates = koda.config.isEnabled("haptic_feedback", true);
  const framesSteps = koda.config.isEnabled("step_context_tags", true);
  const scaffold = koda.config.isEnabled("strategy_scaffold", true);

  const chime = (type: Parameters<typeof koda.sound.play>[0]) => {
    if (chimes) koda.sound.play(type);
  };

  const slots = question.rows.flatMap((r) => r.slots);
  const toPlace = slots.filter((s) => s.value !== undefined);
  const built = toPlace.every((s) => placed[s.id] !== undefined);

  const tapChip = (value: number, at: number) => {
    if (round.feedback) return;
    setHeld((h) => (h === at ? null : at));
    chime("clink");
  };

  const tapSlot = (slot: Slot) => {
    if (round.feedback || held === null) return;
    const value = question.chips[held];
    if (slot.value === undefined) {
      nudge.refuse("That box is what the question is asking for. It is not one of the numbers you were told.");
      return;
    }
    if (slot.value !== value) {
      // Putting a number where it does not belong is the mistake the model
      // exists to prevent, so it is answered rather than silently accepted.
      nudge.refuse(`${value} is not ${slot.label}. Read the story again and see which number that is.`);
      return;
    }
    setPlaced((prev) => ({ ...prev, [slot.id]: value }));
    setUsedChips((prev) => [...prev, held]);
    setHeld(null);
    if (vibrates) koda.haptics.tap();
    chime("pop");
  };

  const check = () => {
    if (round.feedback) return;
    if (!built) {
      nudge.refuse("Build the bar first — every number the story gives you has a box.");
      return;
    }
    if (entry === "") {
      nudge.refuse("Now type what the empty box should be.");
      return;
    }
    const given = Number(entry);
    const correct = given === question.answer;
    chime(correct ? "success" : "error");
    if (vibrates) correct ? koda.haptics.success() : koda.haptics.tap();
    submit({
      correct,
      given: entry,
      errorKind: correct ? undefined : Math.abs(given - question.answer) === 1 ? "off_by_one" : "off_by_more",
      title: correct ? "That is the answer!" : "Not quite",
      message: correct
        ? `The bar adds up to ${question.answer}.`
        : `Look at the bar again: it comes to ${question.answer}.`,
    });
  };

  const prompt = promptFor(question);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Story Problems"
      round={round}
      totalQuestions={totalQuestions}
      prompt={prompt}
      iconName="search"
      iconTone="pink"
      contextTag={framesSteps ? undefined : null}
      tagLabels={tagLabelsFrom(koda)}
      nudge={nudge.message}
      hints={practising ? [] : storyHints(question, { placed, kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={
        practising
          ? undefined
          : () => {
            round.useSupport("audio_replay");
            // These children cannot read the problem: a story they can only read is
            // a story they do not get.
            void koda.speech.say(question.text, speechRate(koda));
            }
      }
      recommendation={nextStep}
    >
      <div className="space-y-4">
        {/* The story is the prompt above; the scene is the bar it turns into,
            and printing the words twice only makes the child read them twice. */}
        <div className={`${SCENE} p-5 sm:p-7 space-y-5`}>
          <div className="space-y-3">
            {question.rows.map((row, r) => (
              <div key={r} className="space-y-1">
                {row.whole !== undefined && (
                  <p className={`text-center text-sm font-bold ${TOTAL.text} tabular-nums`}>
                    {row.whole} altogether
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {row.label && (
                    <span className="w-12 text-right text-sm font-bold text-ink/55">{row.label}</span>
                  )}
                  <div className="flex-1 flex gap-1.5">
                    {row.slots.map((slot, i) => (
                      <SlotBox
                        key={slot.id}
                        slot={slot}
                        placed={placed[slot.id]}
                        held={false}
                        tone={i === 0 ? ADDEND_A.solid : ADDEND_B.solid}
                        onTap={
                          round.feedback || placed[slot.id] !== undefined ? undefined : () => tapSlot(slot)
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {scaffold && !built && (
            <p className="text-center text-sm font-bold text-ink/55">
              Tap a number, then the box it belongs in.
            </p>
          )}
        </div>

        {/* The numbers the story states, waiting to be put somewhere. */}
        {!built && (
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {question.chips.map((value, i) =>
              usedChips.includes(i) ? null : (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => tapChip(value, i)}
                  disabled={Boolean(round.feedback)}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  transition={SPRING.tap}
                  aria-label={`Number ${i + 1} from the story, ${value}`}
                  aria-pressed={held === i}
                  className={themeSystem.button(
                    held === i ? "success" : "secondary",
                    "choice",
                    "min-w-[4rem]",
                  )}
                >
                  {value}
                </motion.button>
              ),
            )}
          </div>
        )}

        {built && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <span className="text-sm font-bold uppercase tracking-wide text-ink/50">Answer</span>
              <span
                className={`min-w-[5rem] h-14 px-4 rounded-2xl border-2 border-dashed ${CHANGE.border} flex items-center justify-center text-3xl font-black tabular-nums text-ink`}
                aria-label={`Answer ${entry || "empty"}`}
              >
                {entry || <span className="text-ink/25">?</span>}
              </span>
            </div>
            <NumberPad
              onDigit={(d) => setEntry((v) => `${v}${d}`.slice(0, 4))}
              onDelete={() => setEntry((v) => v.slice(0, -1))}
              disabled={Boolean(round.feedback)}
            />
          </div>
        )}

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
