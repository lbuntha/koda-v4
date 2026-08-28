import React, { useEffect, useState } from "react";
import { themeSystem } from "../../lib/themeSystem";

/**
 * The chrome a phone wears: a toolbar at the top and a tab bar at the bottom,
 * plus the tile the pages that fit on neither are listed with.
 *
 * These are shells only — they hold no opinion about which destinations exist
 * or who may see them. `AppNav` supplies that from the menu record. Keeping the
 * split means the Menu screen can add a destination without this file changing,
 * which is the same bargain the sidebar these replaced was built on.
 */

const s = themeSystem.appShell;

/* -------------------------------------------------------------------------- */
/* Toolbar                                                                     */
/* -------------------------------------------------------------------------- */

export interface UIAppBarProps {
  /** Usually a logo mark. Kept small — the title is what identifies the page. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Live figures and the account button. */
  actions?: React.ReactNode;
}

/**
 * The top bar.
 *
 * It names the destination rather than the product. A toolbar that says "KODA"
 * on all thirteen screens has spent its most legible line telling a child
 * something they already know; "Learn" tells them where they are, which is the
 * one thing a bar with no back button has to do.
 *
 * The hairline underneath appears only once the page has scrolled. At rest the
 * bar and the page read as one surface — that is what keeps a phone screen from
 * looking like three stacked boxes — and the moment content slides under it,
 * the line explains where the content went.
 */
export const UIAppBar: React.FC<UIAppBarProps> = ({ leading, title, subtitle, actions }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={s.bar}>
      <div className={s.barEdge(isScrolled)}>
        <div className={s.barInner}>
          {leading}

          <div className="min-w-0 flex-1">
            <h1 className={s.barTitle}>{title}</h1>
            {subtitle && <p className={s.barSubtitle}>{subtitle}</p>}
          </div>

          {actions && <div className="flex items-center gap-1.5 sm:gap-2">{actions}</div>}
        </div>
      </div>
    </header>
  );
};

export interface UIAppBarChipProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  /** Read out instead of the bare number, which on its own means nothing. */
  label: string;
  tone?: "streak" | "xp";
}

/** A live figure in the toolbar — the streak, the XP. */
export const UIAppBarChip: React.FC<UIAppBarChipProps> = ({
  icon,
  value,
  label,
  tone = "xp",
}) => (
  <span
    className={s.chip(tone)}
    title={label}
    aria-label={label}
  >
    <span className={s.chipIcon} aria-hidden="true">
      {icon}
    </span>
    <span>{value}</span>
  </span>
);

/* -------------------------------------------------------------------------- */
/* Tab bar                                                                     */
/* -------------------------------------------------------------------------- */

export interface UITabBarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Draws the notification dot. A count nobody has to read. */
  hasDot?: boolean;
  /** Opens the overflow sheet instead of navigating. */
  isOverflow?: boolean;
}

export interface UITabBarProps {
  items: UITabBarItem[];
  activeId: string;
  onSelect(id: string): void;
}

/**
 * The bottom tab bar — the app's whole navigation, at every screen size.
 *
 * Selection is a filled pill behind the icon rather than a colour swap alone:
 * colour is the first thing lost to a sunlit window, a cheap tablet panel or a
 * colour-blind reader, and this bar is the only way back to anywhere.
 *
 * Edge to edge on a phone, where the thumb expects the operating system to hand
 * the bar over at the bottom of the glass, and a floating dock from `sm` up —
 * five icons stretched across 1440px is not a navigation bar. The tabs, their
 * order and their behaviour do not change with the width; only how much of it
 * they are allowed to claim.
 */
export const UITabBar: React.FC<UITabBarProps> = ({ items, activeId, onSelect }) => (
  <div className={s.tabBarWrap}>
    <nav className={s.tabBar} aria-label="Main">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={s.tabItem}
            aria-current={isActive ? "page" : undefined}
            aria-haspopup={item.isOverflow ? "dialog" : undefined}
          >
            <span className={s.tabIcon(isActive)} aria-hidden="true">
              {item.icon}
              {item.hasDot && <span className={s.tabDot} />}
            </span>
            <span className={s.tabLabel(isActive)}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  </div>
);

/* -------------------------------------------------------------------------- */
/* Destination tile                                                            */
/* -------------------------------------------------------------------------- */

export interface UINavTileProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick(): void;
}

/**
 * A destination as a large, square target.
 *
 * What the tab bar has no room for is listed with these inside Settings — see
 * `NavShortcuts`. Deliberately much bigger than a menu row: this is where a
 * hand that could not find something on the bar comes looking, often on the
 * move, and a 44px row is the wrong answer to "I missed".
 */
export const UINavTile: React.FC<UINavTileProps> = ({
  icon,
  label,
  isActive = false,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={s.navTile(isActive)}
    aria-current={isActive ? "page" : undefined}
  >
    <span className={s.navTileIcon(isActive)} aria-hidden="true">
      {icon}
    </span>
    <span className={s.navTileLabel(isActive)}>{label}</span>
  </button>
);
