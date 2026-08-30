import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the upload loop does with a network that is not there.
 *
 * The rule under test: a queued event is never lost. Not when the connection
 * drops, not when the app restarts, not when the server refuses the batch, and
 * not when somebody signs out mid-round.
 */

const SESSION_KEY = "koda_session_v1";
const OUTBOX_KEY = "koda_outbox_v1";

const event = (id: string) => ({
  id,
  ts: "2026-08-19T09:00:00.000Z",
  type: "answer_submitted",
  sessionId: "s_1",
  learnerId: "l_mia",
  seq: 1,
  skillId: "counting",
  conceptKey: "corresponder",
  correct: true,
  attempt: 1,
});

const signIn = () =>
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 10 * 60 * 1000,
      deviceId: "d_1",
      familyId: "f_1",
      role: "owner",
    }),
  );

const load = async () => {
  const [{ SyncEngine }, { Outbox }] = await Promise.all([
    import("./engine"),
    import("./outbox"),
  ]);
  return { SyncEngine, Outbox };
};

const okPush = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ accepted: 1, duplicates: 0, cursor: 1 }),
  });

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sending", () => {
  it("empties the queue when the server takes the batch", async () => {
    signIn();
    const fetchMock = okPush();
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1"), event("e_2")]);
    await vi.waitFor(() => expect(Outbox.size()).toBe(0));

    const pushCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/sync/push"));
    expect(pushCall).toBeDefined();
    const [, init] = pushCall!;
    const body = JSON.parse(init.body);
    expect(body.events).toHaveLength(2);
    expect(init.headers.Authorization).toBe("Bearer access-token");
  });

  it("treats duplicates as delivered, so a replay cannot strand the queue", async () => {
    signIn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ accepted: 0, duplicates: 2, cursor: 9 }),
      }),
    );

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1"), event("e_2")]);
    await vi.waitFor(() => expect(Outbox.size()).toBe(0));
  });
});

describe("with no connection", () => {
  it("keeps every event and reports itself offline", async () => {
    signIn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("offline"));
    expect(Outbox.size()).toBe(1);
    expect(SyncEngine.status().pending).toBe(1);
  });

  it("survives a restart — the queue is on disk, not in memory", async () => {
    signIn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const first = await load();
    first.SyncEngine.record([event("e_1"), event("e_2")]);
    await vi.waitFor(() => expect(first.Outbox.size()).toBe(2));

    // A new app load, same device.
    vi.resetModules();
    vi.stubGlobal("fetch", okPush());
    const second = await load();
    expect(second.Outbox.size()).toBe(2);

    await second.SyncEngine.flush();
    await vi.waitFor(() => expect(second.Outbox.size()).toBe(0));
  });

  it("keeps the queue when the server refuses the batch", async () => {
    signIn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: { code: "unprocessable", message: "Bad batch." } }),
      }),
    );

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => expect(SyncEngine.status().lastError).toBe("Bad batch."));
    expect(Outbox.size()).toBe(1);
  });
});

describe("signed out", () => {
  it("holds the work, and sends it once somebody signs in", async () => {
    // One mock for both routes: signing in has to go through SessionAPI, not
    // through localStorage, or the test proves something the app never does.
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/auth/login")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiresIn: 900,
            deviceId: "d_1",
            familyId: "f_1",
            role: "owner",
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ accepted: 1, duplicates: 0, cursor: 1 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    const { SessionAPI } = await import("./session");

    SyncEngine.record([event("e_1")]);
    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("signed-out"));
    expect(Outbox.size()).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();

    await SessionAPI.signIn("parent@example.com", "123456");
    await SyncEngine.flush();
    await vi.waitFor(() => expect(Outbox.size()).toBe(0));
  });
});

describe("the stored queue", () => {
  it("is the same shape a later load can read", async () => {
    signIn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { SyncEngine } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "{}");
      expect(stored.events).toHaveLength(1);
      expect(stored.events[0].id).toBe("e_1");
    });
  });
});

