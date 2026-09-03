import React from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { type PathNodeState, themeSystem } from "../../lib/themeSystem";

export interface UIPathNodeProps {
  state?: PathNodeState;
  title: string;
  subtitle?: string;
  /** Emoji or icon shown when the node is neither completed nor locked. */
  icon?: React.ReactNode;
  /** Star count on a completed node. Omitted or 0 hides the badge. */
  stars?: number;
  /** Labels the current node as the place to resume. */
  startLabel?: string;
  onClick?: () => void;
}

/**
 * One stepping stone on the learning path: a state circle plus its label.
 *
 * State is carried by fill and icon together, never by color alone — a locked
 * node shows a padlock, a completed one a check.
 */
export const UIPathNode: React.FC<UIPathNodeProps> = ({
  state = "available",
  title,
  subtitle,
  icon,
  stars = 0,
  startLabel,
  onClick,
}) => {
  const s = themeSystem.pathNode;
  const isLocked = state === "locked";
  /* A plan lock, not a path lock: it draws the padlock but stays pressable,
     because pressing it is what explains the plan. See `PathNodeState`. */
  const isPremium = state === "premium";

  return (
    <div className={s.item}>
      <button
        disabled={isLocked}
        onClick={onClick}
        className={s.circle(state)}
        title={title}
        aria-label={`${title}${isLocked ? " (locked)" : isPremium ? " (on the plan)" : ""}`}
      >
        {state === "completed" ? (
          <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9" />
        ) : isLocked || isPremium ? (
          <Lock className="w-6 h-6" />
        ) : (
          <span className="text-2xl sm:text-3xl">{icon}</span>
        )}

        {state === "completed" && stars > 0 && (
          <span className={s.starBadge}>&#9733;{stars}</span>
        )}

        {state === "current" && startLabel && (
          <span className={s.startBadge}>
            {startLabel}
            <span className={s.startTail} aria-hidden="true" />
          </span>
        )}
      </button>

      <div className="w-full max-w-[130px] sm:max-w-[160px]">
        <span className={s.title(state)}>{title}</span>
        {subtitle && <span className={s.subtitle}>{subtitle}</span>}
      </div>
    </div>
  );
};

export interface UIPathGridProps {
  children: React.ReactNode;
  className?: string;
}

/** Lays path nodes out evenly — two up on mobile, four across from `sm`. */
export const UIPathGrid: React.FC<UIPathGridProps> = ({ children, className = "" }) => (
  <div className={`${themeSystem.pathNode.grid} ${className}`}>{children}</div>
);
