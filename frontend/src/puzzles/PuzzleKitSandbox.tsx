/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A bench for the puzzle kit — `?preview=puzzle-kit` in dev.
 *
 * Two puzzles that share every line of machinery and no line of subject matter, so
 * what the kit gives you and what a new puzzle still has to write are visible side by
 * side. Also shows the certification report, because "40 levels" is only worth
 * anything if something proved they can all be finished.
 */

import React, { useMemo, useState } from "react";
import { Grid3x3, Layers, CheckCircle2, XCircle } from "lucide-react";

import { PuzzleRules } from "./rules";
import { Ladder } from "./ladder";
import { generateBoard } from "./generate";
import { certifyLadder, CertifiedLevel } from "./certify";
import { usePuzzlePlay, PuzzleSolveReport } from "./usePuzzlePlay";
import { PuzzleShell } from "./PuzzleShell";

import { slidingTileRules, slidingTileLadder, solvedTileBoard, TileBoard, TileMove, TileParams } from "./games/slidingTile";
import { SlidingTileBoard } from "./games/SlidingTileBoard";
import { hanoiRules, hanoiLadder, solvedHanoiBoard, HanoiBoard as HanoiBoardState, HanoiMove, HanoiParams } from "./games/hanoi";
import { HanoiBoard } from "./games/HanoiBoard";

/** One demo: a rules module, its ladder, and how to draw its board. */
interface Demo<Board, Move, Params> {
  key: string;
  name: string;
  icon: React.ReactNode;
  instruction: string;
  rules: PuzzleRules<Board, Move>;
  ladder: Ladder<Params>;
  buildSolved: (params: Params) => Board;
  renderBoard: (play: ReturnType<typeof usePuzzlePlay<Board, Move>>) => React.ReactNode;
  /** What the solver does for this puzzle, and why. */
  searchNote: string;
}

const tileDemo: Demo<TileBoard, TileMove, TileParams> = {
  key: "sliding-tile",
  name: "Sliding Tiles",
  icon: <Grid3x3 size={16} />,
  instruction: "Slide the tiles until they read 1, 2, 3… in order.",
  rules: slidingTileRules,
  ladder: slidingTileLadder,
  buildSolved: solvedTileBoard,
  renderBoard: play => <SlidingTileBoard play={play} />,
  searchNote: "Supplies heuristic() → A*. A 4x4 board is ~10^13 positions; a breadth-first sweep cannot reach its solutions.",
};

const hanoiDemo: Demo<HanoiBoardState, HanoiMove, HanoiParams> = {
  key: "hanoi",
  name: "Tower of Hanoi",
  icon: <Layers size={16} />,
  instruction: "Move every disk to the last peg. Never put a big disk on a small one.",
  rules: hanoiRules,
  ladder: hanoiLadder,
  buildSolved: solvedHanoiBoard,
  renderBoard: play => <HanoiBoard play={play} />,
  searchNote: "No heuristic() → breadth-first, then depth-first. Its state space is 3^n, small enough to sweep.",
};

const Panel: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
    <header className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
      <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{title}</h2>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

