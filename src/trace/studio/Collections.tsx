/**
 * Trace collections in the Studio: the list of collections, and one
 * collection's board — its items in order, adding a whole set from a list,
 * applying settings to every item, and publishing it for everyone to practise.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, Flag, GripVertical, ImagePlus, ListPlus, MoreHorizontal, Pencil, Plus, Rocket, Search, Settings2, Star, Trash2, Undo2, Wand2, X } from "lucide-react";
import { ScoringAPI } from "../../lib/scoring";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { usePermissions } from "../../lib/sync";
import { UIBadge, UIButton, UIDialog, UIFlashMessage, UIMenu, UIMenuItem, UIPagination } from "../../components/ui";
import { COLLECTION_STATUSES, collectionStatus, matches, pageOf, sortBy, type CollectionStatus, type ListSort } from "./listView";
import type { ItemStats, PendingCollection, Problem, Report, StudioCollection } from "../data/api";
import {
  approveCollection,
  fetchItemStats,
  fetchReviewQueue,
  rejectCollection,
  fetchReports,
  resolveReport,
  checkStudioCollection,
  deleteStudioCollection,
  fetchStudioCollections,
  publishStudioCollection,
  saveStudioCollection,
  unpublishStudioCollection,
} from "../data/api";
import type { TraceItem } from "../geometry/types";
import { ItemThumb } from "../player/Thumb";
import { itemFor, parseList } from "./batch";
import { runChecks } from "./checks";
import type { TraceDraft } from "./drafts";
import { TraceDrafts, newDraft } from "./drafts";
import { Field, IconButton, Section, inputCls, panelCls } from "./ui";
import { AutoStrokesForSet } from "./AutoStrokesPanel";
import { PicturePanel } from "../../library/studio/PicturePanel";
import { Picture } from "../../library/Picture";

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const GRIDS: TraceItem["grid"][] = ["4x3-moeys", "3x3", "baseline-4-lines", "dots", "none"];

function StatusChip({ c }: { c: StudioCollection }) {
  const { t } = useT();
  if (c.reviewState === "pending") return <UIBadge variant="primary">{t("traceStudio.review.waiting")}</UIBadge>;
  if (c.reviewState === "rejected") return <UIBadge variant="danger">{t("traceStudio.review.sentBack")}</UIBadge>;
  if (c.publishedRev === null) return <UIBadge variant="neutral">{t("traceStudio.col.draft")}</UIBadge>;
  if (c.changed) return <UIBadge variant="primary">{t("traceStudio.col.changed", { rev: c.publishedRev })}</UIBadge>;
  return <UIBadge variant="success">{t("traceStudio.col.published", { rev: c.publishedRev })}</UIBadge>;
}

const COLLECTIONS_PER_PAGE = 12;
/** The picker draws this many at a time; a thumbnail is an SVG of every stroke. */
const PICKER_STEP = 42;

/* ============================================================ new set */

/** Ready-made sets: pick one and every item is created with its guide letter. */
const PRESETS: { id: string; list: string; grid: TraceItem["grid"]; language: string }[] = [
  { id: "kmConsonants", list: "ក-អ", grid: "4x3-moeys", language: "km" },
  { id: "kmNumbers", list: "០-៩", grid: "4x3-moeys", language: "km" },
  { id: "enUpper", list: "A-Z", grid: "baseline-4-lines", language: "en" },
  { id: "enLower", list: "a-z", grid: "baseline-4-lines", language: "en" },
  { id: "numbers", list: "0-9", grid: "baseline-4-lines", language: "en" },
];

