/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Counting Crates — the rules, the ladder, and the solver. No React, so all of it is
 * unit-testable under `tsx --test` (see `countCratesModel.test.ts`).
 *
 * ── The game ────────────────────────────────────────────────────────────────────
 *
 * An order asks for a number. Crates hold 1, 5, 10 or 100. Load crates into the tray until
 * it totals the order exactly. Three moves and nothing else:
 *
 *   load    take a crate from stock into the tray
 *   unload  put one back
 *   open    break a crate into the next size down — 100 → ten 10s, 10 → ten 1s,
 *           5 → five 1s. **One-way**, and rationed by `opensAllowed`.
 *
 * It reads like addition and is not: the child unitizes. A crate of ten *is* ten, counted
 * as one thing, and the running total goes 10 → 20 → 21 → 22 → 23. That is counting on
 * from a group, the bridge between counting by ones and place value.
 *
 * The constraints are where it stops being a drill:
 *
 *   fewest    forces reaching for the biggest crate that fits — place-value reasoning
 *             arrived at rather than told, and the reason over-opening is not a shortcut
 *   exactly   forces trading between representations: 23 in exactly 5 crates is
 *             10+10+1+1+1; in exactly 6 it is 10+5+5+1+1+1
 *
 * ── Why every level is finishable ───────────────────────────────────────────────
 *
 * Verified exhaustively rather than assumed. `solveCountCrates` enumerates every opening
 * decision and every crate selection — the space is small enough to search *completely*,
 * so "no solution found" means there is none. That is a stronger guarantee than the
 * sorting games could get, where the space forced a budgeted search and levels had to be
 * built backwards from a finished board instead.
 */

export type CountingTier = "beginner" | "apprentice" | "advanced" | "master" | "grandmaster";

/** Crate sizes, largest first. Ordering matters: the solver and the "fewest" rule both
 *  walk it from the top, which is the behaviour the game is trying to teach. */
export const CRATE_UNITS = [100, 10, 5, 1] as const;
export type CrateUnit = (typeof CRATE_UNITS)[number];

/** What a crate becomes when opened. A 5 breaks into ones — there is no 2 or 3 crate. */
export const OPENS_INTO: Record<CrateUnit, { unit: CrateUnit; count: number } | null> = {
  100: { unit: 10, count: 10 },
  10: { unit: 1, count: 10 },
  5: { unit: 1, count: 5 },
  1: null,
};

export type CrateConstraint = "none" | "fewest" | "exactly";

export type Stock = Partial<Record<CrateUnit, number>>;

export interface CratesLevel {
  id: string;
  name: string;
  description: string;
  /** The single strategy rung this board teaches — shown to the learner while they play. */
  teaches: string;
  difficultyTier: CountingTier;
  /** What the order asks for. */
  orderTotal: number;
  /** Crates on the shelf at the start. */
  stock: Stock;
  constraint: CrateConstraint;
  /** Only for `exactly`: how many crates the order must be packed in. */
  exactCrates?: number;
  /** How many crates may be opened. 0 means the shelf is what you get. */
  opensAllowed: number;
  /** The goods on the crates — theme only, never rules. */
  goodsEmoji: string;
  goodsLabel: string;
}

// ── Board state ─────────────────────────────────────────────────────────────────

export interface CratesBoard {
  stock: Stock;
  /** Crate sizes in the tray, in the order they were loaded. */
  tray: CrateUnit[];
  opensUsed: number;
}

export const startingBoard = (level: CratesLevel): CratesBoard => ({
  stock: { ...level.stock },
  tray: [],
  opensUsed: 0,
});

export const cloneBoard = (board: CratesBoard): CratesBoard => ({
  stock: { ...board.stock },
  tray: [...board.tray],
  opensUsed: board.opensUsed,
});

export const trayTotal = (board: CratesBoard): number =>
  board.tray.reduce((total, unit) => total + unit, 0);

export const stockCount = (stock: Stock, unit: CrateUnit): number => stock[unit] ?? 0;

