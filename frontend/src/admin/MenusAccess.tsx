/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Roles × menus matrix. Add/remove roles, and toggle which role can access which
 * menu — writes back to the seeded `roles` collection. Admin is "*" (all), locked.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Check, Plus, X, SlidersHorizontal, ListTree } from "lucide-react";
import { SectionCard, Button, Input, FormModal, FormField, Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui";
import { menusApi, Menu, RoleDef } from "../api/menus";
import { MenusManager } from "./MenusManager";

const SYSTEM_ROLES = new Set(["admin", "teacher", "parent", "student"]);
const roleHas = (role: RoleDef, key: string) => role.menu_keys.includes("*") || role.menu_keys.includes(key);
const isAllRole = (role: RoleDef) => role.menu_keys.includes("*");

const AddRoleModal: React.FC<{ isOpen: boolean; onClose: () => void; onSaved: () => void }> = ({ isOpen, onClose, onSaved }) => {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (isOpen) { setKey(""); setLabel(""); }
  }, [isOpen]);

  const submit = async () => {
    await menusApi.createRole(key.trim().toLowerCase(), label.trim());
    onSaved();
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="Add role" submitLabel="Add role" maxWidthClassName="max-w-xs" onSubmit={submit}>
      <FormField label="Key" hint="Lowercase, no spaces — e.g. manager.">
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="manager" required />
      </FormField>
      <FormField label="Label">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Manager" required />
      </FormField>
    </FormModal>
  );
};

export const MenusAccess: React.FC = () => {
  const [tab, setTab] = useState<"roles" | "designer">("roles");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    const [m, r] = await Promise.all([menusApi.list(), menusApi.listRoles()]);
    setMenus(m);
    setRoles(r);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (role: RoleDef, key: string) => {
    const currentKeys = isAllRole(role) ? menus.map((m) => m.key) : role.menu_keys;
    const has = currentKeys.includes(key);
    const next = has ? currentKeys.filter((k) => k !== key) : [...currentKeys, key];

    const allKeys = menus.map((m) => m.key);
    const isFull = allKeys.length > 0 && allKeys.every((k) => next.includes(k));
    const finalKeys = isFull && role.key === "admin" ? ["*"] : next;

    setBusy(`${role.key}:${key}`);
    try {
      await menusApi.setRoleMenus(role.key, finalKeys);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const removeRole = async (role: RoleDef) => {
    if (!window.confirm(`Delete the "${role.label}" role?`)) return;
    try {
      await menusApi.deleteRole(role.key);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "roles" | "designer")} variant="underline" className="w-full">
      <TabsList aria-label="Menu management sections">
        <TabsTrigger value="roles">
          <SlidersHorizontal size={14} /> Role Access
        </TabsTrigger>
        <TabsTrigger value="designer">
          <ListTree size={14} /> Menu Designer & Ordering
        </TabsTrigger>
      </TabsList>

      <TabsContent value="roles" className="pt-4 space-y-4">
        <SectionCard
          title="Role access — tap a cell to grant/revoke"
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Add role
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
                    <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Menu</th>
                    {roles.map((r) => (
                      <th key={r.key} className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <div className="flex items-center justify-center gap-1">
                          <span>{r.label}{isAllRole(r) && <span className="ml-0.5 text-indigo-400">*</span>}</span>
                          {!SYSTEM_ROLES.has(r.key) && (
                            <button onClick={() => removeRole(r)} title="Delete role" className="text-slate-300 hover:text-rose-500 cursor-pointer">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {menus.map((m) => (
                    <tr key={m.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{m.label}</div>
                        <div className="text-[10px] font-mono text-slate-400">{m.section_label} · {m.key}</div>
                      </td>
                      {roles.map((r) => {
                        const on = roleHas(r, m.key);
                        const saving = busy === `${r.key}:${m.key}`;
                        return (
                          <td key={r.key} className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggle(r, m.key)}
                              disabled={saving}
                              title={on ? `Revoke ${m.label} from ${r.label}` : `Grant ${m.label} to ${r.label}`}
                              className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-all cursor-pointer ${
                                on ? "bg-indigo-600 text-white" : "bg-slate-100 text-transparent hover:bg-slate-200"
                              }`}
                            >
                              {saving ? <Loader2 size={13} className="animate-spin text-white" /> : <Check size={14} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">
            Click any cell to grant or revoke menu access for that role (including Admin). Built-in roles can't be deleted.
          </p>
        </SectionCard>

        <AddRoleModal isOpen={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      </TabsContent>

      <TabsContent value="designer" className="pt-4">
        <MenusManager />
      </TabsContent>
    </Tabs>
  );
};
