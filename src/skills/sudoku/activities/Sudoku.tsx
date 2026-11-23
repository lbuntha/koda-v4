import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, isPractice, openWith, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { useT } from "../../../lib/i18n";
import { bit, digitsOf, geometry, isValidSolution, seededRandom, shuffle, type Size } from "../internal/board";
import { makeGame, type Bank, type Puzzle } from "../internal/generate";
import { nextStep, stateOf, upTo, type Technique } from "../internal/techniques";
import { tx } from "../internal/i18n";
import bankJson from "../internal/bank.json";
import { Board, PICTURES, Pad, pictureName, type CellMark, type PictureSet } from "./Board";
import { cellName, clock, struckMap, techniqueHint, type HintFocus } from "./words";

/**
 * Sudoku, played whole. A lesson names a grid size and the technique its
 * puzzles need; every play makes new puzzles to that spec. The board checks
 * itself as soon as the last cell is filled — there is no Check button.
 */

export type NotesMode = "off" | "on" | "auto";

export interface SudokuSetup {
  size?: Size;
  technique?: Technique;
  blanks?: number;
  pictures?: boolean;
  /** "on": the Notes switch. "auto": Notes and Fill notes. */
  notes?: NotesMode;
  questionsPerRound?: number;
  practice?: boolean;
  seed?: string;
}

export interface SudokuParams extends SudokuSetup {
  question?: SudokuSetup;
}

export interface GameQuestion extends RoundQuestion {
  puzzle: Puzzle;
  pictures?: PictureSet;
}

export const bank = bankJson as Bank;

export const setupOf = (params: SudokuParams): Required<Pick<SudokuSetup, "size" | "technique">> & SudokuSetup => ({
  size: 4,
  technique: "full-house",
  ...params,
  ...params.question,
});

/** Four (or six) of the six pictures, each with its own colour, new per puzzle. */
export function pictureSet(n: Size, seed: string): PictureSet {
  const rand = seededRandom(`${seed}:pictures`);
  return {
    shapes: shuffle([...PICTURES], rand).slice(0, n),
    tones: shuffle([0, 1, 2, 3, 4, 5], rand).slice(0, n),
  };
}

export function buildGameQuestion(params: SudokuParams, index: number, seed = "sudoku"): GameQuestion {
  const setup = setupOf(params);
  const key = `${setup.seed ?? seed}:${index}`;
  const puzzle = makeGame({ size: setup.size, technique: setup.technique, blanks: setup.blanks }, key, bank);
  const pictures = setup.pictures && setup.size <= 6 ? pictureSet(setup.size, key) : undefined;
  return {
    id: `sudoku-${seed}-${index}`,
    taskKind: "sudoku_game",
    prompt: tx(pictures ? "prompt.pictures" : "prompt.numbers"),
    expected: puzzle.answer.join(""),
    itemCount: puzzle.givens.filter((v) => !v).length,
    puzzle,
    pictures,
  };
}

/**
 * Hints from the board as it stands: the givens and every correct entry. A
 * wrong entry is left out rather than reasoned from, and is not pointed at
 * either — that is the board's job once it is full.
 */
export function gameHint(question: GameQuestion, values: number[], technique: Technique) {
  const p = question.puzzle;
  const known = values.map((v, i) => (v && v === p.answer[i] ? v : 0));
  const s = stateOf(known, p.n);
  const step = nextStep(s, upTo(technique)) ?? nextStep(s, upTo("x-wing"));
  if (!step) return undefined;
  const name = (d: number) => (question.pictures ? pictureName(question.pictures, d) : String(d));
  return techniqueHint(s, step, p.answer, name);
}

interface GameState {
  qid: string;
  values: number[];
  notes: number[];
  selected: number;
  wrong: number[];
  noting: boolean;
}

const freshSeed = (): string => Math.random().toString(36).slice(2, 10);

