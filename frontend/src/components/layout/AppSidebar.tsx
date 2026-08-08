/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reusable light navigation rail. Config-driven (brand + nav items), collapsible
 * to an icon-only rail on desktop, and a compact top bar on mobile.
 */

import React, { useState } from "react";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { cn } from "../../lib/utils";
import { KidAvatar } from "../KidAvatar";

const GROUPS_KEY = "koda_sidebar_groups"; // collapsed group ids

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export interface NavSection {
  id: string;
  label?: string;
  items: NavItem[];
}

export interface AppBrand {
  name: string;
  icon?: React.ElementType;
  logoSrc?: string;
  logoAlt?: string;
}

export interface AppUser {
  name?: string;
  email?: string;
  avatar?: string | null;
}

interface Props {
  brand: AppBrand;
  sections: NavSection[];
  active: string;
  onNavigate: (id: string) => void;
  user?: AppUser;
  collapsed: boolean;
  appearance?: "default" | "parent";
  onProfile?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}

const AVATAR_EMOJI_MAP: Record<string, string> = {
  "parent:owl": "🦉",
  "parent:crown": "👑",
  "parent:sparkles": "✨",
  "parent:star": "⭐",
  "parent:rocket": "🚀",
  "parent:shield": "🛡️",
  "parent:heart": "💖",
  "parent:light": "💡",
};

const resolveAvatarDisplay = (avatar?: string | null, name?: string) => {
  if (avatar && AVATAR_EMOJI_MAP[avatar]) return AVATAR_EMOJI_MAP[avatar];
  if (avatar && avatar.length <= 4) return avatar;
  return (name ?? "?").charAt(0).toUpperCase();
};

