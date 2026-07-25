export interface LiquidLayer {
  colorKey: string;
  hidden?: boolean;
}

export interface BottleState {
  id: string;
  layers: LiquidLayer[];
  capacity: number;
}

export interface CurriculumLevel {
  id: string;
  name: string;
  description: string;
  difficultyTier: "beginner" | "apprentice" | "advanced" | "master" | "grandmaster";
  targetCount: number; // bottle count
  bottles: BottleState[];
}

export const LIQUID_SORT_CURRICULUM_LEVELS: CurriculumLevel[] = [
  {
    id: "level_1",
    name: "Level 1: First Pour",
    description: "Gentle starter puzzle with 2 liquid colors across 3 bottles.",
    difficultyTier: "beginner",
    targetCount: 3,
    bottles: [
      { id: "b1", layers: [{ colorKey: "cyan" }, { colorKey: "cyan" }, { colorKey: "magenta" }], capacity: 3 },
      { id: "b2", layers: [{ colorKey: "magenta" }, { colorKey: "magenta" }, { colorKey: "cyan" }], capacity: 3 },
      { id: "b3", layers: [], capacity: 3 },
    ],
  },
  {
    id: "level_2",
    name: "Level 2: Dual Swap",
    description: "Beginner puzzle for learning empty-bottle double moves.",
    difficultyTier: "beginner",
    targetCount: 3,
    bottles: [
      { id: "b1", layers: [{ colorKey: "gold" }, { colorKey: "cyan" }, { colorKey: "gold" }], capacity: 3 },
      { id: "b2", layers: [{ colorKey: "cyan" }, { colorKey: "gold" }, { colorKey: "cyan" }], capacity: 3 },
      { id: "b3", layers: [], capacity: 3 },
    ],
  },
  {
    id: "level_3",
    name: "Level 3: Color Steps",
    description: "A three-color warm-up puzzle with generous space.",
    difficultyTier: "apprentice",
    targetCount: 4,
    bottles: [
      { id: "b1", layers: [{ colorKey: "cyan" }, { colorKey: "magenta" }, { colorKey: "cyan" }, { colorKey: "magenta" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "magenta" }, { colorKey: "cyan" }, { colorKey: "magenta" }, { colorKey: "cyan" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "gold" }, { colorKey: "gold" }, { colorKey: "gold" }, { colorKey: "gold" }], capacity: 4 },
      { id: "b4", layers: [], capacity: 4 },
    ],
  },
  {
    id: "level_4",
    name: "Level 4: Tiny Vials",
    description: "A compact puzzle requiring multi-step layer transfer.",
    difficultyTier: "apprentice",
    targetCount: 4,
    bottles: [
      { id: "b1", layers: [{ colorKey: "emerald" }, { colorKey: "violet" }, { colorKey: "emerald" }, { colorKey: "violet" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "violet" }, { colorKey: "emerald" }, { colorKey: "violet" }, { colorKey: "emerald" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "blue" }, { colorKey: "blue" }, { colorKey: "blue" }, { colorKey: "blue" }], capacity: 4 },
      { id: "b4", layers: [], capacity: 4 },
    ],
  },
  {
    id: "level_5",
    name: "Level 5: Potion Practice",
    description: "Four colors across five bottles requiring strategic empty space.",
    difficultyTier: "apprentice",
    targetCount: 5,
    bottles: [
      { id: "b1", layers: [{ colorKey: "cyan" }, { colorKey: "magenta" }, { colorKey: "gold" }, { colorKey: "cyan" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "emerald" }, { colorKey: "cyan" }, { colorKey: "magenta" }, { colorKey: "emerald" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "gold" }, { colorKey: "emerald" }, { colorKey: "cyan" }, { colorKey: "gold" }], capacity: 4 },
      { id: "b4", layers: [{ colorKey: "magenta" }, { colorKey: "gold" }, { colorKey: "emerald" }, { colorKey: "magenta" }], capacity: 4 },
      { id: "b5", layers: [], capacity: 4 },
    ],
  },
  {
    id: "level_6",
    name: "Level 6: Foggy Forest (Mystery)",
    description: "Introduces Mystery Fog Layers (❓) hidden under top liquid.",
    difficultyTier: "advanced",
    targetCount: 6,
    bottles: [
      { id: "b1", layers: [{ colorKey: "emerald", hidden: true }, { colorKey: "cyan" }, { colorKey: "magenta" }, { colorKey: "gold" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "gold", hidden: true }, { colorKey: "magenta" }, { colorKey: "cyan" }, { colorKey: "emerald" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "magenta" }, { colorKey: "emerald" }, { colorKey: "gold" }, { colorKey: "cyan" }], capacity: 4 },
      { id: "b4", layers: [{ colorKey: "cyan" }, { colorKey: "gold" }, { colorKey: "emerald" }, { colorKey: "magenta" }], capacity: 4 },
      { id: "b5", layers: [], capacity: 4 },
      { id: "b6", layers: [], capacity: 4 },
    ],
  },
  {
    id: "level_7",
    name: "Level 7: Starter Shelf",
    description: "Five colors with two spare empty bottles.",
    difficultyTier: "advanced",
    targetCount: 6,
    bottles: [
      { id: "b1", layers: [{ colorKey: "violet" }, { colorKey: "tan" }, { colorKey: "violet" }, { colorKey: "tan" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "orange" }, { colorKey: "blue" }, { colorKey: "orange" }, { colorKey: "blue" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "tan" }, { colorKey: "violet" }, { colorKey: "tan" }, { colorKey: "violet" }], capacity: 4 },
      { id: "b4", layers: [{ colorKey: "blue" }, { colorKey: "orange" }, { colorKey: "blue" }, { colorKey: "orange" }], capacity: 4 },
      { id: "b5", layers: [], capacity: 4 },
      { id: "b6", layers: [], capacity: 4 },
    ],
  },
  {
    id: "level_8",
    name: "Level 8: Bright Batch",
    description: "Six colors with multiple valid solution pathways.",
    difficultyTier: "master",
    targetCount: 8,
    bottles: [
      { id: "b1", layers: [{ colorKey: "emerald" }, { colorKey: "magenta" }, { colorKey: "cyan" }, { colorKey: "blue" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "blue" }, { colorKey: "magenta" }, { colorKey: "gold" }, { colorKey: "gold" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "magenta" }, { colorKey: "emerald" }, { colorKey: "emerald" }, { colorKey: "violet" }], capacity: 4 },
      { id: "b4", layers: [{ colorKey: "tan" }, { colorKey: "magenta" }, { colorKey: "violet" }, { colorKey: "blue" }], capacity: 4 },
      { id: "b5", layers: [{ colorKey: "magenta" }, { colorKey: "gold" }, { colorKey: "tan" }, { colorKey: "tan" }], capacity: 4 },
      { id: "b6", layers: [{ colorKey: "violet" }, { colorKey: "emerald" }, { colorKey: "orange" }, { colorKey: "orange" }], capacity: 4 },
      { id: "b7", layers: [], capacity: 4 },
      { id: "b8", layers: [], capacity: 4 },
    ],
  },
  {
    id: "level_9",
    name: "Level 9: Mystery Cavern",
    description: "6 colors with 4 hidden Mystery Fog layers.",
    difficultyTier: "master",
    targetCount: 8,
    bottles: [
      { id: "b1", layers: [{ colorKey: "emerald", hidden: true }, { colorKey: "magenta" }, { colorKey: "cyan" }, { colorKey: "blue" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "blue", hidden: true }, { colorKey: "magenta" }, { colorKey: "gold" }, { colorKey: "gold" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "magenta", hidden: true }, { colorKey: "emerald" }, { colorKey: "emerald" }, { colorKey: "violet" }], capacity: 4 },
      { id: "b4", layers: [{ colorKey: "tan", hidden: true }, { colorKey: "magenta" }, { colorKey: "violet" }, { colorKey: "blue" }], capacity: 4 },
      { id: "b5", layers: [{ colorKey: "magenta" }, { colorKey: "gold" }, { colorKey: "tan" }, { colorKey: "tan" }], capacity: 4 },
      { id: "b6", layers: [{ colorKey: "violet" }, { colorKey: "emerald" }, { colorKey: "orange" }, { colorKey: "orange" }], capacity: 4 },
      { id: "b7", layers: [], capacity: 4 },
      { id: "b8", layers: [], capacity: 4 },
    ],
  },
  {
    id: "level_10",
    name: "Level 10: Grandmaster Vault",
    description: "Full spectrum 8 colors across 10 bottles.",
    difficultyTier: "grandmaster",
    targetCount: 10,
    bottles: [
      { id: "b1", layers: [{ colorKey: "cyan" }, { colorKey: "magenta" }, { colorKey: "gold" }, { colorKey: "emerald" }], capacity: 4 },
      { id: "b2", layers: [{ colorKey: "violet" }, { colorKey: "orange" }, { colorKey: "tan" }, { colorKey: "blue" }], capacity: 4 },
      { id: "b3", layers: [{ colorKey: "emerald" }, { colorKey: "gold" }, { colorKey: "magenta" }, { colorKey: "cyan" }], capacity: 4 },
      { id: "b4", layers: [{ colorKey: "blue" }, { colorKey: "tan" }, { colorKey: "orange" }, { colorKey: "violet" }], capacity: 4 },
      { id: "b5", layers: [{ colorKey: "gold" }, { colorKey: "cyan" }, { colorKey: "emerald" }, { colorKey: "magenta" }], capacity: 4 },
      { id: "b6", layers: [{ colorKey: "tan" }, { colorKey: "blue" }, { colorKey: "violet" }, { colorKey: "orange" }], capacity: 4 },
      { id: "b7", layers: [{ colorKey: "magenta" }, { colorKey: "emerald" }, { colorKey: "cyan" }, { colorKey: "gold" }], capacity: 4 },
      { id: "b8", layers: [{ colorKey: "orange" }, { colorKey: "violet" }, { colorKey: "blue" }, { colorKey: "tan" }], capacity: 4 },
      { id: "b9", layers: [], capacity: 4 },
      { id: "b10", layers: [], capacity: 4 },
    ],
  },
];

export function getCurriculumLevel(levelId?: string): CurriculumLevel {
  const found = LIQUID_SORT_CURRICULUM_LEVELS.find((l) => l.id === levelId);
  return found || LIQUID_SORT_CURRICULUM_LEVELS[0];
}
