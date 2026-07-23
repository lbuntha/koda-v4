import React from "react";
import { cn } from "../../lib/utils";
import { Card } from "./Card";

interface SectionCardProps {
  title?: React.ReactNode;
  /** Right-aligned header slot (e.g. a "See all" link or an action button). */
  action?: React.ReactNode;
  className?: string;
  /** Extra classes for the body wrapper. */
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * A card with an optional header row (title + action) and a divider — the
 * "Recent activity / Recent tasks" pattern. Body has no padding by default so
 * lists/tables can sit flush to the edges.
 */
export const SectionCard: React.FC<SectionCardProps> = ({ title, action, className, bodyClassName, children }) => (
  <Card className={cn("overflow-hidden", className)}>
    {(title || action) && (
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
        {typeof title === "string" ? <h3 className="text-sm font-bold text-slate-800">{title}</h3> : title}
        {action}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </Card>
);
