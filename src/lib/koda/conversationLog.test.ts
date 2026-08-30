import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a conversation with Koda leaves behind.
 *
 * Two things are under test and only one is the recording. The first is that a
 * recommendation can actually be made from it — the child's own phrasing, the
 * character who answered, the concept it was about. The second, and the one
 * worth having tests for, is everything it *refuses* to keep: Koda's replies, an
 * unbounded transcript, and a panel somebody opened and shut.
 */

const recorded: any[] = [];
vi.mock("../learning/learningLog", () => ({
  LearningLog: {
    record: (event: unknown) => recorded.push(event),
    all: () => recorded,
  },
}));
vi.mock("../learnerProgress", () => ({ currentLearnerId: () => "l_mia" }));

const load = async () => await import("./conversationLog");

beforeEach(() => {
  vi.resetModules();
  recorded.length = 0;
});

describe("what is recorded", () => {
  it("keeps the child's questions, and never Koda's answers", async () => {
    const { KodaConversation } = await load();

    const chat = new KodaConversation({ mode: "chat", personaId: "aoede", conceptKey: "teen" });
    chat.said("why is it thirteen not threeteen");
    chat.said("is 14 more than 20");
    chat.end();

    expect(recorded).toHaveLength(1);
    expect(recorded[0].asked).toEqual([
      "why is it thirteen not threeteen",
      "is 14 more than 20",
    ]);
    // There is no field for a reply, and nothing should invent one.
    expect(JSON.stringify(recorded[0])).not.toMatch(/reply|answer|kodaSaid/i);
  });

  it("names the character who answered, not just 'Koda'", async () => {
    // Two children asking the same thing of Aoede and of Puck are not having
    // the same conversation, and a recommendation that averages them is worse
    // than one that does not exist.
    const { KodaConversation } = await load();

    const chat = new KodaConversation({ mode: "voice", personaId: "puck" });
    chat.said("how many is eight");
    chat.end();

    expect(recorded[0].personaId).toBe("puck");
    expect(recorded[0].mode).toBe("voice");
  });

  it("counts every turn even when it stops keeping the words", async () => {
    const { KodaConversation, MAX_ASKED } = {
      ...(await load()),
      ...(await import("../learning/events")),
    };
    const chat = new KodaConversation({ mode: "chat" });
    for (let i = 0; i < MAX_ASKED + 8; i += 1) chat.said(`question ${i}`);
    chat.end();

    expect(recorded[0].turns).toBe(MAX_ASKED + 8);
    expect(recorded[0].asked).toHaveLength(MAX_ASKED);
    // The cap drops the later ones: the opening question is usually the one
    // that names the misconception.
    expect(recorded[0].asked[0]).toBe("question 0");
  });

  it("truncates a very long question rather than storing an essay", async () => {
    const { KodaConversation } = await load();
    const { MAX_ASKED_CHARS } = await import("../learning/events");

    const chat = new KodaConversation({ mode: "chat" });
    chat.said("a".repeat(MAX_ASKED_CHARS * 3));
    chat.end();

    expect(recorded[0].asked[0]).toHaveLength(MAX_ASKED_CHARS);
  });

  it("carries the concept, so a recommendation has something to aggregate on", async () => {
    const { KodaConversation } = await load();

    new KodaConversation({ mode: "chat", conceptKey: "corresponder", levelNumber: 3 }).said("hi");
    // not ended — nothing yet
    expect(recorded).toHaveLength(0);

    const chat = new KodaConversation({ mode: "chat", conceptKey: "corresponder", levelNumber: 3 });
    chat.said("hi");
    chat.end();
    expect(recorded[0].conceptKey).toBe("corresponder");
    expect(recorded[0].levelNumber).toBe(3);
  });
});

describe("what is not recorded", () => {
  it("writes nothing when the panel was opened and shut without a word", async () => {
    const { KodaConversation } = await load();

    new KodaConversation({ mode: "chat" }).end();

    expect(recorded).toHaveLength(0);
  });

  it("writes nothing until the conversation ends", async () => {
    // One event per conversation, not per turn: a recommendation is about the
    // whole exchange, and per-turn events would put a child's words on the wire
    // once for every sentence.
    const { KodaConversation } = await load();

    const chat = new KodaConversation({ mode: "chat" });
    chat.said("one");
    chat.said("two");
    expect(recorded).toHaveLength(0);

    chat.end();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].turns).toBe(2);
  });

  it("writes once however many times it is ended", async () => {
    const { KodaConversation } = await load();

    const chat = new KodaConversation({ mode: "chat" });
    chat.said("hello");
    chat.end();
    chat.end();
    chat.end();

    expect(recorded).toHaveLength(1);
  });

  it("ignores anything said after it has ended", async () => {
    const { KodaConversation } = await load();

    const chat = new KodaConversation({ mode: "chat" });
    chat.said("before");
    chat.end();
    chat.said("after");

    expect(recorded[0].asked).toEqual(["before"]);
    expect(recorded[0].turns).toBe(1);
  });

  it("drops a question that is only whitespace", async () => {
    const { KodaConversation } = await load();

    const chat = new KodaConversation({ mode: "chat" });
    chat.said("   \n  ");
    chat.said("a real one");
    chat.end();

    expect(recorded[0].asked).toEqual(["a real one"]);
  });
});

describe("a conversation is never the product", () => {
  it("does not interrupt a child when the log refuses the event", async () => {
    vi.doMock("../learning/learningLog", () => ({
      LearningLog: {
        record: () => {
          throw new Error("disk full");
        },
        all: () => [],
      },
    }));
    const { KodaConversation } = await import("./conversationLog");

    const chat = new KodaConversation({ mode: "chat" });
    chat.said("still talking");

    expect(() => chat.end()).not.toThrow();
  });
});
