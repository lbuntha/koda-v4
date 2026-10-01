import type { Passage } from "../../data/passage";

/** A book being written: a passage before it has a revision. */
export type Draft = Omit<Passage, "rev">;

export const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
export const label = "mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted";
