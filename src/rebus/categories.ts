/**
 * The categories a child picks from, and where each sits in Koda's shared topics.
 *
 * A category is a child's word for "what is this about"; a topic is the
 * curated tag the recommender links content by. A Countries puzzle is filed
 * under `places`, so a book about places can sit beside it on the Today band.
 */

import type { Topic } from "../lib/topics";
import type { CategoryId } from "./types";
import { CATEGORY_IDS } from "./types";

export interface Category {
  id: CategoryId;
  name: string;
  topic: Topic;
}

export const CATEGORIES: readonly Category[] = [
  { id: "countries", name: "Countries", topic: "places" },
  { id: "food", name: "Food", topic: "food" },
  { id: "sayings", name: "Sayings", topic: "words" },
  { id: "animals", name: "Animals", topic: "animals" },
  { id: "sports", name: "Sports", topic: "health" },
  { id: "school", name: "School", topic: "school" },
  { id: "science", name: "Science", topic: "nature" },
  { id: "khmer", name: "Khmer words", topic: "words" },
];

/** How many puzzles a category should have before the Studio stops asking for more. */
export const GOAL_PER_CATEGORY = 1000;

export const categoryOf = (id: CategoryId): Category => {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown rebus category: ${id}`);
  return found;
};

export const isCategoryId = (value: unknown): value is CategoryId => (CATEGORY_IDS as readonly unknown[]).includes(value);
