import React, { useState } from "react";
import { playSound } from "../utils/audio";
import { SidebarIcon, UINavTile } from "./ui";
import { themeSystem } from "../lib/themeSystem";
import { splitTabs, useNavItems } from "./navRecord";
import type { TabId } from "./navTabs";
import { StatisticsModal } from "./account/StatisticsModal";
import { AchievementsModal } from "./account/AchievementsModal";
export interface NavShortcutsProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenProfile?: () => void;
}

/**
 * Everywhere else, for a phone.
 *
 * The tab bar carries four destinations. This is where the rest of the menu
 * record lives on a narrow screen — Profile, and whatever management pages the
 * account may open — plus the two tools that are not pages at all.
 *
 * It sits inside Settings rather than in a sheet hanging off the tab bar, and
 * it is the same record the rail draws from, filtered by the same permissions.
 * It wears the same group heading as the switches above it, so the page reads
 * as one list rather than a settings page with a widget bolted on.
 * A destination an account cannot reach is absent here exactly as it is absent
 * there; nothing is listed that would open an empty page.
 *
 * Hidden from `rail:` up, where the sidebar already lists every one of these
 * and repeating them under Settings would be the same door twice.
 */
export const NavShortcuts: React.FC<NavShortcutsProps> = ({
  activeTab,
  onSelectTab,
  onOpenProfile,
}) => {
  const [statsOpen, setStatsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const items = useNavItems();
  const { overflow } = splitTabs(items);

  return (
    <>
      <section className="rail:hidden">
        <div className={themeSystem.list.groupLabel}>Go to</div>
        <div className="grid grid-cols-3 gap-2">
          {overflow.map((item) => {
            if (item.id === "profile") {
              return (
                <React.Fragment key={item.id}>
                  <UINavTile
                    icon={<SidebarIcon name={item.icon} size={24} className="w-6 h-6" />}
                    label={item.label}
                    isActive={item.id === activeTab}
                    onClick={() => {
                      playSound("pop");
                      if (onOpenProfile) onOpenProfile();
                      else onSelectTab(item.id as TabId);
                    }}
                  />
                  <UINavTile
                    icon={<SidebarIcon name="chart" size={24} className="w-6 h-6" />}
                    label="Statistics"
                    onClick={() => {
                      playSound("pop");
                      setStatsOpen(true);
                    }}
                  />
                  <UINavTile
                    icon={<SidebarIcon name="award" size={24} className="w-6 h-6" />}
                    label="Achievements"
                    onClick={() => {
                      playSound("pop");
                      setAchievementsOpen(true);
                    }}
                  />
                </React.Fragment>
              );
            }
            return (
              <UINavTile
                key={item.id}
                icon={<SidebarIcon name={item.icon} size={24} className="w-6 h-6" />}
                label={item.label}
                isActive={item.id === activeTab}
                onClick={() => {
                  playSound("pop");
                  onSelectTab(item.id as TabId);
                }}
              />
            );
          })}
        </div>
      </section>

      <StatisticsModal
        isOpen={statsOpen}
        onClose={() => setStatsOpen(false)}
        onOpenProfile={() => {
          setStatsOpen(false);
          onSelectTab("profile");
        }}
      />

      <AchievementsModal
        isOpen={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        onOpenProfile={() => {
          setAchievementsOpen(false);
          onSelectTab("profile");
        }}
      />
    </>
  );
};
