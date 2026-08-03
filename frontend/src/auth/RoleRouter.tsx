/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Top-level router keyed on auth status + role:
 *   loading                 → splash
 *   anonymous               → AuthScreen (sign in / sign up)
 *   authenticated + admin   → AdminDashboard
 *   authenticated + parent  → ParentDashboard
 *   authenticated + teacher → App (studio)
 *   authenticated + student → App (auto-launches the game)
 *   offline (no VITE_API_URL) → App (today's localStorage mode, unchanged)
 */

import React, { Suspense, lazy, useState } from "react";
import { useAuth } from "./AuthContext";
import { ThemeProvider } from "../theme/appTheme";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Spinner, TopProgressBar } from "../components/ui";

/**
 * Every role gets a different surface, and no session needs more than one of them. Loading
 * them lazily is what keeps a six-year-old from downloading the curriculum studio, the SVG
 * designer and the analytics dashboard before they can count to ten — those were all in the
 * single entry chunk, which had grown past 1 MB.
 *
 * `named` unwraps a named export into the default shape `React.lazy` expects.
 */
const named = <T extends Record<string, any>, K extends keyof T>(
  load: () => Promise<T>,
  key: K,
) => lazy(() => load().then(module => ({ default: module[key] })));

const AuthScreen = named(() => import("./AuthScreen"), "AuthScreen");
const ResetPasswordScreen = named(() => import("./ResetPasswordScreen"), "ResetPasswordScreen");
const LandingPage = named(() => import("../landing/LandingPage"), "LandingPage");
const ParentDashboard = named(() => import("../parent/ParentDashboard"), "ParentDashboard");
const AdminDashboard = named(() => import("../admin/AdminDashboard"), "AdminDashboard");
const RoleConsole = named(() => import("../components/RoleConsole"), "RoleConsole");
const StudentCurriculumPlayer = named(
  () => import("../student/StudentCurriculumPlayer"), "StudentCurriculumPlayer",
);
const App = lazy(() => import("../App"));

const Splash: React.FC = () => (
  <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/80 p-4">
    <TopProgressBar loading={true} />
    <div className="relative h-28 w-28" aria-label="Koda is getting ready" role="status">
      <span className="absolute inset-3 animate-pulse rounded-[2rem] bg-violet-500/25 blur-2xl motion-reduce:animate-none" aria-hidden="true" />

      <span className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full motion-reduce:animate-none" aria-hidden="true">
        <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-[#F9C846] shadow-[0_0_14px_rgba(249,200,70,0.85)]" />
        <span className="absolute bottom-2 left-2 h-2.5 w-2.5 rounded-full bg-[#55B9F3] shadow-[0_0_12px_rgba(85,185,243,0.75)]" />
        <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-[#F378B8] shadow-[0_0_12px_rgba(243,120,184,0.75)]" />
      </span>

      <span className="absolute inset-0 flex items-center justify-center">
        <span className="animate-[bounce_2.2s_ease-in-out_infinite] motion-reduce:animate-none">
          <img
            src="/favicon.svg"
            alt="Koda"
            className="h-16 w-16 rounded-2xl shadow-[0_12px_32px_-8px_rgba(88,58,190,0.65)]"
          />
        </span>
      </span>

      <span className="absolute -bottom-1 left-1/2 h-2 w-14 -translate-x-1/2 animate-pulse rounded-full bg-violet-500/20 blur-sm motion-reduce:animate-none" aria-hidden="true" />
    </div>
    <div className="flex items-center gap-2.5 text-[#7252D8]">
      <Spinner size="md" variant="rainbow" glow />
      <span className="text-xs font-black tracking-wide">Getting things ready…</span>
    </div>
  </div>
);

const RoleScreen: React.FC = () => {
  const { status, role, refreshSession } = useAuth();
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  // An emailed reset link lands on a path this app can't otherwise reach. It is read before
  // auth status is considered: a locked-out parent is anonymous by definition, and one who
  // is still signed in elsewhere should be able to follow their own link too.
  const [resetToken, setResetToken] = useState<string | null>(() =>
    window.location.pathname === "/reset-password"
      ? new URLSearchParams(window.location.search).get("token") ?? ""
      : null,
  );

  const leaveReset = (signedIn?: boolean) => {
    // Drops the token from the address bar so it isn't re-spent on reload or left in history.
    window.history.replaceState({}, "", "/");
    setResetToken(null);
    setAuthMode("signin");
    if (signedIn) void refreshSession();
  };

  if (resetToken !== null) return <ResetPasswordScreen token={resetToken} onDone={leaveReset} />;

  if (status === "loading") return <Splash />;
  if (status === "anonymous") {
    if (authMode) {
      return (
        <AuthScreen
          initialMode={authMode}
          onBack={() => setAuthMode(null)}
          onForgotPassword={() => setResetToken("")}
        />
      );
    }
    return <LandingPage onSignIn={() => setAuthMode("signin")} onSignUp={() => setAuthMode("signup")} />;
  }

  if (status === "authenticated") {
    if (role === "admin" || role === "teacher") return <AdminDashboard />;
    if (role === "parent") return <ParentDashboard />;
    if (role === "student") return <StudentCurriculumPlayer />;
    // any other role (custom) → generic menu-driven console.
    return <RoleConsole />;
  }
  // offline mode (no VITE_API_URL) → studio as before
  return <App />;
};

/**
 * The provider only holds state — each page still opts into `dark` on its own root, so admin
 * and studio screens are unaffected by a learner's or parent's choice.
 */
export const RoleRouter: React.FC = () => (
  <ThemeProvider>
    {/* The splash already stands in for "deciding which screen you get", so it is the
        honest fallback while that screen's chunk arrives. */}
    {/* Outside Suspense: a chunk that fails to load throws too, and the boundary has to be
        able to catch that as well as a render error inside the screen. */}
    <ErrorBoundary surface="role-router">
      <Suspense fallback={<Splash />}>
        <RoleScreen />
      </Suspense>
    </ErrorBoundary>
  </ThemeProvider>
);
