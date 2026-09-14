/**
 * The parts of Profile that something else can send a learner straight to.
 *
 * Named here rather than as literals at both ends, because a deep link is two
 * halves that fail silently when they disagree: a tile pointing at a section
 * that was renamed just scrolls nowhere, with nothing to see in a test or a
 * console. One record, imported by the tile and by the section it opens.
 */
export const PROFILE_SECTIONS = {
  today: "profile-today",
  achievements: "profile-achievements",
} as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[keyof typeof PROFILE_SECTIONS];

/** Where a pending deep link is left for `ProfilePage` to pick up on arrival. */
let pending: ProfileSectionId | null = null;

/**
 * Ask for Profile to open at one of its sections.
 *
 * A module variable rather than the URL, because Koda's shell has no router —
 * a tab is state, not an address — and a hash left in the bar would survive the
 * next three tabs and scroll somebody who came back for an unrelated reason.
 *
 * Cleared by the read, so it fires once: arriving at Profile a second time by
 * the tab bar must not re-scroll a page the learner has since scrolled away
 * from.
 */
export const openProfileAt = (section: ProfileSectionId): void => {
  pending = section;
};

export const takePendingProfileSection = (): ProfileSectionId | null => {
  const section = pending;
  pending = null;
  return section;
};
