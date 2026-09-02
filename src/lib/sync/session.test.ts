import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a lost connection may and may not do to a signed-in device.
 *
 * The gate in App.tsx means "no session" now equals "no app", so the rules that
 * used to be a nicety are load-bearing: offline must never clear a session, and
 * a server that says the session is gone must.
 */

const STORAGE_KEY = "koda_session_v1";

const storedSession = (overrides: Record<string, unknown> = {}) => ({
  accessToken: "access-token",
  refreshToken: "refresh-token",
  // Comfortably valid, so nothing refreshes unless a test wants it to.
  expiresAt: Date.now() + 10 * 60 * 1000,
  deviceId: "d_1",
  familyId: "f_1",
  role: "owner",
  email: "parent@example.com",
  ...overrides,
});

const loadSession = async () => {
  const module = await import("./session");
  return module.SessionAPI;
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a signed-in device that loses the network", () => {
  it("keeps the session when the fetch itself fails", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const SessionAPI = await loadSession();
    await expect(SessionAPI.verify()).resolves.toBe(true);
    expect(SessionAPI.current()).not.toBeNull();
  });

  it("keeps the session when the data service is down behind the proxy", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { code: "api_unreachable", message: "not running" } }),
      }),
    );

    const SessionAPI = await loadSession();
    await expect(SessionAPI.verify()).resolves.toBe(true);
    expect(SessionAPI.current()).not.toBeNull();
  });

  it("keeps the session when the token is stale and refresh cannot reach anyone", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(storedSession({ expiresAt: Date.now() - 1000 })),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const SessionAPI = await loadSession();
    await SessionAPI.verify();
    expect(SessionAPI.current()?.email).toBe("parent@example.com");
  });
});

describe("a server having trouble", () => {
  it("does not sign anybody out on a 500", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "server_error", message: "Something went wrong." } }),
      }),
    );

    const SessionAPI = await loadSession();
    await expect(SessionAPI.verify()).resolves.toBe(true);
    expect(SessionAPI.current()).not.toBeNull();
  });

  it("does not sign anybody out while it is restarting", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: { code: "bad_gateway", message: "Upstream is restarting." } }),
      }),
    );

    const SessionAPI = await loadSession();
    await SessionAPI.verify();
    expect(SessionAPI.current()).not.toBeNull();
  });
});

describe("a session the server no longer honours", () => {
  it("is cleared when /auth/me rejects it", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "unauthorized", message: "Sign in to continue." } }),
      }),
    );

    const SessionAPI = await loadSession();
    await expect(SessionAPI.verify()).resolves.toBe(false);
    expect(SessionAPI.current()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("is cleared when a refresh is refused — the device was revoked", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(storedSession({ expiresAt: Date.now() - 1000 })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "refresh_invalid", message: "Please sign in again." } }),
      }),
    );

    const SessionAPI = await loadSession();
    await SessionAPI.verify();
    expect(SessionAPI.current()).toBeNull();
  });
});

describe("signing out", () => {
  it("clears this device even when the server cannot be told", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const SessionAPI = await loadSession();
    await SessionAPI.signOut();
    expect(SessionAPI.current()).toBeNull();
  });
});

describe("email verification", () => {
  it("does not create a local session while signup is waiting for email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          verificationRequired: true,
          email: "parent@example.com",
          emailSent: true,
        }),
      }),
    );

    const SessionAPI = await loadSession();
    const result = await SessionAPI.signUp(
      "parent@example.com",
      "password",
      "My family",
    );
    expect(result).toMatchObject({ verificationRequired: true, emailSent: true });
    expect(SessionAPI.current()).toBeNull();
  });

  it("activates the session returned by a valid verification link", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/auth/email/verify")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: "verified-access",
            refreshToken: "verified-refresh",
            expiresIn: 900,
            deviceId: "d_verified",
            familyId: "f_verified",
            role: "owner",
            permissions: [],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          userId: "u_verified",
          email: "parent@example.com",
          displayName: null,
          avatarSeed: "a_verified",
          familyId: "f_verified",
          familyName: "My family",
          role: "owner",
          platformRole: "none",
          learnerId: null,
          learnerName: null,
          learnerBirthYear: null,
          permissions: [],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const SessionAPI = await loadSession();
    const session = await SessionAPI.verifyEmail("one-time-token");
    expect(session.email).toBe("parent@example.com");
    expect(SessionAPI.current()?.refreshToken).toBe("verified-refresh");
  });
});

