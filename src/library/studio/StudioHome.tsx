import { useCallback, useEffect, useMemo, useState } from "react";
import { BookPlus, ChevronLeft, ChevronRight, Mic, Pencil, RefreshCw, Search, X } from "lucide-react";
import { UIBadge, UIButton, UIDataTable, UIPageHeader, UISpinner, UITabs, type UIDataTableColumn } from "../../components/ui";
import { themeSystem } from "../../lib/themeSystem";
import { fetchStudioBooks, type BookSummary, type StudioMeta, type StudioPage, type StudioQuery, type StudioStatus } from "../api";
import { BANDS, type Band } from "../data/passage";
import { Picture } from "../Picture";

/**
 * The studio's front page: every book, a page at a time.
 *
 * Search, filters, sort and paging all run on the server (`GET /library/drafts`),
 * so the page stays quick with thousands of books and never downloads a story
 * to list it. The filter options are the ones the books actually have, with
 * counts, and the choices the server accepts come from `/library/studio/meta` —
 * nothing here keeps its own list of categories, sorts or statuses.
 *
 * The view (tab, filters, sort, page size) is remembered on this device; the
 * search box is not, so a returning author is never puzzled by a hidden filter.
 */

const VIEW_KEY = "koda_library_studio_view_v1";
const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const SEARCH_DELAY_MS = 300;

type Tab = "all" | StudioStatus;
interface View { tab: Tab; language: string; band: string; category: string; sort: string; pageSize: number }

/** Words for what the server names; an unknown key shows as itself rather than disappearing. */
const TAB_LABEL: Record<string, string> = { all: "All books", draft: "Drafts", published: "Published", changed: "Unpublished changes", reported: "Reported" };
const SORT_LABEL: Record<string, string> = { updated: "Recently edited", title: "Title A–Z", created: "Newest", published: "Recently published" };

const languageName = (() => {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(undefined, { type: "language" });
  } catch {
    names = null;
  }
  return (code: string) => names?.of(code) ?? code;
})();

const bandLabel = (b: string) => {
  const band = BANDS[b as Band];
  return band ? `Level ${b} · ages ${band.ages[0]}–${band.ages[1]}` : `Level ${b}`;
};

const relative = (() => {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];
  return (iso?: string | null) => {
    if (!iso) return "—";
    const secs = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unit, size] of steps) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
    return rtf.format(0, "minute");
  };
})();

const fullDate = (iso?: string | null) =>
  iso ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "";

