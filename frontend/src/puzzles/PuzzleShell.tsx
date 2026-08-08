/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The chrome around any puzzle board: header, live counters, Undo / Reset / Hint,
 * and the celebration on a win.
 *
 * It is `SharedCanvasLayout` underneath, so a puzzle sits in the same frame as the
 * twenty-six other canvases — the header banner, the fading hint line and the grid
 * are not re-invented here. What this adds is the row of controls every puzzle needs
 * and each one currently draws itself.
 */

import React from "react";
import { RotateCcw, Undo2, Lightbulb, Star } from "lucide-react";
import { SharedCanvasLayout } from "../components/canvases/SharedCanvasLayout";
import { CanvasAccent, CanvasChip, hairlineClass } from "../components/canvases/canvasTheme";
import { Celebration } from "../components/canvases/Celebration";
import { PuzzlePlay, formatTime } from "./usePuzzlePlay";

export interface PuzzleShellProps<Board, Move> {
  play: PuzzlePlay<Board, Move>;
  /** Activity name — "Sliding Tiles", not the slide title. */
  title: string;
  /** What to do, in a child's words. Becomes the heading for a learner. */
  instruction: string;
  headerIcon?: React.ReactNode;
  accent?: CanvasAccent;
  isDark?: boolean;
  /** Shown on the win, e.g. "Level 4 solved in 18 moves". */
  solvedMessage?: string;
  /** The board itself. */
  children: React.ReactNode;
}

/** One control, styled the same whichever puzzle uses it. */
const ShellButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  isDark: boolean;
  emphasis?: boolean;
}> = ({ onClick, disabled, icon, label, isDark, emphasis = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[11px] font-bold
      transition-colors disabled:opacity-40 disabled:cursor-not-allowed
      ${emphasis
        ? isDark
          ? "bg-violet-500/15 border-violet-400/40 text-violet-200 hover:bg-violet-500/25"
          : "bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100"
        : isDark
          ? "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
  >
    {icon}
    {label}
  </button>
);

export function PuzzleShell<Board, Move>({
  play,
  title,
  instruction,
  headerIcon,
  accent = "violet",
  isDark = false,
  solvedMessage,
  children,
}: PuzzleShellProps<Board, Move>) {
  return (
    <SharedCanvasLayout
      isPlayMode
      isDark={isDark}
      accent={accent}
      headerIcon={headerIcon}
      headerTitle={title}
      headerSubtitle={play.isWon ? solvedMessage ?? "Solved!" : instruction}
      readAloudText={instruction}
      headerActions={
        <>
          <CanvasChip accent={play.isWon ? "emerald" : accent} isDark={isDark}>
            {play.moveCount} {play.moveCount === 1 ? "move" : "moves"}
          </CanvasChip>
          <CanvasChip accent={play.isWon ? "emerald" : accent} isDark={isDark}>
            {formatTime(play.seconds)}
          </CanvasChip>
        </>
      }
      footerStatus={play.isWon ? solvedMessage ?? "Solved!" : undefined}
      footerSolved={play.isWon}
      playHint={instruction}
    >
      <div className="relative flex-1 flex flex-col min-h-0 gap-3">
        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          {children}
          <Celebration show={play.isWon} />
        </div>

        {/*
          Controls sit below the board rather than in the header: a child reaches for
          Undo constantly and the header is where an adult's chrome lives. Hidden once
          the puzzle is won — there is nothing left to undo or hint at, and leaving them
          invites a child to keep poking a finished board.
        */}
        {!play.isWon ? (
          <div
            className={`flex-shrink-0 flex items-center justify-center gap-2 pt-2 border-t ${hairlineClass(isDark)}`}
          >
            <ShellButton
              onClick={play.undo}
              disabled={!play.canUndo}
              icon={<Undo2 size={13} />}
              label="Undo"
              isDark={isDark}
            />
            <ShellButton
              onClick={play.reset}
              icon={<RotateCcw size={13} />}
              label="Reset"
              isDark={isDark}
            />
            <ShellButton
              onClick={play.requestHint}
              icon={<Lightbulb size={13} />}
              // The label carries the two-tap behaviour, so a child is told what the
              // second tap will do instead of discovering it.
              label={play.hint ? "Play it" : "Hint"}
              isDark={isDark}
              emphasis={Boolean(play.hint)}
            />
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center justify-center gap-1.5 pt-2">
            {[1, 2, 3].map(index => (
              <Star
                key={index}
                size={22}
                className={
                  index <= play.stars
                    ? "text-emerald-500 fill-emerald-500"
                    : isDark ? "text-slate-700" : "text-slate-200"
                }
              />
            ))}
          </div>
        )}
      </div>
    </SharedCanvasLayout>
  );
}
