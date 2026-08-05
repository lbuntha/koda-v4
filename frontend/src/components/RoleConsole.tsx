/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A generic, menu-driven console for any role that doesn't have a bespoke screen
 * (e.g. custom roles). The sidebar is resolved from /menus/me, so whatever menus
 * an admin grants the role show up here. Screens are placeholders until mapped.
 */

import React, { useEffect, useState } from "react";
import { LayoutDashboard, LogOut, Loader2, Inbox } from "lucide-react";
import { Button, Card, KodaLogoSpinner } from "./ui";
import { DashboardLayout } from "./layout/DashboardLayout";
import { ContentPlaceholder } from "./ContentPlaceholder";
import { useAuth } from "../auth/AuthContext";
import { useMenus } from "../nav/useMenus";

export const RoleConsole: React.FC = () => {
  const { account, role, logout } = useAuth();
  const { sections, loading } = useMenus();
  const [section, setSection] = useState<string>("");

  // Default to the first available menu once they load.
  useEffect(() => {
    if (!section && sections.length) setSection(sections[0].items[0]?.id ?? "");
  }, [sections, section]);

  const activeMenu = sections.flatMap((s) => s.items).find((i) => i.id === section);
  const title = activeMenu?.label ?? "Home";
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

  return (
    <DashboardLayout
      brand={{ name: "Koda", icon: LayoutDashboard }}
      sections={sections}
      active={section}
      onNavigate={setSection}
      user={{ name: account?.name, email: account?.email }}
      title={title}
      subtitle={roleLabel}
      actions={
        <Button variant="ghost" size="sm" onClick={logout} className="text-slate-500">
          <LogOut size={14} /> <span className="hidden sm:inline">Sign out</span>
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <KodaLogoSpinner size="lg" label="Loading role console..." />
        </div>
      ) : sections.length === 0 ? (
        <Card className="p-12 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Inbox size={24} />
          </div>
          <div>
            <p className="font-bold text-slate-700">No menus yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              An admin hasn&apos;t granted your role any menus. Ask them to assign access in Menus &amp; Access.
            </p>
          </div>
        </Card>
      ) : (
        <ContentPlaceholder label={title} hint="This menu is assigned to your role; its screen hasn't been built yet." />
      )}
    </DashboardLayout>
  );
};
