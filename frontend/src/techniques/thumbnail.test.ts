import assert from "node:assert/strict";
import test from "node:test";
import { CountingTechnique } from "../types";
import { defaultThumbnailForTechnique, resolveTechniqueThumbnail } from "./index";

test("Move and Count owns a default learner thumbnail", () => {
  assert.equal(
    defaultThumbnailForTechnique(CountingTechnique.MOVE_AND_COUNT),
    "/assets/components/move-and-count.svg",
  );
});

test("techniques without component artwork defer to the generic fallback", () => {
  assert.equal(defaultThumbnailForTechnique(CountingTechnique.ONE_TO_ONE), null);
  assert.equal(defaultThumbnailForTechnique(undefined), null);
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
  assert.deepEqual(
    resolveTechniqueThumbnail(undefined, CountingTechnique.ONE_TO_ONE),
    {
      url: "/assets/owl-mascot.svg",
      source: "generic",
      componentDefaultUrl: null,
    },
  );
});
