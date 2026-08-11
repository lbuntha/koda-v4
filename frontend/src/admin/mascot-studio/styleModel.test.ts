import assert from "node:assert/strict";
import test from "node:test";
import { createLayersFromAssetIds, createMascotDocument } from "./model";
import { instantiateMascotStyle, MASCOT_STYLE_PRESETS } from "./presets";
import { cloneMascotStyleVisual } from "./styleModel";

test("reusing a saved style remaps all rig and keyframe references", () => {
  const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === "teddy-bear");
  assert.ok(preset);
  const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
  const template = { ...createMascotDocument(), ...composed };
  const cloned = cloneMascotStyleVisual(template);
  assert.notDeepEqual(cloned.layers.map((layer) => layer.id), template.layers.map((layer) => layer.id));
  assert.notDeepEqual(cloned.groups.map((group) => group.id), template.groups.map((group) => group.id));
  const validLayerIds = new Set(cloned.layers.map((layer) => layer.id));
  const validGroupIds = new Set(cloned.groups.map((group) => group.id));
  assert.ok(cloned.layers.every((layer) => !layer.parentId || validGroupIds.has(layer.parentId)));
  assert.ok(cloned.clips.every((clip) => clip.keyframes.every((frame) => frame.targetType === "layer" ? validLayerIds.has(frame.targetId) : validGroupIds.has(frame.targetId))));
  assert.ok(cloned.activeClipId && cloned.clips.some((clip) => clip.id === cloned.activeClipId));
});
