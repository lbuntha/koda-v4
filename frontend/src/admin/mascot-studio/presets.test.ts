import assert from "node:assert/strict";
import test from "node:test";
import { sampleKeyframes } from "../../features/koda-mascot/clips";
import { createLayersFromAssetIds } from "./model";
import { instantiateMascotStyle, MASCOT_STYLE_PRESETS } from "./presets";

test("Talking Bear is an editable grouped rig with a reusable speech clip", () => {
  const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === "talking-bear");
  assert.ok(preset);
  const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
  const face = composed.groups.find((group) => group.name === "Face");
  const closedMouth = composed.layers.find((layer) => layer.assetId === "mouth-bear-smile");
  const openMouth = composed.layers.find((layer) => layer.assetId === "mouth-bear-open");
  const eyes = composed.layers.find((layer) => layer.assetId === "eyes-bear");
  assert.ok(face && closedMouth && openMouth && eyes);
  assert.equal(closedMouth.parentId, face.id);
  assert.equal(openMouth.parentId, face.id);
  assert.equal(eyes.parentId, face.id);
  assert.equal(composed.clips[0].name, "Talking");
  assert.ok(composed.clips[0].keyframes.some((frame) => frame.targetId === openMouth.id));
  assert.ok(composed.clips[0].keyframes.some((frame) => frame.targetId === face.id));
});

for (const presetId of ["teddy-bear", "panda", "sleepy-bear", "gummy-bear", "blinking-bear", "winking-bear", "sleepy-blink-bear", "dizzy-bear"]) {
  test(`${presetId} builds a complete editable rig with valid animation targets`, () => {
    const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === presetId);
    assert.ok(preset);
    const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
    assert.equal(composed.layers.length, preset.assetIds.length);
    assert.ok(composed.groups.length > 0);
    assert.ok(composed.clips.length > 0);
    assert.ok(composed.clips[0].keyframes.length > 0);
    const targetIds = new Set([...composed.layers.map((layer) => layer.id), ...composed.groups.map((group) => group.id)]);
    assert.ok(composed.clips.every((clip) => clip.keyframes.every((frame) => targetIds.has(frame.targetId))));
  });
}

test("Teddy Bear includes both physical jump and calm idle clips", () => {
  const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === "teddy-bear");
  assert.ok(preset);
  const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
  assert.deepEqual(composed.clips.map((clip) => clip.name), ["Happy Jump", "Cozy Idle"]);
});

test("Quiz Hero ships as a one-shot correct-answer rig with a stable victory pose", () => {
  const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === "quiz-hero");
  assert.ok(preset);
  const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
  const hero = composed.groups.find((group) => group.name === "Quiz Hero");
  const hand = composed.layers.find((layer) => layer.assetId === "accessory-wave-paw");
  const wink = composed.layers.find((layer) => layer.assetId === "eyes-wink");
  const grin = composed.layers.find((layer) => layer.assetId === "mouth-talk-wide");
  assert.ok(hero && hand && wink && grin);
  assert.equal(composed.clips[0].name, "Answer Power-up");
  assert.equal(composed.clips[0].loop, false);
  assert.ok(composed.clips[0].keyframes.some((frame) => frame.targetId === hero.id && frame.values.rotation === 360));
  assert.ok(composed.clips[0].keyframes.some((frame) => frame.targetId === hand.id && frame.values.rotation === -54));
  const finalWink = sampleKeyframes(wink, composed.clips[0].keyframes.filter((frame) => frame.targetId === wink.id), composed.clips[0].duration);
  const finalGrin = sampleKeyframes(grin, composed.clips[0].keyframes.filter((frame) => frame.targetId === grin.id), composed.clips[0].duration);
  assert.equal(finalWink.opacity, 1);
  assert.equal(finalGrin.opacity, 1);
});

