import assert from "node:assert/strict";
import test from "node:test";
import { arrangedPathNumbers, mazeNumbers, normalizeNumberPathConfig, pathNumbers, requiredNumbers } from "./numberPathModel";

test("count-forward activities stay inside a ten-step window", () => {
  const config = normalizeNumberPathConfig({ view: "chart", task: "count_forward", start: 118, target: 140 });
  assert.deepEqual(config, { view: "chart", task: "count_forward", difficulty: "independent", start: 118, target: 120 });
  assert.deepEqual(requiredNumbers(config), [119, 120]);
});

test("challenge mode scrambles visual choices without changing the required sequence", () => {
  const config = normalizeNumberPathConfig({ view: "circle", task: "count_forward", difficulty: "challenge", start: 36, target: 41 });
  assert.deepEqual(requiredNumbers(config), [37, 38, 39, 40, 41]);
  assert.deepEqual(arrangedPathNumbers(config), [36, 38, 40, 42, 44, 37, 39, 41, 43, 45]);
});

test("the number maze embeds the valid route among unique distractors", () => {
  const config = normalizeNumberPathConfig({ view: "maze", task: "count_forward", difficulty: "challenge", start: 5, target: 10 });
  const maze = mazeNumbers(config);
  assert.equal(maze.length, 25);
  assert.equal(new Set(maze).size, 25);
  assert.deepEqual([maze[20], maze[16], maze[12], maze[8], maze[4], maze[3]], [5, 6, 7, 8, 9, 10]);
});

test("ten more and ten less are derived deterministically", () => {
  assert.equal(normalizeNumberPathConfig({ task: "ten_more", start: 46 }).target, 56);
  assert.equal(normalizeNumberPathConfig({ task: "ten_less", start: 46 }).target, 36);
});

test("a numeral target receives a ten-number path", () => {
  const config = normalizeNumberPathConfig({ task: "find_number", target: 120 });
  assert.deepEqual(pathNumbers(config), [111, 112, 113, 114, 115, 116, 117, 118, 119, 120]);
});
