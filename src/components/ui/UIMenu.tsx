import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

/**
 * Shared context / dropdown menu.
 *
 * The trigger is a render prop rather than a wrapped node, so the caller keeps
 * ownership of its own element — important when the trigger is already a button
 * (nesting buttons is invalid HTML).
 *
 *   <UIMenu side="top" trigger={({ toggle }) => <MyButton onClick={toggle} />}>
 *     {({ close }) => <UIMenuItem icon={<Sun />} onSelect={close}>Light</UIMenuItem>}
 *   </UIMenu>
 */

export type MenuSide = "top" | "bottom";
export type MenuAlign = "start" | "end";

export interface UIMenuProps {
  trigger: (state: { toggle: () => void; isOpen: boolean }) => React.ReactNode;
  children: React.ReactNode | ((state: { close: () => void }) => React.ReactNode);
  side?: MenuSide;
  align?: MenuAlign;
  className?: string;
}

export const UIMenu: React.FC<UIMenuProps> = ({
  trigger,
  children,
  side = "bottom",
  align = "start",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);

  const position = [
    side === "top" ? "bottom-full mb-2" : "top-full mt-2",
    align === "end" ? "right-0" : "left-0",
  ].join(" ");

  return (
    <div ref={rootRef} className="relative">
      {trigger({ toggle, isOpen })}

      {isOpen && (
        <div role="menu" className={`absolute ${position} ${themeSystem.menu.panel} ${className}`}>
          {typeof children === "function" ? children({ close }) : children}
        </div>
      )}
    </div>
  );
};

export interface UIMenuItemProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onSelect?: () => void;
  /** Renders a trailing check — for menus that express a current choice. */
  isActive?: boolean;
  tone?: "default" | "danger";
  disabled?: boolean;
}

export const UIMenuItem: React.FC<UIMenuItemProps> = ({
  icon,
  children,
  onSelect,
  isActive = false,
  tone = "default",
  disabled = false,
}) => (
  <button
    role="menuitem"
    disabled={disabled}
    onClick={onSelect}
    aria-current={isActive || undefined}
    className={`${themeSystem.menu.item(isActive, tone)} ${
      disabled ? "opacity-50 cursor-not-allowed" : ""
    }`}
  >
    {icon}
    <span className="flex-1">{children}</span>
    {isActive && <Check className="w-4 h-4 shrink-0" />}
  </button>
);

export const UIMenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={themeSystem.menu.label}>{children}</div>
);

export const UIMenuSeparator: React.FC = () => (
  <div role="separator" className={themeSystem.menu.separator} />
);
