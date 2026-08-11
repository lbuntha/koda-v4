/*
  Vitest, because this file is `.tsx` — see `vitest.config.ts` for the split.
  It ran on `node:test` and so was collected by neither runner: `test:unit`
  globs `*.test.ts` and never saw it, while vitest picked it up and found no
  suite. Eleven tests about the mascot artwork sat there running in neither
  suite. The assertions stay on `node:assert`; only the runner changes.
*/
import assert from "node:assert/strict";
import { test } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_PALETTE, MASCOT_ASSETS, MascotAssetArt } from "./catalog";
import { KodaLayerAnimation, KodaSvgLayer } from "./KodaSvgRenderer";
import type { MascotLayer } from "./types";

test("built-in body outlines can be disabled without changing the fill", () => {
  const body = MASCOT_ASSETS.find((asset) => asset.id === "body-boulder");
  assert.ok(body);
  const outlined = renderToStaticMarkup(<svg><MascotAssetArt asset={body} palette={DEFAULT_PALETTE}/></svg>);
  const plain = renderToStaticMarkup(<svg><MascotAssetArt asset={body} palette={DEFAULT_PALETTE} outline={false}/></svg>);
  assert.match(outlined, new RegExp(`stroke="${DEFAULT_PALETTE.secondary}"`, "i"));
  assert.match(plain, /stroke="none"/);
  assert.match(plain, new RegExp(`fill="${DEFAULT_PALETTE.primary}"`, "i"));
});

