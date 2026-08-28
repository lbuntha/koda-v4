import React from "react";
import { themeSystem } from "../../lib/themeSystem";
import { useIsCompact } from "../../lib/useBreakpoint";

export interface UISectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Emoji or icon shown before the title. */
  icon?: React.ReactNode;
  /** Right-hand slot — a filter, a "see all" link, a count. */
  action?: React.ReactNode;
  className?: string;
}

/** Titles a block of content. Pairs a heading with an optional one-line summary. */
export const UISectionHeader: React.FC<UISectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
  className = "",
}) => {
  const s = themeSystem.sectionHeader;

  return (
    <div className={`${s.wrap} ${className}`}>
      <div>
        <h3 className={s.title}>
          {icon && <span className={s.eyebrowIcon}>{icon}</span>}
          <span>{title}</span>
        </h3>
        {subtitle && <p className={s.subtitle}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
};

export interface UIUnitBannerProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Emoji or icon marking the unit. */
  icon?: React.ReactNode;
  /** Trailing chip, e.g. "4 Stepping Stones". Hidden on narrow screens. */
  badge?: React.ReactNode;
  className?: string;
}

/** Header strip for a unit of the learning path. */
export const UIUnitBanner: React.FC<UIUnitBannerProps> = ({
  title,
  description,
  icon,
  badge,
  className = "",
}) => {
  const s = themeSystem.unitBanner;

  return (
    <div className={`${s.banner} ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className={s.icon}>{icon}</span>}
        <div className="min-w-0">
          <h4 className={s.title}>{title}</h4>
          {description && <p className={s.description}>{description}</p>}
        </div>
      </div>
      {badge && (
        <div className="text-right hidden sm:block">
          <span className={s.badge}>{badge}</span>
        </div>
      )}
    </div>
  );
};

export interface UIUnitCardProps {
  children: React.ReactNode;
  className?: string;
}

/** Container holding a unit banner plus its path nodes. */
export const UIUnitCard: React.FC<UIUnitCardProps> = ({ children, className = "" }) => (
  <div className={`${themeSystem.unitBanner.card} ${className}`}>{children}</div>
);

export interface UIPageHeaderProps {
  /** Small label above the title — the section of the app this page belongs to. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-hand slot — a badge, a count. Kept on a phone, where the title is not. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The title block at the top of a page — and on a phone it is not there at all.
 *
 * Below `rail:` the toolbar already names the destination, in the same words,
 * two centimetres higher up the screen. Printing it again costs a third of the
 * first screen of a 390px device to say something the reader has just read, and
 * pushes what they came for below the fold. From `rail:` up there is no toolbar
 * — the rail carries the nav and nothing announces the page — so the heading is
 * the only thing naming it and it stays.
 *
 * Removed from the tree rather than hidden with a class, and that distinction is
 * the whole reason this is a component. Tailwind's `space-y-*` spaces a child it
 * cannot see: a `hidden rail:block` header at the top of a `space-y-5` page
 * leaves 20px of nothing under the toolbar, on every page, and the gap differs
 * per page because each picks its own scale. Returning `null` leaves no gap to
 * inherit, so the distance from the toolbar to the first real thing on the page
 * is the page padding, everywhere.
 *
 * An `action` survives on a phone, because a badge is not a repetition of the
 * toolbar — it is the only place something like "Admin · all skills" is said.
 */
export const UIPageHeader: React.FC<UIPageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  action,
  className = "",
}) => {
  const isCompact = useIsCompact();

  if (isCompact) {
    if (!action) return null;
    return <div className={`flex justify-end ${className}`}>{action}</div>;
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${className}`}>
      <div>
        {eyebrow && (
          <p className="font-mono font-black uppercase tracking-widest text-xs text-indigo-600 dark:text-indigo-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
};
