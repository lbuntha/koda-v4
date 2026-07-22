/**
 * Koda's instruction text — pure parsing, no React.
 *
 * Kept separate from the view so the rules that decide *what a child sees
 * highlighted* and *when Koda repeats herself* can be tested directly.
 */

export interface Token {
  text: string;
  /** Emphasised span — rendered as a chip mirroring the control to press. */
  strong: boolean;
  /** Pure whitespace; rendered as-is and skipped by the reveal rhythm. */
  isSpace: boolean;
}

/**
 * Split `Tap **+ Ten Rod** now.` into renderable tokens.
 *
 * An emphasised span stays whole — "+ Ten Rod" must render as one chip that
 * mirrors the button the child is told to press, not three. Plain text is
 * split per word so it can be revealed left-to-right, and whitespace is kept
 * as its own token so punctuation still hugs the chip it follows
 * (`**18**!` reads "18!", never "18 !").
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  text.split("**").forEach((chunk, i) => {
    if (i % 2 === 1) {
      if (chunk) tokens.push({ text: chunk, strong: true, isSpace: false });
      return;
    }
    (chunk.match(/\s+|\S+/g) ?? []).forEach(part => {
      tokens.push({ text: part, strong: false, isSpace: /^\s+$/.test(part) });
    });
  });
  return tokens;
}

/**
 * Sentence "shape" — the text with every number replaced by a placeholder.
 *
 * Counting prompts change on every tap ("…we have **3**" → "…we have **4**"),
 * but that is the same instruction. Keying the reveal animation and the
 * auto-speech on the shape means Koda re-reads only when the instruction
 * genuinely changes, instead of stuttering on every single tap.
 */
export const sentenceShape = (text: string) => text.replace(/\d+/g, "#");
