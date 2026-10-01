/**
 * The parent report's "Writing and drawing" section: what the child can now
 * write or draw, what is due for a check-up, what needs practice — and, from
 * the mistake they make most, one thing a parent can do about it.
 */

import { useEffect, useMemo, useState } from "react";
import { PenLine } from "lucide-react";
import { formatDate, useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader } from "../../components/ui";
import type { ChildTraceItem } from "../data/api";
import { fetchChildTrace } from "../data/api";

const WRITING = new Set(["letter", "mark", "numeral", "word"]);

export function TraceReport({ learnerId, learnerName }: { learnerId: string; learnerName: string }) {
  const { t } = useT();
  const [items, setItems] = useState<ChildTraceItem[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchChildTrace(learnerId, controller.signal)
      .then(setItems)
      .catch(() => setItems([]));
    return () => controller.abort();
  }, [learnerId]);

  const now = Date.now();
  const summary = useMemo(() => {
    const list = items ?? [];
    const done = list.filter((i) => i.status === "canDo" || i.status === "learned");
    const faults = new Map<string, number>();
    for (const i of list) if (i.topFault) faults.set(i.topFault, (faults.get(i.topFault) ?? 0) + 1);
    const top = [...faults.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      canWrite: done.filter((i) => WRITING.has(i.kind)).length,
      canDraw: done.filter((i) => !WRITING.has(i.kind)).length,
      learned: list.filter((i) => i.status === "learned").length,
      practice: list.filter((i) => i.status === "needsPractice"),
      due: list.filter((i) => i.status === "canDo" && i.dueAt !== null && i.dueAt <= now),
      learning: list.filter((i) => i.status === "learning"),
      done,
      top,
    };
  }, [items, now]);

  if (!items || items.length === 0) return null;

  const chip = (i: ChildTraceItem, tone: string) => (
    <li key={i.itemId} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${tone}`} title={i.collection}>
      <span lang="km">{i.title}</span>
    </li>
  );

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader title={t("report.trace.title")} subtitle={t("report.trace.subtitle", { name: learnerName })} icon={<PenLine className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["canWrite", summary.canWrite],
            ["canDraw", summary.canDraw],
            ["learned", summary.learned],
            ["practice", summary.practice.length],
          ] as const
        ).map(([k, n]) => (
          <div key={k} className="rounded-2xl border border-line bg-surface-muted p-3">
            <dt className="text-xs text-muted">{t(`report.trace.count.${k}`)}</dt>
            <dd className="text-2xl font-bold tabular-nums text-ink">{n}</dd>
          </div>
        ))}
      </dl>

      {summary.top && (
        <div className="rounded-2xl border border-line bg-surface-muted p-3">
          <p className="text-sm font-bold text-ink">{t(`report.trace.fault.${summary.top}.label`)}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{t("report.try", { fix: t(`report.trace.fault.${summary.top}.fix`) })}</p>
        </div>
      )}

      {summary.due.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-ink">{t("report.trace.dueNow")}</p>
          <ul className="flex flex-wrap gap-1.5">{summary.due.map((i) => chip(i, "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100"))}</ul>
        </div>
      )}
      {summary.practice.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-ink">{t("report.trace.needsPractice")}</p>
          <ul className="flex flex-wrap gap-1.5">{summary.practice.map((i) => chip(i, "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100"))}</ul>
        </div>
      )}
      {summary.done.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-ink">{t("report.trace.canNow")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {summary.done.map((i) => (
              <li key={i.itemId} className="rounded-xl bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" title={i.collection}>
                <span lang="km">{i.title}</span>
                {i.status === "canDo" && i.dueAt ? <span className="ml-1.5 text-xs font-normal">· {t("report.trace.checkOn", { date: formatDate(i.dueAt, { day: "numeric", month: "short" }) })}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.learning.length > 0 && (
        <p className="text-sm text-muted">{t("report.trace.stillLearning", { count: summary.learning.length })}</p>
      )}
    </section>
  );
}
