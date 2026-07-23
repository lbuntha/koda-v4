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

import React from "react";
import { Crown, Loader2 } from "lucide-react";
import { useAuth } from "./AuthContext";
import { AuthScreen } from "./AuthScreen";
import { ParentDashboard } from "../parent/ParentDashboard";
import { AdminDashboard } from "../admin/AdminDashboard";
import { RoleConsole } from "../components/RoleConsole";
import App from "../App";
import { StudentCurriculumPlayer } from "../student/StudentCurriculumPlayer";

const Splash: React.FC = () => (
  <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-indigo-50 via-white to-violet-50">
    <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
      <Crown size={26} />
    </div>
    <Loader2 size={20} className="animate-spin text-indigo-400" />
  </div>
);

export const RoleRouter: React.FC = () => {
  const { status, role } = useAuth();

  if (status === "loading") return <Splash />;
  if (status === "anonymous") return <AuthScreen />;

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
