/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Goods Shelf Sort — the curated ladder, the board builder, and the studio generator.
 *
 * ── Why boards are built backwards ──────────────────────────────────────────────
 *
 * Every board here starts from the *finished* shelf (each kind of goods alone in one
 * compartment) and is then scrambled with random legal moves. Every move in this game
 * is reversible — an item moved from A to B can always be moved straight back, because
 * A now has a free slot — so replaying the scramble in reverse always finishes the
 * board. Solvability is therefore a property of how the board was made, not something
 * to hope for and discover later.
 *
 * That matters because the previous generator dealt items at random into random
 * compartments. A random deal is frequently unsolvable, and an unsolvable board is
 * worse for a child than a missing one: they sort what they can, the board never
 * completes, and the activity sits unfinished on their path forever. (The same failure
 * shipped in Liquid Sort — see liquidSortLevels.test.ts.)
 *
 * The scramble is seeded (`mulberry32`), so a level id always produces the same board:
 * a child who retries gets the puzzle they were learning, a teacher previewing in the
 * studio sees what the child will see, and the export/seed pipeline can certify a
 * specific board rather than "whatever came out this time".
 *
 * ── The ladder ──────────────────────────────────────────────────────────────────
 *
 * 30 levels across five tiers, each rung changing exactly one thing, so the strategy is
 * learnable rather than guessable:
 *
 *   beginner     3-slot shelves, 2-5 kinds, plenty of spare room — learn the move.
 *   apprentice   spare room drops to 2-3 shelves — learn to keep a shelf clear.
 *   advanced     up to 13 kinds and as little as one spare shelf — learn to plan ahead.
 *   master       4-slot shelves — the same skills against a longer set.
 *   grandmaster  the full store: 18 kinds, 4-slot shelves, almost no spare room.
 */

export interface GoodsItem {
  id: string;
  typeKey: string;
  label: string;
  emoji: string;
  color: string;
  svgType?: string;
}

export interface ShelfCompartment {
  id: string;
  items: GoodsItem[];
  capacity: number; // default 3 items
}

export type GoodsDifficultyTier =
  | "beginner"
  | "apprentice"
  | "advanced"
  | "master"
  | "grandmaster";

export interface GoodsLevel {
  id: string;
  name: string;
  description: string;
  /** The single strategy rung this board exists to teach — shown to the learner as the goal. */
  teaches: string;
  difficultyTier: GoodsDifficultyTier;
  rows: number;
  cols: number;
  compartmentCapacity: number;
  /** The kinds of goods on the board, in the order their finished shelves were laid out. */
  goodsTypes: string[];
  shelves: ShelfCompartment[];
  /** How many matching sets have to be gathered — one per kind of goods. */
  targetCount: number;
}

