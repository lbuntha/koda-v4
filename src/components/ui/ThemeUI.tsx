import React from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import {
  themeSystem,
  ButtonVariant,
  ButtonSize,
  CardVariant,
  BadgeVariant,
  FlashType,
  TypographyVariant,
} from "../../lib/themeSystem";
import { UIButtonSpinner } from "./UISpinner";

export interface UIButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon. Sized by the button's size token — pass a bare lucide icon. */
  icon?: React.ReactNode;
  /** Trailing icon, e.g. an arrow on a "continue" action. */
  iconRight?: React.ReactNode;
  /** Swaps the leading icon for a spinner and blocks input. */
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const UIButton: React.FC<UIButtonProps> = ({
  variant = "primary" as ButtonVariant,
  size = "md" as ButtonSize,
  icon,
  iconRight,
  isLoading = false,
  fullWidth = false,
  disabled,
  children,
  className = "",
  ...props
}) => {
  const width = fullWidth ? "w-full" : "";

  return (
    <button
      className={themeSystem.button(variant, size, `${width} ${className}`)}
      // A button mid-request must not fire twice, so loading implies disabled.
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <UIButtonSpinner /> : icon}
      {children}
      {!isLoading && iconRight}
    </button>
  );
};

export interface UICardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const UICard: React.FC<UICardProps> = ({ variant = "default" as CardVariant, children, className = "", ...props }) => {
  return (
    <div className={themeSystem.card(variant, className)} {...props}>
      {children}
    </div>
  );
};

export interface UIBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const UIBadge: React.FC<UIBadgeProps> = ({ variant = "primary" as BadgeVariant, children, className = "", ...props }) => {
  return (
    <span className={themeSystem.badge(variant, className)} {...props}>
      {children}
    </span>
  );
};

export interface UIFlashMessageProps {
  type?: FlashType;
  title?: string;
  message: string;
  className?: string;
  onClose?: () => void;
}

export const UIFlashMessage: React.FC<UIFlashMessageProps> = ({
  type = "info" as FlashType,
  title,
  message,
  className = "",
  onClose,
}) => {
  return (
    <div className={themeSystem.flash(type, className)}>
      <div className="flex-1">
        {title && <h5 className="font-semibold text-sm mb-0.5">{title}</h5>}
        <p className="text-sm opacity-90">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="opacity-70 hover:opacity-100 text-sm font-bold px-1.5 py-0.5">
          &times;
        </button>
      )}
    </div>
  );
};

export interface UIModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * How wide the window may get from `rail:` up. Ignored below that, where the
   * dialog is a bottom sheet and takes the width of the phone. One of the keys
   * of `RAIL_WIDTH`.
   */
  maxWidth?: string;
  /**
   * `"default"` gives the footer its own muted band and rules the header off
   * with a grey hairline — right for a form with a lot in it, where the bands
   * say which part is content and which part is controls.
   *
   * `"plain"` drops both: one white sheet from title to buttons. For a short
   * dialog that is one sentence and one field, the bands are dividing nothing,
   * and the grey is the only cold colour in a window that is otherwise white
   * and indigo.
   */
  tone?: "default" | "plain";
}

/**
 * Put a full-screen overlay on `document.body`, not where it was mounted.
 *
 * `position: fixed` is only relative to the viewport while no ancestor has a
 * transform, filter or `will-change` — any of those makes the element a
 * containing block, and a `fixed inset-0` overlay inside one is sized to *it*
 * instead of the screen.
 *
 * That is not hypothetical here. The sidebar `<aside>` used to carry a
 * `translate-x-*` on every breakpoint for its off-canvas drawer, so every
 * dialog opened from the account menu — the PIN prompt, the avatar picker —
 * was laid out inside the sidebar rather than over the page. The drawer is
 * gone, but the rail is still a transform away from bringing it back.
 *
 * Portalling fixes the whole class rather than the two that were noticed, and
 * it keeps the fix in the component nobody has to remember to use correctly.
 */
const overlay = (node: React.ReactNode): React.ReactPortal | null =>
  typeof document === "undefined" ? null : createPortal(node, document.body);

/**
 * The width caps, written out so Tailwind can see them.
 *
 * A cap only applies from `rail:` up — below it a dialog is a sheet and is as
 * wide as the phone. `rail:${maxWidth}` would be invisible to the scanner,
 * which reads source text and cannot evaluate a template, so the five widths
 * anyone passes are listed instead and an unknown one falls back.
 */
const RAIL_WIDTH: Record<string, string> = {
  "max-w-md": "rail:max-w-md",
  "max-w-lg": "rail:max-w-lg",
  "max-w-xl": "rail:max-w-xl",
  "max-w-2xl": "rail:max-w-2xl",
  "max-w-3xl": "rail:max-w-3xl",
};

export const UIModal: React.FC<UIModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = "max-w-lg", tone = "default" }) => {
  if (!isOpen) return null;

  const plain = tone === "plain";

  return overlay(
    <div className={themeSystem.modal.overlay} onClick={onClose}>
      <div
        className={`${themeSystem.modal.content} ${RAIL_WIDTH[maxWidth] ?? "rail:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={themeSystem.modal.grabber} aria-hidden="true" />
        <div className={plain ? themeSystem.modal.headerPlain : themeSystem.modal.header}>
          <h3 className={themeSystem.typography("h3", themeSystem.modal.headerTitle)}>{title}</h3>
          <button onClick={onClose} className={themeSystem.modal.close} aria-label="Close">
            <X />
          </button>
        </div>
        <div className={themeSystem.modal.body}>{children}</div>
        {footer && <div className={plain ? themeSystem.modal.footerPlain : themeSystem.modal.footer}>{footer}</div>}
      </div>
    </div>,
  );
};

export interface UIDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: "danger" | "primary";
}

export const UIDialog: React.FC<UIDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  variant = "primary",
}) => {
  if (!isOpen) return null;

  return overlay(
    <div className={themeSystem.dialog.overlay} onClick={onClose}>
      <div className={themeSystem.dialog.content} onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className={themeSystem.typography("h3")}>{title}</h3>
          <p className={`${themeSystem.typography("body-sm")} mt-1`}>{description}</p>
        </div>
        <div className={themeSystem.dialog.actions}>
          <UIButton variant="secondary" size="sm" onClick={onClose}>
            {cancelText}
          </UIButton>
          <UIButton variant={variant === "danger" ? "danger" : "primary"} size="sm" onClick={() => { onConfirm(); onClose(); }}>
            {confirmText}
          </UIButton>
        </div>
      </div>
    </div>,
  );
};

export interface UITypographyProps {
  variant?: TypographyVariant;
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

export const UITypography: React.FC<UITypographyProps> = ({
  variant = "body" as TypographyVariant,
  children,
  className = "",
  as: Component = "p",
}) => {
  const Tag = Component || "p";
  return <Tag className={themeSystem.typography(variant, className)}>{children}</Tag>;
};
