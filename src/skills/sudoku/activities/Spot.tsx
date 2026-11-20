import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, isPractice, openWith, playCopy, useSkillRound, type RoundQuestion } from "../../kit";
import { useT } from "../../../lib/i18n";
import { digitsOf, seededRandom, shuffle, type Size } from "../internal/board";
import { makeDrill, type Drill } from "../internal/generate";
import { rank, type Technique } from "../internal/techniques";
import { tx } from "../internal/i18n";
import { Board, Pad, type CellMark } from "./Board";
import { bank } from "./Sudoku";
import { cellName, clock, seconds, struckMap, techniqueHint, techniqueName, type HintFocus } from "./words";

/**
 * Spot it: a speed drill for one technique.
 *
 * The board is stopped at the moment the technique is needed — everything
 * easier has already been used — and the child finds the one placement it
 * gives, against the clock. A drill that names a number ("Where does 7 go?")
 * places it on the first tap; one that does not ("a cell that can only be one
 * number") asks for the cell, then the number.
 */

export interface SpotSetup {
  size?: Size;
  technique?: Technique;
  /** Several techniques, taken in turn, for a mixed speed run. */
  mix?: Technique[];
  questionsPerRound?: number;
  practice?: boolean;
  seed?: string;
}

export interface SpotParams extends SpotSetup {
  question?: SpotSetup;
}

export interface SpotQuestion extends RoundQuestion {
  drill: Drill;
}

const setupOf = (params: SpotParams) => ({ size: 9 as Size, technique: "hidden-single-box" as Technique, ...params, ...params.question });

/** Notes are shown from Pointing on: there the notes are what the technique works on. */
export const showsNotes = (t: Technique): boolean => rank(t) >= rank("pointing");

export function techniqueAt(setup: SpotSetup, index: number, seed: string): Technique {
  const list = setup.mix?.length ? setup.mix : [setup.technique ?? "hidden-single-box"];
  // Shuffled once per play, then taken in turn, so a mix covers every technique.
  const order = shuffle(list, seededRandom(`${seed}:mix`));
  return order[(index - 1) % order.length];
}

export function spotPrompt(drill: Drill): string {
  return tx(`spot.${drill.technique}`, { d: String(drill.digit ?? "") });
}

export function buildSpotQuestion(params: SpotParams, index: number, seed = "spot"): SpotQuestion {
  const setup = setupOf(params);
  const base = setup.seed ?? seed;
  const technique = techniqueAt(setup, index, base);
  const drill = makeDrill({ size: setup.size, technique }, `${base}:${index}`, bank);
  const target = drill.finds[0];
  return {
    id: `spot-${seed}-${index}`,
    taskKind: `sudoku_spot_${technique}`,
    prompt: spotPrompt(drill),
    expected: `${cellName(drill.n, target.cell)}=${target.value}`,
    itemCount: 1,
    drill,
  };
}

export function spotHint(drill: Drill) {
  const s = { n: drill.n, grid: drill.grid, cand: drill.cand };
  return techniqueHint(s, drill.step, drill.answer, String, drill.finds);
}

interface SpotState {
  qid: string;
  selected: number;
  missed: number;
}

const freshSeed = (): string => Math.random().toString(36).slice(2, 10);

