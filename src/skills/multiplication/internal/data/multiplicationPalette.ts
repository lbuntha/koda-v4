/**
 * Fixed semantic colour roles shared by every Multiplication engine.
 *
 * The two factors are deliberately different colours everywhere in the skill.
 * A child who has just been told that 4 baskets of 6 and 6 baskets of 4 both
 * total 24 needs to be able to see which number is which, in the array, in the
 * story bar, and in the written method — commutativity is only surprising if
 * the two roles were visibly distinct in the first place.
 *
 * No amber or yellow: it is the one family this project does not use.
 */

export interface Role {
  solid: string;
  soft: string;
  text: string;
  border: string;
  label: string;
}

/** How many groups there are — the first factor, and an array's rows. */
export const GROUPS: Role = {
  solid: "bg-violet-500 shadow-violet-500/40",
  soft: "bg-violet-500/12",
  text: "text-violet-700 dark:text-violet-400",
  border: "border-violet-400",
  label: "purple",
};

/** How many are in each group — the second factor, and an array's columns. */
export const EACH: Role = {
  solid: "bg-sky-500 shadow-sky-500/40",
  soft: "bg-sky-500/12",
  text: "text-sky-700 dark:text-sky-400",
  border: "border-sky-400",
  label: "blue",
};

/** The product: the total, the array's fill, the area of the whole rectangle. */
export const PRODUCT: Role = {
  solid: "bg-emerald-500 shadow-emerald-500/40",
  soft: "bg-emerald-500/12",
  text: "text-emerald-700 dark:text-emerald-400",
  border: "border-emerald-400",
  label: "green",
};

/**
 * The adjustment in a derived fact.
 *
 * The one group added to get from 5 × 8 to 6 × 8, the one given back to get
 * from 10 × n to 9 × n, and the second piece of a split array. Always the part
 * that moves, never the part already known.
 */
export const ADJUSTMENT: Role = {
  solid: "bg-rose-500 shadow-rose-500/40",
  soft: "bg-rose-500/12",
  text: "text-rose-700 dark:text-rose-400",
  border: "border-rose-400",
  label: "pink",
};

export const NEUTRAL: Role = {
  solid: "bg-slate-400",
  soft: "bg-surface",
  text: "text-ink",
  border: "border-line",
  label: "grey",
};

/** The helper fact's own colouring: known, settled, not the thing being worked out. */
export const HELPER: Role = EACH;
