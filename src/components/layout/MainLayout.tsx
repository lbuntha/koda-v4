import React from "react";
import { UIOverlayLoader, UIPageLoader } from "../ui";
import { themeSystem } from "../../lib/themeSystem";

export interface MainLayoutProps {
  /** The rail. Draws itself only from `rail:` up; absent below that. */
  sidebar?: React.ReactNode;
  /**
   * The phone's chrome — toolbar and tab bar. Rendered ahead of the page
   * because each positions itself: the toolbar is sticky and stays in the
   * column, the tab bar is fixed and leaves it. Passed as one node so the state
   * they share (which sheet is open) stays in one component. Hides itself from
   * `rail:` up, where the sidebar takes over.
   */
  nav?: React.ReactNode;
  children: React.ReactNode;
  /** Swaps the content area for a centered loader — use while a view has nothing to show yet. */
  isLoading?: boolean;
  /** Dims the content and floats a loader over it — use while refreshing something already on screen. */
  isRefreshing?: boolean;
  loadingLabel?: string;
  /** Set false for views that manage their own padding and full-bleed width (games, canvases). */
  contained?: boolean;
  className?: string;
}

/**
 * The app shell, and the one place that decides what "loading" looks like.
 *
 * Two shapes, one component. From `rail:` (720px) up it is a row: the sidebar
 * on the left, the page beside it, exactly as a tablet or a laptop wants. Below
 * that it is a column: a toolbar, the page, and a tab bar fixed to the bottom
 * of the glass. Both shells are always mounted and each hides itself at the
 * width that is not its own, so the switch is CSS rather than a measurement —
 * nothing has to wait for JavaScript to learn how wide the screen is before it
 * can draw the right navigation.
 *
 * Screens should not re-implement the chrome, the max-width or a spinner — they
 * render their content and pass `isLoading` / `isRefreshing` up to here, so
 * every view waits the same way.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  sidebar,
  nav,
  children,
  isLoading = false,
  isRefreshing = false,
  loadingLabel = "Loading",
  contained = true,
  className = "",
}) => {
  const s = themeSystem.appShell;

  return (
    <div className={`${s.root} ${className}`}>
      {sidebar}

      <div className={s.column}>
        {nav}

        <main
          className={
            // The tab bar is fixed, so the page has to end above it. That
            // clearance lives in `page` rather than being added here, and it is
            // dropped at `rail:` where there is no bar to clear.
            contained ? s.page(Boolean(nav)) : s.pageBleed
          }
        >
          {isLoading ? <UIPageLoader label={loadingLabel} /> : children}
        </main>
      </div>

      <UIOverlayLoader isOpen={!isLoading && isRefreshing} label={loadingLabel} />
    </div>
  );
};
