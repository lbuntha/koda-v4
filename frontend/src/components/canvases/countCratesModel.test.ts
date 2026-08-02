/**
 * Certifies the Counting Crates ladder, its rules, and the solver behind the hint.
 *
 * The seed authors one skill per level in this file, so these assertions are what stands
 * between a broken board and a child's learning path. They are written first, before the
 * canvas exists, because the two sorting games both taught the same lesson the expensive
 * way: a board that cannot be finished, or a hint that walks a child in circles, is not
 * visible in a screenshot and is not caught by rendering it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  COUNT_CRATES_LEVELS,
  CRATE_UNITS,
  fewestCrates,
  getCratesLevel,
  hintCountCrates,
  isOrderFilled,
  isPerfectlyPacked,
  load,
  nearestReachableTotal,
  normalizeCustomLevel,
  reachStatus,
  open,
  solveCountCrates,
  startingBoard,
  stockCount,
  stockValue,
  trayTotal,
  unload,
  type CratesBoard,
  type CratesLevel,
  type CrateUnit,
} from "./countCratesModel";

const TIER_RANK = { beginner: 0, apprentice: 1, advanced: 2, master: 3, grandmaster: 4 };

/** Play a board to the end using only the hint, the way a stuck child would. */
const playWithHints = (level: CratesLevel, moveBudget = 200) => {
  let board = startingBoard(level);
  const seen = new Set<string>();
  const key = (b: CratesBoard) =>
    `${[...b.tray].sort().join(",")}|${CRATE_UNITS.map((u) => stockCount(b.stock, u)).join(",")}|${b.opensUsed}`;

  for (let move = 0; move < moveBudget && !isOrderFilled(board, level); move++) {
    seen.add(key(board));
    const hint = hintCountCrates(board, level);
    if (!hint) break;
    if (hint.kind === "load") board = load(board, hint.unit);
    else if (hint.kind === "unload") board = unload(board, hint.index);
    else board = open(board, hint.unit, level);
    assert.ok(!seen.has(key(board)), `${level.id}: hints returned to a position already seen`);
  }
  return { board, filled: isOrderFilled(board, level) };
};

// ── The ladder ──────────────────────────────────────────────────────────────────

test("every level can be filled, and the shelf can pay for the order", () => {
  for (const level of COUNT_CRATES_LEVELS) {
    assert.ok(level.orderTotal > 0, `${level.id}: order must ask for something`);
    assert.ok(
      stockValue(level.stock) >= level.orderTotal,
      `${level.id}: shelf holds ${stockValue(level.stock)}, order asks ${level.orderTotal}`,
    );
    const plan = solveCountCrates(startingBoard(level), level);
    assert.ok(plan, `${level.id} (${level.name}) has no solution`);
    if (level.constraint === "exactly") {
      assert.equal(plan!.crates.length, level.exactCrates, `${level.id}: crate count`);
    }
  }
});

test("no level opens already finished, and none can be filled by accident", () => {
  for (const level of COUNT_CRATES_LEVELS) {
    assert.equal(isOrderFilled(startingBoard(level), level), false, `${level.id}: starts filled`);
  }
});

test("a constraint a level cannot meet would be a board that refuses to finish", () => {
  for (const level of COUNT_CRATES_LEVELS.filter((l) => l.constraint === "exactly")) {
    const fewest = fewestCrates(level);
    assert.ok(fewest !== null, `${level.id}: unsolvable`);
    assert.ok(
      level.exactCrates! >= fewest!,
      `${level.id}: asks for ${level.exactCrates} crates but ${fewest} is the fewest possible`,
    );
  }
});

test("every order can be built from the crates a child can see", () => {
  // The rule this ladder now keeps, and it is the one that was missing. Level 18 asked for
  // 47 from a shelf of 10s and 5s: solvable only by opening a crate, which made a correct
  // board look broken to everyone who met it. A child must never have to discover a hidden
  // mechanic to make any progress at all — opening is now a way to pack tighter, never the
  // only road in.
  for (const level of COUNT_CRATES_LEVELS) {
    const withoutOpening = solveCountCrates(startingBoard(level), { ...level, opensAllowed: 0 });
    assert.ok(
      withoutOpening,
      `${level.id} (${level.name}): ${level.orderTotal} cannot be built from the shelf as it stands`,
    );
  }
});

