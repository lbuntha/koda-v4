import React, { useMemo } from "react";
import { motion } from "motion/react";
import { SPRING, useMotionOK } from "../../kit";
import { counted, governed, neighbors, scopeOf, type Assignment, type Board, type Clue, type Color } from "./board";
import { BOARD_LAYOUT, MOTION_PLAN, boardLayout } from "./layout";
import { PALETTE } from "./palette";

/**
 * The apparatus. Every engine in this skill draws its board through here.
 *
 * Colour is never the only carrier: each tile shows its permanent symbol and
 * its letter as well as its fill, so the board survives colour blindness, a
 * greyscale printer and a screen in bright sun. That is not an accessibility
 * mode to switch on — a board that reads one way with symbols and another way
 * without is two different puzzles, and only one of them was tested.
 *
 * It renders and reports taps. It holds no round state, judges nothing and
 * knows no answer, so an engine cannot leak one through it.
 */

export interface BoardGridProps {
  board: Board;
  /**
   * What the board asks of a tap.
   *
   * `select` marks tiles — the child is pointing at them, and the tile's colour
   * is the board's business. `paint` gives a tile a colour, and only the blank
   * ones will take it: a fixed tile is the puzzle's own evidence, and a board
   * whose clues could be edited is not a puzzle.
   */
  mode?: "select" | "paint";
  /**
   * Colours as they stand now — the fixed givens plus whatever has been
   * painted. Omit for a board nobody has touched.
   *
   * Never the solution. This is the visible state and nothing else; an engine
   * that passed its answer key here would be drawing it on the screen.
   */
  assignment?: Assignment;
  /** Outlined as the tile the question is about. */
  target?: number;
  /** Cells the child has chosen so far. `select` only. */
  selected?: readonly number[];
  /** Omit to render a board that cannot be touched — a worked figure, or paper. */
  onTap?: (cell: number) => void;
  /** Stops input without grey-ing the board out: the picture is still the question. */
  locked?: boolean;
  /**
   * Numbers the chosen tiles in the order they were tapped.
   *
   * The `counting_badges` feature. Selecting eight tiles and losing count of
   * which are already in is the failure this prevents; the tick alone says
   * "chosen" but not "how many so far".
   */
  showBadges?: boolean;
  /** Width the board may use. Below its own minimum it scrolls inside itself. */
  availableWidth?: number;
  /** Announced before the grid, e.g. "Board with one clue". */
  label?: string;
}

const rowCol = (cell: number, size: number) => [Math.floor(cell / size) + 1, (cell % size) + 1];

/** What a clue drawn beside the board says it counts over. */
export function scopeLabel(clue: Clue): string {
  const scope = scopeOf(clue);
  switch (scope.kind) {
    case "board": return "Whole board";
    case "line": return `${scope.axis === "row" ? "Row" : "Column"} ${scope.index + 1}`;
    case "region": return "Outlined area";
    case "neighborhood": return "Touching tiles";
  }
}

/** A clue with no tile of its own, in words. */
export const chipText = (clue: Clue): string => {
  const colour = PALETTE[counted(clue)].name.toLowerCase();
  /* Hexcells writes these `{n}` and `-n-`. Spelled out here as well, because a
     child meeting braces for the first time has nothing to read them with. */
  const run = clue.run === "together" ? `${clue.count} ${colour} together`
    : clue.run === "apart" ? `${clue.count} ${colour}, not together`
    : `${clue.count} ${colour}`;
  return `${scopeLabel(clue)}: ${run}`;
};

/** Where the board's entrance starts. Readable on its own, so a dropped frame
 *  costs the flourish and not the puzzle. */
export const BOARD_ENTER_FLOOR = 0.55;

/** What a screen reader hears. The same facts the sighted child reads off the tile. */
export function tileLabel(board: Board, cell: number, target?: number, assignment?: Assignment): string {
  const [row, col] = rowCol(cell, board.size);
  const color = (assignment ?? board.givens)[cell];
  const clue = board.clues.find((c) => c.cell === cell);
  const where = `Row ${row}, column ${col}`;
  const fixed = board.givens[cell] !== null;
  const what = color ? `${PALETTE[color].name}${fixed ? "" : ", painted"}` : "blank";
  const says = clue ? `, clue counting ${PALETTE[counted(clue)].name.toLowerCase()}: ${clue.count}` : "";
  const region = board.clues.some((c) => (c.scope?.kind === "region") && c.scope.cells.includes(cell))
    ? ", inside the outlined area" : "";
  return `${where}, ${what}${says}${region}${cell === target ? ", the outlined tile" : ""}`;
}

