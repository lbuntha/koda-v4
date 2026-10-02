/**
 * Koda Trace — the learner's page, laid out like a streaming home: one banner
 * for the collection to carry on with, then rows that scroll sideways —
 * check-ups due, items in progress, and the collections by where the child is
 * with them (under way, not tried, finished). A row with many in it can be
 * opened out into a grid, so a long shelf never becomes one endless scroll. Collections are kept on the device (see
 * data/shelf.ts), so the page opens and plays offline.
 *
 * People with the Trace Studio permission also see their drafts, to try them
 * as a child would before publishing.
 */

import { useState, useSyncExternalStore } from "react";
import { AlarmClock, ArrowLeft, Check, LayoutGrid, PenLine, Play, RotateCcw } from "lucide-react";
import { UIButton, UICarousel } from "../components/ui";
import { useT } from "../lib/i18n";
import { useTraceShelf } from "./data/shelf";
import { GOLDEN_ITEMS } from "./fixtures/items";
import type { TraceItem } from "./geometry/types";
import { modeOf } from "./geometry/types";
import type { StepPlan } from "./progress/ladder";
import { defaultPlan, isRecheckDue } from "./progress/ladder";
import { homeRows, isDone, uniqueById, type RowId } from "./home";
import { TraceProgress } from "./progress/store";
import { TracePlayer } from "./player/TracePlayer";
import { ItemThumb } from "./player/Thumb";
import { Picture } from "../library/Picture";
import { TraceDrafts } from "./studio/drafts";

interface Props {
  onAwardXp?(xp: number): void;
  /** Has the Trace Studio permission: also show drafts and test items. */
  canCreate?: boolean;
  /** Leave Trace for the home screen, offered when an item is finished. */
  onGoHome?(): void;
}

interface Entry {
  item: TraceItem;
  plan?: StepPlan;
  source?: { collectionId: string; rev: number };
}

/** What a step of this entry pays at three stars: its collection's setting, if it has one. */
const xpOf = (e: Entry, collections: { id: string; xpPerStep?: number | null }[]) => collections.find((c) => c.id === e.source?.collectionId)?.xpPerStep ?? null;