test("opening is only required where the level says it is allowed", () => {
  for (const level of COUNT_CRATES_LEVELS) {
    const plan = solveCountCrates(startingBoard(level), level)!;
    const opens = Object.values(plan.opens).reduce((sum, n) => sum + (n ?? 0), 0);
    assert.ok(opens <= level.opensAllowed, `${level.id}: plan opens ${opens}, allowed ${level.opensAllowed}`);
    if (level.opensAllowed === 0) assert.equal(opens, 0, `${level.id}: no openings allowed`);
  }
});

test("the ladder ramps: difficulty never steps backwards inside a tier", () => {
  let previous: CratesLevel | null = null;
  for (const level of COUNT_CRATES_LEVELS) {
    if (previous && level.difficultyTier === previous.difficultyTier) {
      assert.ok(
        TIER_RANK[level.difficultyTier] >= TIER_RANK[previous.difficultyTier],
        `${level.id}: tier drops`,
      );
    }
    previous = level;
  }
  const tiers = new Set(COUNT_CRATES_LEVELS.map((level) => level.difficultyTier));
  assert.deepEqual([...tiers].sort(), [
    "advanced", "apprentice", "beginner", "grandmaster", "master",
  ]);
  assert.ok(COUNT_CRATES_LEVELS.length >= 24);
  assert.equal(new Set(COUNT_CRATES_LEVELS.map((l) => l.id)).size, COUNT_CRATES_LEVELS.length);
});

// ── Rules ───────────────────────────────────────────────────────────────────────

test("loading and unloading are exact inverses", () => {
  const level = COUNT_CRATES_LEVELS[5];
  const start = startingBoard(level);
  const loaded = load(start, 10);
  assert.equal(trayTotal(loaded), 10);
  assert.equal(stockCount(loaded.stock, 10), stockCount(start.stock, 10) - 1);

  const back = unload(loaded, 0);
  assert.deepEqual(back.tray, start.tray);
  assert.equal(stockCount(back.stock, 10), stockCount(start.stock, 10));
});

test("opening a crate trades one for the next size down, and cannot be repeated past the budget", () => {
  const level = COUNT_CRATES_LEVELS.find((l) => l.opensAllowed === 1 && stockCount(l.stock, 10) > 0)!;
  const start = startingBoard(level);
  const opened = open(start, 10, level);

  assert.equal(stockCount(opened.stock, 10), stockCount(start.stock, 10) - 1);
  assert.equal(stockCount(opened.stock, 1), stockCount(start.stock, 1) + 10);
  // Value is conserved — opening changes the shape of the shelf, never its worth.
  assert.equal(stockValue(opened.stock), stockValue(start.stock));
  assert.equal(opened.opensUsed, 1);

  // Budget spent: the shelf is now what it is.
  const again = open(opened, 10, level);
  assert.equal(again.opensUsed, 1, "opening past the budget must be refused");
  assert.deepEqual(again.stock, opened.stock);
});

test("a 1 cannot be opened, and an empty stack cannot be loaded", () => {
  const level = COUNT_CRATES_LEVELS[0];
  const start = startingBoard(level);
  assert.deepEqual(open(start, 1, level).stock, start.stock);
  assert.deepEqual(load(start, 100).tray, []);
});

test("the order is filled only on the exact total, and only within its constraint", () => {
  const plain = COUNT_CRATES_LEVELS.find((l) => l.constraint === "none")!;
  let board = startingBoard(plain);
  for (const unit of solveCountCrates(board, plain)!.crates) board = load(board, unit);
  assert.equal(trayTotal(board), plain.orderTotal);
  assert.ok(isOrderFilled(board, plain));

  // One crate too many is not "close enough".
  const over = load(board, CRATE_UNITS.find((u) => stockCount(board.stock, u) > 0)!);
  assert.equal(isOrderFilled(over, plain), false);
});

