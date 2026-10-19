/**
 * What the model is told, and how its answer is read.
 *
 * The system prompt is the Studio's own (editable and versioned there); the
 * brief is built fresh for each batch from what the staff chose. The model is
 * never trusted: it picks from a closed list of drawings, its output is read
 * as data and checked by the same rules as a puzzle a person typed, and a
 * second, blind call has to solve each puzzle from its pictures alone.
 */

import { isAgeRange, type AgeRange } from "../../lib/ages";
import { categories } from "../categories";
import { ICON_PREFIX } from "../icons/library";
import { TRICKS, type CategoryId, type Difficulty, type Piece, type Trick } from "../types";

export const DEFAULT_SYSTEM_PROMPT = `You write rebus puzzles for children who are learning with Koda.
A rebus shows pictures, words and signs that read aloud as a word or a phrase:
a picture of a germ + a picture of money reads "Germany".

RULES
1. Use ONLY drawings from ICON_LIBRARY, by their exact id. If an idea needs a
   drawing that is not there, still write the puzzle and put the missing
   drawing's name in "missingIcons".
2. Each picture is read aloud as a word. Its "name" is that word, which may
   differ from the drawing (a flame drawn for "hot"). Say the whole puzzle
   aloud: it must sound like the answer.
3. The answer must be a word or phrase a child of the stated age knows. No
   obscure words, no brand names, nothing frightening or unkind.
4. Someone who sees only the pictures must be able to reach the answer. Never
   write the answer in a piece.
5. Keep to the age band: fewer pieces and plain compound words when young;
   sound-alikes, idioms and position tricks when older.
6. "explanation" is one short sentence a child can follow.
7. Do not repeat any answer in EXISTING_ANSWERS, or each other.

PIECES (in the order they are read)
  {"kind":"icon","id":"rebus-fire","name":"hot"}
  {"kind":"word","text":"S"}                       optional "style": "cut"|"small"|"big"|"upside-down"
  {"kind":"stack","top":"MAN","bottom":"BOARD"}    one word above another
  {"kind":"op","op":"+"}  or  "&"                  between two pieces

OUTPUT: a JSON array and nothing else. Each item:
{"pieces":[…],"answer":"…","accepts":["…"],"explanation":"…","trick":"compound","missingIcons":[]}`;

export interface Brief {
  category: CategoryId;
  ages: AgeRange;
  difficulty: Difficulty;
  /** 1–30 puzzles. */
  count: number;
  tricks: Trick[];
  notes: string;
}

export const MAX_COUNT = 30;

export const buildBrief = (brief: Brief, iconNames: readonly string[], existingAnswers: readonly string[]): string =>
  [
    `CATEGORY: ${brief.category}`,
    `AGE BAND: ${brief.ages[0]} to ${brief.ages[1]} years`,
    `DIFFICULTY: ${brief.difficulty} (1 easy, 3 hard)`,
    `COUNT: ${brief.count}`,
    `TRICKS TO USE: ${brief.tricks.length ? brief.tricks.join(", ") : "any"}`,
    `NOTES: ${brief.notes.trim() || "none"}`,
    `ICON_LIBRARY (${iconNames.length}): ${iconNames.map((n) => ICON_PREFIX + n).join(", ")}`,
    `EXISTING_ANSWERS (${existingAnswers.length}): ${existingAnswers.slice(0, 200).join(", ") || "none"}`,
  ].join("\n");

/** A drawing's own name, which is what a person who only sees it would call it. */
export const drawingName = (id: string): string => id.replace(new RegExp(`^${ICON_PREFIX}`), "");

/** A puzzle as the blind solver sees it: what is drawn and written, never what it is meant to say. */
export const describeForSolver = (pieces: readonly Piece[]): string =>
  pieces
    .map((p) => {
      switch (p.kind) {
        case "icon":
          return `a picture of ${drawingName(p.id)}${p.scale === "big" ? " (drawn big)" : p.scale === "small" ? " (drawn small)" : ""}`;
        case "word":
          return `the word "${p.text}"${p.style && p.style !== "plain" ? ` (${p.style})` : ""}`;
        case "stack":
          return `the word "${p.top}" written above the word "${p.bottom}"`;
        case "op":
          return p.op === "&" ? "and" : p.op === "-" ? "minus" : "plus";
      }
    })
    .join(", then ");

