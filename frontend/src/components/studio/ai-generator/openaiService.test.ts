import assert from "node:assert/strict";
import test from "node:test";
import { CountingTechnique, type CustomSvgAsset } from "../../../types";
import type { ParsedSlideConfig } from "./types";
import { applyCustomAssetSelection } from "./openaiService";

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
