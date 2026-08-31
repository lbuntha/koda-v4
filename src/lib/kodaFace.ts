/**
 * Koda's face, as data.
 *
 * The app already dresses every account in DiceBear's **thumbs** style
 * (`lib/avatar.ts`), so a character drawn any other way would be a second,
 * parallel kind of face — drifting from the one the rest of Koda uses and
 * impossible to reseed from a screen. Characters use the same style, and this
 * file is the piece that makes a still avatar *behave*.
 *
 * Three ideas, in order:
 *
 * 1. **An expression is an object.** `{ eyes, mouth }`, named for what it means
 *    rather than for the variant numbers underneath. Nothing outside this file
 *    ever writes `variant5W16`, so re-picking what "surprised" looks like is a
 *    one-line edit here and lands everywhere at once.
 * 2. **A state is a loop of expressions.** Talking is two mouth shapes
 *    alternating; blinking is one frame of closed eyes every few seconds. That
 *    is how 2D character animation has always worked, and it is why the mouth
 *    genuinely opens and closes rather than pulsing in scale.
 * 3. **Faces are generated locally and cached.** `@dicebear/core` renders to a
 *    data URI in-process — no request per frame, no `api.dicebear.com` between
 *    a child and their teacher, and it keeps working on a tablet with no
 *    network. Every frame of every state is built once and reused.
 */

import { createAvatar, type Style } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";

/**
 * Thumbs' own option types, pulled out of the style rather than retyped.
 *
 * This is what makes the expression table below safe: `variant5W17` is a
 * compile error, not an avatar that silently renders without eyes. The variant
 * names are the library's and they are not guessable, so borrowing its types is
 * the only way to write them down once and be sure.
 */
type ThumbsOptions = typeof thumbs extends Style<infer O> ? O : never;
type EyesVariant = NonNullable<ThumbsOptions["eyes"]>[number];
type MouthVariant = NonNullable<ThumbsOptions["mouth"]>[number];

/** The five states the app actually has. See `KodaMascot`. */
/**
 * Which way the drawn face looks, before anything mirrors it.
 *
 * **Left.** The eyes and the smile sit in the upper-left of the head and the
 * squared-off back of the skull is bottom-right, so the character is looking to
 * its own left as drawn.
 *
 * Stated here because it cannot be read from any markup — the face is generated
 * by DiceBear, so the only way to know is to render it and look. `KodaBuddy`
 * carried a comment claiming the opposite for months, and every caller that
 * trusted it put Koda facing away from whatever it was meant to be looking at.
 * If the artwork is ever swapped, change this one constant and every caller
 * follows.
 */
export const FACE_LOOKS: "left" | "right" = "left";

export type MascotState = "idle" | "listening" | "speaking" | "thinking" | "celebrating";

/**
 * One face, named for what it means.
 *
 * The variant names are thumbs' own (`W16` is the eye width). Which one reads
 * as "eyes closed" was decided by looking at the geometry each generates, not
 * by their numbering — `variant2` is a shallow arc, which is a shut happy eye;
 * `variant6` is a tall oval, which is a wide open one.
 */
export interface KodaExpression {
  eyes: EyesVariant;
  mouth: MouthVariant;
}

export const EXPRESSIONS = {
  /** Eyes open, easy smile. The resting face. */
  neutral: { eyes: "variant5W16", mouth: "variant4" },
  /**
   * One frame of a blink.
   *
   * Shares `neutral`'s mouth on purpose: a blink is the eyes closing and
   * nothing else, and a mouth that changed on the same frame would read as a
   * flinch.
   */
  blink: { eyes: "variant2W16", mouth: "variant4" },
  /** Wide open. Somebody is talking to them. */
  surprised: { eyes: "variant6W16", mouth: "variant4" },
  /** Looking away, mouth unsure. Working something out. */
  pondering: { eyes: "variant1W16", mouth: "variant5" },
  /**
   * Mouth nearly shut — the closed half of a talking cycle.
   *
   * A narrower shape than `neutral`, not the same one: if the closed half of
   * speech were the resting face, talking would look like a mouth appearing and
   * disappearing rather than opening and closing.
   */
  talkClosed: { eyes: "variant5W16", mouth: "variant3" },
  /** Mouth open — the open half. */
  talkOpen: { eyes: "variant5W16", mouth: "variant1" },
  /** Mouth wide. The stressed syllable, and the shout of a celebration. */
  talkWide: { eyes: "variant5W16", mouth: "variant2" },
  /** Eyes shut, mouth wide. Delight. */
  delighted: { eyes: "variant2W16", mouth: "variant2" },
} satisfies Record<string, KodaExpression>;

export type ExpressionName = keyof typeof EXPRESSIONS;

