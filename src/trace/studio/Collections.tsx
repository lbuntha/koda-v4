/**
 * Trace collections in the Studio: the list of collections, and one
 * collection's board — its items in order, adding a whole set from a list,
 * applying settings to every item, and publishing it for everyone to practise.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, Flag, GripVertical, ListPlus, Pencil, Plus, Rocket, Search, Settings2, Star, Trash2, Undo2, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { usePermissions } from "../../lib/sync";
import { UIButton } from "../../components/ui";
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
import { Field, IconButton, Section, inputCls } from "./ui";

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const GRIDS: TraceItem["grid"][] = ["4x3-moeys", "3x3", "baseline-4-lines", "dots", "none"];

function StatusChip({ c }: { c: StudioCollection }) {
  const { t } = useT();
  const cls = "rounded-full px-2.5 py-0.5 text-xs font-semibold";
  if (c.reviewState === "pending") return <span className={`${cls} bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200`}>{t("traceStudio.review.waiting")}</span>;
  if (c.reviewState === "rejected") return <span className={`${cls} bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200`}>{t("traceStudio.review.sentBack")}</span>;
  if (c.publishedRev === null) return <span className={`${cls} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}>{t("traceStudio.col.draft")}</span>;
  if (c.changed) return <span className={`${cls} bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200`}>{t("traceStudio.col.changed", { rev: c.publishedRev })}</span>;
  return <span className={`${cls} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`}>{t("traceStudio.col.published", { rev: c.publishedRev })}</span>;
}

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
      className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition ${start === id ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200 dark:bg-violet-950/40 dark:ring-violet-900" : "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"}`}
    >
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{label}</span>
      {sample && (
        <span className="text-xs text-slate-500 dark:text-slate-400" lang="km">
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
      className="flex flex-col gap-4 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900 dark:bg-slate-900"
    >
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t("traceStudio.col.new")}</h2>
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
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("traceStudio.newCol.startWith")}</span>
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

export function CollectionsList({ onOpen, onOpenItem }: { onOpen(id: string): void; onOpenItem(itemId: string): void }) {
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

  const [creating, setCreating] = useState(false);

  if (error) return <p className="rounded-2xl bg-rose-50 p-4 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">{t("traceStudio.col.offline")}</p>;
  if (!rows) return <p className="text-slate-500 dark:text-slate-400">{t("traceStudio.col.loading")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">{t("traceStudio.col.intro")}</p>
        {!creating && (
          <UIButton icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            {t("traceStudio.col.new")}
          </UIButton>
        )}
      </div>
      {creating && <NewCollection onCreated={onOpen} onCancel={() => setCreating(false)} />}
      {queue.length > 0 && <ReviewQueue queue={queue} onDone={(id) => setQueue((q) => q.filter((c) => c.id !== id))} />}
      {reports.length > 0 && (
        <Section title={t("traceStudio.reports.title", { count: reports.length })} aside={<Flag className="h-4 w-4 text-rose-600" />}>
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {reports.map((r) => {
              const item = TraceDrafts.get(r.itemId)?.item;
              const where = rows.find((c) => c.id === r.collectionId)?.title;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="flex h-10 w-10 items-center justify-center text-violet-700 dark:text-violet-300">
                    {item && item.strokes.length ? <ItemThumb item={item} className="h-10 w-10" /> : <span className="text-xl font-bold">{item?.title ?? "?"}</span>}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item?.title ?? r.itemId}
                      {where && <span className="font-normal text-slate-500 dark:text-slate-400"> · {where}</span>}
                    </span>
                    <span className="text-sm text-rose-700 dark:text-rose-300">
                      {t(`trace.report.reason.${r.reason}`)}
                      {r.note && <span className="text-slate-600 dark:text-slate-300"> — “{r.note}”</span>}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
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
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
          <ListPlus className="h-10 w-10 text-violet-500" />
          <p className="max-w-md text-slate-600 dark:text-slate-300">{t("traceStudio.col.empty")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => {
            const covers = (c.cover ? [c.cover, ...c.itemIds.filter((x) => x !== c.cover)] : c.itemIds)
              .slice(0, 6)
              .map((id) => TraceDrafts.get(id)?.item)
              .filter(Boolean) as TraceItem[];
            return (
              <li key={c.id}>
                <button
                  onClick={() => onOpen(c.id)}
                  className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex h-14 items-center gap-1 text-violet-700 dark:text-violet-300">
                    {covers.length ? covers.map((it) => <ItemThumb key={it.id} item={it} className="h-12 w-12" />) : <ListPlus className="h-8 w-8 text-slate-300" />}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-lg font-semibold text-slate-900 dark:text-white">{c.title}</span>
                    <StatusChip c={c} />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.col.itemCount", { count: c.itemIds.length })}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ================================================================ board */

