import React, { Suspense, lazy } from "react";

import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { UIPageLoader } from "./components/ui";

/*
 * Pages fetched when they are opened rather than shipped to everybody.
 *
 * Moved out of `App.tsx` unchanged; see the note on the operator pages below.
 */
export const NotificationsPage = lazy(() =>
  import("./components/account/NotificationsPage").then((m) => ({
    default: m.NotificationsPage,
  })),
);

/*
 * The operator's pages, fetched when one is opened rather than shipped to
 * everybody.
 *
 * These seven are the largest components in the app and the least used: the
 * Skill Manager alone is bigger than every learner-facing page put together,
 * and a five-year-old counting rockets downloaded all of it to render a screen
 * they have no right to open. Splitting them here costs an admin one fetch the
 * first time they open a page and saves every learner the whole weight.
 *
 * Gated *and* split: the `can(...)` checks below are unchanged, because a chunk
 * that is merely hard to fetch is not a permission. The split is about bytes;
 * the server is what refuses the data.
 *
 * Named exports, so each import is mapped onto the default a lazy chunk must
 * expose. `SkillManagerPage` is already imported this way by the round's top
 * bar for its Activity trail — with the eager import gone, that lazy import and
 * this one resolve to the same chunk instead of pinning the module into the
 * main bundle.
 */
export const SkillManagerPage = lazy(() =>
  import("./components/skills/SkillManagerPage").then((m) => ({ default: m.SkillManagerPage })),
);
export const GuestRoomScreen = lazy(() => import("./rebus/group/GuestRoomScreen").then((m) => ({ default: m.GuestRoomScreen })));
export const RebusPage = lazy(() => import("./rebus/RebusPage").then((m) => ({ default: m.RebusPage })));
export const RebusStudio = lazy(() => import("./rebus/studio/RebusStudio").then((m) => ({ default: m.RebusStudio })));
export const TraceStudio = lazy(() => import("./trace/studio/TraceStudio").then((m) => ({ default: m.TraceStudio })));
export const LibraryStudio = lazy(() => import("./library/studio/LibraryStudio").then((m) => ({ default: m.LibraryStudio })));
export const SvgAssetsPage = lazy(() =>
  import("./components/SvgAssetsPage").then((m) => ({ default: m.SvgAssetsPage })),
);
export const UsersPage = lazy(() =>
  import("./components/account/UsersPage").then((m) => ({ default: m.UsersPage })),
);
export const RolesPage = lazy(() =>
  import("./components/account/RolesPage").then((m) => ({ default: m.RolesPage })),
);
export const MenuPage = lazy(() =>
  import("./components/account/MenuPage").then((m) => ({ default: m.MenuPage })),
);
export const AdminPage = lazy(() =>
  import("./components/account/AdminPage").then((m) => ({ default: m.AdminPage })),
);
export const TranslationsPage = lazy(() => import("./components/account/TranslationsPage").then((m) => ({ default: m.TranslationsPage })));
export const SubjectsPage = lazy(() => import("./components/account/SubjectsPage").then((m) => ({ default: m.SubjectsPage })));
export const DataCleanupPage = lazy(() =>
  import("./components/account/DataCleanupPage").then((m) => ({ default: m.DataCleanupPage })),
);
export const KodaPage = lazy(() =>
  import("./components/account/KodaPage").then((m) => ({ default: m.KodaPage })),
);
export const LeaderboardPage = lazy(() =>
  import("./components/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })),
);

/**
 * The wait, while one of those chunks arrives.
 *
 * One boundary per page slot rather than one around the whole tab area: a
 * shared boundary would blank the operator's notice and every sibling tab for
 * the fraction of a second a fetch takes, and a page that fails to load would
 * take its neighbours down with it.
 */
export const Deferred: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <AppErrorBoundary>
    <Suspense fallback={<UIPageLoader label={label} />}>{children}</Suspense>
  </AppErrorBoundary>
);
