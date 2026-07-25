/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Slide-in-from-the-right sibling to Dialog.tsx — same Escape-key and
 * body-scroll-lock behavior, same backdrop-click-to-close, but positioned
 * as a right-hand panel instead of a centered card. Used wherever a task
 * (adding a question, reviewing AI results) should keep whatever's behind
 * it visible rather than replacing the whole screen.
 */

import React, { useEffect } from "react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Defaults to a comfortable reading width; override for wider content (e.g. an AI batch review list). */
  widthClassName?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  widthClassName = "w-full sm:w-[440px]",
  children
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
      />

      {/* Panel */}
      <div className={`relative h-full bg-white border-l border-slate-200 shadow-2xl z-10 flex flex-col animate-slide-in-right dark:bg-[#151A2B] dark:border-white/10 ${widthClassName}`}>
        {title && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0 dark:border-white/10">
            <h2 className="text-sm font-bold text-slate-800 truncate dark:text-[#E2E0F2]">{title}</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer flex-shrink-0 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
};
