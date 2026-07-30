import React from "react";
import { BookOpen, CheckCircle2, Flame, Gift, Home, LogOut, Map, Star, Zap } from "lucide-react";
import { KidAvatar } from "../../../components/KidAvatar";
import { Button } from "../../../components/ui";
import type { ThemeMode } from "../../../theme/appTheme";
import { ThemeToggle } from "../../../theme/ThemeToggle";
import type { KidStats } from "../kidHomeModel";
import { AppToolbar } from "../shared";

interface Props {
  stats: KidStats;
  studentAvatar?: string | null;
  theme: ThemeMode;
  showSkills: boolean;
  activeDestination: KidHomeDestination;
  onNavigate: (destination: KidHomeDestination) => void;
  onToggleTheme: () => void;
  onExit: () => void;
}

export type KidHomeDestination = "home" | "skills" | "quests";

const ALL_SECTIONS = [
  { label: "Home", icon: Home, destination: "home" },
  { label: "Skills", icon: BookOpen, destination: "skills" },
  { label: "Quests", icon: Map, destination: "quests" },
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
  onExit,
}) => {
  const [rewardsOpen, setRewardsOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const rewardsRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

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

  return (
    <AppToolbar
      wide
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
                className={`h-12 min-w-12 flex-1 flex-col gap-1 rounded-xl px-2 text-[10px] font-extrabold leading-none sm:min-w-16 sm:max-w-20 sm:px-3 sm:text-[11px] md:min-w-20 md:max-w-24 lg:min-w-24 lg:max-w-28 lg:text-xs ${
                  isActive
                    ? "bg-[#F0EBFF] text-[#6844EA] hover:bg-[#E9E1FF] dark:bg-violet-400/15 dark:text-[#CDBEFF]"
                    : "text-[#7B8496] hover:bg-[#F5F1FF] hover:text-[#6844EA] dark:text-[#A79FC4] dark:hover:bg-white/10"
                }`}
              >
                <section.icon size={19} strokeWidth={2.2} className="lg:h-5 lg:w-5" />
                <span>{section.label}</span>
              </Button>
            );
          })}

          <div ref={rewardsRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRewardsOpen(open => !open);
                setProfileOpen(false);
              }}
              aria-expanded={rewardsOpen}
              aria-controls="kid-rewards-summary"
              className={`h-12 min-w-12 flex-1 flex-col gap-1 rounded-xl px-2 text-[10px] font-extrabold leading-none sm:min-w-16 sm:max-w-20 sm:px-3 sm:text-[11px] md:min-w-20 md:max-w-24 lg:min-w-24 lg:max-w-28 lg:text-xs ${
                rewardsOpen
                  ? "bg-[#F0EBFF] text-[#6844EA] dark:bg-violet-400/15 dark:text-[#CDBEFF]"
                  : "text-[#7B8496] hover:bg-[#F5F1FF] hover:text-[#6844EA] dark:text-[#A79FC4] dark:hover:bg-white/10"
              }`}
            >
              <Gift size={19} strokeWidth={2.2} className="lg:h-5 lg:w-5" />
              <span>Rewards</span>
            </Button>
            {rewardsOpen && (
              <div
                id="kid-rewards-summary"
                role="dialog"
                aria-label="Rewards summary"
                className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-[#E7EAF2] bg-white p-3 shadow-xl shadow-slate-950/10 dark:border-white/10 dark:bg-[#1B1737] dark:shadow-black/30"
              >
                <p className="px-1 text-xs font-black text-[#332750] dark:text-[#F2EEFF]">Your rewards</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span className="rounded-xl bg-[#FFF9DE] p-2 text-[10px] font-bold text-[#7B650E] dark:bg-amber-400/10 dark:text-amber-300">
                    <Zap size={14} className="mb-1 fill-current text-[#F2B829]" />
                    <strong className="block text-sm">{stats.totalXp}</strong> XP earned
                  </span>
                  <span className="rounded-xl bg-[#F0EBFF] p-2 text-[10px] font-bold text-[#6551BD] dark:bg-violet-400/10 dark:text-[#CDBEFF]">
                    <Star size={14} className="mb-1 fill-current" />
                    <strong className="block text-sm">{stats.mastered}</strong> mastered
                  </span>
                  <span className="rounded-xl bg-emerald-50 p-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <CheckCircle2 size={14} className="mb-1" />
                    <strong className="block text-sm">{stats.activitiesDone}</strong> completed
                  </span>
                  <span className="rounded-xl bg-[#FFF1E8] p-2 text-[10px] font-bold text-[#D65F21] dark:bg-orange-400/10 dark:text-orange-300">
                    <Flame size={14} className="mb-1 fill-current" />
                    <strong className="block text-sm">{stats.streakDays}</strong> day streak
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      }
      actions={
        <>
          <span
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#F8FAFD] px-2.5 text-[10px] font-black text-[#3F4654] ring-1 ring-[#EDF0F5] sm:px-3 sm:text-xs dark:bg-white/5 dark:text-[#E4DEFF] dark:ring-white/10"
            aria-label={`${stats.totalXp} experience points`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FFC928] text-white shadow-sm">
              <Zap size={9} className="fill-current" />
            </span>
            {stats.totalXp}
          </span>
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
              className="h-9 w-9 rounded-full bg-[linear-gradient(145deg,#9A85FF,#5B43DD)] p-0 ring-2 ring-[#EEE9FF] hover:scale-105 hover:bg-[linear-gradient(145deg,#9A85FF,#5B43DD)] dark:ring-white/10"
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
                  <ThemeToggle theme={theme} onToggle={onToggleTheme} variant="round" />
                </div>
                {stats.streakDays > 0 && (
                  <p className="mx-1 flex items-center gap-2 rounded-xl bg-[#FFF1E8] px-2.5 py-2 text-[11px] font-extrabold text-[#D65F21] dark:bg-orange-400/10 dark:text-orange-300">
                    <Flame size={14} className="fill-current" /> {stats.streakDays} day streak
                  </p>
                )}
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
  );
};
