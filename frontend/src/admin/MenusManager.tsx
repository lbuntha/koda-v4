/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Design menus: add / edit / delete the entries in the `menus` collection.
 * Sections (groups) are picked from a dropdown or created inline. Changes flow
 * to every sidebar (via /menus/me).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Check, Info, Folder } from "lucide-react";
import { SectionCard, Button, Input, Select, FormModal, FormField, FormRow } from "../components/ui";
import { menusApi, Menu } from "../api/menus";
import { resolveIcon } from "../nav/icons";
import { IconPicker } from "../nav/IconPicker";
import { cn } from "../lib/utils";

interface SectionOption {
  id: string;
  label: string;
}

const NEW_SECTION = "__new__";
const NONE_SECTION = "__none__";
const EMPTY: Menu = { key: "", section: "", section_label: "", label: "", icon: "Circle", order: 1 };

const MenuFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial: Menu | null;
  sections: SectionOption[];
}> = ({ isOpen, onClose, onSaved, initial, sections }) => {
  const editing = !!initial;
  const [form, setForm] = useState<Menu>(EMPTY);
  const [sectionChoice, setSectionChoice] = useState<string>(NEW_SECTION);

  useEffect(() => {
    if (!isOpen) return;
    if (initial) {
      setForm(initial);
      if (!initial.section_label && (!initial.section || initial.section === "none")) {
        setSectionChoice(NONE_SECTION);
      } else {
        setSectionChoice(sections.some((s) => s.id === initial.section) ? initial.section : NEW_SECTION);
      }
    } else if (sections.length) {
      setForm({ ...EMPTY, section: sections[0].id, section_label: sections[0].label });
      setSectionChoice(sections[0].id);
    } else {
      setForm(EMPTY);
      setSectionChoice(NEW_SECTION);
    }
  }, [isOpen, initial, sections]);

  const set = (patch: Partial<Menu>) => setForm((f) => ({ ...f, ...patch }));

  const onSectionChange = (value: string) => {
    setSectionChoice(value);
    if (value === NONE_SECTION) {
      set({ section: "none", section_label: "" });
    } else if (value === NEW_SECTION) {
      set({ section: "", section_label: "" });
    } else {
      const s = sections.find((x) => x.id === value);
      set({ section: value, section_label: s?.label ?? value });
    }
  };

  const submit = async () => {
    if (editing) {
      const { key, ...patch } = form;
      await menusApi.updateMenu(key, patch);
    } else {
      await menusApi.createMenu(form);
    }
    onSaved();
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit menu" : "Add menu"}
      submitLabel={editing ? "Save" : "Add menu"}
      onSubmit={submit}
    >
      <FormRow>
        <FormField label="Key">
          <Input value={form.key} onChange={(e) => set({ key: e.target.value })} placeholder="reports" disabled={editing} required />
        </FormField>
        <FormField label="Label">
          <Input value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="Reports" required />
        </FormField>
      </FormRow>

      <FormField label="Section (group)">
        <Select value={sectionChoice} onChange={(e) => onSectionChange(e.target.value)}>
          <option value={NONE_SECTION}>No section header (standalone item)</option>
          {sections.filter((s) => s.id && s.id !== "none").map((s) => (
            <option key={s.id} value={s.id}>{s.label || s.id}</option>
          ))}
          <option value={NEW_SECTION}>+ New section…</option>
        </Select>
      </FormField>

      {sectionChoice === NEW_SECTION && (
        <FormRow>
          <FormField label="New section id">
            <Input value={form.section} onChange={(e) => set({ section: e.target.value })} placeholder="insights" required />
          </FormField>
          <FormField label="New section label (leave blank to hide header)">
            <Input value={form.section_label} onChange={(e) => set({ section_label: e.target.value })} placeholder="Insights" />
          </FormField>
        </FormRow>
      )}

      <FormField label="Icon">
        <IconPicker value={form.icon} onChange={(name) => set({ icon: name })} />
      </FormField>
      <FormField label="Order" hint="Lower numbers appear first in the sidebar.">
        <Input type="number" value={form.order} onChange={(e) => set({ order: parseInt(e.target.value) || 0 })} />
      </FormField>
    </FormModal>
  );
};

