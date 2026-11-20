import React, { useCallback, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, isPractice, openWith, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { useT } from "../../../lib/i18n";
import {
  OP_SYMBOL,
  fill,
  generatePuzzle,
  isSolved,
  lineCells,
  lines,
  linesOf,
  type CrossSpec,
  type Line,
  type Op,
  type Puzzle,
  type Slot,
} from "../internal/grid";
import { tx } from "../internal/i18n";

/**
 * Cross Math: a grid of sums that share their numbers. The child places number
 * tiles (and, in later lessons, chooses signs) until every row and column is
 * true.
 *
 * One engine for every lesson. Lessons differ only in their spec — size, signs,
 * range, how many boxes are hidden — so nothing here branches on a level.
 */

export interface CrossMathParams extends CrossSpec {
  question?: CrossSpec & { questionsPerRound?: number; practice?: boolean; seed?: string };
  questionsPerRound?: number;
  seed?: string;
}

export interface CrossQuestion extends RoundQuestion {
  puzzle: Puzzle;
}

type Setup = CrossSpec & { questionsPerRound?: number; practice?: boolean; seed?: string };
const setupOf = (params: CrossMathParams): Setup => ({ ...params, ...params.question });

export function promptFor(question: CrossQuestion): string {
  const { slots } = question.puzzle;
  const numbers = slots.some((s) => s.kind === "num");
  const signs = slots.some((s) => s.kind === "op");
  return tx(numbers && signs ? "prompt.both" : signs ? "prompt.signs" : "prompt.numbers");
}

/**
 * Pure: the same params, index and seed always give the same puzzle. The
 * activity changes the seed for each play, so a lesson is new every time.
 */
export function buildQuestion(params: CrossMathParams, index: number, seed = "cross-math"): CrossQuestion {
  const setup = setupOf(params);
  const puzzle = generatePuzzle(setup, `${setup.seed ?? seed}:${index}`);
  const question: CrossQuestion = {
    id: `cross-${seed}-${index}`,
    taskKind: puzzle.slots.some((s) => s.kind === "op") ? "cross_math_signs" : "cross_math_numbers",
    prompt: "",
    expected: puzzle.answers.join(","),
    itemCount: puzzle.slots.length,
    puzzle,
  };
  question.prompt = promptFor(question);
  return question;
}

/* ---------- words ---------- */

export const lineName = (line: Line): string =>
  tx(line.kind === "row" ? "line.row" : "line.col", { n: String(line.index + 1) });

export function slotWhere(slot: Slot): string {
  if (slot.kind === "num") return tx("cell.number", { row: String(slot.r + 1), col: String(slot.c + 1) });
  return tx("cell.sign", { k: String(slot.k + 1), line: lineName({ kind: slot.line, index: slot.index }) });
}

/** "4 − ? = 2": a line as the child sees it, with its gaps as "?". */
export function equationText(p: Puzzle, values: (string | null)[], line: Line): string {
  const board = fill(p, values);
  const cells = lineCells(p, line).map(([r, c]) => board.nums[r][c]);
  const ops = (line.kind === "row" ? board.rowOps : board.colOps)[line.index];
  const parts: string[] = [];
  cells.slice(0, -1).forEach((v, i) => {
    parts.push(v === null ? "?" : String(v));
    if (i < ops.length) parts.push(ops[i] in OP_SYMBOL ? OP_SYMBOL[ops[i] as Op] : "?");
  });
  const result = cells[cells.length - 1];
  return `${parts.join(" ")} = ${result === null ? "?" : result}`;
}

/** The empty slots on a line. */
const gapsOn = (p: Puzzle, values: (string | null)[], line: Line): number[] =>
  p.slots.map((slot, i) => (values[i] === null && linesOf(p, slot).some((l) => l.kind === line.kind && l.index === line.index) ? i : -1))
    .filter((i) => i >= 0);

/**
 * Hints from the board as it stands, not as it started: the line with one gap
 * left is the place to start, and the worked rung shows that line as an
 * equation with its gap, so the child does the last step.
 */
export function crossHints(question: CrossQuestion, values: (string | null)[], kidTip?: string): string[] {
  const p = question.puzzle;
  const open = lines(p).map((line) => ({ line, gaps: gapsOn(p, values, line) })).filter((x) => x.gaps.length > 0);
  const single = open.find((x) => x.gaps.length === 1);
  const target = single ?? open.sort((a, b) => a.gaps.length - b.gaps.length)[0];
  if (!target) return openWith(kidTip, []);
  const name = lineName(target.line);
  const sign = p.slots[target.gaps[0]].kind === "op";
  return openWith(kidTip, [
    single ? tx("hint.oneGap", { line: name }) : tx("hint.findLine"),
    single
      ? tx(sign ? "hint.workedSign" : "hint.workedNumber", { line: name, equation: equationText(p, values, target.line) })
      : tx("hint.tryOne", { line: name.toLowerCase() }),
  ]);
}

/* ---------- layout ---------- */

/** Display position of a slot in the (2n+1)² grid of cells. */
const at = (slot: Slot): [number, number] =>
  slot.kind === "num"
    ? [slot.r * 2, slot.c * 2]
    : slot.line === "row"
      ? [slot.index * 2, slot.k * 2 + 1]
      : [slot.k * 2 + 1, slot.index * 2];

interface BoardState {
  qid: string;
  values: (string | null)[];
  tileOf: (number | null)[];
  marked: boolean[];
  selected: number;
}

const freshSeed = (): string => Math.random().toString(36).slice(2, 10);

export const CrossMath: React.FC<ActivityProps<CrossMathParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup = useMemo(() => setupOf(params), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);

  /* A new seed for every play. Question 1 asked for a second time is a replay
     (`restart`), so it gets fresh puzzles; StrictMode's double call of the
     same index gets the same one, because the seed has not moved. */
  const seed = useRef(freshSeed());
  const furthest = useRef(0);
  const nextQuestion = useCallback((index: number) => {
    if (index === 1 && furthest.current > 1) seed.current = freshSeed();
    furthest.current = Math.max(furthest.current, index);
    return buildQuestion(params, index, seed.current);
  }, [params]);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion,
    onComplete,
  });
  const question = round.question as CrossQuestion;
  const p = question.puzzle;

  /* The board's state carries the id of the question it belongs to. On the
     render where a new question arrives, a stale state would draw the last
     puzzle's tiles into this one's boxes; a fresh one is used instead. */
  const fresh = (): BoardState => ({
    qid: question.id,
    values: p.slots.map(() => null),
    tileOf: p.slots.map(() => null),
    marked: p.slots.map(() => false),
    selected: 0,
  });
  const [stored, setStored] = useState<BoardState>(fresh);
  const state = stored.qid === question.id ? stored : fresh();
  const { values, tileOf, marked, selected } = state;
  const update = (next: Partial<BoardState>) => setStored({ ...state, ...next });

  const locked = Boolean(round.feedback);
  const remaining = values.filter((v) => v === null).length;
  const usedTiles = new Set(tileOf.filter((t): t is number => t !== null));

  const tap = () => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
  };

  const nextEmpty = (vals: (string | null)[], kind: Slot["kind"], from: number): number => {
    for (let step = 0; step < vals.length; step += 1) {
      const i = (from + step) % vals.length;
      if (vals[i] === null && p.slots[i].kind === kind) return i;
    }
    return -1;
  };

  const place = (kind: Slot["kind"], value: string, tile: number | null) => {
    if (locked) return;
    const target = values[selected] === null && p.slots[selected]?.kind === kind ? selected : nextEmpty(values, kind, 0);
    if (target < 0) return;
    const vals = values.slice();
    vals[target] = value;
    const tiles = tileOf.slice();
    tiles[target] = tile;
    const after = vals.findIndex((v) => v === null);
    update({
      values: vals,
      tileOf: tiles,
      marked: marked.map((x, i) => (i === target ? false : x)),
      selected: after < 0 ? target : after,
    });
    tap();
  };

  const takeBack = (i: number) => {
    if (locked) return;
    if (values[i] === null) {
      update({ selected: i });
      return;
    }
    update({
      values: values.map((x, k) => (k === i ? null : x)),
      tileOf: tileOf.map((x, k) => (k === i ? null : x)),
      marked: marked.map((x, k) => (k === i ? false : x)),
      selected: i,
    });
    tap();
  };

  const startOver = () => setStored(fresh());

  const check = () => {
    if (locked || remaining > 0) return;
    // Judged from the lines themselves, never from the answer key.
    const correct = isSolved(p, values);
    const wrong = correct ? p.slots.map(() => false) : values.map((v, i) => v !== p.answers[i]);
    update({ marked: wrong });
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    const count = wrong.filter(Boolean).length;
    round.submit({
      correct,
      given: values.join(","),
      expected: question.expected,
      title: tx(correct ? "right.title" : "wrong.title"),
      message: correct ? tx("right.message") : tx("wrong.message", { count }),
    });
  };

  /* ---------- the board ---------- */

  const D = p.size * 2 + 1;
  const signSlots = p.slots.some((s) => s.kind === "op");
  const big = p.size === 3;
  const num = big ? "2.75rem" : "3.5rem";
  const opw = signSlots ? num : big ? "1.5rem" : "2rem";
  const template = Array.from({ length: D }, (_, i) => (i % 2 === 0 ? num : opw)).join(" ");
  const slotAt = new Map(p.slots.map((slot, i) => [at(slot).join(","), i]));

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < D; r += 1) {
    for (let c = 0; c < D; c += 1) {
      const key = `${r},${c}`;
      const slotIndex = slotAt.get(key);
      if (slotIndex !== undefined) {
        const slot = p.slots[slotIndex];
        const v = values[slotIndex];
        const isSel = !locked && selected === slotIndex && v === null;
        const wrong = marked[slotIndex];
        const shown = v === null ? "" : slot.kind === "op" ? OP_SYMBOL[v as Op] : v;
        const label = v === null
          ? tx("slot.empty", { where: slotWhere(slot) })
          : tx("slot.filled", { where: slotWhere(slot), value: slot.kind === "op" ? tx(`sign.${v}`) : v });
        cells.push(
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-pressed={isSel}
            disabled={locked}
            onClick={() => takeBack(slotIndex)}
            className={`grid min-h-11 place-items-center rounded-xl border-2 font-black tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              big ? "text-lg" : "text-2xl"
            } ${
              wrong
                ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                : round.feedback?.status === "correct"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : v === null
                    ? `border-dashed border-indigo-400 bg-surface dark:border-indigo-500 ${isSel ? "ring-4 ring-indigo-500/30" : ""}`
                    : "border-indigo-500 bg-surface text-indigo-700 dark:text-indigo-300"
            }`}
          >
            {wrong && <span className="sr-only">✗ </span>}
            {shown}
          </button>,
        );
        continue;
      }
      let content: React.ReactNode = null;
      let style = "";
      if (r % 2 === 0 && c % 2 === 0) {
        const value = p.nums[r / 2][c / 2];
        if (value !== null) {
          const result = r / 2 === p.size || c / 2 === p.size;
          content = value;
          style = result
            ? "rounded-xl border-2 border-line bg-surface text-ink"
            : "rounded-xl bg-indigo-50 text-ink dark:bg-indigo-950/50";
        }
      } else if (r % 2 === 0) {
        const row = r / 2;
        const k = (c - 1) / 2;
        const ops = p.rowOps[row];
        if (ops) {
          content = k < ops.length ? OP_SYMBOL[ops[k]] : "=";
          // No colour for a finished line: that would mark it right before Check.
          style = "text-muted";
        }
      } else if (c % 2 === 0) {
        const col = c / 2;
        const k = (r - 1) / 2;
        const ops = p.colOps[col];
        if (ops) {
          content = k < ops.length ? OP_SYMBOL[ops[k]] : "=";
          // No colour for a finished line: that would mark it right before Check.
          style = "text-muted";
        }
      }
      cells.push(
        <div
          key={key}
          aria-hidden="true"
          className={`grid place-items-center font-black tabular-nums ${big ? "text-lg" : "text-2xl"} ${style}`}
        >
          {content}
        </div>,
      );
    }
  }

  const counts = new Map<number, number>();
  const seen = new Map<number, number>();
  p.bank.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  const tileButton = "min-h-12 min-w-12 rounded-2xl border-2 border-b-4 border-line bg-surface px-3 text-xl font-black tabular-nums text-ink shadow-sm transition active:translate-y-0.5 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("title")}
      round={round}
      totalQuestions={total}
      prompt={promptFor(question)}
      onExit={() => koda.ui.exit()}
      hints={practising ? [] : crossHints(question, values, copy.kidTip)}
      iconName="boxes"
      iconTone="indigo"
      onStartOver={!locked && remaining < values.length ? startOver : undefined}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
        <div
          role="group"
          aria-label={tx("grid")}
          className="grid gap-1"
          style={{ gridTemplateColumns: template, gridTemplateRows: template }}
        >
          {cells}
        </div>

        {p.bank.length > 0 && (
          <div role="group" aria-label={tx("bank.numbers")} className="flex flex-wrap justify-center gap-2.5">
            {p.bank.map((v, i) => {
              const k = (seen.get(v) ?? 0) + 1;
              seen.set(v, k);
              return (
                <button
                  key={`n${i}`}
                  type="button"
                  disabled={locked || usedTiles.has(i)}
                  aria-label={(counts.get(v) ?? 0) > 1 ? tx("bank.tileAt", { value: String(v), k: String(k) }) : tx("bank.tile", { value: String(v) })}
                  onClick={() => place("num", String(v), i)}
                  className={tileButton}
                >
                  {v}
                </button>
              );
            })}
          </div>
        )}

        {p.palette.length > 0 && (
          <div role="group" aria-label={tx("bank.signs")} className="flex flex-wrap justify-center gap-2.5">
            {p.palette.map((op) => (
              <button
                key={op}
                type="button"
                disabled={locked || !p.slots.some((s, i) => s.kind === "op" && values[i] === null)}
                aria-label={tx("bank.signTile", { name: tx(`sign.${op}`) })}
                onClick={() => place("op", op, null)}
                className={`${tileButton} text-indigo-700 dark:text-indigo-300`}
              >
                {OP_SYMBOL[op]}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={check}
          disabled={locked || remaining > 0}
          className="min-h-12 w-full max-w-xs rounded-2xl bg-indigo-600 px-6 py-2 text-base font-black text-white shadow-sm transition disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
        >
          {remaining > 0 ? tx("toFill", { count: remaining }) : tx("check")}
        </button>
      </div>
    </SkillRound>
  );
};
