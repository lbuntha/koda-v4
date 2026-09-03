/** Fixed semantic colour roles shared by all Subtraction engines. */

export interface Role {
  solid: string;
  soft: string;
  text: string;
  border: string;
  label: string;
}

/** The quantity present before anything is removed. */
export const WHOLE: Role = {
  solid: "bg-violet-500 shadow-violet-500/40",
  soft: "bg-violet-500/12",
  text: "text-violet-600 dark:text-violet-400",
  border: "border-violet-400",
  label: "purple",
};

/** The part taken away or the unit currently being exchanged. */
export const REMOVED_PART: Role = {
  solid: "bg-rose-500 shadow-rose-500/40",
  soft: "bg-rose-500/12",
  text: "text-rose-600 dark:text-rose-400",
  border: "border-rose-400",
  label: "pink",
};

/** The result left behind, or the measured difference between two endpoints. */
export const DIFFERENCE: Role = {
  solid: "bg-emerald-500 shadow-emerald-500/40",
  soft: "bg-emerald-500/12",
  text: "text-emerald-700 dark:text-emerald-400",
  border: "border-emerald-400",
  label: "green",
};

/** The second original group in a comparison, where nothing is removed. */
export const COMPARISON: Role = {
  solid: "bg-sky-500 shadow-sky-500/40",
  soft: "bg-sky-500/12",
  text: "text-sky-700 dark:text-sky-400",
  border: "border-sky-400",
  label: "blue",
};

export const NEUTRAL: Role = {
  solid: "bg-slate-400",
  soft: "bg-surface",
  text: "text-ink",
  border: "border-line",
  label: "grey",
};
