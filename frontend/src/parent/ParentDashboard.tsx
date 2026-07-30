/**
 * Parent home: children and their next actions first, family-level evidence second.
 * Every metric comes from the authorized analytics summary; unsupported dashboard ideas
 * stay out until the product owns a real contract for them.
 */

import React, { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, LogOut, Users } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import { analyticsApi } from "../api/analytics";
import type { Child, ChildInput } from "../api/family";
import { ChildAnalyticsDrawer } from "../analytics/ChildAnalyticsDrawer";
import { useAuth } from "../auth/AuthContext";
import { DashboardLayout, type NavSection } from "../components/layout/DashboardLayout";
import { Button, ConfirmModal } from "../components/ui";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useThemeMode } from "../theme/appTheme";
import { ChildFormModal } from "./ChildFormModal";
import { FamilyCodeCard } from "./FamilyCodeCard";
import { ParentChildrenGrid } from "./ParentChildrenGrid";
import { ParentChildrenPage, ParentOverview } from "./ParentDashboardSections";
import { useFamily } from "./useFamily";

type ParentView = "dashboard" | "children";

const PARENT_NAV: NavSection[] = [{
  id: "parent",
  label: "Parent space",
  items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "children", label: "Children", icon: Users },
  ],
}];

export const ParentDashboard: React.FC = () => {
  const [theme, toggleTheme] = useThemeMode();
  const { account, logout, startChildPlay } = useAuth();
  const { children, loading, error, addChild, updateChild, removeChild, unlockPin } = useFamily();
  const [activeView, setActiveView] = useState<ParentView>("dashboard");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [progressChild, setProgressChild] = useState<Child | null>(null);
  const [deletingChild, setDeletingChild] = useState<Child | null>(null);
  const [summaries, setSummaries] = useState<Record<string, AnalyticsSummary>>({});
  const [summariesLoading, setSummariesLoading] = useState(false);
  const childIds = children.map(child => child.id).join("|");

  useEffect(() => {
    if (!childIds) {
      setSummaries({});
      setSummariesLoading(false);
      return;
    }
    let cancelled = false;
    setSummariesLoading(true);
    void Promise.allSettled(children.map(child => analyticsApi.summary(child.id))).then(results => {
      if (cancelled) return;
      const next: Record<string, AnalyticsSummary> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") next[children[index].id] = result.value;
      });
      setSummaries(next);
      setSummariesLoading(false);
    });
    return () => { cancelled = true; };
  // Child identity is the only input: profile edits do not change analytics summaries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIds]);

  const familySummaries = useMemo(() => Object.values(summaries), [summaries]);
  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (child: Child) => {
    setEditing(child);
    setFormOpen(true);
  };
  const submit = async (data: ChildInput) => {
    if (editing) await updateChild(editing.id, data);
    else await addChild(data);
  };

  const childrenGrid = (
    <ParentChildrenGrid
      profiles={children}
      summaries={summaries}
      loading={loading}
      loadingSummaries={summariesLoading}
      error={error}
      allowRemove={activeView === "children"}
      onAdd={openAdd}
      onPlay={child => void startChildPlay(child.id, child.name)}
      onEdit={openEdit}
      onProgress={setProgressChild}
      onRemove={setDeletingChild}
      onUnlockPin={child => void unlockPin(child.id)}
    />
  );

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <DashboardLayout
        brand={{ name: "Koda Parent", logoSrc: "/favicon.svg", logoAlt: "Koda" }}
        sections={PARENT_NAV}
        active={activeView}
        onNavigate={view => setActiveView(view as ParentView)}
        user={{ name: account?.name, email: account?.email }}
        title=""
        contentClassName="flex-1 overflow-auto bg-[#F6F8FC] px-5 py-5 sm:px-7 sm:py-6 lg:px-8 dark:bg-[#0E1020]"
        actions={
          <div className="flex items-center gap-1">
            <ThemeToggle theme={theme} onToggle={toggleTheme} variant="round" />
            <Button variant="ghost" size="sm" onClick={logout} className="text-slate-500 dark:text-slate-300">
              <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        }
      >
        <div className="mx-auto w-full max-w-7xl">
          {activeView === "dashboard" ? (
            <ParentOverview
              childCount={children.length}
              summaries={familySummaries}
              summariesByChild={summaries}
              profiles={children}
              summariesLoading={summariesLoading}
              showSummary={!loading && !error}
              onAdd={openAdd}
              onOpenProgress={setProgressChild}
              childrenGrid={childrenGrid}
            />
          ) : (
            <ParentChildrenPage onAdd={openAdd} childrenGrid={childrenGrid} />
          )}
          {account?.family_code && <div className="mt-6"><FamilyCodeCard code={account.family_code} /></div>}
        </div>
      </DashboardLayout>

      <ChildFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} onSubmit={submit} initial={editing} />
      <ChildAnalyticsDrawer student={progressChild} onClose={() => setProgressChild(null)} />
      <ConfirmModal
        isOpen={Boolean(deletingChild)}
        onClose={() => setDeletingChild(null)}
        onConfirm={async () => { if (deletingChild) await removeChild(deletingChild.id); }}
        title={`Remove ${deletingChild?.name}?`}
        description="This permanently deletes the profile and its learning progress."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
