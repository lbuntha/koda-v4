import React from "react";
import { type FeatureVariant, themeSystem } from "../../lib/themeSystem";

export interface FeatureMetaItem {
  icon?: React.ReactNode;
  label: React.ReactNode;
}

export interface UIFeatureCardProps {
  /** Small mark beside the eyebrow. */
  icon?: React.ReactNode;
  /** Short status above the title, e.g. "LVL 1 Recommended". */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Highlighted callout under the title — a tip, a definition, a caveat. */
  note?: React.ReactNode;
  noteIcon?: React.ReactNode;
  /** Emphasized first meta entry, rendered before the dotted list. */
  metaLead?: React.ReactNode;
  meta?: FeatureMetaItem[];
  /** The single primary action. */
  action?: React.ReactNode;
  variant?: FeatureVariant;
  className?: string;
}

/**
 * The lead card for a screen: what to do next, why it matters, and one way in.
 *
 * Deliberately single-action — a hero with competing buttons stops being a
 * recommendation. Extra affordances belong in the content below it.
 */
export const UIFeatureCard: React.FC<UIFeatureCardProps> = ({
  icon,
  eyebrow,
  title,
  note,
  noteIcon,
  metaLead,
  meta = [],
  action,
  variant = "default",
  className = "",
}) => {
  const s = themeSystem.featureCard;

  return (
    <div className={s.card(variant, className)}>
      <div className={s.body}>
        <div className={`${themeSystem.spacing.stack} text-center md:text-left`}>
          {(icon || eyebrow) && (
            <div className="inline-flex items-center gap-2">
              {icon && <span className={s.icon}>{icon}</span>}
              {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
            </div>
          )}

          <h2 className={s.title}>{title}</h2>

          {note && (
            <div className={s.note}>
              {noteIcon && <span className="shrink-0 mt-0.5">{noteIcon}</span>}
              <span>{note}</span>
            </div>
          )}

          {(metaLead || meta.length > 0) && (
            <div className={s.metaRow}>
              {metaLead && <span className={s.metaLead}>{metaLead}</span>}
              {meta.map((item, i) => (
                <React.Fragment key={i}>
                  {(metaLead || i > 0) && <span className={s.metaDot}>&bull;</span>}
                  <span className={s.metaItem}>
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {action}
      </div>
    </div>
  );
};

/** Primary action styled for the feature card's right rail. */
export const UIFeatureCardAction: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className = "" }) => (
  <button onClick={onClick} className={`${themeSystem.featureCard.action} ${className}`}>
    {children}
  </button>
);
