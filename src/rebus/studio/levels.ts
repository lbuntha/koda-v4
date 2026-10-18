/**
 * Who a puzzle is for, as three plain choices instead of thirteen grade chips.
 *
 * A level sets the age band and the difficulty together, which is what an author
 * actually decides. The exact ages and difficulty stay available under "More
 * options" for the rare puzzle that does not fit one of these.
 */

import type { AgeRange } from "../../lib/ages";
import type { Difficulty } from "../types";

export type LevelId = "little" | "kids" | "teens";

export interface Level {
  id: LevelId;
  ages: AgeRange;
  difficulty: Difficulty;
}

export const LEVELS: readonly Level[] = [
  { id: "little", ages: [6, 8], difficulty: 1 },
  { id: "kids", ages: [9, 12], difficulty: 2 },
  { id: "teens", ages: [13, 18], difficulty: 3 },
];

/** The level these ages and this difficulty are exactly, or null when they are a custom choice. */
export const levelOf = (ages: AgeRange, difficulty: number): LevelId | null =>
  LEVELS.find((l) => l.ages[0] === ages[0] && l.ages[1] === ages[1] && l.difficulty === difficulty)?.id ?? null;