export const stockValue = (stock: Stock): number =>
  CRATE_UNITS.reduce((total, unit) => total + unit * stockCount(stock, unit), 0);

// ── Moves ───────────────────────────────────────────────────────────────────────

export const canLoad = (board: CratesBoard, unit: CrateUnit): boolean =>
  stockCount(board.stock, unit) > 0;

export function load(board: CratesBoard, unit: CrateUnit): CratesBoard {
  if (!canLoad(board, unit)) return board;
  const next = cloneBoard(board);
  next.stock[unit] = stockCount(next.stock, unit) - 1;
  next.tray.push(unit);
  return next;
}

/** Unload a specific crate — by position, because a tray may hold several of a size. */
export function unload(board: CratesBoard, index: number): CratesBoard {
  if (index < 0 || index >= board.tray.length) return board;
  const next = cloneBoard(board);
  const [unit] = next.tray.splice(index, 1);
  next.stock[unit] = stockCount(next.stock, unit) + 1;
  return next;
}

export const canOpen = (board: CratesBoard, unit: CrateUnit, level: CratesLevel): boolean =>
  OPENS_INTO[unit] !== null
  && stockCount(board.stock, unit) > 0
  && board.opensUsed < level.opensAllowed;

/**
 * Break a crate into the next size down. The one move that cannot be undone.
 *
 * That is deliberate, and it is the whole of what this teaches: a ten opened to get at
 * three ones is a ten you no longer have. Regrouping as a decision with a cost, rather
 * than a step in a procedure.
 */
export function open(board: CratesBoard, unit: CrateUnit, level: CratesLevel): CratesBoard {
  if (!canOpen(board, unit, level)) return board;
  const into = OPENS_INTO[unit]!;
  const next = cloneBoard(board);
  next.stock[unit] = stockCount(next.stock, unit) - 1;
  next.stock[into.unit] = stockCount(next.stock, into.unit) + into.count;
  next.opensUsed += 1;
  return next;
}

// ── Is it filled? ───────────────────────────────────────────────────────────────

/**
 * The one place "finished" is decided: **the order is filled when the total is right.**
 *
 * The constraint used to gate this, and it was wrong. Requiring the tray to hold precisely
 * N crates means any reasonable-but-suboptimal move makes the board unfinishable, so a
 * child who has counted correctly is told no — with no way to see why. An audit of the
 * ladder found it everywhere: the "biggest crate first" strategy the levels *teach* failed
 * two of them outright, one opening permanently stranded two more, and on the 100 level
 * (fewest = 1) literally any first crate other than the hundred killed the board.
 *
 * So the crate count is now a **goal to aim at, not a gate**: see `isPerfectlyPacked`.
 * A child who fills the order has filled the order. A child who also packs it tightly has
 * done something better, and is told so. Nobody is refused for counting correctly.
 */
export function isOrderFilled(board: CratesBoard, level: CratesLevel): boolean {
  return trayTotal(board) === level.orderTotal;
}

/** The crate count this level invites a child to hit, or null if it does not ask. */
export function packingGoal(level: CratesLevel): number | null {
  if (level.constraint === "exactly") return level.exactCrates ?? null;
  if (level.constraint === "fewest") return fewestCrates(level);
  return null;
}

/**
 * Filled *and* packed the way the level asked — the bonus, never the requirement.
 *
 * This is what earns the star and what the reward copy celebrates. Grading treats it the
 * same way: a filled order is correct, and this rides along as detail.
 */
export function isPerfectlyPacked(board: CratesBoard, level: CratesLevel): boolean {
  if (!isOrderFilled(board, level)) return false;
  const goal = packingGoal(level);
  return goal === null || board.tray.length === goal;
}

// ── Solver ──────────────────────────────────────────────────────────────────────

export interface CratePlan {
  /** The crates that fill the order, largest first. */
  crates: CrateUnit[];
  /** Which crates have to be opened first, and how many of each. */
  opens: Partial<Record<CrateUnit, number>>;
}

