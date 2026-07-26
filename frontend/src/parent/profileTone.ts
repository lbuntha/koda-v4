/**
 * Colour for a kid's profile tile.
 *
 * Netflix gives every profile its own colour so a child recognises their square before they
 * can read the name. We derive it from the child's id so it is stable across sessions and
 * devices (no extra field to store, no reshuffling when a sibling is added or removed).
 */

export const PROFILE_TONES = ["violet", "sky", "emerald", "amber", "rose"] as const;

export type ProfileTone = (typeof PROFILE_TONES)[number];

/** FNV-1a: tiny, dependency-free, and spreads short ids evenly across the palette. */
const hash = (seed: string): number => {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
};

export const profileToneFor = (seed: string): ProfileTone =>
  PROFILE_TONES[hash(seed) % PROFILE_TONES.length];

/**
 * Tile gradient + matching glow per tone. Deep enough that a white emoji-style avatar reads
 * clearly on top, and the same hue works on the light and dark parent pages.
 */
export const PROFILE_TONE_CLASS: Record<ProfileTone, string> = {
  violet: "from-[#7C63F5] to-[#5335D8] shadow-violet-500/25",
  sky: "from-[#3FA9F5] to-[#1D6FD0] shadow-sky-500/25",
  emerald: "from-[#3FC98A] to-[#159C68] shadow-emerald-500/25",
  amber: "from-[#FFC24B] to-[#F08A2E] shadow-amber-500/25",
  rose: "from-[#FF7A9C] to-[#E23E67] shadow-rose-500/25",
};
