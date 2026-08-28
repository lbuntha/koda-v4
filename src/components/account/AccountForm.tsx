import React, { useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, UserPlus } from "lucide-react";

import { ApiError, SessionAPI, request } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";

export type AccountMode = "signIn" | "signUp";
type SignupType = "parent" | "student";
type LoginMethod = "email" | "childCode";

/**
 * One input, drawn from the theme rather than from slate shades.
 *
 * The old rule hardcoded `bg-white dark:bg-slate-800 border-slate-200 …`, which
 * is the thing `index.css` asks components not to do: it is a second definition
 * of the surface, and it drifts the moment the palette moves. Tokens make the
 * field theme-correct without a `dark:` variant per property.
 *
 * Taller than it was (h-12): this is the one screen a parent types a password
 * into, often on a phone, and 40px targets are where mis-taps come from.
 */
const field =
  "w-full h-12 bg-surface border-2 border-line rounded-xl px-3.5 text-[15px] text-ink " +
  "placeholder:text-muted/70 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 " +
  "outline-none transition disabled:opacity-60";

const labelClass = "block text-sm font-bold text-ink mb-1.5";

/**
 * A segmented control: one track, the choices inside it.
 *
 * The two choices used to be separate pills sitting side by side, which reads as
 * two unrelated buttons — and stacking a second row of them under the first made
 * the top of the form four competing buttons before a single field. A shared
 * track says "pick one of these" without any of them shouting.
 */
const Segmented: React.FC<{
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  size?: "md" | "sm";
}> = ({ label, value, options, onChange, size = "md" }) => (
  <div
    role="tablist"
    aria-label={label}
    className="flex gap-1 rounded-xl bg-surface-muted p-1"
  >
    {options.map(([id, text]) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={value === id}
        onClick={() => onChange(id)}
        className={`flex-1 rounded-lg font-bold transition cursor-pointer ${
          size === "sm" ? "py-1.5 text-xs" : "py-2 text-sm"
        } ${
          value === id
            ? "bg-surface text-ink shadow-sm"
            : "text-muted hover:text-ink"
        }`}
      >
        {text}
      </button>
    ))}
  </div>
);

export interface AccountFormProps {
  /** Called after the session exists, so a screen can leave itself. */
  onSignedIn?: () => void;
  autoFocus?: boolean;
}

/**
 * The credentials form itself, with no opinion about where it sits.
 *
 * Shared by the Settings card and the full sign-in screen so there is one set
 * of validation rules and one set of error sentences — two copies of a login
 * form is how two different messages for the same failure happen.
 */
/**
 * Sign in with a provider a parent already has.
 *
 * Present but not wired: the buttons exist so the shape of the screen is right
 * and so the work left is visible, and they say so when pressed rather than
 * doing nothing. A dead control that swallows a tap is worse than no control —
 * a parent assumes it failed and tries again.
 *
 * The marks are inline SVG. Both brands require their own logo, and a strict CSP
 * blocks fetching them from a CDN, so they are drawn here.
 */
const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
  </svg>
);

const FacebookMark = () => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.8V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12Z"
    />
  </svg>
);

const SOCIAL = [
  ["Google", GoogleMark],
  ["Facebook", FacebookMark],
] as const;