export const Spot: React.FC<ActivityProps<SpotParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const setup = useMemo(() => setupOf(params), [params]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 6;
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);

  const seed = useRef(freshSeed());
  const furthest = useRef(0);
  const nextQuestion = useCallback((index: number) => {
    if (index === 1 && furthest.current > 1) seed.current = freshSeed();
    furthest.current = Math.max(furthest.current, index);
    return buildSpotQuestion(params, index, seed.current);
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
  const question = round.question as SpotQuestion;
  const drill = question.drill;
  const n = drill.n;

  const fresh = (): SpotState => ({ qid: question.id, selected: -1, missed: -1 });
  const [stored, setStored] = useState<SpotState>(fresh);
  const state = stored.qid === question.id ? stored : fresh();
  const update = (next: Partial<SpotState>) => setStored({ ...state, ...next });

  const startedAt = useRef({ qid: "", at: 0 });
  if (startedAt.current.qid !== question.id) startedAt.current = { qid: question.id, at: Date.now() };
  const [now, setNow] = useState(() => Date.now());
  const locked = Boolean(round.feedback);
  const found = round.feedback?.status === "correct";
  useEffect(() => {
    if (found) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [found]);

  const [placed, setPlaced] = useState<{ qid: string; cell: number; value: number } | null>(null);
  const shown = useMemo(() => {
    const v = drill.grid.slice();
    if (placed?.qid === question.id) v[placed.cell] = placed.value;
    return v;
  }, [drill, placed, question.id]);

  const judge = (cell: number, value: number) => {
    if (locked) return;
    const correct = drill.finds.some((m) => m.cell === cell && m.value === value);
    const ms = Date.now() - startedAt.current.at;
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(correct ? "success" : "error");
    if (hapticsEnabled) {
      if (correct) koda.haptics.success();
      else koda.haptics.pulse("error");
    }
    if (correct) setPlaced({ qid: question.id, cell, value });
    update({ selected: correct ? -1 : cell, missed: correct ? -1 : cell });
    round.submit({
      correct,
      given: `${cellName(n, cell)}=${value}`,
      expected: question.expected,
      title: tx(correct ? "found.title" : "miss.title"),
      message: correct
        ? tx("found.message", { technique: techniqueName(drill.technique), seconds: seconds(ms) })
        : drill.answer[cell] === value
          ? tx("miss.notSure")
          : tx("miss.cannot", { d: String(value) }),
    });
  };

  const select = (i: number) => {
    if (locked || shown[i]) return;
    if (drill.digit) return judge(i, drill.digit);
    update({ selected: i, missed: -1 });
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play("pop");
  };

  const hint = useMemo(() => (practising ? undefined : spotHint(drill)), [practising, drill]);
  const hints = practising ? [] : openWith(copy.kidTip, hint?.rungs ?? []);
  const rung = round.hint.open ? round.hint.level - (hints.length - (hint?.rungs.length ?? 0)) - 1 : -1;
  const focus: HintFocus | undefined = hint && rung >= 0 ? hint.focus[rung] : undefined;

  const marks = new Map<number, CellMark>();
  focus?.cells.forEach((i) => marks.set(i, "hint"));
  if (focus?.target) marks.set(focus.target.cell, "target");
  if (state.missed >= 0 && locked && !found) marks.set(state.missed, "wrong");
  if (found && placed?.qid === question.id) marks.set(placed.cell, "target");

  const labelFor = (i: number) => {
    const where = cellName(n, i);
    if (shown[i]) return tx("label.given", { where, value: String(shown[i]) });
    if (showsNotes(drill.technique) && drill.cand[i]) return tx("label.notes", { where, notes: digitsOf(drill.cand[i]).join(", ") });
    return tx("label.empty", { where });
  };

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
      iconName="zap"
      iconTone="purple"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
        <div className="flex w-full max-w-[26rem] items-baseline justify-between text-sm font-semibold tabular-nums">
          <span className="text-indigo-700 dark:text-indigo-300">{techniqueName(drill.technique)}</span>
          <span className="text-muted" aria-label={tx("time", { time: clock(now - startedAt.current.at) })}>
            {seconds(now - startedAt.current.at)}s
          </span>
        </div>

        <Board
          n={n}
          values={shown}
          givens={shown.map(Boolean)}
          notes={showsNotes(drill.technique) ? drill.cand : undefined}
          selected={locked ? -1 : state.selected}
          marks={marks}
          struck={focus ? struckMap(focus.struck) : undefined}
          area={focus ? new Set(focus.area) : undefined}
          disabled={locked}
          onSelect={select}
          labelFor={labelFor}
        />

        {!drill.digit && (
          <Pad
            n={n}
            disabled={locked || state.selected < 0}
            onPick={(d) => judge(state.selected, d)}
            labelFor={(d) => tx("put", { value: String(d) })}
          />
        )}
      </div>
    </SkillRound>
  );
};
