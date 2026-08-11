import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, CheckSquare2, Code2, Copy, Crosshair, Download, Eye, EyeOff, FileJson, Film, Group as GroupIcon, KeyRound, Layers3,
  Pause, Play, Plus, RotateCcw, Save, Sparkles, Square, Trash2, Ungroup,
} from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmModal, Input, Label, Select, Switch, Tabs, TabsList, TabsTrigger } from "../../components/ui";
import { isApiConfigured, isOfflineError } from "../../api/client";
import { mascotsApi } from "../../api/mascots";
import { mascotStylesApi } from "../../api/mascotStyles";
import { useSvgLibrary } from "../../assets/SvgLibraryContext";
import { createSvgAssetId } from "../../assets/svgIds";
import { cn } from "../../lib/utils";
import { CATEGORY_LABELS, DEFAULT_PALETTE, MASCOT_ASSETS, MascotAssetArt } from "./catalog";
import { createBlankMascotDocument, createLayer, createLayersFromAssetIds, createMascotDocument, deleteMascotDraft, loadMascotDrafts, reorderMascotLayer, saveMascotDraft, slugifyMascotName, sortMascotLayers, type MascotLayerOrderAction } from "./model";
import { MascotCanvas } from "./MascotCanvas";
import { instantiateMascotStyle, MASCOT_STYLE_PRESETS, type MascotStylePreset } from "./presets";
import { refreshStudioMascots } from "../../features/koda-mascot";
import { cloneMascotStyleVisual, deleteMascotStyle, loadHiddenMascotPresetIds, loadMascotStyles, saveHiddenMascotPresetIds, saveMascotStyle, type MascotStyleRecord } from "./styleModel";
import { bakeChildGroupOutOfGroup, bakeGroupKeyframeOutOfGroup, bakeLayerKeyframeOutOfGroup, bakeLayerOutOfGroup, transformMascotPoint } from "./grouping";
import { behaviorMotionTarget } from "../../features/koda-mascot/KodaMascot";
import { applyMascotClipAtTime, captureMascotKeyframe, resolveMascotClip, sampleKeyframes } from "../../features/koda-mascot/clips";
import { defaultLayerAnimationIntensity, mascotGroupTransform } from "../../features/koda-mascot/KodaSvgRenderer";
import type { MascotAnchor, MascotAnimation, MascotAnimationClip, MascotBehavior, MascotDocument, MascotGroup, MascotKeyframeEasing, MascotLayer, MascotMotionFeel, MascotPartCategory, MascotPurpose } from "./types";

type CollectionId = MascotPartCategory | "styles";
type DeleteTarget =
  | { kind: "builtInStyle"; preset: MascotStylePreset }
  | { kind: "customStyle"; style: MascotStyleRecord }
  | { kind: "mascot"; document: MascotDocument }
  | { kind: "layer"; layer: MascotLayer };
const CATEGORIES: Array<{ id: CollectionId; label: string }> = [
  { id: "styles", label: "Styles" },
  ...(Object.keys(CATEGORY_LABELS) as MascotPartCategory[]).map((id) => ({ id, label: CATEGORY_LABELS[id] })),
];
const ANIMATIONS: MascotAnimation[] = ["none", "bounce", "float", "wiggle", "pulse", "blink", "look", "spin"];
const MOTION_FEELS: Array<{ id: MascotMotionFeel; label: string }> = [{ id: "smooth", label: "Smooth" }, { id: "spring", label: "Spring" }, { id: "snappy", label: "Snappy" }, { id: "linear", label: "Linear" }];
const PURPOSES: MascotPurpose[] = ["happy", "welcome", "sad", "excited", "loading", "waiting", "custom"];
const BEHAVIOR_ANIMATIONS: MascotBehavior["animation"][] = ["none", "bounce", "float", "wiggle", "pulse", "spin"];
const DEFAULT_BEHAVIOR: MascotBehavior = { animation: "float", duration: 2.4, intensity: 6, loop: true, spring: { stiffness: 240, damping: 20, mass: .7 } };

const animateStyleLayers = (presetId: string, layers: MascotLayer[]): MascotLayer[] => layers.map((layer) => {
  if (presetId === "galaxy" && layer.category === "pattern") return { ...layer, animation: "pulse", duration: 1.8 };
  if (presetId === "galaxy" && layer.category === "accessory") return { ...layer, animation: "wiggle", duration: 2.4 };
  if (presetId === "sunny" && layer.category === "body") return { ...layer, animation: "float", duration: 2.8 };
  if (presetId === "sunny" && layer.category === "accessory") return { ...layer, animation: "bounce", duration: 2 };
  if (presetId === "mint" && layer.category === "body") return { ...layer, animation: "pulse", duration: 3 };
  if (presetId === "mint" && layer.category === "accessory") return { ...layer, animation: "wiggle", duration: 3.2 };
  if (presetId === "berry" && layer.category === "body") return { ...layer, animation: "bounce", duration: 1.4 };
  if (presetId === "berry" && layer.category === "accessory") return { ...layer, animation: "wiggle", duration: 1.2 };
  if (presetId === "ocean" && layer.category === "body") return { ...layer, animation: "float", duration: 3.6 };
  if (presetId === "ocean" && layer.category === "pattern") return { ...layer, animation: "pulse", duration: 2.6 };
  if (presetId === "classic" && layer.category === "body") return { ...layer, animation: "bounce", duration: 2.4 };
  if (presetId === "classic" && layer.category === "accessory") return { ...layer, animation: "float", duration: 2 };
  return layer;
});

const downloadText = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const NumberControl: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between"><Label>{label}</Label><span className="koda-admin-chip text-[#6D6997]">{value}</span></div>
    <Input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-2 cursor-pointer appearance-auto border-0 bg-transparent p-0 shadow-none" />
  </div>
);

const PaletteControl: React.FC<{ label: string; value: string; onChange: (value: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center gap-2 rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] p-2">
    <Input aria-label={`${label} color`} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-9 cursor-pointer rounded-lg border-0 p-0" />
    <span className="min-w-0"><span className="koda-admin-label block text-[#0E0B55]">{label}</span><span className="koda-admin-chip block text-[#8D89AE]">{value.toUpperCase()}</span></span>
  </label>
);

