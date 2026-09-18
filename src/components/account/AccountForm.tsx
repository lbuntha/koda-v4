import React, { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, MailCheck, RefreshCw, UserPlus } from "lucide-react";

import { ApiError, SessionAPI, request } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";

export type AccountMode = "signIn" | "signUp";
type SignupType = "parent" | "student";
type LoginMethod = "email" | "childCode";

/**
 * The 48px row, because this is the one screen a parent types a password into,
 * often on a phone, and 40px targets are where mis-taps come from. The rule
 * itself is `themeSystem.field` — this screen was where it was first written.
 */
const field = themeSystem.field("md");

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
const GOOGLE_SCRIPT_ID = "google-identity-services";
let googleScript: Promise<void> | null = null;

/** Load Google's public button code only on a screen that can use it. */
function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  if (googleScript) return googleScript;

  googleScript = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const loaded = () => window.google?.accounts.id
      ? resolve()
      : reject(new Error("Google Identity Services did not load."));

    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Identity Services could not load.")), { once: true });
    if (!existing) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    // A transient offline failure should be retryable the next time this form mounts.
    googleScript = null;
    throw error;
  });
  return googleScript;
}

/*
 * A stand-in for Google's button, drawn to the same specification.
 *
 * Google's button is an iframe fetched from their servers, so on a cold load
 * there is a stretch — a whole second on a bad connection — where the form has
 * a hole in it, and then a button lands in the hole. Reserving the height with
 * `min-h-10` fixed the layout jump but not that: an empty reserved box still
 * fills in visibly.
 *
 * So the box is not empty. These are the numbers Google's own stylesheet uses
 * for `theme: "outline"` at `size: "large"` — 40px tall, 4px corners, a
 * #dadce0 hairline, #3c4043 label at 14px/500, an 18px mark — which is what
 * makes the handover invisible rather than merely quick. If Google restyles
 * their button, this is the thing to re-measure.
 *
 * It is `aria-hidden` and not focusable: there is nothing to operate yet, and
 * the email form below is usable the whole time this waits.
 */
const GoogleButtonSkeleton: React.FC = () => (
  <div
    aria-hidden
    className="pointer-events-none flex h-10 w-full items-center justify-center gap-2 rounded border border-[#dadce0] bg-white"
  >
    {/* Google's mark, from their brand guidelines. Inline because one more
        network round trip is the opposite of the point. */}
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
    <span className="font-sans text-sm font-medium text-[#3c4043]">Continue with Google</span>
  </div>
);

