/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Standard app shell: a collapsible sidebar + a header (toggle, title, actions)
 * + a padded content area. Reuse it for any signed-in area (admin, parent, …).
 *
 *   <DashboardLayout brand={...} nav={NAV} active={s} onNavigate={setS}
 *                    title="Overview" actions={<SignOut/>}>
 *     {content}
 *   </DashboardLayout>
 */

import React, { useState } from "react";
import { PanelLeft } from "lucide-react";
import { AppSidebar, AppBrand, NavItem, NavSection } from "./AppSidebar";

export type { AppBrand, NavItem, NavSection };

const COLLAPSE_KEY = "koda_sidebar_collapsed";

interface Props {
  brand: AppBrand;
  sections: NavSection[];
  active: string;
  onNavigate: (id: string) => void;
  user?: { name?: string; email?: string; avatar?: string | null };
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  contentClassName?: string;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<Props> = ({
  brand,
  sections,
  active,
  onNavigate,
  user,
  title,
  subtitle,
  actions,
  contentClassName,
  children,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const navItems = sections.flatMap(section => section.items);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-50 font-sans md:flex-row dark:bg-[#0E1020]">
      <AppSidebar brand={brand} sections={sections} active={active} onNavigate={onNavigate} user={user} collapsed={collapsed} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white px-4 sm:px-5 dark:border-white/10 dark:bg-[#111329]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <button
              onClick={toggle}
              title="Toggle sidebar"
              className="hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:inline-flex dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <PanelLeft size={18} />
            </button>

            {/* Mobile Brand Title */}
            <div className="flex items-center gap-2 md:hidden shrink-0">
              {brand.logoSrc && (
                <img src={brand.logoSrc} alt={brand.logoAlt ?? brand.name} className="h-7 w-7 rounded-lg object-contain" />
              )}
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {brand.name}
              </span>
            </div>

            {(title || subtitle) && (
              <div className="hidden sm:block min-w-0 flex-1">
                {title && <h1 className="truncate text-base font-black leading-tight text-slate-900 dark:text-white">{title}</h1>}
                {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {actions}
          </div>
        </header>

        <div className={contentClassName ?? "flex-1 overflow-auto p-5 pb-20 md:pb-5"}>{children}</div>
      </main>

      {/* Native PWA Mobile & Tablet Bottom Navigation Bar */}
      {navItems.length > 0 && (
        <nav
          aria-label="Mobile navigation"
          className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden dark:border-white/10 dark:bg-[#111329]/95 dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] select-none"
        >
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex min-h-[48px] flex-1 touch-manipulation cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl py-1 text-[11px] font-black transition-all active:scale-90 select-none [-webkit-tap-highlight-color:transparent] ${
                  isActive
                    ? "text-[#534AB7] dark:text-[#CDBEFF]"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                }`}
              >
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-[#534AB7] text-white shadow-sm shadow-[#534AB7]/40 dark:bg-[#6844EA]"
                    : "bg-transparent text-slate-400 dark:text-slate-500"
                }`}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};
