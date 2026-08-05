/**
 * SVG Asset Studio — one compact place to find, preview, create, and edit artwork.
 * Custom artwork is always previewed from the live draft, then persisted by stable id.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Code2, Copy, FilePlus2, Image, Save, ShieldCheck, Trash2 } from "lucide-react";
import { isSpriteId, spriteKey, BUILT_IN_ASSETS, customAsset, type CatalogAsset } from "../../assets/assetCatalog";
import { useSvgLibrary } from "../../assets/SvgLibraryContext";
import { createSvgAssetId } from "../../assets/svgIds";
import { preprocessSvgMarkup } from "../../assets/svgPreprocess";
import { isSafeSvgMarkup, sanitizeSvgMarkup } from "../../assets/svgSafety";
import { svgAssetsApi, type SvgAssetUse } from "../../api/svgAssets";
import type { CustomSvgAsset } from "../../types";
import { PARENT_NAV_ASSETS } from "../../parent/parentNavAssets";
import { KID_NAV_ASSETS } from "../../student/home/kidNavAssets";
import { ASSET_CATEGORY_ICONS } from "../../assets/assetCategoryAssets";
import { XTRAMATH_OWL_ASSET, XTRAMATH_OWL_ASSET_ID } from "../../assets/xtraMathOwlAsset";
import { CountingTechnique } from "../../types";
import { CountingAsset } from "../Assets";
import { AssetGrid, CatalogAssetView } from "../ui/AssetGrid";
import { Badge, Button, Card, ConfirmModal, Input, Label, Textarea } from "../ui";

const SYSTEM_ASSETS = [...PARENT_NAV_ASSETS, ...KID_NAV_ASSETS, ...ASSET_CATEGORY_ICONS, XTRAMATH_OWL_ASSET];
const SYSTEM_ASSET_IDS = new Set(SYSTEM_ASSETS.map(asset => asset.id));
const NEW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <circle cx="50" cy="50" r="38" fill="#7C6DD8" />
</svg>`;

const draftErrorFor = (markup: string): string | null => {
  const value = markup.trim();
  if (!value) return "Paste SVG markup to continue.";
  if (!value.toLowerCase().startsWith("<svg")) return "SVG source must start with an <svg> element.";
  if (!isSafeSvgMarkup(value)) return "Remove scripts, event handlers, or embedded content.";
  const processed = preprocessSvgMarkup(value);
  if (!sanitizeSvgMarkup(processed)) return "The SVG could not be parsed. Check its tags and attributes.";
  return null;
};

export const SvgAssetEditor: React.FC = () => {
  const {
    assets,
    setAssets,
    deletedSystemAssetIds,
    setDeletedSystemAssetIds,
    techniqueThumbnails,
    setTechniqueThumbnails,
    persistenceStatus,
  } = useSvgLibrary();
  const [selected, setSelected] = useState<CatalogAsset | null>(() => BUILT_IN_ASSETS[0] ?? null);
  const [label, setLabel] = useState("");
  const [markup, setMarkup] = useState(NEW_SVG);
  const [scale, setScale] = useState(1);
  const [previewSize, setPreviewSize] = useState(96);
  const [showErrors, setShowErrors] = useState(false);
  const [copied, setCopied] = useState<"key" | "usage" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomSvgAsset | null>(null);
  const [assetUsage, setAssetUsage] = useState<Record<string, SvgAssetUse[]> | null>(null);
  const seededAdminLibrary = useRef(false);

  useEffect(() => {
    if (persistenceStatus !== "saved" || seededAdminLibrary.current) return;
    seededAdminLibrary.current = true;
    const ids = new Set(assets.map(asset => asset.id));
    const deletedIds = new Set(deletedSystemAssetIds);
    const missing = SYSTEM_ASSETS.filter(asset => !ids.has(asset.id) && !deletedIds.has(asset.id));
    if (missing.length > 0) setAssets(current => [...current, ...missing]);
    if (
      missing.some(asset => asset.id === XTRAMATH_OWL_ASSET_ID)
      && !techniqueThumbnails[CountingTechnique.XTRA_MATH]
    ) {
      setTechniqueThumbnails(current => ({
        ...current,
        [CountingTechnique.XTRA_MATH]: XTRAMATH_OWL_ASSET_ID,
      }));
    }
  }, [
    assets,
    deletedSystemAssetIds,
    persistenceStatus,
    setAssets,
    setTechniqueThumbnails,
    techniqueThumbnails,
  ]);

  useEffect(() => {
    let cancelled = false;
    void svgAssetsApi.usage()
      .then(response => { if (!cancelled) setAssetUsage(response.usage); })
      .catch(() => { if (!cancelled) setAssetUsage(null); });
    return () => { cancelled = true; };
  }, [assets.length]);

  const selectedCustom = selected?.kind === "custom"
    ? assets.find(asset => asset.id === selected.id) ?? null
    : null;
  const editingDraft = selected === null || selected?.kind === "custom";
  const isSystemAsset = Boolean(selectedCustom && SYSTEM_ASSET_IDS.has(selectedCustom.id));
  const draftError = useMemo(() => draftErrorFor(markup), [markup]);
  const processedDraft = useMemo(
    () => editingDraft && !draftError ? preprocessSvgMarkup(markup) : "",
    [draftError, editingDraft, markup],
  );
  const usage = selectedCustom ? assetUsage?.[selectedCustom.id] ?? [] : [];
  const previewLabel = selected?.label || label.trim() || "New SVG draft";

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const beginNew = () => {
    setSelected(null);
    setLabel("");
    setMarkup(NEW_SVG);
    setScale(1);
    setShowErrors(false);
  };

  const chooseAsset = (asset: CatalogAsset) => {
    setSelected(asset);
    setShowErrors(false);
    if (asset.kind !== "custom") return;
    const saved = assets.find(candidate => candidate.id === asset.id);
    if (!saved) return;
    setLabel(saved.label);
    setMarkup(saved.markup);
    setScale(saved.scale ?? 1);
  };

  const save = () => {
    setShowErrors(true);
    if (!label.trim() || draftError) return;

    const existingId = selectedCustom?.id;
    const next: CustomSvgAsset = {
      id: existingId ?? createSvgAssetId(),
      label: label.trim(),
      markup: preprocessSvgMarkup(markup),
      scale,
    };
    setAssets(current => existingId
      ? current.map(asset => asset.id === existingId ? next : asset)
      : [...current, next]);
    if (existingId) {
      setDeletedSystemAssetIds(current => current.filter(id => id !== existingId));
    }
    setSelected(customAsset(next));
    setShowErrors(false);
    notify(existingId ? "Asset updated" : "Asset added to the library");
  };

  const saveCopy = () => {
    setShowErrors(true);
    if (!label.trim() || draftError) return;
    const copy: CustomSvgAsset = {
      id: createSvgAssetId(),
      label: `${label.trim()} Copy`,
      markup: preprocessSvgMarkup(markup),
      scale,
    };
    setAssets(current => [...current, copy]);
    setSelected(customAsset(copy));
    setLabel(copy.label);
    setShowErrors(false);
    notify("Copy added to the library");
  };

  const copyText = async (type: "key" | "usage") => {
    if (!selected) return;
    const text = type === "key"
      ? selected.id
      : selected.kind === "custom"
        ? `<SvgLibraryAsset assetId="${selected.id}" size={${previewSize}} />`
        : isSpriteId(selected.id)
          ? `<use href="#goods-${spriteKey(selected.id)}" width="${previewSize}" height="${previewSize}" />`
          : `<CountingAsset type="${selected.id}" size={${previewSize}} />`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      notify("Clipboard access is unavailable");
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setAssets(current => current.filter(asset => asset.id !== deleteTarget.id));
    if (SYSTEM_ASSET_IDS.has(deleteTarget.id)) {
      setDeletedSystemAssetIds(current => current.includes(deleteTarget.id)
        ? current
        : [...current, deleteTarget.id]);
    }
    setTechniqueThumbnails(current => Object.fromEntries(
      Object.entries(current).filter(([, assetId]) => assetId !== deleteTarget.id),
    ));
    setDeleteTarget(null);
    beginNew();
    notify("Asset deleted");
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#FBFAFF] text-[#0E0B55] dark:bg-[#090C1B] dark:text-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E7E3F6] bg-white px-4 py-3 md:px-5 dark:border-white/10 dark:bg-[#11162B]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7] dark:bg-violet-400/15 dark:text-[#CDBEFF]"><Image size={19} /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="koda-admin-page-title truncate">SVG Asset Studio</h1>
              <Badge variant="secondary">{assets.length} custom</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-[#6D6997] dark:text-[#9A94B8]">Find, preview, and safely edit reusable artwork.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={persistenceStatus === "error" ? "destructive" : persistenceStatus === "saved" ? "success" : "secondary"}>
            {persistenceStatus === "saving" ? "Saving" : persistenceStatus === "saved" ? "Saved" : persistenceStatus === "error" ? "Local cache" : persistenceStatus}
          </Badge>
          <Button type="button" size="sm" onClick={beginNew}><FilePlus2 size={14} /> New SVG</Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="max-h-[22rem] min-h-0 overflow-y-auto border-b border-[#E7E3F6] bg-white p-4 lg:max-h-none lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#11162B]">
          <div className="mb-3">
            <h2 className="koda-admin-section-title">Asset library</h2>
            <p className="mt-1 text-xs text-[#6D6997] dark:text-[#9A94B8]">Search all built-in and saved artwork.</p>
          </div>
          <AssetGrid selectedIds={selected ? [selected.id] : []} onSelect={chooseAsset} columns={2} showLabels />
        </aside>

        <main className="min-h-0 overflow-y-auto p-4 md:p-5">
          <div className="mx-auto grid w-full max-w-6xl items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
            <Card className="overflow-hidden rounded-3xl border-[#E7E3F6] bg-white shadow-[0_8px_30px_rgba(83,74,183,0.06)] dark:border-white/10 dark:bg-[#14182A]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEEAF8] px-5 py-4 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="koda-admin-section-title">Preview</h2>
                    {isSystemAsset && <Badge variant="default"><ShieldCheck size={10} /> System asset</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-[#6D6997] dark:text-[#9A94B8]">{previewLabel}</p>
                </div>
                <div className="flex rounded-xl bg-[#F3F0FF] p-1 dark:bg-white/5">
                  {[32, 64, 96, 128].map(size => (
                    <button key={size} type="button" onClick={() => setPreviewSize(size)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${previewSize === size ? "bg-white text-[#534AB7] shadow-sm dark:bg-violet-500 dark:text-white" : "text-[#8D89AE]"}`}>{size}px</button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-[360px] items-center justify-center bg-[radial-gradient(#E7E3F6_1px,transparent_1px)] p-8 [background-size:18px_18px] dark:bg-[radial-gradient(#272A42_1px,transparent_1px)]">
                {editingDraft ? (
                  processedDraft ? (
                    <CountingAsset type="custom_svg" customSvgMarkup={processedDraft} size={previewSize} scale={scale} />
                  ) : (
                    <div className="max-w-sm rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-center text-xs font-medium text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">{draftError}</div>
                  )
                ) : selected ? (
                  <CatalogAssetView asset={selected} size={previewSize} />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEEAF8] px-5 py-4 dark:border-white/10">
                <div className="min-w-0">
                  <p className="koda-admin-card-title truncate text-sm">{previewLabel}</p>
                  <p className="mt-0.5 truncate text-[10px] text-[#8D89AE]">{selected?.id ?? "A stable asset ID will be created when saved."}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText("key")} disabled={!selected}>{copied === "key" ? <Check size={13} /> : <Copy size={13} />} Key</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText("usage")} disabled={!selected}>{copied === "usage" ? <Check size={13} /> : <Code2 size={13} />} Usage</Button>
                </div>
              </div>
            </Card>

            <Card className="rounded-3xl border-[#E7E3F6] bg-white p-5 shadow-[0_8px_30px_rgba(83,74,183,0.06)] dark:border-white/10 dark:bg-[#14182A]">
              <div className="mb-4">
                <h2 className="koda-admin-section-title">{selectedCustom ? "Edit SVG code" : selected ? "Asset details" : "Create SVG"}</h2>
                <p className="mt-1 text-xs text-[#6D6997] dark:text-[#9A94B8]">{editingDraft ? "Changes appear in Preview before you save." : "Built-in artwork is preview-only."}</p>
              </div>

              {editingDraft ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="svg-label" className="koda-admin-label">Asset label</Label>
                    <Input id="svg-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="Example: Golden mastery medal" className="mt-1.5" />
                    {showErrors && !label.trim() && <p className="mt-1 text-xs text-rose-600">Enter a clear asset label.</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="svg-scale" className="koda-admin-label">Default scale</Label>
                      <span className="koda-admin-chip text-[#534AB7]">{Math.round(scale * 100)}%</span>
                    </div>
                    <input id="svg-scale" type="range" min="0.5" max="2" step="0.05" value={scale} onChange={event => setScale(Number(event.target.value))} className="mt-2 w-full accent-[#534AB7]" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="svg-source" className="koda-admin-label">SVG source</Label>
                      <Badge variant={draftError ? "warning" : "success"}>{draftError ? "Needs attention" : "Valid SVG"}</Badge>
                    </div>
                    <Textarea id="svg-source" value={markup} onChange={event => setMarkup(event.target.value)} spellCheck={false} className="mt-1.5 min-h-64 resize-y font-mono text-xs leading-5" />
                    {(showErrors || markup.trim()) && draftError && <p className="mt-1.5 text-xs text-rose-600">{draftError}</p>}
                  </div>

                  {selectedCustom && (
                    <div className="rounded-2xl bg-[#F7F6FB] px-3 py-2.5 text-xs text-[#6D6997] dark:bg-white/5 dark:text-[#9A94B8]">
                      {usage.length > 0 ? `Used by ${usage.length} curriculum skill${usage.length === 1 ? "" : "s"}. Changes update every reference.` : "Not currently linked to a curriculum skill."}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEEAF8] pt-4 dark:border-white/10">
                    <div>
                      {selectedCustom && <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(selectedCustom)}><Trash2 size={13} /> Delete SVG</Button>}
                    </div>
                    <div className="flex gap-2">
                      {selectedCustom && <Button type="button" variant="outline" size="sm" onClick={saveCopy}><Copy size={13} /> Save copy</Button>}
                      <Button type="button" size="sm" onClick={save} loading={persistenceStatus === "saving"} loadingText="Saving..."><Save size={13} /> {selectedCustom ? "Save changes" : "Add to library"}</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#E7E3F6] bg-[#FBFAFF] p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="koda-admin-card-title text-sm">{selected?.label}</p>
                    <p className="mt-1 break-all text-xs text-[#6D6997] dark:text-[#9A94B8]">{selected?.id}</p>
                    <p className="mt-3 text-xs leading-5 text-[#6D6997] dark:text-[#9A94B8]">This asset ships with Koda. You can preview and copy its key or usage snippet, but its source is maintained in code.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={beginNew} className="w-full"><FilePlus2 size={13} /> Create a custom SVG</Button>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>

      {notice && <div className="fixed bottom-5 right-5 z-[9999] rounded-2xl border border-[#DCD5FA] bg-white px-4 py-3 text-xs font-medium text-[#0E0B55] shadow-xl dark:border-white/10 dark:bg-[#1A1D32] dark:text-white">{notice}</div>}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteTarget?.label ?? "this asset"}?`}
        description={deleteTarget && (assetUsage?.[deleteTarget.id]?.length ?? 0) > 0
          ? "This SVG is currently referenced by curriculum content. Deleting it will leave those references without artwork."
          : deleteTarget && SYSTEM_ASSET_IDS.has(deleteTarget.id)
            ? "This removes the seeded Koda SVG from your collection and it will not be added back automatically."
            : "This removes the SVG from the library. This action cannot be undone."}
        confirmText="Delete asset"
      />
    </div>
  );
};
