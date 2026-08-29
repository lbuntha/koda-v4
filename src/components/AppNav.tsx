import React from "react";
import { Flame, Zap } from "lucide-react";
import { UserProgress } from "../types";
import { playSound } from "../utils/audio";
import { SidebarIcon, UIAppBar, UIAppBarChip, UITabBar, type UITabBarItem } from "./ui";
import { useSession } from "../lib/sync";
import { useStreak } from "../lib/streak";
import { AccountMenu, accountSubtitle } from "./AccountMenu";
import { navDefaults, splitTabs, useNavItems } from "./navRecord";
import type { TabId } from "./navTabs";

const config = navDefaults;

/** Four figures becomes "4", four thousand becomes "4k" — a chip has one line. */
const compact = (value: number): string => {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  const digits = thousands < 10 && thousands % 1 !== 0 ? 1 : 0;
  return `${thousands.toFixed(digits).replace(/\.0$/, "")}k`;
};

export interface AppNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  userProgress: UserProgress;
}

/**
 * Koda's navigation on a phone: a toolbar above the page and a tab bar below it.
 *
 * Rendered only below `rail:` (720px) — see `themeSystem.appShell.bar` and
 * `.tabBarWrap`. From there up the sidebar takes over, and the two never share
 * a screen, so nothing here has to reason about a rail beside it.
 *
 * The split exists because the two widths want genuinely different things. A
 * rail lists thirteen destinations at once and a 390px screen cannot, so rather
 * than shrinking the rail until it is a hamburger — one tap in front of every
 * screen on the device a child actually holds — the phone carries the four from
 * `MOBILE_TABS`, permanently visible, inside the thumb's reach.
 *
 * Nothing hangs off the end of the bar. What the four leave out — Profile and
 * the management pages — is listed inside Settings by `NavShortcuts`, which is
 * a tap further away and the right distance: those are places an adult goes
 * deliberately, not places a thumb lands on the way past.
 *
 * What is *not* different is what the destinations are: `useNavItems` is shared
 * with the rail, so the record, the permission filter and the counts are
 * decided once for both.
 */
export const AppNav: React.FC<AppNavProps> = ({
  activeTab,
  onSelectTab,
  userProgress,
}) => {
  const session = useSession();
  const streak = useStreak(userProgress);
  const items = useNavItems();

  const { primary, overflow } = splitTabs(items);

  const active = items.find((item) => item.id === activeTab);
  /*
   * A page reached from inside Settings keeps Settings lit.
   *
   * Profile and the management pages are not tabs, so without this the bar
   * shows nothing selected while one of them fills the screen — which reads as
   * the app having lost its place. Settings is where the learner walked in
   * from, so Settings is what stays marked.
   */
  const activeInOverflow = overflow.some((item) => item.id === activeTab);

  const tabs: UITabBarItem[] = primary.map((item) => ({
    id: item.id,
    label: item.label,
    icon: <SidebarIcon name={item.icon} size={22} className="w-[22px] h-[22px]" />,
  }));

  const go = (id: string) => {
    playSound("pop");
    onSelectTab(id as TabId);
  };

  return (
    <>
      <UIAppBar
        /* No logo on a phone. A mark in the top-left is where a browser puts a
           back button and where an app puts nothing at all — on 390px it costs
           40px of the one line that has to say which page this is, to repeat
           what the icon on the home screen already said. The rail carries the
           brand at the widths with room for it. */
        title={active?.label ?? config.brand.title}
        subtitle={session ? accountSubtitle(session) : config.brand.subtitle}
        actions={
          <>
            {/* Hidden outright when a parent has switched streaks off — a flame
                frozen at zero is a broken feature, not a disabled one. */}
            {streak.config.enabled && (
              <UIAppBarChip
                tone="streak"
                /* The line icon, not the drawn flame from the art library: at
                   16px that is a smudge, and it carries its own colours, which
                   fight the chip it sits in. This one takes `currentColor`. */
                icon={<Flame className="fill-current" />}
                value={streak.days}
                label={`${streak.days} ${streak.cadence === "weekly" ? "week" : "day"} streak`}
              />
            )}
            <UIAppBarChip
              icon={<Zap className="fill-current" />}
              value={compact(userProgress.xp)}
              label={`${userProgress.xp} XP`}
            />
            {config.profile && (
              <AccountMenu profile={config.profile} onOpenProfile={() => onSelectTab("profile")} />
            )}
          </>
        }
      />

      <UITabBar items={tabs} activeId={activeInOverflow ? "settings" : activeTab} onSelect={go} />

    </>
  );
};
