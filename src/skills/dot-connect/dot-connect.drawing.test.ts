import { describe, expect, it } from "vitest";
import { isSolved } from "./internal/check";
import { dragTo, emptyLines, isJoined, placeLine, startDrag, stepTo } from "./internal/drawing";
import type { Board } from "./internal/types";

/*
 * 3×3, cells numbered
 *   0 1 2
 *   3 4 5
 *   6 7 8
 * A joins 0 → 2 along the top; B joins 6 → 8 along the bottom.
 */
const board: Board = { size: 3, walls: [], pairs: [[0, 2], [6, 8]], solution: [[0, 1, 2], [6, 7, 8]] };

const begin = (b: Board, lines: number[][], cell: number) => {
  const started = startDrag(b, lines, cell);
  if (!started) throw new Error(`nothing to draw from at ${cell}`);
  return started;
};

describe("drawing a line", () => {
  it("starts on a dot and steps square by square to its twin", () => {
    const { lines, drag } = begin(board, emptyLines(board), 0);
    const one = stepTo(board, lines, drag, 1) as number[][];
    const two = stepTo(board, one, drag, 2) as number[][];
    expect(two[0]).toEqual([0, 1, 2]);
    expect(isJoined(board, two, 0)).toBe(true);
  });

  it("will not start on an empty square", () => {
    expect(startDrag(board, emptyLines(board), 4)).toBeNull();
  });

  it("refuses diagonal jumps, foreign dots and walls, and says why", () => {
    const { lines, drag } = begin(board, emptyLines(board), 0);
    expect(stepTo(board, lines, drag, 4)).toBe("far");
    const down = stepTo(board, lines, drag, 3) as number[][];
    expect(stepTo(board, down, drag, 6)).toBe("dot");
    const walled = { ...board, walls: [1] };
    const w = begin(walled, emptyLines(walled), 0);
    expect(stepTo(walled, w.lines, w.drag, 1)).toBe("wall");
  });

  it("stops at its twin: a joined line goes no further", () => {
    const { lines, drag } = begin(board, emptyLines(board), 0);
    const joined = dragTo(board, lines, drag, 2).lines;
    expect(stepTo(board, joined, drag, 5)).toBe("done");
  });

  it("walks back along itself when the finger goes back", () => {
    const { lines, drag } = begin(board, emptyLines(board), 0);
    const out = dragTo(board, lines, drag, 4).lines;
    expect(out[0].length).toBeGreaterThan(2);
    const back = stepTo(board, out, drag, out[0][out[0].length - 2]) as number[][];
    expect(back[0]).toEqual(out[0].slice(0, -1));
  });

  it("cuts a line it crosses, and gives it back when pulled away in the same drag", () => {
    // B is drawn first along the middle row: 6 → 3 → 4 → 5 → 8.
    let lines = emptyLines(board);
    const b = begin(board, lines, 6);
    lines = dragTo(board, b.lines, b.drag, 3).lines;
    for (const cell of [4, 5, 8]) lines = stepTo(board, lines, b.drag, cell) as number[][];
    expect(isJoined(board, lines, 1)).toBe(true);

    // A goes down through B's middle square.
    const a = begin(board, lines, 0);
    let mid = stepTo(board, a.lines, a.drag, 1) as number[][];
    mid = stepTo(board, mid, a.drag, 4) as number[][];
    expect(mid[1]).toEqual([6, 3]); // cut back before the square A took
    const restored = stepTo(board, mid, a.drag, 1) as number[][];
    expect(restored[1]).toEqual([6, 3, 4, 5, 8]);
  });

  it("restarts a line when its dot is pressed again, and resumes from a square on it", () => {
    let lines = emptyLines(board);
    const a = begin(board, lines, 0);
    lines = dragTo(board, a.lines, a.drag, 2).lines;
    expect(begin(board, lines, 2).lines[0]).toEqual([2]);
    expect(begin(board, lines, 1).lines[0]).toEqual([0, 1]);
  });

  it("dragging across several squares at once still moves one square at a time", () => {
    const { lines, drag } = begin(board, emptyLines(board), 0);
    const far = dragTo(board, lines, drag, 2).lines;
    expect(far[0]).toEqual([0, 1, 2]);
  });

  it("placeLine draws an answer line and cuts what was in its way", () => {
    const lines = [[], [6, 3, 4, 5, 8]];
    const placed = placeLine(board, lines, 0, [0, 1, 2]);
    expect(placed[0]).toEqual([0, 1, 2]);
    expect(placed[1]).toEqual([6, 3, 4, 5, 8]);
    const blocking = placeLine(board, [[], [6, 3, 0]], 0, [0, 1, 2]);
    expect(blocking[1]).toEqual([6, 3]);
  });
});

describe("bridges", () => {
  /*
   * 3×3 with a bridge in the middle (4).
   * A: 3 → 4 → 5 across; B: 1 → 4 → 7 down. Corners filled by C and D.
   */
  const bridged: Board = {
    size: 3, walls: [], bridges: [4],
    pairs: [[1, 7], [3, 5]],
    solution: [[1, 4, 7], [3, 4, 5]],
  };

  it("lets two lines share the bridge, one across and one down", () => {
    let lines = emptyLines(bridged);
    const a = begin(bridged, lines, 3);
    lines = dragTo(bridged, a.lines, a.drag, 5).lines;
    expect(lines[1]).toEqual([3, 4, 5]);
    const b = begin(bridged, lines, 1);
    lines = dragTo(bridged, b.lines, b.drag, 7).lines;
    expect(lines[0]).toEqual([1, 4, 7]);
    expect(lines[1]).toEqual([3, 4, 5]); // not cut: it uses the other way
  });

  it("makes a line go straight over", () => {
    const { lines, drag } = begin(bridged, emptyLines(bridged), 3);
    const on = stepTo(bridged, lines, drag, 4) as number[][];
    expect(stepTo(bridged, on, drag, 1)).toBe("straight");
  });

  it("is not full until both ways are used", () => {
    const board4 = { ...bridged, size: 3 };
    expect(isSolved(board4, [[1, 4, 7], [3, 4, 5]], false)).toBe(true);
  });

  it("refuses to cross a bridge on the edge of the board", () => {
    const edge: Board = { size: 3, walls: [], bridges: [1], pairs: [[0, 8], [3, 5]], solution: [] };
    const { lines, drag } = begin(edge, emptyLines(edge), 0);
    expect(stepTo(edge, lines, drag, 1)).not.toBe("edge"); // across is fine: 0 → 1 → 2
    const fromBelow = begin(edge, [[], [3]], 3);
    const up = stepTo(edge, fromBelow.lines, fromBelow.drag, 4) as number[][];
    expect(up[1]).toEqual([3, 4]);
    expect(stepTo(edge, up, fromBelow.drag, 1)).toBe("edge"); // down through 1 would leave the board
  });
});
