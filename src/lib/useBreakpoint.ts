import { useSyncExternalStore } from "react";

/**
 * `rail:` in JavaScript — 720px, the one width at which Koda changes shape.
 *
 * Kept in step with `--breakpoint-rail` in `src/index.css` by hand. There is no
 * way to read a Tailwind theme value at runtime without shipping the config, and
 * one number in two files is a smaller cost than that.
 */
export const RAIL_QUERY = "(min-width: 45rem)";

const subscribe = (onChange: () => void): (() => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const list = window.matchMedia(RAIL_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};

// Read straight from `matchMedia`, so the *first* render already knows the
// width. An effect-based hook would render the phone layout for a frame on a
// desktop, which is a visible flash on every page change.
const isCompactNow = (): boolean =>
  typeof window !== "undefined" && Boolean(window.matchMedia)
    ? !window.matchMedia(RAIL_QUERY).matches
    : false;

/**
 * Whether the app is in its phone shape — toolbar and tab bar rather than rail.
 *
 * Prefer a `rail:` class wherever the difference is only how something *looks*.
 * Reach for this when an element must not be in the tree at all on one side of
 * the breakpoint, which is a genuinely different thing: a `hidden` child still
 * counts as a child, so anything inside a `space-y-*` stack that hides itself
 * leaves the gap it would have occupied. That is the bug this exists to avoid.
 */
export const useIsCompact = (): boolean =>
  useSyncExternalStore(subscribe, isCompactNow, () => false);
