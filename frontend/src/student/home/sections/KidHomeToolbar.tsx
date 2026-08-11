import React from "react";
import { BookOpen, CheckCircle2, Gift, Home, LogOut, Map, Palette, Star, Zap } from "lucide-react";
import { KidAvatar } from "../../../components/KidAvatar";
import { AvatarPicker } from "../../../components/AvatarPicker";
import { persistableAvatar } from "../../../components/avatarPersistence";
import { Button, Dialog, Spinner } from "../../../components/ui";
import type { ThemeMode } from "../../../theme/appTheme";
import { ThemeToggle } from "../../../theme/ThemeToggle";
import type { KidStats } from "../kidHomeModel";
import type { LearnerSubject } from "../../../api/course";
import { SubjectSwitcher } from "../SubjectSwitcher";
import { AnimatedXpPill } from "../shared/AnimatedXpPill";
import { AppToolbar } from "../shared";
import { useSvgLibrary } from "../../../assets/SvgLibraryContext";
import { SvgLibraryAsset } from "../../../assets/SvgLibraryAsset";
import { KID_NAV_ASSETS, KID_NAV_ASSET_IDS } from "../kidNavAssets";
import { NotificationBell } from "../../../notifications/NotificationBell";

interface Props {
  stats: KidStats;
  studentAvatar?: string | null;
  theme: ThemeMode;
  showSkills: boolean;
  activeDestination: KidHomeDestination;
  onNavigate: (destination: KidHomeDestination) => void;
  onToggleTheme: () => void;
  onAvatarChange: (avatar: string) => Promise<void>;
  onExit: () => void;
  subjects: LearnerSubject[];
  activeSubjectId: string | null;
  switchingSubject: boolean;
  onSubjectChange: (subjectId: string) => void;
}

export type KidHomeDestination = "home" | "skills" | "quests";

const ALL_SECTIONS = [
  { label: "Home", fallback: Home, assetId: KID_NAV_ASSET_IDS.home, destination: "home" },
  { label: "Skills", fallback: BookOpen, assetId: KID_NAV_ASSET_IDS.skills, destination: "skills" },
  { label: "Quests", fallback: Map, assetId: KID_NAV_ASSET_IDS.quests, destination: "quests" },
] as const;