export const GOODS_CATALOG: Record<string, { label: string; emoji: string; color: string; svgType: string }> = {
  chips: { label: "Potato Chips", emoji: "🍟", color: "#EF4444", svgType: "chips" },
  cola: { label: "Cola Soda", emoji: "🥤", color: "#DC2626", svgType: "cola" },
  milk: { label: "Fresh Milk", emoji: "🥛", color: "#3B82F6", svgType: "milk" },
  donut: { label: "Glazed Donut", emoji: "🍩", color: "#EC4899", svgType: "donut" },
  teddy: { label: "Teddy Bear", emoji: "🧸", color: "#D97706", svgType: "teddy" },
  duck: { label: "Rubber Duck", emoji: "🦆", color: "#F59E0B", svgType: "duck" },
  popsicle: { label: "Ice Popsicle", emoji: "🍧", color: "#8B5CF6", svgType: "popsicle" },
  apple: { label: "Crisp Apple", emoji: "🍎", color: "#10B981", svgType: "apple" },
  burger: { label: "Juicy Burger", emoji: "🍔", color: "#F97316", svgType: "burger" },
  plant: { label: "Potted Plant", emoji: "🪴", color: "#059669", svgType: "plant" },
  clock: { label: "Desk Clock", emoji: "⏰", color: "#06B6D4", svgType: "clock" },
  pencil: { label: "Pencil Case", emoji: "✏️", color: "#EAB308", svgType: "pencil" },
  gem: { label: "Magic Gem", emoji: "💎", color: "#6366F1", svgType: "gem" },
  crown: { label: "Gold Crown", emoji: "👑", color: "#EAB308", svgType: "crown" },
  star: { label: "Star Trophy", emoji: "⭐", color: "#F59E0B", svgType: "star" },
  gift: { label: "Gift Box", emoji: "🎁", color: "#EC4899", svgType: "gift" },
  // 16 New Fun Goods Items
  pizza: { label: "Pizza Slice", emoji: "🍕", color: "#EF4444", svgType: "pizza" },
  icecream: { label: "Soft Ice Cream", emoji: "🍦", color: "#F472B6", svgType: "icecream" },
  cookie: { label: "Choco Cookie", emoji: "🍪", color: "#D97706", svgType: "cookie" },
  candy: { label: "Sweet Candy", emoji: "🍬", color: "#EC4899", svgType: "candy" },
  car: { label: "Toy Racecar", emoji: "🚗", color: "#3B82F6", svgType: "car" },
  robot: { label: "Toy Robot", emoji: "🤖", color: "#6366F1", svgType: "robot" },
  ball: { label: "Soccer Ball", emoji: "⚽", color: "#10B981", svgType: "ball" },
  palette: { label: "Art Palette", emoji: "🎨", color: "#8B5CF6", svgType: "palette" },
  book: { label: "Story Book", emoji: "📚", color: "#2563EB", svgType: "book" },
  guitar: { label: "Guitar", emoji: "🎸", color: "#F97316", svgType: "guitar" },
  camera: { label: "Retro Camera", emoji: "📷", color: "#06B6D4", svgType: "camera" },
  trophy: { label: "Gold Trophy", emoji: "🏆", color: "#EAB308", svgType: "trophy" },
  diamond: { label: "Sparkly Ring", emoji: "💍", color: "#38BDF8", svgType: "diamond" },
  key: { label: "Golden Key", emoji: "🔑", color: "#F59E0B", svgType: "key" },
  rocket: { label: "Space Rocket", emoji: "🚀", color: "#DC2626", svgType: "rocket" },
  controller: { label: "Game Controller", emoji: "🎮", color: "#4F46E5", svgType: "controller" },

  // 8 Gradient Bottle Collection
  bottle_water: { label: "Mineral Water", emoji: "🧴", color: "#0EA5E9", svgType: "bottle_water" },
  bottle_juice: { label: "Orange Juice", emoji: "🍊", color: "#F97316", svgType: "bottle_juice" },
  bottle_soda: { label: "Berry Fizz Soda", emoji: "🍾", color: "#E11D48", svgType: "bottle_soda" },
  bottle_potion: { label: "Magic Elixir", emoji: "🧪", color: "#8B5CF6", svgType: "bottle_potion" },
  bottle_milk: { label: "Glass Milk Bottle", emoji: "🥛", color: "#0284C7", svgType: "bottle_milk" },
  bottle_boba: { label: "Boba Milk Tea", emoji: "🧋", color: "#D97706", svgType: "bottle_boba" },
  bottle_honey: { label: "Honey Nectar", emoji: "🍯", color: "#F59E0B", svgType: "bottle_honey" },
  bottle_energy: { label: "Volt Energy", emoji: "⚡", color: "#10B981", svgType: "bottle_energy" },
};

/**
 * Item ids are `item_<type>_<n>` — deterministic, not random.
 *
 * They only have to be unique inside one board (React keys, drag identity), and a random
 * suffix made two runs of the same level produce different data, which defeats both the
 * seeded builder and the export that certifies a level.
 */
export function createItem(typeKey: string, index: number, customMeta?: Partial<GoodsItem>): GoodsItem {
  const meta = GOODS_CATALOG[typeKey] || {
    label: customMeta?.label || typeKey,
    emoji: customMeta?.emoji || "📦",
    color: customMeta?.color || "#6366F1",
    svgType: customMeta?.svgType,
  };
  return {
    id: `item_${typeKey}_${index}`,
    typeKey,
    label: customMeta?.label || meta.label,
    emoji: customMeta?.emoji || meta.emoji,
    color: customMeta?.color || meta.color,
    svgType: customMeta?.svgType || meta.svgType,
  };
}

// ── Board building ──────────────────────────────────────────────────────────────

