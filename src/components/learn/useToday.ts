/**
 * Today's Read and Write picks, from what is on this device.
 *
 * The rules are `src/lib/today.ts`; this gathers what they read — the child's
 * age, what they did lately (the learning log), both shelves and both
 * progress stores — and turns the winners back into a book and a collection.
 * Home and the Read and Write pages' banners all call it, so they agree.
 *
 * Reads only local stores: it never waits on the network, and the shelves
 * refresh themselves when their pages are opened.
 */

import { useSyncExternalStore } from "react";
import { LearningLog, activeLearnerId } from "../../lib/learning";
import { tags, type ContentTags, type Topic } from "../../lib/topics";
import { pickRead, pickWrite, type BookCandidate, type CollectionCandidate, type Pick, type PickWhy, type TodayContext } from "../../lib/today";
import { useAudienceViewer } from "../../skills/viewer";
import { getSkill } from "../../skills/registry";
import { skillTags } from "../../skills/tags";
import { BookStore } from "../../library/bookStore";
import { LibraryProgress } from "../../library/progress";
import { bookAges, type Language, type Passage } from "../../library/data/passage";
import { bookTags } from "../../library/tags";
import { readLang } from "../../library/lang";
import { LIBRARY_SKILL_ID } from "../../library/ids";
import { TraceShelf } from "../../trace/data/shelf";
import type { CollectionBundle } from "../../trace/data/api";
import { TraceProgress } from "../../trace/progress/store";
import { isRecheckDue } from "../../trace/progress/ladder";
import { stateOf } from "../../trace/home";
import { collectionTags } from "../../trace/tags";
import { TRACE_SKILL_ID } from "../../trace/learning";

/** How far back "lately" reaches, and how many finished things it counts. */
const RECENT_DAYS = 14;
const RECENT_MAX = 12;

export interface ReadPick {
  book: Passage;
  why: PickWhy;
  link?: string;
}

export interface WritePick {
  collection: CollectionBundle;
  why: PickWhy;
  link?: string;
}

const merge = (all: ContentTags[]): ContentTags =>
  tags(
    all.flatMap((t) => [...t.topics]) as Topic[],
    all.flatMap((t) => [...t.units]),
  );

/**
 * What the child finished lately, as tags: each completed lesson, book or
 * trace item in the last fortnight, looked up in the content it came from.
 */
export function recentTags(books: readonly Passage[], bundles: readonly CollectionBundle[], learner = activeLearnerId(), now = Date.now()): ContentTags {
  const since = new Date(now - RECENT_DAYS * 86_400_000).toISOString();
  const done = LearningLog.all({ since })
    .filter((e) => e.type === "lesson_completed" && e.learnerId === learner)
    .slice(-RECENT_MAX);
  const found: ContentTags[] = [];
  for (const e of done) {
    if (e.skillId === LIBRARY_SKILL_ID) {
      const book = books.find((b) => `${b.id}@${b.rev}` === e.lessonId || b.id === e.lessonId.split("@")[0]);
      if (book) found.push(bookTags(book));
    } else if (e.skillId === TRACE_SKILL_ID) {
      const item = bundles.flatMap((b) => b.items).find((x) => x.item.id === e.lessonId)?.item;
      if (item) found.push(collectionTags({ items: [{ item }] }));
    } else {
      const skill = getSkill(e.skillId);
      if (skill) found.push(skillTags(skill.manifest));
    }
  }
  return merge(found);
}

/** The child's age for picking, or none for an adult looking at everything. */
export function useTodayAge(): number | null {
  const viewer = useAudienceViewer();
  return viewer.showAllSkills ? null : viewer.age;
}

export function readPickFrom(books: readonly Passage[], lang: Language, ctx: TodayContext): ReadPick | null {
  const mine = books.filter((b) => b.language === lang);
  const candidates: BookCandidate[] = mine.map((b) => {
    const p = LibraryProgress.get(b.id, b.rev);
    return { id: b.id, ages: bookAges(b), tags: bookTags(b), stage: p?.stage ?? null, updatedAt: p?.updatedAt ?? 0 };
  });
  return toBook(pickRead(candidates, ctx), mine);
}

export function writePickFrom(bundles: readonly CollectionBundle[], ctx: TodayContext): WritePick | null {
  const candidates: CollectionCandidate[] = bundles.map((c) => {
    const itemIds = c.items.map((e) => e.item.id);
    const s = stateOf({ id: c.id, itemIds }, (id) => TraceProgress.get(id));
    return {
      id: c.id,
      ages: c.ages,
      tags: collectionTags(c),
      ...s,
      due: itemIds.filter((id) => isRecheckDue(TraceProgress.get(id))).length,
    };
  });
  const pick = pickWrite(candidates, ctx);
  const collection = pick && bundles.find((c) => c.id === pick.item.id);
  return pick && collection ? { collection, why: pick.why, link: pick.link } : null;
}

const toBook = (pick: Pick<BookCandidate> | null, books: readonly Passage[]): ReadPick | null => {
  const book = pick && books.find((b) => b.id === pick.item.id);
  return pick && book ? { book, why: pick.why, link: pick.link } : null;
};

const logLength = () => LearningLog.all().length;

/** The published collections, in shelf order, with their bundles. */
export const shelfBundles = (): CollectionBundle[] => {
  const shelf = TraceShelf.read();
  return shelf.collections.flatMap((c) => (shelf.bundles[c.id] ? [shelf.bundles[c.id]] : []));
};

/** Repaints when any store the picks read changes. */
function useStores() {
  useSyncExternalStore(BookStore.subscribe, BookStore.version, BookStore.version);
  useSyncExternalStore(LibraryProgress.subscribe, LibraryProgress.version, LibraryProgress.version);
  useSyncExternalStore(TraceShelf.subscribe, TraceShelf.version, TraceShelf.version);
  useSyncExternalStore(TraceProgress.subscribe, TraceProgress.version, TraceProgress.version);
  // The log has no version counter; its length moves whenever a lesson ends.
  useSyncExternalStore(LearningLog.subscribe, logLength, logLength);
}

/** Everything a pick is judged against, for a page that already holds its own shelf. */
export function useTodayContext(): TodayContext {
  useStores();
  const age = useTodayAge();
  return { age, recent: recentTags(BookStore.shelf(), shelfBundles()) };
}

/** Home's Read and Write picks. */
export function useTodayPicks(): { read: ReadPick | null; write: WritePick | null } {
  const ctx = useTodayContext();
  return { read: readPickFrom(BookStore.shelf(), readLang(), ctx), write: writePickFrom(shelfBundles(), ctx) };
}
