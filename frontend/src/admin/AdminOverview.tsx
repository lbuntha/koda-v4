/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * At-a-glance counts across all accounts and kids.
 */

import React from "react";
import { Users, Heart, GraduationCap, Shield, Baby } from "lucide-react";
import { Card } from "../components/ui";
import { AdminUser, AdminStudent } from "../api/admin";

const TONES: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
};

const Tile: React.FC<{ label: string; value: number; icon: React.ElementType; tone: string }> = ({
  label,
  value,
  icon: Icon,
  tone,
}) => (
  <Card className="p-4 flex items-center gap-3.5">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${TONES[tone]}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-black text-slate-900 leading-none tabular-nums">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">{label}</div>
    </div>
  </Card>
);

export const AdminOverview: React.FC<{ users?: AdminUser[]; students?: AdminStudent[] }> = ({
  users = [],
  students = [],
}) => {
  const count = (role: string) => users.filter((u) => u?.role === role).length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Tile label="Accounts" value={users.length} icon={Users} tone="indigo" />
      <Tile label="Parents" value={count("parent")} icon={Heart} tone="emerald" />
      <Tile label="Teachers" value={count("teacher")} icon={GraduationCap} tone="blue" />
      <Tile label="Admins" value={count("admin")} icon={Shield} tone="amber" />
      <Tile label="Kids" value={students.length} icon={Baby} tone="violet" />
    </div>
  );
};
