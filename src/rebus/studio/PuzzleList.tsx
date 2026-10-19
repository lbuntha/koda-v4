/**
 * Every puzzle, in any state: find one, fix it, move it along, or write a new one.
 *
 * The workflow is visible in the buttons: a draft can be approved or rejected;
 * an approved one waits for the next publish; a live one can be fixed or
 * retired; a retired one can be restored. Nothing here deletes a live or
 * pre-built puzzle, because retiring is reversible and deleting is not.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Check, EyeOff, Plus, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIPagination, UISearchInput, UISelect } from "../../components/ui";
import { categoryLabel } from "../categoryNames";
import { useRebusCategories } from "../bank";
import { PuzzleCard } from "./PuzzleCard";
import { BLANK_DRAFT, PuzzleEditor } from "./PuzzleEditor";
import { draftOf, StudioAPI, type PuzzleStatus, type StudioPuzzle } from "./studioApi";
import { messageOf, useStudioAction } from "./useStudioAction";

const PAGE = 12;
const STATUSES: PuzzleStatus[] = ["draft", "approved", "published", "retired", "rejected"];


export const PuzzleList: React.FC<{ initialStatus?: PuzzleStatus; onChanged(): void }> = ({ initialStatus, onChanged }) => {
  const { t } = useT();
  const cats = useRebusCategories();
  const [status, setStatus] = useState<PuzzleStatus | "">(initialStatus ?? "");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState<"" | "picture" | "math" | "choice">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StudioPuzzle[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<StudioPuzzle | "new" | null>(null);
  const action = useStudioAction();

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const out = await StudioAPI.list({ status: status || undefined, category: category || undefined, kind: kind || undefined, q: q.trim() || undefined, skip: (page - 1) * PAGE, limit: PAGE });
      setRows(out.puzzles);
      setTotal(out.total);
    } catch (e) {
      setLoadError(messageOf(e));
    }
  }, [status, category, kind, q, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (fn: () => Promise<unknown>) => void action.run(fn).then((ok) => {
    if (ok) {
      void load();
      onChanged();
    }
  });

  const moveTo = (p: StudioPuzzle, to: PuzzleStatus) => change(() => StudioAPI.setStatus(p.id, to));

  const actionsFor = (p: StudioPuzzle): React.ReactNode => {
    const busy = action.busy;
    const edit = (
      <UIButton key="edit" size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(p)}>
        {t("rebus.studio.edit")}
      </UIButton>
    );
    switch (p.status) {
      case "draft":
        return [
          edit,
          <UIButton key="ok" size="sm" variant="success" icon={<Check />} disabled={busy || p.issues.length > 0} onClick={() => moveTo(p, "approved")}>
            {t("rebus.studio.approve")}
          </UIButton>,
          <UIButton key="no" size="sm" variant="danger" icon={<X />} disabled={busy} onClick={() => moveTo(p, "rejected")}>
            {t("rebus.studio.reject")}
          </UIButton>,
          !p.seeded && (
            <UIButton key="del" size="sm" variant="ghost" icon={<Trash2 />} disabled={busy} onClick={() => change(() => StudioAPI.remove(p.id))}>
              {t("rebus.studio.delete")}
            </UIButton>
          ),
        ];
      case "approved":
        return [
          edit,
          <UIButton key="back" size="sm" variant="secondary" icon={<Undo2 />} disabled={busy} onClick={() => moveTo(p, "draft")}>
            {t("rebus.studio.unapprove")}
          </UIButton>,
        ];
      case "published":
        return [
          edit,
          <UIButton key="ret" size="sm" variant="danger" icon={<EyeOff />} disabled={busy} onClick={() => moveTo(p, "retired")}>
            {t("rebus.studio.retire")}
          </UIButton>,
        ];
      case "retired":
        return (
          <UIButton size="sm" variant="secondary" icon={<RotateCcw />} disabled={busy} onClick={() => moveTo(p, "published")}>
            {t("rebus.studio.restore")}
          </UIButton>
        );
      case "rejected":
        return [
          <UIButton key="back" size="sm" variant="secondary" icon={<Undo2 />} disabled={busy} onClick={() => moveTo(p, "draft")}>
            {t("rebus.studio.backToDraft")}
          </UIButton>,
          !p.seeded && (
            <UIButton key="del" size="sm" variant="ghost" icon={<Trash2 />} disabled={busy} onClick={() => change(() => StudioAPI.remove(p.id))}>
              {t("rebus.studio.delete")}
            </UIButton>
          ),
        ];
    }
  };

  if (editing) {
    const isNew = editing === "new";
    return (
      <div className="mx-auto w-full max-w-2xl">
        <h3 className={`${themeSystem.typography("h3")} mb-3`}>{isNew ? t("rebus.studio.newPuzzle") : t("rebus.studio.editPuzzle")}</h3>
        <PuzzleEditor
          initial={isNew ? BLANK_DRAFT : draftOf(editing)}
          approvable={isNew}
          onCancel={() => setEditing(null)}
          onSave={async (draft, approve) => {
            try {
              if (isNew) await StudioAPI.create({ ...draft, approve });
              else await StudioAPI.edit(editing.id, draft);
              setEditing(null);
              void load();
              onChanged();
              return null;
            } catch (e) {
              return messageOf(e);
            }
          }}
        />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label={t("rebus.studio.tabPuzzles")}>
      <div className="flex flex-wrap items-end gap-2">
        <UISearchInput size="sm" label={t("rebus.studio.search")} className="min-w-48 flex-1" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <UISelect aria-label={t("rebus.studio.statusLabel")} className="!w-auto" value={status} onChange={(e) => { setStatus(e.target.value as PuzzleStatus | ""); setPage(1); }}>
          <option value="">{t("rebus.studio.anyStatus")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`rebus.studio.status.${s}`)}
            </option>
          ))}
        </UISelect>
        <UISelect aria-label={t("rebus.studio.category")} className="!w-auto" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">{t("rebus.studio.all")}</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(c.id)}
            </option>
          ))}
        </UISelect>
        <UISelect aria-label={t("rebus.studio.kindLabel")} className="!w-auto" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setPage(1); }}>
          <option value="">{t("rebus.studio.anyKind")}</option>
          {(["picture", "math", "choice"] as const).map((k) => (
            <option key={k} value={k}>
              {t(`rebus.studio.kind_${k}`)}
            </option>
          ))}
        </UISelect>
        <UIButton icon={<Plus />} onClick={() => setEditing("new")}>
          {t("rebus.studio.newPuzzle")}
        </UIButton>
      </div>

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

      {rows === null && !loadError && <p className={themeSystem.typography("caption")}>{t("rebus.studio.loading")}</p>}
      {rows && rows.length === 0 && <p className={themeSystem.typography("body-sm")}>{t("rebus.studio.none")}</p>}
      {rows && rows.length > 0 && (
        <>
          <p className={themeSystem.typography("caption")}>{t("rebus.studio.count", { count: total })}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => (
              <PuzzleCard key={p.id} puzzle={p} actions={actionsFor(p)} />
            ))}
          </div>
          <UIPagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} onPage={setPage} className="self-center" />
        </>
      )}
    </section>
  );
};
