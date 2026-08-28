import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  Check,
  Clock,
  Copy,
  Database,
  FolderInput,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shapes,
  Trash2,
  X,
} from "lucide-react";
import { SvgMarkup, svgAssets } from "../assets/svg";
import { themeSystem } from "../lib/themeSystem";
import { playSound } from "../utils/audio";
import { copyText } from "../utils/clipboard";
import {
  SUGGESTED_SVG_CATEGORIES,
  SVG_ID_PATTERN,
  UNCATEGORISED,
  deleteSvgAsset,
  listSvgAssets,
  moveSvgAsset,
  type SvgAssetRecord,
} from "../lib/svgAssetsApi";
import { SvgAssetEditorModal } from "./SvgAssetEditorModal";
import { SvgAssetPreviewModal } from "./SvgAssetPreviewModal";
import { useSession } from "../lib/sync";
import { UISectionHeader, UIStatGrid, UIStatTile } from "./ui";

const usageSnippet = (id: string) => `<SvgAsset id="${id}" size={48} />`;

/** Uncategorised sorts last; it is a holding pen, not a category. */
const byCategoryName = (a: string, b: string) =>
  a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b);

const categoryLabel = (name: string) => (name === UNCATEGORISED ? "Uncategorised" : name);

/** One row in the category rail. The count is the whole collection's, not the filtered view's. */
const CategoryRow: React.FC<{
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, count, isActive, onClick }) => (
  <button
    onClick={() => {
      playSound("pop");
      onClick();
    }}
    aria-current={isActive ? "true" : undefined}
    className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm font-mono font-semibold transition cursor-pointer ${
      isActive
        ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
        : "text-body hover:bg-surface-muted hover:text-ink"
    }`}
  >
    <span className="truncate">{label}</span>
    <span className={`tabular-nums text-sm ${isActive ? "opacity-70" : "text-muted"}`}>{count}</span>
  </button>
);

/**
 * The deploy-wide SVG collection, read and managed through the Mongo-backed API.
 * The bundled registry is the initial/offline snapshot while the request loads.
 */
export const SvgAssetsPage: React.FC = () => {
  const session = useSession();
  const canEdit = session?.platformRole === "admin" || session?.platformRole === "developer";
  const [assets, setAssets] = useState<SvgAssetRecord[]>(() =>
    svgAssets.map((asset) => ({
      id: asset.id,
      category: asset.category,
      markup: asset.markup,
    })),
  );
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [copied, setCopied] = useState<{ id: string; ok: boolean } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "recent">("name");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ running: boolean; error: string | null }>({
    running: false,
    error: null,
  });
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    id: string | null;
    markup: string;
    category: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSvgAssets()
      .then((fresh) => {
        if (!cancelled) setAssets(fresh);
      })
      // The bundled registry is already showing; a failed refresh changes nothing.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /** Counts come from the whole collection, so a chip never lies about what is behind it. */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) counts.set(asset.category, (counts.get(asset.category) ?? 0) + 1);
    return [...counts.entries()]
      .sort(([a], [b]) => byCategoryName(a, b))
      .map(([name, count]) => ({ name, count }));
  }, [assets]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter(
      (asset) =>
        (activeCategory === "all" || asset.category === activeCategory) &&
        (!needle || asset.id.includes(needle) || asset.category.includes(needle)),
    );
  }, [assets, query, activeCategory]);

  /** The list is always grouped; a filter narrows it to one group rather than flattening it. */
  const groups = useMemo(() => {
    const byCategory = new Map<string, SvgAssetRecord[]>();
    for (const asset of filtered) {
      const bucket = byCategory.get(asset.category) ?? [];
      bucket.push(asset);
      byCategory.set(asset.category, bucket);
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => byCategoryName(a, b))
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) =>
          sort === "recent"
            ? (b.modified ?? 0) - (a.modified ?? 0) || a.id.localeCompare(b.id)
            : a.id.localeCompare(b.id),
        ),
      }));
  }, [filtered, sort]);

  /**
   * Mongo enforces global ids. Keep this guard for malformed legacy/imported
   * responses so the UI never presents two tiles as independently editable.
   */
  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) counts.set(asset.id, (counts.get(asset.id) ?? 0) + 1);
    return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  }, [assets]);

  const previewAsset = assets.find((asset) => asset.id === previewId) ?? null;

  const copySnippet = async (id: string) => {
    const ok = await copyText(usageSnippet(id));
    playSound("pop");
    setCopied({ id, ok });
    setTimeout(() => setCopied((current) => (current?.id === id ? null : current)), 2000);
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Refetch after a bulk change rather than trying to mirror server state. */
  const runBulk = async (work: (id: string) => Promise<unknown>, ids: string[]) => {
    setBulk({ running: true, error: null });
    try {
      for (const id of ids) await work(id);
      setAssets(await listSvgAssets());
      setSelected(new Set());
      playSound("pop");
      setBulk({ running: false, error: null });
    } catch (error) {
      // Whatever succeeded before the failure is already in Mongo, so the list
      // is refreshed either way and the message says what stopped.
      setAssets(await listSvgAssets().catch(() => assets));
      setBulk({ running: false, error: (error as Error).message });
    }
  };

  const handleSaved = (id: string, markup: string, category: string) => {
    setAssets((current) => {
      const next = current.filter((asset) => asset.id !== id);
      next.push({ id, category, markup });
      return next.sort((a, b) => a.id.localeCompare(b.id));
    });
    setEditor(null);
    setPreviewId(id);
    // A save can rename or refile, so the cheapest correct list is a fresh one.
    listSvgAssets()
      .then(setAssets)
      .catch(() => undefined);
  };

  const showGroupHeadings = activeCategory === "all";

  return (
    <div className={`${themeSystem.spacing.section} w-full max-w-[1560px] mx-auto px-2 sm:px-4 lg:px-6 pb-20`}>
      <UISectionHeader
        icon={<Shapes />}
        title="Art library"
        subtitle={`${assets.length} shared assets · stored in MongoDB`}
        action={
          canEdit ? (
            <button
              onClick={() => {
                playSound("pop");
                setEditor({ id: null, markup: "", category: "" });
              }}
              className={themeSystem.button("primary", "sm")}
            >
              <Plus />
              Add artwork
            </button>
          ) : undefined
        }
      />

      <UIStatGrid>
        <UIStatTile icon={<Shapes />} value={assets.length} label="Total artwork" />
        <UIStatTile icon={<FolderInput />} value={categories.length} label="Categories" tone="success" />
        <UIStatTile icon={<Database />} value="MongoDB" label="Storage" tone="primary" />
        <UIStatTile icon={<Copy />} value="SVG" label="Format" tone="streak" />
      </UIStatGrid>

      <section className={themeSystem.card("default", "overflow-hidden")}>
        <div className="flex items-end justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
          <div>
            <h3 className="text-lg font-semibold text-ink">Shared artwork</h3>
            <p className="mt-1 text-base text-body">
              {assets.length} assets across {categories.length} {categories.length === 1 ? "category" : "categories"}
              {!canEdit && " · operator-managed"}
            </p>
          </div>
          <span className="hidden items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-muted sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live collection
          </span>
        </div>

      {duplicateIds.length > 0 && (
        <div className={themeSystem.flash("error", "m-4 text-sm")}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Two assets share {duplicateIds.length === 1 ? "the id" : "the ids"}{" "}
            <strong className="font-mono">{duplicateIds.join(", ")}</strong>. Ids are global, so{" "}
            <code className="font-mono">ids.ts</code> cannot be regenerated and saving will fail
            until one is renamed or deleted.
          </span>
        </div>
      )}

      {assets.length === 0 ? (
        <div
          className={themeSystem.card(
            "default",
            `${themeSystem.spacing.card} text-center space-y-2`,
          )}
        >
          <Shapes className="w-8 h-8 mx-auto text-muted" />
          <p className={themeSystem.typography("body-sm")}>
            No artwork yet. An operator can add the first asset here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 p-5 sm:p-7 md:grid-cols-[196px_minmax(0,1fr)] items-start">
          {/* Category rail — the collection's shape, always visible. */}
          <aside className={themeSystem.card("default", "p-2.5 space-y-1 md:sticky md:top-6")}>
            <CategoryRow
              label="All artwork"
              count={assets.length}
              isActive={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            <div className="h-px bg-line my-0.5" />
            {categories.map((category) => (
              <CategoryRow
                key={category.name}
                label={categoryLabel(category.name)}
                count={category.count}
                isActive={activeCategory === category.name}
                onClick={() => setActiveCategory(category.name)}
              />
            ))}
          </aside>

          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-5 h-5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by id or category"
                  aria-label="Search artwork"
                  className="w-full bg-surface border border-line rounded-xl pl-10 pr-4 py-3 text-sm sm:text-base font-mono text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Sorting is per group, so a category keeps its own newest-first order. */}
              <div className="flex items-center border border-line rounded-lg overflow-hidden shrink-0">
                {[
                  {
                    id: "name" as const,
                    label: "A–Z",
                    icon: <ArrowDownAZ className="w-3.5 h-3.5" />,
                  },
                  {
                    id: "recent" as const,
                    label: "Recent",
                    icon: <Clock className="w-3.5 h-3.5" />,
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      playSound("pop");
                      setSort(option.id);
                    }}
                    aria-pressed={sort === option.id}
                    title={option.id === "recent" ? "Most recently changed first" : "Alphabetical"}
                      className={`flex items-center gap-2 px-3.5 py-3 text-sm font-mono font-semibold transition cursor-pointer ${
                      sort === option.id
                        ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                        : "bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    {option.icon}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {groups.length === 0 ? (
              <p className={themeSystem.typography("body-sm")}>
                Nothing matches {query ? `“${query}”` : "this filter"}.
              </p>
            ) : (
              groups.map((group) => (
                <section key={group.name} className="space-y-2">
                  {showGroupHeadings && (
                    <div className="flex items-baseline gap-1.5">
                      <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-muted">
                        {categoryLabel(group.name)}
                      </h3>
                      <span className="text-sm font-mono text-muted tabular-nums">
                        {group.items.length}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                    {group.items.map((asset) => (
                      <div
                        key={asset.id}
                        className={themeSystem.card(
                          "interactive",
                          `p-3 group relative ${
                            selected.has(asset.id)
                              ? "border-indigo-400 dark:border-indigo-500/60 ring-2 ring-indigo-500/20"
                              : ""
                          }`,
                        )}
                      >
                        {canEdit && (
                          <label
                            className={`absolute top-2 left-2 z-10 transition-opacity ${
                              selected.has(asset.id)
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(asset.id)}
                              onChange={() => toggleSelected(asset.id)}
                              aria-label={`Select ${asset.id}`}
                              className="w-4 h-4 accent-indigo-600 cursor-pointer"
                            />
                          </label>
                        )}
                        {/* Actions stay out of the way until the tile is under the cursor. */}
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button
                            onClick={() => copySnippet(asset.id)}
                            title={`Copy <SvgAsset id="${asset.id}" />`}
                            aria-label={`Copy usage for ${asset.id}`}
                            className="p-1 rounded-md bg-surface border border-line text-muted hover:text-ink cursor-pointer"
                          >
                            {copied?.id === asset.id ? (
                              copied.ok ? (
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <X className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              )
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => {
                                playSound("pop");
                                setEditor({
                                  id: asset.id,
                                  markup: asset.markup,
                                  category: asset.category,
                                });
                              }}
                              title={`Edit ${asset.id}`}
                              aria-label={`Edit ${asset.id}`}
                              className="p-1 rounded-md bg-surface border border-line text-muted hover:text-ink cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            playSound("pop");
                            setPreviewId(asset.id);
                          }}
                          title={`Preview ${asset.id}`}
                          className="w-full cursor-pointer"
                        >
                          <div className="w-full h-[156px] rounded-xl bg-checkerboard flex items-center justify-center overflow-hidden">
                            <SvgMarkup
                              markup={asset.markup}
                              size={120}
                              title={asset.id}
                              fallback={
                                <span className="text-sm font-mono font-semibold text-rose-600 dark:text-rose-400 px-2 text-center">
                                  did not render
                                </span>
                              }
                            />
                          </div>
                          <div className="px-0.5 pt-3 text-sm font-mono font-semibold text-ink truncate text-left">
                            {asset.id}
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}
      </section>

      {/* Bulk bar — only ever present when something is selected. */}
      {canEdit && selected.size > 0 && (
        <div className="sticky bottom-4 z-30 mt-5">
          <div className="mx-auto max-w-3xl bg-surface border-2 border-line rounded-2xl shadow-lg p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono font-semibold text-ink">{selected.size} selected</span>

            <div className="flex items-center gap-1.5">
              <FolderInput className="w-4 h-4 text-muted" />
              <select
                value=""
                disabled={bulk.running}
                onChange={(event) => {
                  const target = event.target.value;
                  if (!target) return;
                  if (target === "__new") {
                    setMoveTarget("");
                    return;
                  }
                  runBulk((id) => moveSvgAsset(id, { category: target }), [...selected]);
                }}
                aria-label="Move selected to category"
                className="bg-surface-muted border border-line rounded-xl px-3 py-2 text-sm font-mono text-ink focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">Move to…</option>
                {[
                  ...new Set([
                    ...categories.map((category) => category.name),
                    ...SUGGESTED_SVG_CATEGORIES,
                    UNCATEGORISED,
                  ]),
                ].map((name) => (
                  <option key={name} value={name}>
                    {categoryLabel(name)}
                  </option>
                ))}
                <option value="__new">New category…</option>
              </select>
            </div>

            <button
              onClick={() => setConfirmDelete([...selected])}
              disabled={bulk.running}
              className={themeSystem.button("danger", "sm")}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>

            <button
              onClick={() => setSelected(new Set())}
              className={themeSystem.button("ghost", "sm")}
            >
              Clear
            </button>

            {bulk.running && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
            {bulk.error && (
              <span className="text-sm font-mono text-rose-600 dark:text-rose-400 min-w-0 truncate">
                {bulk.error}
              </span>
            )}
          </div>
        </div>
      )}

      {/* New category for a bulk move — typed, then applied to the selection. */}
      {moveTarget !== null && (
        <div className={themeSystem.modal.overlay} onClick={() => setMoveTarget(null)}>
          <div
            className={`${themeSystem.modal.content} p-5 space-y-4`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Move to a new category"
          >
            <div>
              <h3 className="text-base font-black text-ink font-mono">New category</h3>
              <p className="text-sm text-muted mt-1">
                Moves {selected.size} {selected.size === 1 ? "asset" : "assets"} into the{" "}
                <code className="font-mono">{moveTarget || "<name>"}</code> category.
              </p>
            </div>
            <input
              autoFocus
              value={moveTarget}
              onChange={(event) => setMoveTarget(event.target.value.trim().toLowerCase())}
              placeholder="vegetables"
              className="w-full bg-surface-muted border border-line rounded-xl px-3 py-2 text-sm font-mono text-ink placeholder:text-muted focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setMoveTarget(null)}
                className={themeSystem.button("secondary", "sm")}
              >
                Cancel
              </button>
              <button
                disabled={!moveTarget || !SVG_ID_PATTERN.test(moveTarget)}
                onClick={() => {
                  const target = moveTarget;
                  setMoveTarget(null);
                  runBulk((id) => moveSvgAsset(id, { category: target }), [...selected]);
                }}
                className={themeSystem.button("primary", "sm")}
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion is a shared library change, so it is confirmed. */}
      {confirmDelete && (
        <div className={themeSystem.modal.overlay} onClick={() => setConfirmDelete(null)}>
          <div
            className={`${themeSystem.modal.content} p-5 space-y-4`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete"
          >
            <div>
              <h3 className="text-base font-black text-ink font-mono">
                Delete {confirmDelete.length} {confirmDelete.length === 1 ? "asset" : "assets"}?
              </h3>
              <p className="text-sm text-muted mt-1">
                Removes the {confirmDelete.length === 1 ? "asset" : "assets"} from the shared
                library. Anything still calling{" "}
                <code className="font-mono">&lt;SvgAsset id=…&gt;</code> for{" "}
                {confirmDelete.length === 1 ? "it" : "them"} stops compiling until you fix the call.
              </p>
            </div>
            <div className="bg-surface-muted border border-line rounded-xl p-2.5 max-h-32 overflow-y-auto">
              <ul className="text-sm font-mono text-body space-y-1">
                {confirmDelete.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className={themeSystem.button("secondary", "sm")}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const ids = confirmDelete;
                  setConfirmDelete(null);
                  runBulk(deleteSvgAsset, ids);
                }}
                className={themeSystem.button("danger", "sm")}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {previewAsset && (
        <SvgAssetPreviewModal
          asset={previewAsset}
          canEdit={canEdit}
          onEdit={() => {
            setEditor({
              id: previewAsset.id,
              markup: previewAsset.markup,
              category: previewAsset.category,
            });
            setPreviewId(null);
          }}
          onClose={() => setPreviewId(null)}
        />
      )}

      {editor && (
        <SvgAssetEditorModal
          editingId={editor.id}
          initialMarkup={editor.markup}
          initialCategory={editor.category}
          existingIds={assets.map((asset) => asset.id)}
          existingCategories={categories.map((category) => category.name)}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}

    </div>
  );
};
