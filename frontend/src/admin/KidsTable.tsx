/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BarChart3, KeyRound, Trash2 } from "lucide-react";
import { Button } from "../components/ui";
import { adminApi, AdminStudent } from "../api/admin";
import { ChildAnalyticsDrawer } from "../analytics/ChildAnalyticsDrawer";

const th = "px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400";
const td = "px-5 py-3 align-middle";

export const KidsTable: React.FC<{ students: AdminStudent[]; onChanged: () => void }> = ({ students, onChanged }) => {
  const [selected, setSelected] = useState<AdminStudent | null>(null);
  const resetPin = async (s: AdminStudent) => {
    const pin = window.prompt(`New PIN for ${s.name} (4–8 digits)`);
    if (!pin) return;
    if (!/^\d{4,8}$/.test(pin)) {
      alert("PIN must be 4–8 digits.");
      return;
    }
    try {
      await adminApi.resetPin(s.id, pin);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reset failed");
    }
  };
  const remove = async (s: AdminStudent) => {
    if (!window.confirm(`Delete ${s.name}? This deletes their progress.`)) return;
    try {
      await adminApi.deleteStudent(s.id);
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className={th}>Kid</th>
            <th className={`${th} hidden sm:table-cell`}>Guardian(s)</th>
            <th className={th}>PIN</th>
            <th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
              <td className={td}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-base shrink-0">
                    {s.avatar ?? "🧒"}
                  </div>
                  <span className="font-semibold text-slate-800">{s.name}</span>
                </div>
              </td>
              <td className={`${td} text-slate-500 hidden sm:table-cell`}>{s.guardians.join(", ") || "—"}</td>
              <td className={`${td} text-slate-500`}>{s.has_pin ? "set" : "none"}</td>
              <td className={td}>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="xs" onClick={() => setSelected(s)}>
                    <BarChart3 size={12} /> Progress
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => resetPin(s)}>
                    <KeyRound size={12} /> Reset PIN
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => remove(s)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ChildAnalyticsDrawer student={selected} onClose={() => setSelected(null)} />
    </>
  );
};