export function TracePage({ onAwardXp, canCreate = false, onGoHome }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState<Entry | null>(null);
  /** The collection whose cover was tapped: its page, until the child goes back. */
  const [shelfId, setShelfId] = useState<string | null>(null);
  const shelf = useTraceShelf();
  useSyncExternalStore(TraceProgress.subscribe, TraceProgress.version);
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);

  const collections = shelf.collections.flatMap((c) => (shelf.bundles[c.id] ? [shelf.bundles[c.id]] : []));

  if (open) {
    const place = placeOf(open, collections, setOpen);
    return <TracePlayer key={open.item.id} item={open.item} plan={open.plan} source={open.source} place={place} xpPerStep={xpOf(open, collections)} onExit={() => setOpen(null)} onAwardXp={onAwardXp} onGoHome={onGoHome} />;
  }

  const entriesOf = (c: (typeof collections)[number]): Entry[] => c.items.map((e) => ({ ...e, source: { collectionId: c.id, rev: c.rev } }));
  const coverOf = (c: (typeof collections)[number]) => shelf.collections.find((x) => x.id === c.id)?.cover ?? c.items[0]?.item ?? null;
  /** A cover picture made in the Studio; the bundle's, since that is what the device keeps. */
  const pictureOf = (c: (typeof collections)[number]) => c.picture ?? null;

  const chosen = collections.find((c) => c.id === shelfId);
  if (chosen) {
    return (
      <CollectionView
        title={chosen.title}
        description={chosen.description}
        cover={coverOf(chosen)}
        picture={pictureOf(chosen)}
        tone={toneOf(chosen.id)}
        entries={entriesOf(chosen)}
        onOpen={setOpen}
        onBack={() => setShelfId(null)}
      />
    );
  }

  // Each item once: an item in two collections, or an author's draft of a
  // published item, would otherwise be listed twice.
  const published: Entry[] = uniqueById(collections.flatMap(entriesOf));
  const publishedIds = new Set(published.map((e) => e.item.id));
  const drafts = canCreate ? TraceDrafts.list().filter((d) => d.item.strokes.length > 0 && !publishedIds.has(d.item.id)) : [];
  const draftEntries: Entry[] = drafts.map((d) => ({ item: d.item, plan: d.plan }));
  const everything: Entry[] = [...published, ...draftEntries];

  const progressOf = (e: Entry) => TraceProgress.get(e.item.id);
  const due = everything.filter((e) => isRecheckDue(progressOf(e)));
  const going = everything
    .filter((e) => {
      const p = progressOf(e);
      return !isRecheckDue(p) && ((p.status === "learning" && p.step !== "watch") || p.status === "needsPractice");
    })
    .sort((a, b) => progressOf(b).updatedAt - progressOf(a).updatedAt)
    .slice(0, 12);
  const canWrite = published.filter((e) => modeOf(e.item.kind) === "writing" && isDone(progressOf(e))).length;
  const canDraw = published.filter((e) => modeOf(e.item.kind) === "drawing" && isDone(progressOf(e))).length;

  const shelfOf = collections.map((c) => ({ id: c.id, itemIds: c.items.map((e) => e.item.id), c }));
  const { hero, rows } = homeRows(shelfOf, (id) => TraceProgress.get(id));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Below `rail:` the app bar already names the page; the heading stays for screen readers. */}
          <h1 className="sr-only items-center gap-2 text-3xl font-bold text-ink rail:not-sr-only rail:flex">
            <PenLine className="h-7 w-7 text-indigo-600" />
            {t("trace.title")}
          </h1>
          <p className="text-base text-body">{t("trace.subtitle")}</p>
        </div>
        {(canWrite > 0 || canDraw > 0) && (
          <div className="flex gap-2">
            {canWrite > 0 && <Stat value={canWrite} label={t("trace.status.canWrite")} />}
            {canDraw > 0 && <Stat value={canDraw} label={t("trace.status.canDraw")} />}
          </div>
        )}
      </header>

      {hero && (
        <Hero
          title={hero.c.title}
          description={hero.c.description}
          cover={coverOf(hero.c)}
          picture={pictureOf(hero.c)}
          tone={toneOf(hero.c.id)}
          entries={entriesOf(hero.c)}
          onPlay={setOpen}
          onBrowse={() => setShelfId(hero.c.id)}
        />
      )}

      {due.length > 0 && (
        <UICarousel title={t("trace.home.due")} icon={<AlarmClock className="h-5 w-5 text-indigo-600" />} count={due.length} {...TILES}>
          {due.map((e) => <Tile key={e.item.id} entry={e} onOpen={() => setOpen(e)} />)}
        </UICarousel>
      )}
      {going.length > 0 && (
        <UICarousel title={t("trace.home.continue")} icon={<Play className="h-5 w-5 text-indigo-600" />} count={going.length} {...TILES}>
          {going.map((e) => <Tile key={e.item.id} entry={e} onOpen={() => setOpen(e)} />)}
        </UICarousel>
      )}

      {rows.map((row) => (
        <UICarousel key={row.id} title={t(`trace.home.row.${row.id satisfies RowId}`)} count={row.collections.length} {...POSTERS}>
          {row.collections.map(({ c }) => (
            <li key={c.id}>
              <Poster title={c.title} cover={coverOf(c)} picture={pictureOf(c)} tone={toneOf(c.id)} entries={entriesOf(c)} onOpen={() => setShelfId(c.id)} />
            </li>
          ))}
        </UICarousel>
      ))}

      {collections.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-14 text-center">
          <PenLine className="h-10 w-10 text-indigo-500" />
          <p className="max-w-md text-body">{shelf.checkedAt ? t("trace.noCollections") : t("trace.loadingShelf")}</p>
        </div>
      )}

      {canCreate && draftEntries.length > 0 && (
        <UICarousel title={t("trace.draftsShelf")} subtitle={t("trace.draftsShelfNote")} count={draftEntries.length} {...TILES}>
          {draftEntries.map((e) => <Tile key={e.item.id} entry={e} draft onOpen={() => setOpen(e)} />)}
        </UICarousel>
      )}
      {canCreate && (
        <UICarousel title={t("trace.testShelf")} subtitle={t("trace.testItems")} count={GOLDEN_ITEMS.length} {...TILES}>
          {GOLDEN_ITEMS.map((item) => <Tile key={item.id} entry={{ item }} onOpen={() => setOpen({ item })} />)}
        </UICarousel>
      )}
    </div>
  );
}

