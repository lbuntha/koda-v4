import { useCallback, useEffect, useMemo, useState } from "react";
import { BookPlus, ChevronDown, Mic, Pencil, RefreshCw, Trash2, Wrench, X } from "lucide-react";
import { UIBadge, UIButton, UIDataTable, UIDialog, UIFlashMessage, UIMenu, UIMenuItem, UIPageHeader, UIPagination, UISpinner, UITabs, type UIDataTableColumn, UISearchInput } from "../../components/ui";
import { themeSystem } from "../../lib/themeSystem";
import { deleteBook, fetchStudioBooks, type BookSummary, type StudioMeta, type StudioPage, type StudioQuery, type StudioStatus } from "../api";
import { BANDS, type Band } from "../data/passage";
import { Picture } from "../Picture";
import { currentLanguage, formatDate, translate, useT } from "../../lib/i18n";

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

/**
 * Words for what the server names, from the catalog (`studio.tab.*`,
 * `studio.sort.*`); a key the catalog does not know shows as itself rather
 * than disappearing.
 */
const named = (group: string, id: string) => {
  const text = translate(`studio.${group}.${id}`);
  return text === `studio.${group}.${id}` ? id : text;
};

/** A book language's name, in the app's language — "Khmer", or "ខ្មែរ". */
const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(currentLanguage(), { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

const bandLabel = (b: string) => {
  const band = BANDS[b as Band];
  return band
    ? translate("studio.bandAges", { band: b, from: band.ages[0], to: band.ages[1] })
    : translate("library.level", { level: b });
};

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];
const relative = (iso?: string | null) => {
  if (!iso) return "—";
  const rtf = new Intl.RelativeTimeFormat(currentLanguage(), { numeric: "auto" });
  const secs = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of RELATIVE_STEPS) if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit);
  return rtf.format(0, "minute");
};

