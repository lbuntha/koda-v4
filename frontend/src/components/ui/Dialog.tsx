import React, { useEffect } from "react";
import { createPortal } from "react-dom";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, children, maxWidthClassName = "max-w-md" }) => {
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

  // Rendered into <body> rather than in place. `position: fixed` and a z-index only rank an
  // element within its own stacking context, and a modal is routinely mounted inside one —
  // the Property Studio panel is `absolute … z-20`, so a dialog opened from it was trapped
  // below the canvas chrome at z-30/z-40 and the page painted straight through it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in" 
      />
      
      {/* Content wrapper */}
      <div className={`bg-white dark:bg-[#1B2032] dark:border-white/10 rounded-2xl border border-slate-100 shadow-2xl w-full ${maxWidthClassName} p-6 z-10 relative animate-scale-in max-h-[90vh] overflow-y-auto`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
};