test("eye-pose bears keep open and closed artwork as separately editable layers", () => {
  for (const presetId of ["blinking-bear", "winking-bear", "sleepy-blink-bear"]) {
    const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === presetId);
    assert.ok(preset);
    const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
    const eyeLayers = composed.layers.filter((layer) => layer.category === "eyes");
    assert.equal(eyeLayers.length, 2);
    assert.equal(eyeLayers.filter((layer) => layer.opacity === 1).length, 1);
    assert.equal(eyeLayers.filter((layer) => layer.opacity === 0).length, 1);
  }
});

test("bear presets share recognizable bear anatomy while keeping every part editable", () => {
  const bearPresetIds = ["talking-bear", "teddy-bear", "panda", "sleepy-bear", "gummy-bear", "blinking-bear", "winking-bear", "sleepy-blink-bear", "dizzy-bear"];
  for (const presetId of bearPresetIds) {
    const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === presetId);
    assert.ok(preset);
    assert.ok(preset.assetIds.includes("body-bear-cub"));
    assert.ok(preset.assetIds.includes("pattern-bear-muzzle"));
    assert.ok(preset.assetIds.some((assetId) => assetId.startsWith("eyes-bear")));
    assert.ok(preset.assetIds.some((assetId) => assetId.startsWith("mouth-bear")));
  }
});

test("Dizzy Bear eye roll completes one full editable rotation", () => {
  const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === "dizzy-bear");
  assert.ok(preset);
  const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
  const eyes = composed.layers.find((layer) => layer.assetId === "eyes-bear-dizzy");
  assert.ok(eyes);
  const rotations = composed.clips[0].keyframes.filter((frame) => frame.targetId === eyes.id).map((frame) => frame.values.rotation);
  assert.deepEqual(rotations, [0, 90, 180, 270, 360]);
});

for (const presetId of ["story-reader", "woodland-scout", "gentle-elephant", "sunny-fox", "tiny-bird"]) {
  test(`${presetId} provides an editable storybook rig and built-in motion`, () => {
    const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === presetId);
    assert.ok(preset);
    const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
    assert.equal(composed.layers.length, preset.assetIds.length);
    assert.ok(composed.groups.length > 0);
    assert.ok(composed.clips[0].keyframes.length > 0);
    const targets = new Set([...composed.layers.map((layer) => layer.id), ...composed.groups.map((group) => group.id)]);
    assert.ok(composed.clips.every((clip) => clip.keyframes.every((frame) => targets.has(frame.targetId))));
  });
}

test("Shape Talker exposes open and closed eyes plus four editable speech poses", () => {
  const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === "shape-talker");
  assert.ok(preset);
  const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
  assert.equal(composed.layers.filter((layer) => layer.category === "eyes").length, 2);
  const pupils = composed.layers.filter((layer) => layer.category === "pupil");
  assert.equal(pupils.length, 1);
  assert.equal(pupils[0].animation, "look");
  assert.equal(composed.layers.filter((layer) => layer.assetId.startsWith("mouth-talk-")).length, 4);
  const targets = new Set([...composed.layers.map((layer) => layer.id), ...composed.groups.map((group) => group.id)]);
  assert.ok(composed.clips[0].keyframes.every((frame) => targets.has(frame.targetId)));
});

test("Shape Talker holds one clear mouth pose instead of showing translucent doubles", () => {
  const preset = MASCOT_STYLE_PRESETS.find((entry) => entry.id === "shape-talker");
  assert.ok(preset);
  const composed = instantiateMascotStyle(preset, createLayersFromAssetIds(preset.assetIds));
  const mouths = composed.layers.filter((layer) => layer.assetId.startsWith("mouth-talk-"));
  for (const time of [.1, .3, .5, .7, 1, 1.55, 1.85]) {
    const opacities = mouths.map((mouth) => sampleKeyframes(mouth, composed.clips[0].keyframes.filter((frame) => frame.targetType === "layer" && frame.targetId === mouth.id), time).opacity);
    assert.equal(opacities.filter((opacity) => opacity > .99).length, 1, `one mouth should be visible at ${time}s`);
    assert.equal(opacities.filter((opacity) => opacity > .01 && opacity < .99).length, 0, `no mouth should ghost at ${time}s`);
  }
});
