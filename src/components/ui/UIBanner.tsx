import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

/** Colour by meaning, from THEME.md. It tints the icon and nothing else. */
export type UIBannerTone = NonNullable<Parameters<typeof themeSystem.banner.tone>[0]>;

export interface UIBannerProps {
  /** The message. One sentence reads best; the card grows if it has to. */
  children: React.ReactNode;
  /** Optional bold line above the message. */
  title?: React.ReactNode;
  /** Identity mark. Sized by its well — pass a bare lucide icon. */
  icon?: React.ReactNode;
  tone?: UIBannerTone;
  /** One action, on the right when there is room and under the text when not. */
  action?: { label: string; onClick: () => void };
  /** Draws a close button. Called once the card has faded out. */
  onDismiss?: () => void;
  dismissLabel?: string;
  role?: "status" | "alert";
  className?: string;
}

/** How long the card takes to fade before `onDismiss` is called. */
const DISMISS_MS = 280;

/**
 * A short message card above the content it is about — "It's been 10 days",
 * "A new skill is out".
 *
 * Built from `themeSystem.banner`: the same surface, line and ink as every
 * other card, with the tone on the icon only, so it reads correctly in both
 * themes and never outshouts the cards under it. Not for errors, which stay
 * `UIFlashMessage`, and not for a decision, which is a dialog.
 */
export const UIBanner: React.FC<UIBannerProps> = ({
  children,
  title,
  icon,
  tone = "primary",
  action,
  onDismiss,
  dismissLabel = "Dismiss",
  role = "status",
  className = "",
}) => {
  const b = themeSystem.banner;
  const [closing, setClosing] = useState(false);
  const [gone, setGone] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (gone) return null;

  const dismiss = () => {
    setClosing(true);
    timer.current = window.setTimeout(() => {
      setGone(true);
      onDismiss?.();
    }, DISMISS_MS);
  };

  return (
    <div role={role} className={`${b.card} ${closing ? b.leave : b.enter} ${className}`}>
      <div className={`${b.row} ${onDismiss ? b.rowDismissable : ""}`}>
        {icon && (
          <span aria-hidden="true" className={`${b.well} ${b.tone(tone)}`}>
            {icon}
          </span>
        )}

        <div className={b.text}>
          {title && <div className={b.title}>{title}</div>}
          <div className={title ? b.message : b.messageAlone}>{children}</div>
        </div>

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={themeSystem.button("primary", "sm", "shrink-0")}
          >
            {action.label}
          </button>
        )}
      </div>

      {onDismiss && (
        <button type="button" aria-label={dismissLabel} onClick={dismiss} className={b.close}>
          <X />
        </button>
      )}
    </div>
  );
};