function readView(meta: StudioMeta | null): View {
  const fallback: View = { tab: "all", language: "", band: "", category: "", sort: meta?.sorts[0] ?? "updated", pageSize: 25 };
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null") as Partial<View> | null;
    return saved ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

export interface StudioHomeProps {
  meta: StudioMeta | null;
  /** Opening a row: the id of the book, its summary for an instant title. */
  onOpen(book: BookSummary): void;
  onNew(): void;
  onSoundNames(): void;
  /** The id being opened, to show on its row while the full book loads. */
  opening?: string | null;
  /** Bumped by the parent after an edit, so the list is fetched again. */
  refreshKey?: number;
}

export function StudioHome({ meta, onOpen, onNew, onSoundNames, opening = null, refreshKey = 0 }: StudioHomeProps) {
  const [view, setViewState] = useState<View>(() => readView(meta));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StudioPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  const setView = (patch: Partial<View>) => {
    setViewState((v) => {
      const next = { ...v, ...patch };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        /* a remembered view is a convenience */
      }
      return next;
    });
    setPage(1);
  };

  // The page sizes on offer, inside what the server accepts.
  const pageSizes = useMemo(() => {
    const lo = meta?.pageSizeMin ?? 5;
    const hi = meta?.pageSizeMax ?? 100;
    return [...new Set([25, 50, 100].map((n) => Math.min(hi, Math.max(lo, n))))];
  }, [meta]);

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    const q: StudioQuery = {
      q: query.trim(),
      status: view.tab === "all" ? "" : view.tab,
      language: view.language,
      band: view.band,
      category: view.category,
      sort: view.sort,
      page,
      pageSize: view.pageSize,
    };
    try {
      const got = await fetchStudioBooks(q, signal);
      if (signal.aborted) return;
      setResult(got);
      // A page past the end (the last book on it was deleted): go to the last page.
      if (got.total > 0 && page > got.pages) setPage(got.pages);
    } catch (e) {
      if (!signal.aborted) setError(e instanceof Error ? e.message : "The books could not be loaded.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [page, query, view]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? SEARCH_DELAY_MS : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, reloads, refreshKey, query]);

  useEffect(() => setPage(1), [query]);

  const stats = result?.stats;
  const tabs = useMemo(
    () => (["all", ...(meta?.statuses ?? ["draft", "published", "changed", "reported"])] as Tab[]).map((id) => ({ id, label: TAB_LABEL[id] ?? id, count: stats?.[id] })),
    [meta, stats],
  );
  const facets = result?.facets;
  const filtered = Boolean(query.trim() || view.language || view.band || view.category);
  const clear = () => {
    setQuery("");
    setView({ language: "", band: "", category: "" });
  };

  const columns = useMemo<UIDataTableColumn<BookSummary>[]>(() => [
    {
      key: "book",
      header: "Book",
      render: (b) => (
        <div className="flex min-w-[15rem] items-center gap-3">
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-play-sky p-1"><Picture name={b.picture} /></span>
          <span className="min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(b); }}
              className={`block max-w-[22rem] truncate text-left font-bold text-ink hover:text-indigo-700 hover:underline dark:hover:text-indigo-300 ${b.language === "km" ? KHMER : ""}`}
            >
              {b.title}
            </button>
            <span className="block truncate font-mono text-xs text-muted">{b.id}</span>
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      nowrap: true,
      render: (b) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {b.status === "published" ? <UIBadge variant="success">Published · rev {b.rev}</UIBadge> : <UIBadge variant="neutral">Draft</UIBadge>}
          {b.changed && <UIBadge variant="primary" title="Saved since it was published — children still read the published revision">Unpublished changes</UIBadge>}
          {b.reports > 0 && <UIBadge variant="danger">⚑ {b.reports} report{b.reports === 1 ? "" : "s"}</UIBadge>}
        </div>
      ),
    },
    { key: "language", header: "Language", nowrap: true, render: (b) => languageName(b.language) },
    { key: "level", header: "Level", nowrap: true, render: (b) => bandLabel(b.band) },
    { key: "category", header: "Shelf", nowrap: true, muted: true, render: (b) => b.category ?? "—" },
    { key: "content", header: "Content", nowrap: true, muted: true, render: (b) => `${b.sentences} sentences · ${b.questions} questions` },
    { key: "edited", header: "Edited", nowrap: true, muted: true, render: (b) => <time dateTime={b.updatedAt ?? undefined} title={fullDate(b.updatedAt)}>{relative(b.updatedAt)}</time> },
    {
      key: "actions",
      header: "",
      align: "right",
      nowrap: true,
      render: (b) => (
        <UIButton variant="ghost" size="sm" icon={<Pencil />} isLoading={opening === b.id} onClick={(e) => { e.stopPropagation(); onOpen(b); }} aria-label={`Edit ${b.title}`}>
          Edit
        </UIButton>
      ),
    },
  ], [onOpen, opening]);

  const firstLoad = loading && !result;
  const empty = result && result.total === 0;
  const nothingAtAll = empty && !filtered && view.tab === "all";

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 px-4 pb-24 pt-4 sm:px-6">
      <UIPageHeader
        eyebrow="Koda Library"
        title="Library Studio"
        subtitle="Write a story, let a model draft the questions, check them, and publish to every child’s library."
        action={
          <div className="flex flex-wrap gap-2">
            <UIButton variant="secondary" icon={<Mic />} onClick={onSoundNames}>Khmer sound names</UIButton>
            <UIButton variant="primary" icon={<BookPlus />} onClick={onNew}>New book</UIButton>
          </div>
        }
      />

      <UITabs<Tab> items={tabs} value={view.tab} onChange={(tab) => setView({ tab })} label="Books by status" />

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-label="Books">
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <span className="sr-only">Search books</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or id" className={themeSystem.field("lg", "pl-9")} />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:flex">
            <Select label="Language" value={view.language} onChange={(language) => setView({ language })} all="All languages"
              options={(facets?.languages ?? []).map((f) => ({ value: f.value, label: `${languageName(f.value)} (${f.count})` }))} />
            <Select label="Level" value={view.band} onChange={(band) => setView({ band })} all="All levels"
              options={(facets?.bands ?? []).map((f) => ({ value: f.value, label: `${bandLabel(f.value)} (${f.count})` }))} />
            <Select label="Shelf" value={view.category} onChange={(category) => setView({ category })} all="All shelves"
              options={(facets?.categories ?? []).map((f) => ({ value: f.value, label: `${f.value} (${f.count})` }))} />
            <Select label="Sort" value={view.sort} onChange={(sort) => setView({ sort })}
              options={(meta?.sorts ?? [view.sort]).map((s) => ({ value: s, label: SORT_LABEL[s] ?? s }))} />
          </div>
          <div className="flex gap-2">
            {filtered && <UIButton variant="ghost" icon={<X />} onClick={clear}>Clear</UIButton>}
            <UIButton variant="secondary" size="icon" icon={<RefreshCw />} isLoading={loading && !!result} onClick={() => setReloads((n) => n + 1)} aria-label="Refresh the list" />
          </div>
        </div>

        {error && (
          <div className="m-4 mb-0 flex flex-wrap items-center gap-3">
            <p role="alert" className={themeSystem.flash("error", "flex-1")}>{error}</p>
            <UIButton variant="secondary" size="sm" onClick={() => setReloads((n) => n + 1)}>Try again</UIButton>
          </div>
        )}

        <div className={`p-4 pb-0 transition-opacity ${loading && result ? "opacity-60" : ""}`} aria-busy={loading || undefined}>
          {firstLoad ? (
            <div className="grid place-items-center py-16"><UISpinner /></div>
          ) : nothingAtAll ? (
            <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line px-4 py-12 text-center">
              <p className="font-bold text-ink">No books yet</p>
              <p className="max-w-md text-sm text-muted">The starter books ship with the app. Write the first one of your own — paste a story and the studio drafts the questions.</p>
              <UIButton variant="primary" icon={<BookPlus />} onClick={onNew}>Write the first book</UIButton>
            </div>
          ) : empty ? (
            <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line px-4 py-12 text-center">
              <p className="font-bold text-ink">No books match</p>
              <p className="text-sm text-muted">{filtered ? "Try another search, or clear the filters." : `Nothing is ${(TAB_LABEL[view.tab] ?? view.tab).toLowerCase()} right now.`}</p>
              {filtered && <UIButton variant="secondary" icon={<X />} onClick={clear}>Clear filters</UIButton>}
            </div>
          ) : (
            <UIDataTable
              columns={columns}
              rows={result?.books ?? []}
              rowKey={(b) => b.id}
              onRowClick={onOpen}
              caption="Library books"
            />
          )}
        </div>

        <div className="flex flex-col gap-3 px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span aria-live="polite">
            {result ? `${result.total} book${result.total === 1 ? "" : "s"}${result.total ? ` · page ${result.page} of ${result.pages}` : ""}` : " "}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>Per page</span>
              <select value={view.pageSize} onChange={(e) => setView({ pageSize: Number(e.target.value) })} className={themeSystem.field("sm")}>
                {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <UIButton variant="secondary" size="sm" icon={<ChevronLeft />} disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</UIButton>
            <UIButton variant="secondary" size="sm" iconRight={<ChevronRight />} disabled={page >= (result?.pages ?? 1) || loading} onClick={() => setPage((p) => p + 1)}>Next</UIButton>
          </div>
        </div>
      </section>
    </div>
  );
}

function Select({ label, value, onChange, options, all }: {
  label: string; value: string; onChange(v: string): void; options: Array<{ value: string; label: string }>; all?: string;
}) {
  // A saved filter the books no longer have stays selectable, so it can be seen and cleared.
  const shown = value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options;
  return (
    <label className="min-w-0 xl:w-44">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={themeSystem.field("lg")}>
        {all !== undefined && <option value="">{all}</option>}
        {shown.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
