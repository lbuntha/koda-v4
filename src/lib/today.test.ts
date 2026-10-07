import { describe, expect, it } from "vitest";
import { pickRead, pickWrite, type BookCandidate, type CollectionCandidate, type TodayContext } from "./today";
import { tags } from "./topics";

const book = (id: string, over: Partial<BookCandidate> = {}): BookCandidate => ({ id, ages: [5, 7], tags: tags(["reading"]), stage: null, updatedAt: 0, ...over });
const set = (id: string, over: Partial<CollectionCandidate> = {}): CollectionCandidate => ({
  id, ages: [5, 7], tags: tags(["writing"]), done: 0, total: 5, started: false, lastAt: 0, due: 0, ...over,
});
const ctx = (over: Partial<TodayContext> = {}): TodayContext => ({ age: 6, recent: tags([]), ...over });

describe("Today's Read pick", () => {
  it("carries on with the book read most recently, whatever its age", () => {
    const books = [book("a", { stage: "read", updatedAt: 1 }), book("b", { stage: "quiz", updatedAt: 5, ages: [12, 14] }), book("c")];
    expect(pickRead(books, ctx())).toMatchObject({ item: { id: "b" }, why: "continue" });
  });

  it("offers a new book only within a year of the child's age", () => {
    const books = [book("teen", { ages: [13, 15] }), book("fits", { ages: [7, 9] })];
    expect(pickRead(books, ctx({ age: 6 }))?.item.id).toBe("fits");
    expect(pickRead([book("teen", { ages: [13, 15] })], ctx({ age: 6 }))).toBeNull();
  });

  it("prefers a book that goes with what the child did lately, and names the link", () => {
    const books = [book("plain"), book("ka", { tags: tags(["reading"], ["letter:km:ក"]) })];
    expect(pickRead(books, ctx({ recent: tags(["writing"], ["letter:km:ក"]) }))).toEqual({ item: books[1], why: "linked", link: "letter:km:ក" });
  });

  it("then the book nearest the child's age, then shelf order", () => {
    const books = [book("older", { ages: [7, 9] }), book("right", { ages: [5, 7] }), book("also", { ages: [5, 7] })];
    expect(pickRead(books, ctx({ age: 6 }))).toEqual({ item: books[1], why: "new" });
  });

  it("leaves finished books out, and age out when it is not known", () => {
    expect(pickRead([book("done", { stage: "done" })], ctx())).toBeNull();
    expect(pickRead([book("teen", { ages: [13, 15] })], ctx({ age: null }))?.item.id).toBe("teen");
  });
});

describe("Today's Write pick", () => {
  it("puts a due check-up first, then what was started, then something new", () => {
    const sets = [set("new"), set("going", { started: true, done: 2, lastAt: 9 }), set("due", { started: true, done: 5, due: 2 })];
    expect(pickWrite(sets, ctx())?.why).toBe("checkUp");
    expect(pickWrite(sets.slice(0, 2), ctx())).toMatchObject({ item: { id: "going" }, why: "continue" });
    expect(pickWrite(sets.slice(0, 1), ctx())).toMatchObject({ item: { id: "new" }, why: "new" });
  });

  it("with everything finished, offers the one practised longest ago again", () => {
    const sets = [set("recent", { started: true, done: 5, lastAt: 9 }), set("old", { started: true, done: 5, lastAt: 1 })];
    expect(pickWrite(sets, ctx())).toMatchObject({ item: { id: "old" }, why: "again" });
  });

  it("links a set of numbers to a counting lesson the child just did", () => {
    const sets = [set("letters", { tags: tags(["writing", "letters"]) }), set("numbers", { tags: tags(["writing", "numbers"]) })];
    expect(pickWrite(sets, ctx({ recent: tags(["numbers", "counting"]) }))).toEqual({ item: sets[1], why: "linked", link: "numbers" });
  });
});
