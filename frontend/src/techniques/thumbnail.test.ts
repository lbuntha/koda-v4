import assert from "node:assert/strict";
import test from "node:test";
import { CountingTechnique } from "../types";
import { ALL_TECHNIQUES, defaultThumbnailForTechnique, resolveTechniqueThumbnail } from "./index";

test("Move and Count owns a default learner thumbnail", () => {
  assert.equal(
    defaultThumbnailForTechnique(CountingTechnique.MOVE_AND_COUNT),
    "/assets/components/move-and-count.svg",
  );
});

test("every technique now owns component artwork", () => {
  // Only one technique used to ship a default, so 22 of 23 skills fell through to the
  // generic asset. A missing entry here means a new canvas landed without a thumbnail.
  const missing = ALL_TECHNIQUES
    .filter(manifest => !manifest.defaultThumbnailUrl)
    .map(manifest => manifest.technique);
  assert.deepEqual(missing, []);
  assert.equal(
    defaultThumbnailForTechnique(CountingTechnique.ONE_TO_ONE),
    "/assets/components/one-to-one.svg",
  );
});

test("an unknown technique still has no artwork to offer", () => {
  assert.equal(defaultThumbnailForTechnique(undefined), null);
  assert.equal(defaultThumbnailForTechnique("NOT_A_TECHNIQUE"), null);
});

test("curriculum SVG paths override component defaults and remain unchanged", () => {
  assert.deepEqual(
    resolveTechniqueThumbnail(
      "/assets/curriculum/counting-adventure.svg",
      CountingTechnique.MOVE_AND_COUNT,
    ),
    {
      url: "/assets/curriculum/counting-adventure.svg",
      source: "curriculum",
      componentDefaultUrl: "/assets/components/move-and-count.svg",
    },
  );
});

test("resolution falls through component artwork before the generic asset", () => {
  assert.equal(
    resolveTechniqueThumbnail("", CountingTechnique.MOVE_AND_COUNT).source,
    "component",
  );
  // With every technique covered, the generic asset is reached only when the technique
  // itself is unknown — a legacy or un-tagged question.
  assert.deepEqual(
    resolveTechniqueThumbnail(undefined, undefined),
    {
      url: "/assets/owl-mascot.svg",
      source: "generic",
      componentDefaultUrl: null,
    },
  );
  assert.equal(
    resolveTechniqueThumbnail(undefined, CountingTechnique.ONE_TO_ONE).source,
    "component",
  );
});

test("the caller's own fallback wins over the built-in generic", () => {
  // The caller's fallback stands in for the *generic* asset, so it applies only once the
  // technique has nothing of its own — component artwork still wins.
  const resolved = resolveTechniqueThumbnail(
    undefined,
    undefined,
    "/assets/curriculum/subtraction-within-10.svg",
  );
  assert.equal(resolved.url, "/assets/curriculum/subtraction-within-10.svg");
  assert.equal(resolved.source, "generic");
});

test("a stored owl-mascot URL is treated as no artwork at all", () => {
  // Old seed and cached rows set the generic mascot as if an author had chosen it. Honoring
  // that would pin every one of those skills to the mascot instead of curriculum artwork.
  for (const stored of ["/assets/owl-mascot.svg", "/assets/owl_mascot.svg"]) {
    const resolved = resolveTechniqueThumbnail(stored, CountingTechnique.MOVE_AND_COUNT);
    assert.equal(resolved.source, "component");
    assert.equal(resolved.url, "/assets/components/move-and-count.svg");
  }
});