export const MascotStudioPage: React.FC<{ onOpenSvgAssets?: () => void }> = ({ onOpenSvgAssets }) => {
  const { assets: editableSvgAssets, setAssets: setEditableSvgAssets, persistenceStatus: svgPersistenceStatus } = useSvgLibrary();
  const [document, setDocument] = useState<MascotDocument>(() => createMascotDocument());
  const [drafts, setDrafts] = useState<MascotDocument[]>(() => loadMascotDrafts());
  const [customStyles, setCustomStyles] = useState<MascotStyleRecord[]>(() => loadMascotStyles());
  const [hiddenPresetIds, setHiddenPresetIds] = useState<string[]>(() => loadHiddenMascotPresetIds());
  const [serverStyleIds, setServerStyleIds] = useState<string[]>([]);
  const [activeCustomStyleId, setActiveCustomStyleId] = useState<string | null>(null);
  const [serverMascotIds, setServerMascotIds] = useState<string[]>([]);
  const [category, setCategory] = useState<CollectionId>("styles");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(() => document.layers.at(-1)?.id ?? null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [markedLayerIds, setMarkedLayerIds] = useState<string[]>([]);
  const [playhead, setPlayhead] = useState(0);
  const [keyframeEasing, setKeyframeEasing] = useState<MascotKeyframeEasing>("easeInOut");
  const [playing, setPlaying] = useState(true);
  const [savingStyle, setSavingStyle] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saveStyleName, setSaveStyleName] = useState("");
  const [isSaveStyleConfirmOpen, setIsSaveStyleConfirmOpen] = useState(false);
  const [layerContextMenu, setLayerContextMenu] = useState<{ layerId: string; x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const allAssets = useMemo(() => [
    ...MASCOT_ASSETS,
    ...editableSvgAssets
      .filter((asset) => asset.mascotCategory)
      .map((asset) => ({ id: asset.id, name: asset.label, category: asset.mascotCategory!, markup: asset.markup, markupScale: asset.scale })),
  ], [editableSvgAssets]);
  const assets = useMemo(() => category === "styles" ? [] : allAssets.filter((asset) => asset.category === category), [allAssets, category]);
  const stylePreviews = useMemo(() => {
    const base = createMascotDocument();
    return MASCOT_STYLE_PRESETS.filter((preset) => !hiddenPresetIds.includes(preset.id)).map((preset) => {
      const composed = instantiateMascotStyle(preset, animateStyleLayers(preset.id, createLayersFromAssetIds(preset.assetIds)));
      return { preset, document: { ...base, ...composed, palette: preset.palette } };
    });
  }, [hiddenPresetIds]);
  const selectedLayer = document.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedAsset = selectedLayer ? allAssets.find((asset) => asset.id === selectedLayer.assetId) : null;
  const selectedGroup = (document.groups ?? []).find((group) => group.id === selectedGroupId) ?? null;
  const selectedAnchor = (document.anchors ?? []).find((anchor) => anchor.id === selectedAnchorId) ?? null;
  const markedLayers = document.layers.filter((layer) => markedLayerIds.includes(layer.id));
  const canGroupMarked = markedLayers.length >= 2 && new Set(markedLayers.map((layer) => layer.parentId ?? null)).size === 1;
  const behavior = document.behavior ?? DEFAULT_BEHAVIOR;
  const activeClip = resolveMascotClip(document);
  const framedDocument = useMemo(() => applyMascotClipAtTime(document, activeClip, playhead), [activeClip, document, playhead]);
  const metadata = useMemo(() => JSON.stringify(document, null, 2), [document]);

  useEffect(() => {
    if (!isApiConfigured()) return;
    let active = true;
    mascotsApi.list().then((rows) => {
      if (!active || rows.length === 0) return;
      setDrafts(rows);
      setServerMascotIds(rows.map((row) => row.id));
      setDocument(rows[0]);
      setSelectedLayerId(rows[0].layers.at(-1)?.id ?? null);
      rows.forEach(saveMascotDraft);
      setPersistenceError(null);
    }).catch((error) => {
      if (active && !isOfflineError(error)) setPersistenceError(error instanceof Error ? error.message : "Could not load mascots");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isApiConfigured()) return;
    let active = true;
    mascotStylesApi.getHiddenPresets().then(({ ids }) => {
      if (!active) return;
      setHiddenPresetIds(saveHiddenMascotPresetIds(ids));
      setPersistenceError(null);
    }).catch((error) => {
      if (active && !isOfflineError(error)) setPersistenceError(error instanceof Error ? error.message : "Could not load removed built-in styles");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isApiConfigured()) return;
    let active = true;
    mascotStylesApi.list().then((rows) => {
      if (!active) return;
      setServerStyleIds(rows.map((style) => style.id));
      if (rows.length > 0) {
        setCustomStyles(rows);
        rows.forEach(saveMascotStyle);
      }
    }).catch((error) => {
      if (active && !isOfflineError(error)) setPersistenceError(error instanceof Error ? error.message : "Could not load mascot styles");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!layerContextMenu) return;
    const dismiss = () => setLayerContextMenu(null);
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("keydown", dismissOnEscape);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("keydown", dismissOnEscape);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [layerContextMenu]);

  useEffect(() => {
    if (!playing || !activeClip || activeClip.keyframes.length === 0) return;
    let frame = 0;
    const duration = Math.max(.05, activeClip.duration);
    const startedAt = performance.now() - playhead * 1000;
    const tick = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      if (!activeClip.loop && elapsed >= duration) { setPlayhead(duration); return; }
      setPlayhead(activeClip.loop ? elapsed % duration : elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeClip?.id, activeClip?.duration, activeClip?.loop, activeClip?.keyframes.length, playing]);

  const updateDocument = (patch: Partial<MascotDocument>) => setDocument((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  const updateLayer = (id: string, patch: Partial<MascotLayer>) => setDocument((current) => ({
    ...current,
    updatedAt: new Date().toISOString(),
    layers: current.layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer),
  }));
  const updateGroup = (id: string, patch: Partial<MascotGroup>) => setDocument((current) => ({ ...current, updatedAt: new Date().toISOString(), groups: (current.groups ?? []).map((group) => group.id === id ? { ...group, ...patch } : group) }));
  const updateAnchor = (id: string, patch: Partial<MascotAnchor>) => setDocument((current) => ({ ...current, updatedAt: new Date().toISOString(), anchors: (current.anchors ?? []).map((anchor) => anchor.id === id ? { ...anchor, ...patch } : anchor) }));
  const updateClip = (clipId: string, patch: Partial<MascotAnimationClip>) => setDocument((current) => ({ ...current, updatedAt: new Date().toISOString(), clips: (current.clips ?? []).map((clip) => clip.id === clipId ? { ...clip, ...patch } : clip) }));

  const createClip = () => {
    const clip: MascotAnimationClip = { id: `clip-${Date.now()}`, name: `Clip ${(document.clips ?? []).length + 1}`, duration: 2, loop: true, keyframes: [] };
    updateDocument({ clips: [...(document.clips ?? []), clip], activeClipId: clip.id });
    setPlayhead(0);
  };

  const deleteActiveClip = () => {
    if (!activeClip) return;
    const clips = (document.clips ?? []).filter((clip) => clip.id !== activeClip.id);
    updateDocument({ clips, activeClipId: clips[0]?.id ?? null });
    setPlayhead(0);
  };

  const captureKeyframe = () => {
    if (!activeClip) return;
    const targetType = selectedGroup ? "group" : selectedLayer ? "layer" : null;
    const targetId = selectedGroup?.id ?? selectedLayer?.id;
    if (!targetType || !targetId) return;
    updateClip(activeClip.id, captureMascotKeyframe(document, activeClip, targetType, targetId, playhead, keyframeEasing));
  };

  const groupMarkedLayers = () => {
    const chosen = document.layers.filter((layer) => markedLayerIds.includes(layer.id));
    if (chosen.length < 2) return;
    const parentIds = new Set(chosen.map((layer) => layer.parentId ?? null));
    if (parentIds.size > 1) return;
    const id = `group-${Date.now()}`;
    const group: MascotGroup = { id, name: `Group ${(document.groups ?? []).length + 1}`, parentId: chosen[0].parentId ?? null, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, pivot: { x: chosen.reduce((sum, layer) => sum + layer.x, 0) / chosen.length, y: chosen.reduce((sum, layer) => sum + layer.y, 0) / chosen.length } };
    updateDocument({ groups: [...(document.groups ?? []), group], layers: document.layers.map((layer) => markedLayerIds.includes(layer.id) ? { ...layer, parentId: id } : layer) });
    setSelectedGroupId(id);
    setSelectedLayerId(null);
    setMarkedLayerIds([]);
  };

  const ungroupSelected = () => {
    if (!selectedGroup) return;
    setDocument((current) => {
      const childLayers = current.layers.filter((layer) => layer.parentId === selectedGroup.id);
      const childGroups = (current.groups ?? []).filter((group) => group.parentId === selectedGroup.id);
      return { ...current, groups: (current.groups ?? []).filter((group) => group.id !== selectedGroup.id).map((group) => group.parentId === selectedGroup.id ? bakeChildGroupOutOfGroup(selectedGroup, group) : group), layers: current.layers.map((layer) => layer.parentId === selectedGroup.id ? bakeLayerOutOfGroup(selectedGroup, layer) : layer), anchors: (current.anchors ?? []).map((anchor) => anchor.parentId === selectedGroup.id ? { ...anchor, ...transformMascotPoint(selectedGroup, anchor), parentId: selectedGroup.parentId ?? null } : anchor), clips: (current.clips ?? []).map((clip) => ({ ...clip, keyframes: clip.keyframes.flatMap((frame) => { if (frame.targetType === "group" && frame.targetId === selectedGroup.id) return []; const layer = childLayers.find((candidate) => frame.targetType === "layer" && candidate.id === frame.targetId); if (layer) return [bakeLayerKeyframeOutOfGroup(selectedGroup, layer, frame)]; const group = childGroups.find((candidate) => frame.targetType === "group" && candidate.id === frame.targetId); return group ? [bakeGroupKeyframeOutOfGroup(selectedGroup, group, frame)] : [frame]; }) })), updatedAt: new Date().toISOString() };
    });
    setSelectedGroupId(null);
  };

  const addAnchor = () => {
    const point = selectedGroup?.pivot ?? (selectedLayer ? { x: selectedLayer.x, y: selectedLayer.y } : { x: 128, y: 128 });
    const anchor: MascotAnchor = { id: `anchor-${Date.now()}`, name: `Anchor ${(document.anchors ?? []).length + 1}`, ...point, parentId: selectedGroup?.id ?? selectedLayer?.parentId ?? null };
    updateDocument({ anchors: [...(document.anchors ?? []), anchor] });
    setSelectedAnchorId(anchor.id);
    setSelectedLayerId(null);
    setSelectedGroupId(null);
  };

  const addAsset = (assetId: string) => {
    const asset = allAssets.find((entry) => entry.id === assetId);
    if (!asset) return;
    const layer = createLayer(asset);
    setDocument((current) => {
      const exclusiveCategories: MascotPartCategory[] = asset.category === "head"
        ? ["head", "eyes", "pupil", "mouth"]
        : asset.category === "eyes" || asset.category === "mouth"
          ? [asset.category, "head"]
          : asset.category === "pupil"
            ? ["pupil", "head"]
          : asset.category === "body"
            ? ["body"]
            : [];
      const withoutExclusive = exclusiveCategories.length
        ? current.layers.filter((entry) => !exclusiveCategories.includes(entry.category))
        : current.layers;
      const removed = current.layers.filter((entry) => exclusiveCategories.includes(entry.category));
      const clips = (current.clips ?? []).map((clip) => ({ ...clip, keyframes: clip.keyframes.flatMap((frame) => {
        const removedLayer = removed.find((entry) => frame.targetType === "layer" && entry.id === frame.targetId);
        if (!removedLayer) return [frame];
        return removedLayer.category === asset.category ? [{ ...frame, targetId: layer.id }] : [];
      }) }));
      return { ...current, clips, layers: sortMascotLayers([...withoutExclusive, layer]), updatedAt: new Date().toISOString() };
    });
    setSelectedLayerId(layer.id);
  };

  const applyStyle = (preset: MascotStylePreset) => {
    const composed = instantiateMascotStyle(preset, animateStyleLayers(preset.id, createLayersFromAssetIds(preset.assetIds)));
    updateDocument({ purpose: "custom", palette: { ...preset.palette }, groups: composed.groups, anchors: [], clips: composed.clips, activeClipId: composed.activeClipId, behavior: composed.behavior ?? DEFAULT_BEHAVIOR, layers: composed.layers });
    setSelectedLayerId(composed.layers.at(-1)?.id ?? null);
    setSelectedGroupId(null);
    setActiveCustomStyleId(null);
    setPlayhead(0);
    setPlaying(true);
  };

  const applyCustomStyle = (style: MascotStyleRecord) => {
    const visual = cloneMascotStyleVisual(style.document);
    updateDocument(visual);
    setSelectedLayerId(visual.layers.at(-1)?.id ?? null);
    setSelectedGroupId(null);
    setSelectedAnchorId(null);
    setActiveCustomStyleId(style.id);
    setPlayhead(0);
    setPlaying(true);
  };

  /**
   * Every write to the style shelf goes through here.
   *
   * Saving a style is not only a change to this page: any canvas open behind it
   * — a slide preview, another tab of the studio — resolved its Koda from that
   * shelf and has no other way to learn the artwork moved. So the same call that
   * updates local state tells the rest of the app to re-resolve, and the two
   * cannot drift because there is one place to forget.
   */
  const publishStyles = (styles: MascotStyleRecord[]): MascotStyleRecord[] => {
    refreshStudioMascots();
    return styles;
  };

  const saveCurrentAsStyle = async () => {
    const name = saveStyleName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const style: MascotStyleRecord = { id: `mascot-style-${Date.now()}`, name, document: JSON.parse(JSON.stringify(document)) as MascotDocument, createdAt: now, updatedAt: now };
    setSavingStyle(true);
    try {
      const saved = isApiConfigured() ? await mascotStylesApi.create(style) : style;
      setCustomStyles(publishStyles(saveMascotStyle(saved)));
      setServerStyleIds((current) => current.includes(saved.id) ? current : [...current, saved.id]);
      setActiveCustomStyleId(saved.id);
      setPersistenceError(null);
    } catch (error) {
      if (isOfflineError(error)) {
        setCustomStyles(publishStyles(saveMascotStyle(style)));
        setActiveCustomStyleId(style.id);
      } else {
        setPersistenceError(error instanceof Error ? error.message : "Could not save mascot style");
        throw error;
      }
    } finally {
      setSavingStyle(false);
    }
  };

  const updateCurrentStyle = async () => {
    const existing = customStyles.find((style) => style.id === activeCustomStyleId);
    if (!existing) return;
    const style: MascotStyleRecord = { ...existing, document: JSON.parse(JSON.stringify(document)) as MascotDocument, updatedAt: new Date().toISOString() };
    setSavingStyle(true);
    try {
      const saved = isApiConfigured() ? await (serverStyleIds.includes(style.id) ? mascotStylesApi.update(style) : mascotStylesApi.create(style)) : style;
      setCustomStyles(publishStyles(saveMascotStyle(saved)));
      setServerStyleIds((current) => current.includes(saved.id) ? current : [...current, saved.id]);
      setPersistenceError(null);
    } catch (error) {
      if (isOfflineError(error)) setCustomStyles(publishStyles(saveMascotStyle(style)));
      else setPersistenceError(error instanceof Error ? error.message : "Could not update mascot style");
    } finally {
      setSavingStyle(false);
    }
  };

  const removeCustomStyle = async (style: MascotStyleRecord) => {
    try {
      if (isApiConfigured() && serverStyleIds.includes(style.id)) await mascotStylesApi.delete(style.id);
      setCustomStyles(publishStyles(deleteMascotStyle(style.id)));
      setServerStyleIds((current) => current.filter((id) => id !== style.id));
      if (activeCustomStyleId === style.id) setActiveCustomStyleId(null);
      setPersistenceError(null);
    } catch (error) {
      if (isOfflineError(error)) {
        setCustomStyles(publishStyles(deleteMascotStyle(style.id)));
        if (activeCustomStyleId === style.id) setActiveCustomStyleId(null);
      } else {
        setPersistenceError(error instanceof Error ? error.message : "Could not delete mascot style");
        throw error;
      }
    }
  };

  const persistHiddenPresetIds = async (ids: string[], errorMessage: string) => {
    try {
      const next = isApiConfigured() ? (await mascotStylesApi.updateHiddenPresets(ids)).ids : ids;
      setHiddenPresetIds(saveHiddenMascotPresetIds(next));
      setPersistenceError(null);
    } catch (error) {
      if (isOfflineError(error)) setHiddenPresetIds(saveHiddenMascotPresetIds(ids));
      else {
        setPersistenceError(error instanceof Error ? error.message : errorMessage);
        throw error;
      }
    }
  };

  const removeBuiltInStyle = async (preset: MascotStylePreset) => {
    await persistHiddenPresetIds([...hiddenPresetIds, preset.id], "Could not remove built-in style");
  };

  const restoreBuiltInStyles = async () => {
    await persistHiddenPresetIds([], "Could not restore built-in styles");
  };

  const reorder = (id: string, action: MascotLayerOrderAction) => setDocument((current) => ({
    ...current,
    layers: reorderMascotLayer(current.layers, id, action),
    updatedAt: new Date().toISOString(),
  }));

  const removeLayer = (id: string) => {
    setDocument((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== id), clips: (current.clips ?? []).map((clip) => ({ ...clip, keyframes: clip.keyframes.filter((frame) => !(frame.targetType === "layer" && frame.targetId === id)) })), updatedAt: new Date().toISOString() }));
    setSelectedLayerId(null);
  };

  const editSvgSource = (layer: MascotLayer) => {
    const existing = editableSvgAssets.find((asset) => asset.id === layer.assetId);
    if (!existing) {
      const tile = window.document.querySelector(`[data-mascot-asset-id="${CSS.escape(layer.assetId)}"] svg`);
      let clone = tile instanceof SVGSVGElement ? tile.cloneNode(true) as SVGSVGElement : null;
      if (!clone) {
        const liveLayer = svgRef.current?.querySelector(`[data-mascot-layer-id="${CSS.escape(layer.id)}"]`);
        if (liveLayer instanceof SVGGElement) {
          clone = window.document.createElementNS("http://www.w3.org/2000/svg", "svg");
          clone.setAttribute("viewBox", "0 0 128 128");
          const art = liveLayer.cloneNode(true) as SVGGElement;
          art.removeAttribute("transform");
          art.removeAttribute("opacity");
          art.querySelectorAll("animate, animateTransform, [data-mascot-editor]").forEach((node) => node.remove());
          clone.appendChild(art);
        }
      }
      if (clone) {
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        setEditableSvgAssets((current) => [...current, {
          id: createSvgAssetId(),
          label: `${layer.name} Editable`,
          markup: new XMLSerializer().serializeToString(clone),
          scale: 1,
          mascotCategory: layer.category,
        }]);
      }
    }
    onOpenSvgAssets?.();
  };

  const deleteMascot = async (target: MascotDocument) => {
    try {
      if (isApiConfigured() && serverMascotIds.includes(target.id)) await mascotsApi.delete(target.id);
      const remaining = drafts.filter((draft) => draft.id !== target.id);
      deleteMascotDraft(target.id);
      setDrafts(remaining);
      setServerMascotIds((current) => current.filter((id) => id !== target.id));
      const next = remaining[0] ?? createMascotDocument();
      setDocument(next);
      setSelectedLayerId(next.layers.at(-1)?.id ?? null);
      setPersistenceError(null);
    } catch (error) {
      setPersistenceError(error instanceof Error ? error.message : "Could not delete mascot");
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "builtInStyle") await removeBuiltInStyle(deleteTarget.preset);
    else if (deleteTarget.kind === "customStyle") await removeCustomStyle(deleteTarget.style);
    else if (deleteTarget.kind === "mascot") await deleteMascot(deleteTarget.document);
    else removeLayer(deleteTarget.layer.id);
  };

  const beginSaveCurrentAsStyle = () => {
    setSaveStyleName(`${document.name} Style`);
    setIsSaveStyleConfirmOpen(true);
  };

  const beginNewMascot = () => {
    const next = createBlankMascotDocument();
    setDocument(next);
    setSelectedLayerId(null);
    setSelectedGroupId(null);
    setSelectedAnchorId(null);
    setMarkedLayerIds([]);
    setActiveCustomStyleId(null);
    setPlayhead(0);
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll("[data-mascot-editor]").forEach((node) => node.remove());
    if (activeClip && activeClip.keyframes.length > 0) {
      const namespace = "http://www.w3.org/2000/svg";
      const targets = new Map(activeClip.keyframes.map((frame) => [`${frame.targetType}:${frame.targetId}`, { type: frame.targetType, id: frame.targetId }]));
      targets.forEach((target) => {
        const source = target.type === "layer" ? document.layers.find((layer) => layer.id === target.id) : (document.groups ?? []).find((group) => group.id === target.id);
        const element = clone.querySelector(`[data-mascot-${target.type}-id="${CSS.escape(target.id)}"]`);
        if (!source || !(element instanceof SVGGElement)) return;
        const frames = activeClip.keyframes.filter((frame) => frame.targetType === target.type && frame.targetId === target.id);
        const clipDuration = Math.max(.1, activeClip.duration);
        const times = [...new Set([0, ...frames.map((frame) => Math.min(frame.time, clipDuration)), clipDuration])].sort((a, b) => a - b);
        const base = { x: source.x, y: source.y, scale: source.scale, scaleX: source.scaleX ?? 1, scaleY: source.scaleY ?? 1, rotation: source.rotation, opacity: source.opacity };
        const samples = times.map((time) => sampleKeyframes(base, frames, time));
        const transform = clone.ownerDocument.createElementNS(namespace, "animate");
        transform.setAttribute("attributeName", "transform");
        transform.setAttribute("dur", `${clipDuration}s`);
        transform.setAttribute("repeatCount", activeClip.loop ? "indefinite" : "1");
        transform.setAttribute("fill", "freeze");
        transform.setAttribute("keyTimes", times.map((time) => time / clipDuration).join(";"));
        transform.setAttribute("values", samples.map((sample) => target.type === "layer" ? `translate(${sample.x} ${sample.y}) rotate(${sample.rotation}) scale(${sample.scale * sample.scaleX} ${sample.scale * sample.scaleY}) translate(-64 -64)` : mascotGroupTransform({ ...(source as MascotGroup), ...sample })).join(";"));
        const opacity = clone.ownerDocument.createElementNS(namespace, "animate");
        opacity.setAttribute("attributeName", "opacity");
        opacity.setAttribute("dur", `${clipDuration}s`);
        opacity.setAttribute("repeatCount", activeClip.loop ? "indefinite" : "1");
        opacity.setAttribute("fill", "freeze");
        opacity.setAttribute("keyTimes", times.map((time) => time / clipDuration).join(";"));
        opacity.setAttribute("values", samples.map((sample) => sample.opacity).join(";"));
        element.append(transform, opacity);
      });
    }
    if (behavior.animation !== "none") {
      const namespace = "http://www.w3.org/2000/svg";
      const group = clone.ownerDocument.createElementNS(namespace, "g");
      [...clone.children].filter((child) => child.tagName.toLowerCase() !== "title").forEach((child) => group.appendChild(child));
      const animation = clone.ownerDocument.createElementNS(namespace, behavior.animation === "pulse" ? "animate" : "animateTransform");
      animation.setAttribute("dur", `${Math.max(.2, behavior.duration)}s`);
      animation.setAttribute("repeatCount", behavior.loop ? "indefinite" : "1");
      if (behavior.animation === "pulse") {
        animation.setAttribute("attributeName", "opacity");
        animation.setAttribute("values", `1;${Math.max(.25, 1 - behavior.intensity / 100)};1`);
      } else {
        animation.setAttribute("attributeName", "transform");
        animation.setAttribute("type", behavior.animation === "bounce" || behavior.animation === "float" ? "translate" : "rotate");
        const amount = Math.max(0, behavior.intensity);
        const values = behavior.animation === "bounce" ? `0 0;0 ${-amount};0 0`
          : behavior.animation === "float" ? `0 ${-amount / 2};0 ${amount / 2};0 ${-amount / 2}`
            : behavior.animation === "spin" ? "0 128 128;360 128 128"
              : `${-amount} 128 128;${amount} 128 128;${-amount} 128 128`;
        animation.setAttribute("values", values);
      }
      group.appendChild(animation);
      clone.appendChild(group);
    }
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "256");
    clone.setAttribute("height", "256");
    downloadText(`${document.slug}.svg`, new XMLSerializer().serializeToString(clone), "image/svg+xml");
  };

  const copyMetadata = async () => {
    await navigator.clipboard.writeText(metadata);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#FBFAFF] p-2.5 md:p-3 xl:overflow-hidden">
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
        <div className="grid min-h-[620px] flex-1 gap-3 xl:min-h-0 xl:grid-cols-[300px_minmax(0,1fr)_320px] xl:grid-rows-[minmax(0,1fr)]">
          <Card className="flex min-h-0 flex-col overflow-hidden xl:h-full">
            <CardHeader className="p-3 pb-2"><CardTitle className="koda-admin-card-title flex items-center gap-2 text-[#0E0B55]"><Sparkles size={15} className="text-[#7C6DD8]"/> Part collection</CardTitle></CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-3 pt-0">
              <Tabs value={category} onValueChange={(value) => setCategory(value as CollectionId)}>
                <TabsList className="w-full overflow-x-auto" aria-label="Mascot part collections">
                  {CATEGORIES.map((entry) => <TabsTrigger key={entry.id} value={entry.id} className="px-2.5 text-[10px]">{entry.label}</TabsTrigger>)}
                </TabsList>
              </Tabs>
              {category === "styles" ? (
                <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="xs" loading={savingStyle && !activeCustomStyleId} loadingText="Saving..." onClick={beginSaveCurrentAsStyle}><Save size={12}/> Save as style</Button>
                    <Button variant="outline" size="xs" loading={savingStyle && Boolean(activeCustomStyleId)} loadingText="Updating..." disabled={!activeCustomStyleId} onClick={updateCurrentStyle}>Update style</Button>
                  </div>
                  <p className="koda-admin-chip text-[#6D6997]">Select a built-in, edit it, then save your version.</p>
                  <div className="grid max-h-[480px] grid-cols-2 content-start gap-2 overflow-y-auto pr-1 xl:max-h-none xl:flex-1">
                    {customStyles.length > 0 && <p className="koda-admin-label col-span-2 text-[#0E0B55]">My styles</p>}
                    {customStyles.map((style) => (
                      <div key={style.id} className={cn("relative rounded-xl border-2 bg-white p-1.5", activeCustomStyleId === style.id ? "border-[#534AB7] bg-[#F3F0FF]" : "border-[#E7E3F6]")}>
                        <button type="button" onClick={() => applyCustomStyle(style)} className="block w-full text-left">
                          <div className="aspect-square overflow-hidden rounded-lg bg-[#F7F5FC]"><MascotCanvas document={style.document} selectedLayerId={null} playing assets={allAssets}/></div>
                          <span className="mt-1 block truncate pr-5 text-center text-[10px] font-medium text-[#0E0B55]">{style.name}</span>
                        </button>
                        <Button variant="ghost" size="icon" className="absolute bottom-0.5 right-0.5 h-6 w-6 text-rose-500" onClick={() => setDeleteTarget({ kind: "customStyle", style })} title={`Delete ${style.name}`}><Trash2 size={11}/></Button>
                      </div>
                    ))}
                    <div className="col-span-2 flex items-center justify-between gap-2">
                      <p className="koda-admin-label text-[#0E0B55]">Built-in starting points</p>
                      {hiddenPresetIds.length > 0 && <Button variant="link" size="xs" onClick={restoreBuiltInStyles}>Restore removed ({hiddenPresetIds.length})</Button>}
                    </div>
                    {stylePreviews.map(({ preset, document: previewDocument }) => (
                      <div key={preset.id} className="relative rounded-xl border-2 border-[#E7E3F6] bg-white p-1.5 transition-all hover:border-[#7C6DD8] hover:bg-[#F8F6FF]">
                        <button type="button" onClick={() => applyStyle(preset)} className="block w-full text-left">
                          <div className="aspect-square overflow-hidden rounded-lg bg-[#F7F5FC]"><MascotCanvas document={previewDocument} selectedLayerId={null} playing assets={allAssets}/></div>
                          <span className="mt-1 block truncate pr-5 text-center text-[10px] font-medium text-[#0E0B55]">{preset.name}</span>
                        </button>
                        <Button variant="ghost" size="icon" className="absolute bottom-0.5 right-0.5 h-6 w-6 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget({ kind: "builtInStyle", preset })} title={`Remove ${preset.name}`} aria-label={`Remove built-in style ${preset.name}`}><Trash2 size={11}/></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid max-h-[535px] grid-cols-3 content-start gap-1.5 overflow-y-auto pr-1 xl:max-h-none xl:flex-1">
                  {assets.map((asset) => {
                  const active = document.layers.some((layer) => layer.assetId === asset.id);
                  return (
                    <button key={asset.id} type="button" data-mascot-asset-id={asset.id} onClick={() => addAsset(asset.id)} title={asset.name} className={cn("group rounded-xl border-2 p-1.5 text-left transition-all", active ? "border-[#7C6DD8] bg-[#F3F0FF]" : "border-[#E7E3F6] bg-white hover:border-[#CFC7F2] hover:bg-[#FBFAFF]")}>
                      <div className="aspect-square rounded-lg bg-[linear-gradient(45deg,#F0EEF5_25%,transparent_25%),linear-gradient(-45deg,#F0EEF5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#F0EEF5_75%),linear-gradient(-45deg,transparent_75%,#F0EEF5_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0]">
                        <svg viewBox="0 0 128 128" className="h-full w-full"><MascotAssetArt asset={asset} palette={document.palette}/></svg>
                      </div>
                      <div className="mt-1 flex items-center gap-1"><span className="min-w-0 flex-1 truncate text-[9px] font-medium text-[#0E0B55]">{asset.name}</span>{active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#534AB7]" aria-label="Added"/>}</div>
                    </button>
                  );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="min-h-0 min-w-0 space-y-3 xl:h-full xl:overflow-y-auto xl:pr-1">
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between space-y-0 p-3">
                <CardTitle className="koda-admin-card-title text-[#0E0B55]">Live canvas</CardTitle>
                <Button variant={playing ? "secondary" : "default"} size="sm" onClick={() => setPlaying((value) => !value)}>{playing ? <><Pause size={14}/> Pause</> : <><Play size={14}/> Preview motion</>}</Button>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="mx-auto aspect-square w-full max-w-[430px] overflow-hidden rounded-2xl border-2 border-[#DCD5FA] bg-[linear-gradient(45deg,#F2F0F7_25%,transparent_25%),linear-gradient(-45deg,#F2F0F7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#F2F0F7_75%),linear-gradient(-45deg,transparent_75%,#F2F0F7_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] shadow-inner">
                  <motion.div
                    className="h-full w-full"
                    animate={playing ? behaviorMotionTarget(behavior) : { x: 0, y: 0, rotate: 0, scale: 1 }}
                    transition={playing ? { duration: behavior.duration, repeat: behavior.loop ? Infinity : 0, ease: "easeInOut" } : { duration: .15 }}
                  >
                    <MascotCanvas document={framedDocument} selectedLayerId={selectedLayerId} selectedGroupId={selectedGroupId} selectedAnchorId={selectedAnchorId} playing={playing} onSelectLayer={(id) => { setSelectedLayerId(id); setSelectedGroupId(null); setSelectedAnchorId(null); }} onSelectGroup={(id) => { setSelectedGroupId(id); setSelectedLayerId(null); setSelectedAnchorId(null); }} onSelectAnchor={(id) => { setSelectedAnchorId(id); setSelectedLayerId(null); setSelectedGroupId(null); }} onMoveLayer={(id, x, y) => updateLayer(id, { x, y })} onLayerContextMenu={(layerId, position) => setLayerContextMenu({ layerId, x: Math.max(8, Math.min(position.x, window.innerWidth - 184)), y: Math.max(8, Math.min(position.y, window.innerHeight - 218)) })} svgRef={svgRef} assets={allAssets}/>
                  </motion.div>
                </div>
              </CardContent>
            </Card>

            {selectedGroup && <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="koda-admin-card-title flex items-center gap-2 text-[#0E0B55]"><GroupIcon size={15} className="text-[#EF9F27]"/> Selected group</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 p-3 pt-0">
                <div className="flex gap-2"><Input className="h-9 flex-1" value={selectedGroup.name} onChange={(event) => updateGroup(selectedGroup.id, { name: event.target.value })}/><Switch size="sm" checked={selectedGroup.visible} onCheckedChange={(visible) => updateGroup(selectedGroup.id, { visible })}/></div>
                <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Offset X</Label><Input className="h-9" type="number" value={selectedGroup.x} onChange={(event) => updateGroup(selectedGroup.id, { x: Number(event.target.value) })}/></div><div className="space-y-1"><Label>Offset Y</Label><Input className="h-9" type="number" value={selectedGroup.y} onChange={(event) => updateGroup(selectedGroup.id, { y: Number(event.target.value) })}/></div></div>
                <NumberControl label="Group scale" value={selectedGroup.scale} min={.2} max={2} step={.05} onChange={(scale) => updateGroup(selectedGroup.id, { scale })}/>
                <NumberControl label="Group rotation" value={selectedGroup.rotation} min={-180} max={180} onChange={(rotation) => updateGroup(selectedGroup.id, { rotation })}/>
                <NumberControl label="Group opacity" value={selectedGroup.opacity} min={.1} max={1} step={.05} onChange={(opacity) => updateGroup(selectedGroup.id, { opacity })}/>
                <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Pivot X</Label><Input className="h-9" type="number" value={Math.round(selectedGroup.pivot.x)} onChange={(event) => updateGroup(selectedGroup.id, { pivot: { ...selectedGroup.pivot, x: Number(event.target.value) } })}/></div><div className="space-y-1"><Label>Pivot Y</Label><Input className="h-9" type="number" value={Math.round(selectedGroup.pivot.y)} onChange={(event) => updateGroup(selectedGroup.id, { pivot: { ...selectedGroup.pivot, y: Number(event.target.value) } })}/></div></div>
                <Button variant="outline" size="xs" className="w-full" onClick={ungroupSelected}><Ungroup size={12}/> Ungroup and preserve pose</Button>
              </CardContent>
            </Card>}

            {selectedAnchor && <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="koda-admin-card-title flex items-center gap-2 text-[#0E0B55]"><Crosshair size={15} className="text-[#534AB7]"/> Selected anchor</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 p-3 pt-0">
                <Input className="h-9" value={selectedAnchor.name} onChange={(event) => updateAnchor(selectedAnchor.id, { name: event.target.value })}/>
                <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>X</Label><Input className="h-9" type="number" value={selectedAnchor.x} onChange={(event) => updateAnchor(selectedAnchor.id, { x: Number(event.target.value) })}/></div><div className="space-y-1"><Label>Y</Label><Input className="h-9" type="number" value={selectedAnchor.y} onChange={(event) => updateAnchor(selectedAnchor.id, { y: Number(event.target.value) })}/></div></div>
                <div className="space-y-1"><Label>Attach to</Label><Select className="h-9" value={selectedAnchor.parentId ?? ""} onChange={(event) => updateAnchor(selectedAnchor.id, { parentId: event.target.value || null })}><option value="">Canvas root</option>{(document.groups ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></div>
                <Button variant="destructive" size="xs" onClick={() => { updateDocument({ anchors: (document.anchors ?? []).filter((anchor) => anchor.id !== selectedAnchor.id) }); setSelectedAnchorId(null); }}><Trash2 size={12}/> Delete anchor</Button>
              </CardContent>
            </Card>}

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="koda-admin-card-title text-[#0E0B55]">Character behavior</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 p-3 pt-0">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Motion</Label><Select className="h-9" value={behavior.animation} onChange={(event) => updateDocument({ behavior: { ...behavior, animation: event.target.value as MascotBehavior["animation"] } })}>{BEHAVIOR_ANIMATIONS.map((animation) => <option key={animation} value={animation}>{animation.charAt(0).toUpperCase() + animation.slice(1)}</option>)}</Select></div>
                  <div className="space-y-1"><Label>Duration (s)</Label><Input className="h-9" type="number" min="0.2" step="0.1" value={behavior.duration} onChange={(event) => updateDocument({ behavior: { ...behavior, duration: Math.max(.2, Number(event.target.value)) } })}/></div>
                </div>
                <NumberControl label="Intensity" value={behavior.intensity} min={0} max={30} onChange={(intensity) => updateDocument({ behavior: { ...behavior, intensity } })}/>
                <div className="flex items-center justify-between rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] px-3 py-2"><span className="koda-admin-label text-[#0E0B55]">Loop behavior</span><Switch size="sm" checked={behavior.loop} onCheckedChange={(loop) => updateDocument({ behavior: { ...behavior, loop } })}/></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1"><Label>Stiffness</Label><Input className="h-9" type="number" min="1" value={behavior.spring.stiffness} onChange={(event) => updateDocument({ behavior: { ...behavior, spring: { ...behavior.spring, stiffness: Number(event.target.value) } } })}/></div>
                  <div className="space-y-1"><Label>Damping</Label><Input className="h-9" type="number" min="1" value={behavior.spring.damping} onChange={(event) => updateDocument({ behavior: { ...behavior, spring: { ...behavior.spring, damping: Number(event.target.value) } } })}/></div>
                  <div className="space-y-1"><Label>Mass</Label><Input className="h-9" type="number" min="0.1" step="0.1" value={behavior.spring.mass} onChange={(event) => updateDocument({ behavior: { ...behavior, spring: { ...behavior.spring, mass: Number(event.target.value) } } })}/></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="koda-admin-card-title flex items-center gap-2 text-[#0E0B55]"><Film size={15} className="text-[#7C6DD8]"/> Animation clips</CardTitle><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={createClip} title="New clip"><Plus size={13}/></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" disabled={!activeClip} onClick={deleteActiveClip} title="Delete clip"><Trash2 size={13}/></Button></div></div></CardHeader>
              <CardContent className="space-y-2.5 p-3 pt-0">
                <Select className="h-9" value={activeClip?.id ?? ""} onChange={(event) => { updateDocument({ activeClipId: event.target.value || null }); setPlayhead(0); }}><option value="">No active clip</option>{(document.clips ?? []).map((clip) => <option key={clip.id} value={clip.id}>{clip.name}</option>)}</Select>
                {activeClip && <>
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2"><Input className="h-9" value={activeClip.name} onChange={(event) => updateClip(activeClip.id, { name: event.target.value })}/><Input aria-label="Clip duration" className="h-9" type="number" min="0.1" step="0.1" value={activeClip.duration} onChange={(event) => { const duration = Math.max(.1, Number(event.target.value)); updateClip(activeClip.id, { duration }); setPlayhead((value) => Math.min(value, duration)); }}/></div>
                  <div className="flex items-center gap-2"><span className="koda-admin-chip w-10 text-[#534AB7]">{playhead.toFixed(2)}s</span><Input aria-label="Animation playhead" type="range" min="0" max={activeClip.duration} step="0.01" value={Math.min(playhead, activeClip.duration)} onChange={(event) => { setPlaying(false); setPlayhead(Number(event.target.value)); }} className="h-2 flex-1 cursor-pointer appearance-auto border-0 bg-transparent p-0 shadow-none"/></div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Select className="h-9" value={keyframeEasing} onChange={(event) => setKeyframeEasing(event.target.value as MascotKeyframeEasing)}><option value="linear">Linear</option><option value="easeIn">Ease in</option><option value="easeOut">Ease out</option><option value="easeInOut">Ease in/out</option></Select><Button size="xs" disabled={!selectedLayer && !selectedGroup} onClick={captureKeyframe}><KeyRound size={12}/> Capture</Button></div>
                  <div className="flex items-center justify-between rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] px-3 py-2"><span className="koda-admin-label text-[#0E0B55]">Loop clip</span><Switch size="sm" checked={activeClip.loop} onCheckedChange={(loop) => updateClip(activeClip.id, { loop })}/></div>
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {activeClip.keyframes.map((keyframe) => {
                      const target = keyframe.targetType === "layer" ? document.layers.find((layer) => layer.id === keyframe.targetId) : (document.groups ?? []).find((group) => group.id === keyframe.targetId);
                      return <button key={keyframe.id} type="button" onClick={() => { setPlaying(false); setPlayhead(keyframe.time); if (keyframe.targetType === "layer") { setSelectedLayerId(keyframe.targetId); setSelectedGroupId(null); } else { setSelectedGroupId(keyframe.targetId); setSelectedLayerId(null); } }} className="flex w-full items-center gap-2 rounded-lg border border-[#E7E3F6] bg-white px-2 py-1.5 text-left hover:bg-[#FBFAFF]"><span className="h-2 w-2 rounded-full bg-[#7C6DD8]"/><span className="koda-admin-chip min-w-0 flex-1 truncate text-[#0E0B55]">{target?.name ?? "Missing target"}</span><span className="koda-admin-chip text-[#8D89AE]">{keyframe.time.toFixed(2)}s</span><span onClick={(event) => event.stopPropagation()}><Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500" onClick={() => updateClip(activeClip.id, { keyframes: activeClip.keyframes.filter((frame) => frame.id !== keyframe.id) })} title="Delete keyframe"><Trash2 size={11}/></Button></span></button>;
                    })}
                    {activeClip.keyframes.length === 0 && <p className="koda-admin-chip py-2 text-center text-[#8D89AE]">Select a layer or group, choose a time, then capture.</p>}
                  </div>
                </>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="koda-admin-card-title flex items-center gap-2 text-[#0E0B55]"><Layers3 size={15} className="text-[#7C6DD8]"/> Layer timeline</CardTitle><div className="flex gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canGroupMarked} onClick={groupMarkedLayers} title="Group marked layers"><GroupIcon size={13}/></Button><Button variant="ghost" size="icon" className="h-7 w-7" onClick={addAnchor} title="Add anchor"><Crosshair size={13}/></Button></div></div></CardHeader>
              <CardContent className="space-y-1.5 p-3 pt-0">
                {(document.groups ?? []).map((group) => <button key={group.id} type="button" onClick={() => { setSelectedGroupId(group.id); setSelectedLayerId(null); setSelectedAnchorId(null); }} className={cn("flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left", selectedGroupId === group.id ? "border-[#EF9F27] bg-amber-50" : "border-[#E7E3F6] bg-white hover:bg-[#FBFAFF]")}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-[#EF9F27]"><GroupIcon size={13}/></span><span className="min-w-0 flex-1"><span className="koda-admin-label block truncate text-[#0E0B55]">{group.name}</span><span className="koda-admin-chip text-[#8D89AE]">{document.layers.filter((layer) => layer.parentId === group.id).length} layers</span></span>{selectedGroupId === group.id && <span onClick={(event) => event.stopPropagation()}><Button variant="ghost" size="icon" className="h-7 w-7" onClick={ungroupSelected} title="Ungroup"><Ungroup size={13}/></Button></span>}</button>)}
                {(document.anchors ?? []).map((anchor) => <button key={anchor.id} type="button" onClick={() => { setSelectedAnchorId(anchor.id); setSelectedLayerId(null); setSelectedGroupId(null); }} className={cn("flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left", selectedAnchorId === anchor.id ? "border-[#534AB7] bg-[#F3F0FF]" : "border-[#E7E3F6] bg-white hover:bg-[#FBFAFF]")}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEEAFB] text-[#534AB7]"><Crosshair size={13}/></span><span className="koda-admin-label min-w-0 flex-1 truncate text-[#0E0B55]">{anchor.name}</span></button>)}
                {[...document.layers].reverse().map((layer) => {
                  return (
                    <button key={layer.id} type="button" onClick={() => { setSelectedLayerId(layer.id); setSelectedGroupId(null); setSelectedAnchorId(null); }} className={cn("flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left", selectedLayerId === layer.id ? "border-[#7C6DD8] bg-[#F3F0FF]" : "border-[#E7E3F6] bg-white hover:bg-[#FBFAFF]")}>
                      <span onClick={(event) => event.stopPropagation()}><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMarkedLayerIds((current) => current.includes(layer.id) ? current.filter((id) => id !== layer.id) : [...current, layer.id])} title="Mark for grouping">{markedLayerIds.includes(layer.id) ? <CheckSquare2 size={13} className="text-[#534AB7]"/> : <Square size={13}/>}</Button></span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEEAFB] text-[#534AB7]"><Layers3 size={13}/></span>
                      <span className="min-w-0 flex-1"><span className="koda-admin-label block truncate text-[#0E0B55]">{layer.name}</span><span className="koda-admin-chip text-[#8D89AE]">{layer.category} · {layer.animation}</span></span>
                      <span className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorder(layer.id, "forward")} title="Move forward"><ArrowUp size={13}/></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorder(layer.id, "backward")} title="Move backward"><ArrowDown size={13}/></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateLayer(layer.id, { visible: !layer.visible })} title={layer.visible ? "Hide layer" : "Show layer"}>{layer.visible ? <Eye size={13}/> : <EyeOff size={13}/>}</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget({ kind: "layer", layer })} title={`Delete ${layer.name}`} aria-label={`Delete ${layer.name}`}><Trash2 size={13}/></Button>
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="min-h-0 min-w-0 space-y-3 xl:h-full xl:overflow-y-auto xl:pr-1">
            <Card>
              <CardContent className="space-y-2 p-2.5">
                <div className="flex gap-1.5">
                  <div className="min-w-0 flex-1">
                    <Select aria-label="Saved mascot drafts" value={document.id} onChange={(event) => { const draft = drafts.find((entry) => entry.id === event.target.value); if (draft) { setDocument(draft); setSelectedLayerId(draft.layers.at(-1)?.id ?? null); } }} className="h-9 text-xs">
                      <option value={document.id}>{drafts.some((draft) => draft.id === document.id) ? document.name : "Unsaved"}</option>
                      {drafts.filter((draft) => draft.id !== document.id).map((draft) => <option key={draft.id} value={draft.id}>{draft.name}</option>)}
                    </Select>
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleteTarget({ kind: "mascot", document })} title="Delete mascot" aria-label="Delete mascot"><Trash2 size={14}/></Button>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={beginNewMascot}><Plus size={14}/> New</Button>
                {persistenceError && <p className="koda-admin-chip text-rose-600">{persistenceError}</p>}
                <p className="koda-admin-chip text-[#6D6997]">SVG library: {svgPersistenceStatus === "saved" ? "editable and synced" : svgPersistenceStatus}</p>
                {onOpenSvgAssets && <Button variant="ghost" size="xs" className="w-full" onClick={onOpenSvgAssets}><Code2 size={12}/> Manage SVG source</Button>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="koda-admin-card-title text-[#0E0B55]">Character metadata</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <div className="space-y-1"><Label>Name</Label><Input className="h-9" value={document.name} onChange={(event) => updateDocument({ name: event.target.value, slug: slugifyMascotName(event.target.value) })}/></div>
                <div className="space-y-1"><Label>Purpose</Label><Select className="h-9" value={document.purpose} onChange={(event) => updateDocument({ purpose: event.target.value as MascotPurpose })}>{PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose.charAt(0).toUpperCase() + purpose.slice(1)}</option>)}</Select></div>
                <div className="space-y-1"><Label>Slug</Label><Input className="h-9" value={document.slug} onChange={(event) => updateDocument({ slug: slugifyMascotName(event.target.value) })}/></div>
                <div className="space-y-1"><Label>Description</Label><Input className="h-9" value={document.description} onChange={(event) => updateDocument({ description: event.target.value })}/></div>
                <div className="space-y-1"><Label>Tags</Label><Input className="h-9" value={document.tags.join(", ")} onChange={(event) => updateDocument({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} placeholder="guide, happy, reward"/></div>
                <div className="grid grid-cols-2 gap-2">
                  <PaletteControl label="Body" value={document.palette.primary} onChange={(value) => updateDocument({ palette: { ...document.palette, primary: value } })}/>
                  <PaletteControl label="Shade" value={document.palette.secondary} onChange={(value) => updateDocument({ palette: { ...document.palette, secondary: value } })}/>
                  <PaletteControl label="Accent" value={document.palette.accent} onChange={(value) => updateDocument({ palette: { ...document.palette, accent: value } })}/>
                  <PaletteControl label="Ink" value={document.palette.ink} onChange={(value) => updateDocument({ palette: { ...document.palette, ink: value } })}/>
                </div>
                <Button variant="ghost" size="xs" onClick={() => updateDocument({ palette: { ...DEFAULT_PALETTE } })}><RotateCcw size={12}/> Reset colors</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="koda-admin-card-title text-[#0E0B55]">Selected layer</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 p-3 pt-0">
                {selectedLayer ? <>
                  <div className="flex items-center justify-between"><div><p className="koda-admin-label text-[#0E0B55]">{selectedLayer.name}</p><p className="koda-admin-chip text-[#8D89AE]">{selectedLayer.category}</p></div><Switch size="sm" checked={selectedLayer.visible} onCheckedChange={(visible) => updateLayer(selectedLayer.id, { visible })}/></div>
                  {selectedLayer.category === "body" && !selectedAsset?.markup && <div className="flex items-center justify-between rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] px-3 py-2"><span className="koda-admin-label text-[#0E0B55]">Body outline</span><Switch size="sm" checked={selectedLayer.outline !== false} onCheckedChange={(outline) => updateLayer(selectedLayer.id, { outline })}/></div>}
                  <div className="rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="koda-admin-label text-[#0E0B55]">Gradient fill</p><p className="koda-admin-chip text-[#6D6997]">Blend two colors across this part.</p></div>
                      <Switch size="sm" checked={Boolean(selectedLayer.gradient)} disabled={Boolean(selectedAsset?.markup)} onCheckedChange={(enabled) => updateLayer(selectedLayer.id, { gradient: enabled ? { kind: "linear", start: document.palette.primary, end: document.palette.secondary, angle: 90 } : undefined })}/>
                    </div>
                    {selectedAsset?.markup && <p className="mt-2 koda-admin-chip text-[#8D89AE]">Gradient fills are available for built-in vector parts.</p>}
                    {selectedLayer.gradient && !selectedAsset?.markup && <div className="mt-2.5 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <PaletteControl label="Start" value={selectedLayer.gradient.start} onChange={(start) => updateLayer(selectedLayer.id, { gradient: { ...selectedLayer.gradient!, start } })}/>
                        <PaletteControl label="End" value={selectedLayer.gradient.end} onChange={(end) => updateLayer(selectedLayer.id, { gradient: { ...selectedLayer.gradient!, end } })}/>
                      </div>
                      <NumberControl label="Gradient angle" value={selectedLayer.gradient.angle} min={0} max={360} step={5} onChange={(angle) => updateLayer(selectedLayer.id, { gradient: { ...selectedLayer.gradient!, angle } })}/>
                    </div>}
                  </div>
                  <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>X</Label><Input className="h-9" type="number" value={selectedLayer.x} onChange={(event) => updateLayer(selectedLayer.id, { x: Number(event.target.value) })}/></div><div className="space-y-1"><Label>Y</Label><Input className="h-9" type="number" value={selectedLayer.y} onChange={(event) => updateLayer(selectedLayer.id, { y: Number(event.target.value) })}/></div></div>
                  <NumberControl label="Scale" value={selectedLayer.scale} min={.2} max={2} step={.05} onChange={(scale) => updateLayer(selectedLayer.id, { scale })}/>
                  <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Width scale</Label><Input className="h-9" type="number" min="0.1" max="3" step="0.05" value={selectedLayer.scaleX ?? 1} onChange={(event) => updateLayer(selectedLayer.id, { scaleX: Math.max(.1, Number(event.target.value)) })}/></div><div className="space-y-1"><Label>Height scale</Label><Input className="h-9" type="number" min="0.1" max="3" step="0.05" value={selectedLayer.scaleY ?? 1} onChange={(event) => updateLayer(selectedLayer.id, { scaleY: Math.max(.1, Number(event.target.value)) })}/></div></div>
                  <NumberControl label="Rotation" value={selectedLayer.rotation} min={-180} max={180} onChange={(rotation) => updateLayer(selectedLayer.id, { rotation })}/>
                  <NumberControl label="Opacity" value={selectedLayer.opacity} min={.1} max={1} step={.05} onChange={(opacity) => updateLayer(selectedLayer.id, { opacity })}/>
                  <div className="space-y-1"><Label>Animation</Label><Select className="h-9" value={selectedLayer.animation} onChange={(event) => { const animation = event.target.value as MascotAnimation; updateLayer(selectedLayer.id, { animation, animationIntensity: defaultLayerAnimationIntensity(animation) }); }}>{ANIMATIONS.map((animation) => <option key={animation} value={animation}>{animation.charAt(0).toUpperCase() + animation.slice(1)}</option>)}</Select></div>
                  {selectedLayer.animation !== "none" && <>
                    <NumberControl label="Motion amount" value={selectedLayer.animationIntensity ?? defaultLayerAnimationIntensity(selectedLayer.animation)} min={0} max={selectedLayer.animation === "spin" ? 360 : selectedLayer.animation === "blink" ? 100 : selectedLayer.animation === "pulse" ? 80 : selectedLayer.animation === "look" ? 12 : 30} step={selectedLayer.animation === "spin" ? 5 : 1} onChange={(animationIntensity) => updateLayer(selectedLayer.id, { animationIntensity })}/>
                    <div className="space-y-1"><Label>Motion feel</Label><Select className="h-9" value={selectedLayer.animationFeel ?? "smooth"} onChange={(event) => updateLayer(selectedLayer.id, { animationFeel: event.target.value as MascotMotionFeel })}>{MOTION_FEELS.map((feel) => <option key={feel.id} value={feel.id}>{feel.label}</option>)}</Select></div>
                  </>}
                  <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label>Duration (s)</Label><Input className="h-9" type="number" min="0.2" step="0.1" value={selectedLayer.duration} onChange={(event) => updateLayer(selectedLayer.id, { duration: Number(event.target.value) })}/></div><div className="space-y-1"><Label>Delay (s)</Label><Input className="h-9" type="number" min="0" step="0.1" value={selectedLayer.delay} onChange={(event) => updateLayer(selectedLayer.id, { delay: Number(event.target.value) })}/></div></div>
                  {onOpenSvgAssets && <Button variant="outline" size="xs" className="w-full" onClick={() => editSvgSource(selectedLayer)}><Code2 size={12}/>{editableSvgAssets.some((asset) => asset.id === selectedLayer.assetId) ? "Edit SVG source" : "Make editable SVG copy"}</Button>}
                  <Button variant="destructive" size="xs" onClick={() => setDeleteTarget({ kind: "layer", layer: selectedLayer })}><Trash2 size={12}/> Remove layer</Button>
                </> : <p className="koda-admin-chip text-[#6D6997]">No layer selected</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="koda-admin-card-title flex items-center gap-2 text-[#0E0B55]"><FileJson size={15} className="text-[#7C6DD8]"/> Export</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <div className="max-h-24 overflow-auto rounded-xl border border-[#E7E3F6] bg-[#F8F7FC] p-2"><pre className="whitespace-pre-wrap break-all text-[9px] leading-3.5 text-[#6D6997]">{metadata}</pre></div>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="xs" onClick={copyMetadata}><Copy size={12}/>{copied ? "Copied" : "Copy JSON"}</Button><Button variant="outline" size="xs" onClick={() => downloadText(`${document.slug}.json`, metadata, "application/json")}><Download size={12}/> JSON</Button></div>
                <Button variant="secondary" size="sm" className="w-full" onClick={exportSvg}><Download size={14}/> Export animated SVG</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {layerContextMenu && (() => {
        const layer = document.layers.find((entry) => entry.id === layerContextMenu.layerId);
        if (!layer) return null;
        const siblings = document.layers.filter((entry) => (entry.parentId ?? null) === (layer.parentId ?? null));
        const position = siblings.findIndex((entry) => entry.id === layer.id);
        const applyOrder = (order: MascotLayerOrderAction) => { reorder(layer.id, order); setLayerContextMenu(null); };
        return <div role="menu" aria-label={`Layer actions for ${layer.name}`} className="fixed z-[10000] w-44 rounded-xl border border-[#DCD5FA] bg-white p-1.5 shadow-xl" style={{ left: layerContextMenu.x, top: layerContextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <p className="koda-admin-chip truncate px-2 py-1 text-[#8D89AE]">{layer.name}</p>
          <button type="button" role="menuitem" disabled={position === siblings.length - 1} onClick={() => applyOrder("front")} className="koda-admin-nav-label flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[#0E0B55] hover:bg-[#F3F0FF] disabled:opacity-40"><ArrowUpToLine size={14} className="text-[#534AB7]"/> Bring to front</button>
          <button type="button" role="menuitem" disabled={position === siblings.length - 1} onClick={() => applyOrder("forward")} className="koda-admin-nav-label flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[#0E0B55] hover:bg-[#F3F0FF] disabled:opacity-40"><ArrowUp size={14} className="text-[#534AB7]"/> Move forward</button>
          <button type="button" role="menuitem" disabled={position === 0} onClick={() => applyOrder("backward")} className="koda-admin-nav-label flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[#0E0B55] hover:bg-[#F3F0FF] disabled:opacity-40"><ArrowDown size={14} className="text-[#534AB7]"/> Move backward</button>
          <button type="button" role="menuitem" disabled={position === 0} onClick={() => applyOrder("back")} className="koda-admin-nav-label flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[#0E0B55] hover:bg-[#F3F0FF] disabled:opacity-40"><ArrowDownToLine size={14} className="text-[#534AB7]"/> Send to back</button>
          <div className="my-1 border-t border-[#E7E3F6]"/>
          <button type="button" role="menuitem" onClick={() => { setLayerContextMenu(null); setDeleteTarget({ kind: "layer", layer }); }} className="koda-admin-nav-label flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-rose-600 hover:bg-rose-50"><Trash2 size={14}/> Delete layer</button>
        </div>;
      })()}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.kind === "builtInStyle"
          ? `Remove ${deleteTarget.preset.name}?`
          : deleteTarget?.kind === "customStyle"
            ? `Delete ${deleteTarget.style.name}?`
            : deleteTarget?.kind === "mascot"
              ? `Delete ${deleteTarget.document.name}?`
              : `Delete ${deleteTarget?.layer.name ?? "this layer"}?`}
        description={deleteTarget?.kind === "builtInStyle"
          ? "This built-in style will be removed from your picker. You can restore it later."
          : deleteTarget?.kind === "customStyle"
            ? "This reusable style will be permanently deleted."
            : deleteTarget?.kind === "mascot"
              ? "This saved mascot will be permanently deleted."
              : "This removes the layer and its animation keyframes from the mascot."}
        confirmText={deleteTarget?.kind === "builtInStyle" ? "Remove style" : "Delete"}
        loadingText={deleteTarget?.kind === "builtInStyle" ? "Removing..." : "Deleting..."}
        variant="danger"
      />

      <ConfirmModal
        isOpen={isSaveStyleConfirmOpen}
        onClose={() => setIsSaveStyleConfirmOpen(false)}
        onConfirm={saveCurrentAsStyle}
        title="Save my style?"
        description="Choose a name for this reusable mascot style."
        confirmText="Save style"
        loadingText="Saving..."
        confirmDisabled={!saveStyleName.trim()}
        variant="default"
        icon={<Save size={22}/>}
      >
        <div className="space-y-1.5">
          <Label htmlFor="mascot-style-name" className="koda-admin-label">Style name</Label>
          <Input id="mascot-style-name" autoFocus value={saveStyleName} onChange={(event) => setSaveStyleName(event.target.value)} maxLength={80}/>
        </div>
      </ConfirmModal>
    </div>
  );
};
