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
import { AppSidebar, NavItem, NavSection } from "./AppSidebar";

export type { NavItem, NavSection };

const COLLAPSE_KEY = "koda_sidebar_collapsed";

interface Props {
  brand: { name: string; icon: React.ElementType };
  sections: NavSection[];
  active: string;
  onNavigate: (id: string) => void;
  user?: { name?: string; email?: string };
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
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-slate-50 font-sans md:flex-row">
      <AppSidebar brand={brand} sections={sections} active={active} onNavigate={onNavigate} user={user} collapsed={collapsed} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="h-16 bg-white border-b border-slate-200/70 flex items-center gap-3 px-5 shrink-0">
          <button
            onClick={toggle}
            title="Toggle sidebar"
            className="hidden md:inline-flex w-8 h-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <PanelLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-slate-900 leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
          {actions}
        </header>

        <div className={contentClassName ?? "flex-1 overflow-auto p-5"}>{children}</div>
      </main>
    </div>
  );
};
