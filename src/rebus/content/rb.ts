/**
 * A short way to write a rebus puzzle: the pieces as one line of text.
 *
 *   rb("Football", "foot + ball")
 *   rb("Soft ball", "cloud=soft + ball")          a drawing read as another word
 *   rb("Skiing", 'ski + "ING"')                    a written word
 *   rb("Big deal", '"DEAL"|big')                   a styled word
 *   rb("Man overboard", "[MAN/BOARD]")             one word over another
 *   rb("Big fish", "*fish=big_fish")               a drawing drawn big (`~` for small); `_` is a space in a name
 *
 * Pieces are separated by `+` or `&` (which is shown between them) or by a plain
 * space (nothing shown). The "why" sentence is made from what each piece is read as,
 * unless one is given. It produces the same `PuzzleSpec` the longer form does, so the
 * audit checks every one by the same rules.
 */

import type { AgeRange } from "../../lib/ages";
import { type PuzzleSpec } from "./build";
import type { Difficulty, Piece, Trick, WordStyle } from "../types";
import { ICON_PREFIX } from "../icons/library";

export interface RbOptions {
  /** 1 easy (the default), 2 medium, 3 hard. */
  d?: Difficulty;
  /** Other answers that are also right. */
  a?: string[];
  /** The sentence shown after the puzzle, when the automatic one will not do. */
  why?: string;
  /** What kind of trick it is, when it is not obvious from the pieces. */
  t?: Trick;
  ages?: AgeRange;
}

const STYLES = new Set<string>(["cut", "small", "big", "upside-down", "reversed", "spaced", "underlined", "crossed"]);

const readToken = (raw: string): Piece => {
  const token = raw.trim();
  const stack = token.match(/^\[(.+?)\/(.+?)\]$/);
  if (stack) return { kind: "stack", top: stack[1], bottom: stack[2] };
  const word = token.match(/^"(.+?)"(?:\|([a-z-]+))?$/);
  if (word) {
    if (word[2] && !STYLES.has(word[2])) throw new Error(`Unknown word style "${word[2]}" in ${raw}`);
    return { kind: "word", text: word[1], ...(word[2] ? { style: word[2] as Exclude<WordStyle, "plain"> } : {}) };
  }
  const scale = token.startsWith("*") ? "big" : token.startsWith("~") ? "small" : undefined;
  const bare = scale ? token.slice(1) : token;
  const [drawing, name] = bare.split("=");
  if (!/^[a-z][a-z0-9-]*$/.test(drawing)) throw new Error(`Cannot read the piece "${raw}"`);
  return { kind: "icon", id: ICON_PREFIX + drawing, name: name ? name.replace(/_/g, " ") : drawing, ...(scale ? { scale } : {}) };
};

/** Split on `+` and `&` that stand between pieces (not inside quotes), keeping the sign. */
const readPieces = (spec: string): Piece[] => {
  const out: Piece[] = [];
  let buffer = "";
  let quoted = false;
  let sign: "+" | "&" | null = null;
  const flush = () => {
    const text = buffer.trim();
    buffer = "";
    if (!text) return;
    // Plain spaces between tokens (outside quotes and brackets) separate pieces with no sign.
    const parts = text.match(/\[[^\]]+\]|"[^"]*"(?:\|[a-z-]+)?|[^\s"[\]]+/g) ?? [];
    parts.forEach((part, i) => {
      if (out.length > 0 && i === 0 && sign) out.push({ kind: "op", op: sign });
      out.push(readToken(part));
    });
    sign = null;
  };
  for (let i = 0; i < spec.length; i++) {
    const ch = spec[i];
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === "+" || ch === "&") && spec[i - 1] === " " && spec[i + 1] === " ") {
      flush();
      sign = ch;
      continue;
    }
    buffer += ch;
  }
  flush();
  return out;
};

const readAs = (p: Piece): string => (p.kind === "icon" ? p.name : p.kind === "word" ? p.text.toLowerCase() : p.kind === "stack" ? `${p.top.toLowerCase()} over ${p.bottom.toLowerCase()}` : "");

const trickOf = (pieces: Piece[]): Trick => {
  if (pieces.some((p) => p.kind === "stack")) return "position";
  if (pieces.some((p) => p.kind === "word" && p.style)) return "style";
  if (pieces.some((p) => p.kind === "icon" && p.scale)) return "size";
  return "compound";
};

export const rb = (answer: string, spec: string, opts: RbOptions = {}): PuzzleSpec => {
  const pieces = readPieces(spec);
  const names = pieces.map(readAs).filter(Boolean);
  const trick = opts.t ?? trickOf(pieces);
  const why = opts.why ?? (trick === "sound-alike" ? `${names.join(" + ")}, said fast, sounds like ${answer.toLowerCase()}.` : `${names.join(" + ")} = ${answer.toLowerCase()}.`);
  return { pieces, answer, why, trick, difficulty: opts.d ?? 1, accepts: opts.a ?? [], ...(opts.ages ? { ages: opts.ages } : {}) };
};
