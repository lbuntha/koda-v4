import React from "react";
import { cn } from "../../../lib/utils";

interface Props {
  /** Line under the wordmark — the greeting on learner pages, "Your family" on the parent page. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Centre slot: section nav on wide screens. */
  nav?: React.ReactNode;
  /** Optional learner context row, such as the currently selected subject. */
  subnav?: React.ReactNode;
  /** Right slot: streak, theme toggle, Exit. */
  actions?: React.ReactNode;
  wide?: boolean;
}

/**
 * The one toolbar for people-facing pages (kid home, parent home). Sits on the page
 * background with no band or rule, and the Koda mark comes from `favicon.svg` so the tab icon
 * and the header can never drift apart.
 */
export const AppToolbar: React.FC<Props> = ({ title, subtitle, nav, subnav, actions, wide = false }) => (
  <>
    <header className="sticky top-0 z-40 w-full border-b border-[#E9E3F6] bg-white/90 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2.5 shadow-[0_8px_24px_-20px_rgba(77,58,139,0.5)] backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)] [-webkit-tap-highlight-color:transparent] sm:px-5 md:px-6 md:py-2.5 lg:px-8 dark:border-white/10 dark:bg-[#111329]/90 dark:shadow-none">
      <div className={cn("mx-auto flex h-12 items-center justify-between gap-2 sm:gap-4", wide ? "max-w-6xl" : "max-w-6xl")}>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <img
            src="/favicon.svg"
            alt="Koda"
            className="h-8 w-8 shrink-0 rounded-lg shadow-sm"
          />
          <div className="hidden shrink-0 sm:block">
            <span className="text-base font-black tracking-tight text-[#5B48D6] dark:text-[#BEACFF]">Koda</span>
          </div>
          {title && (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900 dark:text-[#EDECF8]">
                {title}
              </p>
              {subtitle && (
                <p className="truncate text-xs font-medium text-slate-500 dark:text-[#9A94B8]">{subtitle}</p>
              )}
            </div>
          )}
        </div>

        {nav && (
          <nav className="hidden min-w-0 max-w-2xl flex-1 items-center justify-evenly gap-1 md:flex sm:gap-2 lg:gap-4" aria-label="Desktop Sections">
            {nav}
          </nav>
        )}

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {subnav && (
        <div className={cn("mx-auto border-t border-[#EEEAF7] pt-1.5 dark:border-white/[0.07]", wide ? "max-w-6xl" : "max-w-6xl")}>
          {subnav}
        </div>
      )}
    </header>

    {nav && (
      <nav
        aria-label="Mobile section navigation"
        className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden dark:border-white/10 dark:bg-[#111329]/95 dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] select-none [-webkit-tap-highlight-color:transparent]"
      >
        {nav}
      </nav>
    )}
  </>
);
