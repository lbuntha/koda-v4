import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe("maintenance reset generations", () => {
  it("clears learning and registration caches while preserving unrelated offline edits", async () => {
    localStorage.setItem("koda_learner_progress_v1", JSON.stringify({ xp: 40 }));
    localStorage.setItem("koda_completed_levels_v1", JSON.stringify({ 1: 3 }));
    localStorage.setItem("koda_learning_events_v1", JSON.stringify([{ id: "event_1" }]));
    localStorage.setItem("koda_profile_stats_v1", JSON.stringify({ learner: { totalXp: 40 } }));
    localStorage.setItem("koda_skill_registrations_v2", JSON.stringify({ learner: ["counting"] }));
    localStorage.setItem("koda_skill_registration_outbox_v2", JSON.stringify({ learner: {} }));
    localStorage.setItem(
      "koda_outbox_v1",
      JSON.stringify({
        events: [{ id: "event_1" }],
        mutations: [
          { opId: "p", kind: "progress", key: "learner", body: {}, baseRev: 0 },
          { opId: "s", kind: "settings", key: "family", body: {}, baseRev: 0 },
        ],
      }),
    );

    const { applyMaintenanceVersions } = await import("./maintenanceReset");
    expect(applyMaintenanceVersions({ learningVersion: 1, registrationsVersion: 1 })).toBe(true);

    expect(localStorage.getItem("koda_learner_progress_v1")).toBeNull();
    expect(localStorage.getItem("koda_completed_levels_v1")).toBeNull();
    expect(localStorage.getItem("koda_profile_stats_v1")).toBeNull();
    expect(localStorage.getItem("koda_skill_registrations_v2")).toBeNull();
    expect(localStorage.getItem("koda_skill_registration_outbox_v2")).toBeNull();
    const outbox = JSON.parse(localStorage.getItem("koda_outbox_v1") ?? "{}");
    expect(outbox.events).toEqual([]);
    expect(outbox.mutations.map((item: { kind: string }) => item.kind)).toEqual(["settings"]);
  });

  it("applies each server generation only once", async () => {
    const { applyMaintenanceVersions } = await import("./maintenanceReset");
    const versions = { learningVersion: 2, registrationsVersion: 3 };
    expect(applyMaintenanceVersions(versions)).toBe(true);
    localStorage.setItem("koda_learner_progress_v1", "new progress");
    expect(applyMaintenanceVersions(versions)).toBe(false);
    expect(localStorage.getItem("koda_learner_progress_v1")).toBe("new progress");
  });
});
