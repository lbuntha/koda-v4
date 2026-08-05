import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAssetRef, resolveAssetRef } from "./assetRef";
import type { CustomSvgAsset } from "../types";

const asset: CustomSvgAsset = {
  id: "svg-apple",
  label: "Apple",
  markup: "<svg><circle r='1'/></svg>",
  scale: 1.5,
};

test("resolves a reference against the library", () => {
  const resolved = resolveAssetRef({ customSvgAssetId: "svg-apple" }, [asset]);
  assert.deepEqual(resolved, { markup: asset.markup, label: "Apple", scale: 1.5 });
});

test("the library wins over a snapshot inlined before references existed", () => {
  // A question authored pre-reference and re-picked since carries both. It must follow the
  // asset as it is edited, not the copy frozen into it — that staleness is the whole bug.
  const resolved = resolveAssetRef(
    { customSvgAssetId: "svg-apple", customSvgMarkup: "<svg>stale</svg>", customSvgScale: 3 },
    [asset],
  );
  assert.equal(resolved?.markup, asset.markup);
  assert.equal(resolved?.scale, 1.5);
});

test("falls back to the inlined snapshot when the asset is gone", () => {
  // Deleting an asset must not blank out old content that still carries its own copy.
  const resolved = resolveAssetRef(
    { customSvgAssetId: "deleted", customSvgMarkup: "<svg>old</svg>", customSvgLabel: "Old" },
    [asset],
  );
  assert.deepEqual(resolved, { markup: "<svg>old</svg>", label: "Old", scale: 1 });
});

test("reads pre-reference content that names no asset at all", () => {
  const resolved = resolveAssetRef({ customSvgMarkup: "<svg>legacy</svg>" }, []);
  assert.equal(resolved?.markup, "<svg>legacy</svg>");
  assert.equal(resolved?.label, "Custom Shape");
});

test("resolves to nothing when there is nothing to draw", () => {
  // A missing asset with no snapshot has to be null, not an empty-markup object: the caller
  // renders nothing rather than an empty sized box.
  assert.equal(resolveAssetRef({ customSvgAssetId: "missing" }, [asset]), null);
  assert.equal(resolveAssetRef({}, [asset]), null);
  assert.equal(resolveAssetRef(undefined, [asset]), null);
});

test("an asset stored without markup is not drawable", () => {
  const empty: CustomSvgAsset = { id: "blank", label: "Blank", markup: "", scale: 1 };
  assert.equal(resolveAssetRef({ customSvgAssetId: "blank" }, [empty]), null);
});

test("hasAssetRef tells artwork apart from emoji and built-in shapes", () => {
  assert.equal(hasAssetRef({ customSvgAssetId: "svg-apple" }), true);
  assert.equal(hasAssetRef({ customSvgMarkup: "<svg/>" }), true);
  assert.equal(hasAssetRef({}), false);
  assert.equal(hasAssetRef(undefined), false);
});
