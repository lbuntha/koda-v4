/**
 * Trace tags — see `src/lib/topics.ts`.
 *
 * An item's units come from what it writes: its title is the content ("ច",
 * "7", "Cat"), so a letter writes `letter:km:ច` and a numeral `number:7`.
 * Drawings and lines write no letters. A collection's topics are the ones its
 * author picked plus what its items imply — writing or drawing, letters,
 * numbers — and its units are its items' together.
 */

import { cleanTopics, tags, unitsOfText, type ContentTags, type Topic } from "../lib/topics";
import { modeOf, type TraceItem } from "./geometry/types";

export const itemUnits = (item: Pick<TraceItem, "title" | "kind" | "script">): Set<string> => {
  if (modeOf(item.kind) === "drawing") return new Set();
  // A Latin item's title is the letter itself, so here its letters do say something.
  return unitsOfText(item.title, { latinLetters: item.script === "latin" && item.kind !== "word" });
};

const impliedTopics = (item: Pick<TraceItem, "kind">): Topic[] => {
  if (modeOf(item.kind) === "drawing") return ["drawing"];
  if (item.kind === "numeral") return ["writing", "numbers"];
  if (item.kind === "word") return ["writing", "words"];
  return ["writing", "letters"];
};

export const collectionTags = (collection: { topics?: readonly string[] | null; items: readonly { item: Pick<TraceItem, "title" | "kind" | "script"> }[] }): ContentTags => {
  const implied = collection.items.flatMap(({ item }) => impliedTopics(item));
  const units = collection.items.flatMap(({ item }) => [...itemUnits(item)]);
  return tags(cleanTopics([...(collection.topics ?? []), ...implied]), units);
};
