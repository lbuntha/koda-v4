import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: Date.now() + 60_000,
  deviceId: "device-a",
  familyId: "family-a",
  role: "parent",
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem("koda_session_v1", JSON.stringify(session));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    ),
  );
});

describe("account-scoped entitlements", () => {
  it("does not keep a paid plan in memory after its family signs out", async () => {
    const { Billing, FREE_ENTITLEMENTS } = await import("./billing");
    const { SessionAPI } = await import("./sync");

    Billing.adopt({
      ...FREE_ENTITLEMENTS,
      planId: "family",
      planName: "Family",
      features: ["course.premium"],
    });
    expect(Billing.has("course.premium")).toBe(true);

    await SessionAPI.signOut();

    expect(Billing.current().planId).toBe("free");
    expect(Billing.has("course.premium")).toBe(false);
  });
});
