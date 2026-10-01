/**
 * Koda Trace — the learner's page: one shelf per published collection, each
 * item showing where the child is on its writing steps. Collections are kept
 * on the device (see data/shelf.ts), so the page opens and plays offline.
 *
 * People with the Trace Studio permission also see their drafts here, to try
 * them as a child would before publishing.
 */

import { useState, useSyncExternalStore } from "react";
import { useT } from "../lib/i18n";
import { useTraceShelf } from "./data/shelf";
import { GOLDEN_ITEMS } from "./fixtures/items";
import type { TraceItem } from "./geometry/types";
import { modeOf } from "./geometry/types";
import type { StepPlan } from "./progress/ladder";
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

export function TracePage({ onAwardXp, canCreate = false }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState<Entry | null>(null);
  const shelf = useTraceShelf();
  useSyncExternalStore(TraceProgress.subscribe, TraceProgress.version);
  useSyncExternalStore(TraceDrafts.subscribe, TraceDrafts.version);

  if (open) return <TracePlayer key={open.item.id} item={open.item} plan={open.plan} source={open.source} onExit={() => setOpen(null)} onAwardXp={onAwardXp} />;

  const collections = shelf.collections.flatMap((c) => (shelf.bundles[c.id] ? [shelf.bundles[c.id]] : []));
  const drafts = canCreate ? TraceDrafts.list().filter((d) => d.item.strokes.length > 0) : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("trace.title")}</h1>
        <p className="text-base text-slate-600 dark:text-slate-300">{t("trace.subtitle")}</p>
      </header>

      {collections.map((c) => (
        <Shelf key={c.id} title={c.title} description={c.description} entries={c.items.map((e) => ({ ...e, source: { collectionId: c.id, rev: c.rev } }))} onOpen={setOpen} />
      ))}

      {collections.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">
          {shelf.checkedAt ? t("trace.noCollections") : t("trace.loadingShelf")}
        </p>
      )}

      {canCreate && drafts.length > 0 && (
        <Shelf title={t("trace.draftsShelf")} description={t("trace.draftsShelfNote")} entries={drafts.map((d) => ({ item: d.item, plan: d.plan }))} onOpen={setOpen} draft />
      )}
      {canCreate && (
        <Shelf title={t("trace.testShelf")} description={t("trace.testItems")} entries={GOLDEN_ITEMS.map((item) => ({ item }))} onOpen={setOpen} />
      )}
    </div>
  );
}

function Shelf({ title, description, entries, onOpen, draft = false }: { title: string; description?: string; entries: Entry[]; onOpen(e: Entry): void; draft?: boolean }) {
  const { t } = useT();
  const done = entries.filter((e) => {
    const s = TraceProgress.get(e.item.id).status;
    return s === "canDo" || s === "learned";
  }).length;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
          {description && <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>}
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          {t("trace.shelfProgress", { done, total: entries.length })}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.map((e) => (
          <li key={e.item.id}>
            <ItemCard entry={e} draft={draft} onOpen={() => onOpen(e)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemCard({ entry, draft, onOpen }: { entry: Entry; draft: boolean; onOpen(): void }) {
  const { t } = useT();
  const { item } = entry;
  const p = TraceProgress.get(item.id);
  const plan = entry.plan ?? defaultPlan(item);
  const at = plan.steps.findIndex((s) => s.id === p.step);
  const writing = modeOf(item.kind) === "writing";
  const status = isRecheckDue(p) ? "checkUp" : p.status === "canDo" ? (writing ? "canWrite" : "canDraw") : p.status === "learning" ? null : p.status;
  // Letters read best as the letter itself; drawings as their own strokes.
  const showText = writing && item.title.length <= 4;
  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm transition hover:border-violet-400 hover:shadow dark:border-slate-700 dark:bg-slate-900"
    >
      <span className="flex h-16 items-center text-slate-900 dark:text-white">
        {showText ? (
          <span className="text-5xl font-bold leading-none" lang={item.script === "khmer" ? "km" : undefined}>
            {item.carrier ? `${item.carrier.text}${item.title}` : item.title}
          </span>
        ) : (
          <ItemThumb item={item} />
        )}
      </span>
      <span className="flex gap-1" aria-label={t("trace.stepProgress", { n: at + 1, total: plan.steps.length })}>
        {plan.steps.map((s, i) => (
          <span key={s.id} className={`h-2 w-2 rounded-full ${i < at || p.status !== "learning" ? "bg-emerald-500" : i === at ? "bg-violet-500" : "bg-slate-200 dark:bg-slate-700"}`} />
        ))}
      </span>
      {draft && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">{t("trace.draft")}</span>}
      <span className="min-h-5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{status ? t(`trace.status.${status}`) : t(`trace.step.${p.step}`)}</span>
    </button>
  );
}