export function CollectionBoard({ id, onBack, onOpenItem }: { id: string; onBack(): void; onOpenItem(itemId: string): void }) {
  const { t } = useT();
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);
  const [col, setCol] = useState<StudioCollection | null>(null);
  const [saving, setSaving] = useState<"saved" | "saving" | "error">("saved");
  const [panel, setPanel] = useState<"list" | "existing" | "apply" | null>(null);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  if (!col) return <p className="text-slate-500 dark:text-slate-400">{saving === "error" ? t("traceStudio.col.offline") : t("traceStudio.col.loading")}</p>;

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
        <label className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 focus-within:ring-2 focus-within:ring-violet-300 hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <input
            aria-label={t("traceStudio.col.title")}
            className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-slate-900 outline-none dark:text-white"
            value={col.title}
            maxLength={80}
            placeholder={t("traceStudio.newCol.namePlaceholder")}
            onChange={(e) => update({ title: e.target.value })}
          />
          <Pencil className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-violet-600" aria-hidden="true" />
        </label>
        <StatusChip c={col} />
        <span className="text-xs text-slate-500 dark:text-slate-400">{t(`traceStudio.col.save.${saving}`)}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {col.publishedRev !== null && (
            <UIButton
              variant="secondary"
              icon={<Undo2 className="h-4 w-4" />}
              onClick={async () => {
                const saved = await unpublishStudioCollection(col.id);
                setCol({ ...col, ...saved });
              }}
            >
              {t("traceStudio.col.unpublish")}
            </UIButton>
          )}
          <UIButton icon={<Rocket className="h-4 w-4" />} isLoading={busy} disabled={col.itemIds.length === 0 || (!isAdmin && col.reviewState === "pending" && !col.changed)} onClick={publish}>
            {!isAdmin ? t("traceStudio.review.send") : col.publishedRev === null ? t("traceStudio.col.publish") : t("traceStudio.col.republish")}
          </UIButton>
        </div>
      </div>

      {col.reviewState === "rejected" && (
        <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          <span className="font-semibold">{t("traceStudio.review.sentBackBy")}</span> {col.reviewNote || t("traceStudio.review.noNote")}
        </p>
      )}
      {col.reviewState === "pending" && (
        <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{t("traceStudio.review.pendingNote")}</p>
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
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("traceStudio.col.itemCount", { count: items.length })}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.col.readyCount", { ready, total: items.length })}</span>
            {items.length > 1 && <span className="hidden text-xs text-slate-400 sm:inline">· {t("traceStudio.col.dragHint")}</span>}
            <div className="ml-auto flex flex-wrap gap-2">
              <UIButton size="sm" icon={<ListPlus className="h-4 w-4" />} variant={panel === "list" ? "primary" : "secondary"} onClick={() => setPanel(panel === "list" ? null : "list")}>
                {t("traceStudio.col.fromList")}
              </UIButton>
              <UIButton size="sm" icon={<Plus className="h-4 w-4" />} variant={panel === "existing" ? "primary" : "secondary"} onClick={() => setPanel(panel === "existing" ? null : "existing")}>
                {t("traceStudio.col.addExisting")}
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
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">{t("traceStudio.col.noItems")}</p>
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
                    className={`group relative flex flex-col rounded-2xl border bg-white transition dark:bg-slate-900 ${dragOver === i && dragFrom !== i ? "border-violet-500 ring-2 ring-violet-300" : "border-slate-200 dark:border-slate-700"} ${dragFrom === i ? "opacity-40" : ""}`}
                  >
                    <button onClick={() => onOpenItem(itemId)} className="flex flex-col items-center gap-1.5 px-2 pb-3 pt-5 text-center" disabled={!draft}>
                      <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 text-[11px] font-semibold tabular-nums text-slate-400">
                        <GripVertical className="h-3.5 w-3.5 cursor-grab" aria-hidden="true" />
                        {i + 1}
                      </span>
                      {cover === itemId && (
                        <span title={t("traceStudio.col.coverBadge")} className="absolute bottom-1.5 left-1.5 text-violet-600">
                          <Star className="h-4 w-4 fill-current" />
                        </span>
                      )}
                      {flags[itemId] ? (
                        <span title={t("traceStudio.reports.flagged", { count: flags[itemId] })} className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[11px] font-semibold text-rose-600">
                          <Flag className="h-3.5 w-3.5" />
                          {flags[itemId]}
                        </span>
                      ) : null}
                      <span className="flex h-16 items-center text-violet-700 dark:text-violet-300">
                        {draft && draft.item.strokes.length > 0 ? (
                          <ItemThumb item={draft.item} />
                        ) : (
                          <span className="text-4xl font-bold text-slate-300 dark:text-slate-600" lang={draft?.item.script === "khmer" ? "km" : undefined}>
                            {draft?.item.title ?? "?"}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{draft?.item.title ?? itemId}</span>
                      {stats[itemId] && stats[itemId].learners > 0 && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400" title={stats[itemId].topFault ? t("traceStudio.stats.often", { fault: t(`trace.faultShort.${stats[itemId].topFault}`) }) : undefined}>
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
            <Field label={t("traceStudio.col.description")}>
              <textarea className={`${inputCls} min-h-20`} maxLength={400} value={col.description} onChange={(e) => update({ description: e.target.value })} />
            </Field>
            <Field label={t("traceStudio.col.language")}>
              <select className={inputCls} value={col.language} onChange={(e) => update({ language: e.target.value })}>
                <option value="km">{t("traceStudio.scriptKhmer")}</option>
                <option value="en">{t("traceStudio.col.english")}</option>
              </select>
            </Field>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.col.publicNote")}</p>
          </Section>
          <Section title={t("traceStudio.col.danger")} defaultOpen={false}>
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-rose-700 dark:text-rose-300">{t("traceStudio.col.deleteSure")}</span>
                <UIButton
                  size="sm"
                  variant="danger"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={async () => {
                    await deleteStudioCollection(col.id);
                    onBack();
                  }}
                >
                  {t("traceStudio.delete")}
                </UIButton>
                <UIButton size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
                  {t("trace.action.notNow")}
                </UIButton>
              </div>
            ) : (
              <UIButton size="sm" variant="secondary" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                {t("traceStudio.col.delete")}
              </UIButton>
            )}
          </Section>
        </div>
      </div>
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
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
      <p className="text-sm text-slate-700 dark:text-slate-200">{t("traceStudio.col.fromListNote")}</p>
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
        <p className="flex flex-wrap gap-1 text-lg text-slate-800 dark:text-slate-100" lang="km">
          {entries.slice(0, 60).map((e) => (
            <span key={e} className="rounded-md bg-white px-1.5 dark:bg-slate-900">
              {e}
            </span>
          ))}
          {entries.length > 60 && <span className="text-sm text-slate-500">+{entries.length - 60}</span>}
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
  const all = TraceDrafts.list().filter((d) => !exclude.has(d.item.id) && (!q || d.item.title.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
      <label className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input className={`${inputCls} pl-8`} lang="km" placeholder={t("traceStudio.search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("traceStudio.search")} />
      </label>
      {all.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("traceStudio.col.noOthers")}</p>
      ) : (
        <ul className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-7">
          {all.map((d) => {
            const on = picked.includes(d.item.id);
            return (
              <li key={d.item.id}>
                <button
                  aria-pressed={on}
                  onClick={() => setPicked(on ? picked.filter((x) => x !== d.item.id) : [...picked, d.item.id])}
                  className={`flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-xs ${on ? "border-violet-500 bg-white ring-2 ring-violet-300 dark:bg-slate-900" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}
                >
                  <span className="flex h-12 items-center text-violet-700 dark:text-violet-300">
                    {d.item.strokes.length ? <ItemThumb item={d.item} className="h-12 w-12" /> : <span className="text-2xl font-bold text-slate-300">{d.item.title || "·"}</span>}
                  </span>
                  <span className="truncate text-slate-700 dark:text-slate-200">{d.item.title || t("traceStudio.untitled")}</span>
                </button>
              </li>
            );
          })}
        </ul>
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
    <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
      <p className="text-sm text-slate-700 dark:text-slate-200">{t("traceStudio.col.applyNote")}</p>
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
    <Section title={t("traceStudio.review.queue", { count: queue.length })} aside={<Rocket className="h-4 w-4 text-violet-600" />}>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.review.queueNote")}</p>
      <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        {queue.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-slate-900 dark:text-white">{c.pending.title}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t("traceStudio.col.itemCount", { count: c.pending.items.length })}</span>
            </div>
            <div className="flex flex-wrap gap-1 text-violet-700 dark:text-violet-300">
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