export const Sudoku: React.FC<ActivityProps<SudokuParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup = useMemo(() => setupOf(params), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 1;
  const notesMode: NotesMode = setup.notes ?? "off";
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);

  // A race's seed when there is one, so every player gets the same puzzles.
  const seed = useRef(setup.seed ?? freshSeed());
  const furthest = useRef(0);
  const nextQuestion = useCallback((index: number) => {
    if (index === 1 && furthest.current > 1) seed.current = freshSeed();
    furthest.current = Math.max(furthest.current, index);
    return buildGameQuestion(params, index, seed.current);
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
  const question = round.question as GameQuestion;
  const p = question.puzzle;
  const n = p.n;
  const g = geometry(n);
  const givens = useMemo(() => p.givens.map(Boolean), [p]);

  const fresh = (): GameState => ({
    qid: question.id,
    values: p.givens.slice(),
    notes: p.givens.map(() => 0),
    selected: p.givens.findIndex((v) => !v),
    wrong: [],
    noting: false,
  });
  const [stored, setStored] = useState<GameState>(fresh);
  const state = stored.qid === question.id ? stored : fresh();
  const { values, notes, selected, wrong, noting } = state;
  const update = (next: Partial<GameState>) => setStored({ ...state, ...next });

  /* The clock: from the moment this puzzle appeared. */
  const startedAt = useRef({ qid: "", at: 0 });
  if (startedAt.current.qid !== question.id) startedAt.current = { qid: question.id, at: Date.now() };
  const [now, setNow] = useState(() => Date.now());
  const locked = Boolean(round.feedback);
  const solved = round.feedback?.status === "correct";
  useEffect(() => {
    if (solved) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [solved]);
  const elapsed = now - startedAt.current.at;

  const remaining = values.filter((v) => !v).length;
  const name = (d: number) => (question.pictures ? pictureName(question.pictures, d) : String(d));

  const tap = () => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
  };

  const check = (vals: number[]) => {
    const correct = isValidSolution(vals, n);
    const bad = correct ? [] : vals.map((v, i) => (v !== p.answer[i] ? i : -1)).filter((i) => i >= 0);
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    round.submit({
      correct,
      given: vals.join(""),
      expected: question.expected,
      title: tx(correct ? "right.title" : "wrong.title"),
      message: correct ? tx("right.message", { time: clock(Date.now() - startedAt.current.at) }) : tx("wrong.message", { count: bad.length }),
    });
    return bad;
  };

  const put = (d: number) => {
    if (locked || selected < 0 || givens[selected]) return;
    if (noting) {
      if (values[selected]) return;
      update({ notes: notes.map((m, i) => (i === selected ? m ^ bit(d) : m)) });
      tap();
      return;
    }
    const vals = values.slice();
    vals[selected] = vals[selected] === d ? 0 : d;
    // A placed number clears itself from the notes it can see.
    const nts = notes.map((m, i) => (i === selected ? 0 : vals[selected] && g.peers[selected].includes(i) ? m & ~bit(d) : m));
    const left = vals.findIndex((v, i) => !v && i > selected);
    const next = left >= 0 ? left : vals.findIndex((v) => !v);
    tap();
    if (vals.every(Boolean)) {
      const bad = check(vals);
      setStored({ ...state, values: vals, notes: nts, wrong: bad, selected: bad[0] ?? selected });
      return;
    }
    setStored({ ...state, values: vals, notes: nts, wrong: wrong.filter((i) => i !== selected), selected: vals[selected] && next >= 0 ? next : selected });
  };

  const clear = () => {
    if (locked || selected < 0 || givens[selected]) return;
    update({ values: values.map((v, i) => (i === selected ? 0 : v)), notes: notes.map((m, i) => (i === selected ? 0 : m)), wrong: wrong.filter((i) => i !== selected) });
  };

  const fillNotes = () => {
    if (locked) return;
    const s = stateOf(values, n);
    update({ notes: s.cand, noting: true });
    tap();
  };

  const select = (i: number) => {
    if (locked) return;
    // Tapping a marked cell takes the wrong number out, ready for another.
    if (wrong.includes(i)) {
      update({ selected: i, values: values.map((v, k) => (k === i ? 0 : v)), wrong: wrong.filter((k) => k !== i) });
      return;
    }
    update({ selected: i });
  };

  /* Keys, for anyone on a keyboard: digits, Backspace, arrows. */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (locked) return;
    const d = Number(e.key);
    if (d >= 1 && d <= n) return put(d);
    if (e.key === "Backspace" || e.key === "Delete") return clear();
    const move = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (move !== undefined && selected >= 0) {
      const to = selected + move;
      if (to >= 0 && to < n * n) update({ selected: to });
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  /* Hints, and what each rung points at on the board. */
  const hint = useMemo(() => (practising || locked ? undefined : gameHint(question, values, setup.technique)), [practising, locked, question, values, setup.technique]);
  const hints = practising ? [] : openWith(copy.kidTip, hint?.rungs ?? []);
  const rung = round.hint.open ? round.hint.level - (hints.length - (hint?.rungs.length ?? 0)) - 1 : -1;
  const focus: HintFocus | undefined = hint && rung >= 0 ? hint.focus[rung] : undefined;

  const marks = new Map<number, CellMark>();
  focus?.cells.forEach((i) => marks.set(i, "hint"));
  if (focus?.target) marks.set(focus.target.cell, "target");
  wrong.forEach((i) => marks.set(i, "wrong"));

  const done = new Set<number>();
  if (!noting) for (let d = 1; d <= n; d += 1) if (values.filter((v) => v === d).length >= n) done.add(d);

  const labelFor = (i: number) => {
    const where = cellName(n, i);
    const v = values[i];
    if (wrong.includes(i)) return tx("label.wrong", { where, value: name(v) });
    if (!v) return notes[i] ? tx("label.notes", { where, notes: digitsOf(notes[i]).join(", ") }) : tx("label.empty", { where });
    return tx(givens[i] ? "label.given" : "label.filled", { where, value: name(v) });
  };

  const toolButton = "min-h-11 flex-1 rounded-xl border-2 border-line bg-surface px-3 text-sm font-bold text-ink transition disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("title")}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="boxes"
      iconTone="purple"
      onStartOver={!locked && values.some((v, i) => v && !givens[i]) ? () => setStored(fresh()) : undefined}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
        <div className="flex w-full max-w-[26rem] items-baseline justify-between text-sm font-semibold text-muted tabular-nums">
          <span>{tx("toFill", { count: remaining })}</span>
          <span aria-label={tx("time", { time: clock(elapsed) })}>{clock(elapsed)}</span>
        </div>

        <Board
          n={n}
          values={values}
          givens={givens}
          notes={notesMode === "off" ? undefined : notes}
          selected={locked ? -1 : selected}
          marks={marks}
          struck={focus ? struckMap(focus.struck) : undefined}
          area={focus ? new Set(focus.area) : undefined}
          pictures={question.pictures}
          disabled={locked}
          onSelect={select}
          labelFor={labelFor}
        />

        <div className="flex w-full max-w-[26rem] gap-2">
          <button type="button" className={toolButton} disabled={locked} onClick={clear}>{tx("clear")}</button>
          {notesMode !== "off" && (
            <button
              type="button"
              aria-pressed={noting}
              className={`${toolButton} ${noting ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : ""}`}
              disabled={locked}
              onClick={() => update({ noting: !noting })}
            >
              {tx("notes")}
            </button>
          )}
          {notesMode === "auto" && (
            <button type="button" className={toolButton} disabled={locked} onClick={fillNotes}>{tx("fillNotes")}</button>
          )}
        </div>

        <Pad
          n={n}
          pictures={question.pictures}
          disabled={locked}
          done={done}
          onPick={put}
          labelFor={(d) => tx(noting ? "note" : "put", { value: name(d) })}
        />
      </div>
    </SkillRound>
  );
};