type Bundle = { id: string; rev: number; items: Omit<Entry, "source">[] };

/**
 * Where an open item sits, and what to offer when it is finished: the next item
 * of its collection, or — after the last — the first not-yet-done item of the
 * next collection. Drafts and test items have no place.
 */
function placeOf(open: Entry, collections: Bundle[], go: (e: Entry) => void) {
  const at = collections.findIndex((c) => c.id === open.source?.collectionId);
  if (at < 0) return undefined;
  const c = collections[at];
  const i = c.items.findIndex((e) => e.item.id === open.item.id);
  if (i < 0) return undefined;
  const entry = (b: Bundle, e: Omit<Entry, "source">): Entry => ({ ...e, source: { collectionId: b.id, rev: b.rev } });
  if (i + 1 < c.items.length) return { n: i + 1, total: c.items.length, next: { n: i + 2, newCollection: false, open: () => go(entry(c, c.items[i + 1])) } };
  for (const b of collections.slice(at + 1)) {
    const j = b.items.findIndex((e) => !isDone(TraceProgress.get(e.item.id)));
    if (j >= 0) return { n: i + 1, total: c.items.length, next: { n: j + 1, newCollection: true, open: () => go(entry(b, b.items[j])) } };
  }
  return { n: i + 1, total: c.items.length };
}

/* ------------------------------------------------------------ covers */

/** Each collection keeps one colour, picked from its id, so a child finds it again by colour. Never yellow. */
const TONES = [
  "from-indigo-500 to-purple-600",
  "from-pink-500 to-rose-600",
  "from-emerald-500 to-cyan-600",
  "from-cyan-500 to-indigo-600",
  "from-purple-500 to-pink-500",
] as const;

