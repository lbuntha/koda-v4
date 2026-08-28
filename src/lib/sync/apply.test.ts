import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Applying what another device changed, and not re-sending what did not change.
 *
 * The rule under test: a pulled document lands in the store that owns it, in
 * the shape that store already reads — sync must never hand a store a value it
 * would not have written itself.
 */

const SESSION_KEY = "koda_session_v1";

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

const doc = (overrides: Record<string, unknown> = {}) => ({
  kind: "skill",
  key: "counting",
  body: { isEnabled: true, thumbnail: "apple" },
  rev: 2,
  serverSeq: 41,
  deleted: false,
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe("applying a pulled document", () => {
  it("writes a skill into the array the store reads", async () => {
    localStorage.setItem(
      "koda_learning_skills_v2",
      JSON.stringify([{ id: "counting", thumbnail: "counting-quest" }, { id: "addition" }]),
    );

    const { applyChanges } = await import("./apply");
    applyChanges([doc()], 41);

    const stored = JSON.parse(localStorage.getItem("koda_learning_skills_v2") ?? "[]");
    expect(stored).toHaveLength(2);
    expect(stored.find((s: { id: string }) => s.id === "counting").thumbnail).toBe("apple");
    expect(stored.find((s: { id: string }) => s.id === "addition")).toBeTruthy();
  });

  it("nests lesson wording under skill and lesson", async () => {
    const { applyChanges } = await import("./apply");
    applyChanges(
      [doc({ kind: "lessonContent", key: "counting/count-in-a-row", body: { title: "New" } })],
      42,
    );

    const stored = JSON.parse(localStorage.getItem("koda_lesson_content_v1") ?? "{}");
    expect(stored.counting["count-in-a-row"].title).toBe("New");
  });

  it("replaces a single-document store outright", async () => {
    const { applyChanges } = await import("./apply");
    applyChanges([doc({ kind: "preferences", key: "default", body: { theme: "dark" } })], 43);

    expect(JSON.parse(localStorage.getItem("koda_preferences_v1") ?? "{}")).toEqual({
      theme: "dark",
    });
  });

  it("lands a child's settings under that child's own key", async () => {
    const { applyChanges } = await import("./apply");
    applyChanges(
      [
        doc({
          kind: "childSettings",
          key: "l_mia",
          learnerId: "l_mia",
          body: { sessionMinutes: 20 },
        }),
        doc({
          kind: "childSettings",
          key: "l_sam",
          learnerId: "l_sam",
          body: { sessionMinutes: 45 },
        }),
      ],
      44,
    );

    // Two children on one tablet: a shared key would give the second child the
    // first one's cap, which is the bug `storageKeyFor` exists to prevent.
    expect(JSON.parse(localStorage.getItem("koda_child_settings_v1__l_mia") ?? "{}")).toEqual({
      sessionMinutes: 20,
    });
    expect(JSON.parse(localStorage.getItem("koda_child_settings_v1__l_sam") ?? "{}")).toEqual({
      sessionMinutes: 45,
    });
  });

  it("takes how to store a body from the kinds table, not from a list of its own", async () => {
    // The guard on the seam: every kind has to declare a shape, so adding one
    // cannot silently fall through to the wrong branch of `applyDoc`.
    const { SYNC_KINDS } = await import("./kinds");

    for (const [kind, spec] of Object.entries(SYNC_KINDS)) {
      expect(["whole", "map", "list"], `${kind} declares a storage shape`).toContain(spec.shape);
    }
  });

  it("ignores a document of a kind this device no longer syncs", async () => {
    const { applyChanges } = await import("./apply");
    localStorage.setItem("koda_streak_v1", JSON.stringify({ roundsPerDay: 1 }));

    // Scoring, the streak rule and the badges became the deployment's, set once
    // for every family. A stale family document for one of them must not be
    // able to reach in and overwrite what the operator decided.
    const applied = applyChanges(
      [doc({ kind: "streak", key: "default", body: { roundsPerDay: 9 } })],
      44,
    );

    expect(applied).toBe(0);
    expect(JSON.parse(localStorage.getItem("koda_streak_v1") ?? "{}").roundsPerDay).toBe(1);
  });

  it("keeps one child's pulled record off another's key", async () => {
    const { applyChanges } = await import("./apply");
    localStorage.setItem("koda_learner_progress_v1__l_thana", JSON.stringify({ xp: 216 }));

    applyChanges(
      [doc({ kind: "progress", key: "l_jutta", learnerId: "l_jutta", body: { xp: 30 } })],
      45,
    );

    expect(JSON.parse(localStorage.getItem("koda_learner_progress_v1__l_jutta") ?? "{}").xp).toBe(30);
    expect(JSON.parse(localStorage.getItem("koda_learner_progress_v1__l_thana") ?? "{}").xp).toBe(216);
    // Nothing under the bare key: that is the shared one both children used to
    // overwrite in turn.
    expect(localStorage.getItem("koda_learner_progress_v1")).toBeNull();
  });

  it("removes what a tombstone deletes", async () => {
    localStorage.setItem("koda_learning_skills_v2", JSON.stringify([{ id: "counting" }]));

    const { applyChanges } = await import("./apply");
    applyChanges([doc({ deleted: true, rev: 3 })], 44);

    expect(JSON.parse(localStorage.getItem("koda_learning_skills_v2") ?? "[]")).toEqual([]);
  });

  it("moves the cursor so the next pull asks for less", async () => {
    const { applyChanges, cursor } = await import("./apply");
    applyChanges([doc()], 41);
    expect(cursor()).toBe(41);
  });

  it("ignores a kind this build does not know", async () => {
    const { applyDoc } = await import("./apply");
    expect(applyDoc(doc({ kind: "somethingNewer" }) as never)).toBe(false);
  });
});

describe("recording an edit", () => {
  it("queues one mutation carrying the revision it was made against", async () => {
    signIn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { applyChanges } = await import("./apply");
    const { SyncEngine } = await import("./engine");
    const { Outbox } = await import("./outbox");

    applyChanges([doc({ rev: 7 })], 50);
    SyncEngine.recordDoc("skill", "counting", { isEnabled: false });

    const [queued] = Outbox.peekMutations(10);
    expect(queued.kind).toBe("skill");
    expect(queued.baseRev).toBe(7);
  });

  it("coalesces repeated edits of the same setting", async () => {
    signIn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { SyncEngine } = await import("./engine");
    const { Outbox } = await import("./outbox");

    SyncEngine.recordDoc("skill", "counting", { isEnabled: true });
    SyncEngine.recordDoc("skill", "counting", { isEnabled: false });
    SyncEngine.recordDoc("skill", "counting", { isEnabled: true, thumbnail: "apple" });

    const queued = Outbox.peekMutations(10);
    expect(queued).toHaveLength(1);
    expect(queued[0].body).toEqual({ isEnabled: true, thumbnail: "apple" });
    expect(queued[0].baseRev).toBe(0);
  });

  it("does not treat an unchanged save as an edit", async () => {
    signIn();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const { applyChanges } = await import("./apply");
    const { SyncEngine } = await import("./engine");
    const { Outbox } = await import("./outbox");

    // What the server already has — the app re-saves this on every boot.
    applyChanges([doc({ body: { isEnabled: true, thumbnail: "apple" }, rev: 2 })], 60);
    SyncEngine.recordDoc("skill", "counting", { isEnabled: true, thumbnail: "apple" });

    expect(Outbox.peekMutations(10)).toHaveLength(0);
  });
});
