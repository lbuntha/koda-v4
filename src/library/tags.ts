/**
 * A book's tags — see `src/lib/topics.ts`.
 *
 * Topics: the ones its author picked, the one its shelf names (a shelf called
 * "Animals" means animals), and always reading. Units: the Khmer letters its
 * words use and the numbers in it. English letters are left out — an English
 * story uses most of the alphabet, so they would link it to everything.
 */

import { cleanTopics, tags, topicForShelf, unitsOfText, type ContentTags, type Topic } from "../lib/topics";
import type { Passage } from "./data/passage";

export const bookTopics = (book: Pick<Passage, "topics" | "category">): Topic[] => {
  const shelf = topicForShelf(book.category);
  return cleanTopics([...(book.topics ?? []), ...(shelf ? [shelf] : []), "reading"]);
};

export const bookTags = (book: Pick<Passage, "topics" | "category" | "sentences">): ContentTags =>
  tags(bookTopics(book), unitsOfText(book.sentences.map((s) => s.text).join(" ")));