export const BoardGrid: React.FC<BoardGridProps> = ({
  board,
  mode = "select",
  assignment,
  target,
  selected = [],
  onTap,
  locked = false,
  showBadges = false,
  availableWidth = 320,
  label,
}) => {
  const motionOK = useMotionOK();
  const layout = useMemo(() => boardLayout(board.size, availableWidth), [board.size, availableWidth]);
  const chosen = useMemo(() => new Map(selected.map((cell, i) => [cell, i + 1])), [selected]);
  /* Announced with the board so a child using a reader knows the shape of the
     thing before they start moving through nine buttons. */
  const around = target === undefined ? [] : neighbors(target, board.size);
  const heading = label ?? `${board.size} by ${board.size} board`;
  const offBoard = board.clues.filter((c) => scopeOf(c).kind !== "neighborhood");
  /* Region membership is not something a child can work out from a position,
     so it has to be drawn on the tiles themselves. */
  const inRegion = new Set(
    board.clues.filter((c) => scopeOf(c).kind === "region").flatMap((c) => governed(c, board.size)),
  );

  return (
    <div
      className={layout.scrollInside ? "max-w-full overflow-x-auto min-w-0 -mx-2 px-2" : "min-w-0"}
      role="group"
      aria-label={`${heading}. ${target === undefined ? "" : `The outlined tile touches ${around.length} tiles.`}`}
    >
      {/*
        * §18: one brief fade for the whole board, and no stagger.
        *
        * Keyed on the board's identity so a new question fades in and a tap
        * inside the same question does not. A stagger was the tempting choice
        * and is forbidden: tiles arriving one after another draws the eye
        * along an order the puzzle did not choose, and on a select-the-
        * neighbours board that order would point at the answer.
        *
        * It fades up from readable, never from invisible. §18's rule is that
        * animation completion is never required for correctness, and
        * `opacity: 0` breaks it — a device that drops the frames leaves a
        * child looking at an empty board with no way to know why. Measured
        * in an automation tab whose compositor produced one frame in 27
        * seconds: from zero the board never appeared; from here it is legible
        * throughout and the fade is decoration on top.
        */}
      {/*
        * Clues that sit beside the board rather than on it.
        *
        * §2 puts a line clue in a gutter beside its row. Drawn as a strip
        * above the board instead, with the row named in words: a gutter needs
        * the grid and the chip to share a layout, and a chip that says "Row 2"
        * is unambiguous in a screen reader, in print and at 360px, which the
        * gutter would have to earn separately in all three.
        */}
      {offBoard.length ? (
        <div className="mx-auto mb-2 flex flex-wrap items-center justify-center gap-2" style={{ maxWidth: layout.width }}>
          {offBoard.map((clue) => (
            <span
              key={clue.id}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-ink/20 bg-surface px-2 py-1 text-xs font-black text-ink"
            >
              <span
                aria-hidden
                className="rounded px-1"
                style={{ background: PALETTE[counted(clue)].fill, color: PALETTE[counted(clue)].ink }}
              >
                {PALETTE[counted(clue)].symbol}
              </span>
              {chipText(clue)}
            </span>
          ))}
        </div>
      ) : null}

      <motion.div
        key={`${board.size}:${board.givens.join("")}`}
        initial={motionOK ? { opacity: BOARD_ENTER_FLOOR } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: MOTION_PLAN.boardEnterMs / 1000 }}
        className="mx-auto grid"
        style={{
          width: layout.width,
          padding: BOARD_LAYOUT.inset,
          gap: BOARD_LAYOUT.gap,
          gridTemplateColumns: `repeat(${board.size}, ${layout.tile}px)`,
        }}
      >
        {(assignment ?? board.givens).map((color: Color | null, cell: number) => {
          const clue: Clue | undefined = board.clues.find((c) => c.cell === cell);
          const isTarget = cell === target;
          const badge = mode === "select" ? chosen.get(cell) : undefined;
          const paint = color ? PALETTE[color] : undefined;
          /* A fixed tile is the puzzle's evidence and never takes a colour. */
          const editable = mode === "select" || board.givens[cell] === null;
          const painted = mode === "paint" && board.givens[cell] === null && color !== null;
          const interactive = Boolean(onTap) && !locked && editable;
          const Tile = interactive ? motion.button : "div";
          return (
            <Tile
              key={cell}
              {...(interactive
                ? {
                    type: "button" as const,
                    onClick: () => onTap?.(cell),
                    ...(mode === "select" ? { "aria-pressed": badge !== undefined } : {}),
                    whileTap: motionOK ? { scale: 0.94 } : undefined,
                    transition: SPRING.tap,
                  }
                : { role: "img" as const })}
              aria-label={tileLabel(board, cell, target, assignment)}
              /*
               * One outline, one meaning.
               *
               * The board marks its own tile in ink and the child's choices in
               * violet, and the two never swap. They read as the same event
               * when both were violet — "the tile we are asking about" and "a
               * tile I picked" looked alike, which is exactly the confusion
               * level 1 exists to remove. Ink flips with the theme, so the
               * dark ring stays visible on both grounds.
               */
              className={[
                "relative grid place-items-center rounded-xl border-2 font-black tabular-nums",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                paint ? "" : "border-dashed border-ink/25 bg-surface",
                isTarget ? "ring-4 ring-ink ring-offset-2 ring-offset-surface" : "",
                /*
                 * Board furniture, drawn with the board and never on request —
                 * the outline is part of the puzzle, not a hint about it.
                 *
                 * Rose rather than violet: violet already means "a tile I
                 * chose", and a region drawn in it would say the board had
                 * pre-selected five tiles. Rose is used for nothing else here,
                 * and is distinct from all three tile colours.
                 */
                inRegion.has(cell) && !isTarget ? "outline outline-2 outline-offset-[3px] outline-rose-500" : "",
                badge !== undefined ? "border-violet-500 ring-4 ring-violet-500 ring-offset-2 ring-offset-surface" : "",
                /* Violet is the child's own mark, wherever it appears: a tile
                   they painted is theirs, and a fixed tile is the puzzle's. */
                painted && badge === undefined ? "border-violet-500" : paint && badge === undefined ? "border-ink/15" : "",
              ].join(" ")}
              style={{
                width: layout.tile,
                height: layout.tile,
                background: paint?.fill,
                color: paint?.ink,
                fontSize: Math.round(layout.tile * 0.42),
              }}
            >
              {clue ? <span>{clue.count}</span> : null}
              {/* A clue that counts a colour it is not must say so on its face.
                  Without this the 1-2-1 wall is three orange tiles showing
                  numbers, and nothing on screen says what they are counting. */}
              {clue && counted(clue) !== clue.color ? (
                <span
                  aria-hidden
                  className="absolute rounded px-1 leading-tight"
                  style={{
                    right: 3,
                    bottom: 2,
                    background: PALETTE[counted(clue)].fill,
                    color: PALETTE[counted(clue)].ink,
                    fontSize: Math.round(layout.tile * 0.28),
                  }}
                >
                  {PALETTE[counted(clue)].symbol}
                </span>
              ) : null}
              {/* A clue's symbol is the colour it counts, not the colour it is
                  written on. On a cross-colour clue both were drawn at once and
                  the larger of the two was the one a child does not need: the
                  tile's own colour is already carried by its fill and letter,
                  while what it counts is the whole clue. */}
              {paint && !(clue && counted(clue) !== clue.color) ? (
                <span
                  aria-hidden
                  className="absolute"
                  style={
                    clue
                      ? { right: 4, bottom: 2, fontSize: Math.round(layout.tile * 0.26) }
                      : { fontSize: Math.round(layout.tile * 0.5) }
                  }
                >
                  {paint.symbol}
                </span>
              ) : paint ? null : (
                <span aria-hidden className="text-ink/40">?</span>
              )}
              {paint ? (
                <span aria-hidden className="absolute left-1 top-0 text-xs font-black">
                  {paint.letter}
                </span>
              ) : null}
              {badge !== undefined ? (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-violet-500 bg-surface text-[11px] font-black text-ink"
                >
                  {showBadges ? badge : "✓"}
                </span>
              ) : null}
            </Tile>
          );
        })}
      </motion.div>
    </div>
  );
};
