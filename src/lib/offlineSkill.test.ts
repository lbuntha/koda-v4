import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The download a child is promised when they add a skill.
 *
 * The promise is narrow on purpose — lessons and artwork are already in the app
 * bundle, so what this fetches is speech — but it is a promise, and the two
 * ways to break it are both silent. Report ready while clips are still missing
 * and a child meets the browser's robot voice in the car; report a failure as
 * fatal and a dropped connection costs them the skill they just added.
 */

const clipUrls = vi.hoisted(() => ({ current: [] as string[] }));
vi.mock("./voiceClips", () => ({ clipUrlsFor: () => clipUrls.current }));

const load = async () => import("./offlineSkill");

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  clipUrls.current = [];
});

/** A network that answers everything except the URLs it is told to refuse. */
const network = (refuse: string[] = []) =>
  vi.fn(async (url: string) =>
    refuse.includes(url)
      ? ({ ok: false, status: 504 } as Response)
      : ({ ok: true, status: 200 } as Response),
  );

describe("preparing a skill for offline", () => {
  it("fetches every clip the skill and the common pack need", async () => {
    clipUrls.current = ["/a.m4a", "/b.m4a", "/c.m4a"];
    const fetchMock = network();
    vi.stubGlobal("fetch", fetchMock);

    const { prepareSkillOffline } = await load();
    const result = await prepareSkillOffline("addition");

    expect(result).toEqual({ state: "ready", done: 3, total: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => call[0]).sort()).toEqual([
      "/a.m4a",
      "/b.m4a",
      "/c.m4a",
    ]);
  });

  it("counts up as it goes, so the number on screen is real", async () => {
    clipUrls.current = ["/a.m4a", "/b.m4a"];
    vi.stubGlobal("fetch", network());

    const { prepareSkillOffline } = await load();
    const seen: string[] = [];
    await prepareSkillOffline("addition", (p) => seen.push(`${p.state} ${p.done}/${p.total}`));

    expect(seen[0]).toBe("preparing 0/2");
    expect(seen.at(-1)).toBe("ready 2/2");
  });

  it("reports a skill with nothing recorded as ready, not as a failure", async () => {
    // The normal state of a new skill: it is genuinely playable offline, since
    // the lesson and its artwork ship with the app. Only speech is fetched.
    const fetchMock = network();
    vi.stubGlobal("fetch", fetchMock);

    const { prepareSkillOffline, isSkillOffline, offlineMessage } = await load();
    const result = await prepareSkillOffline("addition");

    expect(result).toEqual({ state: "ready", done: 0, total: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isSkillOffline("addition")).toBe(true);
    expect(offlineMessage(result)).toContain("device's voice");
  });

  it("keeps what arrived when the connection goes, and says so", async () => {
    clipUrls.current = ["/a.m4a", "/b.m4a", "/c.m4a"];
    vi.stubGlobal("fetch", network(["/b.m4a"]));

    const { prepareSkillOffline, isSkillOffline } = await load();
    const result = await prepareSkillOffline("addition");

    expect(result.state).toBe("incomplete");
    expect(result.done, "a clip that did arrive was thrown away").toBe(2);
    // Not remembered as done, so the next open offers the rest rather than
    // claiming a skill is ready when a third of it is missing.
    expect(isSkillOffline("addition")).toBe(false);
  });

  it("survives a fetch that throws rather than answering", async () => {
    clipUrls.current = ["/a.m4a"];
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));

    const { prepareSkillOffline } = await load();
    await expect(prepareSkillOffline("addition")).resolves.toMatchObject({ state: "incomplete" });
  });

  it("costs only what is missing when it is run again", async () => {
    clipUrls.current = ["/a.m4a", "/b.m4a"];
    vi.stubGlobal("fetch", network());

    const { prepareSkillOffline, isSkillOffline } = await load();
    await prepareSkillOffline("addition");
    expect(isSkillOffline("addition")).toBe(true);

    // Recording adds clips after a child downloaded the skill: it is no longer
    // complete, and saying so is the point of comparing against the build
    // rather than storing a boolean.
    clipUrls.current = ["/a.m4a", "/b.m4a", "/new.m4a"];
    expect(isSkillOffline("addition")).toBe(false);
  });

  it("still downloads when the device cannot remember it did", async () => {
    clipUrls.current = ["/a.m4a"];
    vi.stubGlobal("fetch", network());
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });

    const { prepareSkillOffline } = await load();
    await expect(prepareSkillOffline("addition")).resolves.toMatchObject({ state: "ready" });
    setItem.mockRestore();
  });
});
