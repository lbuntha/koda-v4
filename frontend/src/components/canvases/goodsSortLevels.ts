/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
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

export interface GoodsLevel {
  id: string;
  name: string;
  rows: number;
  cols: number;
  compartmentCapacity: number;
  shelves: ShelfCompartment[];
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
};

export function createItem(typeKey: string, index: number, customMeta?: Partial<GoodsItem>): GoodsItem {
  const meta = GOODS_CATALOG[typeKey] || {
    label: customMeta?.label || typeKey,
    emoji: customMeta?.emoji || "📦",
    color: customMeta?.color || "#6366F1",
    svgType: customMeta?.svgType,
  };
  return {
    id: `item_${typeKey}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    typeKey,
    label: customMeta?.label || meta.label,
    emoji: customMeta?.emoji || meta.emoji,
    color: customMeta?.color || meta.color,
    svgType: customMeta?.svgType || meta.svgType,
  };
}

export const GOODS_SORT_LEVELS: GoodsLevel[] = [
  {
    id: "level_1",
    name: "Level 1 · Express Pantry (Beginner)",
    rows: 2,
    cols: 3,
    compartmentCapacity: 3,
    targetCount: 2,
    shelves: [
      { id: "s1", capacity: 3, items: [createItem("chips", 1), createItem("cola", 1), createItem("chips", 2)] },
      { id: "s2", capacity: 3, items: [createItem("cola", 2), createItem("chips", 3), createItem("cola", 3)] },
      { id: "s3", capacity: 3, items: [] },
      { id: "s4", capacity: 3, items: [] },
      { id: "s5", capacity: 3, items: [] },
      { id: "s6", capacity: 3, items: [] },
    ],
  },
  {
    id: "level_2",
    name: "Level 2 · Supermarket Shelf (Easy)",
    rows: 3,
    cols: 3,
    compartmentCapacity: 3,
    targetCount: 3,
    shelves: [
      { id: "s1", capacity: 3, items: [createItem("chips", 1), createItem("cola", 1), createItem("milk", 1)] },
      { id: "s2", capacity: 3, items: [createItem("cola", 2), createItem("chips", 2), createItem("milk", 2)] },
      { id: "s3", capacity: 3, items: [createItem("milk", 3), createItem("cola", 3), createItem("chips", 3)] },
      { id: "s4", capacity: 3, items: [] },
      { id: "s5", capacity: 3, items: [] },
      { id: "s6", capacity: 3, items: [] },
      { id: "s7", capacity: 3, items: [] },
      { id: "s8", capacity: 3, items: [] },
      { id: "s9", capacity: 3, items: [] },
    ],
  },
  {
    id: "level_3",
    name: "Level 3 · Bakery & Sweets (Medium)",
    rows: 3,
    cols: 4,
    compartmentCapacity: 3,
    targetCount: 4,
    shelves: [
      { id: "s1", capacity: 3, items: [createItem("donut", 1), createItem("teddy", 1), createItem("donut", 2)] },
      { id: "s2", capacity: 3, items: [createItem("teddy", 2), createItem("popsicle", 1), createItem("apple", 1)] },
      { id: "s3", capacity: 3, items: [createItem("popsicle", 2), createItem("apple", 2), createItem("donut", 3)] },
      { id: "s4", capacity: 3, items: [createItem("apple", 3), createItem("popsicle", 3), createItem("teddy", 3)] },
      { id: "s5", capacity: 3, items: [] },
      { id: "s6", capacity: 3, items: [] },
      { id: "s7", capacity: 3, items: [] },
      { id: "s8", capacity: 3, items: [] },
      { id: "s9", capacity: 3, items: [] },
      { id: "s10", capacity: 3, items: [] },
      { id: "s11", capacity: 3, items: [] },
      { id: "s12", capacity: 3, items: [] },
    ],
  },
  {
    id: "level_4",
    name: "Level 4 · Goods Depot (Advanced)",
    rows: 3,
    cols: 4,
    compartmentCapacity: 3,
    targetCount: 5,
    shelves: [
      { id: "s1", capacity: 3, items: [createItem("burger", 1), createItem("plant", 1), createItem("clock", 1)] },
      { id: "s2", capacity: 3, items: [createItem("clock", 2), createItem("pencil", 1), createItem("burger", 2)] },
      { id: "s3", capacity: 3, items: [createItem("plant", 2), createItem("burger", 3), createItem("pencil", 2)] },
      { id: "s4", capacity: 3, items: [createItem("pencil", 3), createItem("duck", 1), createItem("duck", 2)] },
      { id: "s5", capacity: 3, items: [createItem("duck", 3), createItem("clock", 3), createItem("plant", 3)] },
      { id: "s6", capacity: 3, items: [] },
      { id: "s7", capacity: 3, items: [] },
      { id: "s8", capacity: 3, items: [] },
      { id: "s9", capacity: 3, items: [] },
      { id: "s10", capacity: 3, items: [] },
      { id: "s11", capacity: 3, items: [] },
      { id: "s12", capacity: 3, items: [] },
    ],
  },
  {
    id: "level_5",
    name: "Level 5 · Mega Warehouse (Expert)",
    rows: 4,
    cols: 4,
    compartmentCapacity: 3,
    targetCount: 7,
    shelves: [
      { id: "s1", capacity: 3, items: [createItem("chips", 1), createItem("cola", 1), createItem("milk", 1)] },
      { id: "s2", capacity: 3, items: [createItem("cola", 2), createItem("chips", 2), createItem("milk", 2)] },
      { id: "s3", capacity: 3, items: [createItem("milk", 3), createItem("cola", 3), createItem("chips", 3)] },
      { id: "s4", capacity: 3, items: [createItem("donut", 1), createItem("teddy", 1), createItem("duck", 1)] },
      { id: "s5", capacity: 3, items: [createItem("teddy", 2), createItem("donut", 2), createItem("popsicle", 1)] },
      { id: "s6", capacity: 3, items: [createItem("duck", 2), createItem("popsicle", 2), createItem("donut", 3)] },
      { id: "s7", capacity: 3, items: [createItem("popsicle", 3), createItem("duck", 3), createItem("teddy", 3)] },
      { id: "s8", capacity: 3, items: [] },
      { id: "s9", capacity: 3, items: [] },
      { id: "s10", capacity: 3, items: [] },
      { id: "s11", capacity: 3, items: [] },
      { id: "s12", capacity: 3, items: [] },
      { id: "s13", capacity: 3, items: [] },
      { id: "s14", capacity: 3, items: [] },
      { id: "s15", capacity: 3, items: [] },
      { id: "s16", capacity: 3, items: [] },
    ],
  },
  {
    id: "level_6",
    name: "Level 6 · Grand Emporium (Master)",
    rows: 4,
    cols: 5,
    compartmentCapacity: 3,
    targetCount: 9,
    shelves: [
      { id: "s1", capacity: 3, items: [createItem("burger", 1), createItem("plant", 1), createItem("clock", 1)] },
      { id: "s2", capacity: 3, items: [createItem("clock", 2), createItem("pencil", 1), createItem("burger", 2)] },
      { id: "s3", capacity: 3, items: [createItem("plant", 2), createItem("burger", 3), createItem("pencil", 2)] },
      { id: "s4", capacity: 3, items: [createItem("pencil", 3), createItem("gem", 1), createItem("crown", 1)] },
      { id: "s5", capacity: 3, items: [createItem("crown", 2), createItem("star", 1), createItem("gem", 2)] },
      { id: "s6", capacity: 3, items: [createItem("star", 2), createItem("gift", 1), createItem("apple", 1)] },
      { id: "s7", capacity: 3, items: [createItem("gift", 2), createItem("apple", 2), createItem("clock", 3)] },
      { id: "s8", capacity: 3, items: [createItem("gem", 3), createItem("crown", 3), createItem("star", 3)] },
      { id: "s9", capacity: 3, items: [createItem("gift", 3), createItem("apple", 3), createItem("plant", 3)] },
      { id: "s10", capacity: 3, items: [] },
      { id: "s11", capacity: 3, items: [] },
      { id: "s12", capacity: 3, items: [] },
      { id: "s13", capacity: 3, items: [] },
      { id: "s14", capacity: 3, items: [] },
      { id: "s15", capacity: 3, items: [] },
      { id: "s16", capacity: 3, items: [] },
      { id: "s17", capacity: 3, items: [] },
      { id: "s18", capacity: 3, items: [] },
      { id: "s19", capacity: 3, items: [] },
      { id: "s20", capacity: 3, items: [] },
    ],
  },
];

export function generateDynamicGoodsLevel(config: {
  rows?: number;
  cols?: number;
  compartmentCapacity?: number;
  goodsTypes?: string[];
  customGoods?: Array<{ typeKey: string; label: string; emoji: string; color: string }>;
}): GoodsLevel {
  const rows = Math.max(2, Math.min(5, config.rows || 3));
  const cols = Math.max(2, Math.min(5, config.cols || 3));
  const totalShelves = rows * cols;
  const capacity = Math.max(3, Math.min(4, config.compartmentCapacity || 3));

  // Determine available goods catalog
  const selectedTypes = config.goodsTypes && config.goodsTypes.length > 0
    ? config.goodsTypes
    : ["chips", "cola", "milk"];

  // Create sets of identical items (capacity items per typeKey)
  let allItems: GoodsItem[] = [];
  selectedTypes.forEach((typeKey) => {
    const customMeta = config.customGoods?.find((g) => g.typeKey === typeKey);
    for (let i = 1; i <= capacity; i++) {
      allItems.push(createItem(typeKey, i, customMeta));
    }
  });

  // Calculate filled vs empty shelves
  // Reserve at least 2 empty shelves for movement
  const filledShelvesCount = Math.min(
    Math.ceil(allItems.length / capacity),
    Math.max(1, totalShelves - 2)
  );

  // Distribute items across filled shelves
  const shelves: ShelfCompartment[] = [];
  for (let i = 0; i < totalShelves; i++) {
    shelves.push({
      id: `s${i + 1}`,
      capacity,
      items: [],
    });
  }

  // Interleave/shuffle items into filled shelves so they are not already sorted
  allItems.forEach((item, index) => {
    const targetShelfIdx = index % filledShelvesCount;
    if (shelves[targetShelfIdx].items.length < capacity) {
      shelves[targetShelfIdx].items.push(item);
    } else {
      // Fallback to next available filled shelf
      const openShelf = shelves.slice(0, filledShelvesCount).find((s) => s.items.length < capacity);
      if (openShelf) {
        openShelf.items.push(item);
      }
    }
  });

  return {
    id: `dynamic_${Date.now()}`,
    name: `Custom ${rows}x${cols} Shelf Puzzle`,
    rows,
    cols,
    compartmentCapacity: capacity,
    targetCount: selectedTypes.length,
    shelves,
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
];

export function getGoodsLevel(levelId?: string, config?: any): GoodsLevel {
  if (config && (config.goodsTypes || config.gridRows || config.customShelves || levelId === "custom")) {
    return generateDynamicGoodsLevel({
      rows: config.gridRows || config.rows,
      cols: config.gridCols || config.cols,
      compartmentCapacity: config.compartmentCapacity,
      goodsTypes: config.goodsTypes,
      customGoods: config.customGoods,
    });
  }

  // Check preset themes
  const foundTheme = PRESET_THEMES.find((t) => t.id === levelId);
  if (foundTheme) {
    return generateDynamicGoodsLevel({
      rows: foundTheme.rows,
      cols: foundTheme.cols,
      compartmentCapacity: foundTheme.compartmentCapacity,
      goodsTypes: foundTheme.goodsTypes,
    });
  }

  const found = GOODS_SORT_LEVELS.find((l) => l.id === levelId);
  return found || GOODS_SORT_LEVELS[0];
}

