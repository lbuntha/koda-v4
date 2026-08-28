import { skillArtId } from "../../../../assets/svg/skillArt";

/**
 * Counting's visual palette: the objects and colour pairs its activities draw
 * with. Curriculum lives in lessons.json; this file is only how it looks.
 */
export interface PredefinedAsset {
  id: string;
  /** Plural, for prompts: "Touch each rocket." */
  name: string;
  /** Tint for the counted state. The artwork supplies its own colours. */
  tone: string;
  bgColor: string;
  category: "objects" | "nature" | "space" | "creatures";
}

/**
 * The eight countable objects, drawn from this skill's own `assets/` folder.
 *
 * These were emoji, and emoji are wrong for counting specifically. Their
 * optical weight varies — seven butterflies read as a denser set than seven
 * stars — and perceived density is the confound a one-to-one or subitizing
 * task is trying to hold still. They also render differently per platform
 * font, so two children on different tablets were not seeing the same
 * question.
 *
 * The eight are chosen so no two share a silhouette class: tall, wide,
 * horizontal, radial, organic, blocky, thin, peaked. A round that offered two
 * round objects side by side in `compare` mode would be a discrimination task
 * rather than a counting one.
 */
const art = (name: string) => skillArtId("counting", name);

export const PREDEFINED_ASSETS: PredefinedAsset[] = [
  { id: art("rocket"), name: "Rockets", tone: "text-rose-500", bgColor: "bg-rose-500/15", category: "space" },
  { id: art("butterfly"), name: "Butterflies", tone: "text-indigo-500", bgColor: "bg-indigo-500/15", category: "creatures" },
  { id: art("fish"), name: "Fish", tone: "text-orange-500", bgColor: "bg-orange-500/15", category: "creatures" },
  { id: art("sun"), name: "Suns", tone: "text-amber-500", bgColor: "bg-amber-500/15", category: "nature" },
  { id: art("leaf"), name: "Leaves", tone: "text-emerald-500", bgColor: "bg-emerald-500/15", category: "nature" },
  { id: art("gift"), name: "Gifts", tone: "text-teal-500", bgColor: "bg-teal-500/15", category: "objects" },
  { id: art("pencil"), name: "Pencils", tone: "text-yellow-600", bgColor: "bg-yellow-500/15", category: "objects" },
  { id: art("crown"), name: "Crowns", tone: "text-amber-600", bgColor: "bg-amber-600/15", category: "objects" },
];

export interface DualColorPair {
  name: string;
  colorA: string;
  colorB: string;
  labelA: string;
  labelB: string;
}

export const DUAL_COLOR_PAIRS: DualColorPair[] = [
  { name: "Blue & Yellow", colorA: "bg-cyan-400 shadow-cyan-400/60", colorB: "bg-amber-400 shadow-amber-400/60", labelA: "Blue Dots", labelB: "Yellow Dots" },
  { name: "Purple & Green", colorA: "bg-purple-400 shadow-purple-400/60", colorB: "bg-emerald-400 shadow-emerald-400/60", labelA: "Purple Dots", labelB: "Green Dots" },
  { name: "Red & Sky Blue", colorA: "bg-rose-400 shadow-rose-400/60", colorB: "bg-sky-400 shadow-sky-400/60", labelA: "Red Dots", labelB: "Sky Blue Dots" },
  { name: "Teal & Orange", colorA: "bg-teal-400 shadow-teal-400/60", colorB: "bg-orange-400 shadow-orange-400/60", labelA: "Teal Dots", labelB: "Orange Dots" },
];
