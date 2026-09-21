import { skillArtId } from "../../../../assets/svg/skillArt";

/**
 * Counting's visual palette: the objects and colour pairs its activities draw
 * with. Curriculum lives in lessons.json; this file is only how it looks.
 */
export interface PredefinedAsset {
  id: string;
  /** Plural, for prompts: "Touch each rocket." */
  name: string;
  category: "objects" | "nature" | "space" | "creatures";
}

/*
 * There is no `tone` or `bgColor` here any more.
 *
 * Both were carried on every asset and read by nothing: the artwork supplies
 * its own colours, and the counted state is drawn by dimming the object and
 * putting a numbered badge on it. What the dead fields did do was name three
 * yellows — `text-yellow-600` for the pencils, amber for the suns and crowns —
 * which is a colour this app does not use and which the next person to reach
 * for an asset tint would have copied.
 */

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
  { id: art("rocket"), name: "Rockets", category: "space" },
  { id: art("butterfly"), name: "Butterflies", category: "creatures" },
  { id: art("fish"), name: "Fish", category: "creatures" },
  { id: art("sun"), name: "Suns", category: "nature" },
  { id: art("leaf"), name: "Leaves", category: "nature" },
  { id: art("gift"), name: "Gifts", category: "objects" },
  { id: art("pencil"), name: "Pencils", category: "objects" },
  { id: art("crown"), name: "Crowns", category: "objects" },
];

export interface DualColorPair {
  name: string;
  colorA: string;
  colorB: string;
  labelA: string;
  labelB: string;
}

export const DUAL_COLOR_PAIRS: DualColorPair[] = [
  /* Pink rather than yellow. A yellow dot is the hardest colour on this scene
     to pick out, and telling two groups apart at a glance is the entire task
     here — a pair a child has to squint at is a pair that measures eyesight
     instead of subitizing. */
  { name: "Blue & Pink", colorA: "bg-cyan-400 shadow-cyan-400/60", colorB: "bg-pink-400 shadow-pink-400/60", labelA: "Blue Dots", labelB: "Pink Dots" },
  { name: "Purple & Green", colorA: "bg-purple-400 shadow-purple-400/60", colorB: "bg-emerald-400 shadow-emerald-400/60", labelA: "Purple Dots", labelB: "Green Dots" },
  { name: "Red & Sky Blue", colorA: "bg-rose-400 shadow-rose-400/60", colorB: "bg-sky-400 shadow-sky-400/60", labelA: "Red Dots", labelB: "Sky Blue Dots" },
  { name: "Teal & Orange", colorA: "bg-teal-400 shadow-teal-400/60", colorB: "bg-orange-400 shadow-orange-400/60", labelA: "Teal Dots", labelB: "Orange Dots" },
];