export const AppSidebar: React.FC<Props> = ({
  brand,
  sections,
  active,
  onNavigate,
  user,
  collapsed,
  appearance = "default",
  onProfile,
  onSettings,
  onLogout,
}) => {
  const BrandIcon = brand.icon;
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const hasProfileMenu = Boolean(onProfile || onSettings || onLogout);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(GROUPS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  const toggleGroup = (id: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try {
        localStorage.setItem(GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <aside
      className={cn(
        "relative hidden shrink-0 flex-col transition-[width] duration-200 md:flex md:h-full md:min-h-0 dark:bg-[#111329]",
        appearance === "parent"
          ? "border-r-2 border-[#E7E3F6] bg-transparent dark:border-white/10"
          : "border-r-2 border-[#E7E3F6] bg-[#FBFAFF] dark:border-white/10",
        collapsed ? "md:w-16" : appearance === "parent" ? "md:w-52" : "md:w-56"
      )}
    >
      {/* Brand */}
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5 overflow-hidden px-4", appearance === "parent" && "h-[4.5rem] px-4.5")}>
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          brand.logoSrc ? "bg-transparent" : appearance === "parent" ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20" : "bg-[#534AB7] text-white shadow-[0_5px_14px_-10px_rgba(83,74,183,0.65)]"
        )}>
          {brand.logoSrc ? (
            <img src={brand.logoSrc} alt={brand.logoAlt ?? brand.name} className={cn("h-8 w-8 rounded-lg object-contain", appearance === "parent" && "shadow-[0_3px_0_#D8CCFF] dark:shadow-[0_3px_0_#332A5C]")} />
          ) : BrandIcon ? (
            <BrandIcon size={17} />
          ) : null}
        </div>
        {!collapsed && (
          <span className={cn("whitespace-nowrap text-base dark:text-white", appearance === "parent" ? "font-semibold text-[#0E0B55]" : "font-black tracking-tight text-slate-900")}>{brand.name}</span>
        )}
      </div>

      {/* Nav — grouped by main menu, each group collapsible on desktop */}
      <div className={cn("flex gap-1 px-3 md:mt-1 md:block", appearance === "parent" && "px-3 md:mt-3")}>
        {sections.map((section) => {
          const groupCollapsed = collapsedGroups.has(section.id);
          return (
          <div key={section.id} className="md:mb-3 last:mb-0">
            {Boolean(section.label && section.label.trim()) && !collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(section.id)}
                className="hidden md:flex w-full items-center justify-between px-2 mb-1 group cursor-pointer"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
                  {section.label}
                </span>
                <ChevronDown
                  size={13}
                  className={cn("text-slate-300 transition-transform group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300", groupCollapsed && "-rotate-90")}
                />
              </button>
            )}
            <nav
              className={cn(
                "flex gap-0.5 overflow-x-auto md:flex-col md:overflow-x-visible",
                groupCollapsed && !collapsed && "md:hidden" // collapse the group on desktop only
              )}
            >
              {section.items.map(({ id, label, icon: Icon }) => {
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => onNavigate(id)}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "relative flex w-full items-center gap-3 whitespace-nowrap text-sm font-medium transition-all cursor-pointer",
                      appearance === "parent" ? "min-h-12 rounded-2xl border-2 py-2.5" : "min-h-10 rounded-xl border-2 py-2",
                      collapsed ? "px-2.5 md:px-0 md:justify-center" : "px-2.5",
                      isActive
                        ? appearance === "parent"
                          ? "border-[#DCD5FA] bg-[#F3F0FF] text-[#534AB7] shadow-[0_6px_18px_-14px_rgba(83,74,183,0.38)] dark:border-violet-300/20 dark:bg-violet-400/15 dark:text-[#CDBEFF] dark:shadow-[0_6px_18px_-14px_rgba(0,0,0,0.58)]"
                          : "border-[#DCD5FA] bg-[#F3F0FF] font-semibold text-[#534AB7] shadow-[0_6px_18px_-14px_rgba(83,74,183,0.36)] dark:border-violet-300/20 dark:bg-violet-400/15 dark:text-[#CDBEFF]"
                        : appearance === "parent"
                          ? "border-transparent text-slate-500 hover:border-[#EEE9FA] hover:bg-[#F8F5FF] hover:text-slate-800 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                          : "border-transparent text-[#6D6997] hover:border-[#E7E3F6] hover:bg-white hover:text-[#0E0B55] dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                    )}
                  >
                    <Icon size={appearance === "parent" ? 24 : 18} className={cn("shrink-0", isActive ? "text-[#534AB7] dark:text-[#BDA9FF]" : appearance === "parent" ? "text-slate-400 dark:text-slate-500" : "text-[#8D89AE] dark:text-slate-500")} />
                    {!collapsed && <span>{label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
          );
        })}
      </div>

      {/* Footer user */}
      {user && (
        <div className="relative mt-auto hidden p-3 md:block">
          {profileMenuOpen && hasProfileMenu && (
            <div className={cn(
              "absolute bottom-full z-30 mb-2 overflow-hidden rounded-2xl border border-[#E7E3F6] bg-white p-1.5 shadow-[0_14px_40px_rgba(44,36,90,0.16)] dark:border-white/10 dark:bg-[#1A1D32]",
              collapsed ? "left-2 w-48" : "inset-x-3"
            )} role="menu">
              {onProfile && <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); onProfile(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-[#0E0B55] hover:bg-[#F3F0FF] dark:text-white dark:hover:bg-white/10"><UserRound size={15} className="text-[#7C6DD8]" /> Profile</button>}
              {onSettings && <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); onSettings(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-[#0E0B55] hover:bg-[#F3F0FF] dark:text-white dark:hover:bg-white/10"><Settings size={15} className="text-[#7C6DD8]" /> Settings</button>}
              {onLogout && <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); onLogout(); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10"><LogOut size={15} /> Log out</button>}
            </div>
          )}
          <button
            type="button"
            onClick={() => hasProfileMenu ? setProfileMenuOpen(open => !open) : onNavigate("profile")}
            aria-expanded={hasProfileMenu ? profileMenuOpen : undefined}
            aria-haspopup={hasProfileMenu ? "menu" : undefined}
            title="Account menu"
            className={cn(
              "flex w-full cursor-pointer items-center gap-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5",
              appearance === "parent" ? "rounded-2xl border-2 border-[#E7E3F6] bg-[#FBFAFF] p-2.5 shadow-[0_3px_0_#E7E3F6] hover:border-[#DCD5F2] hover:bg-[#F3F0FF] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_3px_0_#292D45]" : "rounded-xl border-2 border-[#E7E3F6] bg-white p-2 hover:border-[#DCD5F2] hover:bg-[#F3F0FF] dark:border-white/10 dark:bg-white/[0.04]",
              collapsed ? "justify-center px-0" : appearance === "parent" ? "px-2.5" : "px-4"
            )}
          >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-sm font-black text-indigo-700 dark:bg-violet-400/20 dark:text-[#D6CAFF]">
            {user.avatar ? (
              <KidAvatar avatar={user.avatar} className="h-full w-full object-contain" />
            ) : (
              (user.name ?? "?").charAt(0).toUpperCase()
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-800 dark:text-white">{user.name}</div>
              <div className="truncate text-[10px] text-slate-400 dark:text-slate-500">{user.email}</div>
            </div>
          )}
            {!collapsed && hasProfileMenu && <ChevronDown size={14} className={cn("shrink-0 text-[#8D89AE] transition-transform", profileMenuOpen && "rotate-180")} />}
          </button>
        </div>
      )}
    </aside>
  );
};
