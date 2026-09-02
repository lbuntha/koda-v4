import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, MailCheck } from "lucide-react";

import { ApiError, SessionAPI } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../ui";

/** The token on the current URL, if this is an email-verification link. */
export const verificationTokenFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    if (url.pathname !== "/verify-email") return null;
    return url.searchParams.get("token");
  } catch {
    return null;
  }
};

export interface VerifyEmailScreenProps {
  token: string;
  /** Leave the one-time URL after success or failure. */
  onDone(): void;
}

/** Spend an emailed token, activate the resulting session, and explain the result. */
export const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({ token, onDone }) => {
  const started = useRef(false);
  const [busy, setBusy] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // React's development StrictMode runs effects twice. A verification token
    // is intentionally single-use, so it must only leave this browser once.
    if (started.current) return;
    started.current = true;

    void SessionAPI.verifyEmail(token)
      .then(() => {
        window.history.replaceState({}, "", "/");
        setVerified(true);
      })
      .catch((err: unknown) => {
        const problem = err as ApiError;
        setError(
          problem.isOffline
            ? "No connection to the data service. Try this link again when you are online."
            : problem.message,
        );
      })
      .finally(() => setBusy(false));
  }, [token]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
          {verified ? (
            <CheckCircle2 className="h-7 w-7 text-white" />
          ) : (
            <MailCheck className="h-7 w-7 text-white" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {busy ? "Verifying your email…" : verified ? "Email verified" : "Link not accepted"}
          </h1>
          <p className="mx-auto max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {busy
              ? "This will only take a moment."
              : verified
                ? "Your Koda account is ready and you are signed in."
                : error ?? "This link is invalid or has expired."}
          </p>
        </div>

        {!busy && (
          <div className={themeSystem.card("default", "p-5 sm:p-6")}>
            <UIButton variant="primary" className="w-full" onClick={onDone}>
              {verified ? "Continue to Koda" : "Back to sign in"}
            </UIButton>
          </div>
        )}
      </div>
    </div>
  );
};
