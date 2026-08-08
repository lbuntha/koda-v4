/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawing sliding tiles. This is the *whole* of what is puzzle-specific about the UI —
 * the header, counters, Undo / Reset / Hint, stars and celebration all come from
 * `PuzzleShell`, and none of the state is held here.
 */

import React from "react";
import { PuzzlePlay } from "../usePuzzlePlay";
import { TileBoard, TileMove } from "./slidingTile";

export const SlidingTileBoard: React.FC<{
  play: PuzzlePlay<TileBoard, TileMove>;
  isDark?: boolean;
}> = ({ play, isDark = false }) => {
  const { board, legalMoves, hint } = play;
  const movable = new Set(legalMoves);

  return (
    <div
      className="grid gap-1.5 w-full max-w-[min(340px,70vh)] aspect-square"
      style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
    >
      {board.tiles.map((tile, position) => {
        if (tile === 0) return <div key={position} aria-hidden />;
        const canMove = movable.has(position);
        const isHinted = hint === position;
        // Home is where this tile belongs; a tile already there is quietly confirmed
        // rather than celebrated, so the remaining work is what stands out.
        const atHome = tile === position + 1;

        return (
          <button
            key={position}
            type="button"
            onClick={() => canMove && play.play(position)}
            disabled={!canMove || play.isWon}
            aria-label={`Tile ${tile}${canMove ? ", can move" : ""}`}
            className={`rounded-xl font-black tabular-nums flex items-center justify-center
              transition-[background-color,box-shadow,transform] duration-150 select-none
              text-[clamp(1rem,5vw,1.75rem)]
              ${canMove && !play.isWon ? "cursor-pointer hover:scale-[1.03]" : "cursor-default"}
              ${isHinted ? "ring-4 ring-violet-400 animate-pulse" : ""}
              ${atHome
                ? isDark
                  ? "bg-emerald-500/15 text-emerald-300 shadow-inner"
                  : "bg-emerald-50 text-emerald-700 shadow-inner"
                : isDark
                  ? "bg-slate-800 text-slate-200 shadow-md"
                  : "bg-white text-slate-700 shadow-md"}`}
          >
            {tile}
          </button>
        );
      })}
    </div>
  );
};
