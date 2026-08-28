import React from "react";
import { type StatTone, type SurfaceVariant, themeSystem } from "../../lib/themeSystem";

export interface UIStatTileProps {
  /** Identity mark. Sized by the well — pass a bare lucide icon. */
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  /** Colors the icon only. The value and label stay on ink tokens by design. */
  tone?: StatTone;
  variant?: SurfaceVariant;
  onClick?: () => void;
  className?: string;
}

/**
 * A single headline number: value, label, and an icon that carries identity.
 *
 * The accent hue lives on the icon and never on the number — a value wearing a
 * series color reads as if the color encodes something it does not.
 */
export const UIStatTile: React.FC<UIStatTileProps> = ({
  icon,
  value,
  label,
  tone = "primary",
  variant = "default",
  onClick,
  className = "",
}) => {
  const s = themeSystem.statTile;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={s.tile(onClick ? "interactive" : variant, `text-left ${className}`)}
    >
      <span className={`${s.well} ${s.tone(tone)}`}>{icon}</span>
      <span className="min-w-0">
        <span className={`block ${s.value}`}>{value}</span>
        <span className={`block ${s.label}`}>{label}</span>
      </span>
    </Tag>
  );
};

export interface UIStatGridProps {
  children: React.ReactNode;
  className?: string;
}

/** Row of stat tiles — two up on mobile, four across from `sm`. */
export const UIStatGrid: React.FC<UIStatGridProps> = ({ children, className = "" }) => (
  <div className={`${themeSystem.statTile.grid} ${className}`}>{children}</div>
);
