import React, { useState } from "react";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { authApi } from "../api/auth";

/**
 * The two halves of password recovery: asking for a link, and spending one.
 *
 * Which half shows is decided by whether the URL carries a token, so the same screen serves
 * "I forgot" and the link that arrives by email.
 *
 * The request half never says whether an address has an account — the server deliberately
 * answers identically either way, and a UI that said "no such account" would undo that.
 */
export const ResetPasswordScreen: React.FC<{
  token?: string | null;
  /** `signedIn` is true when a reset just succeeded and its tokens are already stored. */
  onDone: (signedIn?: boolean) => void;
}> = ({ token, onDone }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (cause) {
      // A throttled request is the one failure worth naming — it tells the user to wait
      // rather than leaving them retrying into a wall.
      setError(cause instanceof Error ? cause.message : "Could not send the link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const setNewPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Confirming returns a token pair, so the parent lands signed in rather than being
      // asked for the password they just chose.
      await authApi.confirmPasswordReset(token!, password);
      onDone(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This reset link is invalid or has expired.",
      );
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-xl border border-[#E7E3F6] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0E0B55] outline-none focus:border-[#7C6DD8] focus:ring-2 focus:ring-indigo-500/20";
  const primary =
    "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6346F1] px-4 py-2.5 text-sm font-extrabold text-white transition-all hover:bg-[#5235E0] disabled:opacity-60";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBFAFF] p-5">
      <div className="w-full max-w-sm rounded-3xl border border-[#E7E3F6] bg-white p-7 shadow-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7]">
          {sent ? <MailCheck size={20} /> : <KeyRound size={20} />}
        </span>

        {token ? (
          <>
            <h1 className="mt-4 text-lg font-black text-[#0E0B55]">Choose a new password</h1>
            <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">
              This link works once. Signing in elsewhere will need the new password.
            </p>
            <form onSubmit={setNewPassword} className="mt-5 space-y-3">
              <input
                type="password"
                autoFocus
                required
                minLength={8}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="New password (at least 8 characters)"
                className={field}
              />
              <button type="submit" disabled={busy || password.length < 8} className={primary}>
                {busy && <Loader2 size={16} className="animate-spin" />} Set password
              </button>
            </form>
          </>
        ) : sent ? (
          <>
            <h1 className="mt-4 text-lg font-black text-[#0E0B55]">Check your email</h1>
            {/* Phrased so it stays true whether or not the address has an account. */}
            <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">
              If <strong>{email}</strong> has a Koda account, a reset link is on its way. It
              works once and expires in an hour.
            </p>
            <button type="button" onClick={() => onDone()} className={`${primary} mt-5`}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-lg font-black text-[#0E0B55]">Reset your password</h1>
            <p className="mt-1 text-xs leading-relaxed text-[#6D6997]">
              We’ll email you a link to choose a new one.
            </p>
            <form onSubmit={requestLink} className="mt-5 space-y-3">
              <input
                type="email"
                autoFocus
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={field}
              />
              <button type="submit" disabled={busy || !email.trim()} className={primary}>
                {busy && <Loader2 size={16} className="animate-spin" />} Email me a link
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}

        {!sent && (
          <button
            type="button"
            onClick={() => onDone()}
            className="mt-4 w-full text-xs font-bold text-[#6D6997] hover:text-[#534AB7]"
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
};
