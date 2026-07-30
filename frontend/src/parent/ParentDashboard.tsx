/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Home for a signed-in parent, shaped as a profile chooser: a grid of kid tiles where a tap
 * starts a play session as that child. Management (progress, edit, remove) hides behind a
 * pencil, so the resting state is the calm "who's playing?" screen families already know
 * from streaming apps — and the parent stays signed in when the game exits.
 */

import React, { useState } from "react";
import { Check, LogOut, Loader2, Pencil, UserPlus } from "lucide-react";
import { Button, Card, ConfirmModal } from "../components/ui";
import { useAuth } from "../auth/AuthContext";
import { useFamily } from "./useFamily";
import { FamilyCodeCard } from "./FamilyCodeCard";
import { KidProfileTile } from "./KidProfileTile";
import { AddProfileTile } from "./AddProfileTile";
import { ChildFormModal } from "./ChildFormModal";
import { Child, ChildInput } from "../api/family";
import { ChildAnalyticsDrawer } from "../analytics/ChildAnalyticsDrawer";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useThemeMode } from "../theme/appTheme";

export const ParentDashboard: React.FC = () => {
  const [theme, toggleTheme] = useThemeMode();
  const { account, logout, startChildPlay } = useAuth();
  const { children, loading, error, addChild, updateChild, removeChild, unlockPin } = useFamily();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [progressChild, setProgressChild] = useState<Child | null>(null);
  const [deletingChild, setDeletingChild] = useState<Child | null>(null);
  const [managing, setManaging] = useState(false);

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
  const remove = (c: Child) => {
    setDeletingChild(c);
  };

  return (
    <div
      className={`flex min-h-screen w-full flex-col bg-gradient-to-br from-indigo-50 via-white to-violet-50 font-sans dark:from-[#0E1226] dark:via-[#0C0F1F] dark:to-[#150F2A] dark:text-[#DEDCF0] ${
        theme === "dark" ? "dark" : ""
      }`}
    >
      {/* Toolbar: brand, then who is signed in, then the two controls. No band or rule — it
          reads directly on the page gradient. */}
      <header className="w-full px-4 py-3.5 sm:px-8 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4 sm:gap-7">
            <div className="flex shrink-0 items-center gap-2.5">
              <img
                src="/favicon.svg"
                alt="Koda"
                className="h-11 w-11 rounded-2xl shadow-lg shadow-violet-500/25 dark:shadow-none"
              />
              <span className="text-2xl font-black tracking-tight text-[#5B48D6] dark:text-[#BEACFF]">
                Koda
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <ThemeToggle theme={theme} onToggle={toggleTheme} variant="round" />
            <Button
              variant="ghost"
              onClick={logout}
              className="gap-2 px-2 text-sm font-semibold text-slate-600 hover:bg-white/70 dark:text-[#C6C0DC] dark:hover:bg-white/10 dark:hover:text-white sm:px-3"
            >
              <LogOut size={18} /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Chooser: centred in whatever height is left, so the page never looks top-heavy. */}
      <main className="flex w-full flex-1 flex-col justify-center px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-[#EDECF8]">
            {managing ? "Manage profiles" : "Who’s playing?"}
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-slate-500 dark:text-[#9A94B8]">
            {managing
              ? "Tap a profile to rename it, or use the buttons below each one."
              : "Tap a profile to start today’s learning."}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-indigo-400" />
          </div>
        ) : error ? (
          <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-center text-xs text-rose-600 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300">
            {error}
          </div>
        ) : children.length === 0 ? (
          <Card className="mt-8 flex flex-col items-center gap-3 border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-white/15 dark:bg-white/5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-400/15 dark:text-indigo-300">
              <UserPlus size={26} />
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-[#E4E1F4]">Add your first child</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-[#9A94B8]">
                Give them a name, an avatar, and an optional PIN.
              </p>
            </div>
            <Button onClick={openAdd}>
              <UserPlus size={16} /> Add child
            </Button>
          </Card>
        ) : (
          <>
            <div className="mt-10 flex flex-wrap items-start justify-center gap-x-5 gap-y-8 sm:gap-x-7">
              {children.map(c => (
                <KidProfileTile
                  key={c.id}
                  child={c}
                  managing={managing}
                  onPlay={() => startChildPlay(c.id, c.name)}
                  onEdit={() => openEdit(c)}
                  onRemove={() => remove(c)}
                  onProgress={() => setProgressChild(c)}
                  onUnlockPin={() => void unlockPin(c.id)}
                />
              ))}
              <AddProfileTile onClick={openAdd} />
            </div>

            <div className="mt-9 flex justify-center">
              <Button
                variant={managing ? "default" : "outline"}
                size="sm"
                onClick={() => setManaging(current => !current)}
                className={managing ? "" : "dark:border-white/10 dark:bg-white/5 dark:text-[#C5CBDA] dark:hover:bg-white/10"}
              >
                {managing ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Manage profiles</>}
              </Button>
            </div>
          </>
        )}

        </div>
      </main>

      {account?.family_code && (
        <footer className="w-full px-4 pb-6 sm:px-8 sm:pb-8">
          <div className="mx-auto max-w-6xl">
            <FamilyCodeCard code={account.family_code} />
          </div>
        </footer>
      )}

      <ChildFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSubmit={submit} initial={editing} />
      <ChildAnalyticsDrawer student={progressChild} onClose={() => setProgressChild(null)} />
      <ConfirmModal
        isOpen={Boolean(deletingChild)}
        onClose={() => setDeletingChild(null)}
        onConfirm={async () => {
          if (deletingChild) {
            await removeChild(deletingChild.id);
          }
        }}
        title={`Remove ${deletingChild?.name}?`}
        description="This deletes their profile and learning progress."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
