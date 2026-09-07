import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsAreOn, refreshNotificationToken } from "./index";

/**
 * The switch, and why it is not bound to the browser's permission.
 *
 * Permission is granted once and stays granted: a site cannot withdraw its own.
 * Reading it as "notifications are on" makes the switch spring back the instant
 * somebody turns it off, and makes the next launch re-register a browser whose
 * owner had just opted out.
 */

const TOKEN_KEY = "koda_push_token_v1";

function permission(state: NotificationPermission) {
  vi.stubGlobal("Notification", { permission: state });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("whether this browser is signed up", () => {
  it("is off when permission was granted but nothing is registered", () => {
    permission("granted");

    expect(notificationsAreOn()).toBe(false);
  });

  it("is on only once a token has been stored", () => {
    permission("granted");
    localStorage.setItem(TOKEN_KEY, "a-registration-token");

    expect(notificationsAreOn()).toBe(true);
  });

  it("is off when the browser is blocking, whatever was stored before", () => {
    permission("denied");
    localStorage.setItem(TOKEN_KEY, "a-registration-token");

    expect(notificationsAreOn()).toBe(false);
  });
});

describe("the launch-time refresh", () => {
  it("leaves an opted-out browser alone", async () => {
    // The bug this guards: refreshing on permission alone re-registers the
    // browser of somebody who turned notifications off, on their next launch.
    permission("granted");
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);

    await refreshNotificationToken();

    expect(fetched).not.toHaveBeenCalled();
  });
});

/**
 * Why a registration failed, kept rather than collapsed.
 *
 * Five different things stop a browser registering, and they used to arrive at
 * the screen as one word — which the switch then discarded, so a parent pressed
 * it, nothing moved, and nothing was said. These assert that the reason
 * survives, because it is the only thing that tells "press it again in a
 * minute" apart from "the Web Push certificate is from the wrong project".
 */
/**
 * Why a registration failed, kept rather than collapsed.
 *
 * Five different things stop a browser registering, and they used to arrive at
 * the screen as one word — which the switch then discarded, so a parent pressed
 * it, nothing moved, and nothing was said. What these assert is that the reason
 * survives, because it is the only thing that tells "press it again in a
 * minute" apart from "the Web Push certificate is from the wrong project".
 *
 * The Firebase SDK is mocked rather than exercised: `isSupported()` is false in
 * jsdom whatever the code does, so a test that did not mock it would only ever
 * reach one of the five branches and would be asserting the environment.
 */
const messaging = vi.hoisted(() => ({
  getToken: vi.fn(),
  isSupported: vi.fn(async () => true),
  getMessaging: vi.fn(() => ({})),
}));

vi.mock("firebase/messaging", () => messaging);
vi.mock("firebase/app", () => ({ initializeApp: vi.fn(() => ({})), getApps: vi.fn(() => []) }));

describe("when a browser will not register", () => {
  const ready = async () => {
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
    vi.stubGlobal("PushManager", class {});
    Object.defineProperty(window, "PushManager", { value: class {}, configurable: true });
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({}) },
      configurable: true,
    });
    return await import("./index");
  };

  beforeEach(() => {
    messaging.getToken.mockReset();
    messaging.isSupported.mockResolvedValue(true);
  });

  it("keeps the reason a mint failure gave, because that is the useful half", async () => {
    // `messaging/token-subscribe-failed` almost always means the Web Push
    // certificate belongs to a different project than the sender does — a
    // mismatch nothing else in the system can see, because both halves are
    // individually valid. Collapsing it to "unavailable" threw that away.
    messaging.getToken.mockRejectedValue(
      Object.assign(new Error("nope"), { code: "messaging/token-subscribe-failed" }),
    );
    const { enableNotifications } = await ready();

    const result = await enableNotifications();

    expect(result).toEqual({
      state: "unavailable",
      reason: "mint-failed",
      detail: "messaging/token-subscribe-failed",
    });
  });

  it("tells an empty answer apart from a refusal", async () => {
    // FCM answering with nothing is its own failure, and a different fix.
    messaging.getToken.mockResolvedValue("");
    const { enableNotifications } = await ready();

    expect(await enableNotifications()).toEqual({ state: "unavailable", reason: "no-token" });
  });

  it("says so when the token is good and only our own server refused it", async () => {
    // Worth separating: this one really is a retry, and the next launch fixes
    // it. Telling somebody to check their certificate here would be wrong.
    messaging.getToken.mockResolvedValue("a-real-token");
    const { enableNotifications } = await ready();

    const result = await enableNotifications();

    expect(result.state).toBe("unavailable");
    if (result.state === "unavailable") expect(result.reason).toBe("server-refused");
  });
});
