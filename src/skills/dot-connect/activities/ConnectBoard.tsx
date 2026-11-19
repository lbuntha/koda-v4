import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityProps } from "../../types";
import { SkillRound, guideSetup, isPractice, playCopy, useGuide, useSkillRound, type RoundQuestion } from "../../kit";
import { useT } from "../../../lib/i18n";
import { boardFor } from "../internal/bank";
import { checkLines, isSolved } from "../internal/check";
import { dragTo, emptyLines, isJoined, lineAt, sameLines, startDrag, type Drag, type Lines, type Refusal } from "../internal/drawing";
import { connectHints, focusColour } from "../internal/hints";
import { letterOf, td } from "../internal/i18n";
import { specFor } from "../internal/specs";
import type { Board } from "../internal/types";

interface ConnectSetup {
  /** One board spec, or several for a practice round to cycle through. */
  spec?: string;
  specs?: string[];
  questionsPerRound?: number;
  practice?: boolean;
  /** Where in the board bank this round starts. Random per round unless set. */
  offset?: number;
  /** A teaching lesson with the hints taken away. */
  noHints?: boolean;
}

export interface ConnectParams extends ConnectSetup {
  question?: ConnectSetup;
}

export interface ConnectQuestion extends RoundQuestion {
  board: Board;
  specId: string;
  mustFill: boolean;
}

/*
 * Seven colours, none of them yellow, each with its letter. Literal class
 * strings so Tailwind keeps them; the dark values are a step lighter so a line
 * stays readable on a dark board.
 */
const PALETTE = [
  { fill: "fill-rose-500 dark:fill-rose-400", stroke: "stroke-rose-500 dark:stroke-rose-400", tint: "fill-rose-500/15 dark:fill-rose-400/20" },
  { fill: "fill-sky-500 dark:fill-sky-400", stroke: "stroke-sky-500 dark:stroke-sky-400", tint: "fill-sky-500/15 dark:fill-sky-400/20" },
  { fill: "fill-emerald-600 dark:fill-emerald-400", stroke: "stroke-emerald-600 dark:stroke-emerald-400", tint: "fill-emerald-600/15 dark:fill-emerald-400/20" },
  { fill: "fill-violet-600 dark:fill-violet-400", stroke: "stroke-violet-600 dark:stroke-violet-400", tint: "fill-violet-600/15 dark:fill-violet-400/20" },
  { fill: "fill-orange-600 dark:fill-orange-400", stroke: "stroke-orange-600 dark:stroke-orange-400", tint: "fill-orange-600/15 dark:fill-orange-400/20" },
  { fill: "fill-fuchsia-600 dark:fill-fuchsia-400", stroke: "stroke-fuchsia-600 dark:stroke-fuchsia-400", tint: "fill-fuchsia-600/15 dark:fill-fuchsia-400/20" },
  { fill: "fill-slate-700 dark:fill-slate-300", stroke: "stroke-slate-700 dark:stroke-slate-300", tint: "fill-slate-700/15 dark:fill-slate-300/20" },
  { fill: "fill-cyan-700 dark:fill-cyan-400", stroke: "stroke-cyan-700 dark:stroke-cyan-400", tint: "fill-cyan-700/15 dark:fill-cyan-400/20" },
];
const colour = (k: number) => PALETTE[k % PALETTE.length];

const U = 100;

export function promptFor(q: Pick<ConnectQuestion, "board" | "mustFill">): string {
  const { board } = q;
  if (!q.mustFill) return td("prompt.join");
  if (board.steps) return td("prompt.steps", { letter: letterOf(board.steps.pair), steps: String(board.steps.steps) });
  if (board.bridges?.length) return td("prompt.bridge");
  if (board.walls.length) return td("prompt.walls");
  return td("prompt.fill");
}

