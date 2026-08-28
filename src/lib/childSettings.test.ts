import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a parent decides for one child.
 *
 * Two things are under test and only one of them is the storage. The first is
 * that **every default is today's behaviour** — a family who never opens this
 * screen must not be able to tell it shipped. The second is that a malformed or
 * half-pulled document degrades one field at a time rather than quietly
 * switching off a rule set beside it.
 */

const recordDoc = vi.fn();
vi.mock("./sync", async () => {
  const kinds = await vi.importActual<typeof import("./sync/kinds")>("./sync/kinds");
  return {
    storageKeyFor: kinds.storageKeyFor,
    SyncEngine: { recordDoc: (...args: unknown[]) => recordDoc(...args) },
  };
});

vi.mock("./learnerProgress", () => ({ currentLearnerId: () => "l_here" }));

const store = async () => (await import("./childSettings")).ChildSettingsAPI;
const KEY = "koda_child_settings_v1__l_mia";

beforeEach(() => {
  vi.resetModules();
  recordDoc.mockClear();
  localStorage.clear();
});

describe("a child nobody has configured", () => {
  it("has no time cap, Koda's help on, and a daily streak", async () => {
    const settings = (await store()).for("l_mia");

    expect(settings).toEqual({
      sessionMinutes: null,
      aiHelpEnabled: true,
      goalCadence: "daily",
      startingPoint: null,
      // No teacher chosen. Resolved to the deployment's default when it is
      // looked up, so a family that never opens this screen still gets one.
      personaId: null,
    });
  });

  it("is not counted as configured", async () => {
    expect((await store()).isSet("l_mia")).toBe(false);
  });
});

describe("setting one thing", () => {
  it("leaves the rest alone", async () => {
    const api = await store();
    api.set("l_mia", { sessionMinutes: 30 });
    const after = api.set("l_mia", { aiHelpEnabled: false });

    expect(after).toEqual({
      sessionMinutes: 30,
      aiHelpEnabled: false,
      goalCadence: "daily",
      startingPoint: null,
      personaId: null,
    });
  });

  it("sends the whole document up, keyed to the child it is for", async () => {
    (await store()).set("l_mia", { goalCadence: "weekly" });

    expect(recordDoc).toHaveBeenCalledWith(
      "childSettings",
      "l_mia",
      {
        sessionMinutes: null,
        aiHelpEnabled: true,
        goalCadence: "weekly",
        startingPoint: null,
        personaId: null,
      },
      { learnerId: "l_mia" },
    );
  });

  it("keeps two children apart", async () => {
    const api = await store();
    api.set("l_mia", { sessionMinutes: 20 });
    api.set("l_sam", { sessionMinutes: 45 });

    expect(api.for("l_mia").sessionMinutes).toBe(20);
    expect(api.for("l_sam").sessionMinutes).toBe(45);
  });
});

describe("a cap that is not a number anybody meant", () => {
  it("is held between the smallest useful limit and the largest honest one", async () => {
    const api = await store();

    expect(api.set("l_mia", { sessionMinutes: 1 }).sessionMinutes).toBe(5);
    expect(api.set("l_mia", { sessionMinutes: 9000 }).sessionMinutes).toBe(180);
  });

  it("reads zero or nonsense as no cap rather than as a locked door", async () => {
    const api = await store();

    expect(api.set("l_mia", { sessionMinutes: 0 }).sessionMinutes).toBeNull();
    expect(
      api.set("l_mia", { sessionMinutes: Number.NaN as unknown as number }).sessionMinutes,
    ).toBeNull();
  });
});

describe("a document that arrived damaged", () => {
  it("loses only the field that is wrong", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ sessionMinutes: "twenty", aiHelpEnabled: false, goalCadence: "weekly" }),
    );

    const settings = (await store()).for("l_mia");
    expect(settings.sessionMinutes).toBeNull();
    // The two that were readable survive the one that was not.
    expect(settings.aiHelpEnabled).toBe(false);
    expect(settings.goalCadence).toBe("weekly");
  });

  it("keeps Koda's help on unless something explicitly says off", async () => {
    // Losing a paid feature to a truncated document is the worse failure, so
    // only a literal `false` switches it off.
    localStorage.setItem(KEY, JSON.stringify({ aiHelpEnabled: "no" }));

    expect((await store()).for("l_mia").aiHelpEnabled).toBe(true);
  });

  it("survives a body that is not JSON at all", async () => {
    localStorage.setItem(KEY, "{oh no");

    expect((await store()).for("l_mia")).toEqual({
      sessionMinutes: null,
      aiHelpEnabled: true,
      goalCadence: "daily",
      startingPoint: null,
      personaId: null,
    });
  });
});

describe("the child playing on this device", () => {
  it("is whose settings apply, without anybody naming them", async () => {
    const api = await store();
    api.set("l_here", { sessionMinutes: 15 });

    expect(api.current().sessionMinutes).toBe(15);
  });
});

describe("a starting point", () => {
  it("is nothing until a grown-up places the child", async () => {
    expect((await store()).for("l_mia").startingPoint).toBeNull();
  });

  it("is kept as the level it names", async () => {
    expect((await store()).set("l_mia", { startingPoint: 4 }).startingPoint).toBe(4);
  });

  it("reads zero and nonsense as the beginning, not as a level", async () => {
    const api = await store();

    expect(api.set("l_mia", { startingPoint: 0 }).startingPoint).toBeNull();
    expect(api.set("l_mia", { startingPoint: -3 }).startingPoint).toBeNull();
    expect(
      api.set("l_mia", { startingPoint: "unit three" as unknown as number }).startingPoint,
    ).toBeNull();
  });
});
