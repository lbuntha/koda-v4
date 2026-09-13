import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import { SkillRound, composeHints, isPractice, modeAt, useSkillRound } from "../../kit";
import {
  buildFactQuestion,
  type FactMode,
  type FactQuestion,
  type FactSetup,
} from "../internal/data/divisionFacts";

/**
 * The fact deck — division answered from a multiplication already known.
 *
 * A card carries the division; a helper carries the multiplication that answers
 * it. Seven techniques, one idea: a child who cannot recall `56 ÷ 7` almost
 * always *can* recall `7 × 8`, and the whole of this engine is teaching them
 * that those are the same piece of knowledge asked from opposite ends.
 *
 * The helper is written as a question — `7 × ? = 56` — and never as its own
 * answer. A helper card reading `7 × 8 = 56` beside `56 ÷ 7 = ?` is not a
 * scaffold, it is the answer with an extra step.
 */

interface FactParams {
  question?: FactSetup;
  mode?: FactMode;
  questionsPerRound?: number;
}

export function buildQuestion(params: FactParams, index: number, seen?: Set<string>): FactQuestion {
  const setup: FactSetup = { ...params, ...params.question };
  const mode = modeAt<FactMode>(setup, index + 1, "easy_divisors");
  return buildFactQuestion(setup, mode, index, seen);
}

export const promptFor = (question: FactQuestion): string => question.prompt;

export function factHints(question: FactQuestion): string[] {
  const { divisor, dividend, quotient } = question;
  switch (question.mode) {
    case "family":
      return composeHints(
        "Three numbers make four true sentences — two multiplications and two divisions.",
        `The big number, ${dividend}, is on its own in the multiplications and at the front in the divisions.`,
      );
    case "table_divide":
      return composeHints(
        `Run along the ${divisor} row until you find ${dividend}.`,
        "The column it is sitting in is the answer.",
      );
    case "missing_factor":
      return composeHints(
        "The two questions on the card are the same question.",
        `Whatever fills the gap in ${divisor} × ? = ${dividend} is the answer to the division.`,
      );
    case "repeated_halving":
      return composeHints(
        divisor === 4 ? "Dividing by 4 is halving twice." : "Dividing by 8 is halving three times.",
        "Do one halving at a time and write down what you get.",
      );
    case "known_fact":
      return composeHints(
        "Which multiplication would give you this total?",
        `You want one whose answer is ${dividend}, with a ${divisor} in it.`,
      );
    default:
      /*
       * The third rung used to read "it takes more than six 5s to get there",
       * which is true, vague, and occasionally trivial — for 6 ÷ 3 it said
       * "fewer than six 3s", which rules out almost nothing. Bracketing against
       * ten is the nudge a child can actually use: ten of anything is the one
       * multiple they never have to work out.
       */
      return composeHints(
        `Ask yourself: ${divisor} times what makes ${dividend}?`,
        `Count up in ${divisor}s if you need to. You want to land on ${dividend}.`,
        `Ten ${divisor}s is ${divisor * 10}, which is ${divisor * 10 > dividend ? "past" : "not yet at"} ${dividend} — so the answer is ${divisor * 10 > dividend ? "less" : "more"} than ten.`,
      );
  }
}

