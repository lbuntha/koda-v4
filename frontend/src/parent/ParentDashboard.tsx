/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Home for a signed-in parent: share the family code, and add / edit / remove /
 * launch their kids. Tapping Play starts a play session as that kid; exiting the
 * game returns here (the parent stays signed in).
 */

import React, { useState } from "react";
import { Crown, Plus, LogOut, Loader2, UserPlus } from "lucide-react";
import { Button, Card } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useFamily } from "./useFamily";
import { FamilyCodeCard } from "./FamilyCodeCard";
import { KidCard } from "./KidCard";
import { ChildFormModal } from "./ChildFormModal";
import { Child, ChildInput } from "../api/family";

export const ParentDashboard: React.FC = () => {
  const { account, logout, startChildPlay } = useAuth();
  const { children, loading, error, addChild, updateChild, removeChild } = useFamily();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (c: Child) => {
    setEditing(c);
    setFormOpen(true);
  };
  const submit = async (data: ChildInput) => {
    if (editing) await updateChild(editing.id, data);
    else await addChild(data);
  };
  const remove = async (c: Child) => {
    if (window.confirm(`Remove ${c.name}? This deletes their progress.`)) await removeChild(c.id);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-50 via-white to-violet-50 font-sans">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Crown size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">Hi, {account?.name} 👋</h1>
              <p className="text-xs text-slate-500">Your family</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="text-slate-500">
            <LogOut size={14} /> Sign out
          </Button>
        </div>

        {account?.family_code && <FamilyCodeCard code={account.family_code} />}

        {/* Kids */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-slate-800">Kids</h2>
            {children.length > 0 && (
              <Button size="sm" onClick={openAdd}>
                <Plus size={14} /> Add child
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={22} className="animate-spin text-indigo-400" />
            </div>
          ) : error ? (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
          ) : children.length === 0 ? (
            <Card className="border-dashed border-slate-300 bg-white/60 p-10 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                <UserPlus size={26} />
              </div>
              <div>
                <p className="font-bold text-slate-800">Add your first child</p>
                <p className="text-xs text-slate-500 mt-0.5">Give them a name, an avatar, and an optional PIN.</p>
              </div>
              <Button onClick={openAdd}>
                <Plus size={16} /> Add child
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {children.map((c) => (
                <KidCard
                  key={c.id}
                  child={c}
                  onPlay={() => startChildPlay(c.id, c.name)}
                  onEdit={() => openEdit(c)}
                  onRemove={() => remove(c)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ChildFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSubmit={submit} initial={editing} />
    </div>
  );
};
