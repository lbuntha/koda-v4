import type { MascotAnimationClip, MascotDocument, MascotGroup, MascotKeyframe, MascotKeyframeEasing, MascotLayer } from "./types";

type AnimatedValues = Required<Pick<MascotLayer, "x" | "y" | "scale" | "scaleX" | "scaleY" | "rotation" | "opacity">>;
type AnimatedBase = Pick<MascotLayer, "x" | "y" | "scale" | "rotation" | "opacity"> & Partial<Pick<MascotLayer, "scaleX" | "scaleY">>;

const ease = (value: number, easing: MascotKeyframeEasing): number => {
  if (easing === "easeIn") return value * value;
  if (easing === "easeOut") return 1 - (1 - value) * (1 - value);
  if (easing === "easeInOut") return value < .5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  return value;
};

const valuesFrom = (target: MascotLayer | MascotGroup): AnimatedValues => ({ x: target.x, y: target.y, scale: target.scale, scaleX: target.scaleX ?? 1, scaleY: target.scaleY ?? 1, rotation: target.rotation, opacity: target.opacity });

export const sampleKeyframes = (base: AnimatedBase, keyframes: MascotKeyframe[], time: number): AnimatedValues => {
  const normalizedBase: AnimatedValues = { ...base, scaleX: base.scaleX ?? 1, scaleY: base.scaleY ?? 1 };
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return normalizedBase;
  const before = [...sorted].reverse().find((frame) => frame.time <= time);
  const after = sorted.find((frame) => frame.time >= time);
  const leftTime = before?.time ?? 0;
  const rightTime = after?.time ?? leftTime;
  const left = { ...normalizedBase, ...(before?.values ?? {}) };
  if (!after || rightTime <= leftTime) return left;
  const right = { ...normalizedBase, ...after.values };
  const progress = ease(Math.max(0, Math.min(1, (time - leftTime) / (rightTime - leftTime))), after.easing);
  return {
    x: left.x + (right.x - left.x) * progress,
    y: left.y + (right.y - left.y) * progress,
    scale: left.scale + (right.scale - left.scale) * progress,
    scaleX: left.scaleX + (right.scaleX - left.scaleX) * progress,
    scaleY: left.scaleY + (right.scaleY - left.scaleY) * progress,
    rotation: left.rotation + (right.rotation - left.rotation) * progress,
    opacity: left.opacity + (right.opacity - left.opacity) * progress,
  };
};

export const resolveMascotClip = (document: MascotDocument, clipRef?: string | null): MascotAnimationClip | null => {
  const clips = document.clips ?? [];
  const reference = clipRef ?? document.activeClipId;
  return clips.find((clip) => clip.id === reference || clip.name.toLowerCase() === reference?.toLowerCase()) ?? null;
};

export const applyMascotClipAtTime = (document: MascotDocument, clip: MascotAnimationClip | null, time: number): MascotDocument => {
  if (!clip || clip.keyframes.length === 0) return document;
  return {
    ...document,
    layers: document.layers.map((layer) => ({ ...layer, ...sampleKeyframes(valuesFrom(layer), clip.keyframes.filter((frame) => frame.targetType === "layer" && frame.targetId === layer.id), time) })),
    groups: (document.groups ?? []).map((group) => ({ ...group, ...sampleKeyframes(valuesFrom(group), clip.keyframes.filter((frame) => frame.targetType === "group" && frame.targetId === group.id), time) })),
  };
};

export const captureMascotKeyframe = (document: MascotDocument, clip: MascotAnimationClip, targetType: "layer" | "group", targetId: string, time: number, easing: MascotKeyframeEasing = "easeInOut"): MascotAnimationClip => {
  const target = targetType === "layer" ? document.layers.find((layer) => layer.id === targetId) : (document.groups ?? []).find((group) => group.id === targetId);
  if (!target) return clip;
  const roundedTime = Math.max(0, Math.min(clip.duration, Math.round(time * 100) / 100));
  const next: MascotKeyframe = { id: `keyframe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, time: roundedTime, targetType, targetId, easing, values: valuesFrom(target) };
  const withoutSameSlot = clip.keyframes.filter((frame) => !(frame.targetType === targetType && frame.targetId === targetId && Math.abs(frame.time - roundedTime) < .001));
  return { ...clip, keyframes: [...withoutSameSlot, next].sort((a, b) => a.time - b.time) };
};