export const SOLVER_SYSTEM = `You solve rebus puzzles. Each is a row of pictures, words and signs that read aloud as a word or a phrase.
Say each puzzle's pieces aloud, joined, and reply with what it sounds like.
Reply with a JSON object mapping each puzzle's number to its answer, for example {"1":"honeymoon","2":"hot dog"}, and nothing else.
If you are unsure, give your best guess.`;

export const buildSolverQuestion = (puzzles: readonly { pieces: readonly Piece[] }[]): string =>
  puzzles.map((p, i) => `${i + 1}. ${describeForSolver(p.pieces)}`).join("\n");

// ---- reading what comes back -------------------------------------------------

/** The first JSON value in a reply, whether or not the model wrapped it in a code fence or prose. */
export const extractJson = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("The model's reply had no JSON in it.");
  const open = body[start];
  const close = open === "[" ? "]" : "}";
  const end = body.lastIndexOf(close);
  if (end <= start) throw new Error("The model's reply was cut off.");
  return JSON.parse(body.slice(start, end + 1));
};

export interface Candidate {
  pieces: Piece[];
  answer: string;
  accepts: string[];
  explanation: string;
  trick: Trick;
  missingIcons: string[];
}

const PIECE_KINDS = ["icon", "word", "stack", "op"];
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

const readPiece = (raw: unknown): Piece | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (!PIECE_KINDS.includes(p.kind as string)) return null;
  if (p.kind === "icon") {
    const id = text(p.id, 64);
    const name = text(p.name, 40) || drawingName(id);
    return id ? { kind: "icon", id, name, ...(p.scale === "big" || p.scale === "small" ? { scale: p.scale } : {}) } : null;
  }
  if (p.kind === "word") return text(p.text, 40) ? { kind: "word", text: text(p.text, 40), ...(["cut", "small", "big", "upside-down"].includes(p.style as string) ? { style: p.style as "cut" } : {}) } : null;
  if (p.kind === "stack") return text(p.top, 40) && text(p.bottom, 40) ? { kind: "stack", top: text(p.top, 40), bottom: text(p.bottom, 40) } : null;
  return p.op === "+" || p.op === "&" || p.op === "-" ? { kind: "op", op: p.op } : null;
};

/** Candidates from the model's reply: malformed items are dropped, the rest shaped into puzzles to be checked. */
export const parseCandidates = (reply: string): Candidate[] => {
  const raw = extractJson(reply);
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { puzzles?: unknown })?.puzzles) ? (raw as { puzzles: unknown[] }).puzzles : [];
  const out: Candidate[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const x = item as Record<string, unknown>;
    const pieces = Array.isArray(x.pieces) ? x.pieces.map(readPiece).filter((p): p is Piece => p !== null) : [];
    const answer = text(x.answer, 80);
    if (pieces.length === 0 || !answer) continue;
    out.push({
      pieces,
      answer,
      accepts: Array.isArray(x.accepts) ? x.accepts.map((a) => text(a, 80)).filter(Boolean).slice(0, 8) : [],
      explanation: text(x.explanation, 200),
      trick: (TRICKS as readonly string[]).includes(x.trick as string) ? (x.trick as Trick) : "compound",
      missingIcons: Array.isArray(x.missingIcons) ? x.missingIcons.map((m) => text(m, 40)).filter(Boolean).slice(0, 6) : [],
    });
  }
  return out;
};

/** A brief, checked: what a request must be before any model is paid. */
export const readBrief = (raw: unknown): Brief | string => {
  if (typeof raw !== "object" || raw === null) return "Send a brief.";
  const b = raw as Record<string, unknown>;
  if (typeof b.category !== "string" || !categories().some((c) => c.id === b.category)) return "Pick a category.";
  if (!isAgeRange(b.ages)) return "Pick the ages this is for.";
  if (![1, 2, 3].includes(b.difficulty as number)) return "Pick a difficulty.";
  const count = Math.round(Number(b.count));
  if (!Number.isFinite(count) || count < 1 || count > MAX_COUNT) return `Ask for 1 to ${MAX_COUNT} puzzles at a time.`;
  const tricks = Array.isArray(b.tricks) ? b.tricks.filter((t): t is Trick => (TRICKS as readonly unknown[]).includes(t)) : [];
  return { category: b.category, ages: [b.ages[0], b.ages[1]], difficulty: b.difficulty as Difficulty, count, tricks, notes: text(b.notes, 300) };
};