export const FactDeck: React.FC<ActivityProps<FactParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup: FactSetup = useMemo(() => ({ ...params, ...params.question }), [params]);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const scaffoldEnabled = koda.config.isEnabled("inverse_scaffold", true);

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
    nextQuestion: useCallback((index: number) => buildQuestion(params, index - 1, seen), [params, seen]),
    onComplete,
  });
  const question = round.question as FactQuestion;

  /** Equations ticked, for `family`. */
  const [ticked, setTicked] = useState<string[]>([]);
  /** The helper the child chose, for `known_fact`. */
  const [helper, setHelper] = useState<string | null>(null);
  /** The table cell they found, for `table_divide`. */
  const [found, setFound] = useState<number | null>(null);

  useEffect(() => {
    if (!question) return;
    setTicked([]);
    setHelper(null);
    setFound(null);
  }, [question]);

  if (!question) return null;

  const chime = (correct: boolean): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    chime(correct);
    round.submit({ correct, given, expected: question.expected, title: correct ? "Yes!" : "Not yet", message });
  };

  const answerWith = (value: number): void => {
    const correct = value === question.answer;
    submit(
      String(value),
      correct,
      correct
        ? `${question.divisor} × ${question.quotient} = ${question.dividend}, so that is right.`
        : `Try counting up in ${question.divisor}s.`,
    );
  };

  const toggle = (text: string): void => {
    setTicked((current) =>
      current.includes(text) ? current.filter((t) => t !== text) : [...current, text],
    );
  };

  const submitFamily = (): void => {
    const wanted = question.trueEquations ?? [];
    const correct = wanted.length === ticked.length && wanted.every((t) => ticked.includes(t));
    submit(
      ticked.join(" | "),
      correct,
      correct ? "All four, and only those four." : "There are exactly four true ones. Check each again.",
    );
  };

  const chooseHelper = (text: string): void => {
    const right = text === question.helperAnswer;
    if (!right) {
      chime(false);
      round.useSupport("hint");
      return;
    }
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
    setHelper(text);
  };

  const tapCell = (index: number): void => {
    const value = (question.row ?? [])[index];
    setFound(value);
    if (value !== question.dividend) {
      chime(false);
      return;
    }
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("clink");
  };

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle="Facts You Know"
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : factHints(question)}
      onStartOver={
        !round.feedback && (ticked.length > 0 || found !== null)
          ? () => {
              setTicked([]);
              setHelper(null);
              setFound(null);
            }
          : undefined
      }
      iconName="Layers"
      iconTone="purple"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {question.mode === "family" ? (
          <>
            <div className="flex flex-col gap-2">
              {(question.equations ?? []).map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => toggle(text)}
                  disabled={!!round.feedback}
                  aria-pressed={ticked.includes(text)}
                  className={`min-h-11 rounded-2xl px-4 py-3 text-center text-base font-semibold shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    ticked.includes(text) ? "bg-violet-500 text-white" : "bg-surface text-ink"
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={submitFamily}
              disabled={ticked.length === 0 || !!round.feedback}
              className="min-h-11 rounded-2xl bg-violet-600 px-5 py-3 text-base font-bold text-white shadow-sm disabled:opacity-40"
            >
              Check these {ticked.length === 0 ? "" : `(${ticked.length})`}
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-3xl font-bold tracking-wide text-ink">
              {question.dividend} ÷ {question.divisor}
            </p>

            {question.mode === "table_divide" ? (
              <div className="flex flex-col gap-1 overflow-x-auto rounded-2xl bg-surface p-3">
                <div className="flex gap-1">
                  {(question.row ?? []).map((_, i) => (
                    <span key={i} className="min-w-10 text-center text-xs text-muted">
                      {i + 1}
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  {(question.row ?? []).map((value, i) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => tapCell(i)}
                      disabled={!!round.feedback}
                      aria-label={`Column ${i + 1}, holding ${value}`}
                      className={`min-h-11 min-w-10 rounded-lg px-1 text-sm font-semibold shadow-sm ${
                        found === value && value === question.dividend
                          ? "bg-emerald-500 text-white"
                          : "bg-surface-muted text-ink"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {scaffoldEnabled && !practising && question.mode !== "table_divide" ? (
              <p className="rounded-2xl border border-violet-400/40 px-4 py-2 text-center text-base text-muted">
                {question.helper}
              </p>
            ) : null}

            {question.chain && helper === null && scaffoldEnabled && !practising ? (
              <div className="flex flex-col items-center gap-1 text-sm text-muted">
                {question.chain.map((line, i) => (
                  <span key={line}>
                    {i + 1}. {line.split(" = ")[0]} = ?
                  </span>
                ))}
              </div>
            ) : null}

            {question.helperChoices ? (
              <div className="flex flex-col gap-2">
                <p className="text-center text-sm text-muted">
                  {helper ? "Now use it." : "Which fact would help?"}
                </p>
                {question.helperChoices.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => chooseHelper(text)}
                    disabled={helper !== null || !!round.feedback}
                    className={`min-h-11 rounded-2xl px-4 py-2 text-center text-base font-semibold shadow-sm ${
                      helper === text ? "bg-emerald-500 text-white" : "bg-surface text-ink"
                    } disabled:opacity-60`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-center gap-3">
              {question.choices.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => answerWith(value)}
                  disabled={!!round.feedback || (question.helperChoices !== undefined && helper === null)}
                  className="min-h-11 min-w-11 rounded-2xl bg-surface px-5 py-3 text-lg font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-30"
                >
                  {value}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The fact deck prints, because its questions are already written ones.
 *
 * `family` and `table_divide` do not: one needs seven tick-boxes and the other a
 * grid, and both would print as a caption beside an empty space. They fall back
 * to `prompt`, which states the whole question, and the sheet is honest about
 * what it is asking.
 */
export function printedFor(question: FactQuestion): { text: string; answer: string } | null {
  /*
   * These two used to report themselves unprintable, and both were wrong about
   * it. "Write the four facts" is a better question on paper than on screen —
   * four blank lines instead of seven tick boxes — and the table row prints as
   * a figure. A lesson that cannot print is a real answer; a lesson that has
   * not been thought about is not.
   */
  if (question.mode === "family") {
    return {
      text: `Write the four facts that use ${question.divisor}, ${question.quotient} and ${question.dividend}.`,
      answer: (question.trueEquations ?? []).join(",  "),
    };
  }
  if (question.mode === "table_divide") {
    return {
      text: `Find ${question.dividend} in the ${question.divisor} times table. Which column is it in?`,
      answer: String(question.quotient),
    };
  }
  return { text: `${question.dividend} ÷ ${question.divisor} =`, answer: String(question.quotient) };
}

/** Only the table lesson draws anything; the rest are written questions. */
export const figureFor = (question: FactQuestion): React.ReactNode | null => {
  if (question.mode !== "table_divide" || !question.row) return null;
  const cell = 26;
  const w = question.row.length * cell + 8;
  return (
    <svg
      viewBox={`0 0 ${w} 44`}
      width={w}
      height={44}
      role="img"
      aria-label={`The ${question.divisor} times table row`}
      className="text-slate-900"
    >
      {question.row.map((value, i) => (
        <g key={value}>
          <text x={4 + i * cell + cell / 2} y={12} fontSize="8" textAnchor="middle" fill="currentColor">
            {i + 1}
          </text>
          <rect
            x={4 + i * cell}
            y={16}
            width={cell - 3}
            height={20}
            rx={3}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <text x={4 + i * cell + (cell - 3) / 2} y={30} fontSize="10" textAnchor="middle" fill="currentColor">
            {value}
          </text>
        </g>
      ))}
    </svg>
  );
};

export function methodFor(question: FactQuestion): string[] {
  if (question.mode === "family") {
    return [
      "The biggest of the three numbers is the total.",
      "The other two multiply to make it, in either order.",
      "The total divided by one of them gives the other.",
    ];
  }
  if (question.mode === "table_divide") {
    return ["Run along the row until you find the total.", "Read the column number above it."];
  }
  return question.mode === "repeated_halving"
    ? ["Halve the number.", "Halve it again — and once more if you are dividing by 8."]
    : [
        "Ask what the number you are dividing by, times something, makes the total.",
        "The number that fills that gap is the answer.",
      ];
}
