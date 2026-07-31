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

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-50 font-sans md:flex-row dark:bg-[#0E1020]">
      <AppSidebar brand={brand} sections={sections} active={active} onNavigate={onNavigate} user={user} collapsed={collapsed} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white px-5 dark:border-white/10 dark:bg-[#111329]">
          <button
            onClick={toggle}
            title="Toggle sidebar"
            className="hidden h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:inline-flex dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <PanelLeft size={18} />
          </button>
          {(title || subtitle) && (
            <div className="min-w-0 flex-1">
              {title && <h1 className="truncate text-base font-black leading-tight text-slate-900 dark:text-white">{title}</h1>}
              {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
          )}
          {!title && !subtitle && <div className="flex-1" />}
          {actions}
        </header>

        <div className={contentClassName ?? "flex-1 overflow-auto p-5"}>{children}</div>
      </main>
    </div>
  );
};
