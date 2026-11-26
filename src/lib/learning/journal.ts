import { LIBRARY_SKILL_ID } from "../../library/ids";
import { localDayOf } from "./learningLog";

/**
 * "My learning": what a child read and practised, day by day.
 *
 * One fold for both places it is drawn. A child's own device folds the events
 * it holds, so the page works with no network; a parent's phone folds the rows
 * `GET /sync/journal/{learnerId}` returns, which are the same events. The two
 * cannot disagree about a day because there is only this function.
 *
 * Only finished work counts as practice — a round the child completed — and a
 * book counts by the story pages they actually turned to. A preview (an
 * author's test run) is never the child's.
 */

/** The fields the journal reads. A `LearningEvent` has them all; a server row has these and no more. */
export interface JournalEvent {
  id: string;
  type: string;
  ts: string;
  localDay: string;
  skillId: string;
  lessonId: string;
  entry?: string;
  page?: number;
  pageCount?: number;
  dwellMs?: number;
  durationMs?: number;
  questionsAnswered?: number;
  correctFirstTry?: number;
}

export interface JournalScore {
  answered: number;
  correctFirstTry: number;
}

export interface JournalBook {
  bookId: string;
  /** The revision read last that day, `book@rev` — what a title is looked up by. */
  lessonId: string;
  /** Different story pages opened that day. */
  pages: number;
  pageCount: number;
  /** Read to the last page that day. */
  finished: boolean;
  minutes: number;
  /** The book's quiz that day, if one was finished. */
  quiz: JournalScore | null;
}

export interface JournalLesson extends JournalScore {
  skillId: string;
  lessonId: string;
  rounds: number;
  minutes: number;
}

export interface JournalDay extends JournalScore {
  /** `YYYY-MM-DD`, the child's own day. */
  day: string;
  books: JournalBook[];
  lessons: JournalLesson[];
  minutes: number;
}

export interface JournalSummary extends JournalScore {
  /** The last seven days, oldest first: did the child learn that day? */
  week: boolean[];
  daysLearned: number;
  booksFinished: number;
  pagesRead: number;
  minutes: number;
  /** Days in a row with learning, ending today — or yesterday, so a streak is not lost before today's lesson. */
  streak: number;
}

export interface Journal {
  days: JournalDay[];
  summary: JournalSummary;
}

/** How many days the page shows. */
export const JOURNAL_DAYS = 30;

const minutesOf = (ms: number): number => (ms > 0 ? Math.max(1, Math.round(ms / 60_000)) : 0);
const bookOf = (lessonId: string): string => lessonId.slice(0, Math.max(0, lessonId.lastIndexOf("@"))) || lessonId;

const shiftDay = (day: string, by: number): string => {
  const [y, m, d] = day.split("-").map(Number);
  return localDayOf(new Date(y, m - 1, d + by, 12));
};

