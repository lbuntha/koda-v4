/**
 * Parent home: children and their next actions first, family-level evidence second.
 * Every metric comes from the authorized analytics summary; unsupported dashboard ideas
 * stay out until the product owns a real contract for them.
 */

import React, { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import { analyticsApi } from "../api/analytics";
import type { Child, ChildInput } from "../api/family";
import { ChildAnalyticsDrawer } from "../analytics/ChildAnalyticsDrawer";
import { useSvgLibrary } from "../assets/SvgLibraryContext";
import { useAuth } from "../auth/AuthContext";
import { DashboardLayout, type NavSection } from "../components/layout/DashboardLayout";
import { Button, ConfirmModal } from "../components/ui";
import { NotificationBell } from "../notifications/NotificationBell";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useThemeMode } from "../theme/appTheme";
import { ChildFormModal } from "./ChildFormModal";
import { FamilyCodeCard } from "./FamilyCodeCard";
import { ParentChildrenGrid } from "./ParentChildrenGrid";
import { ParentChildrenPage, ParentOverview } from "./ParentDashboardSections";
import { ParentSettingsPage } from "./ParentSettingsPage";
import { ProfilePage } from "../account/ProfilePage";
import { useFamily } from "./useFamily";
import { CurriculumPromotion, promotionsApi } from "../api/promotions";

import { resolveIcon } from "../nav/icons";
import { useMenus } from "../nav/useMenus";
import { PARENT_NAV_ASSETS, PARENT_NAV_ASSET_REFS } from "./parentNavAssets";
import { KID_NAV_ASSETS } from "../student/home/kidNavAssets";
import { FAMILY_SUMMARY_ASSETS } from "./familySummaryAssets";

type ParentView = "dashboard" | "children" | "parent_settings" | "settings" | "profile";

const PARENT_NAV: NavSection[] = [{
  id: "parent",
  label: "",
  items: [
    { id: "dashboard", label: "Dashboard", icon: resolveIcon(PARENT_NAV_ASSET_REFS.dashboard) },
    { id: "children", label: "Children", icon: resolveIcon(PARENT_NAV_ASSET_REFS.children) },
    { id: "parent_settings", label: "Settings", icon: resolveIcon(PARENT_NAV_ASSET_REFS.settings) },
  ],
}];

const PARENT_NAV_ICONS: Record<string, React.ElementType> = {
  dashboard: resolveIcon(PARENT_NAV_ASSET_REFS.dashboard),
  parent_dashboard: resolveIcon(PARENT_NAV_ASSET_REFS.dashboard),
  children: resolveIcon(PARENT_NAV_ASSET_REFS.children),
  parent_children: resolveIcon(PARENT_NAV_ASSET_REFS.children),
  settings: resolveIcon(PARENT_NAV_ASSET_REFS.settings),
  parent_settings: resolveIcon(PARENT_NAV_ASSET_REFS.settings),
};

const NAV_ASSETS = [...PARENT_NAV_ASSETS, ...KID_NAV_ASSETS, ...FAMILY_SUMMARY_ASSETS];

const VIEW_TITLES: Record<ParentView, string> = {
  dashboard: "Family learning",
  children: "Children",
  parent_settings: "Settings",
  settings: "Settings",
  profile: "Profile",
};