function NewCollection({ onCreated, onCancel }: { onCreated(id: string): void; onCancel(): void }) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false); // the author typed a name: presets stop filling it in
  const [start, setStart] = useState<string>("empty");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const preset = PRESETS.find((p) => p.id === start);
  const entries = preset ? parseList(preset.list) : start === "custom" ? parseList(custom) : [];

  const pick = (id: string) => {
    setStart(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p && !named) setName(t(`traceStudio.newCol.preset.${p.id}`));
  };

  const create = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const grid = preset?.grid ?? "4x3-moeys";
      const made = entries.map((e) => newDraft(itemFor(e, uid("t-"), { grid, sensitivity: "balanced" })));
      for (const d of made) TraceDrafts.save(d);
      const c = await saveStudioCollection({
        id: uid("c-"),
        title: name.trim() || t("traceStudio.col.untitled"),
        description: "",
        language: preset?.language ?? (entries.some((e) => /[\u1780-\u17ff]/.test(e)) ? "km" : "en"),
        itemIds: made.map((d) => d.item.id),
        order: 100,
      });
      onCreated(c.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const option = (id: string, label: string, sample?: string) => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={start === id}
      onClick={() => pick(id)}
      className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition ${start === id ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-900" : "border-line bg-surface hover:border-indigo-300"}`}
    >
      <span className="text-sm font-semibold text-ink">{label}</span>
      {sample && (
        <span className="text-xs text-muted" lang="km">
          {sample}
        </span>
      )}
    </button>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void create();
      }}
      className="flex flex-col gap-4 rounded-2xl border-2 border-indigo-200 bg-surface p-5 dark:border-indigo-900"
    >
      <h2 className="text-lg font-bold text-ink">{t("traceStudio.col.new")}</h2>
      <Field label={t("traceStudio.newCol.name")}>
        <input
          id="trace-new-collection-name"
          autoFocus
          className={`${inputCls} text-lg`}
          maxLength={80}
          placeholder={t("traceStudio.newCol.namePlaceholder")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNamed(e.target.value.trim().length > 0);
          }}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("traceStudio.newCol.startWith")}</span>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => {
            const list = parseList(p.list);
            return option(p.id, t(`traceStudio.newCol.preset.${p.id}`), `${list.slice(0, 5).join(" ")} … · ${t("traceStudio.col.itemCount", { count: list.length })}`);
          })}
          {option("custom", t("traceStudio.newCol.custom"), t("traceStudio.newCol.customSample"))}
          {option("empty", t("traceStudio.newCol.empty"), t("traceStudio.newCol.emptySample"))}
        </div>
      </div>
      {start === "custom" && (
        <Field label={t("traceStudio.col.characters")}>
          <input className={`${inputCls} text-lg`} lang="km" value={custom} placeholder="A-Z · 0-9 · ក-អ · cat dog" onChange={(e) => setCustom(e.target.value)} />
        </Field>
      )}
      {failed && <p className="text-sm text-rose-700 dark:text-rose-300">{t("traceStudio.col.offline")}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <UIButton type="submit" icon={<Plus className="h-4 w-4" />} isLoading={busy}>
          {entries.length ? t("traceStudio.newCol.createWith", { count: entries.length }) : t("traceStudio.newCol.create")}
        </UIButton>
        <UIButton type="button" variant="secondary" onClick={onCancel}>
          {t("trace.action.notNow")}
        </UIButton>
      </div>
    </form>
  );
}

/* ================================================================= list */

/**
 * `creating` is owned by the studio, because "New collection" lives in the page
 * header — one main button for the tab that is open, not one per section.
 */
