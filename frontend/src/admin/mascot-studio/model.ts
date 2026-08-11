import { DEFAULT_PALETTE, MASCOT_ASSETS } from "./catalog";
import type { MascotAssetDefinition, MascotDocument, MascotLayer, MascotPartCategory } from "./types";

export const MASCOT_STORAGE_KEY = "koda_mascot_studio_v1";

const placement: Record<MascotPartCategory, Pick<MascotLayer, "x" | "y" | "scale">> = {
  body: { x: 128, y: 143, scale: 1.25 },
  head: { x: 128, y: 137, scale: .72 },
  pattern: { x: 128, y: 151, scale: .82 },
  accessory: { x: 128, y: 72, scale: .82 },
  eyes: { x: 128, y: 126, scale: .72 },
  pupil: { x: 128, y: 126, scale: .72 },
  mouth: { x: 128, y: 164, scale: .6 },
};

const layerOrder: Record<MascotPartCategory, number> = {
  body: 0,
  pattern: 1,
  accessory: 2,
  head: 3,
  eyes: 4,
  pupil: 5,
  mouth: 6,
};

export const sortMascotLayers = (layers: MascotLayer[]) => [...layers].sort((a, b) => layerOrder[a.category] - layerOrder[b.category]);

export type MascotLayerOrderAction = "front" | "forward" | "backward" | "back";

/** Reorder a layer among siblings without crossing its group boundary. */
export const reorderMascotLayer = (layers: MascotLayer[], layerId: string, action: MascotLayerOrderAction): MascotLayer[] => {
  const layer = layers.find((entry) => entry.id === layerId);
  if (!layer) return layers;
  const parentId = layer.parentId ?? null;
  const siblings = layers.filter((entry) => (entry.parentId ?? null) === parentId);
  const currentPosition = siblings.findIndex((entry) => entry.id === layerId);
  if (currentPosition < 0) return layers;
  const targetPosition = action === "front"
    ? siblings.length - 1
    : action === "back"
      ? 0
      : Math.max(0, Math.min(siblings.length - 1, currentPosition + (action === "forward" ? 1 : -1)));
  if (targetPosition === currentPosition) return layers;

  const reorderedSiblings = [...siblings];
  const [moved] = reorderedSiblings.splice(currentPosition, 1);
  reorderedSiblings.splice(targetPosition, 0, moved);
  let siblingIndex = 0;
  return layers.map((entry) => (entry.parentId ?? null) === parentId ? reorderedSiblings[siblingIndex++] : entry);
};

export const slugifyMascotName = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "") || "untitled-mascot";

export const createLayer = (asset: MascotAssetDefinition): MascotLayer => ({
  id: `${asset.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  assetId: asset.id,
  category: asset.category,
  name: asset.name,
  ...placement[asset.category],
  rotation: 0,
  opacity: 1,
  visible: true,
  animation: asset.category === "eyes" ? "blink" : asset.category === "pupil" ? "look" : "none",
  animationIntensity: asset.category === "eyes" ? 88 : asset.category === "pupil" ? 4 : undefined,
  animationFeel: "smooth",
  duration: asset.category === "eyes" ? 4 : asset.category === "pupil" ? 3.8 : 1.5,
  delay: 0,
});

export const createLayersFromAssetIds = (assetIds: string[]): MascotLayer[] => sortMascotLayers(
  assetIds
    .map((id) => MASCOT_ASSETS.find((asset) => asset.id === id))
    .filter((asset): asset is MascotAssetDefinition => Boolean(asset))
    .map(createLayer),
);

export const createMascotDocument = (): MascotDocument => {
  const now = new Date().toISOString();
  const assets = ["body-boulder", "accessory-antenna", "eyes-even", "mouth-laugh"]
    .map((id) => MASCOT_ASSETS.find((asset) => asset.id === id))
    .filter((asset): asset is MascotAssetDefinition => Boolean(asset));
  return {
    schemaVersion: 1,
    id: `mascot-${Date.now()}`,
    name: "Koda Spark",
    slug: "koda-spark",
    purpose: "custom",
    description: "A cheerful Koda guide for celebrations and learning moments.",
    tags: ["guide", "friendly"],
    canvas: { width: 256, height: 256, viewBox: "0 0 256 256" },
    palette: { ...DEFAULT_PALETTE },
    behavior: { animation: "float", duration: 2.4, intensity: 6, loop: true, spring: { stiffness: 240, damping: 20, mass: .7 } },
    groups: [],
    anchors: [],
    clips: [{ id: "clip-idle", name: "Idle", duration: 2, loop: true, keyframes: [] }],
    activeClipId: "clip-idle",
    layers: sortMascotLayers(assets.map(createLayer)),
    createdAt: now,
    updatedAt: now,
  };
};

/** Create an empty workspace without changing the default starter document. */
export const createBlankMascotDocument = (): MascotDocument => {
  const document = createMascotDocument();
  return {
    ...document,
    name: "Untitled Koda",
    slug: "untitled-koda",
    description: "",
    tags: [],
    behavior: { ...document.behavior!, animation: "none", intensity: 0 },
    groups: [],
    anchors: [],
    clips: [],
    activeClipId: null,
    layers: [],
  };
};

export const loadMascotDrafts = (): MascotDocument[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MASCOT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map((draft) => ({ purpose: "custom", ...draft })) : [];
  } catch {
    return [];
  }
};

export const deleteMascotDraft = (mascotId: string): MascotDocument[] => {
  const next = loadMascotDrafts().filter((draft) => draft.id !== mascotId);
  localStorage.setItem(MASCOT_STORAGE_KEY, JSON.stringify(next));
  return next;
};

export const saveMascotDraft = (document: MascotDocument): MascotDocument[] => {
  const drafts = loadMascotDrafts();
  const index = drafts.findIndex((draft) => draft.id === document.id);
  const next = index >= 0 ? drafts.map((draft) => draft.id === document.id ? document : draft) : [document, ...drafts];
  localStorage.setItem(MASCOT_STORAGE_KEY, JSON.stringify(next));
  return next;
};