test("a layer gradient renders two stops and replaces its dominant flat fill", () => {
  const body = MASCOT_ASSETS.find((asset) => asset.id === "body-boulder");
  assert.ok(body);
  const layer: MascotLayer = {
    id: "gradient body",
    assetId: body.id,
    category: "body",
    name: body.name,
    x: 128,
    y: 128,
    scale: 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    animation: "none",
    duration: 2,
    delay: 0,
    gradient: { kind: "linear", start: "#FF0000", end: "#0000FF", angle: 90 },
  };
  const document = {
    schemaVersion: 1 as const,
    id: "gradient-test",
    name: "Gradient test",
    slug: "gradient-test",
    purpose: "custom" as const,
    description: "",
    tags: [],
    canvas: { width: 256 as const, height: 256 as const, viewBox: "0 0 256 256" as const },
    palette: DEFAULT_PALETTE,
    layers: [layer],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  const markup = renderToStaticMarkup(<svg><KodaSvgLayer document={document} layer={layer} playing={false}/></svg>);
  assert.match(markup, /<linearGradient id="mascot-gradient-gradient-body"/);
  assert.match(markup, /stop-color="#FF0000"/i);
  assert.match(markup, /stop-color="#0000FF"/i);
  assert.match(markup, /fill="url\(#mascot-gradient-gradient-body\)"/);
});

test("bear parts render a soft arch body, small round ears, and a minimal happy face", () => {
  const ids = ["body-bear-cub", "accessory-teddy-ears", "pattern-bear-muzzle", "eyes-bear", "mouth-bear-smile"];
  const assets = ids.map((id) => MASCOT_ASSETS.find((asset) => asset.id === id));
  assert.ok(assets.every(Boolean));
  const markup = renderToStaticMarkup(<svg>{assets.map((asset) => asset && <MascotAssetArt key={asset.id} asset={asset} palette={DEFAULT_PALETTE} outline={false}/>)}</svg>);
  assert.match(markup, /M20 111V62C20 31 38 15 64 15C90 15 108 31 108 62V111Z/);
  assert.match(markup, /<circle cx="29" cy="57" r="17"/);
  assert.match(markup, /<ellipse cx="64" cy="70" rx="23" ry="17"/);
  assert.match(markup, /M43 66Q64 86 85 66/);
});

test("the minimal bear face stays visible on very light bodies", () => {
  const eyes = MASCOT_ASSETS.find((asset) => asset.id === "eyes-bear");
  assert.ok(eyes);
  const lightPalette = { ...DEFAULT_PALETTE, primary: "#FFFDF7", ink: "#242020" };
  const markup = renderToStaticMarkup(<svg><MascotAssetArt asset={eyes} palette={lightPalette}/></svg>);
  assert.match(markup, /fill="#242020"/i);
});

test("storybook and shape packs expose separately editable vector parts", () => {
  const ids = [
    "body-soft-pentagon", "body-rounded-diamond", "body-soft-triangle", "body-wide-pebble",
    "eyes-open-friendly", "eyes-closed-friendly", "mouth-talk-rest", "mouth-talk-small", "mouth-talk-wide", "mouth-talk-o",
    "body-tall-story", "body-little-story", "body-gentle-giant", "body-fox-friend", "body-tiny-bird",
    "accessory-open-book", "accessory-striped-tail", "accessory-elephant-trunk", "accessory-fox-tail", "accessory-bird-wing",
  ];
  assert.deepEqual(ids.filter((id) => !MASCOT_ASSETS.some((asset) => asset.id === id)), []);
});

test("accessories include distinct editable hat styles", () => {
  const hatIds = [
    "accessory-baseball-cap",
    "accessory-beanie",
    "accessory-bucket-hat",
    "accessory-graduation-cap",
    "accessory-party-hat",
    "accessory-top-hat",
    "accessory-wizard-hat",
  ];
  const hats = hatIds.map((id) => MASCOT_ASSETS.find((asset) => asset.id === id));
  assert.ok(hats.every(Boolean));
  const markups = hats.map((hat) => renderToStaticMarkup(<svg>{hat && <MascotAssetArt asset={hat} palette={DEFAULT_PALETTE}/>}</svg>));
  assert.equal(new Set(markups).size, hatIds.length);
  assert.ok(markups.every((markup) => !markup.includes("M14 57c20 0 30 9 35 30")), "hat artwork must not fall through to the generic accessory");
});

test("white eye bases and black pupils remain separate composable layers", () => {
  const whiteEyes = MASCOT_ASSETS.find((asset) => asset.id === "eyes-white-round");
  const pupils = MASCOT_ASSETS.find((asset) => asset.id === "pupil-round");
  assert.ok(whiteEyes && pupils);
  const whites = renderToStaticMarkup(<svg><MascotAssetArt asset={whiteEyes} palette={DEFAULT_PALETTE}/></svg>);
  const blacks = renderToStaticMarkup(<svg><MascotAssetArt asset={pupils} palette={DEFAULT_PALETTE}/></svg>);
  assert.match(whites, /r="21" fill="#FFFFFF"/i);
  assert.match(blacks, new RegExp(`r="9" fill="${DEFAULT_PALETTE.ink}"`, "i"));
});

test("look motion moves pupils gently around their white eye base", () => {
  const layer: MascotLayer = { id: "pupils", assetId: "pupil-round", category: "pupil", name: "Pupils", x: 128, y: 126, scale: .72, rotation: 0, opacity: 1, visible: true, animation: "look", animationIntensity: 4, animationFeel: "smooth", duration: 3.8, delay: 0 };
  const markup = renderToStaticMarkup(<svg><KodaLayerAnimation layer={layer} playing/></svg>);
  assert.match(markup, /type="translate"/);
  assert.match(markup, /values="0 0;4 0;1\.8 1\.4;-3 0\.72;-1\.4 -1\.6;0 0"/);
  assert.match(markup, /dur="3\.8s"/);
});

test("open talking mouths combine a dark cavity with white teeth or highlights", () => {
  for (const id of ["mouth-talk-small", "mouth-talk-wide", "mouth-talk-o"]) {
    const mouth = MASCOT_ASSETS.find((asset) => asset.id === id);
    assert.ok(mouth);
    const markup = renderToStaticMarkup(<svg><MascotAssetArt asset={mouth} palette={DEFAULT_PALETTE}/></svg>);
    assert.match(markup, new RegExp(`fill="${DEFAULT_PALETTE.ink}"`, "i"));
    assert.match(markup, new RegExp(`fill="${DEFAULT_PALETTE.white}"`, "i"));
  }
});

test("built-in layer motion respects authored amount and feel", () => {
  const layer: MascotLayer = { id: "body", assetId: "body-boulder", category: "body", name: "Body", x: 128, y: 128, scale: 1, rotation: 0, opacity: 1, visible: true, animation: "bounce", animationIntensity: 4, animationFeel: "smooth", duration: 2, delay: 0 };
  const markup = renderToStaticMarkup(<svg><KodaLayerAnimation layer={layer} playing/></svg>);
  assert.match(markup, /values="0 0;0 -4;0 0"/);
  assert.match(markup, /calcMode="spline"/);
  assert.match(markup, /keySplines="\.42 0 \.58 1;\.42 0 \.58 1"/);
});

test("spring feel adds a damped landing to bounce", () => {
  const layer: MascotLayer = { id: "body", assetId: "body-boulder", category: "body", name: "Body", x: 128, y: 128, scale: 1, rotation: 0, opacity: 1, visible: true, animation: "bounce", animationIntensity: 5, animationFeel: "spring", duration: 2, delay: 0 };
  const markup = renderToStaticMarkup(<svg><KodaLayerAnimation layer={layer} playing/></svg>);
  assert.match(markup, /values="0 0;0 -5;0 0\.6;0 -0\.2;0 0"/);
  assert.match(markup, /keyTimes="0;\.34;\.62;\.8;1"/);
});
