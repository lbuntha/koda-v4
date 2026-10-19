import { describe, expect, it, vi } from "vitest";
import { generate, type Ask } from "./pipeline";
import { buildBrief, buildSolverQuestion, describeForSolver, extractJson, parseCandidates, readBrief, type Brief } from "./prompt";

const brief: Brief = { category: "food", ages: [6, 12], difficulty: 1, count: 4, tricks: ["compound"], notes: "", };

const item = (answer: string, a: string, b: string, over: Record<string, unknown> = {}) => ({
  pieces: [{ kind: "icon", id: `rebus-${a}`, name: a }, { kind: "op", op: "+" }, { kind: "icon", id: `rebus-${b}`, name: b }],
  answer, accepts: [], explanation: `${a} + ${b} = ${answer.toLowerCase()}.`, trick: "compound", missingIcons: [], ...over,
});

/** A model that drafts the given items, then solves them as the test says. */
const model = (drafted: unknown[], solved: Record<string, string> | "fail"): Ask =>
  vi.fn(async (system: string) => {
    if (system.startsWith("You solve rebus puzzles")) {
      if (solved === "fail") throw new Error("down");
      return JSON.stringify(solved);
    }
    return "Here you go:\n```json\n" + JSON.stringify(drafted) + "\n```";
  });

describe("reading a model's reply", () => {
  it("finds JSON in a code fence, in prose, or bare", () => {
    expect(extractJson('```json\n[1,2]\n```')).toEqual([1, 2]);
    expect(extractJson('Sure! [{"a":1}] Hope that helps.')).toEqual([{ a: 1 }]);
    expect(extractJson('{"1":"x"}')).toEqual({ "1": "x" });
    expect(() => extractJson("no json here")).toThrow();
  });

  it("keeps well-formed puzzles and drops the rest", () => {
    const reply = JSON.stringify([item("Honeymoon", "honey", "moon"), { answer: "no pieces" }, "junk", { pieces: [{ kind: "icon" }], answer: "x" }, item("Hot dog", "fire", "dog", { trick: "invented" })]);
    const got = parseCandidates(reply);
    expect(got.map((c) => c.answer)).toEqual(["Honeymoon", "Hot dog"]);
    expect(got[1].trick).toBe("compound");
  });

  it("accepts an object with a puzzles list as well as a bare array", () => {
    expect(parseCandidates(JSON.stringify({ puzzles: [item("Honeymoon", "honey", "moon")] }))).toHaveLength(1);
  });
});

describe("a brief", () => {
  it("is refused before any model is paid when it is not sensible", () => {
    expect(readBrief(null)).toBe("Send a brief.");
    expect(readBrief({ category: "Cars!", ages: [6, 9], difficulty: 1, count: 5 })).toBe("Pick a category.");
    expect(readBrief({ category: "food", ages: [3, 9], difficulty: 1, count: 5 })).toBe("Pick the ages this is for.");
    expect(readBrief({ category: "food", ages: [6, 9], difficulty: 5, count: 5 })).toBe("Pick a difficulty.");
    expect(readBrief({ category: "food", ages: [6, 9], difficulty: 1, count: 500 })).toMatch(/1 to 30/);
    expect(readBrief({ category: "food", ages: [6, 9], difficulty: 2, count: 12, tricks: ["compound", "nonsense"], notes: "  breakfast  " })).toEqual({ category: "food", ages: [6, 9], difficulty: 2, count: 12, tricks: ["compound"], notes: "breakfast" });
  });

  it("tells the model the closed list of drawings and the answers already taken", () => {
    const text = buildBrief(brief, ["apple", "moon"], ["Honeymoon", "Hot dog"]);
    expect(text).toContain("rebus-apple, rebus-moon");
    expect(text).toContain("EXISTING_ANSWERS (2): Honeymoon, Hot dog");
    expect(text).toContain("AGE BAND: 6 to 12");
  });

  it("describes a puzzle to the blind solver by what is drawn, never by what it is meant to say", () => {
    const text = describeForSolver([{ kind: "icon", id: "rebus-fire", name: "hot" }, { kind: "op", op: "+" }, { kind: "icon", id: "rebus-dog", name: "dog" }, { kind: "stack", top: "MAN", bottom: "BOARD" }]);
    expect(text).toBe('a picture of fire, then plus, then a picture of dog, then the word "MAN" written above the word "BOARD"');
    expect(text).not.toContain("hot");
    expect(buildSolverQuestion([{ pieces: [{ kind: "word", text: "S" }] }])).toBe('1. the word "S"');
  });
});

