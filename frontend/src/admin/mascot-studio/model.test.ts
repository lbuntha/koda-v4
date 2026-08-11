import assert from "node:assert/strict";
import test from "node:test";
import { createBlankMascotDocument, reorderMascotLayer } from "./model";

test("a new mascot starts with a blank canvas", () => {
  const document = createBlankMascotDocument();

  assert.equal(document.name, "Untitled Koda");
  assert.equal(document.slug, "untitled-koda");
  assert.deepEqual(document.layers, []);
  assert.deepEqual(document.groups, []);
  assert.deepEqual(document.anchors, []);
  assert.deepEqual(document.clips, []);
  assert.equal(document.activeClipId, null);
  assert.equal(document.behavior?.animation, "none");
});

test("layer ordering moves only among siblings in the same group", () => {
  const layer = (id: string, parentId?: string) => ({
    id, parentId, assetId: "body-boulder", category: "body" as const, name: id,
    x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true,
    animation: "none" as const, duration: 1, delay: 0,
  });
  const layers = [layer("root-back"), layer("group-back", "face"), layer("root-front"), layer("group-front", "face")];

  assert.deepEqual(reorderMascotLayer(layers, "root-back", "front").map((entry) => entry.id), ["root-front", "group-back", "root-back", "group-front"]);
  assert.deepEqual(reorderMascotLayer(layers, "group-front", "back").map((entry) => entry.id), ["root-back", "group-front", "root-front", "group-back"]);
});
