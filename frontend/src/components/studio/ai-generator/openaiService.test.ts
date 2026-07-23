import assert from "node:assert/strict";
import test from "node:test";
import { CountingTechnique, type CustomSvgAsset } from "../../../types";
import type { ParsedSlideConfig } from "./types";
import { applyCustomAssetSelection, normalizeGeneratedSlides } from "./openaiService";
import { detectTechniqueFromPrompt, getSchemaByTechnique } from "./schemas";

test("joins an AI-selected MongoDB SVG onto the validated slide", () => {
  const asset: CustomSvgAsset = {
    id: "custom_svg_jar",
    label: "Jar",
    markup: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>',
    scale: 1.25,
  };
  const validated: ParsedSlideConfig = {
    id: "generated-1",
    technique: CountingTechnique.ONE_TO_ONE,
    title: "Count the jars",
    instruction: "Count each jar.",
    objectId: "apple",
    targetCount: 4,
    config: { frameColor: "indigo" },
  };

  const result = applyCustomAssetSelection({ objectId: asset.id }, validated, [asset]);

  assert.equal(result.objectId, "custom_svg");
  assert.deepEqual(result.config, {
    frameColor: "indigo",
    assetType: "custom_svg",
    customSvgAssetId: asset.id,
    customSvgMarkup: asset.markup,
    customSvgLabel: asset.label,
    customSvgScale: asset.scale,
  });
});

test("keeps schema validation output when AI selects no MongoDB asset", () => {
  const validated: ParsedSlideConfig = {
    id: "generated-2",
    technique: CountingTechnique.ONE_TO_ONE,
    title: "Count apples",
    instruction: "Count each apple.",
    objectId: "apple",
    targetCount: 3,
    config: { assetType: "apple" },
  };

  assert.equal(applyCustomAssetSelection({ objectId: "apple" }, validated, []), validated);
});

test("does not match a component keyword inside another word", () => {
  assert.equal(
    detectTechniqueFromPrompt("Create one counting question with 5 stars").technique,
    CountingTechnique.ONE_TO_ONE,
  );
  assert.equal(
    detectTechniqueFromPrompt("Let the child eat 2 cookies").technique,
    CountingTechnique.SUBTRACTION_SANDBOX,
  );
});

test("normalizes question wrappers and replaces duplicate ids before Apply", () => {
  const schema = getSchemaByTechnique(CountingTechnique.ONE_TO_ONE);
  assert.ok(schema);

  const slides = normalizeGeneratedSlides({
    questions: [
      { id: "existing", title: "Count stars", instruction: "Count 1, 2, 3!", objectId: "star", targetCount: 3, config: {} },
      { id: "existing", title: "Count apples", instruction: "Count 1, 2, 3, 4!", objectId: "apple", targetCount: 4, config: {} },
    ],
  }, schema, [], ["existing"]);

  assert.equal(slides.length, 2);
  assert.equal(new Set(slides.map((slide) => slide.id)).size, 2);
  assert.ok(slides.every((slide) => slide.id !== "existing"));
  assert.ok(slides.every((slide) => slide.title && slide.instruction && slide.technique && slide.config));
});

test("rejects response wrappers that contain no question", () => {
  const schema = getSchemaByTechnique(CountingTechnique.ONE_TO_ONE);
  assert.ok(schema);
  assert.throws(
    () => normalizeGeneratedSlides({ result: "done" }, schema),
    /did not contain a slide or question object/,
  );
});
