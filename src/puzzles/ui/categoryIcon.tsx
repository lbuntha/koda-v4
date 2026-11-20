import React from "react";
import { Apple, Briefcase, Bus, Clock, Hand, Hash, House, Leaf, MapPin, Palette, PawPrint, Rocket, School, Shirt, Smile, Trophy, Users } from "lucide-react";
import type { PuzzleCategory } from "../types";

/** A picture for each clue category, so a child who cannot read the clue yet still has one. */
const ICONS: Record<PuzzleCategory, React.ComponentType<{ className?: string }>> = {
  animal: PawPrint,
  food: Apple,
  home: House,
  nature: Leaf,
  body: Hand,
  travel: Bus,
  school: School,
  family: Users,
  colour: Palette,
  number: Hash,
  time: Clock,
  action: Rocket,
  clothes: Shirt,
  job: Briefcase,
  place: MapPin,
  sport: Trophy,
  feeling: Smile,
};

export const CategoryIcon: React.FC<{ category: PuzzleCategory; className?: string }> = ({ category, className = "h-6 w-6" }) => {
  const Icon = ICONS[category] ?? Leaf;
  return <Icon className={className} aria-hidden />;
};