/**
 * Every solution to a board, exhaustively.
 *
 * The search is complete, not budgeted: opening decisions are bounded by `opensAllowed`
 * (never more than a handful) and crate counts by what is on the shelf, so enumerating
 * the lot costs less than a millisecond. `null` from `solveCountCrates` therefore means
 * *unsolvable*, which is what lets the export refuse to seed a broken level.
 */
function* solutions(board: CratesBoard, level: CratesLevel): Generator<CratePlan> {
  const remaining = level.orderTotal - trayTotal(board);
  if (remaining < 0) return;

  const openBudget = level.opensAllowed - board.opensUsed;
  const openable = CRATE_UNITS.filter((unit) => OPENS_INTO[unit] !== null);

  // Enumerate how many of each size to open, within the budget and the shelf.
  const openChoices: Array<Partial<Record<CrateUnit, number>>> = [];
  const walkOpens = (index: number, used: number, chosen: Partial<Record<CrateUnit, number>>) => {
    if (index === openable.length) {
      openChoices.push({ ...chosen });
      return;
    }
    const unit = openable[index];
    const most = Math.min(stockCount(board.stock, unit), openBudget - used);
    for (let count = 0; count <= most; count++) {
      walkOpens(index + 1, used + count, count ? { ...chosen, [unit]: count } : chosen);
    }
  };
  walkOpens(0, 0, {});

  for (const opens of openChoices) {
    // Apply the opening decision to a copy of the shelf.
    const shelf: Stock = { ...board.stock };
    for (const unit of openable) {
      const count = opens[unit] ?? 0;
      if (!count) continue;
      const into = OPENS_INTO[unit]!;
      shelf[unit] = stockCount(shelf, unit) - count;
      shelf[into.unit] = stockCount(shelf, into.unit) + into.count * count;
    }

    // Every distinct crate selection for this opening decision, not just the first: the
    // "exactly N crates" levels need the one with the right length.
    yield* allPicks(shelf, remaining, 0, [], opens);
  }
}

function* allPicks(
  shelf: Stock,
  left: number,
  index: number,
  taken: CrateUnit[],
  opens: Partial<Record<CrateUnit, number>>,
): Generator<CratePlan> {
  if (left === 0) {
    yield { crates: [...taken], opens };
    return;
  }
  if (index >= CRATE_UNITS.length || left < 0) return;
  const unit = CRATE_UNITS[index];
  const most = Math.min(stockCount(shelf, unit), Math.floor(left / unit));
  for (let count = most; count >= 0; count--) {
    yield* allPicks(
      shelf,
      left - unit * count,
      index + 1,
      [...taken, ...Array<CrateUnit>(count).fill(unit)],
      opens,
    );
  }
}

/** The fewest crates that can fill this level's order, or null if it cannot be filled. */
export function fewestCrates(level: CratesLevel): number | null {
  let best: number | null = null;
  for (const plan of solutions(startingBoard(level), level)) {
    if (best === null || plan.crates.length < best) best = plan.crates.length;
  }
  return best;
}

/**
 * A plan that finishes the board *and satisfies the level's constraint*, or null.
 *
 * Preferring the shortest plan is not cosmetic: it is what stops the hint walking a child
 * back and forth. A shortest plan's next move always lands one step closer, so following
 * hints repeatedly finishes the order rather than cycling — the failure that cost the
 * Goods Sort solver two rewrites.
 */
export function solveCountCrates(board: CratesBoard, level: CratesLevel): CratePlan | null {
  const target =
    level.constraint === "exactly"
      ? level.exactCrates ?? null
      : level.constraint === "fewest"
      ? fewestCrates(level)
      : null;

  let best: CratePlan | null = null;
  let fallback: CratePlan | null = null;
  for (const plan of solutions(board, level)) {
    const total = board.tray.length + plan.crates.length;
    // Keep the shortest plan that finishes the order at all, whatever the crate count. The
    // packing goal is a bonus now, so a child who has already used more crates than it asks
    // for must still be shown the way to a filled order rather than left with no hint.
    if (!fallback || plan.crates.length < fallback.crates.length) fallback = plan;
    if (target !== null && total !== target) continue;
    const opens = Object.values(plan.opens).reduce((sum, n) => sum + (n ?? 0), 0);
    const bestOpens = best
      ? Object.values(best.opens).reduce((sum, n) => sum + (n ?? 0), 0)
      : Infinity;
    if (!best || plan.crates.length < best.crates.length
        || (plan.crates.length === best.crates.length && opens < bestOpens)) {
      best = plan;
    }
  }
  return best ?? fallback;
}