describe("generating puzzles", () => {
  it("passes a good puzzle that the blind solver can read", async () => {
    const out = await generate(model([item("Honeymoon", "honey", "moon")], { "1": "honey moon" }), { brief, existingAnswers: [] });
    expect(out.puzzles[0].checks).toEqual({ issues: [], blind: { ok: true, said: "honey moon" }, safe: true });
    expect(out.stats).toEqual({ drafted: 1, valid: 1, solved: 1, duplicates: 0, needIcons: 0, unsafe: 0 });
    expect(out.puzzles[0].draft).toMatchObject({ category: "food", ages: [6, 12], difficulty: 1 });
  });

  it("flags a puzzle the solver could not read, with what it said instead", async () => {
    const out = await generate(model([item("Honeymoon", "honey", "moon")], { "1": "sweet night" }), { brief, existingAnswers: [] });
    expect(out.puzzles[0].checks.blind).toEqual({ ok: false, said: "sweet night" });
    expect(out.stats.solved).toBe(0);
  });

  it("never shows the solver the intended answer", async () => {
    const ask = model([item("Honeymoon", "honey", "moon")], { "1": "x" });
    await generate(ask, { brief, existingAnswers: [] });
    const solverCall = vi.mocked(ask).mock.calls.find((c) => c[0].startsWith("You solve"));
    expect(solverCall?.[1]).not.toMatch(/honeymoon/i);
  });

  it("flags a drawing that does not exist, rather than inventing it", async () => {
    const out = await generate(model([item("Yeti pie", "yeti", "pie", { missingIcons: ["yeti"] })], { "1": "yeti pie" }), { brief, existingAnswers: [] });
    expect(out.puzzles[0].checks.issues).toContain("unknown-icon");
    expect(out.puzzles[0].missingIcons).toEqual(["yeti"]);
    expect(out.stats.needIcons).toBe(1);
  });

  it("flags an answer already in the bank, however it is spelled, and a repeat within the batch", async () => {
    const out = await generate(model([item("Hot  Dog", "fire", "dog"), item("Honeymoon", "honey", "moon"), item("Honey Moon", "honey", "moon")], {}), { brief, existingAnswers: ["hot dog"] });
    expect(out.puzzles.map((p) => p.checks.issues.includes("duplicate"))).toEqual([true, false, true]);
    expect(out.stats.duplicates).toBe(2);
  });

  it("flags the answer being written in the puzzle, and a missing explanation", async () => {
    const out = await generate(model([{ ...item("Honeymoon", "honey", "moon"), pieces: [{ kind: "word", text: "honeymoon" }], explanation: "" }], {}), { brief, existingAnswers: [] });
    expect(out.puzzles[0].checks.issues).toEqual(expect.arrayContaining(["answer-in-puzzle", "no-explanation"]));
  });

  it("flags words that never belong in a puzzle for children", async () => {
    const out = await generate(model([item("Beer belly", "apple", "cake")], {}), { brief, existingAnswers: [] });
    expect(out.puzzles[0].checks.safe).toBe(false);
    expect(out.stats.unsafe).toBe(1);
  });

  it("goes on, unchecked by the solver, when the solver call fails", async () => {
    const out = await generate(model([item("Honeymoon", "honey", "moon")], "fail"), { brief, existingAnswers: [] });
    expect(out.puzzles[0].checks.blind).toBeNull();
    expect(out.puzzles).toHaveLength(1);
  });

  it("uses the Studio's saved prompt when there is one", async () => {
    const ask = model([], {});
    await generate(ask, { brief, systemPrompt: "MY PROMPT", existingAnswers: [] });
    expect(vi.mocked(ask).mock.calls[0][0]).toBe("MY PROMPT");
  });

  it("fails clearly when the model's reply is not JSON at all", async () => {
    await expect(generate(vi.fn(async () => "I cannot help with that."), { brief, existingAnswers: [] })).rejects.toThrow(/no JSON/);
  });
});
