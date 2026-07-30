/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { BarChart3, KeyRound, RotateCcw, Trash2 } from "lucide-react";
import { Button, ConfirmModal } from "../components/ui";
import { adminApi, AdminStudent } from "../api/admin";
import { analyticsApi } from "../api/analytics";
import { ChildAnalyticsDrawer } from "../analytics/ChildAnalyticsDrawer";
import { KidAvatar } from "../components/KidAvatar";

const th = "px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400";
const td = "px-5 py-3 align-middle";

export const KidsTable: React.FC<{ students: AdminStudent[]; onChanged: () => void }> = ({ students, onChanged }) => {
  const [selected, setSelected] = useState<AdminStudent | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<AdminStudent | null>(null);
  const [clearingLogsStudent, setClearingLogsStudent] = useState<AdminStudent | null>(null);

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

  const remove = (s: AdminStudent) => {
    setDeletingStudent(s);
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
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center p-0.5 text-base shrink-0 overflow-hidden">
                    <KidAvatar avatar={s.avatar ?? undefined} className="h-full w-full object-contain" />
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
                    onClick={() => setClearingLogsStudent(s)}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                    title="Clear learning logs for testing"
                  >
                    <RotateCcw size={12} /> Clear logs
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
    <ConfirmModal
      isOpen={Boolean(clearingLogsStudent)}
      onClose={() => setClearingLogsStudent(null)}
      onConfirm={async () => {
        if (clearingLogsStudent) {
          try {
            await analyticsApi.purgeData(clearingLogsStudent.id, "Admin log reset for testing");
            onChanged();
          } catch (e) {
            alert(e instanceof Error ? e.message : "Clear logs failed");
          }
        }
      }}
      title={`Clear logs for ${clearingLogsStudent?.name}?`}
      description="This will reset all learning events, attempts, XP, and mastery data so you can test fresh."
      confirmText="Clear logs"
      cancelText="Cancel"
      variant="warning"
    />
    <ConfirmModal
      isOpen={Boolean(deletingStudent)}
      onClose={() => setDeletingStudent(null)}
      onConfirm={async () => {
        if (deletingStudent) {
          try {
            await adminApi.deleteStudent(deletingStudent.id);
            onChanged();
          } catch (e) {
            alert(e instanceof Error ? e.message : "Delete failed");
          }
        }
      }}
      title={`Delete ${deletingStudent?.name}?`}
      description="This deletes their profile and learning progress."
      confirmText="Delete"
      cancelText="Cancel"
      variant="danger"
    />
    </>
  );
};
