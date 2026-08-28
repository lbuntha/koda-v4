import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Unmount whatever a test rendered, after every test.
 *
 * Testing Library registers this itself only when Vitest runs with globals on.
 * With explicit imports — which is what the rest of this codebase uses — nothing
 * registers it, and every rendered activity stays in the document: queries then
 * match the *previous* test's buttons, clicks land on a dead tree, and the
 * failure surfaces somewhere unrelated. Cheap to add, very expensive to debug.
 */
afterEach(cleanup);

/**
 * jsdom asks for reduced motion.
 *
 * jsdom has no `matchMedia`, so `useReducedMotion()` answers "no preference" and
 * every looping animation runs — including the idle drift on each counting
 * object, which repeats forever. React then never reaches a quiet state and a
 * round test times out waiting for one, five seconds later, with no clue that a
 * decorative animation was the cause.
 *
 * Declaring the preference is also the more honest environment: a test asserts
 * on behaviour, and the behaviour under reduced motion is the same round.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