const fullDate = (iso?: string | null) =>
  iso ? formatDate(iso, { dateStyle: "medium", timeStyle: "short" }) : "";

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
  const { t, language } = useT();
  const [view, setViewState] = useState<View>(() => readView(meta));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StudioPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);
  /* Selection is per page: a box ticked on page 3 and forgotten should never be
     deleted from page 1. Any change to what is listed clears it. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<BookSummary[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      if (!signal.aborted) setError(e instanceof Error ? e.message : t("studio.error.load"));
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
  useEffect(() => setSelected(new Set()), [page, query, view]);

  const toggle = (id: string) => setSelected((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  /** One at a time, so a failure names its book and the rest still go. */
  const remove = async (books: BookSummary[]) => {
    setDeleting(true);
    setFlash(null);
    const failed: string[] = [];
    for (const b of books) {
      try {
        await deleteBook(b.id);
      } catch {
        failed.push(b.title);
      }
    }
    setDeleting(false);
    setSelected(new Set());
    const done = books.length - failed.length;
    setFlash(failed.length
      ? { type: "error", text: t("studio.deleteFailed", { count: failed.length, titles: failed.join(", ") }) }
      : { type: "success", text: t("studio.deleted", { count: done }) });
    setReloads((n) => n + 1);
  };

  const stats = result?.stats;
  const tabs = useMemo(
    () => (["all", ...(meta?.statuses ?? ["draft", "published", "changed", "reported"])] as Tab[]).map((id) => ({ id, label: named("tab", id), count: stats?.[id] })),
    // `language`: the labels are words, and words change with it.
    [meta, stats, language],
  );
  const facets = result?.facets;
  const filtered = Boolean(query.trim() || view.language || view.band || view.category);
  const clear = () => {
    setQuery("");
    setView({ language: "", band: "", category: "" });
  };

  /*
   * Four columns: what the book is (with its language, level and shelf as one
   * line under the title, where they are read together anyway), where it stands,
   * how big it is, and when it was touched. Seven columns ran off the side of a
   * laptop and pushed the Edit button out of sight.
   */
  const columns = useMemo<UIDataTableColumn<BookSummary>[]>(() => [
    {
      key: "select",
      header: "",
      render: (b) => (
        <input
          type="checkbox"
          checked={selected.has(b.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggle(b.id)}
          aria-label={t("studio.selectBook", { title: b.title })}
          className="h-4 w-4 accent-indigo-600"
        />
      ),
    },
    {
      key: "book",
      header: t("studio.col.book"),
      render: (b) => (
        <div className="flex min-w-[16rem] items-center gap-3">
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-play-sky p-1"><Picture name={b.picture} /></span>
          <span className="min-w-0">
            <button
              type="button"
              title={b.id}
              onClick={(e) => { e.stopPropagation(); onOpen(b); }}
              className={`block max-w-[26rem] truncate text-left font-bold text-ink hover:text-indigo-700 hover:underline dark:hover:text-indigo-300 ${b.language === "km" ? KHMER : ""}`}
            >
              {b.title}
            </button>
            <span className="block truncate text-xs text-muted">
              {[languageName(b.language), bandLabel(b.band), b.category].filter(Boolean).join(" · ")}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: t("studio.col.status"),
      nowrap: true,
      render: (b) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {b.status !== "published" ? (
            <UIBadge variant="neutral">{t("skillCard.draft")}</UIBadge>
          ) : b.changed ? (
            <UIBadge variant="primary" title={t("studio.changedNote")}>{t("studio.tab.changed")}</UIBadge>
          ) : (
            <UIBadge variant="success">{t("studio.tab.published")}</UIBadge>
          )}
          {b.status === "published" && <span className="text-xs text-muted">{t("studio.rev", { rev: b.rev })}</span>}
          {b.reports > 0 && <UIBadge variant="danger">⚑ {t("studio.reports", { count: b.reports })}</UIBadge>}
        </div>
      ),
    },
    { key: "content", header: t("studio.col.content"), nowrap: true, muted: true, render: (b) => `${t("studio.sentences", { count: b.sentences })} · ${t("studio.questions", { count: b.questions })}` },
    { key: "edited", header: t("studio.col.edited"), nowrap: true, muted: true, render: (b) => <time dateTime={b.updatedAt ?? undefined} title={fullDate(b.updatedAt)}>{relative(b.updatedAt)}</time> },
    {
      key: "actions",
      header: "",
      align: "right",
      nowrap: true,
      render: (b) => (
        <div className="flex items-center justify-end gap-1">
          <UIButton variant="secondary" size="sm" icon={<Pencil />} isLoading={opening === b.id} onClick={(e) => { e.stopPropagation(); onOpen(b); }} aria-label={t("studio.editBook", { title: b.title })}>
            {t("studio.edit")}
          </UIButton>
          <UIButton variant="ghost" size="icon" icon={<Trash2 />} disabled={deleting} className="text-rose-700 dark:text-rose-300" onClick={(e) => { e.stopPropagation(); setConfirm([b]); }} aria-label={t("studio.deleteBook", { title: b.title })} title={t("studio.publish.delete")} />
        </div>
      ),
    },
  ], [onOpen, opening, t, selected, deleting]);

  const firstLoad = loading && !result;
  const empty = result && result.total === 0;
  const nothingAtAll = empty && !filtered && view.tab === "all";

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-5 px-4 pb-24 pt-4 sm:px-6">
      <UIPageHeader
        eyebrow={t("studio.eyebrow")}
        title={t("nav.library-studio")}
        subtitle={t("studio.subtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <UIMenu align="end" className="w-60" trigger={({ toggle, isOpen }) => (
              <UIButton variant="secondary" icon={<Wrench />} iconRight={<ChevronDown />} aria-haspopup="menu" aria-expanded={isOpen} onClick={toggle}>{t("studio.tools")}</UIButton>
            )}>
              {({ close }) => (
                <UIMenuItem icon={<Mic className="h-4 w-4" />} onSelect={() => { close(); onSoundNames(); }}>{t("studio.soundNames")}</UIMenuItem>
              )}
            </UIMenu>
            <UIButton variant="primary" icon={<BookPlus />} onClick={onNew}>{t("studio.newBook")}</UIButton>
          </div>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-line bg-surface" aria-label={t("studio.books")}>
        <div className="grid gap-3 border-b border-line p-4">
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <UITabs<Tab> items={tabs} value={view.tab} onChange={(tab) => setView({ tab })} label={t("studio.byStatus")} />
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <UISearchInput className="flex-1" label={t("library.search")} placeholder={t("studio.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <Select label={t("studio.col.language")} value={view.language} onChange={(language) => setView({ language })} all={t("studio.allLanguages")}
                options={(facets?.languages ?? []).map((f) => ({ value: f.value, label: `${languageName(f.value)} (${f.count})` }))} />
              <Select label={t("studio.col.level")} value={view.band} onChange={(band) => setView({ band })} all={t("studio.allLevels")}
                options={(facets?.bands ?? []).map((f) => ({ value: f.value, label: `${bandLabel(f.value)} (${f.count})` }))} />
              <Select label={t("studio.col.shelf")} value={view.category} onChange={(category) => setView({ category })} all={t("studio.allShelves")}
                options={(facets?.categories ?? []).map((f) => ({ value: f.value, label: `${f.value} (${f.count})` }))} />
              <Select label={t("studio.sortLabel")} value={view.sort} onChange={(sort) => setView({ sort })}
                options={(meta?.sorts ?? [view.sort]).map((s) => ({ value: s, label: named("sort", s) }))} />
              {filtered && <UIButton variant="ghost" size="sm" icon={<X />} onClick={clear}>{t("studio.clear")}</UIButton>}
              <UIButton variant="ghost" size="icon" icon={<RefreshCw />} isLoading={loading && !!result} onClick={() => setReloads((n) => n + 1)} aria-label={t("studio.refresh")} title={t("studio.refresh")} />
            </div>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-indigo-50/60 px-4 py-2 dark:bg-indigo-950/30">
            <span className="text-sm font-bold text-ink">{t("studio.selectedCount", { count: selected.size })}</span>
            <UIButton variant="ghost" size="sm" onClick={() => setSelected(new Set((result?.books ?? []).map((b) => b.id)))}>{t("studio.selectPage")}</UIButton>
            <UIButton variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{t("studio.clearSelection")}</UIButton>
            <UIButton variant="danger" size="sm" icon={<Trash2 />} className="ml-auto" isLoading={deleting} onClick={() => setConfirm((result?.books ?? []).filter((b) => selected.has(b.id)))}>
              {t("studio.deleteSelected", { count: selected.size })}
            </UIButton>
          </div>
        )}
        {flash && <div className="m-4 mb-0" role="status"><UIFlashMessage type={flash.type} message={flash.text} /></div>}

        {error && (
          <div className="m-4 mb-0 flex flex-wrap items-center gap-3">
            <p role="alert" className={themeSystem.flash("error", "flex-1")}>{error}</p>
            <UIButton variant="secondary" size="sm" onClick={() => setReloads((n) => n + 1)}>{t("studio.tryAgain")}</UIButton>
          </div>
        )}

        <div className={`p-4 pb-0 transition-opacity ${loading && result ? "opacity-60" : ""}`} aria-busy={loading || undefined}>
          {firstLoad ? (
            <div className="grid place-items-center py-16"><UISpinner /></div>
          ) : nothingAtAll ? (
            <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line px-4 py-12 text-center">
              <p className="font-bold text-ink">{t("studio.empty.title")}</p>
              <p className="max-w-md text-sm text-muted">{t("studio.empty.note")}</p>
              <UIButton variant="primary" icon={<BookPlus />} onClick={onNew}>{t("studio.empty.write")}</UIButton>
            </div>
          ) : empty ? (
            <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-line px-4 py-12 text-center">
              <p className="font-bold text-ink">{t("studio.noMatch.title")}</p>
              <p className="text-sm text-muted">{filtered ? t("studio.noMatch.filtered") : t("studio.noMatch.tab", { tab: named("tab", view.tab) })}</p>
              {filtered && <UIButton variant="secondary" icon={<X />} onClick={clear}>{t("studio.clearFilters")}</UIButton>}
            </div>
          ) : (
            <UIDataTable
              columns={columns}
              rows={result?.books ?? []}
              rowKey={(b) => b.id}
              onRowClick={onOpen}
              caption={t("studio.caption")}
            />
          )}
        </div>

        <div className="flex flex-col gap-3 px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span aria-live="polite">
            {result
              ? `${t("library.books", { count: result.total })}${result.total ? ` · ${t("studio.pageOf", { page: result.page, pages: result.pages })}` : ""}`
              : " "}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span>{t("studio.perPage")}</span>
              <select value={view.pageSize} onChange={(e) => setView({ pageSize: Number(e.target.value) })} className={themeSystem.field("sm")}>
                {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <UIPagination page={page} pages={result?.pages ?? 1} onPage={setPage} disabled={loading} />
          </div>
        </div>
      </section>

      <UIDialog
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        variant="danger"
        title={t("studio.confirmDelete.title", { count: confirm?.length ?? 0 })}
        description={confirm?.length === 1
          ? t("studio.confirmDelete.one", { title: confirm[0].title })
          : t("studio.confirmDelete.many", { count: confirm?.length ?? 0 })}
        confirmText={t("studio.publish.delete")}
        onConfirm={() => confirm && void remove(confirm)}
      />
    </div>
  );
}

function Select({ label, value, onChange, options, all }: {
  label: string; value: string; onChange(v: string): void; options: Array<{ value: string; label: string }>; all?: string;
}) {
  // A saved filter the books no longer have stays selectable, so it can be seen and cleared.
  const shown = value && !options.some((o) => o.value === value) ? [...options, { value, label: value }] : options;
  return (
    <label className="min-w-0 flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={themeSystem.field("lg", "sm:w-auto sm:min-w-36 sm:max-w-52")}>
        {all !== undefined && <option value="">{all}</option>}
        {shown.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
