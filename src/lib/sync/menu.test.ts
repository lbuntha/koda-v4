import { beforeEach, describe, expect, it, vi } from "vitest";

const SESSION_KEY = "koda_session_v1";
const MENU_KEY = "koda_menu_v1";

const parentSession = {
  accessToken: "parent-access",
  refreshToken: "parent-refresh",
  expiresAt: Date.now() + 600_000,
  deviceId: "parent-device",
  familyId: "family-1",
  role: "owner",
  platformRole: "none",
  permissions: ["settings:write"],
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem(SESSION_KEY, JSON.stringify(parentSession));
});

describe("role-scoped sidebar menu cache", () => {
  it("does not expose an administrator cache to a parent", async () => {
    const adminScope = JSON.stringify(["platform", "admin", "admin", ["menu:manage"]]);
    localStorage.setItem(
      MENU_KEY,
      JSON.stringify({
        version: 2,
        menus: {
          [adminScope]: [{ id: "assets", label: "Art", icon: "shapes", order: 40 }],
        },
      }),
    );

    const { Menu } = await import("./menu");
    expect(Menu.items()).toBeNull();
  });

  it("stores an empty server menu as an authoritative result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    }));

    const { Menu, refreshMenu } = await import("./menu");
    await refreshMenu();
    expect(Menu.items()).toEqual([]);
  });
});
