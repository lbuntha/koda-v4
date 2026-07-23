import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSvgAssetIds, scopeSvgIds } from "./svgIds";

test("repairs duplicate and blank SVG ids without dropping assets", () => {
  const assets = normalizeSvgAssetIds([
    { id: "same", label: "One", markup: "<svg></svg>", scale: 1 },
    { id: "same", label: "Two", markup: "<svg></svg>", scale: 1 },
    { id: "", label: "Three", markup: "<svg></svg>", scale: 1 },
  ]);
  assert.equal(assets.length, 3);
  assert.equal(assets[0].id, "same");
  assert.equal(new Set(assets.map((asset) => asset.id)).size, 3);
});

test("scopes SVG ids and repairs duplicate definition ids", () => {
  const markup = '<svg><defs><linearGradient id="paint"/><linearGradient id="paint"/></defs><path fill="url(#paint)"/><use href="#paint"/></svg>';
  const scoped = scopeSvgIds(markup, ":r1:");
  assert.match(scoped, /id="r1-paint"/);
  assert.match(scoped, /id="r1-paint-2"/);
  assert.match(scoped, /fill="url\(#r1-paint\)"/);
  assert.match(scoped, /href="#r1-paint"/);
});
