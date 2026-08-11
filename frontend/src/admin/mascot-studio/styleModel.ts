import type { MascotDocument } from "./types";

export const MASCOT_STYLE_STORAGE_KEY = "koda_mascot_styles_v1";
export const HIDDEN_MASCOT_PRESETS_STORAGE_KEY = "koda_hidden_mascot_presets_v1";

export interface MascotStyleRecord {
  id: string;
  name: string;
  document: MascotDocument;
  createdAt: string;
  updatedAt: string;
}

export const loadMascotStyles = (): MascotStyleRecord[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MASCOT_STYLE_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveMascotStyle = (style: MascotStyleRecord): MascotStyleRecord[] => {
  const styles = loadMascotStyles();
  const next = styles.some((entry) => entry.id === style.id)
    ? styles.map((entry) => entry.id === style.id ? style : entry)
    : [style, ...styles];
  localStorage.setItem(MASCOT_STYLE_STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const deleteMascotStyle = (styleId: string): MascotStyleRecord[] => {
  const next = loadMascotStyles().filter((style) => style.id !== styleId);
  localStorage.setItem(MASCOT_STYLE_STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const loadHiddenMascotPresetIds = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HIDDEN_MASCOT_PRESETS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [];
  } catch {
    return [];
  }
};

export const saveHiddenMascotPresetIds = (ids: string[]): string[] => {
  const next = [...new Set(ids.filter(Boolean))];
  localStorage.setItem(HIDDEN_MASCOT_PRESETS_STORAGE_KEY, JSON.stringify(next));
  return next;
};

/** Clone template visuals while remapping every internal reference for safe reuse. */
export const cloneMascotStyleVisual = (template: MascotDocument) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const layerIds = new Map(template.layers.map((layer) => [layer.id, `${layer.id}-${nonce}`]));
  const groupIds = new Map((template.groups ?? []).map((group) => [group.id, `${group.id}-${nonce}`]));
  const clipIds = new Map((template.clips ?? []).map((clip) => [clip.id, `${clip.id}-${nonce}`]));
  const remapParent = (parentId?: string | null) => parentId ? groupIds.get(parentId) ?? null : null;
  const layers = template.layers.map((layer) => ({ ...layer, id: layerIds.get(layer.id)!, parentId: remapParent(layer.parentId) }));
  const groups = (template.groups ?? []).map((group) => ({ ...group, id: groupIds.get(group.id)!, parentId: remapParent(group.parentId) }));
  const anchors = (template.anchors ?? []).map((anchor) => ({ ...anchor, id: `${anchor.id}-${nonce}`, parentId: remapParent(anchor.parentId) }));
  const clips = (template.clips ?? []).map((clip) => ({ ...clip, id: clipIds.get(clip.id)!, keyframes: clip.keyframes.map((frame) => ({ ...frame, id: `${frame.id}-${nonce}`, targetId: frame.targetType === "layer" ? layerIds.get(frame.targetId) ?? frame.targetId : groupIds.get(frame.targetId) ?? frame.targetId })) }));
  return {
    palette: { ...template.palette },
    behavior: template.behavior ? { ...template.behavior, spring: { ...template.behavior.spring } } : undefined,
    layers,
    groups,
    anchors,
    clips,
    activeClipId: template.activeClipId ? clipIds.get(template.activeClipId) ?? null : null,
  };
};
