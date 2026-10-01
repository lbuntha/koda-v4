/**
 * Koda Trace — the learner's page. What to do next comes first (check-ups due,
 * items in progress), then one card per published collection with how much of
 * it the child can already do. Collections are kept on the device (see
 * data/shelf.ts), so the page opens and plays offline.
 *
 * People with the Trace Studio permission also see their drafts, to try them
 * as a child would before publishing.
 */

import { useState, useSyncExternalStore } from "react";
import { AlarmClock, Check, PenLine, Play, RotateCcw } from "lucide-react";
import { useT } from "../lib/i18n";
import { useTraceShelf } from "./data/shelf";
import { GOLDEN_ITEMS } from "./fixtures/items";
import type { TraceItem } from "./geometry/types";
import { modeOf } from "./geometry/types";
import type { ItemProgress, StepPlan } from "./progress/ladder";
import { defaultPlan, isRecheckDue } from "./progress/ladder";
import { TraceProgress } from "./progress/store";
import { TracePlayer } from "./player/TracePlayer";
import { ItemThumb } from "./player/Thumb";
import { TraceDrafts } from "./studio/drafts";

interface Props {
  onAwardXp?(xp: number): void;
  /** Has the Trace Studio permission: also show drafts and test items. */
  canCreate?: boolean;
}

interface Entry {
  item: TraceItem;
  plan?: StepPlan;
  source?: { collectionId: string; rev: number };
}

const isDone = (p: ItemProgress) => p.status === "canDo" || p.status === "learned";

export function TracePage({ onAwardXp, canCreate = false }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState<Entry | null>(null);
  const shelf = useTraceShelf();
  useSyncExternalStore(TraceProgress.subscribe, TraceProgress.version);
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);

  if (open) return <TracePlayer key={open.item.id} item={open.item} plan={open.plan} source={open.source} onExit={() => setOpen(null)} onAwardXp={onAwardXp} />;

  const collections = shelf.collections.flatMap((c) => (shelf.bundles[c.id] ? [shelf.bundles[c.id]] : []));
  const published: Entry[] = collections.flatMap((c) => c.items.map((e) => ({ ...e, source: { collectionId: c.id, rev: c.rev } })));
  const drafts = canCreate ? TraceDrafts.list().filter((d) => d.item.strokes.length > 0) : [];
  const everything: Entry[] = [...published, ...drafts.map((d) => ({ item: d.item, plan: d.plan }))];

  const progressOf = (e: Entry) => TraceProgress.get(e.item.id);
  const due = everything.filter((e) => isRecheckDue(progressOf(e)));
  const going = everything
    .filter((e) => {
      const p = progressOf(e);
      return (p.status === "learning" && p.step !== "watch") || p.status === "needsPractice";
    })
    .sort((a, b) => progressOf(b).updatedAt - progressOf(a).updatedAt)
    .slice(0, 8);
  const canWrite = published.filter((e) => modeOf(e.item.kind) === "writing" && isDone(progressOf(e))).length;
  const canDraw = published.filter((e) => modeOf(e.item.kind) === "drawing" && isDone(progressOf(e))).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-white">
            <PenLine className="h-7 w-7 text-violet-600" />
            {t("trace.title")}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">{t("trace.subtitle")}</p>
        </div>
        {(canWrite > 0 || canDraw > 0) && (
          <div className="flex gap-2">
            {canWrite > 0 && <Stat value={canWrite} label={t("trace.status.canWrite")} />}
            {canDraw > 0 && <Stat value={canDraw} label={t("trace.status.canDraw")} />}
          </div>
        )}
      </header>

      {due.length > 0 && (
        <Row title={t("trace.home.due")} icon={<AlarmClock className="h-5 w-5 text-violet-600" />} tone="violet">
          {due.map((e) => (
            <Tile key={e.item.id} entry={e} onOpen={() => setOpen(e)} />
          ))}
        </Row>
      )}
      {going.length > 0 && (
        <Row title={t("trace.home.continue")} icon={<Play className="h-5 w-5 text-violet-600" />}>
          {going.map((e) => (
            <Tile key={e.item.id} entry={e} onOpen={() => setOpen(e)} />
          ))}
        </Row>
      )}

      {collections.map((c) => (
        <Shelf
          key={c.id}
          title={c.title}
          description={c.description}
          entries={c.items.map((e) => ({ ...e, source: { collectionId: c.id, rev: c.rev } }))}
          onOpen={setOpen}
        />
      ))}

      {collections.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
          <PenLine className="h-10 w-10 text-violet-500" />
          <p className="max-w-md text-slate-600 dark:text-slate-300">{shelf.checkedAt ? t("trace.noCollections") : t("trace.loadingShelf")}</p>
        </div>
      )}

      {canCreate && drafts.length > 0 && (
        <Shelf title={t("trace.draftsShelf")} description={t("trace.draftsShelfNote")} entries={drafts.map((d) => ({ item: d.item, plan: d.plan }))} onOpen={setOpen} draft />
      )}
      {canCreate && <Shelf title={t("trace.testShelf")} description={t("trace.testItems")} entries={GOLDEN_ITEMS.map((item) => ({ item }))} onOpen={setOpen} />}
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

