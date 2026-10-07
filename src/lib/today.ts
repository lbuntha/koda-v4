/**
 * Today's Read and Write picks — one rule, read by Home and by each page's banner.
 *
 * Think already has its own (`recommendNow`, from concept mastery); this is the
 * same idea for books and trace collections, so the three picks on Home answer
 * one question in one order:
 *
 * 1. **A check-up that is due** (Write only) — spacing is how writing sticks.
 * 2. **Carry on** with what was started, most recent first. Started work is
 *    offered whatever its age: the child chose it.
 * 3. **Something new** that fits the child's age (a year either side, as the
 *    curriculum does), ranked by what it shares with what they did lately — a
 *    letter they just learned to write, a topic they just practised — then by
 *    how close it sits to their age, then in shelf order.
 * 4. **Again** (Write only): with everything finished, the collection practised
 *    longest ago, so there is never nothing to do.
 *
 * Rule-based and local on purpose: it runs offline, the same way every time,
 * and a grown-up can be told exactly why something was offered.
 */

import { fitsAge, isAgeRange, type AgeRange } from "./ages";
import { overlap, type ContentTags } from "./topics";

export type PickWhy = "checkUp" | "continue" | "linked" | "new" | "again";

export interface TodayContext {
  /** The child's age in years; null leaves age out (an adult browsing, or not known). */
  age: number | null;
  /** What the child did lately, across all three categories. */
  recent: ContentTags;
}

export interface Pick<T> {
  item: T;
  why: PickWhy;
  /** For `linked`: the letter, number or topic it shares with recent work. */
  link?: string;
}

interface Candidate {
  id: string;
  ages?: AgeRange | null;
  tags: ContentTags;
}

export interface BookCandidate extends Candidate {
  stage: "read" | "quiz" | "done" | null;
  updatedAt: number;
}

export interface CollectionCandidate extends Candidate {
  /** Items finished, and in it. */
  done: number;
  total: number;
  started: boolean;
  /** When it was last practised; 0 if never. */
  lastAt: number;
  /** Items with a check-up due now. */
  due: number;
}

/** The first unit, else topic, two pieces of content share — what "goes with" names. */
const sharedLink = (a: ContentTags, b: ContentTags): string | undefined => {
  for (const unit of a.units) if (b.units.has(unit)) return unit;
  for (const topic of a.topics) if (b.topics.has(topic)) return topic;
  return undefined;
};

/** How far a child sits from the middle of an age range; 0 when either is unknown. */
const ageDistance = (ages: AgeRange | null | undefined, age: number | null) =>
  isAgeRange(ages) && age !== null ? Math.abs(age - (ages[0] + ages[1]) / 2) : 0;

/** The best of `fresh` for this child, or null. Stable: ties keep shelf order. */
function bestNew<T extends Candidate>(fresh: readonly T[], ctx: TodayContext): Pick<T> | null {
  const ranked = fresh
    .map((item, order) => ({ item, order, shared: overlap(item.tags, ctx.recent), distance: ageDistance(item.ages, ctx.age) }))
    .filter(({ item }) => fitsAge(item.ages, ctx.age))
    .sort((a, b) => b.shared - a.shared || a.distance - b.distance || a.order - b.order);
  const top = ranked[0];
  if (!top) return null;
  return top.shared > 0 ? { item: top.item, why: "linked", link: sharedLink(top.item.tags, ctx.recent) } : { item: top.item, why: "new" };
}

export function pickRead(books: readonly BookCandidate[], ctx: TodayContext): Pick<BookCandidate> | null {
  const reading = books.filter((b) => b.stage === "read" || b.stage === "quiz").sort((a, b) => b.updatedAt - a.updatedAt);
  if (reading[0]) return { item: reading[0], why: "continue" };
  return bestNew(books.filter((b) => b.stage === null), ctx);
}

export function pickWrite(collections: readonly CollectionCandidate[], ctx: TodayContext): Pick<CollectionCandidate> | null {
  const due = collections.filter((c) => c.due > 0).sort((a, b) => b.due - a.due);
  if (due[0]) return { item: due[0], why: "checkUp" };
  const going = collections.filter((c) => c.started && c.done < c.total).sort((a, b) => b.lastAt - a.lastAt);
  if (going[0]) return { item: going[0], why: "continue" };
  const fresh = bestNew(collections.filter((c) => !c.started && c.done < c.total), ctx);
  if (fresh) return fresh;
  const finished = collections.filter((c) => c.total > 0 && c.done === c.total).sort((a, b) => a.lastAt - b.lastAt);
  return finished[0] ? { item: finished[0], why: "again" } : null;
}