describe("Google sign-in", () => {
  it("exchanges the Google credential and stores the ordinary Koda session", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/auth/google")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: "google-access",
            refreshToken: "google-refresh",
            expiresIn: 900,
            deviceId: "d_google",
            familyId: "f_google",
            role: "owner",
            permissions: ["learner:read"],
          }),
        };
      }
      expect(init?.headers).toMatchObject({ Authorization: "Bearer google-access" });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          userId: "u_google",
          email: "parent@gmail.com",
          displayName: "Sokha Parent",
          avatarSeed: "a_google_parent",
          familyId: "f_google",
          familyName: "Sokha's family",
          role: "owner",
          platformRole: "none",
          learnerId: null,
          learnerName: null,
          learnerBirthYear: null,
          permissions: ["learner:read"],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const SessionAPI = await loadSession();
    const session = await SessionAPI.signInWithGoogle(
      "google-id-token",
      true,
      "Sokha's family",
    );

    const exchange = fetchMock.mock.calls[0];
    expect(exchange[0]).toContain("/auth/google");
    expect(JSON.parse(String(exchange[1]?.body))).toMatchObject({
      credential: "google-id-token",
      createAccount: true,
      familyName: "Sokha's family",
    });
    expect(session.email).toBe("parent@gmail.com");
    expect(SessionAPI.current()?.refreshToken).toBe("google-refresh");
  });
});

/**
 * Switching between the accounts this device remembers.
 *
 * The stored pair for an account you are not currently using is as old as the
 * moment you left it, so switching has to put it to the server before the
 * reload rather than after — a page that has already started tearing down
 * cannot save the rotated token, and the account is then stuck on a refresh
 * token the server has retired.
 */
describe("switching to a remembered account", () => {
  const ACCOUNTS_KEY = "koda_accounts_v1";

  const stale = (overrides: Record<string, unknown> = {}) =>
    storedSession({ expiresAt: Date.now() - 60 * 60 * 1000, ...overrides });

  const child = (overrides: Record<string, unknown> = {}) =>
    stale({
      deviceId: "d_child",
      role: "child",
      refreshToken: "child-refresh",
      email: undefined,
      learnerId: "l_1",
      learnerName: "Thana",
      ...overrides,
    });

  const jsonOk = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  const rejected = {
    ok: false,
    status: 401,
    json: async () => ({ error: { code: "bad_refresh", message: "no" } }),
  };

  beforeEach(() => {
    // The switch ends in a reload, which jsdom cannot perform.
    vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
  });

  it("refreshes the target's token before that session becomes the app's", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([storedSession(), child()]));
    const fetchMock = vi.fn().mockResolvedValue(
      jsonOk({
        accessToken: "fresh-access",
        refreshToken: "fresh-refresh",
        expiresIn: 900,
        deviceId: "d_child",
        familyId: "f_1",
        role: "child",
        permissions: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const SessionAPI = await loadSession();
    await expect(SessionAPI.switchAccount("d_child")).resolves.toBe(true);

    expect(fetchMock.mock.calls[0][0]).toContain("/auth/refresh");
    // The rotated pair is what the reloading page will pick up, not the pair
    // that was already spent getting it.
    expect(SessionAPI.current()?.refreshToken).toBe("fresh-refresh");
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    expect(saved.refreshToken).toBe("fresh-refresh");
    expect(saved.learnerName).toBe("Thana");
  });

  it("reopens a child from the parent when the saved child session is dead", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([storedSession(), child()]));
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes("/auth/switch/")
        ? jsonOk({
            accessToken: "switched-access",
            refreshToken: "switched-refresh",
            expiresIn: 900,
            deviceId: "d_child_2",
            familyId: "f_1",
            role: "child",
            permissions: [],
          })
        : rejected,
    );
    vi.stubGlobal("fetch", fetchMock);

    const SessionAPI = await loadSession();
    await expect(SessionAPI.switchAccount("d_child")).resolves.toBe(true);

    expect(SessionAPI.current()?.role).toBe("child");
    expect(SessionAPI.current()?.learnerName).toBe("Thana");
    expect(SessionAPI.current()?.refreshToken).toBe("switched-refresh");
  });

  it("refuses the switch and forgets the account rather than signing this device out", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    localStorage.setItem(
      ACCOUNTS_KEY,
      JSON.stringify([storedSession(), stale({ deviceId: "d_2", email: "other@example.com" })]),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(rejected));

    const SessionAPI = await loadSession();
    await expect(SessionAPI.switchAccount("d_2")).rejects.toThrow(/sign in again/i);

    // The account in use is untouched — the failure belonged to the other one.
    expect(SessionAPI.current()?.deviceId).toBe("d_1");
    expect(SessionAPI.accounts().map((a) => a.deviceId)).not.toContain("d_2");
  });

  it("still switches when there is no network at all", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession()));
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([storedSession(), child()]));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const SessionAPI = await loadSession();
    await expect(SessionAPI.switchAccount("d_child")).resolves.toBe(true);
    expect(SessionAPI.current()?.learnerName).toBe("Thana");
  });
});
