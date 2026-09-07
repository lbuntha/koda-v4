/**
 * Where a tapped notification puts you.
 *
 * The service worker has always sent the path — `notificationclick` posts
 * `KODA_NOTIFICATION_CLICK` to the open window — and until now nothing was
 * listening, so every tap focused Koda and left the reader wherever they
 * already were. A summary that cannot open the child it is about is most of a
 * summary missing.
 *
 * It is a map rather than a router on purpose. Koda's screens are state, not
 * URLs: `App.tsx` holds a tab and swaps components, and `docs/PWA.md` explains
 * why the worker serves `index.html` for every path. Adding a real router to
 * make one tap land correctly would change how every screen in the app is
 * reached, for a feature that needs to know about four of them. So the path in
 * a notification is treated as what it actually is — a short instruction from
 * our own server — and translated here.
 *
 * That framing is also the security boundary. `safePath` in the worker has
 * already refused anything that is not a path on our own origin; this refuses
 * anything that is not a destination we named. A payload arrives from the
 * network, and the set of screens it can reach is a list in the client, not a
 * string it gets to choose.
 */

/** The tabs a notification may open. A subset of `App.tsx`'s own union. */
import { noteNotificationOpened } from "./index";

export type LandingTab =
  | "home"
  | "children"
  | "profile"
  | "devices"
  | "settings"
  | "notifications";

export interface Landing {
  tab: LandingTab;
  /** The child whose record to open, for a path that named one. */
  learnerId?: string;
}

/** Where an unrecognised path goes, and the only path most kinds send today. */
const HOME: Landing = { tab: "home" };

/**
 * A learner id as this service writes them: `l_` and twenty hex characters.
 *
 * Matched rather than accepted, because the id goes on to open a record. A
 * pattern is not authorisation — the page still reads it through the family's
 * own scoped endpoint — but it keeps a malformed path from reaching one.
 */
const LEARNER_ID = /^l_[0-9a-f]{20}$/;

const TABS: Record<string, LandingTab> = {
  "": "home",
  children: "children",
  profile: "profile",
  devices: "devices",
  settings: "settings",
  // The reader's own list. A tap that cannot be placed more precisely still
  // has somewhere honest to go: the notification it came from is at the top of
  // it, with everything else Koda has said.
  notifications: "notifications",
};

/**
 * Read a notification's path as a destination.
 *
 * Never throws and never returns nothing: a tap that cannot be understood is a
 * tap that opens Koda, which is what it did before this file existed.
 */
export const landingFor = (path: string | undefined): Landing => {
  if (!path || typeof path !== "string") return HOME;

  // A path, never a URL. The worker has already rejected other origins; taking
  // only the pathname here means a value that slipped past it still cannot
  // carry a host into this map.
  const [first, second] = path.replace(/^https?:\/\/[^/]+/i, "").split("?")[0].split("#")[0]
    .split("/")
    .filter(Boolean);

  const tab = TABS[first ?? ""];
  if (!tab) return HOME;
  if (tab === "children" && second && LEARNER_ID.test(second)) {
    return { tab, learnerId: second };
  }
  return { tab };
};

/** The message the worker posts. Exported so both sides name it once. */
export const NOTIFICATION_CLICK = "KODA_NOTIFICATION_CLICK";

/**
 * Somebody tapped a notification *inside* the app — a row in the bell.
 *
 * The same event as a tap on a phone, deliberately. A notification is one
 * thing whether it is read on a lock screen or scrolled back to an hour later,
 * and "Mia met today's goal" should open Mia either way. Routing the two
 * through one listener is what stops the second one quietly becoming a list
 * that cannot be tapped — which is what it was.
 *
 * A window event rather than a prop threaded down through the nav: the bell
 * lives in `AppNav`, the screen state lives in `App`, and passing a callback
 * across that distance to say the same thing the worker already says is a
 * second way to express one idea.
 */
export const openNotification = (path: string | undefined, kind?: string): void => {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_CLICK, { detail: { path, kind } }));
};

/**
 * Listen for a tapped notification, from the worker or from the app itself.
 * Returns the unsubscribe.
 *
 * Registered from `App.tsx` rather than from the push module that owns the
 * token, because what a tap does is navigation, and navigation is the app's.
 */
export const onNotificationClick = (handle: (landing: Landing) => void): (() => void) => {
  /*
   * A tap is also the only thing that resets §9's self-limiting counter, so it
   * is reported here rather than at each call site — there are two of them and
   * a third would forget. Unawaited: opening a screen is the tap's job, and a
   * parent must never wait on our bookkeeping to reach their child's record.
   */
  const report = (kind: string | undefined) => {
    if (kind) void noteNotificationOpened(kind);
  };
  const fromWorker = (event: MessageEvent) => {
    const data = event.data as { type?: string; path?: string; kind?: string } | undefined;
    if (data?.type !== NOTIFICATION_CLICK) return;
    report(data.kind);
    handle(landingFor(data.path));
  };
  const fromApp = (event: Event) => {
    const detail = (event as CustomEvent<{ path?: string; kind?: string }>).detail;
    report(detail?.kind);
    handle(landingFor(detail?.path));
  };

  navigator.serviceWorker?.addEventListener("message", fromWorker);
  window.addEventListener(NOTIFICATION_CLICK, fromApp);
  return () => {
    navigator.serviceWorker?.removeEventListener("message", fromWorker);
    window.removeEventListener(NOTIFICATION_CLICK, fromApp);
  };
};
