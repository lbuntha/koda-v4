import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ActivityProps } from "../../types";
import { HowToPlay, HowToPlayButton, SPRING, SkillRound, isPractice, openWith, playCopy, useHowToPlay, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { useT } from "../../../lib/i18n";
import { tx } from "../internal/i18n";
import { TONES } from "./tones";
import { DemoScene, demoSteps } from "./Demo";
import {
  answerKey,
  clueAt,
  contains,
  generate,
  judge,
  nextBox,
  rectBetween,
  upTo,
  type GenSpec,
  type NextBox,
  type Puzzle,
  type Rect,
  type Shapes,
  type Technique,
} from "../internal/rules";

/**
 * Box Split. Split the grid into boxes: each box holds one number, and covers
 * that many squares.
 *
 * Draw a box by dragging from one corner to the other, or by tapping one
 * corner and then the other. Every box is checked as it is drawn:
 *
 * - a box the rules forbid (no number, two numbers, the wrong size, over
 *   another box) is refused with the reason, and is not an answer;
 * - a box of the right size in the wrong place is a wrong answer, and does
 *   not stay — so a box on the board is always a right one, and the hints can
 *   reason from the board as it stands;
 * - the last right box finishes the puzzle.
 *
 * One question is one whole puzzle. A lesson names the grid, the box sizes and
 * the hardest rule its puzzles need; every play makes new puzzles to that spec.
 */

export interface BoxSplitSetup {
  size?: number;
  minArea?: number;
  maxArea?: number;
  technique?: Technique;
  needs?: Technique;
  shapes?: Shapes;
  maxOnes?: number;
  factorRich?: number;
  /** Draw each number's squares as dots under it, for children still counting. */
  dots?: boolean;
  /** Show a clock, for speed lessons. */
  timed?: boolean;
  questionsPerRound?: number;
  practice?: boolean;
  seed?: string;
}

export interface BoxSplitParams extends BoxSplitSetup {
  question?: BoxSplitSetup;
}

export interface BoxQuestion extends RoundQuestion {
  puzzle: Puzzle;
}

type Resolved = BoxSplitSetup & Required<Pick<BoxSplitSetup, "size" | "maxArea" | "technique">>;

export const setupOf = (params: BoxSplitParams): Resolved => {
  const s = { ...params, ...params.question };
  const size = Math.min(15, Math.max(3, s.size ?? 4));
  return { ...s, size, maxArea: s.maxArea ?? Math.min(size, 6), technique: s.technique ?? "single-fit" };
};

export const specOf = (s: Resolved): GenSpec => ({
  size: s.size,
  minArea: s.minArea,
  maxArea: s.maxArea,
  technique: s.technique,
  needs: s.needs,
  shapes: s.shapes,
  maxOnes: s.maxOnes,
  factorRich: s.factorRich,
});

export const promptOf = (): string => tx("prompt");

export function buildBoxQuestion(params: BoxSplitParams, index: number, seed = "box"): BoxQuestion {
  const s = setupOf(params);
  const puzzle = generate(specOf(s), `${s.seed ?? seed}:${index}`);
  return {
    id: `box-${seed}-${index}`,
    taskKind: `box_split_${s.technique.replace("-", "_")}`,
    prompt: promptOf(),
    expected: answerKey(puzzle),
    itemCount: puzzle.clues.length,
    puzzle,
  };
}

/* ---------- words ---------- */

const rc = (n: number, cell: number) => ({ row: Math.floor(cell / n) + 1, col: (cell % n) + 1 });

export const sizeText = (b: Rect): string => tx("size", { h: b.h, w: b.w, area: b.h * b.w });

export function clock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/**
 * Three rungs, one ladder per rule: what to look for, where to look and why,
 * then the box itself. Read off the board as it stands.
 */
export function boxHints(p: Puzzle, drawn: (Rect | null)[], technique: Technique): { rungs: string[]; next: NextBox } | null {
  const next = nextBox(p, drawn, upTo(technique)) ?? nextBox(p, drawn);
  if (!next) return null;
  const why = p.clues[next.reasonClue];
  const at = { area: why.area, ...rc(p.n, why.cell) };
  const placed = p.clues[next.clue];
  const look = tx(`hint.${next.technique}.look`);
  const where =
    next.technique === "only-reach" && next.cell !== undefined
      ? tx("hint.only-reach.where", { ...at, square: tx("square", rc(p.n, next.cell)) })
      : tx(`hint.${next.technique}.where`, at);
  const worked = placed.area === 1
    ? tx("hint.workedOne", rc(p.n, placed.cell))
    : tx("hint.worked", { area: placed.area, ...rc(p.n, placed.cell), h: next.box.h, w: next.box.w });
  return { rungs: [look, where, worked], next };
}

export function refusalMessage(p: Puzzle, v: Exclude<ReturnType<typeof judge>, { kind: "right" } | { kind: "wrong" }>): string {
  const want = v.clue !== undefined ? p.clues[v.clue].area : 0;
  return tx(`refuse.${v.reason}`, { size: v.size, area: want });
}



/* ---------- the activity ---------- */

interface Play {
  qid: string;
  drawn: (Rect | null)[];
  /** First corner of a box being tapped out. */
  corner: number | null;
  /** The box last refused, to shake, and a counter so the same box can shake twice. */
  refused: { box: Rect; n: number } | null;
  status: string;
  nudge: string | null;
}

const freshSeed = (): string => Math.random().toString(36).slice(2, 10);

export const BoxSplit: React.FC<ActivityProps<BoxSplitParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  const s = useMemo(() => setupOf(params), [params]);
  const copy = playCopy(params);
  const practising = isPractice(s);
  const total = s.questionsPerRound ?? 3;
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const dragEnabled = koda.config.isEnabled("drag_draw", true);
  const motionOK = useMotionOK();

  // A race's seed when there is one, so every player gets the same puzzles.
  const seed = useRef(s.seed ?? freshSeed());
  const furthest = useRef(0);
  const nextQuestion = useCallback((index: number) => {
    if (index === 1 && furthest.current > 1) seed.current = freshSeed();
    furthest.current = Math.max(furthest.current, index);
    return buildBoxQuestion(params, index, seed.current);
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
  const question = round.question as BoxQuestion;

  /* How to play: by itself the first time, never in practice or a race (a race sets the seed). */
  const demo = useHowToPlay(koda.skillId, !practising && !s.seed);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);
  const p = question.puzzle;
  const n = p.n;

  const fresh = (): Play => ({
    qid: question.id,
    drawn: p.clues.map(() => null),
    corner: null,
    refused: null,
    status: tx(dragEnabled ? "status.dragOrTap" : "status.tapOnly"),
    nudge: null,
  });
  const [stored, setStored] = useState<Play>(fresh);
  const play = stored.qid === question.id ? stored : fresh();
  const update = (next: Partial<Play>) => setStored({ ...play, ...next });
  const { drawn, corner } = play;
  const locked = Boolean(round.feedback);

  /* The clock, for timed lessons: from the moment this puzzle appeared. */
  const startedAt = useRef({ qid: "", at: 0 });
  if (startedAt.current.qid !== question.id) startedAt.current = { qid: question.id, at: Date.now() };
  const [now, setNow] = useState(() => Date.now());
  const solved = round.feedback?.status === "correct";
  useEffect(() => {
    if (!s.timed || solved) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [s.timed, solved]);

  const chime = (name: "pop" | "success" | "error") => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(name);
  };
  const buzz = (ok: boolean) => {
    if (!hapticsEnabled) return;
    if (ok) koda.haptics.success(); else koda.haptics.pulse("error");
  };

  /** Check a drawn box, and keep it only if it is right. */
  const commit = (box: Rect) => {
    if (locked) return;
    const v = judge(p, box, drawn);
    if (v.kind === "refuse") {
      chime("error");
      buzz(false);
      update({ corner: null, refused: { box, n: (play.refused?.n ?? 0) + 1 }, nudge: refusalMessage(p, v) });
      return;
    }
    const clue = p.clues[v.clue];
    if (v.kind === "wrong") {
      chime("error");
      buzz(false);
      update({ corner: null, refused: { box, n: (play.refused?.n ?? 0) + 1 }, nudge: null });
      round.submit({
        correct: false,
        given: `${box.r},${box.c},${box.h}x${box.w}`,
        expected: question.expected,
        title: tx("wrong.title"),
        message: tx("wrong.message", { size: sizeText(box), area: clue.area, ...rc(n, clue.cell) }),
      });
      return;
    }
    const next = drawn.map((b, k) => (k === v.clue ? box : b));
    if (next.every(Boolean)) {
      chime("success");
      buzz(true);
      update({ drawn: next, corner: null, refused: null, nudge: null, status: tx("status.done") });
      const time = clock(Date.now() - startedAt.current.at);
      round.submit({
        correct: true,
        given: answerKey({ ...p, answer: next as Rect[] }),
        expected: question.expected,
        title: tx("right.title"),
        message: s.timed ? tx("right.timed", { time }) : tx("right.message"),
      });
      return;
    }
    chime("pop");
    update({ drawn: next, corner: null, refused: null, nudge: null, status: sizeText(box) });
  };

  /** A tap: the first corner, then the second. The same square twice is a 1-square box. */
  const tapCell = (i: number) => {
    if (locked) return;
    if (corner === null) {
      update({ corner: i, nudge: null, status: tx("status.secondCorner") });
      return;
    }
    commit(rectBetween(n, corner, i));
  };

  /* Dragging: where the finger is decides the square, not what is under it. */
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; moved: boolean } | null>(null);
  const cellAt = (x: number, y: number): number | null => {
    const r = gridRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    const col = Math.min(n - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * n)));
    const row = Math.min(n - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * n)));
    return row * n + col;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (locked || !dragEnabled || e.button !== 0) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i === null) return;
    suppressClick.current = false;
    setDrag({ from: i, to: i, moved: false });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i === null || i === drag.to) return;
    // Held only once the finger leaves its square, so a plain tap still reaches its button.
    if (!drag.moved) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ ...drag, to: i, moved: true });
  };
  const onPointerUp = () => {
    if (!drag) return;
    setDrag(null);
    // A press that never left its square is a tap, and the click handler takes it.
    if (drag.moved && drag.from !== drag.to) {
      suppressClick.current = true;
      commit(rectBetween(n, drag.from, drag.to));
    }
  };
  const suppressClick = useRef(false);

  /* Keys: arrows move between squares; Enter or Space sets a corner. */
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusCell, setFocusCell] = useState(0);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const move = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (move === undefined) {
      if (e.key === "Escape" && corner !== null) update({ corner: null, status: tx("status.tapOnly") });
      return;
    }
    const to = i + move;
    if (to < 0 || to >= n * n || (move === 1 && to % n === 0) || (move === -1 && i % n === 0)) return;
    e.preventDefault();
    setFocusCell(to);
    cellRefs.current[to]?.focus();
  };

  /* Hints, and what each rung lights up. */
  const hint = useMemo(() => (practising || locked ? null : boxHints(p, drawn, s.technique)), [practising, locked, p, drawn, s.technique]);
  const hints = practising ? [] : openWith(copy.kidTip, hint?.rungs ?? []);
  const rung = round.hint.open && hint ? round.hint.level - (hints.length - hint.rungs.length) : 0;
  const glowClue = rung >= 2 && hint ? p.clues[hint.next.reasonClue].cell : -1;
  const glowCells = new Set<number>(
    rung >= 2 && hint ? (hint.next.cells ?? (hint.next.cell !== undefined ? [hint.next.cell] : [])) : [],
  );
  const glowBox = rung >= 3 && hint ? hint.next.box : null;

  /* What is being drawn right now: the drag, or the tapped corner. */
  const live: Rect | null = drag && drag.moved ? rectBetween(n, drag.from, drag.to) : corner !== null ? rectBetween(n, corner, corner) : null;

  const owner = (i: number) => drawn.findIndex((b) => b && contains(b, n, i));
  const labelFor = (i: number) => {
    const k = clueAt(p, i);
    const pos = rc(n, i);
    const base = k === -1 ? tx("label.square", pos) : tx("label.number", { ...pos, area: p.clues[k].area });
    const mine = owner(i);
    const done = mine === -1 ? base : tx("label.inBox", { label: base, size: sizeText(drawn[mine]!) });
    return corner === i ? tx("label.corner", { label: done }) : done;
  };

  const pct = 100 / n;
  const place = (b: Rect): React.CSSProperties => ({ left: `${b.c * pct}%`, top: `${b.r * pct}%`, width: `${b.w * pct}%`, height: `${b.h * pct}%` });
  const numeral = n <= 4 ? "text-4xl" : n <= 6 ? "text-3xl" : n <= 8 ? "text-2xl" : n <= 10 ? "text-xl" : "text-base";
  const placedCount = drawn.filter(Boolean).length;

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
      nudge={play.nudge}
      onStartOver={!locked && placedCount > 0 ? () => setStored(fresh()) : undefined}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
        <div className="flex w-full items-center justify-center gap-2">
          <span className="rounded-full border-2 border-violet-200 bg-violet-50 px-4 py-1 text-base font-black text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200" data-testid="box-count">
            {tx("count", { done: placedCount, total: p.clues.length })}
          </span>
          {s.timed && (
            <span className="rounded-full border-2 border-line bg-surface px-4 py-1 font-mono text-base font-black text-ink" data-testid="box-clock" aria-label={tx("time", { time: clock(now - startedAt.current.at) })}>
              {clock(now - startedAt.current.at)}
            </span>
          )}
        </div>

        <div
          ref={gridRef}
          role="grid"
          aria-label={tx("title")}
          aria-rowcount={n}
          aria-colcount={n}
          data-drag={dragEnabled ? "on" : "off"}
          className={`relative aspect-square w-full max-w-[min(34rem,max(20rem,calc(100dvh-15rem)))] min-w-0 select-none overflow-hidden rounded-2xl border-[3px] border-ink/80 bg-surface ${dragEnabled ? "touch-none" : ""}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          {/* The squares: thin lines, so the boxes drawn over them read as the shapes. */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }} aria-hidden="true">
            {Array.from({ length: n * n }, (_, i) => (
              <span key={i} className={`border-line ${i % n === n - 1 ? "" : "border-r"} ${i >= n * (n - 1) ? "" : "border-b"} ${glowCells.has(i) ? "bg-pink-200 dark:bg-pink-900/70" : ""}`} />
            ))}
          </div>

          {/* The boxes drawn so far. */}
          <AnimatePresence initial={false}>
            {drawn.map((b, k) =>
              b ? (
                <motion.div
                  key={`box-${k}`}
                  data-testid="box-drawn"
                  className={`absolute rounded-xl border-[3px] ${TONES[k % TONES.length]}`}
                  style={{ ...place(b), margin: 2, width: `calc(${b.w * pct}% - 4px)`, height: `calc(${b.h * pct}% - 4px)` }}
                  initial={motionOK ? { scale: 0.6, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={motionOK ? { opacity: 0 } : { opacity: 0, transition: { duration: 0 } }}
                  transition={motionOK ? SPRING.celebrate : { duration: 0 }}
                  aria-hidden="true"
                />
              ) : null,
            )}
          </AnimatePresence>

          {/* The hint's box, glowing where it goes. */}
          {glowBox && (
            <div data-testid="box-hint" className="pointer-events-none absolute rounded-xl border-4 border-dashed border-emerald-500 bg-emerald-300/30" style={place(glowBox)} aria-hidden="true" />
          )}

          {/* The box being drawn, with its size as rows × columns. */}
          {live && (
            <div data-testid="box-live" className="pointer-events-none absolute z-20 rounded-xl border-4 border-dashed border-violet-600 bg-violet-400/25 dark:border-violet-300" style={place(live)} aria-hidden="true">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-violet-700 px-2.5 py-0.5 text-sm font-black text-white shadow-md">
                {live.h} × {live.w} = {live.h * live.w}
              </span>
            </div>
          )}

          {/* A refused box, shaking once where it was drawn. */}
          <AnimatePresence>
            {play.refused && motionOK && (
              <motion.div
                key={play.refused.n}
                className="pointer-events-none absolute z-10 rounded-xl border-4 border-rose-500 bg-rose-300/30"
                style={place(play.refused.box)}
                initial={{ opacity: 1, x: 0 }}
                animate={{ opacity: [1, 1, 0], x: [0, -8, 8, -5, 5, 0] }}
                transition={{ duration: 0.6 }}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          {/* The squares you press: real buttons, each named by row and column. */}
          <div className="absolute inset-0 z-10 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}>
            {Array.from({ length: n * n }, (_, i) => {
              const k = clueAt(p, i);
              const clue = k === -1 ? null : p.clues[k];
              return (
                <button
                  key={i}
                  ref={(el) => { cellRefs.current[i] = el; }}
                  type="button"
                  role="gridcell"
                  aria-label={labelFor(i)}
                  aria-selected={corner === i}
                  tabIndex={i === focusCell ? 0 : -1}
                  disabled={locked}
                  onFocus={() => setFocusCell(i)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  onClick={() => {
                    if (suppressClick.current) { suppressClick.current = false; return; }
                    tapCell(i);
                  }}
                  className={[
                    "relative grid place-items-center font-black leading-none text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-violet-500",
                    corner === i ? "ring-4 ring-inset ring-violet-600" : "",
                  ].join(" ")}
                >
                  {clue && (
                    <span
                      className={`flex flex-col items-center gap-1 ${numeral} ${glowClue === i ? "rounded-full bg-emerald-400 px-[0.3em] text-white" : ""}`}
                      data-testid="box-number"
                    >
                      <span aria-hidden="true">{clue.area}</span>
                      {s.dots && clue.area <= 10 && <Dots count={clue.area} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className="min-h-6 text-center text-base font-semibold text-body" aria-live="polite">{play.status}</p>
        {!practising && <HowToPlayButton onClick={demo.show} />}
      </div>
      <HowToPlay
        open={demo.open}
        steps={demoSteps()}
        scene={(step, phase, moveMs) => <DemoScene step={step} phase={phase} moveMs={moveMs} motionOK={motionOK} />}
        onClose={demo.close}
        speak={sayCaption}
      />
    </SkillRound>
  );
};

/** A number's squares as dots in rows of five, so 7 reads as five and two. */
const Dots: React.FC<{ count: number }> = ({ count }) => (
  <span className="flex max-w-[1.9em] flex-wrap justify-center gap-[0.12em]" aria-hidden="true" data-testid="box-dots">
    {Array.from({ length: count }, (_, k) => (
      <span key={k} className="h-[0.26em] w-[0.26em] rounded-full bg-violet-600 dark:bg-violet-300" />
    ))}
  </span>
);
