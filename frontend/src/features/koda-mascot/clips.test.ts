import assert from "node:assert/strict";
import test from "node:test";
import { applyMascotClipAtTime, captureMascotKeyframe, sampleKeyframes } from "./clips";
import { getBuiltinKodaDocument } from "./fallbackKoda";
import type { MascotAnimationClip, MascotDocument, MascotKeyframe } from "./types";

const base = { x: 0, y: 10, scale: 1, rotation: 0, opacity: 1 };

test("clip sampling interpolates authored transforms", () => {
  const frames: MascotKeyframe[] = [
    { id: "a", time: 0, targetType: "layer", targetId: "body", easing: "linear", values: { x: 0, rotation: 0 } },
    { id: "b", time: 2, targetType: "layer", targetId: "body", easing: "linear", values: { x: 20, rotation: 90 } },
  ];
  const sampled = sampleKeyframes(base, frames, 1);
  assert.equal(sampled.x, 10);
  assert.equal(sampled.rotation, 45);
  assert.equal(sampled.y, base.y);
  assert.equal(sampled.scaleX, 1);
  assert.equal(sampled.scaleY, 1);
});

test("clip sampling supports smooth mouth squash and stretch", () => {
  const frames: MascotKeyframe[] = [
    { id: "closed", time: 0, targetType: "layer", targetId: "mouth", easing: "linear", values: { scaleX: .8, scaleY: .2 } },
    { id: "open", time: .2, targetType: "layer", targetId: "mouth", easing: "easeOut", values: { scaleX: 1, scaleY: 1 } },
  ];
  const sampled = sampleKeyframes(base, frames, .1);
  assert.ok(sampled.scaleX > .8 && sampled.scaleX < 1);
  assert.ok(sampled.scaleY > .2 && sampled.scaleY < 1);
});

test("a clip changes only its targeted layer", () => {
  const source = getBuiltinKodaDocument("idle");
  const target = source.layers[0];
  const clip: MascotAnimationClip = { id: "move", name: "Move", duration: 1, loop: false, keyframes: [{ id: "end", time: 1, targetType: "layer", targetId: target.id, easing: "linear", values: { x: target.x + 12 } }] };
  const framed = applyMascotClipAtTime(source, clip, 1);
  assert.equal(framed.layers[0].x, target.x + 12);
  assert.equal(framed.layers[1].x, source.layers[1].x);
  assert.equal(source.layers[0].x, target.x);
});

test("capturing the same target and time replaces that keyframe", () => {
  const source = getBuiltinKodaDocument("idle") as MascotDocument;
  const target = source.layers[0];
  const empty: MascotAnimationClip = { id: "idle", name: "Idle", duration: 2, loop: true, keyframes: [] };
  const first = captureMascotKeyframe(source, empty, "layer", target.id, 1);
  const second = captureMascotKeyframe({ ...source, layers: source.layers.map((layer) => layer.id === target.id ? { ...layer, x: layer.x + 5 } : layer) }, first, "layer", target.id, 1);
  assert.equal(second.keyframes.length, 1);
  assert.equal(second.keyframes[0].values.x, target.x + 5);
});