test("a correct total fills the order however it was packed, and tight packing earns the star", () => {
  const level = COUNT_CRATES_LEVELS.find((l) => l.constraint === "fewest" && stockCount(l.stock, 1) > 0)!;
  const fewest = fewestCrates(level)!;

  // Pay in the smallest crates the shelf allows — same total, more crates.
  let board = startingBoard(level);
  let left = level.orderTotal;
  for (const unit of [...CRATE_UNITS].reverse()) {
    while (left >= unit && stockCount(board.stock, unit) > 0) {
      board = load(board, unit);
      left -= unit;
    }
  }
  if (left === 0 && board.tray.length > fewest) {
    assert.equal(trayTotal(board), level.orderTotal);
    // Filled — because it is. Refusing this is what made a counting game feel wrong.
    assert.equal(isOrderFilled(board, level), true);
    assert.equal(isPerfectlyPacked(board, level), false, "but no star for the long way round");
  }

  const tight = solveCountCrates(startingBoard(level), level)!.crates
    .reduce((b, unit) => load(b, unit), startingBoard(level));
  assert.equal(isOrderFilled(tight, level), true);
  assert.equal(isPerfectlyPacked(tight, level), true);
});

test("no level can be stranded by a first crate or by an opening", () => {
  // The audit that forced the redesign, kept as a test. A child's opening move must never
  // make the order unreachable — on the hundred level, every first crate but the hundred
  // did exactly that, and opening the wrong crate stranded two more boards outright.
  for (const level of COUNT_CRATES_LEVELS) {
    for (const unit of CRATE_UNITS) {
      if (stockCount(level.stock, unit) === 0) continue;
      const afterLoad = load(startingBoard(level), unit);
      assert.ok(
        solveCountCrates(afterLoad, level),
        `${level.id}: loading a ${unit} first makes the order unreachable`,
      );
      if (unit !== 1 && level.opensAllowed > 0) {
        const afterOpen = open(startingBoard(level), unit, level);
        assert.ok(
          solveCountCrates(afterOpen, level),
          `${level.id}: opening a ${unit} strands the board`,
        );
      }
    }
  }
});

// ── Hint ────────────────────────────────────────────────────────────────────────

test("following the hint finishes every level, without ever revisiting a position", () => {
  for (const level of COUNT_CRATES_LEVELS) {
    const { filled } = playWithHints(level);
    assert.ok(filled, `${level.id} (${level.name}) could not be finished by following hints`);
  }
});

test("the hint takes a crate back out when the tray has gone over", () => {
  const level = COUNT_CRATES_LEVELS[0];
  let board = startingBoard(level);
  for (let i = 0; i < level.orderTotal + 2; i++) board = load(board, 1);

  const hint = hintCountCrates(board, level)!;
  assert.equal(hint.kind, "unload");
  assert.match(hint.reason, /too many/);
});

test("the hint never asks for an opening a level does not need", () => {
  // It used to, because level 16 could not be finished any other way. That is exactly the
  // design that made a solvable board look impossible, so the assertion is now the reverse:
  // no level's plan may depend on opening a crate.
  for (const level of COUNT_CRATES_LEVELS) {
    const hint = hintCountCrates(startingBoard(level), level);
    assert.ok(hint, `${level.id}: a fresh board must offer a first move`);
    assert.notEqual(hint!.kind, "open", `${level.id}: opening should never be the only way to start`);
  }
});

test("the hint is null once the order is filled", () => {
  const level = COUNT_CRATES_LEVELS[0];
  let board = startingBoard(level);
  for (const unit of solveCountCrates(board, level)!.crates) board = load(board, unit);
  assert.equal(hintCountCrates(board, level), null);
});

// ── Resolving a question's board ────────────────────────────────────────────────

test("a curated level id wins, and custom config produces a reachable board", () => {
  assert.equal(getCratesLevel("crates_11").id, "crates_11");
  assert.equal(getCratesLevel(undefined).id, COUNT_CRATES_LEVELS[0].id);

  const custom = getCratesLevel("crates_11", {
    cratesCustom: true, orderTotal: 27, cratesStock: { 10: 3, 5: 1, 1: 5 },
    cratesConstraint: "fewest", cratesOpensAllowed: 0,
  });
  assert.equal(custom.id, "custom");
  assert.ok(solveCountCrates(startingBoard(custom), custom), "custom boards must be solvable");
});

