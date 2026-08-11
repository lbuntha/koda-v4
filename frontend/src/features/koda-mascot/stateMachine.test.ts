import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_KODA_DOCUMENTS } from "./fallbackKoda";
import { MASCOT_ASSETS } from "./catalog";
import { nextKodaMascotState, type KodaMascotEvent, type KodaMascotState } from "./stateMachine";

test("Koda events resolve to stable runtime states", () => {
  const cases: Array<[KodaMascotEvent, KodaMascotState]> = [
    ["RESET", "idle"],
    ["WELCOME", "welcome"],
    ["SPEAK", "talking"],
    ["SUCCEED", "happy"],
    ["CELEBRATE", "excited"],
    ["LOAD", "loading"],
  ];

  for (const [event, expected] of cases) {
    assert.equal(nextKodaMascotState("idle", event), expected);
  }
});

test("every built-in Koda state is a portable SVG document", () => {
  for (const [state, document] of Object.entries(BUILTIN_KODA_DOCUMENTS)) {
    assert.equal(document.schemaVersion, 1);
    assert.equal(document.canvas.viewBox, "0 0 256 256");
    assert.ok(document.layers.some((layer) => layer.category === "body"), `${state} needs a body`);
    assert.ok(document.layers.some((layer) => layer.category === "eyes"), `${state} needs eyes`);
    assert.ok(document.layers.some((layer) => layer.category === "mouth"), `${state} needs a mouth`);
  }
});

test("the attached arch collection is registered in its composable categories", () => {
  assert.ok(MASCOT_ASSETS.some((asset) => asset.id === "body-tall-arch" && asset.category === "body"));
  assert.ok(MASCOT_ASSETS.some((asset) => asset.id === "head-default" && asset.category === "head"));
  assert.equal(MASCOT_ASSETS.filter((asset) => asset.category === "eyes" && asset.name.startsWith("Variant ")).length, 8);
  assert.equal(MASCOT_ASSETS.filter((asset) => asset.category === "mouth" && asset.name.startsWith("Variant ")).length, 5);
});