/**
 * Is the order out of reach without opening a crate?
 *
 * The question a child is actually asking when they stare at a shelf of 10s and 5s and an
 * order of 47: *how?* They cannot make 47 from those — 47 is not a multiple of 5 — and the
 * only way through is to open a ten into singles. The board knew that and said nothing,
 * which made a solvable level look broken.
 *
 * Answered by re-solving with the opening budget taken away: if the order is reachable
 * with openings and unreachable without them, opening is not a hint, it is the mechanism,
 * and the canvas says so as soon as it becomes true.
 */
export function needsOpening(board: CratesBoard, level: CratesLevel): boolean {
  return reachStatus(board, level) === "needs-opening";
}

/**
 * The crate to open, what it becomes, and — the number that actually matters — how many of
 * the smaller crates the order needs.
 *
 * "Open a 5 to get 5 ones" answers a question nobody asked. The child is looking at 47 and
 * wondering what is missing, and the answer is *two ones*. `needed` is that number, taken
 * from the plan rather than from the size of the crate being opened.
 */
export function openingSuggestion(
  board: CratesBoard,
  level: CratesLevel,
): { unit: CrateUnit; into: CrateUnit; count: number; needed: number } | null {
  const plan = solveCountCrates(board, level);
  const unit = plan && CRATE_UNITS.find((candidate) => (plan.opens[candidate] ?? 0) > 0);
  if (!unit || !plan) return null;
  const into = OPENS_INTO[unit]!;
  return {
    unit,
    into: into.unit,
    count: into.count,
    needed: plan.crates.filter((crate) => crate === into.unit).length,
  };
}

/**
 * Where the board stands, in the only terms that matter to a child: can this still be
 * finished, and if not, what do I do?
 *
 * `needsOpening` answered that for one case — an order the crate sizes cannot land on
 * exactly. But the same dead end arrives other ways on other levels: spend the small
 * crates, overshoot with no way back down, run the shelf out. In every one of them the
 * board used to sit there looking normal while being unfinishable, and the child had no
 * way to know. One check, applied to every level.
 */
export type ReachStatus = "filled" | "on-track" | "needs-opening" | "stuck";

export function reachStatus(board: CratesBoard, level: CratesLevel): ReachStatus {
  if (isOrderFilled(board, level)) return "filled";
  if (solveCountCrates(board, { ...level, opensAllowed: board.opensUsed })) return "on-track";
  // Unreachable as the shelf stands. Opening is the way out on some levels; on the rest
  // there is nothing for it but to put a crate back.
  if (solveCountCrates(board, level)) return "needs-opening";
  return "stuck";
}

export type CrateHint =
  | { kind: "load"; unit: CrateUnit; reason: string }
  | { kind: "unload"; index: number; reason: string }
  | { kind: "open"; unit: CrateUnit; reason: string }
  | null;

/**
 * The next move a child should make, and why — the "why" is the point. A hint that only
 * moves a crate teaches a twitch; one that says "you need 3 more and the biggest crate
 * that fits is 1" teaches the rule the ladder is built on.
 */