/** Sticky learner navigation with live section highlighting and account actions. */
export const KidHomeToolbar: React.FC<Props> = ({
  stats,
  studentAvatar,
  theme,
  showSkills,
  activeDestination,
  onNavigate,
  onToggleTheme,
  onAvatarChange,
  onExit,
  subjects,
  activeSubjectId,
  switchingSubject,
  onSubjectChange,
}) => {
  const { assets: svgAssets, setAssets: setSvgAssets, deletedSystemAssetIds } = useSvgLibrary();
  const [rewardsOpen, setRewardsOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const [selectedAvatar, setSelectedAvatar] = React.useState<string | null>(studentAvatar ?? null);
  const [avatarSaving, setAvatarSaving] = React.useState(false);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);
  const rewardsRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const existingIds = new Set(svgAssets.map(asset => asset.id));
    const deletedIds = new Set(deletedSystemAssetIds);
    const missingAssets = KID_NAV_ASSETS.filter(asset => !existingIds.has(asset.id) && !deletedIds.has(asset.id));
    if (missingAssets.length > 0) setSvgAssets(current => [...current, ...missingAssets]);
  }, [deletedSystemAssetIds, setSvgAssets, svgAssets]);

  React.useEffect(() => {
    if (!rewardsOpen) return;
    const closeRewards = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof PointerEvent && rewardsRef.current?.contains(event.target as Node)) return;
      setRewardsOpen(false);
    };
    document.addEventListener("pointerdown", closeRewards);
    document.addEventListener("keydown", closeRewards);
    return () => {
      document.removeEventListener("pointerdown", closeRewards);
      document.removeEventListener("keydown", closeRewards);
    };
  }, [rewardsOpen]);

  React.useEffect(() => {
    if (!profileOpen) return;
    const closeProfile = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof PointerEvent && profileRef.current?.contains(event.target as Node)) return;
      setProfileOpen(false);
    };
    document.addEventListener("pointerdown", closeProfile);
    document.addEventListener("keydown", closeProfile);
    return () => {
      document.removeEventListener("pointerdown", closeProfile);
      document.removeEventListener("keydown", closeProfile);
    };
  }, [profileOpen]);

  React.useEffect(() => setSelectedAvatar(studentAvatar ?? null), [studentAvatar]);

  const saveAvatar = async () => {
    if (!selectedAvatar) return;
    setAvatarSaving(true);
    setAvatarError(null);
    try {
      await onAvatarChange(await persistableAvatar(selectedAvatar));
      setAvatarOpen(false);
    } catch (reason) {
      setAvatarError(reason instanceof Error ? reason.message : "Could not save your avatar yet.");
    } finally {
      setAvatarSaving(false);
    }
  };

  return (
    <>
      <AppToolbar
      wide
      className="md:py-3"
      nav={
        <>
          {ALL_SECTIONS.map(section => {
            const isActive = activeDestination === section.destination && !rewardsOpen;
            const isAvailable = section.destination === "home"
              || section.destination === "quests"
              || (section.destination === "skills" && showSkills);
            return (
              <Button
                key={section.destination}
                type="button"
                variant="ghost"
                onClick={() => isAvailable && onNavigate(section.destination)}
                disabled={!isAvailable}
                aria-current={isActive ? "page" : undefined}
                className={`h-16 min-w-14 flex-1 flex-col gap-1 rounded-2xl border-2 px-2 text-[10px] font-extrabold leading-none sm:min-w-16 sm:px-3 md:h-12 md:min-w-20 md:max-w-24 md:gap-0.5 lg:min-w-24 lg:max-w-28 lg:text-xs ${
                  isActive
                    ? "border-[#DED4FF] bg-[#F3EFFF] text-[#6844EA] hover:border-[#D5C9FF] hover:bg-[#ECE6FF] dark:border-violet-400/20 dark:bg-violet-400/15 dark:text-[#CDBEFF]"
                    : "border-transparent text-[#7B8496] hover:border-[#EEE9FA] hover:bg-[#F8F5FF] hover:text-[#6844EA] dark:text-[#A79FC4] dark:hover:border-white/10 dark:hover:bg-white/10"
                }`}
              >
                <span className="inline-flex scale-[1.28] md:scale-100">
                  <SvgLibraryAsset assetId={section.assetId} size={27} fallback={<section.fallback size={25} strokeWidth={2.2} />} />
                </span>
                <span className="hidden md:inline">{section.label}</span>
              </Button>
            );
          })}

          <div ref={rewardsRef} className="relative flex flex-1 md:block md:flex-none">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRewardsOpen(open => !open);
                setProfileOpen(false);
              }}
              aria-expanded={rewardsOpen}
              aria-controls="kid-rewards-summary"
              className={`h-16 min-w-14 w-full flex-1 flex-col gap-1 rounded-2xl border-2 px-2 text-[10px] font-extrabold leading-none sm:min-w-16 sm:px-3 md:h-12 md:min-w-20 md:max-w-24 md:gap-0.5 lg:min-w-24 lg:max-w-28 lg:text-xs ${
                rewardsOpen
                  ? "border-[#DED4FF] bg-[#F3EFFF] text-[#6844EA] dark:border-violet-400/20 dark:bg-violet-400/15 dark:text-[#CDBEFF]"
                  : "border-transparent text-[#7B8496] hover:border-[#EEE9FA] hover:bg-[#F8F5FF] hover:text-[#6844EA] dark:text-[#A79FC4] dark:hover:border-white/10 dark:hover:bg-white/10"
              }`}
            >
              <span className="inline-flex scale-[1.28] md:scale-100">
                <SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.rewards} size={27} fallback={<Gift size={25} strokeWidth={2.2} />} />
              </span>
              <span className="hidden md:inline">Rewards</span>
            </Button>
            {rewardsOpen && (
              <div
                id="kid-rewards-summary"
                role="dialog"
                aria-label="Rewards summary"
                className="absolute bottom-[4.75rem] right-0 top-auto z-50 w-64 rounded-2xl border border-[#E7EAF2] bg-white p-3 shadow-xl shadow-slate-950/10 md:bottom-auto md:top-14 dark:border-white/10 dark:bg-[#1B1737] dark:shadow-black/30"
              >
                <p className="px-1 text-xs font-black text-[#332750] dark:text-[#F2EEFF]">Your rewards</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span className="rounded-xl bg-[#FFF9DE] p-2 text-[10px] font-bold text-[#7B650E] dark:bg-amber-400/10 dark:text-amber-300">
                    <span className="mb-1 block"><SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.xp} size={20} fallback={<Zap size={14} className="fill-current text-[#F2B829]" />} /></span>
                    <strong className="block text-sm">{stats.totalXp}</strong> XP earned
                  </span>
                  <span className="rounded-xl bg-[#F0EBFF] p-2 text-[10px] font-bold text-[#6551BD] dark:bg-violet-400/10 dark:text-[#CDBEFF]">
                    <span className="mb-1 block"><SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.mastery} size={20} fallback={<Star size={14} className="fill-current" />} /></span>
                    <strong className="block text-sm">{stats.mastered}</strong> mastered
                  </span>
                  <span className="rounded-xl bg-emerald-50 p-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <CheckCircle2 size={14} className="mb-1" />
                    <strong className="block text-sm">{stats.activitiesDone}</strong> completed
                  </span>
                  <span className="rounded-xl bg-[#FFF1E8] p-2 text-[10px] font-bold text-[#D65F21] dark:bg-orange-400/10 dark:text-orange-300">
                    <span className="mb-1 block"><SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.streak} size={20} fallback={<Star size={14} className="fill-current" />} /></span>
                    <strong className="block text-sm">{stats.streakDays}</strong> day streak
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      }
      subnav={subjects.length > 1 ? (
        <SubjectSwitcher
          subjects={subjects}
          activeSubjectId={activeSubjectId}
          loading={switchingSubject}
          onChange={onSubjectChange}
          className="justify-center py-0"
        />
      ) : undefined}
      actions={
        <>
          <AnimatedXpPill value={stats.totalXp} />
          {stats.streakDays > 0 && (
            <span
              className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-[#FFE1BD] bg-[#FFF9EE] px-2.5 text-[10px] font-black tabular-nums text-[#C75A25] shadow-[0_3px_0_#FFE1BD] sm:px-3 sm:text-xs dark:border-orange-300/15 dark:bg-orange-400/10 dark:text-orange-300 dark:shadow-[0_3px_0_#3A2929]"
              aria-label={`${stats.streakDays} day streak`}
              title="Learning streak"
            >
              <SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.streak} size={20} fallback={<Star size={14} className="fill-current" />} />
              {stats.streakDays}
            </span>
          )}
          <NotificationBell recipientType="student" iconAssetId={KID_NAV_ASSET_IDS.notification} />
          <div ref={profileRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setProfileOpen(open => !open);
                setRewardsOpen(false);
              }}
              aria-label="Open learner menu"
              aria-expanded={profileOpen}
              aria-controls="kid-profile-menu"
              className="h-9 w-9 rounded-full border-2 border-[#CFC2FF] bg-[linear-gradient(145deg,#9A85FF,#5B43DD)] p-0 shadow-[0_3px_0_#5B43DD] hover:-translate-y-px hover:bg-[linear-gradient(145deg,#A38FFF,#684CE6)] dark:border-white/15"
            >
              <KidAvatar avatar={studentAvatar ?? undefined} className="h-7 w-7 text-lg" />
            </Button>
            {profileOpen && (
              <div
                id="kid-profile-menu"
                role="menu"
                className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-[#E7EAF2] bg-white p-2 shadow-xl shadow-slate-950/10 dark:border-white/10 dark:bg-[#1B1737] dark:shadow-black/30"
              >
                <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5">
                  <span className="text-xs font-extrabold text-[#4B5262] dark:text-[#D6D0E8]">Theme</span>
                  <ThemeToggle
                    theme={theme}
                    onToggle={onToggleTheme}
                    variant="round"
                    iconAssetId={theme === "light" ? KID_NAV_ASSET_IDS.themeDark : KID_NAV_ASSET_IDS.themeLight}
                  />
                </div>
                {stats.streakDays > 0 && (
                  <p className="mx-1 flex items-center gap-2 rounded-xl bg-[#FFF1E8] px-2.5 py-2 text-[11px] font-extrabold text-[#D65F21] dark:bg-orange-400/10 dark:text-orange-300">
                    <SvgLibraryAsset assetId={KID_NAV_ASSET_IDS.streak} size={18} fallback={<Star size={14} className="fill-current" />} /> {stats.streakDays} day streak
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                  onClick={() => {
                    setSelectedAvatar(studentAvatar ?? null);
                    setAvatarError(null);
                    setAvatarOpen(true);
                    setProfileOpen(false);
                  }}
                  className="mt-1 w-full justify-start rounded-xl px-2.5 text-[#6E6480] hover:bg-[#F5F7FB] dark:text-[#CDBEFF] dark:hover:bg-white/10"
                >
                  <Palette size={15} /> Change avatar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                  onClick={onExit}
                  className="mt-1 w-full justify-start rounded-xl px-2.5 text-[#6E6480] hover:bg-[#F5F7FB] dark:text-[#CDBEFF] dark:hover:bg-white/10"
                >
                  <LogOut size={15} /> Exit
                </Button>
              </div>
            )}
          </div>
        </>
      }
      />
      <Dialog isOpen={avatarOpen} onClose={() => !avatarSaving && setAvatarOpen(false)} maxWidthClassName="max-w-4xl">
        <div className="pr-8">
          <p className="text-lg font-black text-[#27334A] dark:text-white">Choose your Koda avatar</p>
          <p className="mt-1 text-xs font-semibold text-[#8792A5] dark:text-[#9AA3B5]">Pick a character that feels like you.</p>
        </div>
        <AvatarPicker value={selectedAvatar} onChange={setSelectedAvatar} className="mt-5" />
        {avatarError && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{avatarError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setAvatarOpen(false)} disabled={avatarSaving}>Cancel</Button>
          <Button type="button" onClick={() => void saveAvatar()} disabled={avatarSaving || !selectedAvatar} className="bg-[#7252D8] hover:bg-[#6546CC]">
            {avatarSaving ? <Spinner size="sm" label="Saving avatar" /> : "Use this avatar"}
          </Button>
        </div>
      </Dialog>
    </>
  );
};
