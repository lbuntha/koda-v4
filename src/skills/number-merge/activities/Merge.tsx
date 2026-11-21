import React, { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ActivityProps } from "../../types";
import { SPRING, SkillRound, composeHints, isPractice, openWith, playCopy, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { useT } from "../../../lib/i18n";
import { tx } from "../internal/i18n";
import {
  areNeighbours,
  bestMove,
  fractionOf,
  isWrongAnswer,
  merge,
  moves,
  newBoard,
  resolve,
  seededRandom,
  settle,
  type Board,
  type MergeSetup,
  type Refusal,
  type Resolved,
} from "../internal/rules";

/**
 * Number Merge. Move a number onto the one next to it — by dragging it, or by
 * tapping it and then its neighbour — and the two merge.
 *
 * One board lasts the whole round. Each question is one "make": a pop that
 * reaches the target. In pair modes (bonds, differences, doubles facts) a pair
 * that does not make it is a wrong answer; in building modes a merge that would
 * go too far is refused with a reason, and smaller merges build towards it.
 */

export interface MergeParams extends MergeSetup {
  question?: MergeSetup;
}

export interface MergeQuestion extends RoundQuestion {
  setup: Resolved;
}

export const setupOf = (params: MergeParams): Resolved => resolve({ ...params, ...params.question });

export function promptOf(s: Resolved): string {
  if (s.mode === "bundle") return tx(s.target === 10 ? "prompt.bundleTen" : "prompt.bundleHundred");
  return tx(`prompt.${s.mode}`, { target: s.target });
}

export function buildMergeQuestion(params: MergeParams, index: number, seed = "merge"): MergeQuestion {
  const s = setupOf(params);
  return {
    id: `merge-${seed}-${index}`,
    taskKind: `merge_${s.mode}`,
    prompt: promptOf(s),
    expected: String(s.target),
    itemCount: s.size * s.size,
    setup: s,
  };
}

/* ---------- how a number looks and sounds ---------- */

/** What a tile says out loud, and in an equation. */
export function valueText(s: Resolved, v: number): string {
  if (s.mode === "fraction") {
    const [n, d] = fractionOf(v, s.target);
    return d === 1 ? String(n) : `${n}/${d}`;
  }
  return String(v);
}

function spokenValue(s: Resolved, v: number): string {
  if (s.mode === "fraction") {
    const [n, d] = fractionOf(v, s.target);
    return d === 1 ? String(n) : tx("fraction", { n, d });
  }
  if (s.mode === "bundle") return v >= 10 && v % 10 === 0 ? tx("unit.tens", { count: v / 10 }) : tx("unit.ones", { count: v });
  return String(v);
}

export function goalText(s: Resolved): string {
  if (s.mode === "difference") return tx("goal.apart", { value: s.target });
  if (s.mode === "doubleFact") return tx("goal.same");
  if (s.mode === "fraction") return tx("goal.whole");
  return tx("goal.make", { value: s.target });
}

/* ---------- words for a merge ---------- */

export function rightMessage(s: Resolved, a: number, b: number): string {
  const [x, y] = [valueText(s, a), valueText(s, b)];
  switch (s.mode) {
    case "bond":
      return tx("right.bond", { a: x, b: y, target: s.target });
    case "difference":
      return tx("right.difference", { big: Math.max(a, b), small: Math.min(a, b), target: s.target });
    case "product":
      return tx("right.product", { a: x, b: y, target: s.target });
    case "fraction":
      return tx("right.fraction");
    case "doubleFact":
      return tx("right.double", { a: x, target: a + b });
    case "double":
      return tx("right.double", { a: x, target: s.target });
    default:
      return tx("right.made", { target: s.target });
  }
}

export function refusalMessage(s: Resolved, reason: Refusal, a: number, b: number, value: number): string {
  const [x, y] = [valueText(s, a), valueText(s, b)];
  switch (reason) {
    case "notBond":
      return tx("wrong.bond", { a: x, b: y, sum: value, target: s.target, need: s.target - a });
    case "notDifference":
      return tx("wrong.difference", { a: x, b: y, gap: value, target: s.target });
    case "notSame":
      return tx("wrong.notSame", { a: x, b: y });
    case "over":
      return tx("refuse.over", { a: x, b: y, value: valueText(s, value), target: valueText(s, s.target) });
    default:
      return tx(`refuse.${reason}`, { a: x, b: y, value, target: s.target });
  }
}

function growMessage(s: Resolved, a: number, b: number, value: number): string {
  if (s.mode === "bundle" && value === 10) return tx("status.ten");
  if (s.mode === "product") return tx("status.growProduct", { a, b, value });
  if (s.mode === "double") return tx("status.growDouble", { a, value });
  return tx("status.grow", { a: valueText(s, a), b: valueText(s, b), value: valueText(s, value) });
}

/* ---------- hints, read off the board as it stands ---------- */

export function mergeHints(s: Resolved, board: Board): { rungs: string[]; worked: [number, number] | null } {
  const pop = moves(s, board).find((m) => m.verdict.kind === "pop");
  const move = pop ?? bestMove(s, board);
  const at = (i: number) => board.cells[i]!.v;
  let nudge = "";
  switch (s.mode) {
    case "bond":
      if (pop) nudge = tx("hint.bond", { a: at(pop.from), need: s.target - at(pop.from), target: s.target });
      break;
    case "difference":
      if (pop) {
        const small = Math.min(at(pop.from), at(pop.to));
        nudge = tx("hint.difference", { target: s.target, a: small, need: small + s.target });
      }
      break;
    case "sum":
      nudge = tx("hint.build", { target: s.target });
      break;
    default:
      nudge = tx(`hint.${s.mode}`, { target: s.target });
  }
  const worked = move ? tx("hint.worked", { a: spokenValue(s, at(move.from)), b: spokenValue(s, at(move.to)) }) : "";
  return { rungs: composeHints(nudge, worked), worked: move ? [move.from, move.to] : null };
}

/* ---------- colours: bright, never yellow, a new colour as numbers grow ---------- */

const TONES = [
  "bg-sky-100 text-sky-800 shadow-[0_5px_0_#7dd3fc] dark:bg-sky-900/70 dark:text-sky-100 dark:shadow-[0_5px_0_#0c4a6e]",
  "bg-violet-100 text-violet-800 shadow-[0_5px_0_#c4b5fd] dark:bg-violet-900/70 dark:text-violet-100 dark:shadow-[0_5px_0_#4c1d95]",
  "bg-emerald-100 text-emerald-800 shadow-[0_5px_0_#6ee7b7] dark:bg-emerald-900/70 dark:text-emerald-100 dark:shadow-[0_5px_0_#064e3b]",
  "bg-pink-100 text-pink-800 shadow-[0_5px_0_#f9a8d4] dark:bg-pink-900/70 dark:text-pink-100 dark:shadow-[0_5px_0_#831843]",
  "bg-cyan-100 text-cyan-800 shadow-[0_5px_0_#67e8f9] dark:bg-cyan-900/70 dark:text-cyan-100 dark:shadow-[0_5px_0_#164e63]",
  "bg-indigo-100 text-indigo-800 shadow-[0_5px_0_#a5b4fc] dark:bg-indigo-900/70 dark:text-indigo-100 dark:shadow-[0_5px_0_#312e81]",
  "bg-rose-100 text-rose-800 shadow-[0_5px_0_#fda4af] dark:bg-rose-900/70 dark:text-rose-100 dark:shadow-[0_5px_0_#881337]",
  "bg-teal-100 text-teal-800 shadow-[0_5px_0_#5eead4] dark:bg-teal-900/70 dark:text-teal-100 dark:shadow-[0_5px_0_#134e4a]",
];

function toneOf(s: Resolved, v: number): string {
  if (s.mode === "bundle") return TONES[v >= 10 && v % 10 === 0 ? 1 : 0];
  if (s.mode === "double") return TONES[Math.round(Math.log2(Math.max(1, v))) % TONES.length];
  return TONES[(v - 1 + TONES.length * 10) % TONES.length];
}

/* ---------- the activity ---------- */

interface Play {
  qid0: string;
  /** Where this board's tiles come from: the round's seed, or a fresh one after Start over. */
  boardSeed: string;
  /** Merges made on this board. Each refill draws from `${boardSeed}:${moves}`. */
  moves: number;
  board: Board;
  selected: number | null;
  /** Tiles to shake, and a counter so the same tiles can shake twice. */
  shake: { ids: number[]; n: number };
  /** Tiles that just grew, to bounce. */
  bump: { id: number; n: number } | null;
  /** The last pop, for the burst and the floating sum. */
  burst: { cell: number; text: string; n: number } | null;
  status: string;
  nudge: string | null;
  built: boolean;
}

const freshSeed = (): string => Math.random().toString(36).slice(2, 10);

/** The board a seed starts with. Exported so a test can see the same board a child does. */
export const boardFor = (s: Resolved, boardSeed: string): Board => newBoard(s, seededRandom(`${boardSeed}:board`));
/** The random numbers for the refill after merge number `move`. */
export const refillRandom = (boardSeed: string, move: number): (() => number) => seededRandom(`${boardSeed}:${move}`);

export const Merge: React.FC<ActivityProps<MergeParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const s = useMemo(() => setupOf(params), [params]);
  const copy = playCopy(params);
  const practising = isPractice(s);
  const total = s.questionsPerRound ?? 6;
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const dragEnabled = koda.config.isEnabled("drag_merge", true);
  const motionOK = useMotionOK();

  const seed = useRef(s.seed ?? freshSeed());
  const furthest = useRef(0);
  const nextQuestion = useCallback((index: number) => {
    if (index === 1 && furthest.current > 1) seed.current = freshSeed();
    furthest.current = Math.max(furthest.current, index);
    return buildMergeQuestion(params, index, seed.current);
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
  const question = round.question as MergeQuestion;

  /*
   * One board per round: a new seed means a new board. Every board and every
   * refill is drawn from a seed and a move count, never from shared random
   * state, so a render can run twice (StrictMode) and still draw the same tiles.
   */
  const fresh = (boardSeed = seed.current): Play => ({
    qid0: seed.current,
    boardSeed,
    moves: 0,
    board: boardFor(s, boardSeed),
    selected: null,
    shake: { ids: [], n: 0 },
    bump: null,
    burst: null,
    status: tx(dragEnabled ? "status.dragOrTap" : "status.tapOnly"),
    nudge: null,
    built: false,
  });
  const [stored, setStored] = useState<Play>(fresh);
  const play = stored.qid0 === seed.current ? stored : fresh();
  const update = (next: Partial<Play>) => setStored({ ...play, ...next });
  const { board, selected } = play;
  const n = board.size;
  const locked = Boolean(round.feedback);

  const chime = (name: "pop" | "success" | "error") => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(name);
  };
  const buzz = (ok: boolean) => {
    if (!hapticsEnabled) return;
    if (ok) koda.haptics.success(); else koda.haptics.pulse("error");
  };

  /** Move the tile at `from` onto the tile at `to`. */
  const commit = (from: number, to: number) => {
    if (locked) return;
    const a = board.cells[from];
    const b = board.cells[to];
    if (!a || !b) return;
    if (!areNeighbours(n, from, to)) {
      update({ selected: null, nudge: tx("refuse.far"), shake: { ids: [a.id], n: play.shake.n + 1 } });
      return;
    }
    const result = merge(s, board, from, to)!;
    const v = result.verdict;
    if (v.kind === "refuse") {
      const message = refusalMessage(s, v.reason, a.v, b.v, v.value);
      chime("error");
      buzz(false);
      const shake = { ids: [a.id, b.id], n: play.shake.n + 1 };
      if (isWrongAnswer(s)) {
        update({ selected: null, shake, nudge: null });
        round.submit({
          correct: false,
          given: valueText(s, v.value),
          expected: question.expected,
          title: tx("wrong.title"),
          message,
        });
      } else {
        update({ selected: null, shake, nudge: message });
      }
      return;
    }
    const settled = settle(s, result.board, refillRandom(play.boardSeed, play.moves + 1));
    if (v.kind === "grow") {
      chime("pop");
      update({
        board: settled.board,
        selected: null,
        bump: { id: b.id, n: (play.bump?.n ?? 0) + 1 },
        status: settled.reshuffled ? tx("status.reshuffled") : growMessage(s, a.v, b.v, v.value),
        nudge: null,
        built: true,
        moves: play.moves + 1,
      });
      return;
    }
    chime("success");
    buzz(true);
    const message = rightMessage(s, a.v, b.v);
    update({
      board: settled.board,
      selected: null,
      burst: { cell: to, text: message, n: (play.burst?.n ?? 0) + 1 },
      status: settled.reshuffled ? tx("status.reshuffled") : message,
      nudge: null,
      built: false,
      moves: play.moves + 1,
    });
    round.submit({ correct: true, given: valueText(s, v.value), expected: question.expected, title: tx("right.title"), message });
  };

  const tap = (i: number) => {
    if (locked || !board.cells[i]) return;
    if (selected === null || selected === i) {
      update({ selected: selected === i ? null : i, nudge: null });
      return;
    }
    if (!areNeighbours(n, selected, i)) {
      update({ selected: i, nudge: null });
      return;
    }
    commit(selected, i);
  };

  /* Dragging: where the finger is decides the cell, not what is under it. */
  const boardRef = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const [dragging, setDragging] = useState<{ from: number; over: number | null } | null>(null);
  const cellAt = (x: number, y: number): number | null => {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r || x < r.left || y < r.top || x > r.right || y > r.bottom) return null;
    const col = Math.min(n - 1, Math.floor(((x - r.left) / r.width) * n));
    const row = Math.min(n - 1, Math.floor(((y - r.top) / r.height) * n));
    return row * n + col;
  };
  const pointOf = (e: MouseEvent | TouchEvent | PointerEvent): [number, number] => {
    if ("changedTouches" in e && e.changedTouches.length) return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
    const p = e as PointerEvent;
    return [p.clientX, p.clientY];
  };

  /* Hints and the pair the last rung points at. */
  const hint = useMemo(() => (practising || locked ? null : mergeHints(s, board)), [practising, locked, s, board]);
  const hints = practising ? [] : openWith(copy.kidTip, hint?.rungs ?? []);
  const showWorked = round.hint.open && hint?.worked && round.hint.level === hints.length;
  const workedCells = new Set(showWorked && hint?.worked ? hint.worked : []);

  const labelFor = (i: number) => {
    const t = board.cells[i];
    const label = tx("label.tile", { row: Math.floor(i / n) + 1, col: (i % n) + 1, value: t ? spokenValue(s, t.v) : "" });
    return selected === i ? tx("label.chosen", { label }) : label;
  };

  const pct = 100 / n;
  const fontSize = n <= 3 ? "text-4xl" : n === 4 ? "text-3xl" : "text-2xl";

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
      iconName="layers"
      iconTone="emerald"
      nudge={play.nudge}
      onStartOver={!locked && play.built ? () => setStored(fresh(`${play.boardSeed}:again${play.moves}`)) : undefined}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
        <div className="rounded-full border-2 border-violet-200 bg-violet-50 px-5 py-1.5 text-xl font-black text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200" data-testid="merge-goal">
          {goalText(s)}
        </div>

        <div
          ref={boardRef}
          role="grid"
          aria-label={tx("title")}
          className="relative aspect-square w-full max-w-[26rem] select-none rounded-3xl border-2 border-line bg-surface-muted p-0"
        >
          <AnimatePresence initial={motionOK}>
            {board.cells.map((t, i) => {
              if (!t) return null;
              const row = Math.floor(i / n);
              const col = i % n;
              const isSel = selected === i;
              const reachable = selected !== null && areNeighbours(n, selected, i);
              const over = dragging?.over === i && dragging.from !== i;
              const shaking = play.shake.ids.includes(t.id);
              const bumping = play.bump?.id === t.id;
              const frac = s.mode === "fraction" ? fractionOf(t.v, s.target) : null;
              const caption = s.mode === "bundle" ? spokenValue(s, t.v) : null;
              return (
                <motion.div
                  key={t.id}
                  className="absolute left-0 top-0 p-1.5"
                  style={{ width: `${pct}%`, height: `${pct}%`, zIndex: dragging?.from === i ? 20 : 1 }}
                  initial={motionOK ? { x: `${col * 100}%`, y: "-110%", opacity: 0 } : false}
                  animate={{ x: `${col * 100}%`, y: `${row * 100}%`, opacity: 1 }}
                  exit={motionOK ? { scale: 1.35, opacity: 0, transition: { duration: 0.3 } } : { opacity: 0, transition: { duration: 0 } }}
                  transition={motionOK ? SPRING.settle : { duration: 0 }}
                >
                  <motion.button
                    type="button"
                    role="gridcell"
                    aria-label={labelFor(i)}
                    aria-selected={isSel}
                    data-drag={dragEnabled ? "on" : "off"}
                    disabled={locked}
                    drag={dragEnabled && !locked}
                    dragSnapToOrigin
                    dragElastic={0.6}
                    dragMomentum={false}
                    whileDrag={{ scale: 1.12 }}
                    whileTap={motionOK ? { scale: 0.94 } : undefined}
                    onPointerDown={() => { dragged.current = false; }}
                    onDragStart={() => { dragged.current = true; setDragging({ from: i, over: null }); }}
                    onDrag={(e) => {
                      const [x, y] = pointOf(e);
                      const over = cellAt(x, y);
                      if (over !== dragging?.over) setDragging({ from: i, over });
                    }}
                    onDragEnd={(e) => {
                      setDragging(null);
                      const [x, y] = pointOf(e);
                      const to = cellAt(x, y);
                      if (to !== null && to !== i) commit(i, to);
                    }}
                    onClick={() => {
                      if (dragged.current) return;
                      tap(i);
                    }}
                    className={[
                      "relative grid h-full w-full place-items-center rounded-2xl font-black leading-none transition-[box-shadow,outline] focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400",
                      dragEnabled ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
                      toneOf(s, t.v),
                      fontSize,
                      isSel ? "outline outline-4 outline-violet-500 -translate-y-1" : "",
                      reachable || over ? "outline-dashed outline-2 outline-violet-400" : "",
                      workedCells.has(i) ? "outline-dashed outline-4 outline-emerald-500" : "",
                    ].join(" ")}
                  >
                    <motion.span
                      key={`${shaking ? play.shake.n : 0}-${bumping ? play.bump!.n : 0}`}
                      className="flex flex-col items-center"
                      initial={motionOK && bumping ? { scale: 1.35 } : false}
                      animate={motionOK && shaking ? { x: [0, -7, 7, -5, 5, 0], scale: 1 } : { x: 0, scale: 1 }}
                      transition={motionOK ? (bumping ? SPRING.celebrate : { duration: 0.35 }) : { duration: 0 }}
                    >
                      <TileFace s={s} v={t.v} frac={frac} caption={caption} />
                    </motion.span>
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* The burst: a ring, sparks and the sum floating up from where the pair met. */}
          <AnimatePresence>
            {play.burst && motionOK && (
              <Burst key={play.burst.n} cell={play.burst.cell} n={n} text={play.burst.text} />
            )}
          </AnimatePresence>
        </div>

        <p className="min-h-6 text-center text-base font-semibold text-body" aria-live="polite">{play.status}</p>
      </div>
    </SkillRound>
  );
};

/* ---------- what is drawn on a tile ---------- */

/** Whether this tile draws a picture of its number rather than (or as well as) the numeral. */
export function pictureOf(s: Resolved, v: number): "dots" | "rods" | "pie" | null {
  if (s.mode === "fraction") return "pie";
  const show = s.show ?? "number";
  if (show === "number") return null;
  if (s.mode === "bundle") return v >= 10 && v % 10 === 0 ? "rods" : "dots";
  return v <= 10 ? "dots" : null;
}

/** Dots laid out like a ten-frame: rows of five, so 7 reads as five and two. */
const Dots: React.FC<{ count: number }> = ({ count }) => (
  <span className="grid grid-cols-5 gap-[0.12em]" aria-hidden="true">
    {Array.from({ length: count }, (_, k) => (
      <span key={k} className="h-[0.34em] w-[0.34em] rounded-full bg-current" />
    ))}
  </span>
);

/** Tens as rods, each one ten little squares tall. */
const Rods: React.FC<{ tens: number }> = ({ tens }) => (
  <span className="flex items-end gap-[0.1em]" aria-hidden="true">
    {Array.from({ length: tens }, (_, k) => (
      <span key={k} className="flex h-[1.5em] w-[0.22em] flex-col gap-px">
        {Array.from({ length: 10 }, (_, j) => <span key={j} className="flex-1 rounded-[1px] bg-current" />)}
      </span>
    ))}
  </span>
);

/** A pie with `n` of `d` slices filled. */
const Pie: React.FC<{ n: number; d: number }> = ({ n, d }) => {
  const r = 20;
  const slice = (k: number) => {
    const a0 = (k / d) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((k + 1) / d) * 2 * Math.PI - Math.PI / 2;
    return `M24 24 L${24 + r * Math.cos(a0)} ${24 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${24 + r * Math.cos(a1)} ${24 + r * Math.sin(a1)} Z`;
  };
  return (
    <svg viewBox="0 0 48 48" className="h-[1.3em] w-[1.3em]" aria-hidden="true">
      <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
      {d === 1 ? <circle cx="24" cy="24" r={r} fill="currentColor" /> : Array.from({ length: d }, (_, k) => (
        <path key={k} d={slice(k)} fill={k < n ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
      ))}
    </svg>
  );
};

const TileFace: React.FC<{ s: Resolved; v: number; frac: [number, number] | null; caption: string | null }> = ({ s, v, frac, caption }) => {
  const picture = pictureOf(s, v);
  const both = (s.show ?? "number") === "both" || picture === "pie";
  const numeral = frac && frac[1] !== 1 ? (
    <span className="flex flex-col items-center text-[0.55em]" aria-hidden="true">
      <span>{frac[0]}</span>
      <span className="my-0.5 h-[3px] w-[1.4em] rounded bg-current" />
      <span>{frac[1]}</span>
    </span>
  ) : (
    <span className={picture ? "text-[0.6em]" : ""} aria-hidden="true">{valueText(s, v)}</span>
  );
  if (!picture) {
    return (
      <>
        {numeral}
        {caption && <span className="mt-1 text-[0.4em] font-bold opacity-80" aria-hidden="true">{caption}</span>}
      </>
    );
  }
  const drawing = picture === "dots" ? <Dots count={v} /> : picture === "rods" ? <Rods tens={v / 10} /> : <Pie n={frac![0]} d={frac![1]} />;
  return (
    <span className="flex flex-col items-center gap-1" data-picture={picture}>
      {drawing}
      {both && numeral}
    </span>
  );
};

const SPARKS = [0, 60, 120, 180, 240, 300];
const SPARK_TONES = ["bg-emerald-400", "bg-pink-400", "bg-violet-400", "bg-sky-400", "bg-rose-400", "bg-cyan-400"];

const Burst: React.FC<{ cell: number; n: number; text: string }> = ({ cell, n, text }) => {
  const pct = 100 / n;
  const left = (cell % n) * pct + pct / 2;
  const top = Math.floor(cell / n) * pct + pct / 2;
  return (
    <motion.div
      className="pointer-events-none absolute z-30"
      style={{ left: `${left}%`, top: `${top}%` }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      data-testid="merge-burst"
      aria-hidden="true"
    >
      <motion.span
        className="absolute -left-10 -top-10 h-20 w-20 rounded-full border-4 border-emerald-400"
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {SPARKS.map((deg, k) => (
        <motion.span
          key={deg}
          className={`absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full ${SPARK_TONES[k]}`}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: Math.cos((deg * Math.PI) / 180) * 56, y: Math.sin((deg * Math.PI) / 180) * 56, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />
      ))}
      <motion.span
        className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-3 py-1 text-lg font-black text-white shadow-lg"
        initial={{ y: -10, opacity: 0, scale: 0.6 }}
        animate={{ y: -64, opacity: [0, 1, 1, 0], scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        {text}
      </motion.span>
    </motion.div>
  );
};
