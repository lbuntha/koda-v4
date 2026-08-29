import React from "react";
import { playSound } from "../utils/audio";
import {
  UISidebar,
  UISidebarNav,
  resolveSidebarIcon,
} from "./ui";
import { AccountMenu } from "./AccountMenu";
import { navDefaults, useNavItems } from "./navRecord";
import type { TabId } from "./navTabs";

const config = navDefaults;

export interface SidebarNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

/**
 * Koda's navigation on a tablet or a laptop.
 *
 * Every destination the account may reach, listed in full — which is the thing
 * a rail can do that a five-slot tab bar cannot, and the reason both shells
 * exist rather than one. `useNavItems` is what they share: the record, the
 * permission filter and the live counts are decided once, so a parent cannot
 * see one set of destinations on the iPad and another on their phone.
 *
 * Rendered only from `rail:` up — see `themeSystem.sidebar.aside`. Below that
 * width `AppNav` takes over completely; this is not a drawer waiting to be
 * opened, it is simply not there.
 */
export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const items = useNavItems();

  const BrandIcon = resolveSidebarIcon(config.brand.icon);
  const logo = config.brand.logoUrl;

  return (
    <UISidebar
      brand={{
        title: config.brand.title,
        subtitle: config.brand.subtitle,
        iconBare: Boolean(logo),
        icon: logo ? (
          <img src={logo} alt="" className="w-9 h-9 rounded-xl shrink-0" />
        ) : (
          <BrandIcon className="w-5 h-5 text-white" />
        ),
      }}
      onInteract={() => playSound("pop")}
      footer={
        config.profile ? (
          <AccountMenu
            variant="rail"
            profile={config.profile}
            onOpenProfile={() => onSelectTab("profile")}
          />
        ) : null
      }
    >
      <UISidebarNav
        sections={[{ id: "main", items }]}
        activeId={activeTab}
        onSelect={(id) => {
          playSound("pop");
          onSelectTab(id as TabId);
        }}
      />
    </UISidebar>
  );
};
