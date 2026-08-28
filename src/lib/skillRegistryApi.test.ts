import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: Date.now() + 600_000,
  deviceId: "d_1",
  familyId: "f_1",
  role: "owner",
};

const record = (status: "draft" | "published") => ({
  id: "counting",
  name: "Counting Quest",
  version: "1.0.0",
  description: "Count",
  category: "core",
  author: "Koda",
  iconName: "Sparkles",
  status,
  audience: { ages: [5, 7], category: "number-sense" },
  teaches: [],
  requires: [],
  rev: 1,
  modified: 1,
  isEnabled: true,
  features: [],
  settings: {},
  lessonContent: {},
  lessons: [],
  publishedBy: status === "published" ? { id: "u_1", displayName: "Koda Developer" } : undefined,
  publishedAt: status === "published" ? 1_776_000_000_000 : undefined,
});

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  localStorage.setItem("koda_session_v1", JSON.stringify(session));
});

describe("server-backed skill registry", () => {
  it("replaces its offline cache after a complete server list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ skills: [record("draft")] }),
    }));

    const { refreshSkillRegistry, SkillRegistryAPI } = await import("./skillRegistryApi");
    await refreshSkillRegistry();

    expect(SkillRegistryAPI.get("counting")?.status).toBe("draft");
    expect(JSON.parse(localStorage.getItem("koda_skill_registry_cache_v1") ?? "[]")).toHaveLength(1);
  });

  it("hydrates all server-managed fields into the offline runtime stores", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        skills: [
          {
            ...record("published"),
            isEnabled: false,
            tagline: "Server listing",
            features: [{ id: "sound", isEnabled: false }],
            settings: { speechRate: 1.4 },
            lessonContent: { "lesson-1": { title: "Server title" } },
          },
        ],
      }),
    }));

    const { refreshSkillRegistry } = await import("./skillRegistryApi");
    await refreshSkillRegistry();

    const skills = JSON.parse(localStorage.getItem("koda_learning_skills_v2") ?? "[]");
    const lessons = JSON.parse(localStorage.getItem("koda_lesson_content_v1") ?? "{}");
    expect(skills[0]).toMatchObject({ isEnabled: false, tagline: "Server listing" });
    expect(skills[0].settings.speechRate).toBe(1.4);
    expect(lessons.counting["lesson-1"].title).toBe("Server title");
  });

  it("uses the last server snapshot when the app starts offline", async () => {
    localStorage.setItem("koda_skill_registry_cache_v1", JSON.stringify([record("draft")]));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    const { releaseStatusOf } = await import("./skillRegistryApi");
    expect(releaseStatusOf({ manifest: { id: "counting", status: "published" } } as never)).toBe(
      "draft",
    );
  });

  it("updates the cache only after publication succeeds on the server", async () => {
    localStorage.setItem("koda_skill_registry_cache_v1", JSON.stringify([record("draft")]));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...record("published"), rev: 2 }),
    }));

    const { setSkillPublication, SkillRegistryAPI } = await import("./skillRegistryApi");
    await setSkillPublication("counting", "published");
    expect(SkillRegistryAPI.get("counting")?.status).toBe("published");
    expect(SkillRegistryAPI.get("counting")?.publishedBy?.displayName).toBe("Koda Developer");
  });

  it("keeps a complete configuration outbox while offline", async () => {
    const { queueSkillConfiguration, SkillRegistryAPI } = await import("./skillRegistryApi");
    queueSkillConfiguration({
      id: "counting",
      isEnabled: false,
      tagline: "Offline listing",
      thumbnail: "apple",
      features: [{ id: "sound", isEnabled: false }],
      settings: { speechRate: 1.4 },
    });

    const queued = JSON.parse(localStorage.getItem("koda_skill_registry_outbox_v1") ?? "{}");
    expect(queued.counting).toMatchObject({
      isEnabled: false,
      tagline: "Offline listing",
      settings: { speechRate: 1.4 },
    });
    expect(SkillRegistryAPI.hasPendingConfiguration("counting")).toBe(true);
  });

  it("uploads and clears an operator's complete queued configuration", async () => {
    localStorage.setItem(
      "koda_session_v1",
      JSON.stringify({
        ...session,
        familyId: null,
        platformRole: "developer",
        permissions: ["content:write"],
      }),
    );
    localStorage.setItem(
      "koda_lesson_content_v1",
      JSON.stringify({ counting: { "lesson-1": { title: "Server title" } } }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...record("published"),
        isEnabled: false,
        tagline: "Managed",
        lessonContent: { "lesson-1": { title: "Server title" } },
        configurationChangedBy: { id: "u_1", displayName: "Koda Developer" },
        configurationChangedAt: 1_776_000_000_000,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queueSkillConfiguration, SkillRegistryAPI } = await import("./skillRegistryApi");
    queueSkillConfiguration({
      id: "counting",
      isEnabled: false,
      tagline: "Managed",
      features: [],
      settings: { speechRate: 1.4 },
    });

    await vi.waitFor(() => expect(SkillRegistryAPI.hasPendingConfiguration("counting")).toBe(false));
    const request = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(fetchMock.mock.calls[0][0]).toContain("/skills/counting/configuration");
    expect(request.lessonContent["lesson-1"].title).toBe("Server title");
  });
});
