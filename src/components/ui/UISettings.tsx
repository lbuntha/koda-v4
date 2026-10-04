import React from "react";
import { themeSystem } from "../../lib/themeSystem";

/**
 * One row of a settings group.
 *
 * Flat: an icon, a label, and the control. It used to be a bordered card with
 * its own tinted background *inside* the section card, which on a phone meant
 * two borders and two fills around every switch before you reached the switch.
 * The group draws one border; the rows are separated by a hairline.
 */
export const UISettingRow: React.FC<{
  icon?: React.ReactNode;
  title: string;
  /** A single short line, and only when the control does not already say it. */
  note?: React.ReactNode;
  control?: React.ReactNode;
}> = ({ icon, title, note, control }) => {
  const l = themeSystem.list;
  return (
    <div className={l.row}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className={l.rowIcon}>{icon}</span>}
        <div className="min-w-0">
          <h4 className={l.rowTitle}>{title}</h4>
          {note && <p className={l.rowNote}>{note}</p>}
        </div>
      </div>
      {control}
    </div>
  );
};

/** A titled group of rows. The heading sits above the card, not inside it. */
export const UISettingGroup: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = "",
}) => (
  <section className={className}>
    <div className={themeSystem.list.groupLabel}>{label}</div>
    <div className={themeSystem.list.group}>{children}</div>
  </section>
);