describe("a refusal", () => {
  it("stops the loop instead of retrying every thirty seconds", async () => {
    signIn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "forbidden", message: "This account cannot learner_data append." },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("refused"));
    expect(Outbox.size()).toBe(1);

    const calls = fetchMock.mock.calls.length;
    await SyncEngine.flush();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("does not re-ask on every event when the account itself is the reason", async () => {
    signIn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "no_family", message: "This account is not part of a family." },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);
    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("refused"));
    expect(SyncEngine.status().reason).toBe("no_family");

    // A staff account has no family for the rest of this session, so recording
    // more work must not buy one 403 per event.
    const calls = fetchMock.mock.calls.length;
    SyncEngine.record([event("e_2")]);
    SyncEngine.record([event("e_3")]);
    await SyncEngine.flush();

    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(Outbox.size()).toBe(3);
  });

  it("keeps the work, and tries again when the refusal might pass", async () => {
    signIn();
    /*
     * A code the engine does not know is treated as possibly-transient: the
     * server may allow this tomorrow, and dropping the work would be worse than
     * asking twice. `forbidden` is deliberately *not* used here any more — it
     * names a permission a role can never hold, so re-asking only produces one
     * 403 per recorded event.
     */
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: "rate_limited", message: "Slow down." } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);
    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("refused"));

    const calls = fetchMock.mock.calls.length;
    SyncEngine.record([event("e_2")]);
    await vi.waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(calls));
    expect(Outbox.size()).toBe(2);
  });
});

describe("a standing refusal is not re-litigated on every event", () => {
  it("stops asking once the account itself is forbidden", async () => {
    signIn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "forbidden", message: "This account cannot learner_data append." },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);
    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("refused"));

    /*
     * A lesson records constantly — a tap, an answer, a completed round. When
     * `forbidden` was treated as possibly-transient, each of those cleared the
     * refusal and bought another 403: a staff account produced two dozen in
     * three minutes, for a permission `GRANT_ONLY` says a role can never hold.
     */
    const before = fetchMock.mock.calls.length;
    for (let i = 2; i < 12; i += 1) SyncEngine.record([event(`e_${i}`)]);
    await SyncEngine.flush();
    await SyncEngine.pull().catch(() => undefined);

    expect(fetchMock.mock.calls.length, "kept asking after a standing refusal").toBe(before);
    expect(Outbox.size(), "the work is kept for whoever signs in next").toBe(11);
  });
});

/**
 * A refusal the session already predicts, sent before it is asked for.
 *
 * The console showed `POST /v1/sync/push 403 (Forbidden)` on a platform admin
 * account. The engine handled it correctly *afterwards* — one refusal, no
 * retry loop — but the request itself was certain to fail before it was sent:
 * the session says `familyId: null`, and the server refuses any family-less
 * account outright because a support account that could push would start owning
 * a child's record.
 *
 * So the answer is not to absorb the 403 more quietly. It is not to ask.
 *
 * The dangerous half is the other direction: an ordinary family token often
 * carries no `permissions` array at all, and reading that absence as "may not"
 * would silently stop syncing a child's record. Unknown must still try.
 */
const signInAs = (over: Record<string, unknown>) =>
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: Date.now() + 10 * 60 * 1000,
      deviceId: "d_1",
      familyId: "f_1",
      role: "owner",
      ...over,
    }),
  );

const pushCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes("/sync/"));

describe("an account that could never sync", () => {
  it("does not ask at all when there is no family to write into", async () => {
    // The exact account from the report: platform admin, familyId null.
    signInAs({ familyId: null, role: "admin", platformRole: "admin" });
    const fetchMock = okPush();
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("refused"));
    expect(SyncEngine.status().reason).toBe("no_family");
    // Not one 403 — no request at all.
    expect(pushCalls(fetchMock)).toHaveLength(0);
    // And the work is kept: signing in as a family member sends it.
    expect(Outbox.size()).toBe(1);
  });

  it("does not ask when the token's own permissions exclude appending", async () => {
    signInAs({
      permissions: ["content:write", "scoring:write", "settings:write", "system:write"],
    });
    const fetchMock = okPush();
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => expect(SyncEngine.status().state).toBe("refused"));
    expect(SyncEngine.status().reason).toBe("forbidden");
    expect(pushCalls(fetchMock)).toHaveLength(0);
    expect(Outbox.size()).toBe(1);
  });

  it("still asks when the token simply does not say — unknown is not a refusal", async () => {
    // The ordinary family token: a real family, and no permissions array. This
    // is the case that must NOT be silently refused.
    signInAs({});
    const fetchMock = okPush();
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => expect(Outbox.size()).toBe(0));
    expect(pushCalls(fetchMock).length).toBeGreaterThan(0);
  });

  it("still asks for an account that holds the permission explicitly", async () => {
    signInAs({ permissions: ["learner_data:append", "learner_data:read"] });
    const fetchMock = okPush();
    vi.stubGlobal("fetch", fetchMock);

    const { SyncEngine, Outbox } = await load();
    SyncEngine.record([event("e_1")]);

    await vi.waitFor(() => expect(Outbox.size()).toBe(0));
  });
});
