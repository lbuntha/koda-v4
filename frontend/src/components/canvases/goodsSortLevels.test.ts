/**
 * Guards the curated Goods Sort ladder, the board builder behind it, and the hint solver.
 *
 * The seed authors one skill per level in this file, so these assertions are what stands
 * between a broken board and a child's learning path. Three real failures motivated them:
 *
 *   * boards were dealt at random, which produces unsolvable ones — a child sorts what
 *     they can, the board never completes, and the activity never leaves their path;
 *   * the hint solver simulated a different game (it emptied matched compartments) and
 *     searched breadth-first on a budget too small to reach a solution, so its "hint" was
 *     not on any route to a win;
 *   * picking a curated level in the studio played a random 3-goods board instead,
 *     because `getGoodsLevel` treated the panel's own `gridRows` as "make something up".
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  GOODS_SORT_CURRICULUM_LEVELS,
  GOODS_CATALOG,
  buildGoodsBoard,
  generateDynamicGoodsLevel,
  getGoodsLevel,
  goodsCounts,
  isGoodsBoardSolved,
  spareShelves,
  type GoodsLevel,
  type ShelfCompartment,
} from "./goodsSortLevels";
import { solveGoodsSort } from "./GoodsSortCanvas";

const clone = (shelves: ShelfCompartment[]): ShelfCompartment[] =>
  shelves.map((s) => ({ id: s.id, capacity: s.capacity, items: s.items.map((i) => ({ ...i })) }));

/** Play the board out using only the hint solver's moves. */
const playOut = (shelves: ShelfCompartment[], moveBudget = 600): boolean => {
  const board = clone(shelves);
  for (let move = 0; move < moveBudget && !isGoodsBoardSolved(board); move++) {
    const next = solveGoodsSort(board);
    if (!next) break;
    const from = board.find((s) => s.id === next.from)!;
    const to = board.find((s) => s.id === next.to)!;
    if (!from.items.length || to.items.length >= to.capacity) break;
    to.items.push(from.items.pop()!);
  }
  return isGoodsBoardSolved(board);
};

const TIER_RANK = { beginner: 0, apprentice: 1, advanced: 2, master: 3, grandmaster: 4 };

// ── The ladder ──────────────────────────────────────────────────────────────────

test("every level is a real, unfinished, single-kind-per-compartment puzzle", () => {
  for (const level of GOODS_SORT_CURRICULUM_LEVELS) {
    const shelfCount = level.rows * level.cols;
    assert.equal(level.shelves.length, shelfCount, `${level.id}: grid and shelves disagree`);
    assert.equal(level.targetCount, level.goodsTypes.length, `${level.id}: targetCount`);
    assert.ok(spareShelves(level) >= 1, `${level.id}: no spare compartment, so no legal move`);

    // Each kind has to fill exactly one compartment — anything else cannot be sorted.
    const counts = goodsCounts(level.shelves);
    assert.deepEqual(
      Object.keys(counts).sort(),
      [...level.goodsTypes].sort(),
      `${level.id}: board holds goods the level does not declare`,
    );
    for (const [typeKey, count] of Object.entries(counts)) {
      assert.equal(count, level.compartmentCapacity, `${level.id}: ${typeKey} x${count}`);
      assert.ok(GOODS_CATALOG[typeKey], `${level.id}: ${typeKey} is not in the catalog`);
    }

    for (const shelf of level.shelves) {
      assert.equal(shelf.capacity, level.compartmentCapacity, `${level.id}/${shelf.id}: capacity`);
      assert.ok(shelf.items.length <= shelf.capacity, `${level.id}/${shelf.id}: overfilled`);
    }
    assert.equal(isGoodsBoardSolved(level.shelves), false, `${level.id}: starts already finished`);
  }
});

test("every level can actually be finished, using only hint moves", () => {
  for (const level of GOODS_SORT_CURRICULUM_LEVELS) {
    assert.ok(playOut(level.shelves), `${level.id} (${level.name}) cannot be finished`);
  }
});

