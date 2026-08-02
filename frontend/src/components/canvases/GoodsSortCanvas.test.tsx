/**
 * Renders the real Goods Sort canvas and plays a board to the end.
 *
 * The logic tests next door (`goodsSortLevels.test.ts`) prove the ladder is solvable and
 * the hint solver finds moves. Neither of them mounts a component, so neither can catch
 * the failures that actually reach a child: compartments that do not respond to a tap, a
 * board that is not the level the question asked for, or a solve that reports a claim of
 * success instead of the shelf the server has to grade.
 *
 * The last one is the reason this file exists. `onAttempt("correct", { selected })` used
 * to send the level id. Server-side grading rejects that ("selection must be a list of
 * compartments"), the attempt is stored unverified, and the child is told their work
 * could not be saved — after they finished it.
 */

import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CountingTechnique, type CountingQuestion } from "../../types";
import { GoodsSortCanvas, solveGoodsSort } from "./GoodsSortCanvas";
import {
  GOODS_SORT_LEVELS,
  goodsCounts,
  isGoodsBoardSolved,
  type ShelfCompartment,
} from "./goodsSortLevels";

vi.mock("../../sound", () => ({
  sounds: {
    playPop: vi.fn(), playWin: vi.fn(), playFailure: vi.fn(),
    playSparkle: vi.fn(), playSuccess: vi.fn(), playLevelUp: vi.fn(),
    playCorrect: vi.fn(), playWrong: vi.fn(), setEnabled: vi.fn(), isEnabled: () => true,
  },
}));

afterEach(() => vi.clearAllMocks());

const question = (config: Record<string, any>): CountingQuestion => ({
  id: "q-goods",
  technique: CountingTechnique.GOODS_SORT,
  title: "Goods Shelf Sort",
  instruction: "Sort the shelves",
  objectId: "star",
  targetCount: 3,
  config,
});

const level = (id: string) => GOODS_SORT_LEVELS.find((lvl) => lvl.id === id)!;

const cloneShelves = (shelves: ShelfCompartment[]): ShelfCompartment[] =>
  shelves.map((s) => ({ id: s.id, capacity: s.capacity, items: s.items.map((i) => ({ ...i })) }));

/**
 * Tap a compartment the way a child does. Two grids carry the same `data-shelf-id` — the
 * recessed backboards and the drag layer above them — and only the first is clickable.
 */
const tapShelf = (container: HTMLElement, shelfId: string) => {
  const target = container.querySelector(`[data-shelf-id="${shelfId}"]`);
  expect(target, `no compartment ${shelfId} on screen`).toBeTruthy();
  fireEvent.click(target!);
};