/**
 * What each state does over time.
 *
 * `frames` is a loop and `ms` is how long each frame holds. Two numbers rather
 * than a timeline because that is all a face needs, and because a cycle that
 * can be read in one line is a cycle somebody can retune without a rehearsal.
 *
 * The speeds are the point of difference: a mouth at 130ms reads as speech, the
 * same mouth at 400ms reads as chewing. Blinks are rare and brief — a face that
 * blinks on a metronome reads as a machine, which is why idle holds its open
 * frame for four seconds and shuts for one tenth of that.
 */
export interface StateAnimation {
  frames: ExpressionName[];
  /** Milliseconds per frame, one per entry in `frames`. */
  ms: number[];
}

export const STATE_ANIMATION: Record<MascotState, StateAnimation> = {
  idle: { frames: ["neutral", "blink"], ms: [4200, 140] },
  // Wide eyes, and a blink so it is alive rather than staring.
  listening: { frames: ["surprised", "surprised", "blink"], ms: [2600, 2600, 130] },
  // The talking cycle. Uneven on purpose: three equal frames read as a machine
  // opening and shutting, while open-wide-closed reads as syllables.
  speaking: {
    frames: ["talkOpen", "talkWide", "talkClosed", "talkOpen", "talkClosed"],
    ms: [150, 190, 120, 160, 140],
  },
  thinking: { frames: ["pondering", "pondering", "blink"], ms: [2400, 1800, 150] },
  celebrating: { frames: ["delighted", "talkWide"], ms: [420, 300] },
};

/**
 * The expression a state is wearing on a given frame.
 *
 * Looked up through here rather than by indexing twice at the call site, because
 * the frame index outlives the state it was counted for. The states have
 * different frame counts — speaking has five, idle has two — and the index lives
 * in React state while the state prop changes in a render *before* the effect
 * that resets it. So a character that stops speaking renders once as "idle,
 * frame 4", `frames[4]` is undefined, and `EXPRESSIONS[undefined]` is undefined:
 * the mascot then took the whole tree down with
 * `Cannot read properties of undefined (reading 'eyes')`.
 *
 * Wrapping rather than clamping, so a stale index still lands on a real frame of
 * the new animation. And a face is decoration — nothing it does may throw, so an
 * unknown state or a mouth nobody defined falls back to a neutral face instead
 * of crashing the page it was drawn on.
 */
export function expressionFor(state: MascotState, frame: number): KodaExpression {
  const animation = STATE_ANIMATION[state] ?? STATE_ANIMATION.idle;
  const names = animation.frames;
  const index = Number.isFinite(frame) ? ((frame % names.length) + names.length) % names.length : 0;
  return EXPRESSIONS[names[index]] ?? EXPRESSIONS.neutral;
}

/** One named expression, or a neutral face when the name is not one. */
export function expressionNamed(name: string): KodaExpression {
  return EXPRESSIONS[name as ExpressionName] ?? EXPRESSIONS.neutral;
}

/**
 * One rendered face, as a data URI.
 *
 * Cached by every input that changes the picture. A talking character cycles
 * five frames forever; without this it would re-render the SVG sixty times a
 * second and re-parse it as an image each time.
 */
const cache = new Map<string, string>();

/**
 * One rendered face, on nothing.
 *
 * **The background is transparent and the head carries the colour.** It was the
 * other way round at first — a coloured tile with a seeded head on it — which
 * boxed the character into a square that fought every surface it sat on: a card,
 * a dark voice modal, a page. A cut-out head sits on all of them, and it moves
 * the character's identity onto the character rather than onto its packaging.
 *
 * `shapeColor` is the head. Passed explicitly rather than left to the seed, so
 * a teacher's colour matches the tint on their roster card instead of being
 * whatever DiceBear picked from their name.
 */
export function kodaFace(seed: string, expression: KodaExpression, shapeColor: string): string {
  const key = `${seed}|${expression.eyes}|${expression.mouth}|${shapeColor}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const uri = createAvatar(thumbs, {
    seed,
    // Hex without the `#`: thumbs validates against `^(transparent|[a-fA-F0-9]{6})$`.
    shapeColor: [shapeColor.replace("#", "")],
    backgroundColor: ["transparent"],
    scale: 100,
    eyes: [expression.eyes],
    mouth: [expression.mouth],
  }).toDataUri();

  cache.set(key, uri);
  return uri;
}

/**
 * Every frame a state will ever need, rendered ahead of time.
 *
 * Called when a mascot mounts, so the first blink is not the first time the
 * browser has seen that image — a face that pops on its opening frame undoes
 * the whole effect.
 */
export function warmFaces(seed: string, shapeColor: string): void {
  for (const animation of Object.values(STATE_ANIMATION)) {
    for (const frame of animation.frames) kodaFace(seed, EXPRESSIONS[frame], shapeColor);
  }
}