const GoogleSignInButton: React.FC<{
  busy: boolean;
  onCredential: (credential: string) => void;
  onUnavailable: () => void;
}> = ({ busy, onCredential, onUnavailable }) => {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const unavailable = useRef(onUnavailable);
  callback.current = onCredential;
  unavailable.current = onUnavailable;
  /*
   * `ready` means painted, not requested.
   *
   * The first attempt at this revealed the button as soon as `renderButton`
   * returned, which is why it changed nothing: that call only *schedules* the
   * iframe. Google's code then creates it, fetches its document and paints it,
   * and all of that happens after the function has come back. Revealing there
   * swaps the stand-in for a blank frame and lets the real button pop in
   * afterwards — the original flash, with an extra step in front of it.
   *
   * The iframe's own `load` event is the honest signal, and it is readable
   * cross-origin. Two frames after it, the button has been painted.
   */
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!clientId || !host.current) return;
    const mount = host.current;
    let live = true;
    let watcher: MutationObserver | null = null;
    let fallback: number | undefined;

    const reveal = () => {
      if (!live) return;
      requestAnimationFrame(() => requestAnimationFrame(() => live && setReady(true)));
    };

    /* Google may create the iframe during `renderButton` or a tick later, so
       take it whenever it appears rather than assuming it is already there. */
    const watchFor = (frame: HTMLIFrameElement) => {
      watcher?.disconnect();
      watcher = null;
      frame.addEventListener("load", reveal, { once: true });
    };

    void loadGoogleIdentity()
      .then(() => {
        if (!live || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callback.current(response.credential),
        });
        mount.replaceChildren();
        window.google.accounts.id.renderButton(mount, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          // One label for both modes, deliberately.
          //
          // Saying "Sign up with" on one tab and "Sign in with" on the other
          // meant re-rendering Google's iframe every time somebody switched —
          // which is the blink you see: the button is destroyed and rebuilt
          // under the cursor. "Continue with" is true on both tabs, and Google
          // treats the two the same way anyway: a new account or an old one,
          // depending on the address.
          text: "continue_with",
          width: Math.min(400, Math.max(240, mount.clientWidth)),
        });

        const existing = mount.querySelector("iframe");
        if (existing) watchFor(existing);
        else {
          watcher = new MutationObserver(() => {
            const frame = mount.querySelector("iframe");
            if (frame) watchFor(frame);
          });
          watcher.observe(mount, { childList: true, subtree: true });
        }

        /* Whatever happens to the load event, the stand-in must not become
           permanent: a button nobody can press is worse than a swap nobody
           was supposed to notice. */
        fallback = window.setTimeout(reveal, 2500);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        unavailable.current();
      });

    return () => {
      live = false;
      watcher?.disconnect();
      window.clearTimeout(fallback);
    };
    // Rendered once per mount: nothing about the form's state changes the
    // button, so nothing about the form's state may rebuild it.
  }, []);

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()) return null;
  /*
   * Both layers in one grid cell, so they occupy the same 40px without either
   * being taken out of flow — the box is the right height from the first frame
   * whether or not anything has loaded. The height is held only while there is
   * still something to hold it for: once Google is known to be unreachable the
   * box collapses and the notice under it moves up, rather than leaving 40px
   * of nothing above an explanation of the nothing.
   *
   * The swap is instant rather than a cross-fade: the two are drawn to the
   * same specification, so there is nothing to ease between, and a fade over
   * near-identical layers is a shimmer where there was meant to be nothing.
   */
  return (
    <div
      className={`grid w-full justify-items-center ${failed ? "" : "min-h-10"} ${busy ? "pointer-events-none opacity-60" : ""}`}
      aria-busy={busy}
    >
      {!ready && !failed && (
        <div className="col-start-1 row-start-1 w-full max-w-[400px]">
          <GoogleButtonSkeleton />
        </div>
      )}
      <div
        ref={host}
        className={`col-start-1 row-start-1 w-full max-w-[400px] ${ready ? "" : "invisible"}`}
      />
    </div>
  );
};

