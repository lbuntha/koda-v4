/**
 * The topics children pick from, managed here.
 *
 * Add one (Math, say), rename it in each language, give it a colour and the
 * Koda topic it files under, put the list in the order children should see,
 * and switch one off without losing its puzzles. A category that has puzzles
 * (or that shipped with the app) can be switched off but not deleted. Every
 * change reaches a device the next time it asks for the puzzle list.
 */

import React, { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { TOPICS } from "../../lib/topics";
import { UIBadge, UIButton, UIInput, UISelect, UIToggleRow } from "../../components/ui";
import { refreshBank } from "../bankStore";
import { nameOfCategory } from "../categories";
import { StudioAPI, type CategoryDraft, type StudioCategory } from "./studioApi";
import { useStudioAction } from "./useStudioAction";

const TONES = ["indigo", "purple", "pink", "cyan", "emerald"] as const;
const DOT: Record<string, string> = { indigo: "bg-indigo-500", purple: "bg-purple-500", pink: "bg-pink-500", cyan: "bg-cyan-500", emerald: "bg-emerald-500" };

/** An id from an English name: "Word problems" becomes "word-problems". */
export const idFromName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 24)
    .replace(/-+$/, "");

const BLANK: CategoryDraft = { id: "", names: { en: "", km: "" }, tone: "indigo", topic: "logic" };