export function hintCountCrates(board: CratesBoard, level: CratesLevel): CrateHint {
  if (isOrderFilled(board, level)) return null;

  const total = trayTotal(board);
  const short = level.orderTotal - total;

  // Over the order: nothing else can help until something comes back out.
  if (short < 0) {
    const overshoot = -short;
    const exact = board.tray.findIndex((unit) => unit === overshoot);
    const index = exact >= 0 ? exact : board.tray.length - 1;
    return {
      kind: "unload",
      index,
      reason: `The tray holds ${total}, which is ${overshoot} too many. Take one back out.`,
    };
  }

  const plan = solveCountCrates(board, level);
  if (!plan) {
    // Unreachable from here — the child has spent something they needed. Say so plainly
    // rather than offering a move that cannot lead anywhere.
    return {
      kind: "unload",
      index: board.tray.length - 1,
      reason: "The shelf cannot make up the rest from here. Take a crate back out and try again.",
    };
  }

  // Opening comes first when the plan needs it: no amount of loading substitutes.
  const openUnit = CRATE_UNITS.find((unit) => (plan.opens[unit] ?? 0) > 0);
  if (openUnit) {
    const into = OPENS_INTO[openUnit]!;
    return {
      kind: "open",
      unit: openUnit,
      reason: `You need smaller crates. Open a ${openUnit} to get ${into.count} ${into.unit}s.`,
    };
  }

  const unit = plan.crates[0];
  return {
    kind: "load",
    unit,
    reason: short === unit
      ? `${short} more fills the order exactly — load the ${unit}.`
      : `You need ${short} more. The biggest crate that fits is ${unit}.`,
  };
}

// ── The ladder ──────────────────────────────────────────────────────────────────

interface LevelSpec extends Omit<CratesLevel, "name" | "description" | "teaches"> {
  name: string;
  description: string;
  teaches: string;
}

/**
 * Ordered easiest to hardest — the array order *is* the ladder, and the seed reads it
 * as-is. One dial turns at a time: crate sizes, then order size, then the constraint,
 * then the shelf running short, then several orders' worth of planning.
 */
