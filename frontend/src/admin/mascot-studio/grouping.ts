import type { MascotGroup, MascotKeyframe, MascotLayer, MascotPoint } from "./types";

const rotateScale = (point: MascotPoint, scale: number, degrees: number): MascotPoint => {
  const radians = degrees * Math.PI / 180;
  return { x: scale * (point.x * Math.cos(radians) - point.y * Math.sin(radians)), y: scale * (point.x * Math.sin(radians) + point.y * Math.cos(radians)) };
};

export const transformMascotPoint = (group: MascotGroup, point: MascotPoint): MascotPoint => {
  const local = { x: (point.x - group.pivot.x) * (group.scaleX ?? 1), y: (point.y - group.pivot.y) * (group.scaleY ?? 1) };
  const relative = rotateScale(local, group.scale, group.rotation);
  return { x: group.pivot.x + relative.x + group.x, y: group.pivot.y + relative.y + group.y };
};

export const bakeLayerOutOfGroup = (group: MascotGroup, layer: MascotLayer): MascotLayer => ({
  ...layer,
  ...transformMascotPoint(group, layer),
  parentId: group.parentId ?? null,
  scale: layer.scale * group.scale,
  scaleX: (layer.scaleX ?? 1) * (group.scaleX ?? 1),
  scaleY: (layer.scaleY ?? 1) * (group.scaleY ?? 1),
  rotation: layer.rotation + group.rotation,
  opacity: layer.opacity * group.opacity,
  visible: layer.visible && group.visible,
});

export const bakeLayerKeyframeOutOfGroup = (group: MascotGroup, layer: MascotLayer, keyframe: MascotKeyframe): MascotKeyframe => {
  const baked = bakeLayerOutOfGroup(group, { ...layer, ...keyframe.values });
  return { ...keyframe, values: { x: baked.x, y: baked.y, scale: baked.scale, scaleX: baked.scaleX, scaleY: baked.scaleY, rotation: baked.rotation, opacity: baked.opacity } };
};

/** Compose a child group into its parent while keeping the child's chosen pivot. */
export const bakeChildGroupOutOfGroup = (parent: MascotGroup, child: MascotGroup): MascotGroup => {
  const childOrigin = transformMascotPoint(child, { x: 0, y: 0 });
  const combinedOrigin = transformMascotPoint(parent, childOrigin);
  const scale = parent.scale * child.scale;
  const rotation = parent.rotation + child.rotation;
  const rotatedPivot = rotateScale(child.pivot, scale, rotation);
  return { ...child, parentId: parent.parentId ?? null, x: combinedOrigin.x - child.pivot.x + rotatedPivot.x, y: combinedOrigin.y - child.pivot.y + rotatedPivot.y, scale, scaleX: (parent.scaleX ?? 1) * (child.scaleX ?? 1), scaleY: (parent.scaleY ?? 1) * (child.scaleY ?? 1), rotation, opacity: parent.opacity * child.opacity, visible: parent.visible && child.visible };
};

export const bakeGroupKeyframeOutOfGroup = (parent: MascotGroup, child: MascotGroup, keyframe: MascotKeyframe): MascotKeyframe => {
  const baked = bakeChildGroupOutOfGroup(parent, { ...child, ...keyframe.values });
  return { ...keyframe, values: { x: baked.x, y: baked.y, scale: baked.scale, scaleX: baked.scaleX, scaleY: baked.scaleY, rotation: baked.rotation, opacity: baked.opacity } };
};
