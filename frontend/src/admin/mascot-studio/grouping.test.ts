import assert from "node:assert/strict";
import test from "node:test";
import { bakeChildGroupOutOfGroup, bakeGroupKeyframeOutOfGroup, bakeLayerKeyframeOutOfGroup, bakeLayerOutOfGroup, transformMascotPoint } from "./grouping";
import type { MascotGroup, MascotKeyframe, MascotLayer } from "./types";

const group = (patch: Partial<MascotGroup> = {}): MascotGroup => ({ id: "group", name: "Group", x: 10, y: -4, scale: 1.25, rotation: 30, opacity: .8, visible: true, pivot: { x: 100, y: 120 }, ...patch });

const layer: MascotLayer = { id: "eyes", assetId: "eyes-even", category: "eyes", name: "Eyes", x: 120, y: 100, scale: .7, rotation: 5, opacity: .9, visible: true, animation: "blink", duration: 4, delay: 0, parentId: "group" };

test("ungrouping bakes the group pose into a layer", () => {
  const parent = group();
  const expectedPoint = transformMascotPoint(parent, layer);
  const baked = bakeLayerOutOfGroup(parent, layer);
  assert.ok(Math.abs(baked.x - expectedPoint.x) < 1e-8);
  assert.ok(Math.abs(baked.y - expectedPoint.y) < 1e-8);
  assert.equal(baked.scale, layer.scale * parent.scale);
  assert.equal(baked.rotation, layer.rotation + parent.rotation);
  assert.equal(baked.parentId, null);
});

test("ungrouping a nested group preserves its full transform", () => {
  const parent = group({ id: "parent", parentId: "root" });
  const child = group({ id: "child", parentId: "parent", x: -7, y: 9, scale: .8, rotation: -12, pivot: { x: 80, y: 90 } });
  const composed = bakeChildGroupOutOfGroup(parent, child);
  const point = { x: 135, y: 72 };
  const before = transformMascotPoint(parent, transformMascotPoint(child, point));
  const after = transformMascotPoint(composed, point);
  assert.ok(Math.abs(before.x - after.x) < 1e-8);
  assert.ok(Math.abs(before.y - after.y) < 1e-8);
  assert.equal(composed.parentId, "root");
});

test("ungrouping bakes layer keyframes into the new coordinate space", () => {
  const parent = group();
  const frame: MascotKeyframe = { id: "layer-frame", time: 1, targetType: "layer", targetId: layer.id, easing: "easeInOut", values: { x: 140, y: 88, scale: .9, rotation: 12, opacity: .6 } };
  const baked = bakeLayerKeyframeOutOfGroup(parent, layer, frame);
  const expected = bakeLayerOutOfGroup(parent, { ...layer, ...frame.values });
  assert.deepEqual(baked.values, { x: expected.x, y: expected.y, scale: expected.scale, scaleX: expected.scaleX, scaleY: expected.scaleY, rotation: expected.rotation, opacity: expected.opacity });
});

test("ungrouping bakes nested group keyframes into the new coordinate space", () => {
  const parent = group({ id: "parent" });
  const child = group({ id: "child", parentId: "parent", pivot: { x: 80, y: 90 } });
  const frame: MascotKeyframe = { id: "group-frame", time: .5, targetType: "group", targetId: child.id, easing: "linear", values: { x: 4, rotation: -8 } };
  const baked = bakeGroupKeyframeOutOfGroup(parent, child, frame);
  const expected = bakeChildGroupOutOfGroup(parent, { ...child, ...frame.values });
  assert.deepEqual(baked.values, { x: expected.x, y: expected.y, scale: expected.scale, scaleX: expected.scaleX, scaleY: expected.scaleY, rotation: expected.rotation, opacity: expected.opacity });
});
