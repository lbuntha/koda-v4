import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { ActivityProps } from "../../types";
import {
  SkillRound,
  answerChoices,
  composeHints,
  guideSetup,
  isPractice,
  modeAt,
  openWith,
  playCopy,
  useGuide,
  useSkillRound,
} from "../../kit";
import {
  ARRAY_REFUSALS,
  arrayBlockedBecause,
  buildArrayQuestion,
  rowsOf,
  type ArrayBlock,
  type ArrayMode,
  type ArrayQuestion,
  type ArraySetup,
} from "../internal/data/divisionArray";
import { TONE_CLASS } from "../internal/data/divisionTray";
import { td } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

/**
 * The array, read as a division.
 *
 * Multiplication builds an array from two sides and asks for the total. This
 * starts from the total and asks for a side, which is the same picture answering
 * the opposite question — and the reason a child who can multiply confidently
 * can still be stuck on division. The grid has to be *made* before it will take
 * an answer: reading a side off a shape you built is the technique, and
 * answering from the prompt alone bypasses it.
 *
 *   total_and_side   the row count is given; find the width of a row
 *   two_divisions    one array, both of the sentences it shows
 *   partial_row      rows of a fixed width; the short last row is the remainder
 */

interface ArrayParams {
  question?: ArraySetup;
  mode?: ArrayMode;
  questionsPerRound?: number;
}

export function buildQuestion(
  params: ArrayParams,
  index: number,
  seen?: Set<string>,
): ArrayQuestion {
  const setup: ArraySetup = { ...params, ...params.question };
  const mode = modeAt<ArrayMode>(setup, index + 1, "total_and_side");
  return buildArrayQuestion(setup, mode, index, seen);
}

export const promptFor = (question: ArrayQuestion): string => question.prompt;

/**
 * The ladder, opening with the lesson's own words.
 *
 * All fifty-six division lessons author a `kidTip` and, until this, not one
 * was read: these ladders took the question and nothing else. `openWith`
 * puts it back as rung one without costing the worked step — see the kit.
 */
export function arrayHints(question: ArrayQuestion, kidTip?: string): string[] {
  return openWith(kidTip, arrayHintsRungs(question));
}

function arrayHintsRungs(question: ArrayQuestion): string[] {
  switch (question.mode) {
    case "total_and_side":
      return composeHints(
        td("array.hint.side1", { d: question.divisor }),
        td("array.hint.side2"),
        td("array.hint.side3"),
      );
    case "two_divisions":
      return composeHints(
        td("array.hint.pair1"),
        td("array.hint.pair2"),
        td("array.hint.pair3"),
      );
    case "partial_row":
      return composeHints(
        td("array.hint.partial1", { d: question.divisor }),
        td("array.onlyFull"),
        td("array.hint.partial3"),
      );
    default:
      return composeHints(td("array.hint.look"));
  }
}

