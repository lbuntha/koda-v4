import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_ASSETS,
  SPRITE_ASSETS,
  SHAPE_ASSETS,
  assetQuestionPatch,
  assetSelection,
  buildCatalog,
  findAsset,
  isSpriteId,
  searchCatalog,
  spriteId,
  spriteKey,
} from "./assetCatalog";
import { GOODS_ASSET_KEYS } from "./goods-sort/GoodsAsset";
import type { CountingQuestion, CustomSvgAsset } from "../types";

const library: CustomSvgAsset[] = [
  { id: "svg-abc", label: "My Star", markup: "<svg/>", scale: 1 },
];

test("every Goods Sort sprite is offered to the studio", () => {
  // The point of the catalog: forty pieces of artwork that no activity but Goods Sort could use.
  assert.equal(SPRITE_ASSETS.length, GOODS_ASSET_KEYS.length);
  assert.equal(SPRITE_ASSETS.length, 40);
});

test("every sprite lands on a real category tab, none in a fallback bucket", () => {
  // A sprite missing from the category map would silently pile up under "Objects".
  const objects = SPRITE_ASSETS.filter((asset) => asset.category === "Objects");
  assert.equal(objects.length, 7);
});

test("sprite ids cannot collide with shape ids of the same name", () => {
  // "apple", "star", "car" and "rocket" exist as both a drawable shape and a sprite.
  const shapeIds = new Set(SHAPE_ASSETS.map((asset) => asset.id));
  const overlapping = SPRITE_ASSETS.filter((asset) => shapeIds.has(spriteKey(asset.id)));
  assert.ok(overlapping.length > 0, "expected names shared between the two sets");
  for (const sprite of overlapping) assert.equal(shapeIds.has(sprite.id), false);
});

test("ids round-trip through the goods namespace", () => {
  assert.equal(spriteId("donut"), "goods:donut");
  assert.equal(spriteKey(spriteId("bottle_boba")), "bottle_boba");
  assert.equal(isSpriteId("goods:donut"), true);
  assert.equal(isSpriteId("apple"), false);
});

test("shapes and emoji keep the bare ids questions already store", () => {
  // Renaming these would orphan every published question that uses them.
  assert.ok(findAsset("apple"));
  assert.equal(findAsset("apple")?.kind, "shape");
  assert.equal(findAsset("duck")?.kind, "emoji");
});

test("the catalog includes the account's own artwork", () => {
  const catalog = buildCatalog(library);
  assert.equal(catalog.length, BUILT_IN_ASSETS.length + 1);
  assert.equal(findAsset("svg-abc", library)?.kind, "custom");
  assert.equal(findAsset("svg-abc")?.kind, undefined);
});

test("selecting a sprite stores the namespaced id as the asset type", () => {
  assert.deepEqual(assetSelection(findAsset("goods:donut")!), {
    objectId: "goods:donut",
    assetType: "goods:donut",
  });
});

test("selecting custom artwork stores a reference, not markup", () => {
  assert.deepEqual(assetSelection(findAsset("svg-abc", library)!), {
    objectId: "custom_svg",
    assetType: "custom_svg",
    customSvgAssetId: "svg-abc",
  });
});

test("re-picking clears a snapshot left by pre-reference content", () => {
  // Otherwise the stale copy survives and resolveAssetRef falls back to it whenever the newly
  // referenced asset cannot be found — the question would draw its old picture.
  const config = {
    assetType: "custom_svg",
    customSvgMarkup: "<svg>old</svg>",
    customSvgLabel: "Old",
    customSvgScale: 2,
  } as CountingQuestion["config"];

  const patch = assetQuestionPatch(config, findAsset("goods:donut")!);

  assert.equal(patch.objectId, "goods:donut");
  assert.equal(patch.config.assetType, "goods:donut");
  assert.equal(patch.config.customSvgMarkup, undefined);
  assert.equal(patch.config.customSvgLabel, undefined);
  assert.equal(patch.config.customSvgScale, undefined);
});

test("unrelated config survives an asset change", () => {
  const patch = assetQuestionPatch(
    { frameColor: "indigo", targetCount: 4 } as any,
    findAsset("apple")!,
  );
  assert.equal((patch.config as any).frameColor, "indigo");
});

test("search matches label and id", () => {
  const catalog = buildCatalog(library);
  assert.ok(searchCatalog(catalog, "bottle").length >= 8);
  assert.ok(searchCatalog(catalog, "Glazed").length === 0);
  assert.ok(searchCatalog(catalog, "donut").some((asset) => asset.id === "goods:donut"));
  assert.equal(searchCatalog(catalog, "").length, catalog.length);
});