export const AccountForm: React.FC<AccountFormProps> = ({ onSignedIn, autoFocus = false }) => {
  const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());
  const [mode, setMode] = useState<AccountMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  /*
   * Who is signing up: somebody setting Koda up for children, or somebody
   * learning on their own.
   *
   * A student gets a learner row, their own record and their own settings — the
   * server has always built that; the choice was simply not offered. What a
   * student then meets is the same course, which still opens at counting, so
   * the option says "working on your own" rather than promising a syllabus for
   * a teenager. Settings → Your learning lets them skip ahead on day one.
   */
  const [signupType, setSignupType] = useState<SignupType>("parent");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [joinCode, setJoinCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

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

  const resendVerification = async () => {
    if (!verificationEmail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await SessionAPI.resendVerification(verificationEmail);
      // Deliberately generic: the API does not reveal whether an address is
      // registered, and the UI keeps that same privacy boundary.
      setVerificationSent(true);
    } catch (err) {
      const problem = err as ApiError;
      setError(problem.isOffline ? "No connection. Try again in a moment." : problem.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      if (mode === "signUp") {
        const result = await SessionAPI.signUp(
          email.trim(),
          password,
          signupType === "parent" ? familyName.trim() || "My family" : "My learning space",
          signupType,
        );
        if ("verificationRequired" in result) {
          setVerificationEmail(result.email);
          setVerificationSent(result.emailSent);
          if (!result.emailSent) {
            setError("We could not send the first message. Check the address, then send a new link.");
          }
          setPassword("");
          return;
        }
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
      if (problem.code === "email_not_verified" && email.trim()) {
        setVerificationEmail(email.trim());
        setVerificationSent(false);
        setPassword("");
        return;
      }
      setError(
        problem.isOffline
          ? "No connection to the data service. Your work is saved on this device either way."
          : problem.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async (credential: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await SessionAPI.signInWithGoogle(
        credential,
        mode === "signUp",
        familyName.trim() || undefined,
      );
      playSound("pop");
      onSignedIn?.();
    } catch (err) {
      const problem = err as ApiError;
      setError(
        problem.isOffline
          ? "Google sign-in needs a connection. Your saved work is still on this device."
          : problem.message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (verificationEmail) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-sm">
          <MailCheck className="h-7 w-7 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black tracking-tight text-ink">Check your email</h2>
          <p className="text-sm leading-relaxed text-muted">
            {verificationSent ? "Open the verification link sent to " : "Send a verification link to "}
            <strong className="text-ink">{verificationEmail}</strong>. It works once and expires
            after 24 hours.
          </p>
        </div>

        {verificationSent && (
          <p role="status" className={themeSystem.flash("success", "text-sm text-left")}>
            A verification link is on its way. Check spam if it does not appear soon.
          </p>
        )}
        {error && (
          <p role="alert" className={themeSystem.flash("error", "text-sm text-left")}>
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void resendVerification()}
          className={themeSystem.button("secondary", "md", "w-full")}
        >
          <RefreshCw className={busy ? "animate-spin" : ""} />
          {busy ? "Sending…" : "Send a new link"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setVerificationEmail(null);
            setVerificationSent(false);
            setError(null);
            setMode("signIn");
          }}
          className="w-full text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Back to sign in
        </button>
      </div>
    );
  }

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
      {/* Hidden rather than unmounted on the child-code path: taking the
          Google button out of the tree and putting it back rebuilds its iframe,
          which is the same blink as re-rendering it on a tab switch. */}
      {googleConfigured && (
        <div
          data-google-block
          className={`space-y-3 ${mode === "signIn" && loginMethod === "childCode" ? "hidden" : ""}`}
        >
          <GoogleSignInButton
            busy={busy}
            onCredential={(credential) => void googleSignIn(credential)}
            onUnavailable={() => setGoogleUnavailable(true)}
          />

          {googleUnavailable && (
            <p
              role="status"
              className={themeSystem.flash("warning", "text-sm")}
            >
              Google sign-in could not load. Check your connection or use email below.
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
        {mode === "signUp" && (
          <div className="space-y-1.5">
            <Segmented
              label="Who is this account for"
              size="sm"
              value={signupType}
              options={[
                ["parent", "For my children"],
                ["student", "For myself"],
              ]}
              onChange={(value) => setSignupType(value as SignupType)}
            />
            <p className="text-xs leading-relaxed text-muted">
              {signupType === "parent"
                ? "You add each child, and set their goals and limits."
                : "Your own space, with nobody above it. You set your own goal and limits, and Koda starts at counting — skip ahead in Settings."}
            </p>
          </div>
        )}

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
              /* A 44px target, because on a phone this sits beside a field a
                 thumb is already aiming at, and tokens rather than slate so it
                 is the same grey in both themes. */
              className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink transition cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>}

        {sentTo && (
          <p role="status" className={themeSystem.flash("success", "text-sm")}>
            If <strong>{sentTo}</strong> has an account, a reset link is on its way. It works
            once and expires in 30 minutes.
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
              placeholder="My family, Class 2B, Grandma's house"
              onChange={(e) => setFamilyName(e.target.value)}
              className={field}
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              The name for all your children's accounts. You can change it later.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className={themeSystem.flash("error", "text-sm")}>
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