export const ArrayDivide: React.FC<ActivityProps<ArrayParams>> = ({
  params,
  koda,
  onComplete,
  lesson,
}) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: ArraySetup = useMemo(() => ({ ...params, ...params.question }), [params]);
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
    nextQuestion: useCallback(
      (index: number) => buildQuestion(params, index - 1, seen),
      [params, seen],
    ),
    onComplete,
  });
  const question = round.question as ArrayQuestion;

  /** Rows the child has made, and how many counters they have placed. */
  const [rows, setRows] = useState(0);
  const [placed, setPlaced] = useState(0);
  const [refused, setRefused] = useState<ArrayBlock>(null);

  useEffect(() => {
    if (!question) return;
    setRows(0);
    setPlaced(0);
    setRefused(null);
  }, [question]);

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const copy = playCopy(params);
  const hints = practising ? [] : arrayHints(question, copy.kidTip);
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: question.id,
    rungs: hints,
    target: -1,
    progress: 0,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  if (!question) return null;

  const fixedWidth = question.rowWidth !== undefined;
  const block = arrayBlockedBecause(question, rows, placed);
  const small = question.dividend > 40;

  /*
   * Where every placed counter sits.
   *
   * With a fixed row width the rows are as long as they are allowed to be and
   * the last one is short — that short row is the remainder, and it is the whole
   * picture level 11 is made of. With a fixed row *count*, the counters are
   * shared out between the rows the way they were shared between plates at
   * level 1, so an uneven total shows up as rows of different lengths.
   */
  const layout: number[] = fixedWidth
    ? rowsOf(placed, question.rowWidth as number)
    : Array.from({ length: rows }, (_, i) => Math.floor(placed / rows) + (i < placed % rows ? 1 : 0));

  const say = (text: string): void => {
    if (!speechEnabled) return;
    void koda.speech.say(text, { rate: koda.config.get("speechRate", 1) });
  };
  const tap = (): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
    if (koda.config.isEnabled("haptic_feedback", true)) koda.haptics.pulse("light");
  };

  const addRow = (): void => {
    tap();
    setRefused(null);
    setRows((n) => n + 1);
  };
  const removeRow = (): void => {
    if (rows <= 0) return;
    tap();
    setRefused(null);
    setRows((n) => n - 1);
    setPlaced((n) => Math.min(n, question.dividend));
  };
  const place = (): void => {
    if (placed >= question.dividend) return;
    if (!fixedWidth && rows === 0) {
      guide.stumbled();
      setRefused("wrong-row-count");
      say(ARRAY_REFUSALS["wrong-row-count"]);
      return;
    }
    tap();
    setRefused(null);
    setPlaced((n) => n + 1);
  };
  const placeAll = (): void => {
    if (!fixedWidth && rows === 0) {
      guide.stumbled();
      setRefused("wrong-row-count");
      say(ARRAY_REFUSALS["wrong-row-count"]);
      return;
    }
    tap();
    setRefused(null);
    setPlaced(question.dividend);
  };

  const submit = (given: string, correct: boolean, message: string): void => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (koda.config.isEnabled("haptic_feedback", true)) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({ correct, given, expected: question.expected, title: correct ? td("yes") : td("notYet"), message });
  };

  const answerWith = (value: number): void => {
    if (block) {
      guide.stumbled();
      setRefused(block);
      say(ARRAY_REFUSALS[block]);
      return;
    }
    const correct = value === question.answer;
    submit(
      String(value),
      correct,
      correct
        ? question.mode === "partial_row"
          ? td("array.fullRows", { q: question.quotient, r: question.remainder })
          : td("array.eachRow", { q: question.quotient })
        : td("array.countAgain"),
    );
  };

  const answerPair = (value: string): void => {
    const correct = value === question.expected;
    submit(value, correct, correct ? td("array.bothTrue") : td("array.secondHalf"));
  };

  const choices = useMemo(
    () => answerChoices(question.answer, question.id, { min: 1 }),
    [question.answer, question.id],
  );

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={td("array.title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={hints}
      guide={practising ? undefined : guide}
      guideMethod={copy.stepByStep}
      iconName="Grid3x3"
      iconTone="indigo"
      onReadAloud={
        practising || !speechEnabled
          ? undefined
          : () => {
              round.useSupport("audio_replay");
              say(promptFor(question));
            }
      }
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {question.mode === "two_divisions" ? (
          <>
            <div
              data-testid="array"
              aria-label={td("array.rowsOfLabel", { d: question.divisor, q: question.quotient })}
              className="mx-auto flex flex-col items-center gap-1 rounded-2xl bg-surface p-3"
            >
              {Array.from({ length: question.divisor }, (_, r) => (
                <div key={r} className="flex gap-1">
                  {Array.from({ length: question.quotient }, (_, c) => (
                    <span key={c} className={`h-4 w-4 rounded ${TONE_CLASS[question.tone]}`} />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {(question.pairs ?? []).map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => answerPair(text)}
                  disabled={!!round.feedback}
                  className="min-h-11 rounded-2xl bg-surface px-4 py-3 text-center text-sm font-semibold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {text}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-muted">
              {td("array.stillToPlace", { left: question.dividend - placed })}
              {fixedWidth ? null : ` · ${td("array.rows", { count: rows })}`}
            </p>

            <div
              data-testid="array"
              aria-label={td("array.arrayLabel", { rows, placed })}
              className="mx-auto flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-surface p-3"
            >
              {layout.map((count, r) => (
                <div key={r} className="flex items-center gap-1">
                  {Array.from({ length: count }, (_, c) => (
                    <span
                      key={c}
                      className={`rounded ${small ? "h-3 w-3" : "h-4 w-4"} ${TONE_CLASS[question.tone]}`}
                    />
                  ))}
                  {badgesEnabled && count > 0 ? (
                    <span className="pl-2 text-xs text-muted">{count}</span>
                  ) : null}
                </div>
              ))}
              {layout.length === 0 ? (
                <span className="text-sm text-muted">{td("array.nothingPlaced")}</span>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {fixedWidth ? null : (
                <>
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={!!round.feedback}
                    aria-label={td("array.addRow")}
                    className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm"
                  >
                    {td("array.plusRow")}
                  </button>
                  <button
                    type="button"
                    onClick={removeRow}
                    disabled={rows === 0 || !!round.feedback}
                    aria-label={td("array.removeRow")}
                    className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-30"
                  >
                    {td("array.minusRow")}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={place}
                disabled={placed >= question.dividend || !!round.feedback}
                aria-label={td("array.placeOne")}
                className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-30"
              >
                {td("array.placeOne")}
              </button>
              <button
                type="button"
                onClick={placeAll}
                disabled={placed >= question.dividend || !!round.feedback}
                aria-label={td("array.placeRest")}
                className="min-h-11 rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-30"
              >
                {td("array.placeRest")}
              </button>
            </div>

            {refused ? (
              <p role="status" className="text-center text-sm text-muted">
                {ARRAY_REFUSALS[refused]}
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
        )}
      </div>
    </SkillRound>
  );
};

/* -------------------------------------------------------------------------- */
/* On paper                                                                    */
/* -------------------------------------------------------------------------- */

export function printedFor(question: ArrayQuestion): { text: string; answer: string } | null {
  switch (question.mode) {
    case "two_divisions":
      return {
        text: td("array.printed.pair", { d: question.divisor, q: question.quotient }),
        answer: `${question.dividend} ÷ ${question.divisor} = ${question.quotient} ${td("array.and")} ${question.dividend} ÷ ${question.quotient} = ${question.divisor}`,
      };
    case "partial_row":
      return {
        text: td("array.printed.partial", { n: question.dividend, d: question.divisor }),
        answer: td("array.printed.partialAnswer", { q: question.quotient, r: question.remainder }),
      };
    default:
      return {
        text: td("array.prompt.total_and_side", { n: question.dividend, d: question.divisor }),
        answer: String(question.quotient),
      };
  }
}

/**
 * The grid, drawn empty — except where the question is to *read* one.
 *
 * `two_divisions` prints the array filled, because there the array is given and
 * the sentences are the work. The other two print loose counters and an empty
 * frame, because there the arranging is the work and a filled grid would do it
 * for them.
 */
export const figureFor = (question: ArrayQuestion): React.ReactNode | null => {
  if (question.mode === "two_divisions") {
    const cell = 14;
    const w = question.quotient * cell + 8;
    const h = question.divisor * cell + 8;
    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        role="img"
        aria-label={td("array.rowsOfLabel", { d: question.divisor, q: question.quotient })}
        className="text-slate-900"
      >
        {Array.from({ length: question.divisor }, (_, r) =>
          Array.from({ length: question.quotient }, (_, c) => (
            <rect
              key={`${r}-${c}`}
              x={4 + c * cell}
              y={4 + r * cell}
              width={cell - 3}
              height={cell - 3}
              rx={2}
              fill="currentColor"
              opacity={0.75}
            />
          )),
        )}
      </svg>
    );
  }

  const perRow = 10;
  const rows = Math.ceil(question.dividend / perRow);
  const pile = rows * 18;
  const height = pile + 74;
  return (
    <svg
      viewBox={`0 0 220 ${height}`}
      width={220}
      height={height}
      role="img"
      aria-label={td("array.countersLabel", { n: question.dividend })}
      className="text-slate-900"
    >
      {Array.from({ length: question.dividend }, (_, i) => (
        <rect
          key={i}
          x={6 + (i % perRow) * 18}
          y={6 + Math.floor(i / perRow) * 18}
          width={12}
          height={12}
          rx={2}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      ))}
      <rect
        x={6}
        y={pile + 16}
        width={200}
        height={50}
        rx={6}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="5 4"
      />
      <text x={12} y={pile + 36} fontSize="10" fill="currentColor">
        {question.mode === "partial_row"
          ? td("array.rowsOf", { d: question.divisor })
          : td("array.equalRows", { d: question.divisor })}
      </text>
    </svg>
  );
};

export function methodFor(question: ArrayQuestion): string[] {
  return question.mode === "partial_row"
    ? [
        td("array.method.partial1"),
        td("array.onlyFull"),
        td("array.method.partial3"),
      ]
    : [
        td("array.method.side1"),
        td("array.method.side2"),
        td("array.method.side3"),
      ];
}
