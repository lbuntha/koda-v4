/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CanvasProps } from "./types";
import { sounds } from "../../sound";
import {
  RotateCcw,
  RotateCw,
  Plus,
  Lightbulb,
  Sparkles,
  Timer,
  Check,
  PackageCheck,
  Shuffle,
  Layers,
} from "lucide-react";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { Celebration } from "./Celebration";
import { surfaceClass } from "./canvasTheme";
import { GoodsAsset, GoodsAssetLibrary } from "../../assets/goods-sort";
import {
  GOODS_SORT_LEVELS,
  getGoodsLevel,
  isGoodsBoardSolved,
  scrambleGoodsBoard,
  GoodsLevel,
  ShelfCompartment,
  GoodsItem,
} from "./goodsSortLevels";

/**
 * Solver behind the hint button: the next move a child should make.
 *
 * It answers in four ways, in order:
 *
 *   1. a move that completes a set right now — always the move worth teaching, and
 *      always safe, because each kind of goods has exactly one compartment's worth;
 *   2. the next move of a cached plan, when the board is on one;
 *   3. the first move of a freshly searched plan — shortest if the board is small
 *      enough to search exhaustively, otherwise the first solution found;
 *   4. a strategy move, when no plan can be found inside the budget.
 *
 * Three things the version this replaces got wrong.
 *
 * It searched a *different game*: the simulation emptied a compartment once three
 * matching items landed in it and called the board solved when every compartment was
 * empty, neither of which this game does — so a "solution" it found was not one.
 *
 * It was stateless, and that is why plans are cached rather than recomputed. A search
 * returns the first move of *some* route to a win; from the state that move leads to, the
 * next search returns the reverse as the first move of some other equally valid route,
 * and a child tapping Hint repeatedly is walked back and forth between two boards
 * forever. Following one plan cannot do that, and it is what makes repeated hints teach a
 * sequence rather than a twitch.
 *
 * And it was slow enough to be unusable: states were arrays of item objects, cloned and
 * re-keyed for every one of the ~50 children each state generates. Here a state is one
 * short string per compartment, one character per item, so a child is a shallow array
 * copy plus two string edits — the difference between a hint that arrives in a frame and
 * one that arrives in a second.
 */

/**
 * How many kinds the goal rail names before collapsing the rest into a "+N".
 *
 * The eighteen-kind boards wrapped the rail onto three lines, which pushed the shelf out
 * of the card. Chips are ordered closest-to-done, so what a cut loses is the kinds with
 * nothing gathered yet — the ones there is nothing to say about.
 */
const RAIL_CHIP_LIMIT = 9;

/** The plan the hint is currently following: exact board state -> the move to play next. */
let cachedPlan = new Map<string, { from: string; to: string }>();

/**
 * The move the hint gave last, so the next one is never its exact reverse.
 *
 * Following a cached plan cannot cycle, and neither can the strategy rules on their own —
 * piles only merge upward and single-kind compartments are never unpacked. But that is an
 * argument, not a guarantee, and the place it would fail is the worst one: a child tapping
 * Hint on a board too large to search, being walked between two positions forever. This
 * makes it structural. It is a guard rather than a rule: the last-resort tier ignores it,
 * so the hint is never dead even when going back really is the only move left.
 */
let lastHint: { from: string; to: string } | null = null;

const giveHint = (move: { from: string; to: string }) => {
  lastHint = move;
  return move;
};

const reverses = (from: string, to: string) =>
  lastHint !== null && lastHint.from === to && lastHint.to === from;

