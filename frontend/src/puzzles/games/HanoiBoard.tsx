/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Drawing the tower. A tap picks a peg up, a second tap puts it down — the same
 * two-tap grammar Liquid Sort and Goods Sort already use, so a child moving between
 * puzzles does not relearn the gesture.
 *
 * Selection is local state because it is *pointing*, not playing: nothing has happened
 * to the board until the second tap, so it must not enter the undo history.
 */

import React, { useState } from "react";
import { PuzzlePlay } from "../usePuzzlePlay";
import { HanoiBoard as Board, HanoiMove } from "./hanoi";

const DISK_COLOURS = [
  "bg-violet-500", "bg-sky-500", "bg-emerald-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500",
];

export const HanoiBoard: React.FC<{
  play: PuzzlePlay<Board, HanoiMove>;
  isDark?: boolean;
}> = ({ play, isDark = false }) => {
  const [picked, setPicked] = useState<number | null>(null);
  const { board, legalMoves, hint } = play;

  const totalDisks = board.pegs.reduce((sum, peg) => sum + peg.length, 0);
  const canLeave = (peg: number) => legalMoves.some(move => move.from === peg);
  const canLand = (peg: number) =>
    picked !== null && legalMoves.some(move => move.from === picked && move.to === peg);

  const tapPeg = (peg: number) => {
    if (play.isWon) return;
    if (picked === null) {
      if (canLeave(peg)) setPicked(peg);
      return;
    }
    if (peg === picked) {
      setPicked(null);              // tapping the held peg again puts it back down
      return;
    }
    if (canLand(peg)) play.play({ from: picked, to: peg });
    // An illegal target deselects rather than silently doing nothing, so the board
    // never sits in a state the child cannot explain.
    setPicked(null);
  };

  return (
    <div className="flex w-full max-w-[min(460px,90vw)] items-end justify-center gap-3 sm:gap-5">
      {board.pegs.map((peg, index) => {
        const isPicked = picked === index;
        const isTarget = canLand(index);
        const isHintSource = hint?.from === index && picked === null;
        const isHintTarget = hint?.to === index && picked === hint?.from;

        return (
          <button
            key={index}
            type="button"
            onClick={() => tapPeg(index)}
            aria-label={`Peg ${index + 1}, ${peg.length} disks`}
            className={`relative flex-1 flex flex-col-reverse items-center justify-start gap-1
              rounded-2xl px-1.5 pt-3 pb-2 transition-colors min-h-[150px]
              ${isDark ? "bg-slate-800/50" : "bg-slate-100/80"}
              ${isPicked || isTarget || isHintSource || isHintTarget
                ? "ring-4 ring-violet-400"
                : ""}`}
            style={{ minHeight: `${Math.max(150, totalDisks * 26 + 40)}px` }}
          >
            {/* The post, behind the disks. */}
            <div
              className={`absolute bottom-2 top-3 w-1.5 rounded-full ${
                isDark ? "bg-slate-700" : "bg-slate-300"
              }`}
              aria-hidden
            />
            {peg.map((disk, height) => {
              // The topmost disk of the held peg floats, so "picked up" is visible.
              const lifted = isPicked && height === peg.length - 1;
              return (
                <div
                  key={disk}
                  className={`relative rounded-full h-5 sm:h-6 flex items-center justify-center
                    text-[10px] sm:text-xs font-black text-white shadow transition-transform
                    ${DISK_COLOURS[(disk - 1) % DISK_COLOURS.length]}
                    ${lifted ? "-translate-y-2 scale-105" : ""}`}
                  style={{ width: `${28 + disk * 11}%` }}
                >
                  {disk}
                </div>
              );
            })}
          </button>
        );
      })}
    </div>
  );
};
