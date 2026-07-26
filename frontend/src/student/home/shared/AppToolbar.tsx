import React from "react";
import { cn } from "../../../lib/utils";

interface Props {
  /** Line under the wordmark — the greeting on learner pages, "Your family" on the parent page. */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Centre slot: section nav on wide screens. */
  nav?: React.ReactNode;
  /** Right slot: streak, theme toggle, Exit. */
  actions?: React.ReactNode;
  wide?: boolean;
}

/**
 * The one toolbar for people-facing pages (kid home, parent home). Sits on the page
 * background with no band or rule, and the Koda mark comes from `favicon.svg` so the tab icon
 * and the header can never drift apart.
 */
export const AppToolbar: React.FC<Props> = ({ title, subtitle, nav, actions, wide = false }) => (
  <header className="w-full px-4 py-3.5 sm:px-8 sm:py-4">
    <div className={cn("mx-auto flex items-center justify-between gap-3", wide ? "max-w-7xl" : "max-w-6xl")}>
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <img
          src="/favicon.svg"
          alt="Koda"
          className="h-11 w-11 shrink-0 rounded-2xl shadow-lg shadow-violet-500/25 dark:shadow-none"
        />
        <div className="hidden shrink-0 sm:block">
          <span className="text-2xl font-black tracking-tight text-[#5B48D6] dark:text-[#BEACFF]">Koda</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold leading-tight text-slate-900 dark:text-[#EDECF8]">
            {title}
          </p>
          {subtitle && (
            <p className="truncate text-xs font-medium text-slate-500 dark:text-[#9A94B8]">{subtitle}</p>
          )}
        </div>
      </div>

      {nav && <nav className="hidden items-center gap-1 lg:flex" aria-label="Sections">{nav}</nav>}

      {actions && <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  </header>
);