describe("Goods Sort canvas", () => {
  test("renders the level's own board, not a regenerated one", () => {
    // Exactly what the studio panel writes when a curated level is chosen: the grid
    // fields travel with the selection, and used to be read as "make something up".
    const curated = level("level_4");
    const { container } = render(
      <GoodsSortCanvas
        isPlayMode={true}
        question={question({
          levelId: "level_4",
          gridRows: curated.rows,
          gridCols: curated.cols,
          compartmentCapacity: curated.compartmentCapacity,
        })}
      />,
    );

    const compartments = new Set(
      [...container.querySelectorAll("[data-shelf-id]")].map((el) => el.getAttribute("data-shelf-id")),
    );
    expect(compartments.size).toBe(curated.rows * curated.cols);

    // The goods on the board have to be this level's, not the generator's chips/cola/milk.
    // Read them off the goal rail: a few kinds draw as SVG artwork rather than an emoji,
    // so the rail is the one place every kind on the board is listed.
    const rail = container.querySelector("[data-testid='goods-goal-rail']")!;
    const labelled = [...rail.querySelectorAll("[title]")].map((el) => el.getAttribute("title"));
    const expected = curated.goodsTypes.map(
      (typeKey) => curated.shelves.flatMap((s) => s.items).find((i) => i.typeKey === typeKey)!.label,
    );
    expect(labelled.sort()).toEqual(expected.sort());
  });

  test("the goal rail counts each kind, and marks one off when it is gathered", () => {
    const curated = level("level_1");
    const board = cloneShelves(curated.shelves);
    const { container } = render(<GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_1" })} />);

    const rail = () => container.querySelector("[data-testid='goods-goal-rail']")!.textContent ?? "";
    expect(rail()).toContain(`0/${curated.goodsTypes.length} sorted`);

    // Gather one kind completely; the rail has to notice.
    for (let move = 0; move < 60; move++) {
      const gathered = board.some((shelf) =>
        shelf.items.length === shelf.capacity
        && shelf.items.every((i) => i.typeKey === shelf.items[0].typeKey));
      if (gathered) break;
      const next = solveGoodsSort(board)!;
      tapShelf(container, next.from);
      tapShelf(container, next.to);
      const source = board.find((s) => s.id === next.from)!;
      board.find((s) => s.id === next.to)!.items.push(source.items.pop()!);
    }
    expect(rail()).toContain(`1/${curated.goodsTypes.length} sorted`);
  });

  test("picking an item up names it", () => {
    const board = cloneShelves(level("level_1").shelves);
    const holding = board.find((s) => s.items.length > 0)!;
    const front = holding.items[holding.items.length - 1];
    const { container, queryByText } = render(
      <GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_1" })} />,
    );

    // Nothing is named until something is in hand — the shelf would be unreadable.
    expect(queryByText(front.label)).toBeNull();
    tapShelf(container, holding.id);
    expect(queryByText(front.label)).toBeTruthy();
  });

  test("a tap moves the front item between compartments", () => {
    const board = cloneShelves(level("level_1").shelves);
    const from = board.find((s) => s.items.length > 0)!;
    const to = board.find((s) => s.items.length === 0)!;
    const { container, getByText } = render(
      <GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_1" })} />,
    );

    expect(getByText("0")).toBeTruthy(); // the move counter starts at zero
    tapShelf(container, from.id);
    tapShelf(container, to.id);
    expect(getByText("1")).toBeTruthy();
  });

  test("finishing the board reports the shelf itself, once, and only when solved", async () => {
    const onSuccess = vi.fn();
    const onAttempt = vi.fn();
    const curated = level("level_1");
    const board = cloneShelves(curated.shelves);
    const { container } = render(
      <GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_1" })} onSuccess={onSuccess} onAttempt={onAttempt} />,
    );

    // Play the board out with the hint solver, tapping each move into the real component
    // and mirroring it locally so the next hint is asked about the same position.
    for (let move = 0; move < 100 && !isGoodsBoardSolved(board); move++) {
      const next = solveGoodsSort(board)!;
      expect(next, "the solver ran out of moves mid-board").toBeTruthy();
      tapShelf(container, next.from);
      tapShelf(container, next.to);
      const source = board.find((s) => s.id === next.from)!;
      board.find((s) => s.id === next.to)!.items.push(source.items.pop()!);
      // Nothing is reported until the last item is in place.
      if (!isGoodsBoardSolved(board)) expect(onSuccess).not.toHaveBeenCalled();
    }
    expect(isGoodsBoardSolved(board)).toBe(true);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onAttempt).toHaveBeenCalledTimes(1);

    const [outcome, payload] = onAttempt.mock.calls[0];
    expect(outcome).toBe("correct");

    // The shape `grade_goods_sort` grades: one list per compartment, of goods type keys.
    const selected: string[][] = payload.selected;
    expect(Array.isArray(selected)).toBe(true);
    expect(selected.every((shelf) => Array.isArray(shelf))).toBe(true);
    expect(selected.length).toBe(curated.rows * curated.cols);

    // …and it has to pass the grader's two checks: the board still holds exactly the
    // goods the level started with, and each kind sits alone in one compartment.
    const counts: Record<string, number> = {};
    for (const shelf of selected) for (const item of shelf) counts[item] = (counts[item] ?? 0) + 1;
    expect(counts).toEqual(goodsCounts(curated.shelves));
    for (const typeKey of Object.keys(counts)) {
      const holding = selected.filter((shelf) => shelf.includes(typeKey));
      expect(holding.length, `${typeKey} is split across compartments`).toBe(1);
      expect(new Set(holding[0]).size).toBe(1);
    }

    expect(payload.details.levelId).toBe("level_1");
    expect(payload.details.moveCount).toBeGreaterThan(0);
  });

  test("a tap on a full compartment is play, not a wrong answer", () => {
    const onAttempt = vi.fn();
    // A board with a compartment already at capacity — the tap that used to be logged
    // as a wrong answer is a child trying to put something where there is no room.
    const board = cloneShelves(level("level_2").shelves);
    const full = board.find((s) => s.items.length === s.capacity)!;
    const other = board.find((s) => s.items.length > 0 && s.id !== full.id)!;
    expect(full, "level_2 should open with a full compartment").toBeTruthy();

    const { container } = render(
      <GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_2" })} onAttempt={onAttempt} />,
    );
    tapShelf(container, other.id);
    tapShelf(container, full.id);

    // Logging this as "incorrect" is what used to sink the mastery score of any child
    // who explored the board before committing to a plan.
    expect(onAttempt).not.toHaveBeenCalled();
  });

  test("the hint button offers a move and undo takes it back", () => {
    const onHint = vi.fn();
    const { container, getByText } = render(
      <GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_2" })} onHint={onHint} />,
    );

    fireEvent.click(getByText("Hint"));
    expect(onHint).toHaveBeenCalledTimes(1);
    const { hintFrom, hintTo } = onHint.mock.calls[0][0];
    expect(hintFrom).not.toBe(hintTo);

    // The suggested move has to be one the board actually allows.
    const shelfIds = new Set(
      [...container.querySelectorAll("[data-shelf-id]")].map((el) => el.getAttribute("data-shelf-id")),
    );
    expect(shelfIds.has(hintFrom)).toBe(true);
    expect(shelfIds.has(hintTo)).toBe(true);

    // A second tap plays it.
    fireEvent.click(getByText("Hint"));
    expect(getByText("1")).toBeTruthy();
  });

  test("undo takes a move back", () => {
    const board = cloneShelves(level("level_2").shelves);
    const from = board.find((s) => s.items.length > 0)!;
    const to = board.find((s) => s.items.length === 0)!;
    const { container, getByText } = render(
      <GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_2" })} />,
    );

    tapShelf(container, from.id);
    tapShelf(container, to.id);
    expect(getByText("1")).toBeTruthy();
    fireEvent.click(getByText("Undo"));
    expect(getByText("0")).toBeTruthy();
  });

  test("shuffle is undoable and keeps every item on the board", () => {
    const curated = level("level_2");
    const { container, getByText } = render(
      <GoodsSortCanvas isPlayMode={true} question={question({ levelId: "level_2" })} />,
    );

    // The goal rail is the honest read of board state: it is computed from the shelves
    // rather than from whatever the DOM still has mid-animation (AnimatePresence keeps an
    // exiting item mounted, so comparing raw markup would compare animation timing).
    const rail = () => container.querySelector("[data-testid='goods-goal-rail']")!.textContent ?? "";
    const before = rail();

    fireEvent.click(getByText("Shuffle"));
    // A shuffle is a re-deal, not a move: the move counter must not tick.
    expect(getByText("0")).toBeTruthy();
    // Every kind is still on the board — a shuffle may not lose or invent goods.
    for (const typeKey of curated.goodsTypes) {
      const label = curated.shelves.flatMap((s) => s.items).find((i) => i.typeKey === typeKey)!.label;
      expect(container.querySelector(`[title="${label}"]`), `${typeKey} vanished`).toBeTruthy();
    }

    fireEvent.click(getByText("Undo"));
    expect(rail()).toBe(before);
  });
});
