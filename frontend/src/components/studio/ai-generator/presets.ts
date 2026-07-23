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

export const COLUMN_SUBTRACTION_PRESETS: AiPreset[] = [
  {
    id: "cs-first-borrow-42-18",
    label: "First Borrow (42 − 18)",
    prompt: "A two-digit column subtraction problem for 42 minus 18 with borrowing",
    emoji: "🔢",
    technique: CountingTechnique.SUBTRACTION_COLUMN,
    theme: "nature"
  },
  {
    id: "cs-cascade-10000-1",
    label: "Borrow Through Zeros",
    prompt: "A five-digit column subtraction problem for 10000 minus 1 with borrowing through every zero",
    emoji: "🧠",
    technique: CountingTechnique.SUBTRACTION_COLUMN,
    theme: "space"
  },
  {
    id: "cs-five-digit-54321-12345",
    label: "Five-Digit Practice",
    prompt: "A five-digit column subtraction problem for 54321 minus 12345 with regrouping",
    emoji: "🚀",
    technique: CountingTechnique.SUBTRACTION_COLUMN,
    theme: "space"
  },
  {
    id: "cs-no-borrow-99999-12345",
    label: "No Regrouping",
    prompt: "A five-digit column subtraction problem for 99999 minus 12345 without borrowing",
    emoji: "✅",
    technique: CountingTechnique.SUBTRACTION_COLUMN,
    theme: "nature"
  }
];

export const MULTI_ROW_COLUMN_ADDITION_PRESETS: AiPreset[] = [
  {
    id: "mra-first-12-23-34",
    label: "Three Rows, No Carry",
    prompt: "Three-row column addition for 12 plus 23 plus 34 without carrying",
    emoji: "🔢",
    technique: CountingTechnique.ADDITION_COLUMN_MULTI,
    theme: "nature"
  },
  {
    id: "mra-carry-268-175-349",
    label: "Carry Across Columns",
    prompt: "Three-row column addition for 268 plus 175 plus 349 with carrying",
    emoji: "🧠",
    technique: CountingTechnique.ADDITION_COLUMN_MULTI,
    theme: "space"
  },
  {
    id: "mra-carry-two-999-999-999",
    label: "Carry Two",
    prompt: "Three-row column addition for 999 plus 999 plus 999 where each column carries 2",
    emoji: "🚀",
    technique: CountingTechnique.ADDITION_COLUMN_MULTI,
    theme: "space"
  },
  {
    id: "mra-five-digit-45678-23456-12345",
    label: "Five-Digit Challenge",
    prompt: "Three-row five-digit column addition for 45678 plus 23456 plus 12345",
    emoji: "⭐",
    technique: CountingTechnique.ADDITION_COLUMN_MULTI,
    theme: "nature"
  }
];

export const MULTI_ROW_COLUMN_SUBTRACTION_PRESETS: AiPreset[] = [
  {
    id: "mrs-basic-90-20-10",
    label: "Three Rows, No Borrow",
    prompt: "Three-row column subtraction for 90 minus 20 minus 10 without borrowing",
    emoji: "🔢",
    technique: CountingTechnique.SUBTRACTION_COLUMN_MULTI,
    theme: "nature"
  },
  {
    id: "mrs-regroup-432-178-56",
    label: "Regroup Across Columns",
    prompt: "Three-row column subtraction for 432 minus 178 minus 56 with regrouping",
    emoji: "🧠",
    technique: CountingTechnique.SUBTRACTION_COLUMN_MULTI,
    theme: "space"
  },
  {
    id: "mrs-borrow-two-30-9-8",
    label: "Borrow Two",
    prompt: "Three-row column subtraction for 30 minus 9 minus 8 where the ones column borrows 2 tens",
    emoji: "🚀",
    technique: CountingTechnique.SUBTRACTION_COLUMN_MULTI,
    theme: "space"
  },
  {
    id: "mrs-five-digit-90000-23456-12345",
    label: "Five-Digit Challenge",
    prompt: "Three-row five-digit column subtraction for 90000 minus 23456 minus 12345",
    emoji: "⭐",
    technique: CountingTechnique.SUBTRACTION_COLUMN_MULTI,
    theme: "nature"
  }
];

export const COLUMN_MULTIPLICATION_PRESETS: AiPreset[] = [
  {
    id: "cm-single-321-4",
    label: "Single Partial Row",
    prompt: "Column multiplication for 321 times 4 with carrying",
    emoji: "🔢",
    technique: CountingTechnique.MULTIPLICATION_COLUMN,
    theme: "nature"
  },
  {
    id: "cm-partials-234-56",
    label: "Two Partial Rows",
    prompt: "Long column multiplication for 234 times 56 using two shifted partial products",
    emoji: "🧠",
    technique: CountingTechnique.MULTIPLICATION_COLUMN,
    theme: "space"
  },
  {
    id: "cm-three-999-123",
    label: "Three Partial Rows",
    prompt: "Column multiplication for 999 times 123 using three partial products",
    emoji: "🚀",
    technique: CountingTechnique.MULTIPLICATION_COLUMN,
    theme: "space"
  },
  {
    id: "cm-five-54321-98",
    label: "Five-Digit Challenge",
    prompt: "Column multiplication for 54321 times 98 with carrying and shifted partial products",
    emoji: "⭐",
    technique: CountingTechnique.MULTIPLICATION_COLUMN,
    theme: "nature"
  }
];

export function getPresetsForTechnique(tech: CountingTechnique): AiPreset[] {
  if (tech === CountingTechnique.ADDITION_TUTOR) {
    return ADDITION_TUTOR_PRESETS;
  }
  if (tech === CountingTechnique.ADDITION_COLUMN) {
    return COLUMN_ADDITION_PRESETS;
  }
  if (tech === CountingTechnique.SUBTRACTION_COLUMN) {
    return COLUMN_SUBTRACTION_PRESETS;
  }
  if (tech === CountingTechnique.ADDITION_COLUMN_MULTI) {
    return MULTI_ROW_COLUMN_ADDITION_PRESETS;
  }
  if (tech === CountingTechnique.SUBTRACTION_COLUMN_MULTI) {
    return MULTI_ROW_COLUMN_SUBTRACTION_PRESETS;
  }
  if (tech === CountingTechnique.MULTIPLICATION_COLUMN) {
    return COLUMN_MULTIPLICATION_PRESETS;
  }
  return MOVE_AND_COUNT_PRESETS;
}
