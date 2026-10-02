/**
 * Every trace item an author has, a page at a time.
 *
 * All drafts live on the device (they are edited offline), so search, filters
 * and sort run here — but only one page of cards is drawn, and each item's
 * checks are worked out once per change to the store rather than once per
 * card per render. Deleting asks first, because a deleted item also leaves
 * every collection it was in.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, Copy, PenLine, Plus, Search, Trash2 } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton, UIDialog, UIPagination } from "../../components/ui";
import type { TraceKind } from "../geometry/types";
import { runChecks } from "./checks";
import { TraceDrafts, type TraceDraft } from "./drafts";
import { matches, pageOf, sortBy, usage, type ListSort } from "./listView";
import { fetchStudioCollections, saveStudioCollection, type StudioCollection } from "../data/api";
import { ItemThumb } from "../player/Thumb";
import { IconButton, inputCls } from "./ui";

const PAGE_SIZE = 24;
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function ItemsList({ kinds, onOpen, onCreate }: { kinds: readonly TraceKind[]; onOpen(id: string): void; onCreate(): void }) {
  const { t } = useT();
  const version = useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<TraceKind | "">("");
  const [status, setStatus] = useState<"" | "ready" | "issues" | "unused">("");
  /* Which collections hold each item: shown on the card, offered as a clean-up
     filter, and warned about before a delete. Unknown (offline) leaves all three
     out rather than calling every item unused. */
  const [collections, setCollections] = useState<StudioCollection[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchStudioCollections().then((cs) => live && setCollections(cs)).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const used = useMemo(() => (collections ? usage(collections) : null), [collections]);
  const [sort, setSort] = useState<ListSort>("recent");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<TraceDraft[] | null>(null);

  // Checks once per store change, not once per card per keystroke.
  const all = useMemo(
    () => TraceDrafts.list().map((d) => ({ d, issues: runChecks(d).filter((c) => !c.ok).length })),
    [version],
  );
  const shown = useMemo(() => {
    const kept = all.filter(({ d, issues }) =>
      matches(d.item.title, q) && (!kind || d.item.kind === kind) &&
      (!status || (status === "unused" ? !!used && !used.has(d.item.id) : (status === "ready") === (issues === 0))));
    return sortBy(kept, sort, (r) => r.d.item.title, (r) => r.d.updatedAt);
  }, [all, q, kind, status, sort, used]);
  const view = pageOf(shown, page, PAGE_SIZE);

  useEffect(() => setPage(1), [q, kind, status, sort]);
  useEffect(() => setSelected(new Set()), [q, kind, status, sort, page]);

  const toggle = (id: string) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  /**
   * Delete the items, then take them out of every collection that held them, so
   * no collection is left pointing at an item that is gone. A collection this
   * author may not edit keeps the gap, and its board shows the item as missing.
   */
  const remove = async (drafts: TraceDraft[]) => {
    const gone = new Set(drafts.map((d) => d.item.id));
    for (const id of gone) TraceDrafts.remove(id);
    setSelected(new Set());
    const touched = (collections ?? []).filter((c) => c.itemIds.some((id) => gone.has(id)));
    const saved = await Promise.all(touched.map((c) =>
      saveStudioCollection({ ...c, itemIds: c.itemIds.filter((id) => !gone.has(id)), cover: c.cover && gone.has(c.cover) ? null : c.cover }).catch(() => c),
    ));
    const byId = new Map(saved.map((c) => [c.id, c]));
    setCollections((cs) => cs && cs.map((c) => byId.get(c.id) ?? c));
  };

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
        <PenLine className="h-10 w-10 text-indigo-500" />
        <p className="max-w-md text-muted">{t("traceStudio.empty")}</p>
        <UIButton icon={<Plus className="h-4 w-4" />} onClick={onCreate}>{t("traceStudio.newItem")}</UIButton>
      </div>
    );
  }

  return (
    <section className={themeSystem.card("default", "flex flex-col gap-3 p-4")} aria-label={t("traceStudio.view.items")}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" className={`${inputCls} pl-8`} lang="km" placeholder={t("traceStudio.search")} aria-label={t("traceStudio.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label={t("traceStudio.filterKind")} className={`${inputCls} w-auto`} value={kind} onChange={(e) => setKind(e.target.value as TraceKind | "")}>
          <option value="">{t("traceStudio.allKinds")}</option>
          {kinds.map((k) => <option key={k} value={k}>{t(`traceStudio.kind.${k}`)}</option>)}
        </select>
        <select aria-label={t("traceStudio.filterStatus")} className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as "" | "ready" | "issues")}>
          <option value="">{t("traceStudio.allStatus")}</option>
          <option value="ready">{t("traceStudio.statusReady")}</option>
          <option value="issues">{t("traceStudio.statusIssues")}</option>
          {used && <option value="unused">{t("traceStudio.statusUnused")}</option>}
        </select>
        <select aria-label={t("traceStudio.sort")} className={`${inputCls} w-auto`} value={sort} onChange={(e) => setSort(e.target.value as ListSort)}>
          <option value="recent">{t("traceStudio.sortRecent")}</option>
          <option value="title">{t("traceStudio.sortTitle")}</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 dark:bg-indigo-950/40">
          <span className="text-sm font-bold text-ink">{t("studio.selectedCount", { count: selected.size })}</span>
          <UIButton size="sm" variant="ghost" onClick={() => setSelected(new Set(view.rows.map((r) => r.d.item.id)))}>{t("studio.selectPage")}</UIButton>
          <UIButton size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t("studio.clearSelection")}</UIButton>
          <UIButton size="sm" variant="danger" className="ml-auto" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(view.rows.map((r) => r.d).filter((d) => selected.has(d.item.id)))}>
            {t("studio.deleteSelected", { count: selected.size })}
          </UIButton>
        </div>
      )}

      {view.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{t("traceStudio.noMatch")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {view.rows.map(({ d, issues }) => {
            const ticked = selected.has(d.item.id);
            return (
              <li key={d.item.id} className={`group relative flex flex-col rounded-2xl border-2 bg-surface transition hover:border-indigo-400 ${ticked ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-line"}`}>
                <button onClick={() => onOpen(d.item.id)} className="flex flex-col items-center gap-2 px-4 pb-4 pt-6 text-center">
                  <span className="flex h-20 items-center text-indigo-700 dark:text-indigo-300">
                    {d.item.strokes.length
                      ? <ItemThumb item={d.item} className="h-20 w-20" />
                      : <span className="text-6xl font-bold leading-none text-muted/60" lang={d.item.script === "khmer" ? "km" : undefined}>{d.item.title || "·"}</span>}
                  </span>
                  <span className="max-w-full truncate font-bold text-ink" lang={d.item.script === "khmer" ? "km" : undefined}>{d.item.title || t("traceStudio.untitled")}</span>
                  <span className="text-xs text-muted">
                    {t(`traceStudio.kind.${d.item.kind}`)} · {t("traceStudio.strokeCount", { count: d.item.strokes.length })}
                    {used && ` · ${used.get(d.item.id) ? t("traceStudio.inCollections", { count: used.get(d.item.id) ?? 0 }) : t("traceStudio.inNoCollection")}`}
                  </span>
                  <UIBadge variant={issues ? "danger" : "success"} className="inline-flex items-center gap-1">
                    {issues ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                    {issues ? t("traceStudio.issues", { count: issues }) : t("traceStudio.ready")}
                  </UIBadge>
                </button>
                <input
                  type="checkbox"
                  checked={ticked}
                  onChange={() => toggle(d.item.id)}
                  aria-label={t("studio.selectBook", { title: d.item.title || "·" })}
                  className={`absolute left-3 top-3 h-4 w-4 accent-indigo-600 transition ${ticked || selected.size > 0 ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover:opacity-100"}`}
                />
                <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton size="sm" label={t("traceStudio.duplicate")} onClick={() => TraceDrafts.save({ ...structuredClone(d), item: { ...structuredClone(d.item), id: uid("t-") }, tests: {} })}>
                    <Copy className="h-4 w-4" />
                  </IconButton>
                  <IconButton size="sm" tone="danger" label={t("traceStudio.delete")} onClick={() => setConfirm([d])}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span aria-live="polite">{t("traceStudio.itemTotal", { count: view.total })}</span>
        <UIPagination page={view.page} pages={view.pages} onPage={setPage} />
      </div>

      <UIDialog
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        variant="danger"
        title={t("traceStudio.confirmDelete.title", { count: confirm?.length ?? 0 })}
        description={[
          t("traceStudio.confirmDelete.note"),
          ...(used && confirm ? (() => {
            const held = confirm.filter((d) => used.has(d.item.id)).length;
            return held ? [t("traceStudio.confirmDelete.held", { count: held })] : [];
          })() : []),
        ].join(" ")}
        confirmText={t("traceStudio.delete")}
        onConfirm={() => confirm && void remove(confirm)}
      />
    </section>
  );
}
