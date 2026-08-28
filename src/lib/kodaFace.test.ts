import { describe, expect, it } from "vitest";

import { EXPRESSIONS, STATE_ANIMATION, kodaFace } from "./kodaFace";

/**
 * The face, as data.
 *
 * The thing worth pinning is that the expressions are genuinely different
 * pictures. A mouth that "opens" by being scaled, or two states that resolve to
 * the same generated SVG, would look like animation in a code review and like a
 * frozen face on a tablet — which is the exact failure the hand-drawn mascot
 * this replaced was heading for.
 */

const SEED = "vega-calm-01";
const BG = "#4f46e5";

describe("a character's expressions", () => {
  it("draws a different picture for an open mouth than a closed one", () => {
    const closed = kodaFace(SEED, EXPRESSIONS.talkClosed, BG);
    const open = kodaFace(SEED, EXPRESSIONS.talkOpen, BG);
    const wide = kodaFace(SEED, EXPRESSIONS.talkWide, BG);

    expect(closed).not.toBe(open);
    expect(open).not.toBe(wide);
  });

  it("draws a different picture for shut eyes than open ones", () => {
    // The blink is the one frame most likely to be silently identical, because
    // only the eyes differ between it and the resting face.
    expect(kodaFace(SEED, EXPRESSIONS.blink, BG)).not.toBe(
      kodaFace(SEED, EXPRESSIONS.neutral, BG),
    );
  });

  it("keeps the same character across every expression", () => {
    // Same seed, so the head shape and the face's position never change — only
    // the eyes and mouth. A wandering head would read as a different teacher.
    const faces = Object.values(EXPRESSIONS).map((e) => kodaFace(SEED, e, BG));
    expect(new Set(faces).size).toBe(faces.length);

    const other = kodaFace("rio-play-01", EXPRESSIONS.neutral, BG);
    expect(other).not.toBe(kodaFace(SEED, EXPRESSIONS.neutral, BG));
  });

  it("returns the very same string for a repeat, so a talking loop is cached", () => {
    // Identity, not equality: a cache miss would re-render and re-encode the SVG
    // on every frame of every mascot on screen.
    expect(kodaFace(SEED, EXPRESSIONS.neutral, BG)).toBe(
      kodaFace(SEED, EXPRESSIONS.neutral, BG),
    );
  });

  it("gives every state a frame for every timing it declares", () => {
    for (const [state, animation] of Object.entries(STATE_ANIMATION)) {
      expect(animation.frames.length, `${state} frames`).toBe(animation.ms.length);
      expect(animation.frames.length, `${state} is empty`).toBeGreaterThan(0);
      for (const frame of animation.frames) expect(EXPRESSIONS[frame]).toBeTruthy();
    }
  });

  it("makes talking quicker than resting, which is what reads as speech", () => {
    const fastest = Math.min(...STATE_ANIMATION.speaking.ms);
    const resting = Math.max(...STATE_ANIMATION.idle.ms);
    expect(fastest).toBeLessThan(300);
    expect(resting).toBeGreaterThan(1000);
  });
});