/** Small, fast, seedable PRNG. Same seed ⇒ same board, on any machine or runtime. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A compartment nobody needs to touch again: full, and holding a single kind of goods. */
export function isShelfComplete(shelf: ShelfCompartment): boolean {
  return (
    shelf.items.length === shelf.capacity &&
    shelf.items.every((item) => item.typeKey === shelf.items[0].typeKey)
  );
}

/**
 * The win condition, in one place.
 *
 * Compartments are never emptied when they match, so "solved" is: every compartment that
 * holds anything is full and single-kind. The canvas, the hint solver, the level export
 * and the tests all read it from here rather than each re-deciding what finished means.
 */
export function isGoodsBoardSolved(shelves: ShelfCompartment[]): boolean {
  const occupied = shelves.filter((shelf) => shelf.items.length > 0);
  return occupied.length > 0 && occupied.every(isShelfComplete);
}

/** How many of each kind of goods the board holds — the server's grading key. */
export function goodsCounts(shelves: ShelfCompartment[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const shelf of shelves) {
    for (const item of shelf.items) {
      counts[item.typeKey] = (counts[item.typeKey] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Apply `moves` random legal moves to a board, never undoing the move just made.
 *
 * Used two ways, both relying on the same fact: a legal move can always be reversed, so
 * scrambling can only ever produce a board that is still solvable. From the finished
 * shelf it builds a puzzle; from a board mid-play it re-deals without stranding the child.
 */
export function scrambleGoodsBoard(
  shelves: ShelfCompartment[],
  random: () => number,
  moves: number,
): void {
  let lastMove: { from: string; to: string } | null = null;

  for (let step = 0; step < moves; step++) {
    const sources = shelves.filter((shelf) => shelf.items.length > 0);
    if (!sources.length) return;

    // Up to a few tries to avoid immediately undoing the previous move; giving up after
    // that is harmless (the board stays legal and solvable, just slightly less mixed).
    for (let attempt = 0; attempt < 6; attempt++) {
      const source = sources[Math.floor(random() * sources.length)];
      const targets = shelves.filter(
        (shelf) => shelf.id !== source.id && shelf.items.length < shelf.capacity,
      );
      if (!targets.length) return;
      const target = targets[Math.floor(random() * targets.length)];
      if (lastMove && lastMove.from === target.id && lastMove.to === source.id) continue;

      target.items.push(source.items.pop()!);
      lastMove = { from: source.id, to: target.id };
      break;
    }
  }
}

export interface GoodsBoardSpec {
  goodsTypes: string[];
  capacity: number;
  shelfCount: number;
  seed: number;
  /** Defaults to three moves per item — enough to interleave every kind. */
  scrambleMoves?: number;
  customGoods?: Array<Partial<GoodsItem> & { typeKey: string }>;
}

/** Lay the finished shelf out, then scramble it. See the module header for why. */
export function buildGoodsBoard(spec: GoodsBoardSpec): ShelfCompartment[] {
  const { goodsTypes, capacity, shelfCount, seed } = spec;
  const shelves: ShelfCompartment[] = Array.from({ length: shelfCount }, (_, index) => ({
    id: `s${index + 1}`,
    capacity,
    items: [],
  }));

  goodsTypes.forEach((typeKey, index) => {
    const customMeta = spec.customGoods?.find((good) => good.typeKey === typeKey);
    for (let n = 1; n <= capacity; n++) {
      shelves[index].items.push(createItem(typeKey, n, customMeta));
    }
  });

  const random = mulberry32(seed);
  scrambleGoodsBoard(shelves, random, spec.scrambleMoves ?? goodsTypes.length * capacity * 3);

  // A scramble can land back on a finished board (most likely on the tiny beginner
  // grids). That is a board with nothing to do, so keep mixing until it is a puzzle.
  for (let guard = 0; guard < 20 && isGoodsBoardSolved(shelves); guard++) {
    scrambleGoodsBoard(shelves, random, capacity * 2);
  }
  return shelves;
}

// ── The curated ladder ──────────────────────────────────────────────────────────

interface LevelSpec {
  id: string;
  name: string;
  description: string;
  teaches: string;
  difficultyTier: GoodsDifficultyTier;
  rows: number;
  cols: number;
  capacity: number;
  goodsTypes: string[];
}

/**
 * Ordered easiest to hardest — the array order *is* the ladder, and the seed reads it
 * as-is. Spare room (`rows * cols - goodsTypes.length`) is the difficulty dial that
 * matters most: with five spare compartments a child can sort by trial and error, with
 * one they have to plan the order of the moves.
 *
 * Ids `level_1`..`level_6` predate the ladder and are kept so questions and progress
 * already pointing at them keep resolving; their boards are rebuilt here like the rest.
 */
const LEVEL_SPECS: LevelSpec[] = [
  // ── Beginner: 3-slot shelves, room to experiment ──
  {
    id: "level_1",
    name: "Level 1: First Delivery",
    description: "Two kinds of goods and four empty compartments — the gentlest first win.",
    teaches: "Tap a compartment to pick up its front item, tap another to put it down.",
    difficultyTier: "beginner",
    rows: 2, cols: 3, capacity: 3,
    goodsTypes: ["chips", "cola"],
  },
  {
    id: "level_2",
    name: "Level 2: Three Aisles",
    description: "A third kind of goods, still with plenty of empty shelf to work on.",
    teaches: "Gather all three of a kind into one compartment before starting the next.",
    difficultyTier: "beginner",
    rows: 3, cols: 3, capacity: 3,
    goodsTypes: ["chips", "cola", "milk"],
  },
  {
    id: "level_7",
    name: "Level 3: Snack Counter",
    description: "Three kinds on a small counter — the same puzzle with half the spare room.",
    teaches: "Move an item onto a compartment that already holds its kind.",
    difficultyTier: "beginner",
    rows: 2, cols: 3, capacity: 3,
    goodsTypes: ["donut", "cookie", "candy"],
  },
  {
    id: "level_8",
    name: "Level 4: Toy Corner",
    description: "Four kinds of toys spread across nine compartments.",
    teaches: "Finish the kind you are closest to completing first.",
    difficultyTier: "beginner",
    rows: 3, cols: 3, capacity: 3,
    goodsTypes: ["teddy", "duck", "ball", "car"],
  },
  {
    id: "level_9",
    name: "Level 5: Fruit Stand",
    description: "Five kinds of fresh goods, four compartments to spare.",
    teaches: "An empty compartment is worth more than a nearly-full one — spend it late.",
    difficultyTier: "beginner",
    rows: 3, cols: 3, capacity: 3,
    goodsTypes: ["apple", "popsicle", "icecream", "milk", "cookie"],
  },

  // ── Apprentice: spare room drops to two or three compartments ──
  {
    id: "level_3",
    name: "Level 6: Bakery Shelf",
    description: "Five kinds of baked goods with three spare compartments.",
    teaches: "Before you move an item, check what it is sitting on top of.",
    difficultyTier: "apprentice",
    rows: 2, cols: 4, capacity: 3,
    goodsTypes: ["donut", "cookie", "candy", "popsicle", "icecream"],
  },
  {
    id: "level_10",
    name: "Level 7: Party Aisle",
    description: "Six kinds of party goods and three compartments to move through.",
    teaches: "Unload a compartment completely so it becomes free space again.",
    difficultyTier: "apprentice",
    rows: 3, cols: 3, capacity: 3,
    goodsTypes: ["pizza", "burger", "cola", "chips", "candy", "gift"],
  },
  {
    id: "level_11",
    name: "Level 8: Stationery Row",
    description: "Six kinds of school supplies with only two spare compartments.",
    teaches: "Do not stack a kind you have not started onto your last free shelf.",
    difficultyTier: "apprentice",
    rows: 2, cols: 4, capacity: 3,
    goodsTypes: ["pencil", "book", "clock", "palette", "camera", "key"],
  },
  {
    id: "level_4",
    name: "Level 9: Goods Depot",
    description: "Seven kinds arriving at the depot, two compartments free.",
    teaches: "Plan two moves at a time: where the item goes, and what it uncovers.",
    difficultyTier: "apprentice",
    rows: 3, cols: 3, capacity: 3,
    goodsTypes: ["burger", "plant", "clock", "pencil", "duck", "chips", "milk"],
  },
  {
    id: "level_12",
    name: "Level 10: Garden Centre",
    description: "Eight kinds across ten compartments — the shelf is nearly full.",
    teaches: "Work on the kinds that are already grouped before breaking up new ones.",
    difficultyTier: "apprentice",
    rows: 2, cols: 5, capacity: 3,
    goodsTypes: ["plant", "apple", "ball", "gem", "star", "duck", "teddy", "key"],
  },

  // ── Advanced: long boards, and the first one-spare-compartment puzzle ──
  {
    id: "level_13",
    name: "Level 11: Toy Warehouse",
    description: "Eight kinds of toys packed into ten compartments.",
    teaches: "Trace a whole chain of moves before you make the first one.",
    difficultyTier: "advanced",
    rows: 2, cols: 5, capacity: 3,
    goodsTypes: ["teddy", "duck", "car", "robot", "ball", "rocket", "controller", "gift"],
  },
  {
    id: "level_5",
    name: "Level 12: Mega Warehouse",
    description: "Nine kinds of goods across a twelve-compartment warehouse.",
    teaches: "Keep two compartments workable rather than filling both halfway.",
    difficultyTier: "advanced",
    rows: 3, cols: 4, capacity: 3,
    goodsTypes: ["chips", "cola", "milk", "donut", "teddy", "duck", "popsicle", "apple", "cookie"],
  },
  {
    id: "level_14",
    name: "Level 13: Cold Storage",
    description: "Ten kinds, two compartments spare, nothing wasted.",
    teaches: "Every move should either finish a kind or free a compartment.",
    difficultyTier: "advanced",
    rows: 3, cols: 4, capacity: 3,
    goodsTypes: ["milk", "icecream", "popsicle", "apple", "burger", "pizza", "cola", "cookie", "candy", "donut"],
  },
  {
    id: "level_15",
    name: "Level 14: Night Shift",
    description: "Eleven kinds and a single spare compartment. Every move counts.",
    teaches: "With one free shelf, the order of the moves is the whole puzzle.",
    difficultyTier: "advanced",
    rows: 3, cols: 4, capacity: 3,
    goodsTypes: ["clock", "book", "pencil", "camera", "guitar", "palette", "key", "plant", "star", "gem", "trophy"],
  },
  {
    id: "level_6",
    name: "Level 15: Grand Emporium",
    description: "Twelve kinds of goods across a fifteen-compartment emporium.",
    teaches: "Sort in batches: finish a few kinds completely to win back space.",
    difficultyTier: "advanced",
    rows: 3, cols: 5, capacity: 3,
    goodsTypes: ["burger", "plant", "clock", "pencil", "gem", "crown", "star", "gift", "apple", "chips", "cola", "milk"],
  },
  {
    id: "level_16",
    name: "Level 16: Treasure Vault",
    description: "Thirteen treasures, two spare compartments, one careful plan.",
    teaches: "Undo is free — try a plan, and step back the moment it strands you.",
    difficultyTier: "advanced",
    rows: 3, cols: 5, capacity: 3,
    goodsTypes: ["gem", "crown", "star", "gift", "trophy", "diamond", "key", "rocket", "controller", "robot", "camera", "guitar", "book"],
  },

  // ── Master: four items to a compartment ──
  {
    id: "level_17",
    name: "Level 17: Quad Basics",
    description: "Compartments now hold four items. Four kinds, room to learn the change.",
    teaches: "A set is four now — do not stop grouping at three.",
    difficultyTier: "master",
    rows: 3, cols: 3, capacity: 4,
    goodsTypes: ["chips", "cola", "milk", "donut"],
  },
  {
    id: "level_18",
    name: "Level 18: Quad Pantry",
    description: "Five kinds of pantry goods in four-item compartments.",
    teaches: "Longer sets bury items deeper — dig the bottom one out early.",
    difficultyTier: "master",
    rows: 3, cols: 3, capacity: 4,
    goodsTypes: ["pizza", "burger", "cookie", "candy", "apple"],
  },
  {
    id: "level_19",
    name: "Level 19: Quad Toy Store",
    description: "Six kinds of toys, three compartments spare.",
    teaches: "Count what is left of a kind before you commit a free compartment to it.",
    difficultyTier: "master",
    rows: 3, cols: 3, capacity: 4,
    goodsTypes: ["teddy", "duck", "car", "robot", "ball", "rocket"],
  },
  {
    id: "level_20",
    name: "Level 20: Quad Depot",
    description: "Seven kinds, four to a compartment, two compartments spare.",
    teaches: "Half-finished piles cost space — close one before opening another.",
    difficultyTier: "master",
    rows: 3, cols: 3, capacity: 4,
    goodsTypes: ["clock", "pencil", "book", "palette", "camera", "key", "plant"],
  },
  {
    id: "level_21",
    name: "Level 21: Quad Emporium",
    description: "Eight kinds of goods across ten four-item compartments.",
    teaches: "Read the whole shelf first; the best opening move is rarely the nearest one.",
    difficultyTier: "master",
    rows: 2, cols: 5, capacity: 4,
    goodsTypes: ["gem", "crown", "star", "gift", "trophy", "diamond", "chips", "cola"],
  },
  {
    id: "level_22",
    name: "Level 22: Quad Night Shift",
    description: "Nine kinds, four to a set, three compartments to work in.",
    teaches: "Sort the crowded compartments first — the empty one keeps its value.",
    difficultyTier: "master",
    rows: 3, cols: 4, capacity: 4,
    goodsTypes: ["milk", "icecream", "popsicle", "cookie", "candy", "donut", "pizza", "burger", "apple"],
  },
  {
    id: "level_23",
    name: "Level 23: Quad Vault",
    description: "Ten kinds of treasure in four-item compartments, two spare.",
    teaches: "Never fill your last free compartment with two different kinds.",
    difficultyTier: "master",
    rows: 3, cols: 4, capacity: 4,
    goodsTypes: ["gem", "crown", "star", "gift", "trophy", "diamond", "key", "rocket", "controller", "robot"],
  },

  // ── Grandmaster: the full store ──
  {
    id: "level_24",
    name: "Level 24: Sorting Marathon",
    description: "Eleven kinds of goods, four to a set — the longest board so far.",
    teaches: "Long sets need long plans: decide the order of the kinds, then work it.",
    difficultyTier: "grandmaster",
    rows: 3, cols: 5, capacity: 4,
    goodsTypes: ["chips", "cola", "milk", "donut", "teddy", "duck", "popsicle", "apple", "burger", "plant", "clock"],
  },
  {
    id: "level_25",
    name: "Level 25: Twelve Crates",
    description: "Twelve kinds unloading into fifteen compartments.",
    teaches: "Group the shelf into kinds you can finish now and kinds that must wait.",
    difficultyTier: "grandmaster",
    rows: 3, cols: 5, capacity: 4,
    goodsTypes: ["pencil", "gem", "crown", "star", "gift", "pizza", "icecream", "cookie", "candy", "car", "robot", "ball"],
  },
  {
    id: "level_26",
    name: "Level 26: Full Inventory",
    description: "Thirteen kinds, two spare compartments, four items to a set.",
    teaches: "Keep a running plan: which kind is next, and which compartment will hold it.",
    difficultyTier: "grandmaster",
    rows: 3, cols: 5, capacity: 4,
    goodsTypes: ["palette", "book", "guitar", "camera", "trophy", "diamond", "key", "rocket", "controller", "chips", "cola", "milk", "donut"],
  },
  {
    id: "level_27",
    name: "Level 27: Stocktake",
    description: "Fourteen kinds and one spare compartment. Nothing to waste.",
    teaches: "Free the single spare compartment again as soon as you have used it.",
    difficultyTier: "grandmaster",
    rows: 3, cols: 5, capacity: 4,
    goodsTypes: ["teddy", "duck", "popsicle", "apple", "burger", "plant", "clock", "pencil", "gem", "crown", "star", "gift", "pizza", "icecream"],
  },
  {
    id: "level_28",
    name: "Level 28: Grand Bazaar",
    description: "Fifteen kinds of goods on a sixteen-compartment bazaar shelf.",
    teaches: "Hold the finished compartments still — every remaining move happens around them.",
    difficultyTier: "grandmaster",
    rows: 4, cols: 4, capacity: 4,
    goodsTypes: ["cookie", "candy", "car", "robot", "ball", "palette", "book", "guitar", "camera", "trophy", "diamond", "key", "rocket", "controller", "chips"],
  },
  {
    id: "level_29",
    name: "Level 29: Mega Emporium",
    description: "Sixteen kinds across twenty compartments — the biggest shelf yet.",
    teaches: "On a big shelf, sort by regions: clear one area completely, then move on.",
    difficultyTier: "grandmaster",
    rows: 4, cols: 5, capacity: 4,
    goodsTypes: ["chips", "cola", "milk", "donut", "teddy", "duck", "popsicle", "apple", "burger", "plant", "clock", "pencil", "gem", "crown", "star", "gift"],
  },
  {
    id: "level_30",
    name: "Level 30: The Whole Store",
    description: "Eighteen kinds, four to a set, two spare compartments. Master level.",
    teaches: "Everything at once: plan ahead, protect free space, and finish what you start.",
    difficultyTier: "grandmaster",
    rows: 4, cols: 5, capacity: 4,
    goodsTypes: [
      "chips", "cola", "milk", "donut", "teddy", "duck", "popsicle", "apple", "burger",
      "plant", "clock", "pencil", "gem", "crown", "star", "gift", "pizza", "icecream",
    ],
  },
];

/** Seed per level, derived from its position so a reordered ladder keeps stable boards. */
function levelSeed(spec: LevelSpec): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < spec.id.length; i++) {
    hash = Math.imul(hash ^ spec.id.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

function buildLevel(spec: LevelSpec): GoodsLevel {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    teaches: spec.teaches,
    difficultyTier: spec.difficultyTier,
    rows: spec.rows,
    cols: spec.cols,
    compartmentCapacity: spec.capacity,
    goodsTypes: spec.goodsTypes,
    targetCount: spec.goodsTypes.length,
    shelves: buildGoodsBoard({
      goodsTypes: spec.goodsTypes,
      capacity: spec.capacity,
      shelfCount: spec.rows * spec.cols,
      seed: levelSeed(spec),
    }),
  };
}

/** The ladder, in play order. `GOODS_SORT_LEVELS` is the long-standing name for it. */
export const GOODS_SORT_CURRICULUM_LEVELS: GoodsLevel[] = LEVEL_SPECS.map(buildLevel);
export const GOODS_SORT_LEVELS = GOODS_SORT_CURRICULUM_LEVELS;

/** Spare compartments at the finished state — the ladder's main difficulty dial. */
export function spareShelves(level: GoodsLevel): number {
  return level.rows * level.cols - level.goodsTypes.length;
}

// ── Studio: custom boards ───────────────────────────────────────────────────────

export function generateDynamicGoodsLevel(config: {
  rows?: number;
  cols?: number;
  compartmentCapacity?: number;
  goodsTypes?: string[];
  customGoods?: Array<{ typeKey: string; label: string; emoji: string; color: string }>;
  /** Studio "Shuffle Layout" writes a new one; the same seed always rebuilds the same board. */
  seed?: number;
  name?: string;
}): GoodsLevel {
  const rows = Math.max(2, Math.min(6, config.rows || 3));
  const cols = Math.max(2, Math.min(6, config.cols || 3));
  const totalShelves = rows * cols;
  const capacity = Math.max(3, Math.min(4, config.compartmentCapacity || 3));

  const requested = config.goodsTypes?.length ? config.goodsTypes : ["chips", "cola", "milk"];
  // Every kind needs its own finished compartment, and a board with no spare compartment
  // has no legal move at all — so the grid caps how many kinds can actually be sorted.
  const goodsTypes = requested.slice(0, Math.max(1, totalShelves - 1));

  return {
    id: "custom",
    name: config.name || `Custom ${rows}x${cols} Shelf Puzzle`,
    description: `${goodsTypes.length} kinds of goods across ${totalShelves} compartments.`,
    teaches: "Group every kind of goods into a compartment of its own.",
    difficultyTier: goodsTypes.length <= 4 ? "beginner" : goodsTypes.length <= 8 ? "apprentice" : "advanced",
    rows,
    cols,
    compartmentCapacity: capacity,
    goodsTypes,
    targetCount: goodsTypes.length,
    shelves: buildGoodsBoard({
      goodsTypes,
      capacity,
      shelfCount: totalShelves,
      seed: config.seed ?? 20240801,
      customGoods: config.customGoods,
    }),
  };
}

export interface GoodsPresetTheme {
  id: string;
  name: string;
  emoji: string;
  rows: number;
  cols: number;
  compartmentCapacity: number;
  goodsTypes: string[];
  description: string;
}

export const PRESET_THEMES: GoodsPresetTheme[] = [
  {
    id: "preset_pantry",
    name: "Supermarket Snacks & Soda",
    emoji: "🍿",
    rows: 2,
    cols: 3,
    compartmentCapacity: 3,
    goodsTypes: ["chips", "cola", "milk"],
    description: "Compact 2x3 pantry grid with chips, soda, and milk.",
  },
  {
    id: "preset_toys",
    name: "Toy Shop & Plushies",
    emoji: "🧸",
    rows: 3,
    cols: 3,
    compartmentCapacity: 3,
    goodsTypes: ["teddy", "duck", "star", "gift"],
    description: "3x3 toy shop with teddy bears, ducks, stars, and gifts.",
  },
  {
    id: "preset_bakery",
    name: "Bakery & Sweet Desserts",
    emoji: "🍩",
    rows: 3,
    cols: 4,
    compartmentCapacity: 3,
    goodsTypes: ["donut", "popsicle", "apple", "milk"],
    description: "3x4 bakery shelf with donuts, popsicles, apples, and milk.",
  },
  {
    id: "preset_office",
    name: "School & Stationery Depot",
    emoji: "✏️",
    rows: 3,
    cols: 4,
    compartmentCapacity: 3,
    goodsTypes: ["clock", "pencil", "plant", "burger"],
    description: "3x4 office shelf with clocks, pencils, plants, and burgers.",
  },
  {
    id: "preset_treasure",
    name: "Royal Jewels & Treasures",
    emoji: "👑",
    rows: 4,
    cols: 4,
    compartmentCapacity: 3,
    goodsTypes: ["crown", "gem", "star", "gift", "clock"],
    description: "4x4 treasure bookcase with gold crowns, gems, stars, and gifts.",
  },
  {
    id: "preset_quads",
    name: "Quad Sort Master (4 per Shelf)",
    emoji: "⚡",
    rows: 3,
    cols: 4,
    compartmentCapacity: 4,
    goodsTypes: ["chips", "cola", "milk", "donut"],
    description: "3x4 quad sort puzzle where each shelf holds 4 items.",
  },
  {
    id: "preset_bottles",
    name: "Juice & Beverage Bottle Shop",
    emoji: "🧴",
    rows: 3,
    cols: 4,
    compartmentCapacity: 3,
    goodsTypes: ["bottle_water", "bottle_juice", "bottle_soda", "bottle_potion", "bottle_milk", "bottle_boba", "bottle_honey", "bottle_energy"],
    description: "3x4 bottle shop featuring mineral water, citrus juice, fizz soda, magic elixirs, milk, boba, honey, and energy bottles.",
  },
];

/**
 * Resolve the board a question should play.
 *
 * A curated level wins whenever its id is recognised and the author has not replaced its
 * goods. That precedence is the fix for a real bug: the studio panel writes
 * `gridRows`/`gridCols` into the config on *every* selection, and this function used to
 * treat the presence of `gridRows` as "generate something custom" — so picking "Level 4 ·
 * Goods Depot" in the studio quietly played a random chips/cola/milk board instead.
 */
export function getGoodsLevel(levelId?: string, config?: any): GoodsLevel {
  const cfg = config || {};
  const hasCustomGoods = Array.isArray(cfg.goodsTypes) && cfg.goodsTypes.length > 0;

  const curated = GOODS_SORT_LEVELS.find((level) => level.id === levelId);
  if (curated && !hasCustomGoods) return curated;

  const theme = PRESET_THEMES.find((preset) => preset.id === levelId);
  if (theme) {
    return generateDynamicGoodsLevel({
      rows: cfg.gridRows || theme.rows,
      cols: cfg.gridCols || theme.cols,
      compartmentCapacity: cfg.compartmentCapacity || theme.compartmentCapacity,
      goodsTypes: hasCustomGoods ? cfg.goodsTypes : theme.goodsTypes,
      customGoods: cfg.customGoods,
      seed: cfg.seed,
      name: theme.name,
    });
  }

  if (hasCustomGoods || levelId === "custom" || cfg.gridRows || cfg.customShelves) {
    return generateDynamicGoodsLevel({
      rows: cfg.gridRows || cfg.rows,
      cols: cfg.gridCols || cfg.cols,
      compartmentCapacity: cfg.compartmentCapacity,
      goodsTypes: cfg.goodsTypes,
      customGoods: cfg.customGoods,
      seed: cfg.seed,
    });
  }

  return GOODS_SORT_LEVELS[0];
}
