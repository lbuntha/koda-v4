/**
 * Preset prompt templates for the AI Activity Generator.
 * Each technique's presets are wired into its ComponentSchema (`presets:`),
 * which is how the panel discovers them — never import these directly in UI.
 */

import { CountingTechnique } from "../../../types";
import { AiPreset } from "./types";

export const MOVE_AND_COUNT_PRESETS: AiPreset[] = [
  {
    id: "mc-fish-aquarium",
    label: "Fish → Aquarium",
    prompt: "Count 5 fish by moving them from the fish bowl into the big aquarium",
    emoji: "🐟",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "aquatic"
  },
  {
    id: "mc-rockets-launchpad",
    label: "Rockets → Launch Pad",
    prompt: "Move 4 rockets from the hangar onto the launch pad while counting",
    emoji: "🚀",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "space"
  },
  {
    id: "mc-bears-forest",
    label: "Bears → Forest",
    prompt: "Help 3 teddy bears walk from the toy shelf into the enchanted forest",
    emoji: "🧸",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "nature"
  },
  {
    id: "mc-apples-basket",
    label: "Apples → Basket",
    prompt: "Pick 6 apples from the tree and put them into the fruit basket",
    emoji: "🍎",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "kitchen"
  },
  {
    id: "mc-stars-sky",
    label: "Stars → Night Sky",
    prompt: "Place 7 stars from the star box into the night sky, counting each one",
    emoji: "⭐",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "space"
  },
  {
    id: "mc-cars-garage",
    label: "Cars → Garage",
    prompt: "Park 4 toy cars from the driveway into the garage",
    emoji: "🚗",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "vehicles"
  },
  {
    id: "mc-butterflies-garden",
    label: "Butterflies → Garden",
    prompt: "Guide 5 butterflies from the meadow into the flower garden",
    emoji: "🦋",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "nature"
  },
  {
    id: "mc-dinos-cave",
    label: "Dinos → Cave",
    prompt: "Move 3 baby dinosaurs from the valley into the cozy cave",
    emoji: "🦕",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "prehistoric"
  },
  {
    id: "mc-flowers-vase",
    label: "Flowers → Vase",
    prompt: "Arrange 8 flowers from the garden bed into a pretty vase",
    emoji: "🌸",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "nature"
  },
  {
    id: "mc-hearts-box",
    label: "Hearts → Gift Box",
    prompt: "Count 6 hearts and place them into the gift box one by one",
    emoji: "❤️",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "celebration"
  },
  {
    id: "mc-suns-horizon",
    label: "Suns → Horizon",
    prompt: "Move 2 suns from behind the clouds to the horizon while counting",
    emoji: "☀️",
    technique: CountingTechnique.MOVE_AND_COUNT,
    theme: "nature"
  }
];

export const ADDITION_TUTOR_PRESETS: AiPreset[] = [
  {
    id: "at-orchard-18-7",
    label: "Orchard Math (18 + 7)",
    prompt: "Create a guided addition tutorial for 18 apples and 7 apples to learn making ten",
    emoji: "🍎",
    technique: CountingTechnique.ADDITION_TUTOR,
    theme: "nature"
  },
  {
    id: "at-stars-25-8",
    label: "Star Count (25 + 8)",
    prompt: "A step-by-step addition tutor slide for 25 stars plus 8 stars",
    emoji: "⭐",
    technique: CountingTechnique.ADDITION_TUTOR,
    theme: "space"
  },
  {
    id: "at-bears-15-6",
    label: "Teddy Picnic (15 + 6)",
    prompt: "Guide Koda to add 15 brown bears and 6 teddy bears with base-10 blocks",
    emoji: "🧸",
    technique: CountingTechnique.ADDITION_TUTOR,
    theme: "nature"
  },
  {
    id: "at-ducks-7-5",
    label: "Pond Friends (7 + 5)",
    prompt: "A single-digit addition tutor for 7 ducks plus 5 ducks, teaching the make-ten strategy",
    emoji: "🦆",
    technique: CountingTechnique.ADDITION_TUTOR,
    theme: "nature"
  },
  {
    id: "at-rockets-46-38",
    label: "Rocket Fleet (46 + 38)",
    prompt: "A two-digit plus two-digit addition tutor for 46 rockets and 38 rockets with regrouping",
    emoji: "🚀",
    technique: CountingTechnique.ADDITION_TUTOR,
    theme: "space"
  },
  {
    id: "at-blocks-23-14",
    label: "Block Tower (23 + 14)",
    prompt: "A two-digit addition tutor for 23 plus 14 with no regrouping needed",
    emoji: "🧱",
    technique: CountingTechnique.ADDITION_TUTOR,
    theme: "nature"
  }
];

export const COLUMN_ADDITION_PRESETS: AiPreset[] = [
  {
    id: "ca-hundreds-268-175",
    label: "Carry Twice (268 + 175)",
    prompt: "A column addition problem for 268 + 175 that carries in the ones and the tens",
    emoji: "🔢",
    technique: CountingTechnique.ADDITION_COLUMN,
    theme: "space"
  },
  {
    id: "ca-tens-18-13",
    label: "First Carry (18 + 13)",
    prompt: "A two-digit column addition for 18 plus 13 that carries one ten",
    emoji: "🍎",
    technique: CountingTechnique.ADDITION_COLUMN,
    theme: "nature"
  },
  {
    id: "ca-nocarry-321-56",
    label: "No Carry (321 + 56)",
    prompt: "A three-digit plus two-digit column addition for 321 + 56 with no carrying",
    emoji: "🧱",
    technique: CountingTechnique.ADDITION_COLUMN,
    theme: "nature"
  },
  {
    id: "ca-big-457-386",
    label: "Big Carry (457 + 386)",
    prompt: "A three-digit column addition for 457 plus 386 that carries across every column",
    emoji: "🚀",
    technique: CountingTechnique.ADDITION_COLUMN,
    theme: "space"
  }
];

export function getPresetsForTechnique(tech: CountingTechnique): AiPreset[] {
  if (tech === CountingTechnique.ADDITION_TUTOR) {
    return ADDITION_TUTOR_PRESETS;
  }
  if (tech === CountingTechnique.ADDITION_COLUMN) {
    return COLUMN_ADDITION_PRESETS;
  }
  return MOVE_AND_COUNT_PRESETS;
}