export function buildQuestion(params: ConnectParams, index: number): ConnectQuestion {
  const setup = { ...params, ...params.question };
  // A practice round cycles specs so it spans the techniques taught.
  const cycle = setup.specs?.length ? setup.specs : [setup.spec ?? "one-pair"];
  const spec = specFor(cycle[(index - 1) % cycle.length]) ?? specFor("one-pair")!;
  const board = boardFor(spec.id, Math.ceil(index / cycle.length), setup.offset ?? 0);
  const question = {
    id: `dot-connect-${spec.id}-${index}`,
    taskKind: `connect_${spec.id}`,
    // The answer is the property, not a drawing: any valid answer is accepted.
    expected: spec.mustFill ? "every pair joined, every square filled" : "every pair joined",
    itemCount: board.pairs.length,
    board,
    specId: spec.id,
    mustFill: spec.mustFill,
  };
  return { ...question, prompt: promptFor(question) };
}

/** Which grid square a pointer is over, or -1 off the board. */
function cellFromPoint(svg: SVGSVGElement, size: number, x: number, y: number): number {
  const box = svg.getBoundingClientRect();
  if (!box.width || !box.height) return -1;
  const col = Math.floor(((x - box.left) / box.width) * size);
  const row = Math.floor(((y - box.top) / box.height) * size);
  if (col < 0 || row < 0 || col >= size || row >= size) return -1;
  return row * size + col;
}