export function CollectionsList({ onOpen, onOpenItem, creating, onCreating }: { onOpen(id: string): void; onOpenItem(itemId: string): void; creating: boolean; onCreating(on: boolean): void }) {
  const { t } = useT();
  const [rows, setRows] = useState<StudioCollection[] | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [queue, setQueue] = useState<PendingCollection[]>([]);
  const { can } = usePermissions();
  const isAdmin = can("content:write");
  const [error, setError] = useState(false);
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);

  useEffect(() => {
    fetchStudioCollections()
      .then(setRows)
      .catch(() => setError(true));
    fetchReports()
      .then(setReports)
      .catch(() => {});
    if (isAdmin)
      fetchReviewQueue()
        .then(setQueue)
        .catch(() => {});
  }, [isAdmin]);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ListSort>("recent");
  const [stand, setStand] = useState<CollectionStatus | "">("");
  const [page, setPage] = useState(1);
  const [doomed, setDoomed] = useState<StudioCollection | null>(null);
  const [deleteError, setDeleteError] = useState(false);
  useEffect(() => setPage(1), [q, sort, stand]);
  const counts = useMemo(() => {
    const n: Record<string, number> = {};
    for (const c of rows ?? []) n[collectionStatus(c)] = (n[collectionStatus(c)] ?? 0) + 1;
    return n;
  }, [rows]);
  const shown = useMemo(
    () => sortBy((rows ?? []).filter((c) => matches(c.title, q) && (!stand || collectionStatus(c) === stand)), sort, (c) => c.title, (c) => Date.parse(c.updatedAt) || 0),
    [rows, q, sort, stand],
  );
  const view = pageOf(shown, page, COLLECTIONS_PER_PAGE);
  const removeCollection = async (c: StudioCollection) => {
    setDeleteError(false);
    try {
      await deleteStudioCollection(c.id);
      setRows((all) => (all ?? []).filter((x) => x.id !== c.id));
    } catch {
      setDeleteError(true);
    }
  };

  if (error) return <UIFlashMessage type="error" message={t("traceStudio.col.offline")} />;
  if (!rows) return <p className="text-muted">{t("traceStudio.col.loading")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted">{t("traceStudio.col.intro")}</p>
      {creating && <NewCollection onCreated={(id) => { onCreating(false); onOpen(id); }} onCancel={() => onCreating(false)} />}
      {queue.length > 0 && <ReviewQueue queue={queue} onDone={(id) => setQueue((q) => q.filter((c) => c.id !== id))} />}
      {reports.length > 0 && (
        <Section title={t("traceStudio.reports.title", { count: reports.length })} aside={<Flag className="h-4 w-4 text-rose-600" />}>
          <ul className="flex flex-col divide-y divide-line">
            {reports.map((r) => {
              const item = TraceDrafts.get(r.itemId)?.item;
              const where = rows.find((c) => c.id === r.collectionId)?.title;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="flex h-10 w-10 items-center justify-center text-indigo-700 dark:text-indigo-300">
                    {item && item.strokes.length ? <ItemThumb item={item} className="h-10 w-10" /> : <span className="text-xl font-bold">{item?.title ?? "?"}</span>}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-ink">
                      {item?.title ?? r.itemId}
                      {where && <span className="font-normal text-muted"> · {where}</span>}
                    </span>
                    <span className="text-sm text-rose-700 dark:text-rose-300">
                      {t(`trace.report.reason.${r.reason}`)}
                      {r.note && <span className="text-muted"> — “{r.note}”</span>}
                    </span>
                  </div>
                  <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</span>
                  {item && (
                    <UIButton size="sm" variant="secondary" onClick={() => onOpenItem(r.itemId)}>
                      {t("traceStudio.reports.open")}
                    </UIButton>
                  )}
                  <UIButton
                    size="sm"
                    icon={<Check className="h-4 w-4" />}
                    onClick={async () => {
                      await resolveReport(r.id);
                      setReports((all) => all.filter((x) => x.id !== r.id));
                    }}
                  >
                    {t("traceStudio.reports.resolve")}
                  </UIButton>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      {rows.length === 0 && !creating ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <ListPlus className="h-10 w-10 text-indigo-500" />
          <p className="max-w-md text-muted">{t("traceStudio.col.empty")}</p>
          <UIButton icon={<Plus className="h-4 w-4" />} onClick={() => onCreating(true)}>{t("traceStudio.col.new")}</UIButton>
        </div>
      ) : rows.length > 0 && (
        <section className={themeSystem.card("default", "flex flex-col gap-3 p-4")} aria-label={t("traceStudio.view.collections")}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input type="search" className={`${inputCls} pl-8`} lang="km" placeholder={t("traceStudio.col.search")} aria-label={t("traceStudio.col.search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select aria-label={t("traceStudio.filterStatus")} className={`${inputCls} w-auto`} value={stand} onChange={(e) => setStand(e.target.value as CollectionStatus | "")}>
              <option value="">{t("traceStudio.allStatus")} ({rows.length})</option>
              {COLLECTION_STATUSES.filter((st) => counts[st]).map((st) => (
                <option key={st} value={st}>{t(`traceStudio.colStatus.${st}`)} ({counts[st]})</option>
              ))}
            </select>
            <select aria-label={t("traceStudio.sort")} className={`${inputCls} w-auto`} value={sort} onChange={(e) => setSort(e.target.value as ListSort)}>
              <option value="recent">{t("traceStudio.sortRecent")}</option>
              <option value="title">{t("traceStudio.sortTitle")}</option>
            </select>
          </div>
          {deleteError && <div role="alert"><UIFlashMessage type="error" message={t("traceStudio.col.deleteFailed")} /></div>}
          {view.total === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{t("traceStudio.noMatch")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {view.rows.map((c) => {
                const covers = (c.cover ? [c.cover, ...c.itemIds.filter((x) => x !== c.cover)] : c.itemIds)
                  .slice(0, 6)
                  .map((id) => TraceDrafts.get(id)?.item)
                  .filter(Boolean) as TraceItem[];
                return (
                  <li key={c.id} className="group relative">
                    <button
                      onClick={() => onOpen(c.id)}
                      className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-indigo-400"
                    >
                      <div className="flex h-14 items-center gap-1 text-indigo-700 dark:text-indigo-300">
                        {c.picture && <span className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-play-sky"><Picture name={c.picture} cover fill /></span>}
                        {covers.length ? covers.map((it) => <ItemThumb key={it.id} item={it} className="h-12 w-12" />) : <ListPlus className="h-8 w-8 text-muted/60" />}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-lg font-semibold text-ink">{c.title}</span>
                        <StatusChip c={c} />
                      </div>
                      <span className="text-xs text-muted">{t("traceStudio.col.itemCount", { count: c.itemIds.length })}</span>
                    </button>
                    <div className="absolute right-2 top-2 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton size="sm" tone="danger" label={t("traceStudio.col.deleteNamed", { title: c.title })} onClick={() => setDoomed(c)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
            <span aria-live="polite">{t("traceStudio.col.total", { count: view.total })}</span>
            <UIPagination page={view.page} pages={view.pages} onPage={setPage} />
          </div>
        </section>
      )}
      <UIDialog
        isOpen={doomed !== null}
        onClose={() => setDoomed(null)}
        variant="danger"
        title={t("traceStudio.col.deleteTitle", { title: doomed?.title ?? "" })}
        description={t("traceStudio.col.deleteSure")}
        confirmText={t("traceStudio.delete")}
        onConfirm={() => doomed && void removeCollection(doomed)}
      />
    </div>
  );
}

/* ================================================================ board */

export function CollectionBoard({ id, onBack, onOpenItem }: { id: string; onBack(): void; onOpenItem(itemId: string): void }) {
  const { t } = useT();
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);
  const [col, setCol] = useState<StudioCollection | null>(null);
  const [saving, setSaving] = useState<"saved" | "saving" | "error">("saved");
  const [panel, setPanel] = useState<"list" | "existing" | "apply" | "auto" | null>(null);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picking, setPicking] = useState(false);
  const [flags, setFlags] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Record<string, ItemStats>>({});
  const { can } = usePermissions();
  const isAdmin = can("content:write");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    void TraceDrafts.pull();
    fetchItemStats()
      .then(setStats)
      .catch(() => {});
    fetchReports()
      .then((rs) => setFlags(rs.filter((r) => r.collectionId === id || !r.collectionId).reduce<Record<string, number>>((m, r) => ({ ...m, [r.itemId]: (m[r.itemId] ?? 0) + 1 }), {})))
      .catch(() => {});
    fetchStudioCollections()
      .then((rows) => setCol(rows.find((r) => r.id === id) ?? null))
      .catch(() => setSaving("error"));
  }, [id]);

  // Save a moment after the last change.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const update = useCallback((patch: Partial<StudioCollection>) => {
    setCol((c) => {
      if (!c) return c;
      const next = { ...c, ...patch };
      setSaving("saving");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        saveStudioCollection(next)
          .then((saved) => {
            setCol((cur) => (cur ? { ...cur, changed: saved.changed, updatedAt: saved.updatedAt } : cur));
            setSaving("saved");
          })
          .catch(() => setSaving("error"));
      }, 600);
      return next;
    });
  }, []);

  const drafts = useMemo(() => new Map(TraceDrafts.list().map((d) => [d.item.id, d])), [TraceDrafts.version()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!col) return <p className="text-muted">{saving === "error" ? t("traceStudio.col.offline") : t("traceStudio.col.loading")}</p>;

  const items = col.itemIds.map((i) => ({ id: i, draft: drafts.get(i) }));
  const ready = items.filter((x) => x.draft && runChecks(x.draft).every((c) => c.ok)).length;

  const move = (i: number, dir: -1 | 1) => moveTo(i, i + dir);
  /** Drag and drop (or the arrows): take the item out and put it back at `to`. */
  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= col.itemIds.length || from === to) return;
    const ids = [...col.itemIds];
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    update({ itemIds: ids });
  };
  const cover = col.cover && col.itemIds.includes(col.cover) ? col.cover : col.itemIds[0];

  const publish = async () => {
    setBusy(true);
    setMessage(null);
    setProblems(null);
    try {
      await TraceDrafts.flush();
      await saveStudioCollection(col);
      const found = await checkStudioCollection(col.id);
      if (found.length) {
        setProblems(found);
        return;
      }
      const saved = await publishStudioCollection(col.id);
      setCol({ ...col, ...saved });
      setMessage(
        saved.reviewState === "pending"
          ? { tone: "good", text: t("traceStudio.review.sent") }
          : { tone: "good", text: t("traceStudio.col.publishedNow", { rev: saved.publishedRev ?? 1 }) },
      );
    } catch {
      setMessage({ tone: "bad", text: t("traceStudio.col.publishFailed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <IconButton label={t("traceStudio.col.all")} onClick={onBack} tip="right">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <label className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 focus-within:ring-2 focus-within:ring-indigo-300 hover:bg-surface-muted">
          <input
            aria-label={t("traceStudio.col.title")}
            className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-ink outline-none"
            value={col.title}
            maxLength={80}
            placeholder={t("traceStudio.newCol.namePlaceholder")}
            onChange={(e) => update({ title: e.target.value })}
          />
          <Pencil className="h-4 w-4 shrink-0 text-muted group-hover:text-indigo-600" aria-hidden="true" />
        </label>
        <StatusChip c={col} />
        <span className="text-xs text-muted">{t(`traceStudio.col.save.${saving}`)}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <UIButton icon={<Rocket className="h-4 w-4" />} isLoading={busy} disabled={col.itemIds.length === 0 || (!isAdmin && col.reviewState === "pending" && !col.changed)} onClick={publish}>
            {!isAdmin ? t("traceStudio.review.send") : col.publishedRev === null ? t("traceStudio.col.publish") : t("traceStudio.col.republish")}
          </UIButton>
          {/* The rare actions, kept out of the way of Publish. */}
          <UIMenu align="end" className="w-56" trigger={({ toggle, isOpen }) => (
            <UIButton variant="secondary" size="icon" icon={<MoreHorizontal className="h-4 w-4" />} aria-label={t("traceStudio.col.more")} title={t("traceStudio.col.more")} aria-haspopup="menu" aria-expanded={isOpen} onClick={toggle} />
          )}>
            {({ close }) => (
              <>
                {col.publishedRev !== null && (
                  <UIMenuItem icon={<Undo2 className="h-4 w-4" />} onSelect={async () => {
                    close();
                    const saved = await unpublishStudioCollection(col.id);
                    setCol({ ...col, ...saved });
                  }}>
                    {t("traceStudio.col.unpublish")}
                  </UIMenuItem>
                )}
                <UIMenuItem tone="danger" icon={<Trash2 className="h-4 w-4" />} onSelect={() => { close(); setConfirmDelete(true); }}>
                  {t("traceStudio.col.delete")}
                </UIMenuItem>
              </>
            )}
          </UIMenu>
        </div>
        <UIDialog
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          variant="danger"
          title={t("traceStudio.col.deleteTitle", { title: col.title })}
          description={t("traceStudio.col.deleteSure")}
          confirmText={t("traceStudio.delete")}
          onConfirm={async () => {
            await deleteStudioCollection(col.id);
            onBack();
          }}
        />
      </div>

      {col.reviewState === "rejected" && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          <span className="font-semibold">{t("traceStudio.review.sentBackBy")}</span> {col.reviewNote || t("traceStudio.review.noNote")}
        </p>
      )}
      {col.reviewState === "pending" && (
        <UIFlashMessage type="info" message={t("traceStudio.review.pendingNote")} />
      )}
      {message && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${message.tone === "good" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"}`}>
          {message.text}
        </p>
      )}
      {problems && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <p className="font-semibold text-rose-800 dark:text-rose-200">{t("traceStudio.col.problems", { count: problems.length })}</p>
          <ul className="flex flex-col gap-1 text-sm text-rose-800 dark:text-rose-200">
            {problems.map((p, i) => (
              <li key={i}>
                {p.item ? (
                  <button className="font-semibold underline-offset-2 hover:underline" onClick={() => onOpenItem(p.item)}>
                    {p.title}
                  </button>
                ) : (
                  <span className="font-semibold">{t("traceStudio.col.theCollection")}</span>
                )}
                : {p.problems.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Items */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-body">{t("traceStudio.col.itemCount", { count: items.length })}</span>
            <span className="text-xs text-muted">{t("traceStudio.col.readyCount", { ready, total: items.length })}</span>
            {items.length > 1 && <span className="hidden text-xs text-muted sm:inline">· {t("traceStudio.col.dragHint")}</span>}
            <div className="ml-auto flex flex-wrap gap-2">
              <UIButton size="sm" icon={<ListPlus className="h-4 w-4" />} variant={panel === "list" ? "primary" : "secondary"} onClick={() => setPanel(panel === "list" ? null : "list")}>
                {t("traceStudio.col.fromList")}
              </UIButton>
              <UIButton size="sm" icon={<Plus className="h-4 w-4" />} variant={panel === "existing" ? "primary" : "secondary"} onClick={() => setPanel(panel === "existing" ? null : "existing")}>
                {t("traceStudio.col.addExisting")}
              </UIButton>
              <UIButton size="sm" icon={<Wand2 className="h-4 w-4" />} variant={panel === "auto" ? "primary" : "secondary"} disabled={items.length === 0} onClick={() => setPanel(panel === "auto" ? null : "auto")}>
                {t("traceStudio.auto.forSet")}
              </UIButton>
              <UIButton size="sm" icon={<Settings2 className="h-4 w-4" />} variant={panel === "apply" ? "primary" : "secondary"} disabled={items.length === 0} onClick={() => setPanel(panel === "apply" ? null : "apply")}>
                {t("traceStudio.col.applyAll")}
              </UIButton>
            </div>
          </div>

          {panel === "list" && (
            <FromList
              onCreate={(made) => {
                for (const d of made) TraceDrafts.save(d);
                update({ itemIds: [...col.itemIds, ...made.map((d) => d.item.id)] });
                setPanel(null);
              }}
            />
          )}
          {panel === "existing" && (
            <AddExisting
              exclude={new Set(col.itemIds)}
              onAdd={(ids) => {
                update({ itemIds: [...col.itemIds, ...ids] });
                setPanel(null);
              }}
            />
          )}
          {panel === "auto" && <AutoStrokesForSet itemIds={col.itemIds} onDone={() => undefined} />}
          {panel === "apply" && (
            <ApplyAll
              onApply={(patch) => {
                for (const i of col.itemIds) {
                  const d = drafts.get(i);
                  if (d) TraceDrafts.save({ ...d, item: { ...d.item, ...patch } });
                }
                setPanel(null);
              }}
            />
          )}

          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">{t("traceStudio.col.noItems")}</p>
          ) : (
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6">
              {items.map(({ id: itemId, draft }, i) => {
                const issues = draft ? runChecks(draft).filter((c) => !c.ok).length : -1;
                return (
                  <li
                    key={itemId}
                    draggable
                    onDragStart={(e) => {
                      setDragFrom(i);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(i);
                    }}
                    onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom !== null) moveTo(dragFrom, i);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={`group relative flex flex-col rounded-2xl border-2 bg-surface transition ${dragOver === i && dragFrom !== i ? "border-indigo-500 ring-2 ring-indigo-300" : "border-line"} ${dragFrom === i ? "opacity-40" : ""}`}
                  >
                    <button onClick={() => onOpenItem(itemId)} className="flex flex-col items-center gap-1.5 px-2 pb-3 pt-5 text-center" disabled={!draft}>
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 text-[11px] font-semibold tabular-nums text-muted">
                        <GripVertical className="h-3.5 w-3.5 cursor-grab" aria-hidden="true" />
                        {i + 1}
                      </span>
                      {cover === itemId && (
                        <span title={t("traceStudio.col.coverBadge")} className="absolute bottom-1.5 left-1.5 text-indigo-600">
                          <Star className="h-4 w-4 fill-current" />
                        </span>
                      )}
                      {flags[itemId] ? (
                        <span title={t("traceStudio.reports.flagged", { count: flags[itemId] })} className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[11px] font-semibold text-rose-600">
                          <Flag className="h-3.5 w-3.5" />
                          {flags[itemId]}
                        </span>
                      ) : null}
                      <span className="flex h-16 items-center text-indigo-700 dark:text-indigo-300">
                        {draft && draft.item.strokes.length > 0 ? (
                          <ItemThumb item={draft.item} />
                        ) : (
                          <span className="text-4xl font-bold text-muted/60" lang={draft?.item.script === "khmer" ? "km" : undefined}>
                            {draft?.item.title ?? "?"}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-sm font-semibold text-ink">{draft?.item.title ?? itemId}</span>
                      {stats[itemId] && stats[itemId].learners > 0 && (
                        <span className="text-[11px] text-muted" title={stats[itemId].topFault ? t("traceStudio.stats.often", { fault: t(`trace.faultShort.${stats[itemId].topFault}`) }) : undefined}>
                          {t("traceStudio.stats.line", { learners: stats[itemId].learners, pct: Math.round((100 * stats[itemId].canDo) / stats[itemId].learners) })}
                          {stats[itemId].topFault && <span className="text-rose-600 dark:text-rose-300"> · {t(`trace.faultShort.${stats[itemId].topFault}`)}</span>}
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-[11px] font-semibold ${issues === 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                        {issues === 0 ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                        {issues === -1 ? t("traceStudio.col.missing") : issues === 0 ? t("traceStudio.ready") : t("traceStudio.issues", { count: issues })}
                      </span>
                    </button>
                    <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton size="sm" label={t("traceStudio.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" label={t("traceStudio.moveDown")} disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" label={t("traceStudio.col.useAsCover")} active={cover === itemId} onClick={() => update({ cover: itemId })}>
                        <Star className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" tone="danger" label={t("traceStudio.col.remove")} onClick={() => update({ itemIds: col.itemIds.filter((x) => x !== itemId) })}>
                        <X className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* About the collection */}
        <div className="flex min-w-0 flex-col gap-3">
          <Section title={t("traceStudio.col.about")}>
            <CoverPicture picture={col.picture ?? null} onPick={() => setPicking(true)} onRemove={() => update({ picture: null })} />
            <Field label={t("traceStudio.col.description")}>
              <textarea className={`${inputCls} min-h-20`} maxLength={400} value={col.description} onChange={(e) => update({ description: e.target.value })} />
            </Field>
            <Field label={t("traceStudio.col.language")}>
              <select className={inputCls} value={col.language} onChange={(e) => update({ language: e.target.value })}>
                <option value="km">{t("traceStudio.scriptKhmer")}</option>
                <option value="en">{t("traceStudio.col.english")}</option>
              </select>
            </Field>
            <Field label={t("traceStudio.col.xpPerStep")}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={500}
                step={5}
                className={inputCls}
                placeholder={String(ScoringAPI.current().xpPerLevel)}
                value={col.xpPerStep ?? ""}
                onChange={(e) => update({ xpPerStep: e.target.value === "" ? null : Math.min(500, Math.max(0, Math.round(Number(e.target.value)))) })}
              />
            </Field>
            <p className="text-xs text-muted">{t("traceStudio.col.xpPerStepNote", { xp: ScoringAPI.current().xpPerLevel })}</p>
            <p className="text-xs text-muted">{t("traceStudio.col.publicNote")}</p>
          </Section>
        </div>
      </div>

      {/* The same drawer the Library Studio uses for a book's cover, opened on
          "Make with AI": a drawing for the art library or a painted picture. */}
      {picking && (
        <PicturePanel
          title={t("traceStudio.col.coverPicture")}
          chosen={col.picture ?? null}
          how="chosen"
          startOn="ai"
          promptSeed={coverPrompt(col.title, col.description)}
          brief={{ cambodia: col.language === "km" }}
          suggested={[]}
          photos={[]}
          allowNone={false}
          at={null}
          onPlace={() => {}}
          onChoose={(key) => key && update({ picture: key })}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/** What "Make with AI" opens with for a collection's cover: its name, and what it is for. */
const coverPrompt = (title: string, description: string) => {
  const name = title.trim();
  const about = description.trim() && description.trim() !== name ? ` ${description.trim()}` : "";
  return name ? `A cover illustration for a children's tracing collection called “${name}”.${about}` : "A cover illustration for a children's tracing collection";
};

/** The collection's cover picture: made with AI like a book's, or the cover item drawn when there is none. */
function CoverPicture({ picture, onPick, onRemove }: { picture: string | null; onPick(): void; onRemove(): void }) {
  const { t } = useT();
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("traceStudio.col.coverPicture")}</span>
      {picture ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onPick} aria-label={t("traceStudio.col.changeCover")}
            className="relative block aspect-[16/9] w-full overflow-hidden rounded-xl border border-line bg-play-sky hover:border-indigo-400">
            <Picture name={picture} cover fill />
          </button>
          <div className="flex flex-wrap gap-2">
            <UIButton type="button" size="sm" variant="secondary" icon={<Wand2 aria-hidden="true" />} onClick={onPick}>{t("traceStudio.col.changeCover")}</UIButton>
            <UIButton type="button" size="sm" variant="ghost" icon={<X aria-hidden="true" />} onClick={onRemove}>{t("traceStudio.col.removeCover")}</UIButton>
          </div>
        </div>
      ) : (
        <button type="button" onClick={onPick}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-muted transition hover:border-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
          <ImagePlus className="h-6 w-6" aria-hidden="true" />
          {t("traceStudio.col.makeCover")}
          <span className="px-4 text-center text-xs font-normal">{t("traceStudio.col.coverNote")}</span>
        </button>
      )}
    </div>
  );
}

/* ============================================================== panels */

function FromList({ onCreate }: { onCreate(drafts: TraceDraft[]): void }) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [grid, setGrid] = useState<TraceItem["grid"]>("4x3-moeys");
  const entries = parseList(text);
  return (
    <div className={panelCls}>
      <p className="text-sm text-body">{t("traceStudio.col.fromListNote")}</p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Field label={t("traceStudio.col.characters")}>
          <input className={`${inputCls} text-lg`} lang="km" value={text} placeholder="A-Z · 0-9 · ក-អ · ១-៩" onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label={t("traceStudio.grid")}>
          <select className={inputCls} value={grid} onChange={(e) => setGrid(e.target.value as TraceItem["grid"])}>
            {GRIDS.map((g) => (
              <option key={g} value={g}>
                {t(`traceStudio.gridName.${g}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {entries.length > 0 && (
        <p className="flex flex-wrap gap-1 text-lg text-ink" lang="km">
          {entries.slice(0, 60).map((e) => (
            <span key={e} className="rounded-md bg-surface px-1.5">
              {e}
            </span>
          ))}
          {entries.length > 60 && <span className="text-sm text-muted">+{entries.length - 60}</span>}
        </p>
      )}
      <div>
        <UIButton
          icon={<Plus className="h-4 w-4" />}
          disabled={entries.length === 0}
          onClick={() => onCreate(entries.map((e) => newDraft(itemFor(e, uid("t-"), { grid, sensitivity: "balanced" }))))}
        >
          {t("traceStudio.col.createN", { count: entries.length })}
        </UIButton>
      </div>
    </div>
  );
}

function AddExisting({ exclude, onAdd }: { exclude: Set<string>; onAdd(ids: string[]): void }) {
  const { t } = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PICKER_STEP);
  useEffect(() => setLimit(PICKER_STEP), [q]);
  const all = TraceDrafts.list().filter((d) => !exclude.has(d.item.id) && matches(d.item.title, q));
  return (
    <div className={panelCls}>
      <label className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input className={`${inputCls} pl-8`} lang="km" placeholder={t("traceStudio.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("traceStudio.search")} />
      </label>
      {all.length === 0 ? (
        <p className="text-sm text-muted">{t("traceStudio.col.noOthers")}</p>
      ) : (
        <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-7">
          {all.slice(0, limit).map((d) => {
            const on = picked.includes(d.item.id);
            return (
              <li key={d.item.id}>
                <button
                  aria-pressed={on}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== d.item.id) : [...picked, d.item.id])}
                  className={`flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-xs ${on ? "border-indigo-500 bg-surface ring-2 ring-indigo-300" : "border-line bg-surface"}`}
                >
                  <span className="flex h-12 items-center text-indigo-700 dark:text-indigo-300">
                    {d.item.strokes.length ? <ItemThumb item={d.item} className="h-12 w-12" /> : <span className="text-2xl font-bold text-muted/60">{d.item.title || "·"}</span>}
                  </span>
                  <span className="truncate text-body">{d.item.title || t("traceStudio.untitled")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > limit && (
        <UIButton size="sm" variant="secondary" onClick={() => setLimit((n) => n + PICKER_STEP)}>
          {t("traceStudio.col.showMore", { shown: limit, total: all.length })}
        </UIButton>
      )}
      <div>
        <UIButton icon={<Plus className="h-4 w-4" />} disabled={picked.length === 0} onClick={() => onAdd(picked)}>
          {t("traceStudio.col.addN", { count: picked.length })}
        </UIButton>
      </div>
    </div>
  );
}

function ApplyAll({ onApply }: { onApply(patch: Partial<TraceItem>): void }) {
  const { t } = useT();
  const [patch, setPatch] = useState<Partial<TraceItem>>({});
  const opt = (k: keyof TraceItem, v: string) => setPatch((p) => (v === "" ? Object.fromEntries(Object.entries(p).filter(([key]) => key !== k)) : { ...p, [k]: v }));
  return (
    <div className={panelCls}>
      <p className="text-sm text-body">{t("traceStudio.col.applyNote")}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("traceStudio.grid")}>
          <select className={inputCls} value={patch.grid ?? ""} onChange={(e) => opt("grid", e.target.value)}>
            <option value="">{t("traceStudio.col.keep")}</option>
            {GRIDS.map((g) => (
              <option key={g} value={g}>
                {t(`traceStudio.gridName.${g}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("traceStudio.numerals")}>
          <select className={inputCls} value={patch.numerals ?? ""} onChange={(e) => opt("numerals", e.target.value)}>
            <option value="">{t("traceStudio.col.keep")}</option>
            <option value="khmer">{t("traceStudio.numeralsKhmer")}</option>
            <option value="latin">{t("traceStudio.numeralsLatin")}</option>
          </select>
        </Field>
        <Field label={t("traceStudio.sensitivity")}>
          <select className={inputCls} value={patch.sensitivity ?? ""} onChange={(e) => opt("sensitivity", e.target.value)}>
            <option value="">{t("traceStudio.col.keep")}</option>
            {(["relaxed", "balanced", "strict"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`traceStudio.sens.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("traceStudio.script")}>
          <select className={inputCls} value={patch.script ?? ""} onChange={(e) => opt("script", e.target.value)}>
            <option value="">{t("traceStudio.col.keep")}</option>
            <option value="khmer">{t("traceStudio.scriptKhmer")}</option>
            <option value="latin">{t("traceStudio.scriptLatin")}</option>
          </select>
        </Field>
      </div>
      <div>
        <UIButton icon={<Check className="h-4 w-4" />} disabled={Object.keys(patch).length === 0} onClick={() => onApply(patch)}>
          {t("traceStudio.col.applyNow")}
        </UIButton>
      </div>
    </div>
  );
}

/* ============================================================ review */

/** Admins: collections creators asked to publish. Approve makes them live for everyone; Send back returns a note. */
function ReviewQueue({ queue, onDone }: { queue: PendingCollection[]; onDone(id: string): void }) {
  const { t } = useT();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Section title={t("traceStudio.review.queue", { count: queue.length })} aside={<Rocket className="h-4 w-4 text-indigo-600" />}>
      <p className="text-xs text-muted">{t("traceStudio.review.queueNote")}</p>
      <ul className="flex flex-col divide-y divide-line">
        {queue.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-ink">{c.pending.title}</span>
              <span className="text-xs text-muted">{t("traceStudio.col.itemCount", { count: c.pending.items.length })}</span>
            </div>
            <div className="flex flex-wrap gap-1 text-indigo-700 dark:text-indigo-300">
              {c.pending.items.slice(0, 24).map(({ item }) => (
                <ItemThumb key={item.id} item={item} className="h-10 w-10" />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputCls} min-w-56 flex-1`}
                placeholder={t("traceStudio.review.notePlaceholder")}
                aria-label={t("traceStudio.review.notePlaceholder")}
                value={notes[c.id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
              />
              <UIButton
                size="sm"
                variant="secondary"
                isLoading={busy === `${c.id}:reject`}
                onClick={async () => {
                  setBusy(`${c.id}:reject`);
                  try {
                    await rejectCollection(c.id, notes[c.id] ?? "");
                    onDone(c.id);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {t("traceStudio.review.sendBack")}
              </UIButton>
              <UIButton
                size="sm"
                icon={<Check className="h-4 w-4" />}
                isLoading={busy === `${c.id}:approve`}
                onClick={async () => {
                  setBusy(`${c.id}:approve`);
                  try {
                    await approveCollection(c.id);
                    onDone(c.id);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {t("traceStudio.review.approve")}
              </UIButton>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