/** Events from two sources (device and server) with each event counted once. */
export function mergeJournalEvents(...sources: JournalEvent[][]): JournalEvent[] {
  const seen = new Map<string, JournalEvent>();
  for (const source of sources) for (const event of source) if (!seen.has(event.id)) seen.set(event.id, event);
  return [...seen.values()].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

export function buildJournal(events: JournalEvent[], now: Date = new Date(), windowDays: number = JOURNAL_DAYS): Journal {
  const today = localDayOf(now);
  const first = shiftDay(today, -(windowDays - 1));
  const byDay = new Map<string, { books: Map<string, JournalBook & { pageSet: Set<number>; ms: number }>; lessons: Map<string, JournalLesson & { ms: number }> }>();
  const dayOf = (day: string) => {
    let entry = byDay.get(day);
    if (!entry) byDay.set(day, (entry = { books: new Map(), lessons: new Map() }));
    return entry;
  };

  for (const event of [...events].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))) {
    if (event.entry === "preview" || event.localDay < first || event.localDay > today) continue;
    const isBook = event.skillId === LIBRARY_SKILL_ID;
    if (isBook && (event.type === "page_read" || event.type === "reading_finished" || event.type === "lesson_completed")) {
      const books = dayOf(event.localDay).books;
      const bookId = bookOf(event.lessonId);
      let book = books.get(bookId);
      if (!book) {
        book = { bookId, lessonId: event.lessonId, pages: 0, pageCount: 0, finished: false, minutes: 0, quiz: null, pageSet: new Set(), ms: 0 };
        books.set(bookId, book);
      }
      book.lessonId = event.lessonId;
      if (event.pageCount) book.pageCount = Math.max(book.pageCount, event.pageCount - 1);
      if (event.type === "page_read") {
        if ((event.page ?? 0) >= 1) book.pageSet.add(event.page!);
        book.ms += event.dwellMs ?? 0;
      } else if (event.type === "reading_finished") {
        book.finished = true;
      } else {
        book.quiz = {
          answered: (book.quiz?.answered ?? 0) + (event.questionsAnswered ?? 0),
          correctFirstTry: (book.quiz?.correctFirstTry ?? 0) + (event.correctFirstTry ?? 0),
        };
        book.ms += event.durationMs ?? 0;
      }
      continue;
    }
    if (isBook || event.type !== "lesson_completed") continue;
    const lessons = dayOf(event.localDay).lessons;
    const key = `${event.skillId}/${event.lessonId}`;
    let lesson = lessons.get(key);
    if (!lesson) {
      lesson = { skillId: event.skillId, lessonId: event.lessonId, rounds: 0, answered: 0, correctFirstTry: 0, minutes: 0, ms: 0 };
      lessons.set(key, lesson);
    }
    lesson.rounds += 1;
    lesson.answered += event.questionsAnswered ?? 0;
    lesson.correctFirstTry += event.correctFirstTry ?? 0;
    lesson.ms += event.durationMs ?? 0;
  }

  const days: JournalDay[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([day, entry]) => {
      const books = [...entry.books.values()].map(({ pageSet, ms, ...book }) => ({
        ...book,
        pages: pageSet.size,
        pageCount: Math.max(book.pageCount, pageSet.size),
        minutes: minutesOf(ms),
      }));
      const lessons = [...entry.lessons.values()].map(({ ms, ...lesson }) => ({ ...lesson, minutes: minutesOf(ms) }));
      const answered = lessons.reduce((n, l) => n + l.answered, 0) + books.reduce((n, b) => n + (b.quiz?.answered ?? 0), 0);
      const correctFirstTry =
        lessons.reduce((n, l) => n + l.correctFirstTry, 0) + books.reduce((n, b) => n + (b.quiz?.correctFirstTry ?? 0), 0);
      const minutes = lessons.reduce((n, l) => n + l.minutes, 0) + books.reduce((n, b) => n + b.minutes, 0);
      return { day, books, lessons, answered, correctFirstTry, minutes };
    })
    .filter((day) => day.books.some((b) => b.pages > 0 || b.finished || b.quiz) || day.lessons.length > 0);

  const learned = new Set(days.map((d) => d.day));
  const week = Array.from({ length: 7 }, (_, i) => learned.has(shiftDay(today, i - 6)));
  let streak = 0;
  let cursor = learned.has(today) ? today : shiftDay(today, -1);
  while (learned.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  const all = days.flatMap((d) => d.books);
  return {
    days,
    summary: {
      week,
      daysLearned: days.length,
      booksFinished: new Set(all.filter((b) => b.finished).map((b) => b.bookId)).size,
      pagesRead: all.reduce((n, b) => n + b.pages, 0),
      answered: days.reduce((n, d) => n + d.answered, 0),
      correctFirstTry: days.reduce((n, d) => n + d.correctFirstTry, 0),
      minutes: days.reduce((n, d) => n + d.minutes, 0),
      streak,
    },
  };
}
