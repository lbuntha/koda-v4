import { beforeEach, describe, expect, it } from "vitest";
import { LearningLog, MAX_WORDS_TAPPED, type LearningEvent } from "../lib/learning";
import { STARTER_PASSAGES } from "./data/starterPassages";
import { ReadingRecorder } from "./learning";

const BOOK = STARTER_PASSAGES[0];
let clock = 0;
const recorder = () => new ReadingRecorder(BOOK, 4, "picker", () => clock);
const reading = () => LearningLog.all({ skillId: "koda-library" }).filter((e) => e.activityId === "reading");
const of = <T extends LearningEvent["type"]>(type: T) => reading().filter((e) => e.type === type) as Array<Extract<LearningEvent, { type: T }>>;

beforeEach(() => {
  localStorage.clear();
  LearningLog.clear();
  clock = 1_000_000;
});

describe("ReadingRecorder — a book read, in the learning log", () => {
  it("carries the book in the standard envelope, like every lesson event", () => {
    const r = recorder();
    r.start();
    const [started] = of("reading_started");
    expect(started).toMatchObject({ skillId: "koda-library", activityId: "reading", lessonId: `${BOOK.id}@${BOOK.rev}`, entry: "picker", pageCount: 4 });
    expect(started.learnerId).toBeTruthy();
    expect(started.sessionId).toBeTruthy();
    expect(started.localDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports each story page as it is left, with its time, read-aloud and tapped words", () => {
    const r = recorder();
    r.start();
    r.turnTo(1);
    clock += 12_000;
    r.readAloud();
    r.tapWord("mango");
    r.tapWord("mango");
    r.turnTo(2);
    clock += 3_000;
    r.finish();
    const pages = of("page_read");
    expect(pages.map((p) => [p.page, p.dwellMs, p.readAloud, p.wordsTapped])).toEqual([[1, 12_000, 1, ["mango"]], [2, 3_000, 0, []]]);
    expect(of("reading_finished")[0]).toMatchObject({ pagesSeen: 2, durationMs: 15_000, readAloudPages: 1, wordsTapped: 2 });
  });

  it("counts a page read twice once in pages seen", () => {
    const r = recorder();
    r.start();
    r.turnTo(1);
    r.turnTo(2);
    r.turnTo(1);
    r.finish();
    expect(of("page_read").map((p) => p.page)).toEqual([1, 2, 1]);
    expect(of("reading_finished")[0].pagesSeen).toBe(2);
  });

  it("records an abandonment past the cover, and nothing for a book shut on it", () => {
    const shut = recorder();
    shut.start();
    shut.close();
    expect(of("reading_abandoned")).toHaveLength(0);

    const left = recorder();
    left.start();
    left.turnTo(1);
    left.turnTo(2);
    clock += 5_000;
    left.close();
    expect(of("reading_abandoned")[0]).toMatchObject({ furthestPage: 2, pagesSeen: 2 });
    expect(of("page_read").at(-1)).toMatchObject({ page: 2, dwellMs: 5_000 });
  });

  it("survives React's development double-mount: one start, and a finish ends it for good", () => {
    const r = recorder();
    r.start();
    r.close();
    r.start();
    expect(of("reading_started")).toHaveLength(1);
    r.turnTo(1);
    r.finish();
    r.close();
    r.finish();
    expect(of("reading_finished")).toHaveLength(1);
    expect(of("reading_abandoned")).toHaveLength(0);
  });

  it("ties one read-through together, and a second read gets its own id", () => {
    const first = recorder();
    first.start();
    first.turnTo(1);
    first.finish();
    const second = recorder();
    second.start();
    const ids = reading().map((e) => (e as { readId: string }).readId);
    expect(new Set(ids.slice(0, 3)).size).toBe(1);
    expect(ids.at(-1)).not.toBe(ids[0]);
  });

  it("keeps at most a capped list of tapped words per page", () => {
    const r = recorder();
    r.start();
    r.turnTo(1);
    for (let i = 0; i < MAX_WORDS_TAPPED + 5; i++) r.tapWord(`w${i}`);
    r.finish();
    expect(of("page_read")[0].wordsTapped).toHaveLength(MAX_WORDS_TAPPED);
    expect(of("reading_finished")[0].wordsTapped).toBe(MAX_WORDS_TAPPED + 5);
  });
});
