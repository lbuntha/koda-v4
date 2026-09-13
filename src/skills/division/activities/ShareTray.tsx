import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Undo2 } from "lucide-react";

import type { ActivityProps } from "../../types";
import {
  SkillRound,
  answerChoices,
  composeHints,
  isPractice,
  modeAt,
  useSkillRound,
} from "../../kit";
import {
  REFUSALS,
  blockedBecause,
  buildTrayQuestion,
  trayShapeFor,
  type ShareMode,
  type ShareQuestion,
  type ShareSetup,
  type Tone,
  type TrayBlock,
  TONE_CLASS,
} from "../internal/data/divisionTray";

/**
 * The dealing tray — division's first engine, and the one that decides whether
 * a child ever really has two meanings for `÷`.
 *
 * One finger action: move a counter from the pile onto a plate, or back off it.
 * Everything the five techniques on this engine differ by is which part of the
 * tray is fixed:
 *
 *   share_out / halve   the plates are fixed; the child finds what fits on one
 *   group_by_size       a plate's size is fixed; the child finds how many plates
 *   which_meaning       no dealing — name the unknown in a written situation
 *   to_equation         no dealing — read a finished deal as a sentence
 *
 * The tray refuses an answer rather than marking one wrong when the deal is not
 * finished or is not equal. That is deliberate: "every plate needs the same
 * number" is the rule the lesson is teaching, and a child who hears it while
 * looking at their own unequal plates has learned it. A child marked wrong has
 * only learned that they were wrong.
 */

interface ShareParams {
  question?: ShareSetup;
  mode?: ShareMode;
  questionsPerRound?: number;
}

/**
 * Exported for the worksheet adapter and for tests that want no React.
 *
 * Returns a `ShareQuestion`, which satisfies the round's `RoundQuestion` without
 * declaring that it does: the round needs an id, a task kind and an expected
 * answer, and this has all three as required fields rather than optional ones.
 */
export function buildQuestion(
  params: ShareParams,
  index: number,
  seen?: Set<string>,
): ShareQuestion {
  const setup: ShareSetup = { ...params, ...params.question };
  const mode = modeAt<ShareMode>(setup, index + 1, "share_out");
  return buildTrayQuestion(setup, mode, index, seen);
}

export const promptFor = (question: ShareQuestion): string => question.prompt;

/**
 * Three rungs, and none of them says the answer.
 *
 * The middle rung is the technique rather than a hint about this question: a
 * child stuck on `share_out` is almost never stuck on the arithmetic, they are
 * dealing in handfuls and losing count. Telling them to deal one at a time is
 * the actual help.
 */