export function solveGoodsSort(
  shelves: ShelfCompartment[]
): { from: string; to: string } | null {
  // Characters are assigned by sorted type key, not by order of appearance, so the same
  // board always produces the same state string — which is what lets a cached plan be
  // looked up across calls.
  const code = new Map<string, string>();
  [...new Set(shelves.flatMap((shelf) => shelf.items.map((item) => item.typeKey)))]
    .sort()
    .forEach((typeKey, index) => code.set(typeKey, String.fromCharCode(33 + index)));

  const ids = shelves.map((shelf) => shelf.id);
  const caps = shelves.map((shelf) => shelf.capacity);
  const start = shelves.map((shelf) =>
    shelf.items.map((item) => code.get(item.typeKey)!).join(""),
  );

  const uniform = (content: string) => {
    for (let i = 1; i < content.length; i++) if (content[i] !== content[0]) return false;
    return content.length > 0;
  };
  /** Full and single-kind: nothing left to do with it, and nothing that may be taken out. */
  const complete = (content: string, index: number) =>
    content.length === caps[index] && uniform(content);
  const solved = (state: string[]) =>
    state.every((content, index) => content.length === 0 || complete(content, index));
  const legal = (state: string[], i: number, j: number) =>
    i !== j
    && state[i].length > 0
    && !complete(state[i], i)
    && state[j].length < caps[j]
    && !complete(state[j], j);

  if (solved(start)) return null;

  // ── 1. Finish a set that is one move away ──
  for (let i = 0; i < start.length; i++) {
    if (!start[i].length || complete(start[i], i)) continue;
    const moving = start[i][start[i].length - 1];
    for (let j = 0; j < start.length; j++) {
      if (!legal(start, i, j)) continue;
      if (start[j].length === caps[j] - 1 && uniform(start[j]) && start[j][0] === moving) {
        // Never withheld: finishing a set is always right, and it cannot undo anything —
        // a completed compartment is one no later move may take from again.
        return giveHint({ from: ids[i], to: ids[j] });
      }
    }
  }

  // ── 2. Stay on the plan the child is already following ──
  const exactKey = start.join("|");
  const planned = cachedPlan.get(exactKey);
  if (planned) {
    const from = ids.indexOf(planned.from);
    const to = ids.indexOf(planned.to);
    if (from >= 0 && to >= 0 && legal(start, from, to)) return giveHint(planned);
  }

  // ── 3. Search for a plan ──
  //
  // Which compartment holds which goods is not part of the puzzle, so the search keys
  // states by their *sorted* contents, collapsing the large symmetric space. The plan it
  // yields is keyed by the unsorted board, because a move names a specific compartment.
  interface SearchNode {
    state: string[];
    parent: number;
    move: { from: number; to: number } | null;
  }

  const searchKey = (state: string[]) => [...state].sort().join("|");

  /**
   * `breadthFirst` returns the shortest plan and is what small boards get. It cannot
   * reach the 25+ move solutions of the big ones at this branching factor, so those fall
   * through to a depth-first pass, which finds *a* plan quickly when ordered well.
   *
   * The budget counts states *generated*, not expanded: generating is where the work is
   * (a key, a hash lookup, an array copy each), and a budget on expansions lets a single
   * expansion of a 20-compartment board generate hundreds of them.
   */
  const search = (breadthFirst: boolean, budget: number): Map<string, { from: string; to: string }> | null => {
    const nodes: SearchNode[] = [{ state: start, parent: -1, move: null }];
    const visited = new Set<string>([searchKey(start)]);
    const stack: number[] = [0];
    let head = 0;
    let solvedIndex = -1;

    while (solvedIndex < 0 && nodes.length < budget) {
      const currentIndex = breadthFirst ? (head < nodes.length ? head++ : -1) : (stack.pop() ?? -1);
      if (currentIndex < 0) break;
      const state = nodes[currentIndex].state;

      // Compartments holding the same goods in the same order are interchangeable, and so
      // are all the empty ones. Expanding each distinct *content* once rather than each
      // compartment cuts the branching factor several times over on exactly the boards
      // where it hurts — the roomy ones, with a dozen identical empty compartments.
      const sourcesSeen = new Set<string>();
      const children: { index: number; score: number }[] = [];

      for (let i = 0; i < state.length; i++) {
        if (!state[i].length || complete(state[i], i)) continue;
        if (sourcesSeen.has(state[i])) continue;
        sourcesSeen.add(state[i]);
        const moving = state[i][state[i].length - 1];
        const targetsSeen = new Set<string>();

        for (let j = 0; j < state.length; j++) {
          if (!legal(state, i, j)) continue;
          if (targetsSeen.has(state[j])) continue;
          targetsSeen.add(state[j]);

          const next = state.slice();
          next[i] = state[i].slice(0, -1);
          next[j] = state[j] + moving;

          const key = searchKey(next);
          if (visited.has(key)) continue;
          visited.add(key);

          const index = nodes.length;
          nodes.push({ state: next, parent: currentIndex, move: { from: i, to: j } });
          if (solved(next)) {
            solvedIndex = index;
            break;
          }
          if (!breadthFirst) {
            // Order matters far more depth-first than breadth-first: a good ordering is
            // what turns "a plan exists somewhere down there" into one found in hundreds
            // of states rather than tens of thousands.
            const merges = state[j].length > 0 && uniform(state[j]) && state[j][0] === moving;
            const finishes = merges && next[j].length === caps[j];
            const unpacks = uniform(state[i]);
            children.push({
              index,
              score: (finishes ? 8 : merges ? 4 : state[j].length === 0 ? 2 : 0) - (unpacks ? 3 : 0),
            });
          }
        }
        if (solvedIndex >= 0) break;
      }

      if (solvedIndex < 0 && !breadthFirst) {
        // Lowest score pushed first, so the best-looking move is the one popped next.
        children.sort((a, b) => a.score - b.score);
        for (const child of children) stack.push(child.index);
      }
    }

    if (solvedIndex < 0) return null;

    const plan = new Map<string, { from: string; to: string }>();
    for (let index = solvedIndex; index > 0; index = nodes[index].parent) {
      const node = nodes[index];
      plan.set(nodes[node.parent].state.join("|"), {
        from: ids[node.move!.from],
        to: ids[node.move!.to],
      });
    }
    return plan;
  };

  // Both budgets are interaction costs: a board neither pass can settle pays for both
  // before a strategy move is offered, so they are sized for a hint that still feels
  // instant on the first tap. Every later tap on the same plan is a map lookup.
  const plan = search(true, start.length <= 12 ? 8000 : 3000) ?? search(false, 25000);
  if (plan) {
    cachedPlan = plan;
    const first = plan.get(exactKey);
    return first ? giveHint(first) : null;
  }

  // ── 4. Strategy moves, when no plan was found inside the budget ──
  //
  // These are the moves the ladder teaches, ordered so that following them cannot cycle:
  // piles only ever merge upwards (smaller into larger), and a compartment holding a
  // single kind of goods is never unpacked.

  // Grow the biggest run: put the item on top of whichever compartment already shows the
  // most of its kind. Strictly bigger run than the source's own, ties broken by position,
  // so following this rule can never undo an earlier application of it.
  const topRun = (content: string, kind: string) => {
    let run = 0;
    while (run < content.length && content[content.length - 1 - run] === kind) run++;
    return run;
  };

  let best: { from: number; to: number; run: number } | null = null;
  for (let i = 0; i < start.length; i++) {
    if (!start[i].length || complete(start[i], i)) continue;
    const moving = start[i][start[i].length - 1];
    const sourceRun = topRun(start[i], moving);

    for (let j = 0; j < start.length; j++) {
      if (!legal(start, i, j)) continue;
      const run = topRun(start[j], moving);
      if (run === 0) continue;
      if (run < sourceRun || (run === sourceRun && j > i)) continue;
      if (reverses(ids[i], ids[j])) continue;
      if (!best || run > best.run) best = { from: i, to: j, run };
    }
  }
  if (best) return giveHint({ from: ids[best.from], to: ids[best.to] });

  // Unbury, but only ever out of a mixed compartment — emptying one that already holds a
  // single kind of goods is pure regression, and is what let the old solver ping-pong one
  // item between the same two compartments.
  for (const preferEmpty of [true, false]) {
    for (let i = 0; i < start.length; i++) {
      if (!start[i].length || uniform(start[i])) continue;
      for (let j = 0; j < start.length; j++) {
        if (!legal(start, i, j)) continue;
        if (preferEmpty && start[j].length) continue;
        if (reverses(ids[i], ids[j])) continue;
        return giveHint({ from: ids[i], to: ids[j] });
      }
    }
  }

  // Nothing constructive left — any legal move, so the hint is never dead. The
  // anti-reverse guard is deliberately not applied here: if going back is the only legal
  // move on the board, saying nothing would be worse than saying that.
  for (let i = 0; i < start.length; i++) {
    for (let j = 0; j < start.length; j++) {
      if (legal(start, i, j)) return giveHint({ from: ids[i], to: ids[j] });
    }
  }

  return null;
}

const formatTime = (secs: number) => {
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
};

/**
 * The elapsed-time readout, isolated so its per-second tick re-renders four characters
 * instead of the entire cabinet. `React.memo` keeps it still while the board animates.
 */
