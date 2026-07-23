/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Design menus: add / edit / delete the entries in the `menus` collection.
 * Sections (groups) are picked from a dropdown or created inline. Changes flow
 * to every sidebar (via /menus/me).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { SectionCard, Button, Input, Select, FormModal, FormField, FormRow } from "../components/ui";
import { menusApi, Menu } from "../api/menus";
import { resolveIcon } from "../nav/icons";
import { IconPicker } from "../nav/IconPicker";

interface SectionOption {
  id: string;
  label: string;
}

const NEW_SECTION = "__new__";
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
      setSectionChoice(sections.some((s) => s.id === initial.section) ? initial.section : NEW_SECTION);
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
    if (value === NEW_SECTION) {
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
          {sections.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
          <option value={NEW_SECTION}>＋ New section…</option>
        </Select>
      </FormField>

      {sectionChoice === NEW_SECTION && (
        <FormRow>
          <FormField label="New section id">
            <Input value={form.section} onChange={(e) => set({ section: e.target.value })} placeholder="insights" required />
          </FormField>
          <FormField label="New section label">
            <Input value={form.section_label} onChange={(e) => set({ section_label: e.target.value })} placeholder="Insights" required />
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

  // Unique existing sections (groups) for the form's dropdown.
  const sections = useMemo<SectionOption[]>(
    () => Array.from(new Map(menus.map((m) => [m.section, m.section_label])).entries()).map(([id, label]) => ({ id, label })),
    [menus]
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

  const th = "px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400";
  const td = "px-5 py-3 align-middle";

  return (
    <>
      <SectionCard
        title={`Menus (${menus.length})`}
        action={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={14} /> Add menu
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-indigo-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={th}>Menu</th>
                  <th className={`${th} hidden sm:table-cell`}>Section</th>
                  <th className={th}>Order</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menus.map((m) => {
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
                      <td className={`${td} text-slate-500 hidden sm:table-cell`}>{m.section_label}</td>
                      <td className={`${td} text-slate-500`}>{m.order}</td>
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
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <MenuFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSaved={load} initial={editing} sections={sections} />
    </>
  );
};