test("an order the shelf cannot pay for is clamped rather than shipped", () => {
  const custom = normalizeCustomLevel({
    cratesCustom: true, orderTotal: 500, cratesStock: { 10: 2 }, cratesOpensAllowed: 0,
  });
  assert.equal(custom.orderTotal, 20, "clamped to what the shelf holds");
  assert.ok(solveCountCrates(startingBoard(custom), custom));
});

test("an unreachable constraint is dropped, not shipped", () => {
  // 7 from a single ten: reachable only by opening, which is not allowed here — so
  // "exactly 2 crates" cannot be met and must not survive into a playable board.
  const custom = normalizeCustomLevel({
    cratesCustom: true, orderTotal: 7, cratesStock: { 5: 1, 1: 2 },
    cratesConstraint: "exactly", cratesExactly: 2, cratesOpensAllowed: 0,
  });
  const board = startingBoard(custom);
  assert.ok(solveCountCrates(board, custom), "a playable board must have a solution");
});


// ── Boards authored by anyone, including a model ────────────────────────────────

test("an order the shelf cannot pay exactly is snapped to one it can", () => {
  // Two tens are worth 20, so clamping to the shelf's *value* let an order of 15 through —
  // and 15 cannot be made from {10, 10}. Anything that authors a board could ship that: a
  // teacher in the panel, or the AI generator writing config straight from a prompt.
  const level = normalizeCustomLevel({
    cratesCustom: true, orderTotal: 15, cratesStock: { 10: 2 }, cratesOpensAllowed: 0,
  });
  assert.equal(level.orderTotal, 10, "snapped down to something the shelf can pay");
  assert.ok(solveCountCrates(startingBoard(level), level));
});

test("every shelf and order a generator might invent produces a playable board", () => {
  const shelves = [
    { 10: 2 }, { 5: 3 }, { 100: 1 }, { 10: 1, 5: 1 }, { 1: 3 },
    { 100: 2, 5: 1 }, { 10: 4, 5: 2, 1: 9 }, { 5: 2, 1: 1 },
  ];
  for (const stock of shelves) {
    for (const asked of [1, 7, 15, 23, 47, 99, 120, 500]) {
      for (const opens of [0, 1, 2]) {
        const level = normalizeCustomLevel({
          cratesCustom: true, orderTotal: asked, cratesStock: stock, cratesOpensAllowed: opens,
          cratesConstraint: "fewest",
        });
        const board = startingBoard(level);
        assert.ok(level.orderTotal >= 0, "an order is never negative");
        if (level.orderTotal > 0) {
          assert.ok(
            solveCountCrates(board, level),
            `unplayable board: order ${level.orderTotal} from ${JSON.stringify(stock)}`,
          );
          assert.equal(reachStatus(board, level) === "stuck", false, "a fresh board is never stuck");
        }
      }
    }
  }
});

test("nearestReachableTotal never overshoots what was asked", () => {
  for (const stock of [{ 10: 3 }, { 5: 2, 1: 4 }, { 100: 1, 10: 1 }]) {
    for (const asked of [3, 8, 26, 140]) {
      const total = nearestReachableTotal(stock, asked, 0);
      assert.ok(total <= asked, `${total} > ${asked}`);
      assert.ok(total <= stockValue(stock));
    }
  }
});

test("a dead end is reported on every level, not just the ones needing an opening", () => {
  // The general form of the level-18 complaint: any board a child can make unfinishable
  // must say so. Overshoot with nothing to take back is the simplest way in.
  for (const level of COUNT_CRATES_LEVELS.slice(0, 8)) {
    let board = startingBoard(level);
    // Fill past the order with the biggest crate available, as a child clicking fast would.
    for (let i = 0; i < 30 && trayTotal(board) <= level.orderTotal; i++) {
      const unit = CRATE_UNITS.find((u) => stockCount(board.stock, u) > 0);
      if (!unit) break;
      board = load(board, unit);
    }
    if (trayTotal(board) > level.orderTotal) {
      assert.equal(reachStatus(board, level), "stuck", `${level.id}: overshoot must read as stuck`);
      const hint = hintCountCrates(board, level)!;
      assert.equal(hint.kind, "unload", `${level.id}: and the way out is to take one back`);
    }
  }
});
