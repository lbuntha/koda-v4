/**
 * Whether this browser can be rung at all, and if not, what to say about it.
 *
 * Six answers rather than a boolean, because "no" has several meanings and only
 * one of them is a dead end. A parent in a Safari tab on an iPhone is not using
 * a browser that cannot do this — they are one gesture away, and a screen that
 * says "not supported" to them is wrong.
 */

export type PushSupport =
  /** Everything is in place and permission has not been asked for yet. */
  | { state: "askable" }
  /** Already granted; a token can be minted without prompting. */
  | { state: "granted" }
  /** Refused. The browser will not ask again, so neither do we. */
  | { state: "denied" }
  /** iOS, in a tab. Web push there needs the app on the Home Screen. */
  | { state: "needs-install" }
  /** No service worker, no Notification API, or no push at all. */
  | { state: "unsupported" }
  /** This deployment has not been given a Firebase project. */
  | { state: "not-configured" };

export interface FirebaseWebConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  messagingSenderId: string;
  vapidKey: string;
}

/**
 * The public identifiers Vite baked into the bundle.
 *
 * None of these is a secret — they are the same class of thing as
 * `VITE_GOOGLE_CLIENT_ID`, which is why they can live in a browser bundle at
 * all. Absent means this deployment has not configured push, and every screen
 * below should say so rather than offer a switch that cannot work.
 */
export function firebaseConfig(): FirebaseWebConfig | null {
  const env = import.meta.env;
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    vapidKey: env.VITE_FIREBASE_VAPID_KEY,
  };

  return Object.values(config).every((value) => typeof value === "string" && value)
    ? (config as FirebaseWebConfig)
    : null;
}

/** iOS and iPadOS, including iPads that report themselves as a Mac with touch. */
function isApple(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
}

/** Whether the app is running as an installed app rather than in a tab. */
function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own flag, which predates the media query.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  if (!firebaseConfig()) return { state: "not-configured" };

  const hasApis =
    typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  // On iOS the push APIs only exist once the app is on the Home Screen, so this
  // check has to come first: otherwise the honest "add it to your Home Screen"
  // is reported as the dead end "your browser cannot do this".
  if (isApple() && !isInstalled()) return { state: "needs-install" };
  if (!hasApis) return { state: "unsupported" };

  if (Notification.permission === "granted") return { state: "granted" };
  if (Notification.permission === "denied") return { state: "denied" };
  return { state: "askable" };
}
