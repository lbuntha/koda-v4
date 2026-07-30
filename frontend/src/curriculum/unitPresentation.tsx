import { BookOpen, Brain, CloudSun, Hash, Leaf, PawPrint, Puzzle, Shapes, Sparkles, type LucideIcon } from "lucide-react";
import type { UnitAccent, UnitIcon } from "./types";

export const UNIT_ICON_CHOICES: Array<{ value: UnitIcon; label: string; icon: LucideIcon }> = [
  { value: "hash", label: "Numbers", icon: Hash },
  { value: "brain", label: "Thinking", icon: Brain },
  { value: "shapes", label: "Shapes", icon: Shapes },
  { value: "puzzle", label: "Puzzle", icon: Puzzle },
  { value: "sparkles", label: "Discovery", icon: Sparkles },
  { value: "book", label: "Book", icon: BookOpen },
  { value: "leaf", label: "Nature", icon: Leaf },
  { value: "paw", label: "Animals", icon: PawPrint },
  { value: "weather", label: "Weather", icon: CloudSun },
];

export const UNIT_ACCENT_CHOICES: Array<{ value: UnitAccent; label: string }> = [
  { value: "purple", label: "Purple" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "pink", label: "Pink" },
];

const ICONS = Object.fromEntries(UNIT_ICON_CHOICES.map(choice => [choice.value, choice.icon])) as Record<UnitIcon, LucideIcon>;

const FALLBACKS: Array<{ icon: UnitIcon; accent: UnitAccent }> = [
  { icon: "hash", accent: "green" },
  { icon: "brain", accent: "purple" },
  { icon: "shapes", accent: "pink" },
  { icon: "puzzle", accent: "blue" },
  { icon: "sparkles", accent: "amber" },
  { icon: "book", accent: "purple" },
  { icon: "leaf", accent: "green" },
  { icon: "paw", accent: "blue" },
  { icon: "weather", accent: "amber" },
];

/** Stable for a unit id: filtering or reordering never changes an unauthored fallback. */
export const defaultUnitPresentation = (seed: string): { icon: UnitIcon; accent: UnitAccent } => {
  const hash = Array.from(seed).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
  return FALLBACKS[hash % FALLBACKS.length];
};

export const unitIcon = (value?: UnitIcon, fallbackSeed = ""): LucideIcon =>
  ICONS[value ?? defaultUnitPresentation(fallbackSeed).icon] ?? BookOpen;

export const UNIT_ACCENT_TONES: Record<UnitAccent, string> = {
  purple: "bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300",
  blue: "bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300",
  green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  pink: "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
};

export const unitAccentTone = (value?: UnitAccent, fallbackSeed = ""): string =>
  UNIT_ACCENT_TONES[value ?? defaultUnitPresentation(fallbackSeed).accent];
