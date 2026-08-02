/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Harvest Crop Sort Level & Produce Metadata Definitions.
 */

export type ProduceCategory = "fruits" | "vegetables" | "nuts" | "berries" | "compost";

export interface ProduceItem {
  id: string;
  name: string;
  category: ProduceCategory;
  emoji: string;
  color: string;
  xp: number;
  trivia: string;
  isSpoiled?: boolean;
}

export interface CrateDefinition {
  category: ProduceCategory;
  label: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  headerBg: string;
  headerTextColor: string;
  imagePath?: string;
}

export const CRATE_DEFINITIONS: Record<ProduceCategory, CrateDefinition> = {
  fruits: {
    category: "fruits",
    label: "FRUIT",
    emoji: "🍎",
    bgColor: "bg-red-700/90",
    borderColor: "border-red-500 ring-4 ring-red-400/40",
    badgeColor: "bg-red-600 text-white",
    headerBg: "bg-red-600",
    headerTextColor: "text-white",
    imagePath: "/assets/harvest-sort/red-fruit-crate.png",
  },
  vegetables: {
    category: "vegetables",
    label: "VEGETABLES",
    emoji: "🥕",
    bgColor: "bg-emerald-700/90",
    borderColor: "border-emerald-500 ring-4 ring-emerald-400/40",
    badgeColor: "bg-emerald-600 text-white",
    headerBg: "bg-emerald-600",
    headerTextColor: "text-white",
    imagePath: "/assets/harvest-sort/green-veggie-crate.png",
  },
  compost: {
    category: "compost",
    label: "COMPOST",
    emoji: "♻️",
    bgColor: "bg-amber-950/95",
    borderColor: "border-amber-700 ring-4 ring-amber-600/40",
    badgeColor: "bg-amber-700 text-amber-100",
    headerBg: "bg-amber-800",
    headerTextColor: "text-amber-100",
    imagePath: "/assets/harvest-sort/compost-barrel.png",
  },
  nuts: {
    category: "nuts",
    label: "GRAINS & NUTS",
    emoji: "🌾",
    bgColor: "bg-amber-800/90",
    borderColor: "border-amber-500 ring-4 ring-amber-400/40",
    badgeColor: "bg-amber-600 text-white",
    headerBg: "bg-amber-700",
    headerTextColor: "text-white",
  },
  berries: {
    category: "berries",
    label: "BERRIES",
    emoji: "🫐",
    bgColor: "bg-purple-800/90",
    borderColor: "border-purple-500 ring-4 ring-purple-400/40",
    badgeColor: "bg-purple-600 text-white",
    headerBg: "bg-purple-700",
    headerTextColor: "text-white",
  },
};

export const PRODUCE_DICTIONARY: ProduceItem[] = [
  // Fruits
  { id: "sweet_peach", name: "Sweet Peach", category: "fruits", emoji: "🍑", color: "#F472B6", xp: 12, trivia: "Peaches originated in China where they symbolise immortality!" },
  { id: "watermelon", name: "Watermelon", category: "fruits", emoji: "🍉", color: "#10B981", xp: 15, trivia: "Watermelons are 92% water and keep you super hydrated!" },
  { id: "juicy_orange", name: "Juicy Orange", category: "fruits", emoji: "🍊", color: "#F97316", xp: 10, trivia: "Oranges are packed with Vitamin C to boost immunity!" },
  { id: "apple", name: "Red Apple", category: "fruits", emoji: "🍎", color: "#EF4444", xp: 10, trivia: "Apples float in water because 25% of their volume is air!" },
  { id: "banana", name: "Fresh Banana", category: "fruits", emoji: "🍌", color: "#EAB308", xp: 10, trivia: "Bananas are rich in potassium and great for energy!" },
  { id: "grapes", name: "Purple Grapes", category: "fruits", emoji: "🍇", color: "#8B5CF6", xp: 12, trivia: "Grapes grow in bunches on woody vines!" },

  // Vegetables
  { id: "crunchy_carrot", name: "Crunchy Carrot", category: "vegetables", emoji: "🥕", color: "#F97316", xp: 10, trivia: "Carrots were originally purple before orange ones were cultivated!" },
  { id: "broccoli_tree", name: "Broccoli Tree", category: "vegetables", emoji: "🥦", color: "#22C55E", xp: 10, trivia: "Broccoli has more Vitamin C than an orange per ounce!" },
  { id: "corn", name: "Golden Corn", category: "vegetables", emoji: "🌽", color: "#EAB308", xp: 10, trivia: "An ear of corn always has an even number of rows!" },
  { id: "potato", name: "Farm Potato", category: "vegetables", emoji: "🥔", color: "#D97706", xp: 10, trivia: "Potatoes were the first vegetable grown in space!" },

  // Compost / Spoiled
  { id: "moldy_log", name: "Moldy Log", category: "compost", emoji: "🪵", color: "#4B5563", xp: 20, trivia: "Fungi and micro-organisms break down wood into nutrient-rich plant food!", isSpoiled: true },
  { id: "banana_peel", name: "Banana Peel", category: "compost", emoji: "🍌", color: "#CA8A04", xp: 20, trivia: "Composting banana peels adds potassium and calcium to organic soil!", isSpoiled: true },
  { id: "autumn_leaf", name: "Autumn Leaf", category: "compost", emoji: "🍂", color: "#D97706", xp: 15, trivia: "Decomposing leaves provide valuable organic compost for soil!", isSpoiled: true },
  { id: "withered", name: "Spoiled Crop", category: "compost", emoji: "🥀", color: "#6B7280", xp: 20, trivia: "Composting rotting crops turns agricultural waste into healthy soil!", isSpoiled: true },

  // Nuts & Grains
  { id: "peanut", name: "Peanut", category: "nuts", emoji: "🥜", color: "#D97706", xp: 15, trivia: "Peanuts aren't real nuts—they grow underground as legumes!" },
  { id: "wheat", name: "Golden Wheat", category: "nuts", emoji: "🌾", color: "#F59E0B", xp: 15, trivia: "Wheat covers more land worldwide than any other food crop!" },

  // Berries
  { id: "blueberry", name: "Blueberry", category: "berries", emoji: "🫐", color: "#3B82F6", xp: 15, trivia: "Native Americans called blueberries star berries!" },
  { id: "strawberry", name: "Strawberry", category: "berries", emoji: "🍓", color: "#EC4899", xp: 15, trivia: "Strawberries are the only fruit with seeds on the outside!" },
];

