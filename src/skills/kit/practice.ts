/**
 * Practice: the same engines, with the scaffolding taken away.
 *
 * In `kit/` rather than in a skill, because every skill wants it and no skill
 * may import another. Addition built it; counting uses the same three lines.
 *
 * A lesson teaches one technique with everything switched on — the question
 * read aloud, a hint ladder three rungs deep, and feedback that explains what
 * happened. Practice is what comes after that: the same manipulative, several
 * techniques mixed together, and nothing to lean on. No hints, no explanation,
 * no voice.
 *
 * That is not a smaller lesson. Retrieving something unaided is a different act
 * from being walked through it, and it is the one that makes a technique stick.
 * The help is removed on purpose, and it is removed *completely* — a speaker
 * button that does nothing, or a hint button with nothing behind it, would
 * teach a child that the app's controls are decorative.
 */

export interface PracticeSetup {
  /** Turns the scaffolding off. Set by a practice lesson, never by a teaching one. */
  practice?: boolean;
  /**
   * The modes to work through, in order.
   *
   * Cycled rather than sampled, so a run of ten questions over four modes
   * covers all four — random selection would leave a child who drew badly
   * practising one technique ten times and calling it mixed practice.
   */
  modes?: string[];
}

export const isPractice = (setup: PracticeSetup): boolean => Boolean(setup.practice);

/**
 * Which mode question `index` uses. 1-based, as the round counts.
 *
 * A teaching lesson names one `mode` and gets it every time. A practice lesson
 * names `modes` and gets them in turn.
 */
export const modeAt = <M extends string>(
  setup: PracticeSetup & { mode?: M },
  index: number,
  fallback: M,
): M => {
  const cycle = setup.modes as M[] | undefined;
  if (cycle && cycle.length > 0) return cycle[(index - 1) % cycle.length];
  return setup.mode ?? fallback;
};

/**
 * What a round is allowed to say, given whether it is practice.
 *
 * Returned as a function rather than a boolean so a call site cannot forget the
 * check: there is one way to speak, and in practice it does nothing.
 */
export const quietWhenPractising = (
  say: (text: string) => void,
  practising: boolean,
): ((text: string) => void) => (practising ? () => {} : say);

/**
 * The same name with the word "Practice" taken off the front.
 *
 * Practice lessons are titled "Practice: Number Bonds" and their concept line
 * reads "Practice Without Help", because in a flat list of sixty lessons that
 * word is the only thing telling them apart from the lesson that *teaches*
 * number bonds. Inside a round it is neither: the screen is already practice,
 * so the bar was saying it twice — once in the title and once underneath — and
 * both times about the half that carries no information.
 *
 * The separator is optional so both forms are covered, but a word boundary is
 * required: "Practising Bonds" is a title, not a prefix, and must survive
 * whole. A name that is *only* the word is returned untouched rather than
 * blanked — an empty title is a worse bug than a repeated one.
 */
export const withoutPracticeLabel = (name: string): string => {
  const stripped = name.replace(/^practice(?:\s*[:.\-–—]\s*|\s+)/i, "").trim();
  return stripped || name;
};
