import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import voice from "./voice.json";
import lessons from "./lessons.json";

/**
 * The spoken inventory and the engines agree.
 *
 * Two failures this catches, both silent. A phrase declared here but never said
 * is recorded in Phase 15 and never played — minutes of studio time, and a
 * voice file nothing reaches. A phrase the engine says but never declares is
 * the opposite: it falls through to live TTS for ever, which on an unstable
 * connection is a child tapping and hearing nothing.
 */

/*
 * Every engine, not just the first one.
 *
 * Scoped to the folder rather than to a list of filenames, so a Phase that adds
 * an engine cannot quietly leave its spoken lines out of the inventory.
 */
const activities = join(__dirname, "activities");
const source = readdirSync(activities)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => readFileSync(join(activities, file), "utf8"))
  .join("\n");

/**
 * The spoken half of every `refuse`, read out of the engines' source.
 *
 * Walked rather than matched with one expression. Three call sites choose their
 * spoken line with a conditional — `count === undefined ? "…" : "…"` — and a
 * pattern expecting a single string literal simply did not see them, which is
 * the quiet half of a coverage check failing: it reports success over less than
 * it was asked to look at.
 */
function spokenRefusals(text: string): string[] {
  const lines: string[] = [];
  for (let at = text.indexOf("refuse("); at !== -1; at = text.indexOf("refuse(", at + 1)) {
    let depth = 0;
    let end = at + "refuse(".length - 1;
    for (; end < text.length; end += 1) {
      if (text[end] === "(") depth += 1;
      else if (text[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const inside = text.slice(at + "refuse(".length, end);
    /*
     * Only the second argument.
     *
     * The first is the written nudge, which names the numbers on screen and is
     * never recorded; the second is the fixed line that is. Split at the
     * top-level comma rather than taking every string in the call, or the
     * written half is counted as something to record.
     */
    let split = -1;
    let nested = 0;
    let quote: string | null = null;
    for (let i = 0; i < inside.length; i += 1) {
      const ch = inside[i];
      if (quote) {
        if (ch === quote && inside[i - 1] !== "\\") quote = null;
        continue;
      }
      if (ch === '"' || ch === "`" || ch === "'") quote = ch;
      else if (ch === "(" || ch === "[" || ch === "{") nested += 1;
      else if (ch === ")" || ch === "]" || ch === "}") nested -= 1;
      else if (ch === "," && nested === 0) { split = i; break; }
    }
    if (split === -1) continue;
    const spoken = inside.slice(split + 1);
    // A conditional spoken line offers more than one; both are recorded.
    lines.push(...[...spoken.matchAll(/"([^"\\]*)"/g)].map((m) => m[1]).filter(Boolean));
  }
  return lines;
}

describe("the voice inventory matches what the engines say", () => {
  it("declares every fixed line the engine speaks", () => {
    const refusals = spokenRefusals(source);
    expect(refusals.length, "the engine refuses moves out loud").toBeGreaterThan(5);
    const declared = new Set(voice.phrases);
    for (const line of refusals) {
      expect(declared.has(line), `"${line}" is spoken but not declared in voice.json`).toBe(true);
    }
  });

  it("declares nothing the engine never says", () => {
    for (const phrase of voice.phrases) {
      expect(source.includes(`"${phrase}"`), `"${phrase}" is declared but never spoken`).toBe(true);
    }
  });

  /**
   * The inventory and the engines are the same set, not merely overlapping.
   *
   * Phase 15's whole deliverable. The two checks above are each half of it —
   * one that nothing spoken is undeclared, one that nothing declared is
   * unspoken — and neither alone rules out a phrase that appears in the source
   * as something other than a line the engine actually says.
   */
  it("declares exactly the fixed lines the twelve engines speak, and no others", () => {
    const spoken = new Set(spokenRefusals(source));
    for (const phrase of voice.phrases) {
      expect(spoken.has(phrase), `"${phrase}" is declared but no engine refuses with it`).toBe(true);
    }
    for (const line of spoken) {
      expect(voice.phrases, `"${line}" is spoken but not declared`).toContain(line);
    }
    // And no line is declared twice, which would record it twice.
    expect(new Set(voice.phrases).size).toBe(voice.phrases.length);
  });

  /*
   * Anything with a number in it is spoken live, never recorded.
   *
   * "Ten times eight is eighty" cannot be a clip — there are a hundred and
   * forty-four of them — so those lines go through TTS by design (§8). A
   * template that found its way into `phrases` would be a recording request
   * for a sentence that never repeats.
   */
  it("keeps the numbers out of the recorded inventory", () => {
    for (const phrase of voice.phrases) {
      expect(phrase, `"${phrase}" carries a number and cannot be one clip`).not.toMatch(/\d/);
      expect(phrase).not.toMatch(/\$\{/);
    }
  });

  it("leaves the number words to the common pack", () => {
    const numbers = ["one", "two", "three", "four", "five", "ten"];
    for (const word of numbers) {
      expect(
        voice.phrases.some((phrase) => phrase.toLowerCase() === `${word}.`),
        `"${word}" belongs to the common pack, not to this skill`,
      ).toBe(false);
    }
  });

  it("gives every teaching lesson a line to open with", () => {
    for (const lesson of lessons.lessons) {
      const play = lesson.params.play as { audioPrompt?: string };
      const question = lesson.params.question as { practice?: boolean };
      if (question.practice) continue;
      expect(play.audioPrompt, `${lesson.id} opens silently`).toBeTruthy();
    }
  });

  /*
   * And gives a practice lesson no line at all.
   *
   * Practice is retrieval without help, so `useSkillRound` is handed no intro
   * and the read-aloud control is not rendered — an `audioPrompt` on one of
   * these would be recorded in the voice pass and then never played, which is
   * the same waste as a switch nothing reads.
   */
  it("declares nothing for the lessons that stay silent", () => {
    const practice = lessons.lessons.filter(
      (lesson) => (lesson.params.question as { practice?: boolean }).practice,
    );
    expect(practice.length, "no practice lessons found").toBeGreaterThan(0);
    for (const lesson of practice) {
      const play = lesson.params.play as { audioPrompt?: string; kidTip?: string };
      expect(play.audioPrompt, `${lesson.id} declares a line it never speaks`).toBeUndefined();
      expect(play.kidTip, `${lesson.id} declares a hint it never shows`).toBeUndefined();
    }
  });
});