export const ConnectBoard: React.FC<ActivityProps<ConnectParams>> = ({ params, koda, onComplete, lesson }) => {
  useT();
  // Where in the bank this round starts: random per round so a replay deals
  // different boards, fixed for the round so StrictMode agrees with itself.
  const [offset] = useState(() => params.question?.offset ?? params.offset ?? Math.floor(Math.random() * 1000));
  const setup = useMemo(() => ({ ...params, ...params.question, offset }), [params, offset]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 3;

  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const hintsEnabled = koda.config.isEnabled("move_hints", true) && !setup.noHints;
  const speechRate = koda.config.get("speechRate", 0.95);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    answerSoundDelayMs: (correct) => (correct ? 480 : 200),
    nextQuestion: useCallback((index: number) => buildQuestion(setup, index), [setup]),
    onComplete,
  });
  const question = round.question as ConnectQuestion;
  const { board, mustFill } = question;
  const size = board.size;

  const [lines, setLinesState] = useState<Lines>(() => emptyLines(board));
  const linesRef = useRef(lines);
  const setLines = (next: Lines) => { linesRef.current = next; setLinesState(next); };
  const [history, setHistory] = useState<Lines[]>([]);
  const [nudge, setNudge] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const dragRef = useRef<{ drag: Drag; before: Lines; refused: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Keyed on the question id alone: `board` is a fresh object on every build.
  useEffect(() => {
    setLines(emptyLines(question.board));
    setHistory([]);
    setNudge(null);
    setCursor(question.board.pairs[0]?.[0] ?? 0);
    setDrawing(false);
    dragRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);
  useEffect(() => () => koda.speech.stop(), [koda]);

  const chime = (type: "pop" | "success" | "error") => {
    if (koda.config.isEnabled("sound_chimes", true) && koda.sound.isEnabled()) koda.sound.play(type);
  };
  const buzz = (kind: "tap" | "success") => {
    if (!koda.config.isEnabled("haptic_feedback", true)) return;
    if (kind === "tap") koda.haptics.tap(); else koda.haptics.success();
  };

  const hints = practising || !hintsEnabled ? [] : connectHints(board, lines, { mustFill, kidTip: copy.kidTip });
  const focus = focusColour(board, lines, mustFill);
  const guide = useGuide({
    koda,
    enabled: !practising && hintsEnabled && (guideSetup(params).enabled ?? false) && koda.config.isEnabled("guide_coach", true),
    setup: guideSetup(params),
    questionId: question.id,
    rungs: hints,
    target: focus >= 0 ? board.pairs[focus][0] : -1,
    progress: lines.reduce((n, line) => n + line.length, 0),
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  /** Joins announced as they happen, so a finished pair is felt, not just seen. */
  const announceJoins = (before: Lines, after: Lines) => {
    const newly = board.pairs.some((_, k) => isJoined(board, after, k) && !isJoined(board, before, k));
    if (newly) { chime("pop"); buzz("tap"); }
  };

  /**
   * Scored once the finger lifts: solved, or a finished-looking board that is not.
   *
   * A wrong answer is counted when the board *becomes* fully joined. Reworking
   * lines on a board that was already joined is the child fixing it, not a new
   * answer — scoring each redraw put "Nearly" in front of them after every line.
   */
  const judge = (next: Lines, before: Lines) => {
    if (isSolved(board, next, mustFill)) {
      chime("success");
      buzz("success");
      koda.speech.stop();
      round.submit({ correct: true, given: question.expected ?? "", expected: question.expected, title: td("solved.title"), message: td(mustFill ? "solved.fill" : "solved.join") });
      return;
    }
    const check = checkLines(board, next);
    if (check.joined.length !== board.pairs.length) return;
    if (checkLines(board, before).joined.length === board.pairs.length) return;
    // Every pair joined is an answer the child thinks is finished, so it is
    // scored — that is what makes "right first time" mean something.
    if (mustFill && check.covered < check.open) {
      round.submit({ correct: false, given: `${check.covered} of ${check.open} squares filled`, expected: question.expected, title: td("wrong.title"), message: td("wrong.gaps") });
    } else if (check.stepsOff && board.steps) {
      const vars = { letter: letterOf(board.steps.pair), used: String(next[board.steps.pair].length - 1), steps: String(board.steps.steps) };
      round.submit({ correct: false, given: `${vars.used} steps`, expected: question.expected, title: td("wrong.title"), message: td("wrong.steps", vars) });
    }
  };

  const refusalWords = (why: Refusal): string | null =>
    why === "wall" ? td("refuse.wall") : why === "dot" ? td("refuse.dot")
      : why === "straight" ? td("refuse.straight") : why === "edge" ? td("refuse.edge") : null;

  const begin = (cell: number): boolean => {
    if (round.feedback || round.score) return false;
    const started = startDrag(board, linesRef.current, cell);
    if (!started) return false;
    dragRef.current = { drag: started.drag, before: linesRef.current, refused: false };
    setLines(started.lines);
    setNudge(null);
    guide.moved();
    return true;
  };

  const extend = (cell: number) => {
    const live = dragRef.current;
    if (!live || cell < 0) return;
    const before = linesRef.current;
    const { lines: next, refused } = dragTo(board, before, live.drag, cell);
    if (!sameLines(before, next)) { setLines(next); announceJoins(before, next); }
    // A refusal explains itself once per drag and scores nothing: trying a
    // square to see is how the puzzle is worked out.
    const words = refused ? refusalWords(refused) : null;
    if (words && !live.refused) { live.refused = true; setNudge(words); guide.stumbled(); }
  };

  const finish = () => {
    const live = dragRef.current;
    if (!live) return;
    dragRef.current = null;
    const next = linesRef.current;
    if (sameLines(live.before, next)) return;
    setHistory((h) => [...h, live.before]);
    judge(next, live.before);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const cell = cellFromPoint(svgRef.current, size, e.clientX, e.clientY);
    if (cell < 0 || !begin(cell)) return;
    setCursor(cell);
    setDrawing(false);
    svgRef.current.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !svgRef.current) return;
    extend(cellFromPoint(svgRef.current, size, e.clientX, e.clientY));
  };

  /**
   * The board from a keyboard: arrows move a cursor; Enter or Space on a dot
   * or a line starts drawing, after which arrows draw; Enter, Space or Escape
   * stops. One square per key, the same rules as a finger.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (round.feedback || round.score) return;
    const r = Math.floor(cursor / size), c = cursor % size;
    const moves: Record<string, number> = {
      ArrowUp: r > 0 ? cursor - size : -1,
      ArrowDown: r < size - 1 ? cursor + size : -1,
      ArrowLeft: c > 0 ? cursor - 1 : -1,
      ArrowRight: c < size - 1 ? cursor + 1 : -1,
    };
    if (e.key in moves) {
      e.preventDefault();
      const to = moves[e.key];
      if (to < 0) return;
      if (drawing) {
        extend(to);
        const line = linesRef.current[dragRef.current?.drag.k ?? 0];
        setCursor(line[line.length - 1] ?? to);
      } else setCursor(to);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (drawing) { setDrawing(false); finish(); return; }
      if (begin(cursor)) setDrawing(true);
      return;
    }
    if (e.key === "Escape" && drawing) { e.preventDefault(); setDrawing(false); finish(); }
  };

  const undo = () => {
    if (!history.length || round.feedback) return;
    setLines(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    // No message: taking a line back is a normal move, and the nudge box is
    // titled "Not yet". The status line under the board already says what changed.
    setNudge(null);
    chime("pop");
    guide.moved();
  };
  const startOver = () => {
    setHistory((h) => [...h, linesRef.current]);
    setLines(emptyLines(board));
    setNudge(null);
    guide.moved();
  };

  const check = checkLines(board, lines);
  const anyDrawn = lines.some((l) => l.length > 1);
  const dotAt = new Map<number, number>();
  board.pairs.forEach(([a, b], k) => { dotAt.set(a, k); dotAt.set(b, k); });
  const walls = new Set(board.walls);
  const bridges = new Set(board.bridges ?? []);
  const centre = (cell: number) => ({ x: (cell % size) * U + U / 2, y: Math.floor(cell / size) * U + U / 2 });

  const cellLabel = (cell: number) => {
    const vars = { row: String(Math.floor(cell / size) + 1), col: String((cell % size) + 1) };
    if (walls.has(cell)) return td("cell.wall", vars);
    if (bridges.has(cell)) return td("cell.bridge", vars);
    const dot = dotAt.get(cell);
    if (dot !== undefined) return td("cell.dot", { ...vars, letter: letterOf(dot) });
    const k = lineAt(board, lines, cell);
    return k >= 0 ? td("cell.line", { ...vars, letter: letterOf(k) }) : td("cell.empty", vars);
  };

  const status = mustFill
    ? td("status.fill", { joined: String(check.joined.length), total: String(board.pairs.length), filled: String(check.covered), open: String(check.open) })
    : td("status.join", { joined: String(check.joined.length), total: String(board.pairs.length) });

  return (
    <SkillRound koda={koda} lesson={lesson} fallbackTitle={td("title")} round={round} totalQuestions={total}
      prompt={promptFor(question)} onExit={() => koda.ui.exit()} hints={hints}
      guide={practising ? undefined : guide} guideMethod={copy.stepByStep} nudge={nudge}
      iconName="circleDot" iconTone="pink"
      onStartOver={anyDrawn && !round.feedback ? startOver : undefined}
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(promptFor(question), { rate: speechRate });
      }}>
      <section aria-label={td("board")} className="mx-auto flex w-full max-w-md flex-col gap-3">
        <p className="sr-only" aria-live="polite">{status}</p>
        <div
          role="application"
          tabIndex={0}
          aria-label={`${td("board")}. ${td("keys")} ${cellLabel(cursor)}`}
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onBlur={() => { if (drawing) { setDrawing(false); finish(); } }}
          data-testid="dot-board"
          className="group rounded-3xl bg-surface p-2 shadow-sm ring-1 ring-line focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${size * U} ${size * U}`}
            className="block h-auto w-full touch-none select-none"
            aria-hidden="true"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={finish}
            onLostPointerCapture={finish}>
            {Array.from({ length: size * size }, (_, cell) => {
              const { x, y } = centre(cell);
              const k = bridges.has(cell) ? -1 : lineAt(board, lines, cell);
              const tone = walls.has(cell)
                ? "fill-slate-400 dark:fill-slate-600"
                : k >= 0 ? colour(k).tint : "fill-surface-muted";
              return (
                <g key={cell} data-cell={cell}>
                  <rect x={x - U / 2 + 4} y={y - U / 2 + 4} width={U - 8} height={U - 8} rx={16} className={tone} />
                  {walls.has(cell) && (
                    <path d={`M${x - 22} ${y - 22} L${x + 22} ${y + 22} M${x + 22} ${y - 22} L${x - 22} ${y + 22}`}
                      className="stroke-slate-100 dark:stroke-slate-400" strokeWidth={8} strokeLinecap="round" />
                  )}
                  {bridges.has(cell) && (
                    <rect x={x - U / 2 + 10} y={y - U / 2 + 10} width={U - 20} height={U - 20} rx={12} fill="none"
                      className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={5} strokeDasharray="10 8" data-bridge={cell} />
                  )}
                </g>
              );
            })}

            {lines.map((line, k) => line.length > 1 && (
              <polyline key={k} data-line={k}
                points={line.map((cell) => { const p = centre(cell); return `${p.x},${p.y}`; }).join(" ")}
                fill="none" strokeWidth={U * 0.3} strokeLinecap="round" strokeLinejoin="round" className={colour(k).stroke} />
            ))}

            {/* The line going across a bridge is drawn again on top, with a
                gap either side, so the crossing reads as over-and-under. */}
            {[...bridges].map((b) => {
              const k = lines.findIndex((line) => line.some((cell, i) => cell === b && i > 0 && Math.abs(line[i - 1] - b) === 1));
              if (k < 0) return null;
              const { x, y } = centre(b);
              return (
                <g key={`over-${b}`}>
                  <line x1={x - U / 2} y1={y} x2={x + U / 2} y2={y} strokeWidth={U * 0.46} className="stroke-surface" />
                  <line x1={x - U / 2} y1={y} x2={x + U / 2} y2={y} strokeWidth={U * 0.3} className={colour(k).stroke} />
                </g>
              );
            })}

            {[...dotAt.entries()].map(([cell, k]) => {
              const { x, y } = centre(cell);
              const joined = isJoined(board, lines, k);
              return (
                <g key={`dot-${cell}`} data-dot={letterOf(k)}>
                  {joined && <circle cx={x} cy={y} r={U * 0.42} fill="none" strokeWidth={6} className={colour(k).stroke} opacity={0.45} />}
                  <circle cx={x} cy={y} r={U * 0.34} className={colour(k).fill} />
                  <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fill="#fff"
                    fontSize={U * 0.36} fontWeight={800}>{letterOf(k)}</text>
                  {board.steps?.pair === k && (
                    <g data-steps={board.steps.steps}>
                      <circle cx={x + U * 0.3} cy={y - U * 0.3} r={U * 0.17} className="fill-surface" />
                      <circle cx={x + U * 0.3} cy={y - U * 0.3} r={U * 0.17} fill="none" strokeWidth={4} className={colour(k).stroke} />
                      <text x={x + U * 0.3} y={y - U * 0.3 + 1} textAnchor="middle" dominantBaseline="central"
                        fontSize={U * 0.2} fontWeight={800} className="fill-ink">{board.steps.steps}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {guide.target >= 0 && (
              <rect x={centre(guide.target).x - U / 2 + 2} y={centre(guide.target).y - U / 2 + 2} width={U - 4} height={U - 4} rx={18}
                fill="none" strokeWidth={6} className="stroke-sky-500 dark:stroke-sky-300" data-guide-target={guide.target} />
            )}
            <rect x={centre(cursor).x - U / 2 + 2} y={centre(cursor).y - U / 2 + 2} width={U - 4} height={U - 4} rx={18}
              fill="none" strokeWidth={5} strokeDasharray={drawing ? undefined : "12 8"}
              className="hidden stroke-indigo-500 group-focus-visible:block dark:stroke-indigo-300" />
          </svg>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold tabular-nums text-muted" data-status>
            {status}
            {board.steps && (
              <span className="ml-2 whitespace-nowrap" data-steps-used>
                {td("status.steps", { letter: letterOf(board.steps.pair), used: String(Math.max(0, lines[board.steps.pair].length - 1)), steps: String(board.steps.steps) })}
              </span>
            )}
          </p>
          <button type="button" data-action="undo" onClick={undo} disabled={!history.length || !!round.feedback}
            className="min-h-11 shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-ink disabled:opacity-40">
            {td("undo")}
          </button>
        </div>
      </section>
    </SkillRound>
  );
};
