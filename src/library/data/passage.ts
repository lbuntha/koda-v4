/**
 * The shape of a story.
 *
 * One document that the reader, the quiz, the spelling ring and the Content
 * Studio all agree on. It is deliberately flat and plain JSON: it is published
 * at runtime, synced to devices and played offline, so it cannot contain
 * anything that needs code to interpret.
 *
 * Three ideas hold it together:
 *
 *  1. **A question always says where its answer lives.** A comprehension
 *     question carries an `evidence` sentence id. That single field is what
 *     lets a check prove the answer is in the story, lets a hint open the story
 *     with the right sentence marked, and lets a parent's summary say what was
 *     missed.
 *  2. **Words are stored, not re-derived.** Every sentence keeps the split an
 *     admin approved. Khmer has no spaces, and a segmenter only proposes a
 *     split, so re-deriving it on a child's device would change a story after
 *     it was approved.
 *  3. **Nothing in here is a lesson.** A passage is content published at
 *     runtime; lessons are bundled and ordered. A passage can never reorder,
 *     unlock or break a course.
 */

export type Language = "en" | "km";

/** Two age bands are built for release 1. Band C (11+) needs typed spelling. */
export type Band = "A" | "B";

export interface BandSpec {
  /** The requested maximum per section; publication accepts 85% or more. */
  understand: number;
  words: number;
  spell: number;
  /** Matching sets wanted. Absent leaves matching optional, as books saved before it were. */
  match?: number;
  ages: readonly [number, number];
}

/**
 * The per-book question targets. Any section may be 0 — a book can skip one.
 * `match` is the number of matching sets wanted (0–MATCH_MAX_QUESTIONS);
 * absent on books saved before it existed, which leaves matching optional.
 */
export type QuestionCounts = Pick<BandSpec, "understand" | "words" | "spell" | "match">;

/** The range an author may set each target to. */
export const TARGET_MAX = 10;

export const BANDS: Readonly<Record<Band, BandSpec>> = {
  A: { understand: 10, words: 10, spell: 10, ages: [5, 7] },
  B: { understand: 10, words: 10, spell: 10, ages: [8, 10] },
};

/** Publication accepts at least 85% of the requested questions, rounded up. */
export const QUESTION_MINIMUM_RATIO = 0.85;
export const minimumQuestions = (requested: number): number => Math.ceil(requested * QUESTION_MINIMUM_RATIO);
/** One section is ready: at least 85% of its target and never over it. A target of 0 wants none. */
export const meetsTarget = (have: number, want: number): boolean => have >= minimumQuestions(want) && have <= want;

/** A word must be 2–8 tiles: a ninth tile does not fit a 360px ring. */
export const MIN_TILES = 2;
export const MAX_TILES = 8;
/** Tiles plus distractors on the ring never exceed this. */
export const RING_MAX = 8;
/** Choices on a comprehension or picture question. */
export const CHOICES = 3;

/** A word's spoken interval inside its sentence recording. */
export interface WordCue {
  startMs: number;
  endMs: number;
}

export interface Sentence {
  id: string;
  /** The sentence as a person reads it. Always equals `words` joined. */
  text: string;
  /** The approved split. Punctuation stays attached to its word. */
  words: string[];
  /**
   * A recording of this sentence: the id of an uploaded clip (the SHA-256 of its
   * normalized M4A bytes). Optional — pages with any missing recording do not
   * show the page-level read button.
   */
  audio?: string;
  /** One cue per approved `words` entry, generated from the finished audio. */
  audioCues?: WordCue[];
  /**
   * The illustration for the page this sentence is on, chosen by the author: a
   * picture key, or null for "no picture on this page". Absent means automatic —
   * the picture of the first pictured word on the page. The Studio writes it on
   * a page's first sentence, so a picture stays with its words if pages reflow.
   */
  picture?: string | null;
  /** Where that picture sits on its page. Absent means top. Written beside `picture`. */
  pictureAt?: PicturePlace;
}

export type PicturePlace = "top" | "bottom" | "left" | "right";
export const PICTURE_PLACES: readonly PicturePlace[] = ["top", "bottom", "left", "right"];

/** "Where did they walk?" — a choice, with the sentence that proves it. */
export interface ComprehensionQuestion {
  id: string;
  kind: "comprehension";
  prompt: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  /** The id of the sentence the answer comes from. */
  evidence: string;
}

/** "Which picture is 'banana'?" — options are picture keys. */
export interface VocabQuestion {
  id: string;
  kind: "vocab";
  prompt: string;
  word: string;
  options: string[];
  answer: number;
}

/** The story sentence with one word missing, to be spelled on the ring. */
export interface SpellQuestion {
  id: string;
  kind: "spell";
  /** The id of the sentence the word is taken from. */
  sentence: string;
  word: string;
}

/** One pair a child joins: a question (or word) on the left, its answer on the right. */
export interface MatchPair {
  left: string;
  right: string;
  /** The sentence the answer comes from. Absent: the answer only has to be somewhere in the story. */
  evidence?: string;
}

/**
 * "Match each question to its answer" — an optional extra part. A book may have
 * none at all; when it has some, each is checked as fully as any other part.
 * The reader shuffles the right-hand side.
 */
export interface MatchQuestion {
  id: string;
  kind: "match";
  prompt: string;
  pairs: MatchPair[];
}

/** Pairs in one matching question: fewer is a guess, more does not fit a phone. */
export const MATCH_MIN_PAIRS = 3;
export const MATCH_MAX_PAIRS = 5;
/** Matching questions in one book. Optional, so there is no minimum. */
export const MATCH_MAX_QUESTIONS = 5;

export type Question = ComprehensionQuestion | VocabQuestion | SpellQuestion | MatchQuestion;
/** The question kinds that are answered by picking one of three choices. */
export type ChoiceQuestion = ComprehensionQuestion | VocabQuestion;
export const isChoice = (q: Question): q is ChoiceQuestion => q.kind === "comprehension" || q.kind === "vocab";

export interface Passage {
  id: string;
  /** Bumped on every publish. A child mid-quiz finishes on the revision they started. */
  rev: number;
  language: Language;
  band: Band;
  /** Per-book question target chosen before generation. */
  questionCounts?: QuestionCounts;
  title: string;
  /** The shelf it sits on in the catalog. */
  category?: string;
  /** A key into the picture library. Used for the cover. */
  picture: string;
  sentences: Sentence[];
  questions: Question[];
  /**
   * Story word → picture key. This is the *only* source of "which picture is
   * this word", so a picture question can be checked without a library.
   */
  pictures: Record<string, string>;
  /**
   * Word → the picture a person looked at and agreed shows it. A picture not
   * named for its word passes the check only while it is still this one.
   */
  confirmedPictures?: Record<string, string>;
  /** Optional recordings of single words, word → clip id, for tap-a-word. */
  wordAudio?: Record<string, string>;
  /** Words with no recording, so tapping one shows text and no dead speaker. */
  noRecording?: string[];
  /** Where the text came from — a person reading a draft should know. */
  provenance?: string;
  learningTakeaway?: string;
  /** What finishing the book pays at three stars; the app's XP per level when absent. */
  xp?: number | null;
}
