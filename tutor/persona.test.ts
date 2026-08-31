import { describe, expect, it } from "vitest";

import { FALLBACK_CHARACTER, kodaSystemPrompt, type KodaCharacter } from "./persona";

/**
 * The one seam where a character becomes a prompt.
 *
 * Worth pinning because everything else about the feature depends on it holding
 * its shape: the rules are code and no character can shed them, the manner is
 * data and every character carries its own, and a question that is not on
 * screen is never invented — which is the bug that had Koda answering about a
 * balance-scale problem a child on the home page could not see.
 */

const vega: KodaCharacter = {
  personaId: "vega",
  name: "Ms Vega",
  emoji: "🔭",
  blurb: "Precise and calm.",
  manner: "You are calm, precise and encouraging.",
  voice: "Kore",
  minAge: 8,
  maxAge: 12,
};

describe("building a character's prompt", () => {
  it("carries the rules every teacher obeys, whoever they are", () => {
    for (const character of [FALLBACK_CHARACTER, vega]) {
      const prompt = kodaSystemPrompt(character, { mode: "chat" });
      expect(prompt).toContain("NEVER give the answer");
      expect(prompt).toContain("One idea per reply");
    }
  });

  it("names the character and pitches at their age", () => {
    const prompt = kodaSystemPrompt(vega, { mode: "chat" });
    expect(prompt).toContain("You are Ms Vega.");
    expect(prompt).toContain("calm, precise and encouraging");
    expect(prompt).toContain("8 to 12 years old");
  });

  it("says there is no question when there is none, rather than leaving it open", () => {
    const prompt = kodaSystemPrompt(vega, { mode: "chat" });
    // The failure this prevents: a model with no question and no instruction
    // about that invents one, and answers about a problem nobody can see.
    expect(prompt).toContain("There is no question on screen");
    expect(prompt).toContain("do not invent one");
  });

  it("states the question when there is one", () => {
    const prompt = kodaSystemPrompt(vega, { mode: "chat", question: "What is 7 + 5?" });
    expect(prompt).toContain('"What is 7 + 5?"');
    expect(prompt).not.toContain("There is no question on screen");
  });

  it("writes for speech in a voice session and for reading in a written one", () => {
    const spoken = kodaSystemPrompt(vega, { mode: "voice" });
    expect(spoken).toContain("SPEAKING ALOUD");
    // The phrase the app watches for to advance the round.
    expect(spoken).toContain('"next question"');
    // A character introduces itself as itself, never as "Koda" generically.
    expect(spoken).toContain("Introduce yourself as Ms Vega");

    const written = kodaSystemPrompt(vega, { mode: "chat" });
    expect(written).toContain("YOU ARE WRITING");
    expect(written).not.toContain("SPEAKING ALOUD");
  });

  it("tells the drawing reader to say what it sees before hinting", () => {
    const prompt = kodaSystemPrompt(vega, { mode: "whiteboard" });
    expect(prompt).toContain("READING WHAT THE CHILD DREW");
    expect(prompt).toContain("say so plainly rather than guessing");
  });

  it("leaves out what it was not told, rather than filling in a default", () => {
    const bare = kodaSystemPrompt(vega, { mode: "chat" });
    expect(bare).not.toContain("Topic:");
    expect(bare).not.toContain("Level:");

    const full = kodaSystemPrompt(vega, { mode: "chat", topic: "Counting", level: 3 });
    expect(full).toContain("Topic: Counting");
    expect(full).toContain("Level: 3");
  });
});

/**
 * The rule the whole assistant exists to keep.
 *
 * Koda is a tutor, not an answer key: a child who is handed the result has
 * skipped the part that was the lesson. The old wording — "never give the raw
 * answer to a question the child is still working on" — read as a rule about
 * the question on screen, which left the home page, and anything a child simply
 * typed, outside it.
 *
 * Two carve-outs are deliberate and worth protecting, because a rule that
 * over-reaches gets ignored: Koda may say whether the child's *own* answer is
 * right, and may explain what a word or a tool means. Withholding either makes
 * a worse tutor, not a stricter one.
 */
describe("never giving the answer", () => {
  const prompt = () => kodaSystemPrompt(FALLBACK_CHARACTER, { mode: "chat" });

  it("forbids it outright, not only for the question on screen", () => {
    const text = prompt();

    expect(text).toContain("NEVER give the answer");
    // The loophole: no question on screen used to mean no rule.
    expect(text).not.toContain("a question the child is still working on");
  });

  it("closes the ways a child talks their way around it", () => {
    const text = prompt();

    const flat = text.replace(/\s+/g, " ");
    expect(flat).toMatch(/ask you directly/i);
    expect(flat).toMatch(/grown-up said so/i);
    expect(flat).toMatch(/only want to check/i);
    expect(text.replace(/\s+/g, " ")).toMatch(/There is no phrasing that unlocks it/i);
  });

  it("names the two ways of giving it away that do not look like it", () => {
    const text = prompt();

    // Reasoning aloud to the number, and confirming a number Koda supplied.
    const flat = text.replace(/\s+/g, " ");
    expect(flat).toMatch(/arriving at the number is still giving the answer/i);
    expect(flat).toMatch(/confirming a number you supplied yourself/i);
  });

  it("still lets Koda mark the child's own answer", () => {
    // A child who can never find out whether they were right is worse off.
    expect(prompt().replace(/\s+/g, " ")).toMatch(/their own\* answer is right or wrong/i);
  });

  it("still lets Koda explain what something means", () => {
    expect(prompt().replace(/\s+/g, " ")).toMatch(/explain a word, a symbol or how a tool/i);
  });

  it("carries the rule in every mode, because a child can switch panels", () => {
    for (const mode of ["chat", "voice", "whiteboard"] as const) {
      expect(
        kodaSystemPrompt(FALLBACK_CHARACTER, { mode }),
        `${mode} lost the rule`,
      ).toContain("NEVER give the answer");
    }
  });
});