export const ParentDashboard: React.FC = () => {
  const {
    assets: svgAssets,
    setAssets: setSvgAssets,
    deletedSystemAssetIds,
    persistenceStatus: svgPersistenceStatus,
  } = useSvgLibrary();
  const { sections: dynamicSections } = useMenus();
  const navSections = useMemo(() => {
    const sections = dynamicSections.length > 0 ? dynamicSections : PARENT_NAV;
    return sections.map(section => ({
      ...section,
      items: section.items.map(item => ({ ...item, icon: PARENT_NAV_ICONS[item.id] ?? item.icon })),
    }));
  }, [dynamicSections]);
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
  const [promotions, setPromotions] = useState<CurriculumPromotion[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [updatingPromotionId, setUpdatingPromotionId] = useState<string | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [playingChildId, setPlayingChildId] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const childIds = children.map(child => child.id).join("|");

  useEffect(() => {
    if (svgPersistenceStatus !== "saved") return;
    const existingIds = new Set(svgAssets.map(asset => asset.id));
    const deletedIds = new Set(deletedSystemAssetIds);
    const missingAssets = NAV_ASSETS.filter(asset => !existingIds.has(asset.id) && !deletedIds.has(asset.id));
    if (missingAssets.length > 0) setSvgAssets(current => [...current, ...missingAssets]);
  }, [deletedSystemAssetIds, setSvgAssets, svgAssets, svgPersistenceStatus]);

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

  useEffect(() => {
    let cancelled = false;
    setPromotionsLoading(true);
    void promotionsApi.list()
      .then(response => { if (!cancelled) setPromotions(response.promotions); })
      .catch(() => { if (!cancelled) setPromotions([]); })
      .finally(() => { if (!cancelled) setPromotionsLoading(false); });
    return () => { cancelled = true; };
  }, [childIds]);

  const approvePromotion = async (item: CurriculumPromotion) => {
    setUpdatingPromotionId(item.id);
    setPromotionError(null);
    try {
      const updated = await promotionsApi.approve(item.id);
      setPromotions(current => current.map(row => row.id === updated.id ? updated : row));
    } catch (cause) {
      setPromotionError(cause instanceof Error ? cause.message : "Unable to promote this curriculum");
    } finally {
      setUpdatingPromotionId(null);
    }
  };

  const deferPromotion = async (item: CurriculumPromotion) => {
    setUpdatingPromotionId(item.id);
    setPromotionError(null);
    try {
      const updated = await promotionsApi.defer(item.id);
      setPromotions(current => current.map(row => row.id === updated.id ? updated : row));
    } catch (cause) {
      setPromotionError(cause instanceof Error ? cause.message : "Unable to defer this promotion");
    } finally {
      setUpdatingPromotionId(null);
    }
  };

  /**
   * Launching a child session is two round trips (token swap, then reload of "me"), so the tapped
   * card stays in a waiting state until one of them settles — silent seconds read as a dead button.
   */
  const launchChild = async (child: Child) => {
    if (playingChildId) return;
    setPlayingChildId(child.id);
    setPlayError(null);
    try {
      await startChildPlay(child.id, child.name);
    } catch (cause) {
      setPlayError(cause instanceof Error ? cause.message : `Could not open ${child.name}'s lesson. Please try again.`);
    } finally {
      setPlayingChildId(null);
    }
  };

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
    <>
      {playError && (
        <div role="alert" className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
          {playError}
        </div>
      )}
      <ParentChildrenGrid
        profiles={children}
        summaries={summaries}
        loading={loading}
        loadingSummaries={summariesLoading}
        error={error}
        allowRemove={activeView === "children"}
        onAdd={openAdd}
        playingChildId={playingChildId}
        onPlay={child => void launchChild(child)}
        onEdit={openEdit}
        onProgress={setProgressChild}
        onRemove={setDeletingChild}
        onUnlockPin={child => void unlockPin(child.id)}
        promotions={promotions}
        onApprovePromotion={item => void approvePromotion(item)}
      />
    </>
  );

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <DashboardLayout
        brand={{ name: "Koda Parent", logoSrc: "/favicon.svg", logoAlt: "Koda" }}
        sections={navSections}
        active={activeView}
        onNavigate={view => setActiveView(view as ParentView)}
        user={{ name: account?.name, email: account?.email, avatar: account?.avatar }}
        title={VIEW_TITLES[activeView]}
        appearance="parent"
        onProfile={() => setActiveView("profile")}
        onSettings={() => setActiveView("parent_settings")}
        onLogout={logout}
        contentClassName="flex-1 overflow-auto bg-[#FBFAFF] p-4 pb-24 sm:p-5 md:p-7 md:pb-7 dark:bg-[#0E1020]"
        actions={
          <div className="flex items-center gap-1">
            <NotificationBell recipientType="user" />
            <ThemeToggle theme={theme} onToggle={toggleTheme} variant="round" />
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out" className="h-9 w-9 rounded-xl text-slate-500 md:hidden dark:text-slate-300">
              <LogOut size={16} />
            </Button>
          </div>
        }
      >
        <div className="mx-auto w-full max-w-[1440px]">
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
              familyCode={account?.family_code}
            />
          ) : activeView === "children" ? (
            <ParentChildrenPage onAdd={openAdd} childrenGrid={childrenGrid} />
          ) : activeView === "settings" || activeView === "parent_settings" ? (
            <ParentSettingsPage />
          ) : (
            <ProfilePage />
          )}
          {activeView !== "dashboard" && activeView !== "settings" && activeView !== "parent_settings" && activeView !== "profile" && account?.family_code && (
            <div className="mt-6"><FamilyCodeCard code={account.family_code} /></div>
          )}
        </div>
      </DashboardLayout>

      <ChildFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        initial={editing}
      />
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