/** One playable demo plus everything the kit derived for it. */
function DemoView<Board, Move, Params>({ demo }: { demo: Demo<Board, Move, Params> }) {
  const [levelId, setLevelId] = useState(demo.ladder.all[0].id);
  const [report, setReport] = useState<PuzzleSolveReport<Board> | null>(null);

  const level = demo.ladder.getLevel(levelId);

  // Certification is the same call the unit test and the export make. Memoised because
  // it solves every level; the numbers below are measured, not claimed.
  const certified = useMemo(
    () => certifyLadder(demo.rules, demo.ladder, demo.buildSolved),
    [demo],
  );
  const parMoves = certified.find(entry => entry.id === levelId)?.solutionMoves ?? undefined;

  // Must be stable per level: `usePuzzlePlay` restarts whenever the board identity
  // changes, so building it inline would reset the puzzle on every render.
  const initialBoard = useMemo(
    () =>
      generateBoard(demo.rules, demo.buildSolved(level.params), {
        moves: level.scramble,
        seed: level.id,
        minSolution: level.minSolution,
      }),
    [demo, level],
  );

  const play = usePuzzlePlay<Board, Move>({
    rules: demo.rules,
    initialBoard,
    levelId,
    parMoves,
    onSolved: setReport,
  });

  const broken = certified.filter(entry => !entry.ok);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 h-[540px] flex flex-col">
          <PuzzleShell
            play={play}
            title={demo.name}
            instruction={demo.instruction}
            headerIcon={demo.icon}
            solvedMessage={`${level.title} — solved in ${play.moveCount} moves`}
          >
            {demo.renderBoard(play)}
          </PuzzleShell>
        </div>

        <Panel
          title="The win payload"
          hint="What the server grades. The board itself, never a claim of success."
        >
          {report ? (
            <pre className="text-[11px] leading-relaxed text-slate-600 overflow-x-auto">
              {JSON.stringify(
                { ...report, selected: demo.rules.key(report.selected) },
                null,
                2,
              )}
            </pre>
          ) : (
            <p className="text-xs text-slate-400">Finish the puzzle to see it.</p>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel title="Levels" hint={`${certified.length} rungs · every board generated and solved to prove it finishes`}>
          <div className="space-y-1">
            {certified.map(entry => (
              <LevelRow
                key={entry.id}
                entry={entry}
                active={entry.id === levelId}
                onPick={() => {
                  setLevelId(entry.id);
                  setReport(null);
                }}
              />
            ))}
          </div>
          {broken.length > 0 && (
            <p className="mt-3 text-[11px] font-bold text-rose-600">
              {broken.length} level(s) failed certification — the seed refuses to author these.
            </p>
          )}
        </Panel>

        <Panel title="Search" hint="Chosen by the rules file, not by a separate code path">
          <p className="text-xs text-slate-600 leading-relaxed">{demo.searchNote}</p>
        </Panel>
      </div>
    </div>
  );
}

const LevelRow: React.FC<{
  entry: CertifiedLevel<unknown>;
  active: boolean;
  onPick: () => void;
}> = ({ entry, active, onPick }) => (
  <button
    type="button"
    onClick={onPick}
    className={`w-full text-left rounded-lg px-2.5 py-1.5 flex items-center gap-2 transition-colors
      ${active ? "bg-violet-50 ring-1 ring-violet-300" : "hover:bg-slate-50"}`}
  >
    {entry.ok ? (
      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
    ) : (
      <XCircle size={14} className="text-rose-500 flex-shrink-0" />
    )}
    <span className="flex-1 min-w-0">
      <span className="block text-xs font-bold text-slate-700 truncate">{entry.title}</span>
      <span className="block text-[10px] text-slate-400 truncate">
        {entry.tier}
        {entry.problems.length > 0 && ` · ${entry.problems[0]}`}
      </span>
    </span>
    <span className="text-[10px] font-mono font-black text-slate-400 tabular-nums flex-shrink-0">
      {entry.solutionMoves ?? "—"}
    </span>
  </button>
);

export const PuzzleKitSandbox: React.FC = () => {
  const [active, setActive] = useState<"sliding-tile" | "hanoi">("sliding-tile");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-black tracking-tight">Puzzle kit</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Two puzzles with nothing in common but their machinery. Undo, the clock, the
            hint, the stars, the levels and the win payload all come from the shared kit —
            each puzzle only writes its rules and draws its own board.
          </p>
        </header>

        <div className="flex gap-2">
          {[tileDemo, hanoiDemo].map(demo => (
            <button
              key={demo.key}
              type="button"
              onClick={() => setActive(demo.key as "sliding-tile" | "hanoi")}
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-full border text-xs font-bold transition-colors
                ${active === demo.key
                  ? "bg-violet-600 border-violet-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {demo.icon}
              {demo.name}
            </button>
          ))}
        </div>

        {/*
          `key` is load-bearing. Both branches render a `DemoView` in the same slot, so
          without it React keeps the instance and its state across the switch — and the
          level id and last win report from one puzzle are then read by the other's rules,
          which is a crash, not a glitch.
        */}
        {active === "sliding-tile" ? (
          <DemoView key="sliding-tile" demo={tileDemo} />
        ) : (
          <DemoView key="hanoi" demo={hanoiDemo} />
        )}
      </div>
    </div>
  );
};
