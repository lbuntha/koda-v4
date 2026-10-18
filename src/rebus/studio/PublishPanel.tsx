/**
 * Make approved puzzles live, as one release, and take a release back if it
 * turns out badly. Children get the new list the next time their device asks.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Rocket, RotateCcw } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton, UIInput } from "../../components/ui";
import { PuzzleCard } from "./PuzzleCard";
import { StudioAPI, type Release, type StudioPuzzle } from "./studioApi";
import { messageOf, useStudioAction } from "./useStudioAction";

export const PublishPanel: React.FC<{ onChanged(): void }> = ({ onChanged }) => {
  const { t } = useT();
  const [approved, setApproved] = useState<StudioPuzzle[] | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [note, setNote] = useState("");
  const [loadError, setLoadError] = useState("");
  const [done, setDone] = useState("");
  const action = useStudioAction();

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [list, rel] = await Promise.all([StudioAPI.list({ status: "approved", limit: 100 }), StudioAPI.releases()]);
      setApproved(list.puzzles);
      setReleases(rel.releases);
    } catch (e) {
      setLoadError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = () =>
    void action.run(() => StudioAPI.publish(note.trim())).then((ok) => {
      if (!ok) return;
      setDone(t("rebus.studio.published", { count: approved?.length ?? 0 }));
      setNote("");
      void load();
      onChanged();
    });

  const rollback = (r: Release) =>
    void action.run(() => StudioAPI.rollback(r.number)).then((ok) => {
      if (!ok) return;
      setDone(t("rebus.studio.rolledBack", { number: r.number }));
      void load();
      onChanged();
    });

  return (
    <section className="flex flex-col gap-5" aria-label={t("rebus.studio.tabPublish")}>
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
      {done && (
        <p role="status" className={themeSystem.flash("success")}>
          {done}
        </p>
      )}

      <div className={themeSystem.card("default", `${themeSystem.spacing.card} flex flex-col gap-3`)}>
        <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.readyTitle", { count: approved?.length ?? 0 })}</h3>
        <p className={themeSystem.typography("body-sm")}>{t("rebus.studio.readyText")}</p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.releaseNote")}</span>
          <UIInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t("rebus.studio.releaseNoteHint")} />
        </label>
        <div>
          <UIButton icon={<Rocket />} isLoading={action.busy} disabled={action.busy || !approved?.length} onClick={publish}>
            {t("rebus.studio.publishNow", { count: approved?.length ?? 0 })}
          </UIButton>
        </div>
      </div>

      {approved && approved.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {approved.map((p) => (
            <PuzzleCard key={p.id} puzzle={p} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className={themeSystem.typography("h3")}>{t("rebus.studio.releases")}</h3>
        {releases.length === 0 && <p className={themeSystem.typography("body-sm")}>{t("rebus.studio.noReleases")}</p>}
        {releases.map((r) => (
          <div key={r.number} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-muted p-3">
            <div className="min-w-0">
              <div className="font-black text-ink">{t("rebus.studio.releaseLine", { number: r.number, count: r.puzzleIds.length })}</div>
              <div className="text-sm text-body">{r.note || t("rebus.studio.noNote")}</div>
              {r.byName && <div className="text-xs text-muted">{t("rebus.studio.releaseBy", { name: r.byName })}</div>}
              <div className="text-xs text-muted">{new Date(r.at).toLocaleString()}</div>
            </div>
            {r.rolledBack ? (
              <UIBadge variant="neutral">{t("rebus.studio.rolledBackBadge")}</UIBadge>
            ) : (
              <UIButton size="sm" variant="danger" icon={<RotateCcw />} disabled={action.busy} onClick={() => rollback(r)}>
                {t("rebus.studio.rollBack")}
              </UIButton>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
