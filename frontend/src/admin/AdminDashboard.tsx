/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin console (built on the shared DashboardLayout). The sidebar is DB-driven
 * (/menus/me); the content for each menu id comes from CONTENT below. A menu
 * with no entry renders a placeholder instead of the wrong screen.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Plus, LogOut, Loader2, Shield } from "lucide-react";
import { Button, SectionCard } from "../components/ui";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ContentPlaceholder } from "../components/ContentPlaceholder";
import { useAuth } from "../auth/AuthContext";
import { useMenus } from "../nav/useMenus";
import { adminApi, AdminUser, AdminStudent } from "../api/admin";
import { Account } from "../api/auth";
import { AdminOverview } from "./AdminOverview";
import { UsersTable } from "./UsersTable";
import { KidsTable } from "./KidsTable";
import { MenusAccess } from "./MenusAccess";
import { MenusManager } from "./MenusManager";
import { CreateUserModal } from "./CreateUserModal";
import { NotificationsPage } from "./NotificationsPage";
import { SettingsPage } from "./SettingsPage";
import { InteractiveStudioPage } from "./InteractiveStudioPage";
import { CurriculumAdminPage } from "./CurriculumAdminPage";
import { AssignmentsPage } from "./AssignmentsPage";
import { AnalyticsRosterPage } from "../analytics/AnalyticsRosterPage";
import App from "../App";

const SUBTITLES: Record<string, string> = {
  overview: "Accounts and kids at a glance",
  users: "Parents, teachers, and admins",
  kids: "Every child across all families",
  access: "Which role can see which menu",
  menus: "Add, edit, and reorder menus",
  studio: "Build and preview interactive math activities",
  assets: "Create and manage reusable SVG counting assets",
  settings: "Application preferences, academic catalog, and progression",
  curriculum: "Design grades, subjects, units, skills, and linked activities",
  assignments: "Assign immutable curriculum releases and place students",
  analytics: "Review learner mastery, activity, streaks, and recommendations",
  notifications: "Compose broadcasts and manage automated notifications",
};

/** Data the data-backed content screens share. */
interface AdminCtx {
  users: AdminUser[];
  students: AdminStudent[];
  account: Account | null;
  reload: () => void;
  openCreate: () => void;
  canCreateUsers: boolean;
  navigate: (section: string) => void;
}

/** menu id → content. Menus not listed here render the placeholder below. */
const CONTENT: Record<string, (ctx: AdminCtx) => React.ReactNode> = {
  overview: (c) => <AdminOverview users={c.users ?? []} students={c.students ?? []} />,
  users: (c) => (
    <SectionCard
      title={`All accounts (${c.users?.length ?? 0})`}
      action={
        c.canCreateUsers ? (
          <Button size="sm" onClick={c.openCreate}>
            <Plus size={14} /> New account
          </Button>
        ) : undefined
      }
    >
      <UsersTable users={c.users ?? []} students={c.students ?? []} selfId={c.account?.id} onChanged={c.reload} />
    </SectionCard>
  ),
  kids: (c) => (
    <SectionCard title={`All kids (${c.students?.length ?? 0})`}>
      <KidsTable students={c.students ?? []} onChanged={c.reload} />
    </SectionCard>
  ),
  access: () => <MenusAccess />,
  menus: () => <MenusManager />,
  studio: (c) => <InteractiveStudioPage onExit={() => c.navigate("overview")} />,
  assets: () => <App embedded initialAdminTab="assets" />,
  curriculum: (c) => <CurriculumAdminPage onOpenAssets={() => c.navigate("assets")} />,
  assignments: () => <AssignmentsPage />,
  analytics: () => <AnalyticsRosterPage />,
  notifications: (c) => <NotificationsPage users={c.users ?? []} students={c.students ?? []} />,
  settings: () => <SettingsPage />,
};

/** Content screens that need the admin users/students load. */
const DATA_SECTIONS = new Set(["overview", "users", "kids", "notifications"]);

export const AdminDashboard: React.FC = () => {
  const { account, logout } = useAuth();
  const { sections, allowedIds } = useMenus(); // sidebar from the DB-seeded menus
  const [section, setSection] = useState<string>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (account?.role !== "admin") {
      setUsers([]);
      setStudents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [uRes, s] = await Promise.all([adminApi.listUsers({ page: 1, limit: 100 }), adminApi.listStudents()]);
      const userList = Array.isArray(uRes) ? uRes : (uRes as any)?.items ?? [];
      setUsers(userList);
      setStudents(s ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [account?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (allowedIds.size > 0 && !allowedIds.has(section)) {
      const first = sections.flatMap(group => group.items)[0];
      if (first) setSection(first.id);
    }
  }, [allowedIds, sections, section]);

  const activeMenu = sections.flatMap((s) => s.items).find((i) => i.id === section);
  const title = activeMenu?.label ?? section;
  const subtitle = SUBTITLES[section] ?? "";

  const ctx: AdminCtx = {
    users,
    students,
    account,
    reload: load,
    openCreate: () => setCreateOpen(true),
    canCreateUsers: allowedIds.has("users"),
    navigate: setSection,
  };

  const renderContent = () => {
    const entry = CONTENT[section];
    if (!entry)
      return (
        <ContentPlaceholder label={title} hint={`Menu “${section}” is registered — map it in AdminDashboard's CONTENT to give it a page.`} />
      );
    if (DATA_SECTIONS.has(section)) {
      if (loading) {
        return (
          <div className="flex justify-center py-20">
            <Loader2 size={22} className="animate-spin text-indigo-400" />
          </div>
        );
      }
      if (error) {
        return <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>;
      }
    }
    return entry(ctx);
  };

  return (
    <DashboardLayout
      brand={{ name: account?.role === "teacher" ? "Koda Teacher" : "Koda Admin", icon: Shield }}
      sections={sections}
      active={section}
      onNavigate={setSection}
      user={{ name: account?.name, email: account?.email }}
      title={title}
      subtitle={subtitle}
      contentClassName={section === "studio" || section === "assets" || section === "curriculum" ? "flex-1 overflow-hidden" : undefined}
      actions={
        <Button variant="ghost" size="sm" onClick={logout} className="text-slate-500">
          <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
        </Button>
      }
    >
      {renderContent()}
      <CreateUserModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </DashboardLayout>
  );
};