export type WeatherMode = "sunny" | "rainy" | "snowy";

export interface CurriculumLevel {
  id: number;
  title: string;
  description: string;
  targetCount: number;
  conveyorSpeed: number; // pixels per second
  spawnInterval: number; // ms
  activeCategories: ProduceCategory[];
  allowSpoiled: boolean;
  weather: WeatherMode;
}

export const HARVEST_CURRICULUM_LEVELS: CurriculumLevel[] = [
  {
    id: 1,
    title: "Stage 1: Sunny Orchard",
    description: "👆 Drag & Drop fruits into 🍎 Fruit Crate, veggies into 🥕 Crate & spoiled items into ♻️ Barrel!",
    targetCount: 10,
    conveyorSpeed: 90,
    spawnInterval: 2400,
    activeCategories: ["fruits", "vegetables", "compost"],
    allowSpoiled: true,
    weather: "sunny",
  },
  {
    id: 2,
    title: "Stage 2: Berry Basket Rush",
    description: "👆 Drag & Drop Berries into 🫐 Crate, Fruits into 🍎 Crate & Veggies into 🥕 Crate!",
    targetCount: 15,
    conveyorSpeed: 120,
    spawnInterval: 2000,
    activeCategories: ["fruits", "vegetables", "berries", "compost"],
    allowSpoiled: true,
    weather: "sunny",
  },
  {
    id: 3,
    title: "Stage 3: Rainy Compost Clean",
    description: "👆 Rainy Harvest! Drag & Drop spoiled crops into ♻️ Compost Barrel & fresh crops into 3D Crates!",
    targetCount: 20,
    conveyorSpeed: 140,
    spawnInterval: 1800,
    activeCategories: ["fruits", "vegetables", "berries", "compost"],
    allowSpoiled: true,
    weather: "rainy",
  },
  {
    id: 4,
    title: "Stage 4: Snow Grain Harvest",
    description: "👆 Snowy Harvest! Drag & Drop Grains & Nuts into 🌾 Crate & all crops into matching 3D Crates!",
    targetCount: 25,
    conveyorSpeed: 165,
    spawnInterval: 1600,
    activeCategories: ["fruits", "vegetables", "nuts", "berries", "compost"],
    allowSpoiled: true,
    weather: "snowy",
  },
  {
    id: 5,
    title: "Stage 5: Master Harvester",
    description: "👆 Master Harvester! Drag & Drop all 5 produce types into their matching 3D Crates!",
    targetCount: 30,
    conveyorSpeed: 190,
    spawnInterval: 1300,
    activeCategories: ["fruits", "vegetables", "nuts", "berries", "compost"],
    allowSpoiled: true,
    weather: "sunny",
  },
];