const ElapsedClock = React.memo(function ElapsedClock({
  startedAt,
  stopped,
}: {
  startedAt: number;
  stopped: boolean;
}) {
  const [seconds, setSeconds] = useState(() => Math.floor((Date.now() - startedAt) / 1000));

  useEffect(() => {
    setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    if (stopped) return;
    const interval = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [startedAt, stopped]);

  return <span>{formatTime(seconds)}</span>;
});

export const GoodsSortCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode = true,
  isDark = false,
  onSuccess,
  onAttempt,
  onHint,
}) => {
  const initialLevelId = (question.config as any)?.levelId || "level_1";
  const [selectedLevelId, setSelectedLevelId] = useState<string>(initialLevelId);

  // Resolving the level is not free — a custom or preset board is *built* (laid out
  // solved, then scrambled), so doing it inline on every render rebuilt the puzzle on
  // every keystroke in the studio and on every timer tick in play.
  const configKey = JSON.stringify(question.config ?? {});
  const currentLevel = useMemo(
    () => getGoodsLevel(selectedLevelId, question.config),
    [selectedLevelId, configKey],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const initialShelvesRef = useRef<ShelfCompartment[]>([]);

  /**
   * The box the cabinet may fill, measured rather than expressed in CSS.
   *
   * Three CSS attempts failed here, each in a different direction, which is why this is
   * JavaScript. A width-driven square overflowed short cards and hid the bottom row of
   * compartments. `min(100cqw, 100cqh)` fixed that and then collapsed the shelf to nothing
   * wherever a container gave no definite height — `container-type: size` makes an
   * element's size independent of its contents, which for a flex item is a way of
   * measuring zero. Matching the grid's own ratio fixed *that* and left a 5x2 board as a
   * 121px strip with 350px of empty space under it, because CSS ratios cannot see height.
   *
   * A ResizeObserver can see both. `width = min(availableWidth, availableHeight * ratio)`
   * is the whole rule, and because the resulting height never exceeds the height measured,
   * the cabinet can never grow the box it was measured against.
   */
  const boardBoxRef = useRef<HTMLDivElement>(null);
  const [boardBox, setBoardBox] = useState({ width: 0, height: 0 });

  // `useLayoutEffect`, and the first measurement is taken synchronously: a ResizeObserver
  // only reports *after* a paint, so the board's first frame used the fallback size and
  // every item then animated from there to its real position — a shelf that visibly flew
  // together each time an activity opened. Measuring before the browser paints means the
  // first frame is already right.
  useLayoutEffect(() => {
    const element = boardBoxRef.current;
    if (!element) return;
    const initial = element.getBoundingClientRect();
    if (initial.width > 0 && initial.height > 0) {
      setBoardBox({ width: initial.width, height: initial.height });
    }
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoardBox((previous) =>
        Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /**
   * Lay the shelf out in whichever orientation gives the bigger compartments.
   *
   * Which compartment holds which goods is not part of the puzzle — the rules never
   * mention position — so the grid's shape is presentation, and the authored shape is not
   * always the right one for the space. A 5-wide board on a tall phone gets 72px
   * compartments with four items stacked in each; the same ten compartments as 2 wide by
   * 5 deep get 160px. Nothing about the board changes, only how it is drawn.
   *
   * Deliberately not "portrait container ⇒ portrait board": inside a wide, shallow card a
   * 5-wide board is genuinely the better fit, and turning it would have *shrunk* the
   * compartments to 60px. The comparison below asks the question that actually matters,
   * and needs a clear 5% win to switch, so a slow resize cannot make it flap.
   */
  const compartmentSize = (across: number, deep: number) =>
    Math.min(boardBox.width / across, boardBox.height / deep);
  const transposed =
    boardBox.width > 0
    && boardBox.height > 0
    && currentLevel.cols !== currentLevel.rows
    && compartmentSize(currentLevel.rows, currentLevel.cols)
      > compartmentSize(currentLevel.cols, currentLevel.rows) * 1.05;
  const cols = transposed ? currentLevel.rows : currentLevel.cols;
  const rows = transposed ? currentLevel.cols : currentLevel.rows;

  /**
   * Fall back to a plain width-driven box until the first measurement lands, and whenever
   * the height measures zero — a container that never gives one would otherwise leave the
   * shelf invisible, which is the worst of the failure modes.
   */
  const cabinetStyle: React.CSSProperties = (() => {
    const ratio = cols / rows;
    const { width, height } = boardBox;
    if (width <= 0 || height <= 0) return { width: "100%", aspectRatio: `${ratio}` };
    return { width: Math.min(width, height * ratio), aspectRatio: `${ratio}` };
  })();

  // Deep clone level shelves
  const loadLevelShelves = (level: GoodsLevel): ShelfCompartment[] => {
    return level.shelves.map((s) => ({
      id: s.id,
      capacity: s.capacity,
      items: s.items.map((i) => ({ ...i })),
    }));
  };

  const [shelves, setShelves] = useState<ShelfCompartment[]>(() =>
    loadLevelShelves(currentLevel)
  );
  const [selectedShelfId, setSelectedShelfId] = useState<string | null>(null);
  const [history, setHistory] = useState<ShelfCompartment[][]>([]);
  const [isWon, setIsWon] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [clearedTripletsCount, setClearedTripletsCount] = useState(0);
  /** Taps that could not move anything (target full). Play, not a wrong answer — see handleShelfClick. */
  const blockedMoves = useRef(0);
  /** When the last drag ended, so the click it leaves behind can be told apart from a tap. */
  const draggedAt = useRef(0);

  // The clock lives in `<ElapsedClock/>` and a ref, not in state: a `setSeconds` every
  // second re-rendered the whole cabinet — up to 20 compartments and 72 animated items —
  // once per tick, for a number nothing but the readout uses.
  const startedAtRef = useRef(Date.now());
  const elapsedSeconds = () => Math.floor((Date.now() - startedAtRef.current) / 1000);

  // Match explosion animation & drag feedback
  const [activeDraggingShelfId, setActiveDraggingShelfId] = useState<string | null>(null);
  const [matchingShelfId, setMatchingShelfId] = useState<string | null>(null);
  const [hintMove, setHintMove] = useState<{ from: string; to: string } | null>(null);

  // Sync level selection when question config changes
  useEffect(() => {
    const qLevelId = (question.config as any)?.levelId || "level_1";
    setSelectedLevelId(qLevelId);
  }, [(question.config as any)?.levelId, question.id]);

  // Load level shelves on level, config, or question change
  useEffect(() => {
    const initial = loadLevelShelves(currentLevel);
    initialShelvesRef.current = initial;
    setShelves(loadLevelShelves(currentLevel));
    setHistory([]);
    setSelectedShelfId(null);
    setIsWon(false);
    setMoveCount(0);
    setClearedTripletsCount(0);
    setHintMove(null);
    setMatchingShelfId(null);
    startedAtRef.current = Date.now();
    blockedMoves.current = 0;
  }, [currentLevel, question.id]);

  /**
   * What the child is actually trying to do, per kind of goods.
   *
   * `gathered` is the largest number of that kind sitting together in one compartment —
   * which is the only grouping that counts, and the number the board is scored on.
   *
   * This exists because the goal was invisible. The board showed twelve compartments of
   * mixed goods and nothing that said "eight kinds, three of each, one compartment each",
   * so a child could only sort by trial and error. Seeing "🍩 2/3" is what turns the next
   * move into a decision — finish the donuts, they are one away — rather than a guess,
   * and it is the same reading a fast sorter does in their head.
   */
  const goals = useMemo(() => {
    const gathered = new Map<string, { item: GoodsItem; gathered: number }>();
    for (const shelf of shelves) {
      for (const item of shelf.items) {
        const held = shelf.items.filter((other) => other.typeKey === item.typeKey).length;
        const known = gathered.get(item.typeKey);
        if (!known || held > known.gathered) gathered.set(item.typeKey, { item, gathered: held });
      }
    }
    // Closest to done first: that ordering is the advice. The kind with three of four
    // already together is the one worth finishing, and it is what the rail shows first
    // when there is not room for every kind.
    return [...gathered.values()].sort((a, b) => b.gathered - a.gathered);
  }, [shelves]);

  const setsDone = goals.filter((goal) => goal.gathered >= currentLevel.compartmentCapacity).length;

  /**
   * Nudge a child who has stalled, instead of waiting for them to find the Hint button.
   *
   * A six-year-old who does not know what to do next does not go looking for help — they
   * stop. After a quiet stretch the best move lights up on its own, which is the same
   * thing a teacher leaning over the table would do. Deliberately not reported through
   * `onHint`: the child did not ask for it, and logging it as a hint request would make
   * their mastery score read as if they had.
   */
  useEffect(() => {
    if (isWon || !isPlayMode || hintMove || matchingShelfId) return;
    const timer = setTimeout(() => {
      const move = solveGoodsSort(shelves);
      if (move) setHintMove(move);
    }, 15000);
    return () => clearTimeout(timer);
  }, [shelves, isWon, isPlayMode, hintMove, matchingShelfId]);

  // Victory Check - All non-empty shelves have matching items
  useEffect(() => {
    if (isWon) return;
    if (isGoodsBoardSolved(shelves) && moveCount > 0) {
      setIsWon(true);
      sounds.playWin();
      if (onSuccess) onSuccess();
      if (onAttempt) {
        // Report the shelves themselves, not "I finished level_4": the server re-checks
        // that every compartment holds one kind of goods and that the board still holds
        // exactly the goods it started with. A claim of success proves nothing on its own.
        onAttempt("correct", {
          selected: shelves.map((shelf) => shelf.items.map((item) => item.typeKey)),
          details: {
            levelId: selectedLevelId,
            moveCount,
            seconds: elapsedSeconds(),
            clearedSets: clearedTripletsCount,
            blockedMoves: blockedMoves.current,
          },
        });
      }
    }
  }, [shelves, isWon, moveCount, selectedLevelId, clearedTripletsCount, onSuccess, onAttempt]);

  // Handle Transfer & Triple Match Check
  const executeTransfer = (fromId: string, toId: string) => {
    const srcShelf = shelves.find((s) => s.id === fromId);
    const tgtShelf = shelves.find((s) => s.id === toId);

    if (!srcShelf || !tgtShelf || srcShelf.items.length === 0) return;
    if (tgtShelf.items.length >= tgtShelf.capacity) {
      // Deliberately not an `onAttempt("incorrect")`. Trying a full compartment is
      // ordinary play — the child learns from the buzz — and logging it as a wrong
      // answer sank the mastery score of anyone who explored the board at all. It is
      // still counted, and rides along with the solve as a difficulty signal.
      blockedMoves.current += 1;
      sounds.playFailure();
      return;
    }

    // Save history for Undo
    setHistory((prev) =>
      prev.concat([
        shelves.map((s) => ({
          ...s,
          items: s.items.map((i) => ({ ...i })),
        })),
      ])
    );

    const itemToMove = srcShelf.items[srcShelf.items.length - 1];

    const nextShelves = shelves.map((s) => {
      if (s.id === fromId) {
        return { ...s, items: s.items.slice(0, s.items.length - 1) };
      }
      if (s.id === toId) {
        return { ...s, items: [...s.items, itemToMove] };
      }
      return s;
    });

    sounds.playPop();
    setShelves(nextShelves);
    setMoveCount((prev) => prev + 1);
    setSelectedShelfId(null);
    setHintMove(null);

    // Check if target shelf now has 3 or 4 identical items (Match Completed!)
    const updatedTarget = nextShelves.find((s) => s.id === toId)!;
    if (
      updatedTarget.items.length === updatedTarget.capacity &&
      updatedTarget.items.every((i) => i.typeKey === updatedTarget.items[0].typeKey)
    ) {
      setMatchingShelfId(toId);
      sounds.playSparkle();
      sounds.playSuccess();
      setClearedTripletsCount((prev) => prev + 1);

      setTimeout(() => {
        setMatchingShelfId(null);
      }, 800);
    }
  };

  const handleShelfClick = (clickedId: string) => {
    // Deliberately not gated on `matchingShelfId`. The set-complete flourish is
    // decoration, and every control used to be dead for the 800ms it ran — so a child
    // sorting at any speed had taps swallowed right after their best moves, which reads
    // as a broken board rather than as a celebration. The animation now plays over
    // whatever they do next.
    if (isWon) return;

    // A finished drag is followed by a click on whatever was under the finger. Now that
    // the drag layer also listens for taps, that stray click would pick the item straight
    // back up after it was dropped — so ignore anything arriving on the heels of a drag.
    if (Date.now() - draggedAt.current < 250) return;

    if (selectedShelfId === null) {
      const src = shelves.find((s) => s.id === clickedId);
      if (src && src.items.length > 0) {
        setSelectedShelfId(clickedId);
        sounds.playPop();
      }
    } else if (selectedShelfId === clickedId) {
      setSelectedShelfId(null);
    } else {
      executeTransfer(selectedShelfId, clickedId);
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || isWon) return;
    const last = history[history.length - 1];
    setShelves(last);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    // The counter describes the board, so undoing a move has to take it back too. It did
    // not, which left a child looking at "Moves: 1" above an untouched shelf — and made
    // the `moveCount` reported with the solve count taps rather than moves.
    setMoveCount((prev) => Math.max(0, prev - 1));
    setSelectedShelfId(null);
    setHintMove(null);
    sounds.playPop();
  };

  const handleReset = () => {
    // Back to the board this question opened with. Re-resolving the level here used to
    // drop `question.config`, which handed a custom or preset question the wrong puzzle.
    const freshShelves =
      initialShelvesRef.current.length > 0
        ? initialShelvesRef.current.map((s) => ({
            id: s.id,
            capacity: s.capacity,
            items: s.items.map((i) => ({ ...i })),
          }))
        : loadLevelShelves(currentLevel);

    setShelves(freshShelves);
    setHistory([]);
    setSelectedShelfId(null);
    setIsWon(false);
    setMoveCount(0);
    setClearedTripletsCount(0);
    setHintMove(null);
    setMatchingShelfId(null);
    startedAtRef.current = Date.now();
    blockedMoves.current = 0;
    sounds.playPop();
  };

  const shelfRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleGetHint = () => {
    if (isWon) return;

    // Second tap on Hint auto-executes the recommended move!
    if (hintMove) {
      executeTransfer(hintMove.from, hintMove.to);
      setHintMove(null);
      return;
    }

    const move = solveGoodsSort(shelves);
    if (move) {
      setHintMove(move);
      setSelectedShelfId(move.from); // Auto-select source item!
      sounds.playPop();
      setTimeout(() => setHintMove(null), 8000); // Extended 8s guidance duration
      if (onHint) {
        onHint({
          levelId: selectedLevelId,
          hintFrom: move.from,
          hintTo: move.to,
        });
      }
    }
  };

  /**
   * Re-deal the board when a child is stuck, without ever stranding them.
   *
   * It applies random *legal* moves rather than tipping every item out and redistributing
   * them. That distinction is the whole point: a redistribution can produce a board that
   * no sequence of moves finishes, so the old shuffle button could quietly hand a child an
   * impossible puzzle. Any run of legal moves can be walked backwards, so a solvable board
   * stays solvable. It also goes on the undo stack, so it can be taken back.
   */
  const handleShuffle = () => {
    if (isWon) return;

    const next = shelves.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
    scrambleGoodsBoard(next, Math.random, next.length * 2);

    setHistory((prev) =>
      prev.concat([shelves.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }))])
    );
    setShelves(next);
    setSelectedShelfId(null);
    setHintMove(null);
    sounds.playPop();
  };

  const btnPill = (variant: "neutral" | "indigo" | "cyan" = "neutral") =>
    `flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-40 ${
      isDark
        ? variant === "indigo"
          ? "border-indigo-500/40 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
          : variant === "cyan"
          ? "border-cyan-500/30 bg-cyan-600/20 text-cyan-300"
          : "border-white/10 bg-white/[0.08] text-slate-300 hover:bg-white/[0.16]"
        : variant === "indigo"
        ? "border-indigo-200 bg-indigo-50/90 text-indigo-700 hover:bg-indigo-100 shadow-sm"
        : variant === "cyan"
        ? "border-slate-200 bg-slate-100/90 text-slate-700 shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 shadow-sm"
    }`;

  const headerControls = (
    // `min-w-0` is what makes the `flex-wrap` here mean anything: without it this block
    // sizes to its content and runs off the edge of a narrow card — on a phone the Reset
    // and Shuffle buttons were simply not reachable.
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
      <div className={btnPill("neutral")}>
        <span className={isDark ? "text-slate-400" : "text-slate-500"}>Moves:</span>
        <span className={isDark ? "text-indigo-400 font-extrabold" : "text-indigo-600 font-extrabold"}>
          {moveCount}
        </span>
      </div>

      <div className={btnPill("cyan")}>
        <Timer size={14} className={isDark ? "text-cyan-400" : "text-slate-500"} />
        <ElapsedClock startedAt={startedAtRef.current} stopped={isWon} />
      </div>

      <button type="button" onClick={handleGetHint} disabled={isWon} className={btnPill("indigo")}>
        <Lightbulb size={14} className={isDark ? "text-indigo-300" : "text-indigo-600"} /> Hint
      </button>

      <button type="button" onClick={handleUndo} disabled={history.length === 0} className={btnPill("neutral")}>
        <RotateCcw size={14} /> Undo
      </button>

      <button type="button" onClick={handleReset} className={btnPill("neutral")}>
        <RotateCw size={14} /> Reset
      </button>

      <button type="button" onClick={handleShuffle} disabled={isWon} className={btnPill("indigo")}>
        <Shuffle size={14} /> Shuffle
      </button>
    </div>
  );

  // One template, shared by the backboard grid and the drag layer above it — they have to
  // divide the cabinet identically or an item would sit over the wrong compartment. Rows
  // are explicit (they used to be implicit, so they sized to content instead of splitting
  // the height) and `minmax(0, 1fr)` lets a row shrink below its content rather than
  // pushing the grid past the cabinet.
  const gridTemplate: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };

  /**
   * Item size follows the compartment, not a bracket of column counts.
   *
   * The old version picked from four hard-coded size bands keyed on how many columns the
   * *level* declared. Once the board can turn portrait that number stops describing the
   * space: a 5x2 board redrawn as 2x5 took the "3 or fewer columns" band — the largest —
   * and four items at that size spilled straight out of the compartment and over the
   * cabinet's edge. Measuring removes the guess.
   */
  const itemStyles = (() => {
    const compartment = boardBox.width > 0
      ? Math.min(boardBox.width / cols, boardBox.height / rows)
      : 0;
    if (compartment <= 0) {
      // Pre-measurement first paint: a middle-of-the-road guess, replaced within a frame.
      return { size: 40, stepX: 8 };
    }
    // Room for the stack's fan plus a margin, whatever the capacity.
    const fan = (currentLevel.compartmentCapacity - 1) * 0.09;
    return {
      size: Math.max(16, Math.round(compartment / (1.6 + fan))),
      stepX: Math.max(3, Math.round(compartment * 0.09)),
    };
  })();

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      headerTitle={question.title || "Goods Shelf Sort"}
      /*
        The question leads — see `CountCanvas` for the standard. The level's own
        name moves to the chip row; what the child has to do takes the heading.
      */
      questionText={question.instruction?.trim() || `Gather all ${currentLevel.compartmentCapacity} of a kind into one compartment.`}
      readAloudText={question.instruction?.trim() || `Gather all ${currentLevel.compartmentCapacity} of a kind into one compartment.`}
      /* The four moments, cast from Mascot Studio — see `casting.ts`. */
      guideRole={isWon ? "celebrating" : "waiting"}
      {...guidePropsFor(question)}
      playHint={
        currentLevel.teaches ||
        `Gather all ${currentLevel.compartmentCapacity} of a kind into one compartment.`
      }
      designerHint="Tap items or drag them between shelf compartments to group identical goods."
      headerActions={headerControls}
      footerStatus={
        isWon
          ? `Superb job! You organized all goods in ${moveCount} moves and ${formatTime(elapsedSeconds())}!`
          : hintMove
          ? "💡 Tap highlighted target shelf (or tap Hint again to auto-move)"
          : selectedShelfId
          ? "Select a destination shelf to place the item"
          : undefined
      }
      footerSolved={isWon}
      isDark={isDark}
    >
      <div
        ref={stageRef}
        // `flex-1` is what makes `min-h-0` mean anything here. Without it the stage sized
        // itself to its content, so the cabinet — a square measured against the viewport —
        // had no height to be capped against and simply overflowed the card. On the 4x5
        // grandmaster boards that hid the bottom row of compartments entirely.
        className={`flex min-h-0 w-full flex-1 flex-col items-center justify-center p-1 sm:p-3 select-none rounded-3xl relative overflow-visible transition-colors duration-300 bg-transparent border-0 shadow-none ${
          isDark
            ? "text-stone-100"
            : "text-stone-900"
        }`}
      >
        {/* One offline sprite serves every product on the board and in the goal rail. */}
        <GoodsAssetLibrary />
        {/* Soft Natural Ambient Light Drop */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-96 w-96 rounded-full bg-amber-400/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-orange-400/10 blur-[110px]" />

        {/* Interactive SVG Curved Trajectory Arrow for Hint Guide */}
        {hintMove && (() => {
          const srcEl = shelfRefs.current[hintMove.from];
          const tgtEl = shelfRefs.current[hintMove.to];
          const stageRect = stageRef.current?.getBoundingClientRect();

          if (srcEl && tgtEl && stageRect) {
            const sRect = srcEl.getBoundingClientRect();
            const tRect = tgtEl.getBoundingClientRect();

            const startX = sRect.left + sRect.width / 2 - stageRect.left;
            const startY = sRect.top + sRect.height / 2 - stageRect.top;
            const endX = tRect.left + tRect.width / 2 - stageRect.left;
            const endY = tRect.top + tRect.height / 2 - stageRect.top;

            const isRight = endX >= startX;
            const controlX = (startX + endX) / 2 + (isRight ? 20 : -20);
            const controlY = Math.min(startY, endY) - 50;
            const path = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

            return (
              <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="goods-hint-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#34D399" />
                  </linearGradient>
                </defs>

                {/* Outer Glow Path */}
                <motion.path
                  d={path}
                  fill="none"
                  stroke="#818CF8"
                  strokeWidth="8"
                  strokeLinecap="round"
                  style={{ filter: "blur(4px)" }}
                  opacity="0.5"
                />

                {/* Animated Dashed Trajectory Line */}
                <motion.path
                  d={path}
                  fill="none"
                  stroke="url(#goods-hint-grad)"
                  strokeWidth="4"
                  strokeDasharray="8 6"
                  animate={{ strokeDashoffset: [-28, 0] }}
                  transition={{ repeat: Infinity, duration: 0.35, ease: "linear" }}
                />

                {/* Source Pointer Start Bulb */}
                <circle cx={startX} cy={startY} r="6" fill="#818CF8" className="animate-pulse" />

                {/* Destination Target Pulsing Ring & Badge */}
                <g transform={`translate(${endX}, ${endY})`}>
                  <motion.circle
                    r="20"
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="3.5"
                    initial={{ scale: 0.8, opacity: 0.9 }}
                    animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.9, 0.3, 0.9] }}
                    transition={{ repeat: Infinity, duration: 0.7 }}
                  />
                  <circle r="6" fill="#34D399" />
                </g>
              </svg>
            );
          }
          return null;
        })()}

        {/* Goal rail — every kind of goods and how far along it is. */}
        <div
          data-testid="goods-goal-rail"
          className="z-10 mb-1 flex w-full shrink-0 max-w-[min(100%,70vh)] flex-wrap items-center justify-center gap-1 px-1 sm:gap-1.5"
        >
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide sm:text-[10px] ${
              isDark ? "bg-white/10 text-slate-300" : "bg-slate-900/5 text-slate-600"
            }`}
          >
            {setsDone}/{goals.length} sorted
          </span>
          {goals.slice(0, RAIL_CHIP_LIMIT).map(({ item, gathered }) => {
            const done = gathered >= currentLevel.compartmentCapacity;
            return (
              <motion.span
                key={item.typeKey}
                layout
                title={item.label}
                animate={done ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-black sm:text-[10px] ${
                  done
                    ? "border-emerald-400 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                    : isDark
                    ? "border-white/10 bg-white/[0.06] text-slate-300"
                    : "border-slate-200 bg-white/80 text-slate-600"
                }`}
              >
                <GoodsAsset
                  typeKey={item.typeKey}
                  size={16}
                  fallback={<span className="text-[11px] leading-none sm:text-sm">{item.emoji}</span>}
                />
                {done ? (
                  <Check size={10} strokeWidth={4} />
                ) : (
                  <span>
                    {gathered}/{currentLevel.compartmentCapacity}
                  </span>
                )}
              </motion.span>
            );
          })}
          {goals.length > RAIL_CHIP_LIMIT && (
            <span
              title={goals.slice(RAIL_CHIP_LIMIT).map((goal) => goal.item.label).join(", ")}
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-black sm:text-[10px] ${
                isDark ? "bg-white/[0.06] text-slate-400" : "bg-slate-900/5 text-slate-500"
              }`}
            >
              +{goals.length - RAIL_CHIP_LIMIT}
            </span>
          )}
        </div>

        {/*
          Goods Shelf Grid Matrix - Fluid Responsive Bookcase Cabinet

          The cabinet sizes off the *viewport* (a square, up to 70vh), so it ignored the
          height it was actually handed and spilled past both ends of the stage — the top
          row sliding under the toolbar. The row below gives it the remaining height and
          `max-h-full` makes the square shrink to fit it, so the shelf is always whole.
        */}
        <div
          ref={boardBoxRef}
          className="z-10 flex min-h-0 w-full flex-1 items-center justify-center overflow-visible"
        >
        <div
          // Sized from its *width*, and capped by height only when there is a height to cap
          // against. Both halves matter, and each one alone was a bug:
          //
          //   * width alone let the square outgrow a short card, hiding the bottom row of
          //     compartments on the 4x5 boards;
          //   * `min(100cqw, 100cqh)`, which fixed that, collapsed the shelf to nothing the
          //     moment a container gave no definite height — which is exactly what the
          //     curriculum preview does (`min-h-[420px]`, a floor, not a height). `100cqh`
          //     resolved to 0 and the whole cabinet vanished.
          //
          // So: never depend on the parent having a height. `max-h-full` is a no-op when
          // there isn't one, and the grid below shrinks its rows rather than overflowing
          // when there is.
          // Shaped like its own grid, so the compartments come out square: a square cabinet
          // split 3 wide by 2 deep gives compartments half again as tall as they are wide,
          // and every item sat in a pool of empty shelf.
          style={cabinetStyle}
          className="max-w-full max-h-full p-0.5 sm:p-2.5 rounded-2xl bg-[#D89454] border-1 sm:border-5 border-[#C48042] shadow-2xl flex flex-col justify-center items-center relative overflow-visible">
          
          {/* LAYER 1: Recessed Cubby Cavity Backboards & Wooden Floor Planks */}
          <div
            className="grid w-full h-full gap-0.5 sm:gap-1.5 bg-[#D89454] p-0.5 justify-items-center items-center"
            style={gridTemplate}
          >
            {shelves.map((shelf) => {
              const isSelected = selectedShelfId === shelf.id;
              const isMatching = matchingShelfId === shelf.id;
              const isHintSrc = hintMove?.from === shelf.id;
              const isHintTgt = hintMove?.to === shelf.id;
              const isEmpty = shelf.items.length === 0;

              const activeSourceShelf = selectedShelfId ? shelves.find((s) => s.id === selectedShelfId) : null;
              const activeItem = activeSourceShelf?.items[activeSourceShelf.items.length - 1];
              
              const isOtherShelf = selectedShelfId !== null && selectedShelfId !== shelf.id;
              const hasSpace = shelf.items.length < shelf.capacity;
              const isMatchDropTarget = isOtherShelf && hasSpace && !isEmpty && shelf.items.some((it) => it.typeKey === activeItem?.typeKey);
              const isValidEmptyDropTarget = isOtherShelf && hasSpace && isEmpty;

              return (
                <motion.div
                  key={shelf.id}
                  data-shelf-id={shelf.id}
                  ref={(el) => {
                    shelfRefs.current[shelf.id] = el;
                  }}
                  onClick={() => handleShelfClick(shelf.id)}
                  animate={
                    isMatching
                      ? { scale: [1, 1.12, 0.97, 1], rotate: [0, -3, 3, 0] }
                      : isSelected
                      ? { y: -4, scale: 1.02 }
                      : { y: 0, scale: 1 }
                  }
                  // A spring cannot run a multi-keyframe track — motion throws
                  // "Only two keyframes currently supported with spring", which is an
                  // uncaught error every time a set completes. The celebration wiggle
                  // gets a tween; everything else keeps the spring it was tuned with.
                  transition={
                    isMatching
                      ? { duration: 0.45, ease: "easeInOut" }
                      : { type: "spring", stiffness: 380, damping: 26 }
                  }
                  className="relative flex w-full h-full flex-col justify-end items-center p-0.5 rounded-sm cursor-pointer transition-all z-0"
                >
                  {/* Recessed Dark Brown Cubby Cavity Backboard Background */}
                  <div
                    className={`absolute inset-0 rounded-sm overflow-hidden shadow-[inset_0_6px_14px_rgba(0,0,0,0.65)] pointer-events-none ${
                      isSelected
                        ? "border-2 border-amber-300 bg-[#5A381E] ring-2 ring-amber-300"
                        : isMatching
                        ? "border-2 border-emerald-400 bg-[#1C3D2B] ring-2 ring-emerald-400"
                        : isMatchDropTarget
                        ? "border-2 border-emerald-400/90 bg-[#224A33] ring-2 ring-emerald-400/50"
                        : isEmpty
                        ? isValidEmptyDropTarget
                          ? "border-2 border-dashed border-amber-400/80 bg-[#5A381E]/80"
                          : "bg-[#6B4323] hover:bg-[#784C28]"
                        : "bg-[#6B4323] hover:bg-[#784C28]"
                    }`}
                  />
                                      {/* Target Match Trace Floating Drop Badge */}
                  {isMatchDropTarget && (
                    <motion.div
                      initial={{ scale: 0, y: -4 }}
                      animate={{ scale: 1, y: 0 }}
                      className="absolute -top-3 z-30 bg-emerald-500 text-white font-black text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full shadow border border-emerald-300 flex items-center gap-0.5 pointer-events-none"
                    >
                      <Sparkles size={9} />
                      <span>MATCH HERE</span>
                    </motion.div>
                  )}

                  {/* Target Shelf 'TAP HERE 🎯' Hint Floating Badge */}
                  {isHintTgt && !isMatchDropTarget && (
                    <div className="absolute -top-3 z-30 bg-emerald-500 text-white font-extrabold text-[7.5px] sm:text-[8.5px] px-1.5 py-0.5 rounded-full shadow-lg border border-emerald-300 flex items-center gap-0.5 pointer-events-none">
                      <span>TAP HERE 🎯</span>
                    </div>
                  )}

                  {/* Triple Match Celebratory Floating Pill */}
                  {isMatching && (
                    <motion.div
                      initial={{ scale: 0, y: 0 }}
                      animate={{ scale: [0, 1.15, 1], y: -14 }}
                      className="absolute z-40 bg-gradient-to-r from-indigo-500 to-emerald-500 text-white font-black text-[8.5px] sm:text-[10px] px-2 py-0.5 rounded-full shadow-2xl border border-white flex items-center gap-1 pointer-events-none"
                    >
                      <Sparkles size={10} className="text-white" />
                      <span>TRIPLE MATCH!</span>
                    </motion.div>
                  )}

                  {/* Warm Light Oak Bottom Shelf Floor Plank */}
                  <div className="absolute bottom-0 inset-x-0 h-2.5 sm:h-3 rounded-b-[4px] bg-[#C88A4B] border-t border-[#A66C35] shadow-inner pointer-events-none" />

                  {/* Hint Guide Highlight */}
                  {(isHintSrc || isHintTgt) && (
                    <div
                      className={`absolute -inset-1 rounded-xl pointer-events-none ${
                        isHintSrc ? "bg-indigo-400/30 ring-2 ring-indigo-400" : "bg-emerald-400/30 ring-2 ring-emerald-400"
                      }`}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* LAYER 2: Foreground Items Grid Overlay (Unclipped Drag Layer Above All Backboards & Wooden Partitions) */}
          <div
            className="absolute inset-0 p-0.5 sm:p-2.5 pointer-events-none z-50 grid w-full h-full gap-0.5 sm:gap-1.5 justify-items-center items-center overflow-visible"
            style={gridTemplate}
          >
            {shelves.map((shelf) => {
              const isSelected = selectedShelfId === shelf.id;
              const isDraggingThisShelf = activeDraggingShelfId === shelf.id;

              return (
                <div
                  key={`items-${shelf.id}`}
                  data-shelf-id={shelf.id}
                  // Tapping the goods themselves has to work, and it did not: this drag
                  // layer covers the compartment and takes the pointer, while the click
                  // handler lives on the backboard *underneath* it — a different subtree,
                  // so the tap never bubbled anywhere useful. Only the bare floor of a
                  // compartment responded, which is the one part of it a child does not
                  // aim at. Both layers now lead to the same place.
                  onClick={() => handleShelfClick(shelf.id)}
                  className="relative flex w-full h-full flex-col justify-end items-center p-0.5 rounded-sm overflow-visible pointer-events-auto cursor-pointer"
                >
                  <div className="relative flex items-end justify-center w-full h-full pb-1 sm:pb-2 pointer-events-none overflow-visible">
                    <AnimatePresence>
                      {shelf.items.map((item, idx) => {
                        const isFront = idx === shelf.items.length - 1;

                        return (
                          <motion.div
                            key={item.id}
                            layout
                            drag={isFront && isPlayMode}
                            dragConstraints={stageRef}
                            dragElastic={0.2}
                            dragSnapToOrigin={true}
                            whileDrag={{
                              scale: 1.4,
                              rotate: 6,
                              zIndex: 999999,
                              filter: "drop-shadow(0 30px 30px rgba(0,0,0,0.6))",
                            }}
                            whileHover={isFront ? { scale: 1.06, y: -2 } : undefined}
                            onDragStart={() => {
                              setActiveDraggingShelfId(shelf.id);
                              if (isFront && selectedShelfId !== shelf.id) {
                                setSelectedShelfId(shelf.id);
                              }
                            }}
                            onDragEnd={(_, info) => {
                              setActiveDraggingShelfId(null);
                              draggedAt.current = Date.now();
                              if (!isFront) return;
                              const elements = document.elementsFromPoint(info.point.x, info.point.y);
                              const targetEl = elements.find(
                                (el) =>
                                  el.getAttribute("data-shelf-id") &&
                                  el.getAttribute("data-shelf-id") !== shelf.id
                              );
                              const targetId = targetEl?.getAttribute("data-shelf-id");
                              if (targetId) {
                                executeTransfer(shelf.id, targetId);
                              }
                            }}
                            data-shelf-id={shelf.id}
                            initial={{ scale: 0.5, opacity: 0, y: -20 }}
                            animate={{
                              scale: isFront ? (isSelected ? 1.08 : 1) : 0.94,
                              opacity: 1,
                              x: (idx - (shelf.items.length - 1) / 2) * itemStyles.stepX,
                              y: isSelected && isFront ? -6 : 0,
                              rotate: isSelected && isFront ? [0, -3, 3, 0] : 0,
                            }}
                            exit={{ scale: 0, opacity: 0 }}
                            // The picked-up wiggle is a four-keyframe track, and a spring
                            // cannot run one — motion throws "Only two keyframes currently
                            // supported with spring" the moment a child taps an item. A
                            // tween carries the wiggle; everything else keeps its spring.
                            transition={
                              isSelected && isFront
                                ? { duration: 0.4, ease: "easeInOut" }
                                : { type: "spring", stiffness: 380, damping: 26 }
                            }
                            className={`absolute bottom-0.5 sm:bottom-2 flex flex-col items-center justify-center p-1 rounded-xl select-none touch-none ${
                              isFront ? "cursor-grab active:cursor-grabbing z-20 pointer-events-auto min-w-[44px] min-h-[44px]" : "z-10 pointer-events-none"
                            }`}
                          >
                            {/*
                              Name the thing in your hand.
                              A carried item is the one moment the child is thinking about
                              *what* it is rather than where it goes, and on the crowded
                              boards a 20px shape is genuinely ambiguous — a gem and a ring
                              read alike at that size. Naming it there teaches the word
                              alongside the sort, and it is the only label small enough to
                              show without crowding the shelf.

                              It appears on tap as well as on drag: on a tablet, picking up
                              is a tap, and a label that only ever showed while a finger was
                              sliding would never be seen by half the learners.
                            */}
                            {isFront && (isDraggingThisShelf || isSelected) && (
                              <motion.div
                                initial={{ opacity: 0, y: 4, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.14 }}
                                className="pointer-events-none absolute -top-5 sm:-top-6 z-[999999] whitespace-nowrap rounded-full border border-white/70 bg-slate-900/90 px-2 py-0.5 text-[8px] sm:text-[10px] font-black uppercase tracking-wide text-white shadow-lg"
                              >
                                {item.label}
                              </motion.div>
                            )}

                            {/* Clean Standalone Object (No Background Card Box) */}
                            <div className="flex items-center justify-center relative p-0.5 group">
                              <GoodsAsset
                                typeKey={item.typeKey}
                                size={itemStyles.size}
                                className="transition-transform group-hover:scale-105"
                                fallback={(
                                  <span
                                    style={{ fontSize: itemStyles.size, lineHeight: 1 }}
                                    className="select-none filter drop-shadow-md transition-transform hover:scale-105"
                                  >
                                    {item.emoji}
                                  </span>
                                )}
                              />
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>
      <Celebration show={isWon} />
    </SharedCanvasLayout>
  );
};
