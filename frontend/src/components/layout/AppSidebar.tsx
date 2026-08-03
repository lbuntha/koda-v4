/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reusable light navigation rail. Config-driven (brand + nav items), collapsible
 * to an icon-only rail on desktop, and a compact top bar on mobile.
 */

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
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

export const AppSidebar: React.FC<Props> = ({ brand, sections, active, onNavigate, user, collapsed }) => {
  const BrandIcon = brand.icon;

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
        "hidden md:flex shrink-0 flex-col border-r border-slate-200/70 bg-white transition-[width] duration-200 md:h-full md:min-h-0 dark:border-white/10 dark:bg-[#111329]",
        collapsed ? "md:w-16" : "md:w-56"
      )}
    >
      {/* Brand */}
      <div className="px-4 h-16 flex items-center gap-2.5 shrink-0 overflow-hidden">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          brand.logoSrc ? "bg-transparent" : "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
        )}>
          {brand.logoSrc ? (
            <img src={brand.logoSrc} alt={brand.logoAlt ?? brand.name} className="h-8 w-8 rounded-lg object-contain" />
          ) : BrandIcon ? (
            <BrandIcon size={17} />
          ) : null}
        </div>
        {!collapsed && (
          <span className="whitespace-nowrap text-base font-black tracking-tight text-slate-900 dark:text-white">{brand.name}</span>
        )}
      </div>

      {/* Nav — grouped by main menu, each group collapsible on desktop */}
      <div className="px-3 md:mt-1 flex md:block gap-1">
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
                "flex md:flex-col gap-0.5 overflow-x-auto",
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
                      "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap py-2",
                      collapsed ? "px-2.5 md:px-0 md:justify-center" : "px-2.5",
                      isActive
                        ? "bg-indigo-50 text-indigo-600 font-semibold dark:bg-violet-400/15 dark:text-[#CDBEFF]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                    )}
                  >
                    <Icon size={18} className={cn("shrink-0", isActive ? "text-indigo-600 dark:text-[#BDA9FF]" : "text-slate-400 dark:text-slate-500")} />
                    {!collapsed && <span>{label}</span>}
                    {isActive && !collapsed && (
                      <span className="absolute -right-3 top-1/2 hidden h-6 w-1 -translate-y-1/2 rounded-l-full bg-indigo-600 md:block dark:bg-[#9A7CFF]" />
                    )}
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
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          title="View & Edit Profile"
          className={cn(
            "mt-auto hidden items-center gap-2.5 border-t border-slate-100 py-4 text-left transition-colors hover:bg-slate-50 md:flex dark:border-white/10 dark:hover:bg-white/5 cursor-pointer w-full",
            collapsed ? "px-0 justify-center" : "px-4"
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
              <div className="truncate text-xs font-bold text-slate-800 dark:text-white">{user.name}</div>
              <div className="truncate text-[10px] text-slate-400 dark:text-slate-500">{user.email}</div>
            </div>
          )}
        </button>
      )}
    </aside>
  );
};