export function trayHints(question: ShareQuestion): string[] {
  switch (question.mode) {
    case "share_out":
      return composeHints(
        `There are ${question.divisor} plates to fill.`,
        "Give one to each plate, then start again at the first. Keep going until the pile is empty.",
        "When the pile is empty, count what is on just one plate. That is the answer.",
      );
    /*
     * Halving had `share_out`'s ladder word for word, which told a child to
     * count plates and said nothing about halving — the one idea the level is
     * for. The third rung is the check, and it is the reason halving is worth
     * teaching apart: it is the only division a child can verify with a fact
     * they already have.
     */
    case "halve":
      return composeHints(
        "Halving means sharing between exactly two. There are always two plates.",
        "One to this plate, one to that one, over and over, until the pile is empty.",
        `Check it when you are done: does your answer, doubled, give you back ${question.dividend}?`,
      );
    case "group_by_size":
      return composeHints(
        `Each group needs exactly ${question.divisor}.`,
        "Fill one group completely before you start the next.",
        "When nothing is left, count the groups — not the counters.",
      );
    case "which_meaning":
      return composeHints(
        // "Holders" was jargon: it appears on no screen a child ever sees. The
        // sentence in front of them says plates, jars or buckets, and the two
        // phrases that actually distinguish the meanings are quoted instead.
        "Read it again, slowly. The two numbers in it are telling you different kinds of thing.",
        question.unknown === "size"
          ? "\u201cShared equally between\u201d counts the groups. So what it leaves out is how many go in each one."
          : "\u201cPut into groups of\u201d tells you the size of one group. So what it leaves out is how many groups there are.",
        question.unknown === "size"
          ? "You are looking for the size of one share."
          : "You are looking for the number of shares.",
      );
    case "to_equation":
      return composeHints(
        "The number you started with comes first.",
        `You started with ${question.dividend}, so the sentence starts with ${question.dividend}.`,
      );
    case "identity":
      return composeHints(
        question.divisor === 1
          ? "There is only one plate. Nobody else is sharing."
          : "Count the plates. Now count the counters.",
        question.divisor === 1
          ? "Nothing is being shared away, so everything stays where it is."
          : "There is exactly one counter for every plate, so each plate gets one.",
      );
    case "zero_rules":
      return question.impossible
        ? composeHints(
            "Look for the plates. How many are there?",
            "There is nowhere to put them. A share you cannot start has no answer at all.",
          )
        : composeHints(
            "There is nothing in the pile to share.",
            "The plates stay empty, however many plates there are.",
          );
    case "see_leftover":
      return composeHints(
        "Go round again while every plate can still have one.",
        "Stop when there are not enough left to give one to every plate.",
        "What is left over goes in the box. It is not on a plate, and it is not lost.",
      );
    default:
      return composeHints("Look at the tray.");
  }
}

/** One counter. Identical to every other counter in the question by design:
 *  varying the artwork varies the difficulty of counting it. */
const Counter: React.FC<{ tone: Tone; small?: boolean }> = ({ tone, small }) => (
  <span
    aria-hidden
    className={`inline-block rounded-full shadow-sm ${small ? "h-4 w-4" : "h-6 w-6"} ${TONE_CLASS[tone]}`}
  />
);