const toneOf = (id: string) => TONES[[...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % TONES.length];

/** The collection's picture: its cover item drawn large on the collection's colour, two more items faint behind. */
function CoverArt({ item, picture, others, tone, className = "" }: { item: TraceItem | null; picture?: string | null; others: TraceItem[]; tone: string; className?: string }) {
  if (picture)
    return (
      <span className={`relative block overflow-hidden ${tone ? `bg-gradient-to-br ${tone}` : ""} ${className}`} aria-hidden="true">
        <Picture name={picture} cover fill className="transition-transform duration-300 group-hover:scale-105" />
      </span>
    );
  return (
    <span className={`relative flex items-center justify-center overflow-hidden text-white ${tone ? `bg-gradient-to-br ${tone}` : ""} ${className}`} aria-hidden="true">
      {others.slice(0, 2).map((o, i) => (
        <span key={o.id} className={`absolute opacity-20 ${i === 0 ? "-left-3 -top-2 rotate-[-12deg]" : "-bottom-3 -right-2 rotate-[10deg]"}`}>
          <Glyph item={o} className="h-20 w-20 text-6xl" />
        </span>
      ))}
      {item && (
        <span className="relative drop-shadow-sm transition-transform duration-300 group-hover:scale-110">
          <Glyph item={item} className="h-24 w-24 text-7xl sm:h-28 sm:w-28 sm:text-8xl" />
        </span>
      )}
    </span>
  );
}

/** A short letter reads best as itself; anything else as its own strokes. */
function Glyph({ item, className }: { item: TraceItem; className: string }) {
  if (modeOf(item.kind) === "writing" && item.title.length <= 4)
    return (
      <span className={`flex items-center justify-center font-bold leading-none ${className}`} lang={item.script === "khmer" ? "km" : undefined}>
        {item.carrier ? `${item.carrier.text}${item.title}` : item.title}
      </span>
    );
  return <ItemThumb item={item} className={className} />;
}

function collectionProgress(entries: Entry[]) {
  const done = entries.filter((e) => isDone(TraceProgress.get(e.item.id))).length;
  const started = entries.some((e) => TraceProgress.get(e.item.id).step !== "watch");
  // Where Play goes: the first item not yet done, or the first item once all are.
  const next = entries.find((e) => !isDone(TraceProgress.get(e.item.id))) ?? entries[0];
  return { done, started, next, pct: entries.length ? Math.round((100 * done) / entries.length) : 0, all: entries.length > 0 && done === entries.length };
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** The collection to carry on with, large, with Play going straight to its next item. */
function Hero({ title, description, cover, picture, tone, entries, onPlay, onBrowse }: { title: string; description: string; cover: TraceItem | null; picture: string | null; tone: string; entries: Entry[]; onPlay(e: Entry): void; onBrowse(): void }) {
  const { t } = useT();
  const p = collectionProgress(entries);
  return (
    <section className={`relative grid overflow-hidden rounded-3xl bg-gradient-to-br text-white sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] ${tone}`} aria-label={title}>
      <div className="relative z-10 flex flex-col gap-3 p-5 sm:p-8">
        <span className="text-xs font-extrabold uppercase tracking-widest text-white/80">{p.started ? t("trace.hero.carryOn") : t("trace.hero.tryNew")}</span>
        <h2 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">{title}</h2>
        {description && description !== title && <p className="line-clamp-2 max-w-lg text-sm text-white/85 sm:text-base">{description}</p>}
        <div className="flex max-w-sm flex-col gap-1.5">
          <span className="block h-2 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}>
            <span className="block h-full rounded-full bg-white transition-all" style={{ width: `${p.pct}%` }} />
          </span>
          <span className="text-sm font-semibold tabular-nums text-white/85">{t("trace.shelfProgress", { done: p.done, total: entries.length })}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {p.next && (
            <button type="button" onClick={() => onPlay(p.next)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 text-base font-extrabold text-ink shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
              <Play className="h-5 w-5 fill-current" />
              {p.started ? t("trace.action.continue") : t("trace.flow.start")}
            </button>
          )}
          <button type="button" onClick={onBrowse} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-white/20 px-5 text-base font-bold text-white backdrop-blur-sm transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
            <LayoutGrid className="h-5 w-5" />
            {t("trace.hero.allItems")}
          </button>
        </div>
      </div>
      <CoverArt item={cover} picture={picture} others={entries.map((e) => e.item).filter((i) => i.id !== cover?.id)} tone="" className="hidden min-h-56 sm:flex" />
    </section>
  );
}

/** One collection in a row: a tall poster with its name and how far the child is. */
function Poster({ title, cover, picture, tone, entries, onOpen }: { title: string; cover: TraceItem | null; picture: string | null; tone: string; entries: Entry[]; onOpen(): void }) {
  const { t } = useT();
  const p = collectionProgress(entries);
  return (
    <button type="button" onClick={onOpen} aria-label={`${title} · ${t("trace.shelfProgress", { done: p.done, total: entries.length })}`}
      className="group flex w-full flex-col gap-2 text-left focus-visible:outline-none">
      <span className="relative block overflow-hidden rounded-2xl ring-2 ring-transparent transition group-hover:-translate-y-1 group-hover:ring-indigo-300 group-focus-visible:ring-indigo-500">
        <CoverArt item={cover} picture={picture} others={entries.map((e) => e.item).filter((i) => i.id !== cover?.id)} tone={tone} className="aspect-[3/4] w-full" />
        <span className="absolute left-2 top-2 rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">{t("trace.cover.count", { count: entries.length })}</span>
        {p.all && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
            <Check className="h-4 w-4" />
          </span>
        )}
        {p.started && !p.all && (
          <span className="absolute inset-x-0 bottom-0 block h-1.5 bg-black/25">
            <span className="block h-full bg-white" style={{ width: `${p.pct}%` }} />
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-sm font-extrabold leading-tight text-ink sm:text-base">{title}</span>
    </button>
  );
}

const POSTERS = { itemClass: "[&>li]:w-36 sm:[&>li]:w-44", gridClass: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6", seeAllAfter: 5 };
const TILES = { itemClass: "[&>li]:w-28 sm:[&>li]:w-32", gridClass: "grid-cols-3 sm:grid-cols-5 lg:grid-cols-8", seeAllAfter: 7 };

/** A collection's own page: its cover as a banner, one button to play on, and every item. */
function CollectionView({ title, description, cover, picture, tone, entries, onOpen, onBack }: { title: string; description: string; cover: TraceItem | null; picture: string | null; tone: string; entries: Entry[]; onOpen(e: Entry): void; onBack(): void }) {
  const { t } = useT();
  const p = collectionProgress(entries);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-10">
      <div className="flex">
        <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
          {t("trace.cover.back")}
        </UIButton>
      </div>
      <section className="grid overflow-hidden rounded-3xl border-2 border-line bg-surface sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <CoverArt item={cover} picture={picture} others={entries.map((e) => e.item).filter((i) => i.id !== cover?.id)} tone={tone} className="aspect-[16/9] sm:aspect-auto sm:min-h-56" />
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          <h1 className="text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="text-sm text-body sm:text-base">{description}</p>}
          <div className="flex flex-col gap-1.5">
            <ProgressBar pct={p.pct} />
            <span className="text-sm font-semibold tabular-nums text-muted">{t("trace.shelfProgress", { done: p.done, total: entries.length })}</span>
          </div>
          {p.next && (
            <div className="mt-auto">
              <UIButton size="lg" icon={p.all ? <RotateCcw /> : <Play />} onClick={() => onOpen(p.next)} className="w-full sm:w-auto">
                {p.all ? t("trace.cover.again") : p.started ? t("trace.action.continue") : t("trace.flow.start")}
              </UIButton>
            </div>
          )}
        </div>
      </section>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {entries.map((e) => (
          <Tile key={e.item.id} entry={e} onOpen={() => onOpen(e)} />
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/40">
      <span className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{value}</span>
      <span className="text-xs font-semibold leading-tight text-emerald-800 dark:text-emerald-200">{label}</span>
    </div>
  );
}

function Tile({ entry, draft = false, onOpen }: { entry: Entry; draft?: boolean; onOpen(): void }) {
  const { t } = useT();
  const { item } = entry;
  const p = TraceProgress.get(item.id);
  const plan = entry.plan ?? defaultPlan(item);
  const at = Math.max(0, plan.steps.findIndex((s) => s.id === p.step));
  const writing = modeOf(item.kind) === "writing";
  const due = isRecheckDue(p);
  const done = isDone(p);
  const stepsDone = done ? plan.steps.length : at;
  // Letters read best as the letter itself; drawings as their own strokes.
  const showText = writing && item.title.length <= 4;
  const label = due ? t("trace.status.checkUp") : done ? t(writing ? "trace.status.canWrite" : "trace.status.canDraw") : p.status === "needsPractice" ? t("trace.status.needsPractice") : t(`trace.step.${p.step}`);
  return (
    <li>
      <button
        onClick={onOpen}
        aria-label={`${item.title} · ${label}`}
        className={`group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-2xl p-2 text-center ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:translate-y-0 ${
          done ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900" : "bg-surface ring-line hover:ring-indigo-300"
        }`}
      >
        {/* Status in the corner: done, check-up, or needs practice */}
        {(done || due || p.status === "needsPractice") && (
          <span
            className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white ${due ? "bg-indigo-600" : done ? "bg-emerald-500" : "bg-rose-500"}`}
            aria-hidden="true"
          >
            {due ? <AlarmClock className="h-3.5 w-3.5" /> : done ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </span>
        )}
        {draft && <span className="absolute left-1.5 top-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">{t("trace.draft")}</span>}
        <span className="flex flex-1 items-center justify-center text-ink">
          {showText ? (
            <span className="text-4xl font-bold leading-none sm:text-5xl" lang={item.script === "khmer" ? "km" : undefined}>
              {item.carrier ? `${item.carrier.text}${item.title}` : item.title}
            </span>
          ) : (
            <span className="text-indigo-700 dark:text-indigo-300">
              <ItemThumb item={item} className="h-14 w-14 sm:h-16 sm:w-16" />
            </span>
          )}
        </span>
        <span className="flex w-full gap-0.5 px-1 pb-0.5" aria-hidden="true">
          {plan.steps.map((s, i) => (
            <span key={s.id} className={`h-1 flex-1 rounded-full ${i < stepsDone ? "bg-emerald-500" : i === at ? "bg-indigo-500" : "bg-line"}`} />
          ))}
        </span>
      </button>
    </li>
  );
}