const InlineOrderInput: React.FC<{
  initialValue: number;
  onSave: (newVal: number) => Promise<void>;
  className?: string;
}> = ({ initialValue, onSave, className }) => {
  const [val, setVal] = useState<number>(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  const save = async (targetVal: number) => {
    if (saving || targetVal === initialValue || isNaN(targetVal)) return;
    setSaving(true);
    setErr(null);
    try {
      await onSave(targetVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = !isNaN(val) && val !== initialValue;

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(parseInt(e.target.value, 10))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
            void save(val);
          }
        }}
        onBlur={() => {
          if (isDirty) void save(val);
        }}
        className={cn(
          "h-7 w-20 rounded-md border px-2 text-center text-xs font-bold transition-all focus:outline-none focus:ring-2",
          isDirty
            ? "border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-400"
            : saved
            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
            : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20",
          className
        )}
      />
      {saving && <Loader2 size={13} className="animate-spin text-indigo-600 shrink-0" />}
      {saved && <Check size={14} className="text-emerald-600 shrink-0" />}
      {isDirty && !saving && (
        <button
          type="button"
          onClick={() => void save(val)}
          title="Save order"
          className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs hover:bg-indigo-700 cursor-pointer shrink-0"
        >
          Save
        </button>
      )}
      {err && <span className="text-[10px] font-medium text-rose-600">{err}</span>}
    </div>
  );
};

export const MenusManager: React.FC = () => {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);

  const load = useCallback(async () => {
    setMenus(await menusApi.list());
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Group menus by section, sorted by section's lowest item order
  const groupedSections = useMemo(() => {
    const map = new Map<string, { id: string; label: string; items: Menu[]; minOrder: number }>();
    menus.forEach((m) => {
      if (!map.has(m.section)) {
        map.set(m.section, { id: m.section, label: m.section_label, items: [], minOrder: m.order });
      }
      const entry = map.get(m.section)!;
      entry.items.push(m);
      entry.minOrder = Math.min(entry.minOrder, m.order);
    });
    return Array.from(map.values()).sort((a, b) => a.minOrder - b.minOrder);
  }, [menus]);

  const sections = useMemo<SectionOption[]>(
    () => groupedSections.map((s) => ({ id: s.id, label: s.label })),
    [groupedSections]
  );

  const remove = async (m: Menu) => {
    if (!window.confirm(`Delete the "${m.label}" menu?`)) return;
    try {
      await menusApi.deleteMenu(m.key);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const updateSingleItemOrder = async (key: string, newOrder: number) => {
    await menusApi.updateMenu(key, { order: newOrder });
    await load();
  };

  const updateSectionOrder = async (items: Menu[], newStart: number) => {
    const sortedItems = [...items].sort((a, b) => a.order - b.order);
    await Promise.all(
      sortedItems.map((m, idx) => menusApi.updateMenu(m.key, { order: newStart + idx }))
    );
    await load();
  };

  const th = "px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400";
  const td = "px-5 py-3 align-middle";

  return (
    <>
      <SectionCard
        title={`Menu Sections & Items (${menus.length})`}
        action={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={14} /> Add menu
          </Button>
        }
      >
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 text-xs text-slate-500 flex items-center gap-2">
          <Info size={14} className="text-indigo-500 shrink-0" />
          <span><strong>Inline Order Editing:</strong> Change any section's order or item's order directly in the table inputs. Click <strong>Save</strong> (or press Enter) to save changes.</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={th}>Menu item</th>
                  <th className={`${th} hidden sm:table-cell`}>Section ID</th>
                  <th className={th}>Item Order</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedSections.map((sec) => (
                  <React.Fragment key={sec.id}>
                    <tr className="bg-indigo-50/50 border-y border-indigo-100/70">
                      <td colSpan={4} className="px-5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                            <Folder size={14} className="text-indigo-600 shrink-0" />
                            <span>{sec.label ? `${sec.label} Section` : "Standalone Items (No Section Header)"}</span>
                            <span className="font-mono font-normal text-indigo-500 text-[11px]">(Starts at order {sec.minOrder})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-indigo-800">Section Order:</span>
                            <InlineOrderInput
                              initialValue={sec.minOrder}
                              onSave={(val) => updateSectionOrder(sec.items, val)}
                              className="w-20 border-indigo-300 text-indigo-900"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                    {sec.items.sort((a, b) => a.order - b.order).map((m) => {
                      const Icon = resolveIcon(m.icon);
                      return (
                        <tr key={m.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                          <td className={td}>
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                                <Icon size={15} />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800">{m.label}</div>
                                <div className="text-[10px] font-mono text-slate-400">{m.key}</div>
                              </div>
                            </div>
                          </td>
                          <td className={`${td} text-slate-500 hidden sm:table-cell font-mono text-xs`}>{m.section}</td>
                          <td className={td}>
                            <InlineOrderInput
                              initialValue={m.order}
                              onSave={(val) => updateSingleItemOrder(m.key, val)}
                            />
                          </td>
                          <td className={td}>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="xs" onClick={() => { setEditing(m); setFormOpen(true); }}>
                                <Pencil size={12} /> Edit
                              </Button>
                              <Button variant="ghost" size="xs" onClick={() => remove(m)} className="text-slate-400 hover:text-rose-600">
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <MenuFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSaved={load} initial={editing} sections={sections} />
    </>
  );
};
