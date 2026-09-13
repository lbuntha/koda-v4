import { describe, expect, it } from "vitest";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * No control is drawn with a character the phone will turn into an emoji.
 *
 * Reported from a phone: division's undo button was the character `↩`
 * (U+21A9). On a desktop browser that renders from the text font and looks like
 * a small grey arrow. On iOS and Android it is in the emoji set, so the system
 * substitutes the colour glyph ↩️ — a blue-and-white picture in the middle of a
 * muted grey toolbar, at whatever size and weight the emoji font feels like.
 *
 * The trap is that it is invisible to everyone who builds on a laptop. Four of
 * them shipped that way.
 *
 * Arrows and shapes that are *not* in the emoji set — `→`, `←`, `□`, `⌫` — are
 * fine and are used deliberately (a number-line direction, a blank in an
 * equation), so this bans the emoji-presentation characters rather than
 * everything that is not a letter.
 */

/** Characters a phone renders from the emoji font by default. */
const EMOJI_BY_DEFAULT = [
  "↩", // ↩ leftwards arrow with hook
  "↪", // ↪
  "⌚", "⌛", // ⌚ ⌛
  "⏩", "⏪", "⏫", "⏬", "⏰", "⏳", // ⏩ ⏪ ⏫ ⏬ ⏰ ⏳
  "▶", "◀", // ▶ ◀
  "☀", "☁", "☑", "☔", "☕", // ☀ ☁ ☑ ☔ ☕
  "⚠", "⚡", // ⚠ ⚡
  "✅", "❌", "❎", // ✅ ❌ ❎
  "✨", "✴", "❓", "❔", "❕", "❗", // ✨ ✴ ❓ ❔ ❕ ❗
  "➡", "⬅", "⬆", "⬇", "⬛", "⬜", "⭐", "⭕", // ➡ ⬅ ⬆ ⬇ ⬛ ⬜ ⭐ ⭕
  "➕", "➖", "➗", // ➕ ➖ ➗
  "️", // the variation selector that forces emoji rendering
];

const SUSPECT = new RegExp(
  `(?:[${EMOJI_BY_DEFAULT.join("")}]|[\\u{1F300}-\\u{1FAFF}]|[\\u{1F004}-\\u{1F0CF}])`,
  "u",
);

const SKILLS = ["counting", "addition", "subtraction", "multiplication", "division", "fractions"];

/**
 * Comments are exempt.
 *
 * `TenFrameRocket` explains at length why a lightning bolt is the wrong thing to
 * put in a ten-frame slot, and quotes the bolt to do it. A rule that could not
 * tell the difference would force the explanation to be deleted.
 */
const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("nothing a child taps is drawn with an emoji", () => {
  for (const id of SKILLS) {
    it(`draws every control in ${id} with an icon or a word`, () => {
      const dir = join(process.cwd(), `src/skills/${id}/activities`);
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx") && !f.includes(".test."))) {
        const text = withoutComments(readFileSync(join(dir, file), "utf8"));
        const hit = SUSPECT.exec(text);
        const where = hit ? text.slice(Math.max(0, hit.index - 60), hit.index + 20).split("\n").pop() : "";
        expect(
          hit?.[0],
          `${id}/${file} draws "${hit?.[0]}" (U+${hit?.[0].codePointAt(0)?.toString(16).toUpperCase()}) near: ${where}`,
        ).toBeUndefined();
      }
    });
  }

  it("still allows the arrows and blanks that are not emoji", () => {
    // These are deliberate: a direction on a number line, a blank in a written
    // equation, a backspace key. Banning them would be banning the notation.
    for (const ch of ["→", "←", "□", "⌫", "×", "÷", "−"]) {
      expect(SUSPECT.test(ch), `${ch} should be allowed`).toBe(false);
    }
  });

  it("catches the one that was reported", () => {
    expect(SUSPECT.test("↩")).toBe(true);
  });
});