test("levels have unique ids and stable, reproducible boards", () => {
  const ids = GOODS_SORT_CURRICULUM_LEVELS.map((level) => level.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate level id");

  // Same seed, same board — what lets the export certify a specific puzzle and a child
  // retry the one they were learning.
  const level = GOODS_SORT_CURRICULUM_LEVELS[8];
  const spec = {
    goodsTypes: level.goodsTypes,
    capacity: level.compartmentCapacity,
    shelfCount: level.rows * level.cols,
    seed: 12345,
  };
  const asKeys = (shelves: ShelfCompartment[]) =>
    shelves.map((s) => s.items.map((i) => i.typeKey));
  assert.deepEqual(asKeys(buildGoodsBoard(spec)), asKeys(buildGoodsBoard(spec)));
});

test("the ladder ramps: difficulty never steps backwards inside a tier", () => {
  const load = (level: GoodsLevel) => level.goodsTypes.length * level.compartmentCapacity;
  let previous: GoodsLevel | null = null;

  for (const level of GOODS_SORT_CURRICULUM_LEVELS) {
    if (previous) {
      assert.ok(
        TIER_RANK[level.difficultyTier] >= TIER_RANK[previous.difficultyTier],
        `${level.id}: tier drops below ${previous.id}`,
      );
      if (level.difficultyTier === previous.difficultyTier) {
        assert.ok(load(level) >= load(previous), `${level.id}: fewer items than ${previous.id}`);
        if (load(level) === load(previous)) {
          assert.ok(
            spareShelves(level) <= spareShelves(previous),
            `${level.id}: same load but more spare room than ${previous.id}`,
          );
        }
      }
    }
    previous = level;
  }

  // The ladder has to cover the whole climb, not just its easy end.
  const tiers = new Set(GOODS_SORT_CURRICULUM_LEVELS.map((level) => level.difficultyTier));
  assert.deepEqual([...tiers].sort(), [
    "advanced", "apprentice", "beginner", "grandmaster", "master",
  ]);
  assert.ok(GOODS_SORT_CURRICULUM_LEVELS.length >= 30);
});

// ── Resolving a question's board ────────────────────────────────────────────────

test("a curated level id wins over the panel's grid fields", () => {
  const curated = GOODS_SORT_CURRICULUM_LEVELS.find((level) => level.id === "level_4")!;
  // Exactly what the studio panel writes when a curated level is chosen.
  const resolved = getGoodsLevel("level_4", {
    levelId: "level_4",
    gridRows: curated.rows,
    gridCols: curated.cols,
    compartmentCapacity: curated.compartmentCapacity,
    goodsTypes: undefined,
  });
  assert.equal(resolved.id, "level_4");
  assert.deepEqual(resolved.goodsTypes, curated.goodsTypes);
});

test("explicit goods still produce a custom board", () => {
  const resolved = getGoodsLevel("level_4", {
    levelId: "level_4",
    gridRows: 3,
    gridCols: 3,
    goodsTypes: ["pizza", "robot"],
  });
  assert.equal(resolved.id, "custom");
  assert.deepEqual(Object.keys(goodsCounts(resolved.shelves)).sort(), ["pizza", "robot"]);
});

test("custom studio boards are solvable and never exceed their grid", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const level = generateDynamicGoodsLevel({
      rows: 3,
      cols: 3,
      compartmentCapacity: 4,
      // More kinds than the grid can finish — the extras have to be dropped, not crammed.
      goodsTypes: ["chips", "cola", "milk", "donut", "teddy", "duck", "apple", "plant", "gem", "star"],
      seed,
    });
    assert.equal(level.goodsTypes.length, 8, "must leave a spare compartment");
    assert.equal(level.shelves.length, 9);
    assert.equal(isGoodsBoardSolved(level.shelves), false);
    assert.ok(playOut(level.shelves), `custom board seed ${seed} cannot be finished`);
  }
});

// ── Hint solver ─────────────────────────────────────────────────────────────────

test("the hint completes a set when one is a move away", () => {
  const shelves: ShelfCompartment[] = [
    { id: "s1", capacity: 3, items: [{ id: "a", typeKey: "chips", label: "", emoji: "", color: "" }] },
    {
      id: "s2",
      capacity: 3,
      items: [
        { id: "b", typeKey: "chips", label: "", emoji: "", color: "" },
        { id: "c", typeKey: "chips", label: "", emoji: "", color: "" },
      ],
    },
    { id: "s3", capacity: 3, items: [] },
  ];
  assert.deepEqual(solveGoodsSort(shelves), { from: "s1", to: "s2" });
});

test("the hint is null on a finished board and never moves out of a finished compartment", () => {
  const done = (id: string, typeKey: string): ShelfCompartment => ({
    id,
    capacity: 3,
    items: [1, 2, 3].map((n) => ({ id: `${id}${n}`, typeKey, label: "", emoji: "", color: "" })),
  });
  assert.equal(solveGoodsSort([done("s1", "chips"), done("s2", "cola")]), null);

  const level = GOODS_SORT_CURRICULUM_LEVELS[0];
  const board = clone(level.shelves);
  for (let move = 0; move < 200 && !isGoodsBoardSolved(board); move++) {
    const next = solveGoodsSort(board)!;
    const from = board.find((s) => s.id === next.from)!;
    assert.ok(
      from.items.length < from.capacity ||
        !from.items.every((i) => i.typeKey === from.items[0].typeKey),
      "hint unpacked a compartment that was already finished",
    );
    board.find((s) => s.id === next.to)!.items.push(from.items.pop()!);
  }
});

test("repeated hints never walk the board back and forth", () => {
  // The failure this pins: a stateless search returns the first move of *some* route to a
  // win, and from the position that move creates it happily returns the reverse as the
  // first move of another. A child tapping Hint was walked between two boards forever.
  for (const level of GOODS_SORT_CURRICULUM_LEVELS) {
    const board = clone(level.shelves);
    const seen = new Set<string>();
    const key = () => board.map((s) => s.items.map((i) => i.typeKey).join(",")).join("|");

    for (let move = 0; move < 400 && !isGoodsBoardSolved(board); move++) {
      seen.add(key());
      const next = solveGoodsSort(board)!;
      const from = board.find((s) => s.id === next.from)!;
      board.find((s) => s.id === next.to)!.items.push(from.items.pop()!);
      assert.ok(
        !seen.has(key()),
        `${level.id}: hints returned to a position already visited (move ${move + 1})`,
      );
    }
    assert.ok(isGoodsBoardSolved(board), `${level.id} did not finish under repeated hints`);
  }
});
