/**
 * Guards the curated Liquid Sort levels and the hint solver behind them.
 *
 * Two real failures motivated this. Levels 8 and 9 shipped unsolvable — magenta appears
 * five times in a four-slot bottle, so no sequence of pours finishes the board — and
 * level 9 is a byte-for-byte duplicate of level 8. Separately the hint solver was
 * breadth-first with a 1500-iteration budget, which cannot reach a 20-32 move solution,
 * so the hint button silently did nothing on seven solvable levels.
 *
 * The seed only authors levels this file certifies, so these assertions are what stands
 * between a broken board and a child's learning path.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { LIQUID_SORT_CURRICULUM_LEVELS, type BottleState } from "./liquidSortLevels";
import { bottleViewBoxPoint, solveLiquidSort } from "./LiquidSortCanvas";

const clone = (bottles: BottleState[]): BottleState[] =>
  bottles.map(b => ({ id: b.id, capacity: b.capacity, layers: b.layers.map(l => ({ ...l })) }));

const isFinished = (bottles: BottleState[]) =>
  bottles.every(b => b.layers.length === 0
    || (b.layers.length === b.capacity && b.layers.every(l => l.colorKey === b.layers[0].colorKey)));

/** Play the board out using only the hint solver's moves. */
const playOut = (level: { bottles: BottleState[] }) => {
  const bottles = clone(level.bottles);
  for (let move = 0; move < 500 && !isFinished(bottles); move++) {
    const next = solveLiquidSort(bottles);
    if (!next) break;
    const from = bottles.find(b => b.id === next.from)!;
    const to = bottles.find(b => b.id === next.to)!;
    const colour = from.layers[from.layers.length - 1].colorKey;
    while (from.layers.length
      && from.layers[from.layers.length - 1].colorKey === colour
      && to.layers.length < to.capacity) {
      from.layers.pop();
      to.layers.push({ colorKey: colour });
    }
  }
  return isFinished(bottles);
};

const colourCounts = (level: { bottles: BottleState[] }) => {
  const counts: Record<string, number> = {};
  for (const bottle of level.bottles) {
    for (const layer of bottle.layers) counts[layer.colorKey] = (counts[layer.colorKey] ?? 0) + 1;
  }
  return counts;
};

/** Levels known to be broken content. Seeding excludes them; fixing one means deleting
 *  it from here, and the test then proves the fix.
 *
 *  Empty as of the level_8 / level_9 repair — both were rebuilt with six colours of four
 *  layers each and re-verified solvable. */
const KNOWN_UNSOLVABLE = new Set<string>([]);

const playable = LIQUID_SORT_CURRICULUM_LEVELS.filter(level => !KNOWN_UNSOLVABLE.has(level.id));

test("mobile bottle mouth coordinates honor SVG aspect-ratio letterboxing", () => {
  // compact mode renders the 100x240 viewBox into a 56x128 CSS box. The content is
  // 53.33px wide and centred, rather than stretched to the full 56px width.
  const mouth = bottleViewBoxPoint(
    { left: 20, top: 40, width: 56, height: 128 },
    50,
    10,
  );

  assert.equal(mouth.scale, 128 / 240);
  assert.equal(mouth.x, 48);
  assert.ok(Math.abs(mouth.y - 45.3333333333) < 0.0001);
});

test("every tower challenge has one real eight-layer goal bottle", () => {
  const towerLevels = LIQUID_SORT_CURRICULUM_LEVELS.filter(level =>
    level.bottles.some(bottle => bottle.isTower)
  );
  assert.equal(towerLevels.length, 5);
  for (const level of towerLevels) {
    const towers = level.bottles.filter(bottle => bottle.isTower);
    assert.equal(towers.length, 1, level.id);
    assert.equal(towers[0].capacity, 8, level.id);
    assert.equal(
      Object.values(colourCounts(level)).filter(count => count === 8).length,
      1,
      `${level.id} must have exactly one tower-sized colour`,
    );
  }
});

test("every playable level can actually be finished", () => {
  for (const level of playable) {
    assert.equal(playOut(level), true, `${level.id} (${level.name}) cannot be solved`);
  }
});

test("every playable level's colours each fill exactly one bottle", () => {
  for (const level of playable) {
    const availableCapacities = level.bottles
      .map(bottle => bottle.capacity)
      .sort((a, b) => b - a);
    const counts = Object.entries(colourCounts(level)).sort(([, a], [, b]) => b - a);
    for (const [colour, count] of counts) {
      const matchingBottle = availableCapacities.indexOf(count);
      assert.notEqual(
        matchingBottle, -1,
        `${level.id}: ${colour} appears ${count} times but no bottle holds ${count}`,
      );
      availableCapacities.splice(matchingBottle, 1);
    }
  }
});

test("the hint solver returns a move for every unfinished playable board", () => {
  for (const level of playable) {
    assert.notEqual(
      solveLiquidSort(level.bottles), null,
      `${level.id} (${level.name}) gives the learner no hint`,
    );
  }
});

test("the levels excluded from seeding really are unsolvable", () => {
  // If one starts passing, the content was fixed — drop it from KNOWN_UNSOLVABLE so the
  // seed picks it up, rather than leaving a good level permanently excluded.
  for (const id of KNOWN_UNSOLVABLE) {
    const level = LIQUID_SORT_CURRICULUM_LEVELS.find(item => item.id === id);
    if (!level) continue;
    assert.equal(playOut(level), false, `${id} is solvable now — remove it from KNOWN_UNSOLVABLE`);
  }
});

test("no two levels are the same board", () => {
  // `hidden` is part of the board, not decoration: several levels are deliberately the
  // same layout replayed with mystery layers (16 is 15 hidden, 18 is 17, 20 is 19), and
  // that plays completely differently. Comparing colours alone would flag those as
  // duplicates and hide a genuine copy-paste.
  const seen = new Map<string, string>();
  for (const level of LIQUID_SORT_CURRICULUM_LEVELS) {
    const shape = JSON.stringify(
      level.bottles.map(b => b.layers.map(l => `${l.colorKey}${l.hidden ? ":hidden" : ""}`)),
    );
    const twin = seen.get(shape);
    assert.equal(twin, undefined, `${level.id} is the same board as ${twin}`);
    seen.set(shape, level.id);
  }
});

test("the level table is ordered by difficulty, easiest first", () => {
  // Interactive Studio lists this array verbatim, so file order *is* the level order an
  // author sees. Appending a gentle level at the end once put a 3-tube board directly
  // after a 10-tube one, breaking the rule that a higher level number means harder.
  let previous = 0;
  for (const level of LIQUID_SORT_CURRICULUM_LEVELS) {
    assert.ok(
      level.bottles.length >= previous,
      `${level.id} (${level.bottles.length} tubes) follows a ${previous}-tube level — `
      + "insert it in difficulty order rather than appending",
    );
    previous = level.bottles.length;
  }
});

test("each level's displayed number matches its place in the ladder", () => {
  LIQUID_SORT_CURRICULUM_LEVELS.forEach((level, index) => {
    assert.ok(
      level.name.startsWith(`Level ${index + 1}: `),
      `${level.id} is shown as "${level.name}" but sits at position ${index + 1}`,
    );
  });
});
