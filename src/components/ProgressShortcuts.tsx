import React from "react";

import { playSound } from "../utils/audio";
import { SidebarIcon, UINavTile } from "./ui";
import { themeSystem } from "../lib/themeSystem";
import { PROFILE_SECTIONS, openProfileAt, type ProfileSectionId } from "./account/profileSections";
import type { TabId } from "./navTabs";

export interface ProgressShortcutsProps {
  onSelectTab: (tab: TabId) => void;
}

const SHORTCUTS: { id: ProfileSectionId; label: string; icon: string }[] = [
  { id: PROFILE_SECTIONS.today, label: "Today", icon: "target" },
  { id: PROFILE_SECTIONS.achievements, label: "Badges", icon: "award" },
];

/**
 * A learner's own figures, one tap from Settings.
 *
 * Home's rail carried these on a phone and no longer does: three full-height
 * cards of statistics stood between a child and the lesson they opened the app
 * for. The figures are still worth having, so this is where a phone goes to
 * find them — the same three sections Profile already draws, reached directly
 * rather than by landing at the top of Profile and scrolling.
 *
 * Tiles rather than rows, and the same tile the destinations above it use: this
 * is a hand looking for something it could not find on the tab bar, which is the
 * case `UINavTile` exists for.
 *
 * `rail:hidden` like `NavShortcuts`, and for the same reason — above that width
 * the rail is on screen and carries every one of these itself.
 */
export const ProgressShortcuts: React.FC<ProgressShortcutsProps> = ({ onSelectTab }) => (
  <section className="rail:hidden">
    <div className={themeSystem.list.groupLabel}>Your progress</div>
    <div className="grid grid-cols-3 gap-2">
      {SHORTCUTS.map((shortcut) => (
        <UINavTile
          key={shortcut.id}
          icon={<SidebarIcon name={shortcut.icon} size={24} className="w-6 h-6" />}
          label={shortcut.label}
          onClick={() => {
            playSound("pop");
            // Asked for before the tab changes, so the page finds the request
            // already waiting when it mounts.
            openProfileAt(shortcut.id);
            onSelectTab("profile");
          }}
        />
      ))}
    </div>
  </section>
);
