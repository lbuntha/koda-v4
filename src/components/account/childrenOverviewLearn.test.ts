import { describe, expect, it } from "vitest";
import { mixOf, newsOf } from "./ChildrenOverview";
import type { ChildOverview } from "../../lib/childrenOverview";
import { isLadderConcept } from "../../trace/learning";

const child = (over: Partial<ChildOverview> = {}): ChildOverview => ({
  id: "l_1", displayName: "Mia", avatarSeed: "l_1", streak: 0, daysAway: 0, daysThisWeek: 1,
  today: { rounds: 3, minutes: 9, goal: 3, goalMet: true },
  ...over,
});

describe("a child's row on Home, across Learn", () => {
  it("counts today by Think, Read and Write — but only when it was more than lessons", () => {
    expect(mixOf(child({ today: { rounds: 4, minutes: 9, goal: 3, goalMet: true, mix: { think: 1, read: 1, write: 2 } } }))).toBe("1 lesson · 1 book · 2 writing");
    expect(mixOf(child({ today: { rounds: 4, minutes: 9, goal: 3, goalMet: true, mix: { think: 4, read: 0, write: 0 } } }))).toBeNull();
    expect(mixOf(child())).toBeNull(); // an answer stored before the mix existed
  });

  it("says the week's news: letters they can now write, books they finished", () => {
    expect(newsOf(child({ week: { canWrite: ["ក", "ខ"], booksRead: ["The Three Little Pigs"] } }))).toBe("Can now write ក ខ · Read The Three Little Pigs");
    expect(newsOf(child({ week: { canWrite: [], booksRead: [] } }))).toBeNull();
    expect(newsOf(child())).toBeNull();
  });
});

describe("the report's concepts", () => {
  it("leave writing to its own section, letter by letter", () => {
    expect(isLadderConcept("trace-write-khmer")).toBe(true);
    expect(isLadderConcept("trace-draw")).toBe(true);
    expect(isLadderConcept("read-and-answer")).toBe(false);
    expect(isLadderConcept("count-all")).toBe(false);
  });
});
