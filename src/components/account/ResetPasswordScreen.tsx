import React, { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";

import { ApiError, request } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../ui";

/**
 * Choosing a new password from a link in an email.
 *
 * Shown *instead of* the sign-in gate, because somebody arriving here cannot get
 * past that gate — that is why they are here. It takes no session and calls one
 * unauthenticated route.
 *
 * The token comes off the URL and is never put anywhere else: not in state that
 * outlives the page, not in storage. When the reset succeeds the query string is
 * cleared, so a back button or a shared screenshot of the address bar does not
 * carry a live key — even though the server has already spent it.
 */

/** The token on the current URL, if this is a reset link. */
export const resetTokenFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    if (url.pathname !== "/reset") return null;
    return url.searchParams.get("token");
  } catch {
    return null;
  }
};

export interface ResetPasswordScreenProps {
  token: string;
  /** Back to the ordinary sign-in screen, with the link forgotten. */
  onDone(): void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ token, onDone }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password) return;
    if (password !== confirm) {
      setError("Those two do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request("/auth/password/reset", {
        method: "POST",
        body: { token, newPassword: password },
      });
      // The link is spent; take it off the address bar so nothing carries it.
      window.history.replaceState({}, "", "/");
      setDone(true);
    } catch (err) {
      const problem = err as ApiError;
      setError(
        problem.isOffline
          ? "No connection to the data service. Try again in a moment."
          : problem.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
            {done ? (
              <CheckCircle2 className="h-7 w-7 text-white" />
            ) : (
              <KeyRound className="h-7 w-7 text-white" />
            )}
          </div>
          <h1 className="font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {done ? "Password changed" : "Choose a new password"}
          </h1>
          <p className="mx-auto max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {done
              ? "You can sign in with it now. Everything that was signed in before has been signed out."
              : "This link works once. Pick something you will remember."}
          </p>
        </div>

        <div className={themeSystem.card("default", "p-5 sm:p-6")}>
          {done ? (
            <UIButton variant="primary" className="w-full" onClick={onDone}>
              Go to sign in
            </UIButton>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="koda-admin-label text-ink">New password</span>
                <input
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- the page exists to be typed in
                  autoFocus
                  className={field}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="koda-admin-label text-ink">Again</span>
                <input
                  className={field}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  disabled={busy}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400"
                >
                  {error}
                </p>
              )}

              <UIButton
                variant="primary"
                type="submit"
                className="w-full"
                isLoading={busy}
                disabled={!password || !confirm}
              >
                Set new password
              </UIButton>
              <button
                type="button"
                onClick={onDone}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
