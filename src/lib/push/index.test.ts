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
