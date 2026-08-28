export type GradeLevel = "grade_1" | "grade_2" | "upper_elementary";

export type TopicCategory =
  | "balance_equations"
  | "fraction_lab"
  | "spatial_puzzles"
  | "exponent_growth"
  | "coordinate_quest"
  | "logic_matrix"
  | "number_bonds"
  | "base_ten_blocks"
  | "time_and_money";

export interface ProblemItem {
  id: string;
  topic: TopicCategory;
  gradeLevel?: GradeLevel;
  title: string;
  story: string;
  instructions: string;
  targetValue?: string;
  difficulty: number; // 1 to 5
  initialManipulativeState: {
    leftPan?: { id: string; type: "x" | "1" | "5" | "-1"; value: number }[];
    rightPan?: { id: string; type: "x" | "1" | "5" | "-1"; value: number }[];
    fractions?: { total: number; selected: number; color: string }[];
    targetFraction?: string;
    gridWidth?: number;
    gridHeight?: number;
    shapes?: { id: string; x: number; y: number; w: number; h: number; color: string }[];
    targetArea?: number;
    initialValue?: number;
    growthRate?: number;
    targetSteps?: number;
    targetCoords?: [number, number];
    // Grade 1 & 2 Manipulative states
    tenFrameTotal?: number;
    tenFrameCount?: number;
    targetSum?: number;
    partA?: number;
    partB?: number;
    targetWhole?: number;
    tens?: number;
    ones?: number;
    targetNumber?: number;
    clockHour?: number;
    clockMinute?: number;
    targetTime?: string;
    targetCents?: number;
  };
  socraticHints: string[];
  conceptExplanation: string;
}

export interface ChatMessage {
  id: string;
  sender: "sora" | "koda" | "student";
  text: string;
  timestamp: Date;
  hintType?: "question" | "visual_clue" | "encouragement" | "celebration" | "concept_check";
  xpEarned?: number;
  audioUrl?: string;
}

export interface SkillNode {
  id: string;
  topic: TopicCategory;
  name: string;
  description: string;
  iconName: string;
  levelRequired: number;
  unlocked: boolean;
  prerequisites?: string[];
  masteryPercentage: number;
  totalProblemsSolved: number;
}

export interface UserProgress {
  xp: number;
  level: number;
  /** Consecutive days of practice. Read through `observeStreak` — the stored
   *  number is what the run reached, not necessarily what today reads as. */
  streakDays: number;
  /** The learner's best run. A lapse never takes this away. */
  longestStreak: number;
  /** Day key (`YYYY-MM-DD`) of the last day that counted towards the streak. */
  lastStreakDay: string | null;
  /** Day key `dailySolved` is counting for, so it can roll over at the day
   *  boundary instead of climbing forever. */
  lastPracticeDay: string | null;
  problemsSolved: number;
  dailyGoal: number;
  dailySolved: number;
  unlockedSkills: string[];
  masteryByTopic: Record<TopicCategory, number>;
  recentBadges: string[];
}