export const ShareTray: React.FC<ActivityProps<ShareParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  const setup: ShareSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const badgesEnabled = koda.config.isEnabled("counting_badges", true);

  const seen = useMemo(() => new Set<string>(), []);
  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    /*
     * Nothing is read to the child when a round opens.
     *
     * The opening line exists because a five-year-old cannot read the
     * instruction. This skill starts at seven, and reading the question aloud
     * to a reader takes the reading out of the question — which in levels 49
     * to 55 is most of the work. The speaker button is still there for a child
     * who needs it; it is pull, not push. See `voice.json`.
     */
    intro: undefined,
    resumable: practising,
    // `useSkillRound` counts from one; `buildQuestion` counts from zero.
    nextQuestion: useCallback(
      (index: number) => buildQuestion(params, index - 1, seen),
      [params, seen],
    ),
    onComplete,
  });
  const question = round.question as ShareQuestion;

  const shape = useMemo(() => (question ? trayShapeFor(question) : {}), [question]);
  /*
   * Thirty counters at full size pushed the answer buttons off the bottom of
   * the screen — on a phone, and on this laptop. A tray a child has to scroll
   * to answer is a tray they answer without looking at.
   */
  const small = (question?.dividend ?? 0) > 18;

  /** How many counters sit on each plate. Reset whenever the question changes. */
  const [plates, setPlates] = useState<number[]>([]);
  /** How many are in the leftover box — level 8's whole point. */
  const [leftover, setLeftover] = useState(0);
  /**
   * The refusal, shown only once a child has tried to answer.
   *
   * It used to render from `blockedBecause` directly, which meant "Deal them
   * all out first." was on screen before the child had touched anything — a
   * telling-off for not yet having started. A refusal is an answer to a move,
   * so it waits for the move.
   */
  const [refused, setRefused] = useState<TrayBlock>(null);
  useEffect(() => {
    if (!question) return;
    setPlates(shape.plates !== undefined ? Array(shape.plates).fill(0) : []);
    setLeftover(0);
    setRefused(null);
  }, [question, shape.plates]);

  if (!question) return null;

  const dealt = plates.reduce((sum, n) => sum + n, 0);
  const pile = question.dividend - dealt - leftover;
  const block = blockedBecause(question, plates, leftover);
  const dealing = shape.plates !== undefined || shape.capacity !== undefined;

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };

  const tap = (): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
  };

  /** Move one counter from the pile onto plate `i`. */
  const addTo = (i: number): void => {
    if (pile <= 0) return;
    if (shape.capacity !== undefined && plates[i] >= shape.capacity) return;
    tap();
    setRefused(null);
    setPlates((current) => current.map((n, j) => (j === i ? n + 1 : n)));
  };

  /** Take one counter back off plate `i`. */
  const takeFrom = (i: number): void => {
    if ((plates[i] ?? 0) <= 0) return;
    tap();
    setRefused(null);
    setPlates((current) => current.map((n, j) => (j === i ? n - 1 : n)));
  };

  /** Start a new, empty group. Only the grouping mode has this. */
  const addPlate = (): void => {
    if (shape.capacity === undefined) return;
    tap();
    setRefused(null);
    setPlates((current) => [...current, 0]);
  };

  /** Move one counter from the pile into the leftover box. */
  const addLeftover = (): void => {
    if (pile <= 0) return;
    tap();
    setRefused(null);
    setLeftover((n) => n + 1);
  };

  /** Take one back out of the leftover box. */
  const takeLeftover = (): void => {
    if (leftover <= 0) return;
    tap();
    setRefused(null);
    setLeftover((n) => n - 1);
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given,
      expected: question.expected,
      title: correct ? "Yes!" : "Not yet",
      message,
    });
  };

  /** A dealing mode's numeric answer. Refused, not marked, while the tray is unfinished. */
  const answerWith = (value: number): void => {
    if (dealing && block) {
      setRefused(block);
      say(REFUSALS[block]);
      return;
    }
    /*
     * No number is right for `n / 0`.
     *
     * `answer` is 0 on that question for the sake of the type, and a child who
     * picks 0 has made the commonest wrong move there is — "nought, because
     * there is nothing to put them in" — not found the answer. Scoring it right
     * would teach the misconception the level exists to remove.
     */
    const correct = question.impossible ? false : value === question.answer;
    submit(
      String(value),
      correct,
      correct
        ? question.unknown === "size"
          ? `Each one has ${question.quotient}.`
          : `You made ${question.quotient} groups.`
        : question.impossible
          ? "Zero plates is not somewhere to put them. Look again at the question."
          : "Count again, carefully.",
    );
  };

  const answerMeaning = (value: "size" | "count"): void => {
    const correct = value === question.unknown;
    submit(
      value,
      correct,
      correct
        ? "Yes — that is the part the question leaves out."
        : "Look at what the sentence already tells you.",
    );
  };

  /** The one question with no answer. Getting it right means saying so. */
  const answerCannot = (): void => {
    const correct = question.impossible === true;
    submit(
      "cannot",
      correct,
      correct
        ? "Right. There is nowhere to put them, so there is no answer."
        : "There are plates here. It can be done — work it out.",
    );
  };

  const answerEquation = (value: string): void => {
    const correct = value === question.expected;
    submit(value, correct, correct ? "That is the sentence." : "Which number did you start with?");
  };

  const choices = useMemo(
    // Zero is an answer at level 7 and nowhere else, so it is offered only when
    // it is the truth. Everywhere else a zero option is noise, not a misconception.
    () => answerChoices(question.answer, question.id, { min: Math.min(1, question.answer) }),
    [question.answer, question.id],
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Share It Out"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : trayHints(question)}
      onStartOver={
        !round.feedback && (plates.some((n) => n > 0) || leftover > 0)
          ? () => {
              setPlates(shape.plates !== undefined ? Array(shape.plates).fill(0) : []);
              setLeftover(0);
              setRefused(null);
            }
          : undefined
      }
      iconName="Divide"
      iconTone="indigo"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              say(question.story ? `${question.story.text} ${promptFor(question)}` : promptFor(question));
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {question.story ? (
          /* Bordered and left-aligned, deliberately unlike the option buttons
             below it: as a centred card on the same surface it read as a fifth
             thing to tap, and on `to_equation` it sat directly above four
             things that were. */
          <p className="border-l-4 border-indigo-400/60 px-4 py-1 text-left text-base leading-relaxed text-ink">
            {question.story.text}
          </p>
        ) : null}

        {dealing ? (
          <>
            {/* The pile. Everything starts here and the question is not
                answerable until it is empty. */}
            <div
              data-testid="pile"
              aria-label={`${pile} left to deal`}
              className="flex min-h-12 flex-wrap items-center justify-center gap-1 rounded-2xl bg-surface p-2"
            >
              {Array.from({ length: pile }, (_, i) => (
                <Counter key={i} tone={question.tone} small={small} />
              ))}
              {pile === 0 ? (
                <span className="text-sm text-muted">The pile is empty.</span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-start justify-center gap-2">
              {plates.map((count, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => addTo(i)}
                    disabled={!!round.feedback}
                    aria-label={`Group ${i + 1}, holding ${count}. Add one.`}
                    className="flex min-h-16 min-w-16 max-w-24 flex-wrap content-start items-start justify-center gap-1 rounded-2xl border-2 border-dashed border-line/40 bg-surface p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    {Array.from({ length: count }, (_, j) => (
                      <Counter key={j} tone={question.tone} small={small} />
                    ))}
                  </button>
                  {badgesEnabled ? (
                    <span className="text-xs font-semibold text-muted">{count}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => takeFrom(i)}
                    disabled={count === 0 || !!round.feedback}
                    aria-label={`Take one back from group ${i + 1}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-muted disabled:opacity-30"
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}

              {shape.capacity !== undefined ? (
                <button
                  type="button"
                  onClick={addPlate}
                  disabled={pile <= 0 || !!round.feedback}
                  aria-label="Start a new group"
                  className="min-h-16 min-w-16 rounded-2xl border-2 border-dashed border-indigo-400 text-3xl text-indigo-500 disabled:opacity-30"
                >
                  +
                </button>
              ) : null}
            </div>

            {shape.leftoverBin ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={addLeftover}
                  disabled={pile <= 0 || !!round.feedback}
                  aria-label={`Leftover box, holding ${leftover}. Put one in.`}
                  className="flex min-h-12 w-full max-w-xs flex-wrap items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-rose-400/70 bg-surface p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-60"
                >
                  {Array.from({ length: leftover }, (_, j) => (
                    <Counter key={j} tone={question.tone} small={small} />
                  ))}
                  {leftover === 0 ? (
                    <span className="text-sm text-muted">Left over</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={takeLeftover}
                  disabled={leftover === 0 || !!round.feedback}
                  aria-label="Take one back out of the leftover box"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-muted disabled:opacity-30"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {refused ? (
              <p role="status" className="text-center text-sm text-muted">
                {REFUSALS[refused]}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-center gap-3">
              {choices.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => answerWith(value)}
                  disabled={!!round.feedback}
                  className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {value}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {question.impossible ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-muted">There are no plates.</p>
            <div className="flex flex-wrap justify-center gap-3">
              {choices.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => answerWith(value)}
                  disabled={!!round.feedback}
                  className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {value}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={answerCannot}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              This cannot be done
            </button>
          </div>
        ) : null}

        {question.mode === "which_meaning" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => answerMeaning("size")}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              How many go in each one?
            </button>
            <button
              type="button"
              onClick={() => answerMeaning("count")}
              disabled={!!round.feedback}
              className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-base font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              How many groups are there?
            </button>
          </div>
        ) : null}

        {question.mode === "to_equation" ? (
          <div className="flex flex-col gap-3">
            {(question.equations ?? []).map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => answerEquation(text)}
                disabled={!!round.feedback}
                className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {text}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The tray, drawn empty.
 *
 * A dealing question printed as its caption alone — "Share them all out" beside
 * a blank line — is not a worksheet, which is why this engine reported itself
 * unprintable for a whole release. What it needs is the *apparatus*: the
 * counters to be shared, and the plates to share them onto, with nothing in them.
 * The child does on paper exactly what they do on screen, and the sheet is the
 * same lesson rather than a summary of it.
 */
export function printedFor(question: ShareQuestion): { text: string; answer: string } | null {
  if (question.impossible) {
    return { text: `Can ${question.dividend} be shared between 0 plates?`, answer: "No — there is nowhere to put them." };
  }
  switch (question.mode) {
    case "which_meaning":
      return {
        text: `${question.story?.text ?? ""} What is the question asking for?   how many in each / how many groups`,
        answer: question.unknown === "size" ? "how many in each" : "how many groups",
      };
    case "to_equation":
      return {
        text: `${question.story?.text ?? ""} Write the division sentence.`,
        answer: question.expected,
      };
    case "group_by_size":
      return {
        text: `Ring groups of ${question.divisor}. How many groups?`,
        answer: String(question.quotient),
      };
    case "see_leftover":
      return {
        text: `Share these between ${question.divisor} plates. How many each, and how many left over?`,
        answer: `${question.quotient} each, ${question.remainder} left over`,
      };
    default:
      return {
        text: `Share these between ${question.divisor} plates. How many on each?`,
        answer: String(question.quotient),
      };
  }
}

/** Counters in rows of ten, so a child can count them without losing their place. */
const countersFigure = (total: number, y: number): React.ReactNode[] => {
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < total; i += 1) {
    dots.push(
      <circle
        key={i}
        cx={10 + (i % 10) * 20}
        cy={y + Math.floor(i / 10) * 20}
        r={6}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />,
    );
  }
  return dots;
};

export const figureFor = (question: ShareQuestion): React.ReactNode | null => {
  // These two are complete in words; a picture would only restate the sentence.
  if (question.mode === "which_meaning" || question.mode === "to_equation") return null;
  if (question.impossible) return null;

  const rows = Math.ceil(question.dividend / 10);
  const pileHeight = Math.max(1, rows) * 20;
  const plates = question.mode === "group_by_size" ? 0 : question.divisor;
  const plateY = pileHeight + 16;
  const plateW = Math.min(70, Math.floor(200 / Math.max(1, plates)) - 6);
  const height = plateY + (plates > 0 ? 54 : 0) + (question.mode === "see_leftover" ? 44 : 0);

  return (
    <svg
      viewBox={`0 0 220 ${height}`}
      width={220}
      height={height}
      role="img"
      aria-label={`${question.dividend} counters${plates ? ` and ${plates} empty plates` : ""}`}
      className="text-slate-900"
    >
      {countersFigure(question.dividend, 10)}
      {Array.from({ length: plates }, (_, i) => (
        <rect
          key={i}
          x={4 + i * (plateW + 6)}
          y={plateY}
          width={plateW}
          height={46}
          rx={8}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      ))}
      {question.mode === "see_leftover" ? (
        <>
          <rect
            x={4}
            y={plateY + 54}
            width={140}
            height={34}
            rx={8}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
          <text x={12} y={plateY + 75} fontSize="11" fill="currentColor">
            left over
          </text>
        </>
      ) : null}
    </svg>
  );
};

export function methodFor(question: ShareQuestion): string[] {
  switch (question.mode) {
    case "group_by_size":
      return [
        "Ring the same number of them at a time, as the question says.",
        "Keep going while there are enough left for a whole ring.",
        "Count the rings, not the counters.",
      ];
    case "see_leftover":
      return [
        "Give one to each plate, then go round again.",
        "Stop when there are not enough left to give one to every plate.",
        "What is left over is not on a plate. Write it separately.",
      ];
    default:
      return [
        "Give one to each plate, then start again at the first.",
        "Keep going until they are all shared out.",
        "Count what is on one plate.",
      ];
  }
}