export const AccountForm: React.FC<AccountFormProps> = ({ onSignedIn, autoFocus = false }) => {
  const [mode, setMode] = useState<AccountMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  /*
   * Every signup here creates a parent.
   *
   * The `student` account — an older learner with their own sign-in and nobody
   * above them — works end to end on the server: they get a learner row, their
   * own record, and their own settings. It is not offered because the *content*
   * does not serve them yet; the course tops out around age eight, so somebody
   * choosing "Student" would get a first lesson counting to ten.
   *
   * Restoring the choice is putting the two buttons back and letting this be
   * state again. Nothing behind it was removed.
   */
  const signupType: SignupType = "parent";
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [joinCode, setJoinCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  /** Which provider was tapped, so the screen can say it is not ready yet. */
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  /**
   * Ask for a reset link.
   *
   * The confirmation is the same whether or not that address has an account,
   * because the server's answer is — telling somebody "no account here" would
   * turn this into a way to find out which families exist.
   */
  const forgot = async () => {
    if (!email.trim()) {
      setError("Type your email first, then ask for a link.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request("/auth/password/forgot", {
        method: "POST",
        body: { email: email.trim() },
      });
      setSentTo(email.trim());
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

  const switchMode = (next: AccountMode) => {
    setMode(next);
    setError(null);
    setPassword("");
    playSound("pop");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      if (mode === "signUp") {
        await SessionAPI.signUp(
          email.trim(),
          password,
          signupType === "parent" ? familyName.trim() || "My family" : "My learning space",
          signupType,
        );
      } else if (loginMethod === "childCode") {
        await SessionAPI.join(joinCode);
      } else {
        await SessionAPI.signIn(email.trim(), password);
      }
      playSound("pop");
      setPassword("");
      onSignedIn?.();
    } catch (err) {
      const problem = err as ApiError;
      setError(
        problem.isOffline
          ? "No connection to the data service. Your work is saved on this device either way."
          : problem.message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Segmented
        label="Account"
        value={mode}
        options={[
          ["signIn", "Sign in"],
          ["signUp", "Create account"],
        ]}
        onChange={(v) => switchMode(v as AccountMode)}
      />

      {/*
       * Providers first, then the divider, then email.
       *
       * A parent who has a Google account is one tap from being in; putting that
       * below the form makes them fill it in before noticing. Hidden for the
       * child-code path, which is a different kind of credential entirely — a
       * child on a shared tablet has no Google account to offer.
       */}
      {!(mode === "signIn" && loginMethod === "childCode") && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {SOCIAL.map(([name, Mark]) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setError(null);
                  setPendingProvider(name);
                  playSound("pop");
                }}
                className="flex h-12 items-center justify-center gap-2.5 rounded-xl border-2 border-line bg-surface text-sm font-bold text-ink transition hover:bg-surface-muted active:scale-[0.98] cursor-pointer"
              >
                <Mark />
                {name}
              </button>
            ))}
          </div>

          {pendingProvider && (
            <p
              role="status"
              className="rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              {pendingProvider} sign-in is coming soon. For now, use your email below.
            </p>
          )}

          {/* A labelled rule, so the two routes read as alternatives rather than
              as steps one after the other. */}
          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-semibold text-muted">or use email</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">


        {mode === "signIn" && loginMethod === "childCode" ? (
          <div>
            <label className={labelClass} htmlFor="account-join-code">
              Child code
            </label>
            <input
              id="account-join-code"
              type="text"
              required
              minLength={8}
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="one-time-code"
              value={joinCode}
              disabled={busy}
              placeholder="ABCD2345"
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
              className={`${field} font-mono tracking-[0.25em] uppercase`}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Ask a parent for their 8-character code. It works once, within 15 minutes.
            </p>
          </div>
        ) : <div>
          <label className={labelClass} htmlFor="account-email">
            Email
          </label>
          <input
            id="account-email"
            type="email"
            required
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the screen exists to be typed in
            autoFocus={autoFocus}
            autoComplete="email"
            value={email}
            disabled={busy}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </div>}

        {!(mode === "signIn" && loginMethod === "childCode") && <div>
          {/* The reset link belongs on the password's own row: it is where every
              other product puts it, so it is where a parent looks — and it was
              previously an 11px sentence stranded between the field and the
              submit button, competing with neither and found by nobody. */}
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <label className="block text-sm font-bold text-ink" htmlFor="account-password">
              Password
            </label>
            {mode === "signIn" && loginMethod === "email" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void forgot()}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 underline-offset-2 hover:underline transition cursor-pointer disabled:opacity-60"
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="account-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              value={password}
              disabled={busy}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              className={`${field} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>}

        {sentTo && (
          <p className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            If <strong>{sentTo}</strong> has an account, a reset link is on its way.
          </p>
        )}

        {mode === "signUp" && signupType === "parent" && (
          <div>
            {/*
             * "Family" is not everybody.
             *
             * The account holds the children's accounts — which for a tutor is a
             * group, for a grandparent is not their household, and for one adult
             * with one child is barely a name at all. The field was already
             * optional in code (it falls back to "My family"), but the form gave
             * no sign of that: a required-looking box asking for something a
             * person may not have is where a signup gets abandoned.
             */}
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <label className="block text-sm font-bold text-ink" htmlFor="account-family">
                Family or group name
              </label>
              <span className="text-xs font-semibold text-muted">Optional</span>
            </div>
            <input
              id="account-family"
              type="text"
              maxLength={60}
              value={familyName}
              disabled={busy}
              placeholder="The Riveras, Class 2B, Grandma's house…"
              onChange={(e) => setFamilyName(e.target.value)}
              className={field}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              What the children's accounts sit under. You can rename it later.
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-900/60 rounded-xl px-3 py-2"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className={themeSystem.button("primary", "lg", "w-full")}
        >
          {mode === "signUp" ? <UserPlus /> : loginMethod === "childCode" ? <KeyRound /> : <LogIn />}
          {busy ? "Working…" : mode === "signUp" ? "Create account" : loginMethod === "childCode" ? "Join this device" : "Sign in"}
        </button>

        {/*
         * The child-code route, offered as a sentence rather than a tab.
         *
         * It used to be half of a segmented control at the top, which gave a
         * minority path equal billing with the one nearly everybody takes — and
         * stacked a third row of switches above the first field. A parent signing
         * in with email never has to read it; a child handed a code finds it
         * exactly where they would look for something unusual.
         */}
        {mode === "signIn" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLoginMethod(loginMethod === "email" ? "childCode" : "email");
              setError(null);
              setPendingProvider(null);
              playSound("pop");
            }}
            className="w-full text-center text-sm font-semibold text-muted hover:text-ink transition cursor-pointer disabled:opacity-60"
          >
            {loginMethod === "email" ? "Signing in a child? Use a child code" : "Back to email sign-in"}
          </button>
        )}
      </form>
    </div>
  );
};
