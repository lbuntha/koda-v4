/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { Badge, Button } from "../components/ui";
import { adminApi, AdminUser } from "../api/admin";

const roleBadge: Record<string, "default" | "secondary" | "success" | "warning"> = {
  admin: "warning",
  teacher: "default",
  parent: "success",
};

const th = "px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400";
const td = "px-5 py-3 align-middle";

export const UsersTable: React.FC<{ users: AdminUser[]; selfId?: string; onChanged: () => void }> = ({
  users,
  selfId,
  onChanged,
}) => {
  const toggleDisabled = async (u: AdminUser) => {
    try {
      await adminApi.setDisabled(u.id, !u.disabled);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    }
  };
  const remove = async (u: AdminUser) => {
    if (!window.confirm(`Delete ${u.email}?`)) return;
    try {
      await adminApi.deleteUser(u.id);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className={th}>Name</th>
            <th className={th}>Role</th>
            <th className={`${th} hidden sm:table-cell`}>Email</th>
            <th className={th}>Kids</th>
            <th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === selfId;
            return (
              <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                <td className={td}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-500 shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-800">{u.name}</span>
                    {u.disabled && <span className="text-[10px] font-bold text-rose-500 uppercase">disabled</span>}
                  </div>
                </td>
                <td className={td}>
                  <Badge variant={roleBadge[u.role] ?? "secondary"}>{u.role}</Badge>
                </td>
                <td className={`${td} text-slate-500 hidden sm:table-cell`}>{u.email}</td>
                <td className={`${td} text-slate-500`}>{u.role === "parent" ? u.child_count : "—"}</td>
                <td className={td}>
                  <div className="flex items-center justify-end gap-1">
                    {isSelf ? (
                      <span className="text-[10px] text-slate-400 font-mono">you</span>
                    ) : (
                      <>
                        <Button variant="ghost" size="xs" onClick={() => toggleDisabled(u)}>
                          {u.disabled ? <CheckCircle2 size={12} /> : <Ban size={12} />}
                          {u.disabled ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => remove(u)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
