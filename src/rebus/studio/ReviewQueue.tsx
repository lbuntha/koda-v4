/**
 * Going through everything that is waiting for review, one puzzle at a time.
 *
 * Every new puzzle lands here as a draft, whatever wrote it: the seed file, an
 * AI batch, a person. Look at it as a child would, then approve it, fix it, or
 * reject it. One card at a time, large, with the decisions as the only
 * buttons, so a long list takes an afternoon rather than a week. For a batch
 * you trust there is "approve all that pass the checks"; anything that fails a
 * check is left for a person, so the checks stay the gate.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Check, CheckCheck, PartyPopper, Pencil, SkipForward, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIProgressBar, UITabs } from "../../components/ui";
import { categoryLabel } from "../categories";
import { useRebusCategories } from "../bank";
import { PuzzleCard } from "./PuzzleCard";
import { PuzzleEditor } from "./PuzzleEditor";
import { draftOf, StudioAPI, type Overview, type StudioPuzzle } from "./studioApi";
import { messageOf, useStudioAction } from "./useStudioAction";


export const ReviewQueue: React.FC<{ overview: Overview | null; onChanged(): void }> = ({ overview, onChanged }) => {
  const { t } = useT();
  const cats = useRebusCategories();
  const [category, setCategory] = useState("all");
  const [queue, setQueue] = useState<StudioPuzzle[] | null>(null);
  /** How many are waiting in this view in all, not just the batch loaded. */
  const [remaining, setRemaining] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [bulkDone, setBulkDone] = useState("");
  const action = useStudioAction();

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const { puzzles, total } = await StudioAPI.list({ status: "draft", category: category === "all" ? undefined : category, limit: 100 });
      setQueue(puzzles);
      setRemaining(total);
    } catch (e) {
      setLoadError(messageOf(e));
    }
  }, [category]);

  useEffect(() => {
    setQueue(null);
    setBulkDone("");
    void load();
  }, [load]);

  const next = () => {
    setEditing(false);
    setRemaining((n) => Math.max(0, n - 1));
    // The batch is 100; when it runs out with more behind it, fetch the next batch.
    if (queue && queue.length <= 1 && remaining > 1) void load();
    else setQueue((q) => (q ? q.slice(1) : q));
    onChanged();
  };
  const skip = () => setQueue((q) => (q && q.length > 1 ? [...q.slice(1), q[0]] : q));

  const approveAll = () =>
    void action.run(() => StudioAPI.approveAll(category === "all" ? undefined : category).then((r) => setBulkDone(t("rebus.studio.approvedAll", { approved: r.approved, skipped: r.skipped })))).then((ok) => {
      if (ok) {
        void load();
        onChanged();
      }
    });

  const current = queue?.[0];
  const byStatus = overview?.byStatus;
  const total = byStatus ? byStatus.draft + byStatus.approved + byStatus.published + byStatus.retired : 0;
  const done = total - (byStatus?.draft ?? 0);

  return (
    <section className="flex flex-col gap-4" aria-label={t("rebus.studio.tabReview")}>
      <div>
        <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.reviewTitle")}</h3>
        <p className={themeSystem.typography("body-sm", "mt-1")}>{t("rebus.studio.reviewText")}</p>
      </div>
      <UIProgressBar value={done} max={Math.max(total, 1)} tone="emerald" label={t("rebus.studio.reviewProgress", { done, total })} caption={t("rebus.studio.reviewProgress", { done, total })} />

      <UITabs label={t("rebus.studio.category")} items={[{ id: "all", label: t("rebus.studio.all") }, ...cats.map((c) => ({ id: c.id, label: categoryLabel(c.id) }))]} value={category} onChange={setCategory} />

      {remaining > 0 && !editing && (
        <div>
          <UIButton variant="secondary" icon={<CheckCheck />} disabled={action.busy} onClick={approveAll}>
            {t("rebus.studio.approveAll", { count: remaining })}
          </UIButton>
          <p className={`${themeSystem.typography("caption")} mt-1`}>{t("rebus.studio.approveAllHint")}</p>
        </div>
      )}
      {bulkDone && (
        <p role="status" className={themeSystem.flash("success")}>
          {bulkDone}
        </p>
      )}
      {loadError && (
        <p role="alert" className={themeSystem.flash("error")}>
          {loadError}
        </p>
      )}
      {action.error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {action.error}
        </p>
      )}

      {queue === null && !loadError && <p className={themeSystem.typography("caption")}>{t("rebus.studio.loading")}</p>}

      {queue && !current && (
        <div className={themeSystem.card("default", `${themeSystem.spacing.card} flex items-center gap-3`)}>
          <PartyPopper className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          <p className="font-bold text-ink">{t("rebus.studio.reviewDone")}</p>
        </div>
      )}

      {current && !editing && (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          <p className={themeSystem.typography("caption")}>{t("rebus.studio.left", { count: remaining })}</p>
          <PuzzleCard
            puzzle={current}
            large
            actions={
              <>
                <UIButton variant="success" icon={<Check />} disabled={action.busy || current.issues.length > 0} onClick={() => void action.run(() => StudioAPI.setStatus(current.id, "approved")).then((ok) => ok && next())}>
                  {t("rebus.studio.approve")}
                </UIButton>
                <UIButton variant="secondary" icon={<Pencil />} disabled={action.busy} onClick={() => setEditing(true)}>
                  {t("rebus.studio.edit")}
                </UIButton>
                <UIButton variant="danger" icon={<X />} disabled={action.busy} onClick={() => void action.run(() => StudioAPI.setStatus(current.id, "rejected", "")).then((ok) => ok && next())}>
                  {t("rebus.studio.reject")}
                </UIButton>
                <UIButton variant="ghost" icon={<SkipForward />} disabled={action.busy || (queue?.length ?? 0) < 2} onClick={skip}>
                  {t("rebus.studio.skip")}
                </UIButton>
              </>
            }
          />
        </div>
      )}

      {current && editing && (
        <div className="mx-auto w-full max-w-2xl">
          <PuzzleEditor
            initial={draftOf(current)}
            onCancel={() => setEditing(false)}
            onSave={async (draft) => {
              try {
                const saved = await StudioAPI.edit(current.id, draft);
                // Stays in the queue, now with the fix, ready to approve.
                setQueue((q) => (q ? [saved, ...q.slice(1)] : q));
                setEditing(false);
                return null;
              } catch (e) {
                return messageOf(e);
              }
            }}
          />
        </div>
      )}
    </section>
  );
};