const LEVEL_SPECS: LevelSpec[] = [
  // ── Beginner: ones only. Count out a number, one at a time. ──
  {
    id: "crates_1", name: "Level 1: First Order",
    description: "Six apples, one crate at a time.",
    teaches: "Tap one crate at a time. Count as you go.",
    difficultyTier: "beginner", orderTotal: 6, stock: { 1: 10 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🍎", goodsLabel: "apples",
  },
  {
    id: "crates_2", name: "Level 2: Ten Eggs",
    description: "Ten eggs, counted out one by one.",
    teaches: "Keep counting on from the number you have.",
    difficultyTier: "beginner", orderTotal: 10, stock: { 1: 14 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🥚", goodsLabel: "eggs",
  },
  {
    id: "crates_3", name: "Level 3: Five and Some",
    description: "Eight rolls, with a crate of five to help.",
    teaches: "A 5 crate holds five. Start at 5, then count on.",
    difficultyTier: "beginner", orderTotal: 8, stock: { 5: 1, 1: 8 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🍞", goodsLabel: "bread rolls",
  },
  {
    id: "crates_4", name: "Level 4: Two Fives",
    description: "Ten juice boxes from fives or ones.",
    teaches: "Two 5s make 10. There is more than one way.",
    difficultyTier: "beginner", orderTotal: 10, stock: { 5: 2, 1: 10 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🧃", goodsLabel: "juice boxes",
  },
  {
    id: "crates_5", name: "Level 5: The First Ten",
    description: "Thirteen cookies: a ten and some ones.",
    teaches: "A 10 crate holds ten. Start at 10 and count on.",
    difficultyTier: "beginner", orderTotal: 13, stock: { 10: 2, 1: 9 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🍪", goodsLabel: "cookies",
  },

  // ── Apprentice: count on from a group. ──
  {
    id: "crates_6", name: "Level 6: Market Morning",
    description: "Twenty-four oranges from tens, fives and ones.",
    teaches: "Take the 10s first. Then count on with small ones.",
    difficultyTier: "apprentice", orderTotal: 24, stock: { 10: 3, 5: 2, 1: 9 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🍊", goodsLabel: "oranges",
  },
  {
    id: "crates_7", name: "Level 7: Seventeen",
    description: "Seventeen croissants.",
    teaches: "After the 10s, a 5 gets you there faster.",
    difficultyTier: "apprentice", orderTotal: 17, stock: { 10: 2, 5: 3, 1: 8 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🥐", goodsLabel: "croissants",
  },
  {
    id: "crates_8", name: "Level 8: Thirty-Two",
    description: "Thirty-two carrots.",
    teaches: "Say the tens: 10, 20, 30. Then count on.",
    difficultyTier: "apprentice", orderTotal: 32, stock: { 10: 4, 5: 2, 1: 9 },
    constraint: "none", opensAllowed: 0, goodsEmoji: "🥕", goodsLabel: "carrots",
  },
  {
    id: "crates_9", name: "Level 9: Exactly Four Crates",
    description: "Twenty-two pears. Try it in four crates.",
    teaches: "Bigger crates mean you need fewer of them.",
    difficultyTier: "apprentice", orderTotal: 22, stock: { 10: 3, 5: 2, 1: 9 },
    constraint: "exactly", exactCrates: 4, opensAllowed: 0,
    goodsEmoji: "🍐", goodsLabel: "pears",
  },
  {
    id: "crates_10", name: "Level 10: Exactly Five",
    description: "Twenty-six blueberries. Try it in five crates.",
    teaches: "Swap crates to change how many you use.",
    difficultyTier: "apprentice", orderTotal: 26, stock: { 10: 3, 5: 3, 1: 9 },
    constraint: "exactly", exactCrates: 5, opensAllowed: 0,
    goodsEmoji: "🫐", goodsLabel: "blueberries",
  },

  // ── Advanced: fewest crates. Reach for the biggest that fits. ──
  {
    id: "crates_11", name: "Level 11: Pack It Tight",
    description: "Thirty-seven potatoes in as few crates as you can.",
    teaches: "Always take the biggest crate that fits.",
    difficultyTier: "advanced", orderTotal: 37, stock: { 10: 4, 5: 2, 1: 9 },
    constraint: "fewest", opensAllowed: 0, goodsEmoji: "🥔", goodsLabel: "potatoes",
  },
  {
    id: "crates_12", name: "Level 12: Forty-Eight",
    description: "Forty-eight lemons in as few crates as you can.",
    teaches: "Use a 5 only when a 10 is too big.",
    difficultyTier: "advanced", orderTotal: 48, stock: { 10: 5, 5: 3, 1: 9 },
    constraint: "fewest", opensAllowed: 0, goodsEmoji: "🍋", goodsLabel: "lemons",
  },
  {
    id: "crates_13", name: "Level 13: Short of Tens",
    description: "Fifty-three corn, and only four tens.",
    teaches: "No 10s left? Then 5s are the biggest that fit.",
    difficultyTier: "advanced", orderTotal: 53, stock: { 10: 4, 5: 4, 1: 9 },
    constraint: "fewest", opensAllowed: 0, goodsEmoji: "🌽", goodsLabel: "corn",
  },
  {
    id: "crates_14", name: "Level 14: Sixty-One",
    description: "Sixty-one tomatoes.",
    teaches: "Count the 10s first. Ones come last.",
    difficultyTier: "advanced", orderTotal: 61, stock: { 10: 7, 5: 2, 1: 8 },
    constraint: "fewest", opensAllowed: 0, goodsEmoji: "🍅", goodsLabel: "tomatoes",
  },
  {
    id: "crates_15", name: "Level 15: Seventy-Nine",
    description: "Seventy-nine grapes.",
    teaches: "Big crates first. Small crates last.",
    difficultyTier: "advanced", orderTotal: 79, stock: { 10: 8, 5: 3, 1: 9 },
    constraint: "fewest", opensAllowed: 0, goodsEmoji: "🍇", goodsLabel: "grapes",
  },

  // ── Master: the shelf runs short. Open a crate because you need to. ──
  {
    id: "crates_16", name: "Level 16: Twenty-Three",
    description: "Twenty-three pretzels, and no single crates.",
    teaches: "Take the tens first, then count on with ones.",
    difficultyTier: "master", orderTotal: 23, stock: { 10: 3, 5: 2, 1: 6 },
    constraint: "none", opensAllowed: 1, goodsEmoji: "🥨", goodsLabel: "pretzels",
  },
  {
    id: "crates_17", name: "Level 17: Thirty-Four",
    description: "Thirty-four cheeses. You may open one crate.",
    teaches: "Opening a crate makes smaller ones. Try it.",
    difficultyTier: "master", orderTotal: 34, stock: { 10: 4, 5: 2, 1: 8 },
    constraint: "none", opensAllowed: 1, goodsEmoji: "🧀", goodsLabel: "cheese wheels",
  },
  {
    id: "crates_18", name: "Level 18: Forty-Seven",
    description: "Forty-seven honey jars. You may open one crate.",
    teaches: "Big crates first. Open one if it helps.",
    difficultyTier: "master", orderTotal: 47, stock: { 10: 5, 5: 2, 1: 9 },
    constraint: "fewest", opensAllowed: 1, goodsEmoji: "🍯", goodsLabel: "honey jars",
  },
  {
    id: "crates_19", name: "Level 19: Fifty-Eight",
    description: "Fifty-eight coconuts from tens. Open up to two.",
    teaches: "Tens, then a five, then ones.",
    difficultyTier: "master", orderTotal: 58, stock: { 10: 6, 5: 2, 1: 9 },
    constraint: "none", opensAllowed: 2, goodsEmoji: "🥥", goodsLabel: "coconuts",
  },
  {
    id: "crates_20", name: "Level 20: Exactly Six",
    description: "Forty-one olive tins in six crates.",
    teaches: "Swap a ten for smaller crates to hit six.",
    // Six, not seven: 41 from tens and fives needs an opening to reach a 1 at all, and the
    // only crate counts the shelf can then make are 5, 6 and 10. Seven was unreachable —
    // a board that looks ordinary and refuses to finish. The model test now checks this
    // for every `exactly` level rather than trusting the arithmetic in an author's head.
    difficultyTier: "master", orderTotal: 41, stock: { 10: 4, 5: 2, 1: 9 },
    constraint: "exactly", exactCrates: 6, opensAllowed: 1,
    goodsEmoji: "🫒", goodsLabel: "olive tins",
  },

  // ── Grandmaster: hundreds, and orders that need real planning. ──
  {
    id: "crates_21", name: "Level 21: The Hundred",
    description: "One hundred parcels. A big crate arrives.",
    teaches: "A 100 crate holds one hundred.",
    // Ten tens as well as the hundred, deliberately. With only five tens on the shelf the
    // rest of the crates added up to 59, so taking anything before the hundred left the
    // order unreachable — a child's very first tap could strand the board. Now a hundred
    // can be built the long way too, which is also the comparison the level is about.
    difficultyTier: "grandmaster", orderTotal: 100, stock: { 100: 1, 10: 10, 5: 2, 1: 9 },
    constraint: "fewest", opensAllowed: 0, goodsEmoji: "📦", goodsLabel: "parcels",
  },
  {
    id: "crates_22", name: "Level 22: One Hundred and Sixteen",
    description: "One hundred and sixteen baskets.",
    teaches: "Hundreds first, then tens, then ones.",
    difficultyTier: "grandmaster", orderTotal: 116, stock: { 100: 1, 10: 4, 5: 2, 1: 9 },
    constraint: "fewest", opensAllowed: 0, goodsEmoji: "🧺", goodsLabel: "baskets",
  },
  {
    id: "crates_23", name: "Level 23: One Hundred and Seven",
    description: "One hundred and seven chocolates.",
    teaches: "A hundred, then the small crates.",
    difficultyTier: "grandmaster", orderTotal: 107, stock: { 100: 1, 10: 2, 5: 2, 1: 9 },
    constraint: "none", opensAllowed: 2, goodsEmoji: "🍫", goodsLabel: "chocolate boxes",
  },
  {
    id: "crates_24", name: "Level 24: The Big Order",
    description: "One hundred and twenty gifts. The biggest order.",
    teaches: "Biggest first. Open a crate only if you must.",
    difficultyTier: "grandmaster", orderTotal: 120, stock: { 100: 1, 10: 3, 5: 2 },
    constraint: "fewest", opensAllowed: 2, goodsEmoji: "🎁", goodsLabel: "gift boxes",
  },
];

export const COUNT_CRATES_LEVELS: CratesLevel[] = LEVEL_SPECS.map((spec) => ({ ...spec }));

export function getCratesLevel(levelId?: string, config?: any): CratesLevel {
  const curated = COUNT_CRATES_LEVELS.find((level) => level.id === levelId);
  if (curated && !config?.cratesCustom) return curated;
  if (config?.cratesCustom) return normalizeCustomLevel(config);
  return COUNT_CRATES_LEVELS[0];
}

/**
 * A studio-authored board. Clamped rather than trusted: an order the shelf cannot reach is
 * a board no child can finish, so the total is pulled down to what the stock can pay.
 */
/**
 * The largest total at or below `asked` that this shelf can actually pay, exactly.
 *
 * Clamping to the shelf's *value* is not enough and that was a real hole: two 10s are worth
 * 20, so an order of 15 survived the clamp and produced a board with no solution. Anything
 * authoring a board — a teacher in the panel, or the AI generator — could ship one.
 */
export function nearestReachableTotal(
  stock: Stock,
  asked: number,
  opensAllowed: number,
): number {
  const probe = (total: number) =>
    solveCountCrates(
      { stock: { ...stock }, tray: [], opensUsed: 0 },
      {
        id: "probe", name: "", description: "", teaches: "", difficultyTier: "beginner",
        orderTotal: total, stock, constraint: "none", opensAllowed,
        goodsEmoji: "", goodsLabel: "",
      },
    ) !== null;

  const ceiling = Math.min(asked, stockValue(stock));
  for (let total = ceiling; total >= 1; total--) if (probe(total)) return total;
  return 0;
}

export function normalizeCustomLevel(config: any): CratesLevel {
  const stock: Stock = {};
  for (const unit of CRATE_UNITS) {
    const count = Number(config?.cratesStock?.[unit] ?? 0);
    if (Number.isFinite(count) && count > 0) stock[unit] = Math.min(20, Math.floor(count));
  }
  if (!Object.keys(stock).length) stock[1] = 10;

  const constraint: CrateConstraint =
    config?.cratesConstraint === "fewest" || config?.cratesConstraint === "exactly"
      ? config.cratesConstraint
      : "none";
  const opensAllowed = Math.max(0, Math.min(3, Number(config?.cratesOpensAllowed ?? 0)));
  const asked = Math.max(1, Math.floor(Number(config?.orderTotal ?? config?.targetCount ?? 10)));

  const level: CratesLevel = {
    id: "custom",
    name: "Custom order",
    description: `Pack an order of ${asked}.`,
    teaches: "Load crates until the tray matches the order exactly.",
    difficultyTier: "apprentice",
    // Reachable, not merely affordable — see nearestReachableTotal.
    orderTotal: nearestReachableTotal(stock, asked, opensAllowed),
    stock,
    constraint,
    exactCrates: constraint === "exactly"
      ? Math.max(1, Math.floor(Number(config?.cratesExactly ?? 4)))
      : undefined,
    opensAllowed,
    goodsEmoji: typeof config?.goodsEmoji === "string" ? config.goodsEmoji : "🍎",
    goodsLabel: typeof config?.goodsLabel === "string" ? config.goodsLabel : "apples",
  };

  // An unreachable constraint is worse than no constraint: it is a board that looks
  // finished and refuses to be. Drop it rather than ship it.
  if (solveCountCrates(startingBoard(level), level) === null) {
    return { ...level, constraint: "none", exactCrates: undefined };
  }
  return level;
}
