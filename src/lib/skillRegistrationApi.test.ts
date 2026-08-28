import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.now() + 600_000,
  deviceId: "d_1",
  familyId: "f_1",
  role: "student",
  platformRole: "none",
  permissions: [],
  userId: "u_1",
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem("koda_session_v1", JSON.stringify(session));
});

describe("per-user skill registration", () => {
  it("scopes child registrations to the learner rather than the device", async () => {
    const { skillRegistrationScope } = await import("./skillRegistrationApi");
    expect(skillRegistrationScope({ ...session, learnerId: "l_1" })).toBe("learner:l_1");
    expect(skillRegistrationScope(session)).toBe("user:u_1");
  });

  it("registers on the server and stores the user's offline copy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ skillId: "counting", registeredAt: 1_777_000_000_000 }),
    }));

    const { registerSkillForCurrentUser } = await import("./skillRegistrationApi");
    await registerSkillForCurrentUser("counting");

    const cached = JSON.parse(localStorage.getItem("koda_skill_registrations_v2") ?? "{}");
    expect(cached["user:u_1"]).toEqual([
      { skillId: "counting", registeredAt: 1_777_000_000_000 },
    ]);
    expect(localStorage.getItem("koda_skill_registration_outbox_v2")).toBe("{}");
  });

  it("keeps an optimistic registration queued when offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    const { registerSkillForCurrentUser } = await import("./skillRegistrationApi");
    await registerSkillForCurrentUser("counting");

    const cached = JSON.parse(localStorage.getItem("koda_skill_registrations_v2") ?? "{}");
    const queued = JSON.parse(localStorage.getItem("koda_skill_registration_outbox_v2") ?? "{}");
    expect(cached["user:u_1"][0].skillId).toBe("counting");
    expect(queued["user:u_1"].counting).toBe("register");
  });
});
