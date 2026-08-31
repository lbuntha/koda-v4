/**
 * What each colour means in this skill.
 *
 * Addition is two things becoming one thing, and a child has to be able to see
 * which is which — in a ten-frame, on a number line, in a bond diagram and in a
 * column, all in the same lesson sequence. So colour here is a *role*, fixed
 * across all twelve engines: the first addend is always violet and the second
 * is always sky, so "the sky ones are the ones I added" survives the move from
 * frames to blocks to bars.
 *
 * No amber and no yellow anywhere. They fail against this app's light surface,
 * and a strategy the child cannot read is not a strategy.
 *
 * Colour is never the only carrier of a state — that rule is in
 * `docs/PLUGINS.md` and it applies here: a held block has a ring and a lift as
 * well as a tint, and a wrong answer says so in words.
 */

export interface Role {
  /** Filled: the object itself. */
  solid: string;
  /** Tinted: a well the object sits in. */
  soft: string;
  /** The role's colour as text. */
  text: string;
  border: string;
  /** What to call it out loud and in a hint. */
  label: string;
}

export const ADDEND_A: Role = {
  solid: "bg-violet-500 shadow-violet-500/40",
  soft: "bg-violet-500/12",
  text: "text-violet-600 dark:text-violet-400",
  border: "border-violet-400",
  label: "purple",
};

export const ADDEND_B: Role = {
  solid: "bg-sky-500 shadow-sky-500/40",
  soft: "bg-sky-500/12",
  text: "text-sky-700 dark:text-sky-400",
  border: "border-sky-400",
  label: "blue",
};

/** The answer, wherever it is being built up. */
export const TOTAL: Role = {
  solid: "bg-emerald-500 shadow-emerald-500/40",
  soft: "bg-emerald-500/12",
  text: "text-emerald-700 dark:text-emerald-400",
  border: "border-emerald-400",
  label: "green",
};

/**
 * The part being moved, traded or given back.
 *
 * Compensation, bundling ten ones and breaking an addend all have one piece in
 * motion while everything else holds still. That piece is rose in every one of
 * them, so the move reads the same way each time a child meets it.
 */
export const CHANGE: Role = {
  solid: "bg-rose-500 shadow-rose-500/40",
  soft: "bg-rose-500/12",
  text: "text-rose-600 dark:text-rose-400",
  border: "border-rose-400",
  label: "pink",
};

/** Neither addend nor answer: a number path's ticks, an untouched block. */
export const NEUTRAL: Role = {
  solid: "bg-slate-400",
  soft: "bg-surface",
  text: "text-ink",
  border: "border-line",
  label: "grey",
};

/** The two addends, in order, for anything that draws both. */
export const ADDENDS: readonly [Role, Role] = [ADDEND_A, ADDEND_B];
