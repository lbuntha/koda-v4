import {
  BatteryCharging,
  Boxes,
  CircleDot,
  CircleHelp,
  Crown,
  Dices,
  Footprints,
  Gem,
  Layers,
  type LucideIcon,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Star,
  Waves,
  Zap,
} from "lucide-react";

/**
 * Name -> icon map for lesson metadata, mirroring `sidebarIcons`.
 *
 * A lesson's icon is curriculum metadata, so it lives in the skill's
 * `lessons.json` and is resolved here. Before this, the level picker had a
 * hardcoded `switch (levelNumber)` inside the counting component while the
 * Skill Manager rendered an emoji from the same lesson — two pickers, two
 * answers, and no way for a second skill to have icons at all.
 *
 * Icons are imported explicitly so the bundler can drop the ~1500 lucide icons
 * we do not use. Adding an icon to a lesson means adding one line here.
 */
export const lessonIcons = {
  battery: BatteryCharging,
  boxes: Boxes,
  circleDot: CircleDot,
  crown: Crown,
  dice: Dices,
  footprints: Footprints,
  gem: Gem,
  layers: Layers,
  rocket: Rocket,
  scale: Scale,
  search: Search,
  sparkles: Sparkles,
  star: Star,
  waves: Waves,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type LessonIconName = keyof typeof lessonIcons;

/** A typo in lesson data should be visible in the UI, not a crash or a blank. */
export const resolveLessonIcon = (name?: string): LucideIcon =>
  (name && lessonIcons[name as LessonIconName]) || CircleHelp;

/**
 * The tints a lesson icon may carry.
 *
 * A closed set, not free-form colour: every entry is already checked against
 * both grounds, so lesson data cannot introduce a swatch that disappears in
 * dark mode or fails contrast in light. Tone is decoration — the lesson title
 * always carries the meaning — so nothing is lost by a reader who can't
 * distinguish them.
 */
export const lessonIconTones = {
  amber: "text-slate-800 dark:text-amber-400",
  cyan: "text-cyan-700 dark:text-cyan-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  purple: "text-purple-600 dark:text-purple-400",
  pink: "text-pink-600 dark:text-pink-400",
  emerald: "text-emerald-700 dark:text-emerald-400",
} as const;

export type LessonIconTone = keyof typeof lessonIconTones;

export const resolveLessonIconTone = (tone?: string): string =>
  lessonIconTones[tone as LessonIconTone] ?? lessonIconTones.indigo;
