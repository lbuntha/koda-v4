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

interface Props {
  brand: { name: string; icon: React.ElementType };
  sections: NavSection[];
  active: string;
  onNavigate: (id: string) => void;
  user?: { name?: string; email?: string };
  collapsed: boolean;
}

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
        "flex shrink-0 flex-col border-b border-slate-200/70 bg-white transition-[width] duration-200 md:h-full md:min-h-0 md:border-b-0 md:border-r",
        collapsed ? "md:w-16" : "md:w-56"
      )}
    >
      {/* Brand */}
      <div className="px-4 h-16 flex items-center gap-2.5 shrink-0 overflow-hidden">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-600/20 shrink-0">
          <BrandIcon size={17} />
        </div>
        {!collapsed && (
          <span className="text-base font-black tracking-tight text-slate-900 whitespace-nowrap">{brand.name}</span>
        )}
      </div>

      {/* Nav — grouped by main menu, each group collapsible on desktop */}
      <div className="px-3 md:mt-1 flex md:block gap-1">
        {sections.map((section) => {
          const groupCollapsed = collapsedGroups.has(section.id);
          return (
          <div key={section.id} className="md:mb-3 last:mb-0">
            {section.label && !collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(section.id)}
                className="hidden md:flex w-full items-center justify-between px-2 mb-1 group cursor-pointer"
              >
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">
                  {section.label}
                </span>
                <ChevronDown
                  size={13}
                  className={cn("text-slate-300 group-hover:text-slate-500 transition-transform", groupCollapsed && "-rotate-90")}
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
                        ? "bg-indigo-50 text-indigo-600 font-semibold"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    <Icon size={18} className={cn("shrink-0", isActive ? "text-indigo-600" : "text-slate-400")} />
                    {!collapsed && <span>{label}</span>}
                    {isActive && !collapsed && (
                      <span className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-1 rounded-l-full bg-indigo-600" />
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
        <div
          className={cn(
            "mt-auto py-4 hidden md:flex items-center gap-2.5 border-t border-slate-100",
            collapsed ? "px-0 justify-center" : "px-4"
          )}
        >
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-700 shrink-0">
            {(user.name ?? "?").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