/** A short row of what to do next: scrolls sideways on a phone. */
function Row({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone?: "violet"; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-3 rounded-3xl p-4 ${tone === "violet" ? "bg-violet-50 dark:bg-violet-950/30" : "bg-slate-50 dark:bg-slate-900/60"}`}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
        {icon}
        {title}
      </h2>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [&>li]:w-28 [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-32">{children}</ul>
    </section>
  );
}

function Shelf({ title, description, entries, onOpen, draft = false }: { title: string; description?: string; entries: Entry[]; onOpen(e: Entry): void; draft?: boolean }) {
  const { t } = useT();
  const done = entries.filter((e) => isDone(TraceProgress.get(e.item.id))).length;
  const pct = entries.length ? Math.round((100 * done) / entries.length) : 0;
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
          <span className="text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">{t("trace.shelfProgress", { done, total: entries.length })}</span>
        </div>
        {description && <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>}
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
        {entries.map((e) => (
          <Tile key={e.item.id} entry={e} draft={draft} onOpen={() => onOpen(e)} />
        ))}
      </ul>
    </section>
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
        className={`group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-2xl p-2 text-center ring-1 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 active:translate-y-0 ${
          done ? "bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900" : "bg-white ring-slate-200 hover:ring-violet-300 dark:bg-slate-900 dark:ring-slate-700"
        }`}
      >
        {/* Status in the corner: done, check-up, or needs practice */}
        {(done || due || p.status === "needsPractice") && (
          <span
            className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white ${due ? "bg-violet-600" : done ? "bg-emerald-500" : "bg-rose-500"}`}
            aria-hidden="true"
          >
            {due ? <AlarmClock className="h-3.5 w-3.5" /> : done ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </span>
        )}
        {draft && <span className="absolute left-1.5 top-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">{t("trace.draft")}</span>}
        <span className="flex flex-1 items-center justify-center text-slate-900 dark:text-white">
          {showText ? (
            <span className="text-4xl font-bold leading-none sm:text-5xl" lang={item.script === "khmer" ? "km" : undefined}>
              {item.carrier ? `${item.carrier.text}${item.title}` : item.title}
            </span>
          ) : (
            <span className="text-violet-700 dark:text-violet-300">
              <ItemThumb item={item} className="h-14 w-14 sm:h-16 sm:w-16" />
            </span>
          )}
        </span>
        <span className="flex w-full gap-0.5 px-1 pb-0.5" aria-hidden="true">
          {plan.steps.map((s, i) => (
            <span key={s.id} className={`h-1 flex-1 rounded-full ${i < stepsDone ? "bg-emerald-500" : i === at ? "bg-violet-500" : "bg-slate-200 dark:bg-slate-700"}`} />
          ))}
        </span>
      </button>
    </li>
  );
}
