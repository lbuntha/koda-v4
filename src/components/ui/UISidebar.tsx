import React, { createContext, useContext, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { SidebarIcon } from "./sidebarIcon";
import { UIAvatar } from "./UIAvatar";
import type { NavProfileConfig, NavSectionConfig } from "./navConfig";

/**
 * The sidebar rail — Koda's navigation from `rail:` (720px) up.
 *
 * A rail and nothing else. It used to carry an off-canvas drawer and a
 * hamburger header for narrow screens, which is gone: below `rail:` the phone
 * renders `AppNav` instead, so this component is never asked to be a drawer and
 * has no width at which it needs one. What is left is the part that was always
 * good on a tablet or a laptop — every destination visible at once, no tap
 * spent opening the menu.
 *
 * Owns only the chrome every rail needs — the collapse toggle, branding and the
 * footer slot. Product-specific content is passed as children so this stays
 * reusable; use `useUISidebar()` inside that content to react to the collapsed
 * state instead of threading props down by hand.
 */

interface UISidebarContextValue {
  isCollapsed: boolean;
  /** The collapsed rail hides labels and shows icons alone. */
  showLabels: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const UISidebarContext = createContext<UISidebarContextValue>({
  isCollapsed: false,
  showLabels: true,
  setCollapsed: () => {},
});

export const useUISidebar = () => useContext(UISidebarContext);

export interface UISidebarBrand {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Skip the tinted icon well — for logos that already carry their own ground. */
  iconBare?: boolean;
}

export interface UISidebarProps {
  brand: UISidebarBrand;
  children: React.ReactNode;
  /** Pinned to the bottom of the rail. */
  footer?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Fired on collapse/expand so the host can play a sound or haptic. */
  onInteract?: () => void;
  className?: string;
}

export const UISidebar: React.FC<UISidebarProps> = ({
  brand,
  children,
  footer,
  collapsible = true,
  defaultCollapsed = false,
  onInteract,
  className = "",
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const s = themeSystem.sidebar;

  const ctx = useMemo<UISidebarContextValue>(
    () => ({
      isCollapsed,
      showLabels: !isCollapsed,
      setCollapsed: setIsCollapsed,
    }),
    [isCollapsed],
  );

  return (
    <UISidebarContext.Provider value={ctx}>
      <aside
        className={`${s.aside} ${
          isCollapsed ? s.widthCollapsed : s.widthExpanded
        } ${className}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className={s.brandBar}>
            <div className={`flex items-center gap-3 ${isCollapsed ? "w-full justify-center" : ""}`}>
              {brand.icon &&
                (brand.iconBare ? brand.icon : <div className={s.brandIcon}>{brand.icon}</div>)}

              {!isCollapsed && (
                <div>
                  <h1 className={s.brandTitle}>{brand.title}</h1>
                  {brand.subtitle && <p className={s.brandSubtitle}>{brand.subtitle}</p>}
                </div>
              )}
            </div>

            {collapsible && !isCollapsed && (
              <button
                onClick={() => {
                  onInteract?.();
                  setIsCollapsed(true);
                }}
                className={s.iconButton}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Collapsed, the toggle moves below the brand: side by side in a
              20-unit rail there is room for one of them, and the mark is what
              tells a reader which app they are in. */}
          {collapsible && isCollapsed && (
            <button
              onClick={() => {
                onInteract?.();
                setIsCollapsed(false);
              }}
              className={`${s.iconButton} mx-auto mt-3`}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pt-3">
            {children}
          </div>
        </div>

        {footer && <div className={s.footer}>{footer}</div>}
      </aside>
    </UISidebarContext.Provider>
  );
};

export interface UISidebarSectionProps {
  /** Hidden automatically while the rail is collapsed. */
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export const UISidebarSection: React.FC<UISidebarSectionProps> = ({
  label,
  children,
  className = "",
}) => {
  const { isCollapsed } = useUISidebar();

  return (
    <nav className={`space-y-1 ${className}`}>
      {label && !isCollapsed && (
        <div className={themeSystem.sidebar.sectionLabel}>{label}</div>
      )}
      {children}
    </nav>
  );
};

export interface UISidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  /** Trailing chip; hidden while the item is active, matching the nav's resting style. */
  badge?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const UISidebarNavItem: React.FC<UISidebarNavItemProps> = ({
  icon,
  label,
  badge,
  isActive = false,
  onClick,
  className = "",
}) => {
  const { isCollapsed, showLabels } = useUISidebar();
  const s = themeSystem.sidebar;

  return (
    <button
      onClick={onClick}
      className={s.navItem(isActive, isCollapsed, className)}
      title={label}
      aria-current={isActive ? "page" : undefined}
    >
      <span className={s.navIcon(isActive)}>{icon}</span>

      {showLabels && (
        <div className="flex-1 flex items-center justify-between text-left">
          <span className={s.navLabel(isActive)}>{label}</span>
          {!isActive && badge && <span className={s.navBadge}>{badge}</span>}
        </div>
      )}
    </button>
  );
};

export interface UISidebarProfileProps {
  profile: NavProfileConfig;
  onClick?: () => void;
  /** Shows the disclosure chevron — set when the row opens a menu. */
  hasMenu?: boolean;
  isMenuOpen?: boolean;
}

/** Account row for the footer slot. Collapses to just the avatar on the rail. */
export const UISidebarProfile: React.FC<UISidebarProfileProps> = ({
  profile,
  onClick,
  hasMenu = false,
  isMenuOpen = false,
}) => {
  const { showLabels } = useUISidebar();
  const s = themeSystem.sidebar;

  const avatar = (
    <div className={`${s.profileAvatar} overflow-hidden`}>
      <UIAvatar
        name={profile.initials ?? profile.name}
        src={profile.avatarUrl}
        size="fill"
        className="bg-transparent text-inherit"
        decorative
      />
    </div>
  );

  if (!showLabels) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onClick}
          title={profile.name}
          aria-label={profile.name}
          aria-haspopup={hasMenu || undefined}
          aria-expanded={hasMenu ? isMenuOpen : undefined}
        >
          {avatar}
        </button>
      </div>
    );
  }

  return (
    <button
      className={s.profileRow}
      onClick={onClick}
      aria-haspopup={hasMenu || undefined}
      aria-expanded={hasMenu ? isMenuOpen : undefined}
    >
      {avatar}
      <div className="min-w-0">
        <div className={s.profileName}>{profile.name}</div>
        {profile.role && <div className={s.profileRole}>{profile.role}</div>}
      </div>
      {hasMenu && (
        <ChevronUp
          className={`w-4 h-4 ${s.profileChevron} ${isMenuOpen ? "" : "rotate-180"}`}
        />
      )}
    </button>
  );
};

export interface UISidebarNavProps {
  sections: NavSectionConfig[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Renders sections and items straight from config, resolving icon names to
 * components. Use this when the nav comes from JSON; compose `UISidebarSection`
 * and `UISidebarNavItem` by hand when a screen needs bespoke items.
 */
export const UISidebarNav: React.FC<UISidebarNavProps> = ({ sections, activeId, onSelect }) => (
  <>
    {sections.map((section, i) => (
      <UISidebarSection key={section.id ?? section.label ?? i} label={section.label}>
        {section.items.map((item) => (
          <UISidebarNavItem
            key={item.id}
            icon={<SidebarIcon name={item.icon} size={40} className="w-10 h-10" />}
            label={item.label}
            badge={item.badge}
            isActive={activeId === item.id}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </UISidebarSection>
    ))}
  </>
);