const Form: React.FC<{ draft: CategoryDraft; onChange(d: CategoryDraft): void; idLocked: boolean }> = ({ draft, onChange, idLocked }) => {
  const { t } = useT();
  const set = (patch: Partial<CategoryDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.cat.nameEn")}</span>
        <UIInput
          value={draft.names.en}
          maxLength={30}
          onChange={(e) => set({ names: { ...draft.names, en: e.target.value }, ...(idLocked ? {} : { id: idFromName(e.target.value) }) })}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.cat.nameKm")}</span>
        <UIInput value={draft.names.km ?? ""} maxLength={30} onChange={(e) => set({ names: { ...draft.names, km: e.target.value } })} />
      </label>
      {!idLocked && (
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.cat.id")}</span>
            <UIInput value={draft.id} maxLength={24} onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
          </label>
          <span className={themeSystem.typography("caption")}>{t("rebus.studio.cat.idHint")}</span>
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.cat.topic")}</span>
        <UISelect value={draft.topic} onChange={(e) => set({ topic: e.target.value })}>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </UISelect>
      </label>
      <div className="flex flex-col gap-1 sm:col-span-2" role="group" aria-label={t("rebus.studio.cat.colour")}>
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.cat.colour")}</span>
        <div className="flex gap-2">
          {TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              aria-label={tone}
              aria-pressed={draft.tone === tone}
              onClick={() => set({ tone })}
              className={`h-8 w-8 rounded-full ${DOT[tone]} ${draft.tone === tone ? "ring-4 ring-indigo-200 dark:ring-indigo-800" : "opacity-70 hover:opacity-100"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const CategoriesPanel: React.FC = () => {
  const { t } = useT();
  const { busy, error, run, clear } = useStudioAction();
  const [rows, setRows] = useState<StudioCategory[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CategoryDraft>(BLANK);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<CategoryDraft>(BLANK);

  const load = useCallback(async () => {
    const { categories } = await StudioAPI.categories();
    setRows(categories);
  }, []);

  useEffect(() => {
    void run(load);
  }, [run, load]);

  /** After any change: reload this list, and let this device have the new one at once. */
  const changed = async () => {
    await load();
    await refreshBank({ force: true });
  };

  const add = async () => {
    const names = { en: draft.names.en.trim(), ...(draft.names.km?.trim() ? { km: draft.names.km.trim() } : {}) };
    if (await run(async () => void (await StudioAPI.addCategory({ ...draft, names })))) {
      setAdding(false);
      setDraft(BLANK);
      await run(changed);
    }
  };

  const move = async (index: number, by: -1 | 1) => {
    if (!rows) return;
    const next = [...rows];
    const j = index + by;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setRows(next);
    await run(async () => {
      await StudioAPI.reorderCategories(next.map((c) => c.id));
      await changed();
    });
  };

  const startEdit = (c: StudioCategory) => {
    clear();
    setEditing(c.id);
    setEdit({ id: c.id, names: { en: c.names.en, km: c.names.km ?? "" }, tone: c.tone, topic: c.topic });
  };

  const saveEdit = async () => {
    const names = { en: edit.names.en.trim(), ...(edit.names.km?.trim() ? { km: edit.names.km.trim() } : {}) };
    if (await run(async () => void (await StudioAPI.editCategory(edit.id, { names, tone: edit.tone, topic: edit.topic })))) {
      setEditing(null);
      await run(changed);
    }
  };

  const ready = draft.names.en.trim().length >= 1 && draft.id.length >= 2;

  return (
    <section className="flex flex-col gap-4" aria-label={t("rebus.studio.tabCategories")}>
      <p className={themeSystem.typography("body-sm")}>{t("rebus.studio.cat.intro")}</p>

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows?.map((c, i) => (
          <li key={c.id} className={themeSystem.card("default", "flex flex-col gap-3 px-3 py-2")}>
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden="true" className={`h-4 w-4 shrink-0 rounded-full ${DOT[c.tone] ?? DOT.indigo}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-black text-ink">{nameOfCategory(c)}</div>
                <div className="truncate text-xs font-bold text-muted">
                  {c.names.km && c.names.en !== nameOfCategory(c) ? c.names.en : c.names.km ?? ""} · {c.id} · {c.topic}
                </div>
              </div>
              <UIBadge variant={c.puzzles > 0 ? "info" : "neutral"}>{t("rebus.puzzlesCount", { count: c.puzzles })}</UIBadge>
              {!c.enabled && <UIBadge variant="warning">{t("rebus.studio.cat.off")}</UIBadge>}
              <UIButton size="icon" variant="ghost" aria-label={t("rebus.studio.cat.up", { name: nameOfCategory(c) })} icon={<ArrowUp />} disabled={i === 0 || busy} onClick={() => void move(i, -1)} />
              <UIButton size="icon" variant="ghost" aria-label={t("rebus.studio.cat.down", { name: nameOfCategory(c) })} icon={<ArrowDown />} disabled={i === rows.length - 1 || busy} onClick={() => void move(i, 1)} />
              <UIButton size="icon" variant="ghost" aria-label={t("rebus.studio.cat.edit", { name: nameOfCategory(c) })} icon={editing === c.id ? <X /> : <Pencil />} onClick={() => (editing === c.id ? setEditing(null) : startEdit(c))} />
            </div>
            {editing === c.id && (
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                <Form draft={edit} onChange={setEdit} idLocked />
                <UIToggleRow
                  title={t("rebus.studio.cat.enabled")}
                  description={t("rebus.studio.cat.enabledHint")}
                  checked={c.enabled}
                  onChange={() => void run(async () => {
                    await StudioAPI.editCategory(c.id, { enabled: !c.enabled });
                    await changed();
                  })}
                />
                <div className="flex flex-wrap gap-2">
                  <UIButton isLoading={busy} disabled={busy || edit.names.en.trim() === ""} onClick={() => void saveEdit()}>
                    {t("rebus.studio.save")}
                  </UIButton>
                  {!c.builtIn && c.puzzles === 0 && (
                    <UIButton variant="danger" icon={<Trash2 />} disabled={busy} onClick={() => void run(async () => {
                      await StudioAPI.removeCategory(c.id);
                      setEditing(null);
                      await changed();
                    })}>
                      {t("rebus.studio.cat.delete")}
                    </UIButton>
                  )}
                </div>
                {(c.builtIn || c.puzzles > 0) && <p className={themeSystem.typography("caption")}>{c.builtIn ? t("rebus.studio.cat.builtInNote") : t("rebus.studio.cat.inUseNote", { count: c.puzzles })}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <div className={themeSystem.card("default", `${themeSystem.spacing.cardSm} flex flex-col gap-3`)}>
          <h4 className={themeSystem.typography("h4")}>{t("rebus.studio.cat.new")}</h4>
          <Form draft={draft} onChange={setDraft} idLocked={false} />
          <div className="flex gap-2">
            <UIButton icon={<Plus />} isLoading={busy} disabled={busy || !ready} onClick={() => void add()}>
              {t("rebus.studio.cat.add")}
            </UIButton>
            <UIButton variant="ghost" onClick={() => { setAdding(false); clear(); }}>
              {t("rebus.studio.cancel")}
            </UIButton>
          </div>
        </div>
      ) : (
        <div>
          <UIButton variant="secondary" icon={<Plus />} onClick={() => { clear(); setAdding(true); }}>
            {t("rebus.studio.cat.new")}
          </UIButton>
        </div>
      )}
    </section>
  );
};
